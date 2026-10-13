#!/usr/bin/env python3
"""Import products from a Wishlink storefront into content/shop.json.

    python3 tools/import-wishlink.py                     # import from wishlink.com/avora17
    python3 tools/import-wishlink.py --dry-run           # only show what would change
    python3 tools/import-wishlink.py --file page.html    # use a page you saved yourself
    python3 tools/import-wishlink.py --download-images   # keep copies of photos in img/uploads/wishlink

What it does:
  - Products already in the shop (matched by Wishlink ID or link) get a fresh price, MRP, link
    and photo. Your name, brand, note, coupon, badge and category edits are never touched,
    and a photo you uploaded yourself is kept.
  - New products go to a "New from Wishlink" category, hidden, so you can move them and
    switch them on in /admin (use --show to make them visible straight away).
  - Products no longer on Wishlink are only listed, unless you pass --hide-missing.

If it finds nothing, it saves the page to tools/wishlink-page.html: send that file over.
Standard library only, no installs needed.
"""

import argparse
import datetime
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_URL = 'https://www.wishlink.com/avora17'
NEW_CATEGORY = 'New from Wishlink'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0 Safari/537.36')

# Key names Wishlink-style APIs commonly use for each field (first match wins)
NAME_KEYS = ('title', 'name', 'productName', 'product_name', 'productTitle', 'product_title', 'displayName')
LINK_KEYS = ('affiliateUrl', 'affiliate_url', 'affiliateLink', 'affiliate_link', 'shortUrl', 'short_url',
             'shareUrl', 'share_url', 'redirectUrl', 'redirect_url', 'deeplink', 'deepLink', 'buyUrl',
             'purchaseUrl', 'productUrl', 'product_url', 'productLink', 'product_link', 'link', 'url', 'href')
IMAGE_KEYS = ('image', 'imageUrl', 'image_url', 'img', 'imgUrl', 'productImage', 'product_image',
              'thumbnail', 'thumbnailUrl', 'thumbnail_url', 'images', 'imageUrls', 'media', 'picture')
PRICE_KEYS = ('sellingPrice', 'selling_price', 'salePrice', 'sale_price', 'discountedPrice',
              'discounted_price', 'finalPrice', 'final_price', 'offerPrice', 'offer_price', 'price')
MRP_KEYS = ('mrp', 'MRP', 'originalPrice', 'original_price', 'listPrice', 'list_price', 'maxPrice',
            'strikePrice', 'strike_price', 'actualPrice', 'actual_price', 'regularPrice')
BRAND_KEYS = ('brand', 'brandName', 'brand_name', 'storeName', 'store_name', 'store', 'retailer',
              'retailerName', 'merchant', 'merchantName', 'source', 'platform')
ID_KEYS = ('productId', 'product_id', 'id', '_id', 'sku', 'uuid')
REEL_RE = re.compile(r'https?://(?:www\.)?instagram\.com/(?:reel|reels|p)/[\w-]+/?')


# ----------------------------------------------------------------- fetching

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode(r.headers.get_content_charset() or 'utf-8', 'replace')


# ------------------------------------------------------- finding page data

class ScriptsAndCards(HTMLParser):
    """Collects inline <script> bodies, plus <a> links with an <img> inside as a last resort."""

    def __init__(self):
        super().__init__()
        self.scripts, self.cards = [], []
        self._script = None
        self._a = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'script' and not a.get('src'):
            self._script = []
        elif tag == 'a' and a.get('href'):
            self._a = {'link': a['href'], 'image': '', 'text': []}
        elif tag == 'img' and self._a is not None and not self._a['image']:
            self._a['image'] = a.get('src') or a.get('data-src') or ''
            if a.get('alt'):
                self._a['text'].append(a['alt'])

    def handle_endtag(self, tag):
        if tag == 'script' and self._script is not None:
            self.scripts.append(''.join(self._script))
            self._script = None
        elif tag == 'a' and self._a is not None:
            if self._a['image']:
                self.cards.append(self._a)
            self._a = None

    def handle_data(self, data):
        if self._script is not None:
            self._script.append(data)
        elif self._a is not None and data.strip():
            self._a['text'].append(data.strip())


