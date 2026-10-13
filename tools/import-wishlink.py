#!/usr/bin/env python3
"""Import products from a Wishlink storefront into content/shop.json.

    python3 tools/import-wishlink.py                     # import from wishlink.com/avora17
    python3 tools/import-wishlink.py --dry-run           # only show what would change
    python3 tools/import-wishlink.py --file data.json    # use a Wishlink response or page you saved
    python3 tools/import-wishlink.py --remote-images     # link to Wishlink's photos instead of saving copies

What it does:
  - Photos are saved into img/uploads/wishlink, so the shop doesn't rely on Wishlink's servers
    (buy links stay Wishlink links, so you keep your commission).
  - Products already in the shop (matched by Wishlink ID or link) get a fresh price, MRP, link
    and photo, plus Wishlink's coupon code if it has one and you haven't typed your own. Your name, brand, note, coupon, badge and category edits are never touched,
    and a photo you uploaded yourself is kept.
  - New products go into Fashion, Makeup or Skincare based on Wishlink's category (anything
    else into "New from Wishlink"), with their reel, date and sold-out status. Use --draft to
    add them hidden, so you can check them in /admin first.
  - Products no longer on Wishlink are only listed, unless you pass --hide-missing.

Everything Wishlink sends back is saved to tools/wishlink-debug.json: if it finds nothing, send that file over.
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

def fetch(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/json', **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode(r.headers.get_content_charset() or 'utf-8', 'replace')


# The storefront page is empty; its products, reels and collections come from Wishlink's API.
# (getPostPageWidgets / getPostPageWidgetContent are "shop more" suggestions from other
# creators, so they are deliberately not read.)
API = 'https://api.wishlink.com/api/store/'
API_HEADERS = {'Origin': 'https://www.wishlink.com', 'Referer': 'https://www.wishlink.com/',
               'content-type': 'application/json'}


def visitor_id():
    """A fresh anonymous visitor ID, in the same shape the storefront sends."""
    import uuid
    u = uuid.uuid4().hex
    return f'{int(datetime.datetime.now().timestamp() * 1000)}-{u[:8]}-{u[8:12]}-{u[12:16]}-{u[16:20]}-{u[20:]}'


def api_pages(path, params, list_keys, label, headers, responses, log):
    """Every page of one API list, until Wishlink says it's done."""
    items = []
    for page in range(1, 41):
        q = urllib.parse.urlencode({'page': page, 'limit': 20, **params, 'sourceApp': 'STOREFRONT'})
        try:
            res = json.loads(fetch(f'{API}{path}?{q}', headers))
        except Exception as e:
            print(f'  {label}: could not read page {page} ({e})')
            break
        responses.append({'request': label, 'page': page, 'response': res})
        data = res.get('data') if isinstance(res, dict) else None
        if not isinstance(data, dict):
            break
        found = [x for k in list_keys for x in (data.get(k) or []) if isinstance(x, dict)]
        items += found
        if data.get('done') or not found:
            break
    log[label] = len(items)
    return items


def fetch_api(username, log):
    """Products from the Products tab, every reel and every collection. Returns (responses, reels)."""
    headers = {**API_HEADERS, 'wishlinkid': visitor_id()}
    responses = []

    def tab(name, **extra):
        return api_pages('getCreatorContent', {'tab': name, 'username': username, **extra},
                         ('content', 'productContent'), name.title() + (' (reels only)' if extra else ''),
                         headers, responses, log)

    tab('PRODUCTS')
    tab('PRODUCTS', only_reel_products='true')
    reels = [c for c in tab('REELS') if c.get('postUrl')]
    collections = [c for c in tab('COLLECTIONS') if c.get('postType') == 'COLLECTION']

    for post, kind in [(r, 'POST') for r in reels] + [(c, 'COLLECTION') for c in collections]:
        title = as_text(post.get('title')).splitlines()[0][:40] if post.get('title') else ''
        items = api_pages('getPostOrCollectionProducts',
                          {'postType': kind, 'postOrCollectionId': post.get('postOrCollectionId'),
                           'username': username},
                          ('products',), f'{"Reel" if kind == "POST" else "Collection"} "{title}"',
                          headers, responses, log)
        for it in items:  # remember where each product came from
            if kind == 'POST':
                it.setdefault('_reel', post.get('postUrl'))
                it.setdefault('_added', post.get('addedOn'))
            else:
                it.setdefault('_collection', as_text(post.get('title')))
                it.setdefault('_added', post.get('addedOn'))
    return responses, reels


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


