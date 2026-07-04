#!/usr/bin/env python3
"""Longbourn journal engine. content/journal.json + content/posts/*.html ->
site/journal/<slug>/index.html, journal index (featured newest + full grid), sitemap.xml.
Idempotent; run after any manifest/body change, then deploy."""
import json, re, html as H, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
posts = json.load(open('content/journal.json'))
posts.sort(key=lambda p: p['date'], reverse=True)

idx = open('site/journal/index.html').read()
head = idx[:idx.find('</head>')]
wpn  = re.search(r'<header class="wpn".*?</header>', idx, re.S).group(0)
foot = re.search(r'<footer class="site-footer".*?</footer>', idx, re.S).group(0)

def body(p): return open(f"content/posts/{p['slug']}.html").read()
def excerpt(p, n=260):
    t = re.sub(r'<[^>]+>',' ', body(p)); t = re.sub(r'\s+',' ', t).strip()
    return (t[:n].rsplit(' ',1)[0] + '…') if len(t) > n else t
def datef(iso):
    from datetime import date
    y,m,d = map(int, iso.split('-'))
    return date(y,m,d).strftime('%B %-d, %Y')

ART_CSS = """
  <style>
    .jp-hero { max-width: 880px; margin: 0 auto 2.5rem; }
    .jp-hero img { width:100%; border-radius: 2px; }
    .jp-head { max-width: 680px; margin: 0 auto 2rem; text-align:center; }
    .jp-body { max-width: 680px; margin: 0 auto; }
    .jp-back { max-width: 680px; margin: 3rem auto 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; }
  </style>
"""
for p in posts:
    h = head
    h = re.sub(r'<title>.*?</title>', f"<title>{H.escape(p['title'])} — Longbourn Papers Journal</title>", h, flags=re.S)
    h = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1)+H.escape(excerpt(p,150))+m.group(2), h)
    h = re.sub(r'(property="og:image" content=")[^"]*(")', lambda m: m.group(1)+'https://longbournpapers.com'+(p['hero'] or '/media/studio/congrats-desk.jpg')+m.group(2), h)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1)+f"https://longbournpapers.com/journal/{p['slug']}/"+m.group(2), h)
    ld = json.dumps({"@context":"https://schema.org","@type":"Article","headline":p['title'],
        "datePublished":p['date'],"author":{"@type":"Person","name":p['author']},
        "publisher":{"@type":"Organization","name":"Longbourn Papers"},
        "image":'https://longbournpapers.com'+(p['hero'] or ''),
        "mainEntityOfPage":f"https://longbournpapers.com/journal/{p['slug']}/"})
    page = f"""{h}{ART_CSS}<script type="application/ld+json">{ld}</script>
</head>
<body>
  {wpn}
  <main>
    <section class="section">
      <div class="container">
        <div class="jp-head" data-animate="fade">
          <span class="post-card__category">{p['category']}</span>
          <h1 style="margin:.6rem 0 1rem">{H.escape(p['title'])}</h1>
          <p class="post-card__meta">{H.escape(p['author'])} &middot; {datef(p['date'])} &middot; {p['read_min']} min read</p>
        </div>
        {f'<div class="jp-hero"><img src="{p["hero"]}" alt="{H.escape(p["title"])}"></div>' if p['hero'] else ''}
        <article class="jp-body rte">
{body(p)}
        </article>
        <div class="jp-back">
          <a href="/journal/" class="btn btn--ghost">&larr; Back to the Journal</a>
          <a href="/shop/" class="btn btn--primary">Shop the Collection</a>
        </div>
      </div>
    </section>
  </main>
  {foot}
  <script src="/js/main.js" defer></script>
  <script src="/js/cart.js" defer></script>
  <script src="/assets/wicko-pill-nav/wicko-pill-nav.js" defer></script>
</body>
</html>
"""
    os.makedirs(f"site/journal/{p['slug']}", exist_ok=True)
    open(f"site/journal/{p['slug']}/index.html",'w').write(page)

# ── index: featured = newest, grid = the rest ──
def card(p):
    return f'''<article class="post-card">
            <a href="/journal/{p['slug']}/"><div class="post-card__image-wrap">
              <img src="{p['hero']}" alt="{H.escape(p['title'])}" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div></a>
            <span class="post-card__category">{p['category']}</span>
            <h3 class="post-card__title"><a href="/journal/{p['slug']}/">{H.escape(p['title'])}</a></h3>
            <p class="post-card__excerpt">{H.escape(excerpt(p))}</p>
            <p class="post-card__meta">{H.escape(p['author'])} &middot; {datef(p['date'])} &middot; {p['read_min']} min read</p>
          </article>'''
f0 = posts[0]
featured = f'''<div class="journal-featured" data-animate="slide-up">
          <div class="journal-featured__image-wrap">
            <img src="{f0['hero']}" alt="{H.escape(f0['title'])}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
          </div>
          <div class="journal-featured__content">
            <span class="post-card__category">{f0['category']}</span>
            <h2><a href="/journal/{f0['slug']}/" style="text-decoration:none;color:inherit">{H.escape(f0['title'])}</a></h2>
            <p>{H.escape(excerpt(f0, 300))}</p>
            <div><a href="/journal/{f0['slug']}/" class="btn btn--ghost">Read More</a></div>
            <p class="post-card__meta">{H.escape(f0['author'])} &middot; {datef(f0['date'])} &middot; {f0['read_min']} min read</p>
          </div>
        </div>'''
GEN = featured + '\n\n        <div class="journal-grid">\n          ' + '\n\n          '.join(card(p) for p in posts[1:]) + '\n        </div>'
S, E = '<!-- JOURNAL:GEN:START -->', '<!-- JOURNAL:GEN:END -->'
s = open('site/journal/index.html').read()
if S in s:
    s = s[:s.find(S)+len(S)] + '\n        ' + GEN + '\n        ' + s[s.find(E):]
else:
    fi = s.find('<div class="journal-featured"')
    gi = s.find('<div class="journal-grid"')
    sec = s.find('</section>', gi)
    close = s.rfind('</div>', gi, s.rfind('</div>', gi, sec))  # end of grid
    s = s[:fi] + S + '\n        ' + GEN + '\n        ' + E + '\n      ' + s[close+6:]
open('site/journal/index.html','w').write(s)

# ── sitemap ──
BASE='https://longbournpapers.com'
urls=[BASE+'/']
for d in sorted(glob.glob('site/*/index.html')) + sorted(glob.glob('site/writing-desk/*/index.html')):
    seg=d.split('/')[1]
    if seg in ('admin','photos','checkout'): continue
    urls.append(f"{BASE}/{seg}/")
for p in posts: urls.append(f"{BASE}/journal/{p['slug']}/")
sm='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sm+=''.join(f'  <url><loc>{u}</loc></url>\n' for u in dict.fromkeys(urls))
open('site/sitemap.xml','w').write(sm+'</urlset>\n')
print(f"built {len(posts)} posts, index (1 featured + {len(posts)-1} cards), sitemap ({len(set(urls))} urls)")