def embedded_json(text, limit=4000):
    """Pull every JSON object/array embedded in a chunk of JavaScript."""
    dec = json.JSONDecoder()
    out, i, tries = [], 0, 0
    while tries < limit:
        m = re.compile(r'[{\[]\s*["{\[]').search(text, i)
        if not m:
            break
        tries += 1
        try:
            obj, end = dec.raw_decode(text, m.start())
        except ValueError:
            i = m.start() + 1
            continue
        if isinstance(obj, (dict, list)) and obj:
            out.append(obj)
        i = end
    return out


def page_data(page):
    """Every JSON blob in the page: whole JSON responses, Next.js data, ld+json, JS state."""
    stripped = page.strip()
    if stripped[:1] in '{[':
        try:
            return [json.loads(stripped)], []
        except ValueError:
            pass
    p = ScriptsAndCards()
    p.feed(page)
    blobs = []
    for body in p.scripts:
        body = body.strip()
        if not body:
            continue
        try:
            blobs.append(json.loads(body))
            continue
        except ValueError:
            pass
        # Next.js app router streams data as self.__next_f.push([1,"...json-ish string..."])
        for s in re.findall(r'__next_f\.push\(\[\d+,\s*("(?:\\.|[^"\\])*")\]\)', body):
            try:
                blobs.extend(embedded_json(json.loads(s)))
            except ValueError:
                pass
        blobs.extend(embedded_json(body))
    return blobs, p.cards


# --------------------------------------------------------- reading products

def first(d, keys):
    for k in keys:
        v = d.get(k)
        if v not in (None, '', [], {}):
            return v
    return None


def as_text(v):
    if isinstance(v, dict):
        v = first(v, ('name', 'title', 'label', 'value'))
    return html.unescape(str(v)).strip() if isinstance(v, (str, int, float)) else ''


def as_url(v):
    if isinstance(v, list):
        v = next((as_url(x) for x in v if as_url(x)), '')
    if isinstance(v, dict):
        v = first(v, ('url', 'src', 'href', 'original', 'large', 'medium', 'small', 'imageUrl', 'link'))
        return as_url(v)
    if isinstance(v, str):
        v = v.strip()
        if v.startswith('//'):
            v = 'https:' + v
        if re.match(r'^https?://', v) or v.startswith('/'):
            return v
    return ''


def as_price(v):
    if isinstance(v, dict):
        v = first(v, ('value', 'amount', 'price', 'selling', 'final'))
    if isinstance(v, bool) or v is None:
        return 0
    if isinstance(v, (int, float)):
        return int(round(v))
    m = re.search(r'\d[\d,]*(?:\.\d+)?', str(v))
    return int(round(float(m.group().replace(',', '')))) if m else 0


def reel_in(d):
    for v in d.values():
        if isinstance(v, str):
            m = REEL_RE.search(v)
            if m:
                return m.group()
    return ''


def to_product(d, base, reel):
    name = as_text(first(d, NAME_KEYS))
    link = as_url(first(d, LINK_KEYS))
    image = as_url(first(d, IMAGE_KEYS))
    if not name or len(name) > 200 or not (link or image):
        return None
    if REEL_RE.match(link or ''):  # an Instagram post, not a product
        return None
    price = as_price(first(d, PRICE_KEYS))
    mrp = as_price(first(d, MRP_KEYS))
    if not (price or mrp or link):
        return None
    pid = first(d, ID_KEYS)
    return {
        'id': str(pid) if isinstance(pid, (str, int)) and not isinstance(pid, bool) else '',
        'name': name,
        'brand': as_text(first(d, BRAND_KEYS)),
        'link': urllib.parse.urljoin(base, link) if link else '',
        'image': urllib.parse.urljoin(base, image) if image else '',
        'price': price,
        'mrp': mrp if mrp > price else 0,
        'reel': reel,
    }