# Wishlink's subCategory -> the shop's categories (anything else lands in NEW_CATEGORY)
FASHION_WORDS = ('dress', 'top', 'tshirt', 'shirt', 'skirt', 'saree', 'blouse', 'dupatta', 'kurta', 'lehenga',
                 'co-ord', 'jeans', 'trouser', 'jacket', 'bag', 'shoe', 'heel', 'sandal', 'jewel', 'earring')
MAKEUP_WORDS = ('concealer', 'foundation', 'lipstick', 'lip-gloss', 'lip-liner', 'lip-tint', 'eyeliner', 'kajal',
                'mascara', 'eyeshadow', 'blush', 'bronzer', 'highlighter', 'primer', 'compact', 'setting',
                'brow', 'makeup')
SKINCARE_WORDS = ('sunscreen', 'serum', 'moistur', 'face-wash', 'cleans', 'toner', 'lip-balm', 'mask', 'skin',
                  'lotion', 'cream', 'remover', 'roll-on', 'deodorant')
CATEGORY_LOOK = {'Fashion': ('👗', 'Real-life outfits I actually re-wear.'),
                 'Makeup': ('💄', '5-minute face, office to coffee date.'),
                 'Skincare': ('🧴', "The routine that got me the 'what's your skincare?' DMs."),
                 NEW_CATEGORY: ('🛍️', 'Fresh from my Wishlink.')}


def category_for(sub):
    s = (sub or '').lower()
    if s.startswith(('women-', 'men-', 'girls-')) or any(w in s for w in FASHION_WORDS):
        return 'Fashion'
    if any(w in s for w in MAKEUP_WORDS):
        return 'Makeup'
    if any(w in s for w in SKINCARE_WORDS):
        return 'Skincare'
    return NEW_CATEGORY


def wishlink_product(d):
    """A product exactly as Wishlink's API sends it (productContent items)."""
    name = as_text(d.get('name'))
    # shortUrl is the stable wishlink.com/share link; purchaseUrl can be a one-time store link
    link = as_url(d.get('shortUrl') or d.get('purchaseUrl'))
    if not name or not link:
        return None
    image = as_url(d.get('thumbnailUrl') or d.get('imageUrl'))  # thumbnails are already resized (800-1080px)
    if '/brandlogos/' in image:  # Wishlink's placeholder when it has no photo
        image = ''
    # "brand" is the store (Myntra, Nykaa); "platform" is often the real brand
    platform = as_text(d.get('platform')).split(' - ')[0].strip()
    post = d.get('contentDetails') if isinstance(d.get('contentDetails'), dict) else {}
    try:
        added = datetime.date.fromtimestamp(float(post.get('addedOn') or d.get('_added'))).isoformat()
    except (TypeError, ValueError):
        added = ''
    price, mrp = as_price(d.get('price')), as_price(d.get('mrp'))
    return {
        'id': str(d.get('id') or ''),
        'name': name,
        'brand': platform or as_text(d.get('brand')),
        'link': link,
        'image': image,
        'price': price,
        'mrp': mrp if mrp > price else 0,
        'reel': as_url(d.get('postUrl') or post.get('postUrl') or d.get('_reel')),
        # The collection name ("SkinCare") beats Wishlink's subCategory, which is sometimes wrong
        'category': (category_for(d.get('_collection')) if category_for(d.get('_collection')) != NEW_CATEGORY
                     else category_for(d.get('subCategory'))),
        'sold_out': bool(d.get('isOutOfStock')),
        'added': added,
        'coupon_code': as_text(d.get('couponCode') or d.get('defaultCouponCode')),
        'coupon_text': as_text(d.get('couponText')),
    }


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
        'category': NEW_CATEGORY,
        'sold_out': None,  # unknown
        'added': '',
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
        if 'purchaseUrl' in obj or 'shortUrl' in obj:
            p = wishlink_product(obj)
            return [p] if p else []
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
                        'mrp': max(prices) if len(prices) > 1 else 0, 'reel': '',
                        'category': NEW_CATEGORY, 'sold_out': None, 'added': ''})
    return out


