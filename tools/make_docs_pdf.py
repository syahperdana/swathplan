"""The PDF editions of the user guide and the science page, one per language: docs/pdf/swathplan-<doc>-<code>.pdf

  python3 -I tools/make_docs_pdf.py                 # every language with a translated article (and English)
  python3 -I tools/make_docs_pdf.py id de           # only these languages

Run node tools/build.mjs first. The built page is served locally and printed by headless Chromium (Playwright) with
html.pdf set (print styles in src/css/docs.css). Each PDF is: a cover (own page, no running header), the printed
contents with page numbers, then the article with a running header and page numbers. Page numbers come from a first
pass: Chromium writes a named destination for every heading the contents links to, and pypdf reads their pages.
"""
import sys, os, json, threading, http.server, functools, io, datetime
from playwright.sync_api import sync_playwright
from pypdf import PdfReader, PdfWriter
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'docs', 'pdf')
ORDER = json.load(open(os.path.join(ROOT, 'src/lang/_order.json')))
DOCS = {'guide': 'User guide', 'science': 'Science & references'}
import re
NAMES = dict(re.findall(r'\["([a-z]{2,3})","([^"]+)"\]', open(os.path.join(ROOT, 'src/js/core/i18n-langs.js'), encoding='utf8').read()))
LBL = ['Language', 'Edition', 'Website', 'Contents', 'Planning aid only: it does not replace official charts, the equipment specifications, the current IHO S-44 or a qualified surveyor. Not for navigation.']

def tr(code):
    if code == 'en': return lambda s: s
    d = json.load(open(os.path.join(ROOT, 'src/lang', code + '.json'), encoding='utf8'))
    return lambda s: d.get(s, s)

def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=ROOT)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h); threading.Thread(target=s.serve_forever, daemon=True).start(); return s

PREP = """([toc,label,nums])=>{document.documentElement.classList.add('pdf');const a=document.querySelector('article');
let n=document.querySelector('.ptoc');if(!n){n=document.createElement('nav');n.className='ptoc';a.insertBefore(n,a.querySelector('h2'))}
n.innerHTML='<h2 class="nt">'+label+'</h2>'+[...a.querySelectorAll('h2:not(.nt),h3')].map(h=>'<a class="'+(h.tagName=='H2'?'l2':'l3')+'" href="#'+h.id+'"><span>'+h.textContent+'</span><i></i><b>'+(nums[h.id]||'00')+'</b></a>').join('');
document.querySelectorAll('img').forEach(i=>i.loading='eager');return [...a.querySelectorAll('h2:not(.nt),h3')].map(h=>h.id)}"""

def run(langs):
    os.makedirs(OUT, exist_ok=True); srv = serve(); base = f'http://127.0.0.1:{srv.server_port}/'
    today = datetime.date.today().isoformat()
    with sync_playwright() as p:
        br = p.chromium.launch(); ctx = br.new_context(service_workers='block'); pg = ctx.new_page()
        for code in langs:
            T = tr(code); rtl = code in ('ar', 'ur')
            for doc, title in DOCS.items():
                if code != 'en' and not os.path.exists(os.path.join(ROOT, doc, 'lang', code + '.html')): continue
                pg.goto(f'{base}{doc}/?lang={code}'); pg.wait_for_function(f"document.querySelector('article').lang=='{code}'", timeout=20000)
                pg.wait_for_load_state('networkidle'); pg.emulate_media(media='print')
                ttl = T(title.replace('&', '&amp;')).replace('&amp;', '&')
                head = f'<div style="width:100%;font:7.5pt Inter,sans-serif;color:#5b6e75;padding:0 17mm;display:flex;justify-content:space-between;direction:{"rtl" if rtl else "ltr"}"><span>SwathPlan · {ttl}</span><span>{today}</span></div>'
                foot = '<div style="width:100%;font:7.5pt Inter,sans-serif;color:#5b6e75;padding:0 17mm;display:flex;justify-content:space-between"><span>© 2026 Aldwin Syahperdana</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
                opt = dict(format='A4', print_background=True, display_header_footer=True, header_template=head, footer_template=foot, margin={'top': '20mm', 'bottom': '18mm', 'left': '17mm', 'right': '17mm'})
                # pass 1: where each heading lands; pass 2: the same layout with the page numbers filled in
                ids = pg.evaluate(PREP, [[], T('Contents'), {}])
                r = PdfReader(io.BytesIO(pg.pdf(**opt))); nums = {}
                for k, v in r.named_destinations.items():
                    try: nums[k.lstrip('/')] = r.get_destination_page_number(v) + 1
                    except Exception: pass
                pg.evaluate(PREP, [[], T('Contents'), {i: nums.get(i, '') for i in ids}])
                body = pg.pdf(**opt)
                miss = [i for i in ids if i not in nums]
                # cover: its own page, no running header or page number
                lede = pg.evaluate("(document.querySelector('article .lede')||{}).textContent||''")
                h1 = pg.evaluate("document.querySelector('article h1').textContent")
                cover = f'''<div class="cover" dir="{'rtl' if rtl else 'ltr'}" lang="{code}"><div class="band"><div class="brand"><img src="../icons/icon-192.png" alt=""><div>Swath<span>Plan</span></div></div>
<h1>{h1}</h1><div class="sub">{lede}</div></div><div class="meta"><b>{T(LBL[0])}</b><span>{NAMES.get(code, code)}</span><b>{T(LBL[1])}</b><span>{today}</span><b>{T(LBL[2])}</b><span>syahperdana.github.io/swathplan</span></div>
<div class="foot">{T(LBL[4])}<br>© 2026 Aldwin Syahperdana</div></div>'''
                pg.evaluate("h=>{document.querySelector('main').innerHTML=h;document.documentElement.classList.add('pdf')}", cover)
                pg.wait_for_timeout(200)
                cv = pg.pdf(format='A4', print_background=True, margin={'top': '20mm', 'bottom': '18mm', 'left': '17mm', 'right': '17mm'}, page_ranges='1')
                w = PdfWriter()
                for b in (cv, body):
                    for page in PdfReader(io.BytesIO(b)).pages: w.add_page(page)
                w.add_metadata({'/Title': f'SwathPlan – {ttl}', '/Author': 'Aldwin Syahperdana', '/Subject': h1, '/Lang': code})
                fn = os.path.join(OUT, f'swathplan-{doc}-{code}.pdf')
                with open(fn, 'wb') as f: w.write(f)
                print(f'{os.path.basename(fn)}: {len(w.pages)} pages, {os.path.getsize(fn) / 1048576:.1f} MB' + (f', {len(miss)} headings without a page number' if miss else ''))
        br.close()
    srv.shutdown()

if __name__ == '__main__':
    run(sys.argv[1:] or [c for c in ORDER])