def walk(obj, base, reel='', depth=0):
    """Find product-like objects. An object holding products (a post/collection) isn't one itself."""
    if depth > 40:
        return []
    found = []
    if isinstance(obj, list):
        for x in obj:
            found += walk(x, base, reel, depth + 1)
    elif isinstance(obj, dict):
        reel = reel_in(obj) or reel
        for v in obj.values():
            if isinstance(v, (dict, list)):
                found += walk(v, base, reel, depth + 1)
        p = to_product(obj, base, reel)
        # One priced object with at most one nested match (e.g. its brand) is the product itself
        if p and len(found) <= 1 and (p['price'] or not any(f['price'] for f in found)):
            return [p]
    return found


def from_cards(cards, base):
    """Last resort: product cards straight from the HTML."""
    out = []
    host = urllib.parse.urlparse(base).netloc
    for c in cards:
        link = urllib.parse.urljoin(base, c['link'])
        if REEL_RE.match(link) or urllib.parse.urlparse(link).netloc == host and link.rstrip('/') == base.rstrip('/'):
            continue
        name = max(c['text'], key=len, default='')
        prices = [as_price(t) for t in c['text'] if re.search(r'(₹|rs\.?)\s*\d', t, re.I)]
        if name:
            out.append({'id': '', 'name': name, 'brand': '', 'link': link,
                        'image': urllib.parse.urljoin(base, c['image']),
                        'price': min(prices) if prices else 0,
                        'mrp': max(prices) if len(prices) > 1 else 0, 'reel': ''})
    return out


def link_key(url):
    u = urllib.parse.urlparse(url or '')
    return (u.netloc.lower().removeprefix('www.') + u.path.rstrip('/')).lower()


def dedupe(products):
    seen, out = {}, []
    for p in products:
        k = p['id'] or link_key(p['link']) or p['name'].lower()
        if k in seen:
            old = seen[k]  # merge: keep whichever copy knows more
            for f, v in p.items():
                if v and not old.get(f):
                    old[f] = v
            continue
        seen[k] = p
        out.append(p)
    return out


# ------------------------------------------------------------------ images

def download_image(url, name):
    folder = os.path.join(ROOT, 'img', 'uploads', 'wishlink')
    os.makedirs(folder, exist_ok=True)
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
    ext = ext if ext in ('.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif') else '.jpg'
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:60] or 'product'
    path = os.path.join(folder, slug + ext)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as r, open(path, 'wb') as f:
            f.write(r.read())
    return '/img/uploads/wishlink/' + slug + ext


# ----------------------------------------------------------------- merging

def blank_product(today):
    return {'name': '', 'brand': '', 'image': '', 'price': 0, 'mrp': 0, 'link': '', 'note': '',
            'coupon': {'code': '', 'discount': '', 'expires': '', 'terms': ''},
            'badge': 'none', 'featured': False, 'reel': '', 'added': today, 'hidden': True,
            'wishlink_id': ''}