def link_key(url):
    u = urllib.parse.urlparse(url or '')
    return (u.netloc.lower().removeprefix('www.') + u.path.rstrip('/')).lower()


def dedupe(products):
    """Same ID, same link, or the same item listed twice (same name and photo) count as one."""
    seen, out = {}, []
    for p in products:
        keys = [k for k in (p['id'], link_key(p['link']), p['name'].lower() + '|' + p['image']) if k]
        old = next((seen[k] for k in keys if k in seen), None)
        if old:  # merge: keep whichever copy knows more
            for f, v in p.items():
                if v and not old.get(f):
                    old[f] = v
        else:
            old = p
            out.append(p)
        for k in keys:
            seen.setdefault(k, old)
    return out


# ------------------------------------------------------------------ images

IMAGE_DIR = 'img/uploads/wishlink'


def download_image(url, name):
    """Save a photo into img/uploads/wishlink and return its site path. The file name carries a
    fingerprint of the link, so a photo already saved is never downloaded twice."""
    import hashlib
    # Wishlink wraps store photos (/fetch/https%3A//...), so read the extension from the inner link
    inner = urllib.parse.urlparse(urllib.parse.unquote(urllib.parse.urlparse(url).path)).path
    ext = os.path.splitext(inner)[1].lower()
    ext = '.jpg' if ext == '.jpeg' or ext not in ('.jpg', '.png', '.webp', '.avif', '.gif') else ext
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:50].strip('-') or 'product'
    file = f'{slug}-{hashlib.sha1(url.encode()).hexdigest()[:8]}{ext}'
    path = os.path.join(ROOT, IMAGE_DIR, file)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://www.wishlink.com/'})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        if not data or not r.headers.get_content_type().startswith('image/'):
            raise ValueError(f'not an image ({r.headers.get_content_type()})')
        with open(path, 'wb') as f:
            f.write(data)
    return f'/{IMAGE_DIR}/{file}'


def local_image(url, name, args):
    """The local copy of a remote photo (downloading it if needed), or the link if that fails."""
    if not url or not url.startswith('http') or args.remote_images or url in FAILED:
        return url
    try:
        return download_image(url, name)
    except Exception as e:
        FAILED.add(url)
        print(f'  ! could not save the photo for {name[:50]}: {e}')
        return url


FAILED = set()  # photos that failed this run, so each is only tried once


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

    report = {'updated': [], 'added': [], 'missing': [], 'photos': []}
    seen = set()

    def category(name):
        cat = next((c for c in shop['categories'] if c.get('name', '').lower() == name.lower()), None)
        if cat is None:
            emoji, blurb = CATEGORY_LOOK.get(name, CATEGORY_LOOK[NEW_CATEGORY])
            cat = {'name': name, 'emoji': emoji, 'blurb': blurb, 'products': []}
            shop['categories'].append(cat)
        return cat
    for s in scraped:
        wid = s['id'] or link_key(s['link'])
        seen.add(wid)
        p = by_id.get(wid) or (by_link.get(link_key(s['link'])) if s['link'] else None)
        image = local_image(s['image'], s['name'], args)

        if p is None:
            p = blank_product(today)
            p.update(name=s['name'], brand=s['brand'], image=image, price=s['price'], mrp=s['mrp'],
                     link=s['link'], reel=s['reel'], wishlink_id=wid, hidden=args.draft,
                     added=s['added'] or today, badge='sold-out' if s['sold_out'] else 'none')
            if s.get('coupon_code'):
                p['coupon'].update(code=s['coupon_code'], discount=s.get('coupon_text', ''))
            category(s['category'])['products'].append(p)
            report['added'].append(f'{s["name"]}  ->  {s["category"]}')
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
        coupon = p.setdefault('coupon', {'code': '', 'discount': '', 'expires': '', 'terms': ''})
        if s.get('coupon_code') and not coupon.get('code'):  # never replaces a code you typed
            coupon.update(code=s['coupon_code'], discount=coupon.get('discount') or s.get('coupon_text', ''))
        if s['sold_out'] and p.get('badge') != 'sold-out':
            p['badge'] = 'sold-out'
        elif s['sold_out'] is False and p.get('badge') == 'sold-out':
            p['badge'] = 'none'  # back in stock
        if json.dumps(p, sort_keys=True) != before:
            report['updated'].append(p['name'])

    for cat in shop['categories']:
        for p in cat.get('products', []):
            # A saved file is only part of the store, so "missing" only means something on a full run
            if p.get('wishlink_id') and p['wishlink_id'] not in seen and not p.get('hidden') and not args.file:
                report['missing'].append(p['name'])
                if args.hide_missing:
                    p['hidden'] = True
            # Any photo still on another site (e.g. pasted in /admin) gets a local copy too
            if str(p.get('image', '')).startswith('http') and not args.remote_images:
                saved = local_image(p['image'], p.get('name', ''), args)
                if saved != p['image']:
                    p['image'] = saved
                    report['photos'].append(p.get('name', ''))
    return report