def merge(shop, scraped, args):
    today = datetime.date.today().isoformat()
    by_id, by_link = {}, {}
    for cat in shop.get('categories', []):
        for p in cat.get('products', []):
            if p.get('wishlink_id'):
                by_id[p['wishlink_id']] = p
            if p.get('link'):
                by_link[link_key(p['link'])] = p

    report = {'updated': [], 'added': [], 'missing': []}
    new_cat = None
    seen = set()
    for s in scraped:
        wid = s['id'] or link_key(s['link'])
        seen.add(wid)
        p = by_id.get(wid) or (by_link.get(link_key(s['link'])) if s['link'] else None)
        image = s['image']
        if image and args.download_images and image.startswith('http'):
            try:
                image = download_image(image, s['name'])
            except Exception as e:  # keep the remote link if the download fails
                print(f'  ! could not download photo for {s["name"]}: {e}')

        if p is None:
            if new_cat is None:
                new_cat = next((c for c in shop['categories'] if c.get('name') == NEW_CATEGORY), None)
                if new_cat is None:
                    new_cat = {'name': NEW_CATEGORY, 'emoji': '🛍️',
                               'blurb': 'Fresh from my Wishlink.', 'products': []}
                    shop['categories'].append(new_cat)
            p = blank_product(today)
            p.update(name=s['name'], brand=s['brand'], image=image, price=s['price'], mrp=s['mrp'],
                     link=s['link'], reel=s['reel'], wishlink_id=wid, hidden=not args.show)
            new_cat['products'].append(p)
            report['added'].append(s['name'])
            continue

        before = json.dumps(p, sort_keys=True)
        p['wishlink_id'] = wid
        if s['link']:
            p['link'] = s['link']
        if s['price']:
            p['price'] = s['price']
            p['mrp'] = s['mrp']
        # Keep a photo you uploaded yourself; only refresh empty or remote photos
        if image and (not p.get('image') or str(p['image']).startswith('http')
                      or str(p['image']).startswith('/img/uploads/wishlink/')):
            p['image'] = image
        for f in ('name', 'brand', 'reel'):
            if s[f] and not p.get(f):
                p[f] = s[f]
        if json.dumps(p, sort_keys=True) != before:
            report['updated'].append(p['name'])

    for cat in shop['categories']:
        for p in cat.get('products', []):
            if p.get('wishlink_id') and p['wishlink_id'] not in seen and not p.get('hidden'):
                report['missing'].append(p['name'])
                if args.hide_missing:
                    p['hidden'] = True
    return report


# -------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description='Import Wishlink products into content/shop.json')
    ap.add_argument('url', nargs='?', default=DEFAULT_URL, help='Wishlink page (default: %(default)s)')
    ap.add_argument('--file', help='read a saved page (.html) or API response (.json) instead of downloading')
    ap.add_argument('--shop', default=os.path.join(ROOT, 'content', 'shop.json'), help='shop file to update')
    ap.add_argument('--dry-run', action='store_true', help="show what would change, don't save")
    ap.add_argument('--show', action='store_true', help='make new products visible straight away')
    ap.add_argument('--hide-missing', action='store_true', help='hide products no longer on Wishlink')
    ap.add_argument('--download-images', action='store_true', help='save photos into img/uploads/wishlink')
    args = ap.parse_args()

    debug_path = os.path.join(ROOT, 'tools', 'wishlink-page.html')
    try:
        if args.file:
            with open(args.file, encoding='utf-8', errors='replace') as f:
                page = f.read()
        else:
            print(f'Downloading {args.url} ...')
            page = fetch(args.url)
    except Exception as e:
        sys.exit(f'Could not read the page: {e}')

    blobs, cards = page_data(page)
    scraped = []
    for b in blobs:
        scraped += walk(b, args.url)
    if not scraped:
        scraped = from_cards(cards, args.url)
    scraped = dedupe(scraped)

    if not scraped:
        if not args.file:
            with open(debug_path, 'w', encoding='utf-8') as f:
                f.write(page)
        sys.exit('No products found on the page, so shop.json was not changed.\n'
                 + (f'The page was saved to {os.path.relpath(debug_path)}: send it over so the script can be adjusted.'
                    if not args.file else 'Send this file over so the script can be adjusted.'))

    print(f'Found {len(scraped)} products on Wishlink.')
    with open(args.shop, encoding='utf-8') as f:
        shop = json.load(f)
    report = merge(shop, scraped, args)

    for label, key in (('Updated', 'updated'), ('Added' + ('' if args.show else ' (hidden until you switch them on)'), 'added'),
                       ('Hidden, no longer on Wishlink' if args.hide_missing else 'Not on Wishlink any more', 'missing')):
        if report[key]:
            print(f'\n{label}: {len(report[key])}')
            for n in report[key]:
                print(f'  - {n}')
    if not any(report.values()):
        print('Everything is already up to date.')
        return

    if args.dry_run:
        print('\nDry run: shop.json was not changed.')
        return
    with open(args.shop, 'w', encoding='utf-8') as f:
        json.dump(shop, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'\nSaved {os.path.relpath(args.shop)}. Check it with "git diff content/shop.json", then commit.')


if __name__ == '__main__':
    main()