# -------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description='Import Wishlink products into content/shop.json')
    ap.add_argument('url', nargs='?', default=DEFAULT_URL, help='Wishlink page (default: %(default)s)')
    ap.add_argument('--file', help='read a saved page (.html) or API response (.json) instead of downloading')
    ap.add_argument('--shop', default=os.path.join(ROOT, 'content', 'shop.json'), help='shop file to update')
    ap.add_argument('--dry-run', action='store_true', help="show what would change, don't save")
    ap.add_argument('--draft', action='store_true', help='add new products hidden, to check them in /admin first')
    ap.add_argument('--hide-missing', action='store_true', help='hide products no longer on Wishlink')
    ap.add_argument('--remote-images', action='store_true', help="link to Wishlink's photos instead of saving copies")
    args = ap.parse_args()

    debug_path = os.path.join(ROOT, 'tools', 'wishlink-debug.json')
    reels, cards = [], []
    try:
        if args.file:
            with open(args.file, encoding='utf-8', errors='replace') as f:
                page = f.read()
            blobs, cards = page_data(page)
        else:
            username = urllib.parse.urlparse(args.url).path.strip('/').split('/')[0]
            print(f'Reading Wishlink store "{username}" ...')
            log = {}
            blobs, reels = fetch_api(username, log)
            for tab, n in log.items():
                print(f'  {tab}: {n} items')
            try:
                os.makedirs(os.path.dirname(debug_path), exist_ok=True)
                with open(debug_path, 'w', encoding='utf-8') as f:
                    json.dump(blobs, f, ensure_ascii=False, indent=2)
            except OSError:
                pass  # only a debugging aid
    except Exception as e:
        sys.exit(f'Could not read Wishlink: {e}')

    scraped = []
    for b in blobs:
        scraped += walk(b, args.url)
    if not scraped:
        scraped = from_cards(cards, args.url)
    scraped = dedupe(scraped)

    if reels:
        print(f'\nReels on your Wishlink: {len(reels)}')
        for r in reels:
            print(f'  - {r["postUrl"]}  {as_text(r.get("title")).splitlines()[0][:50] if r.get("title") else ""}')

    if not scraped:
        sys.exit('\nNo products found, so shop.json was not changed.\n'
                 + (f'What Wishlink sent back is saved in {os.path.relpath(debug_path)}: send it over so the script can be adjusted.'
                    if not args.file else 'Send this file over so the script can be adjusted.'))

    print(f'Found {len(scraped)} products on Wishlink.')
    with open(args.shop, encoding='utf-8') as f:
        shop = json.load(f)
    report = merge(shop, scraped, args)

    for label, key in (('Updated', 'updated'), ('Added' + (' (hidden until you switch them on)' if args.draft else ''), 'added'),
                       ('Hidden, no longer on Wishlink' if args.hide_missing else 'Not on Wishlink any more', 'missing'),
                       ('Photos saved locally for', 'photos')):
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
