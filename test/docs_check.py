"""Guide and science pages: contents, links, images, footnotes, languages; the planner's links to them.
python3 -I test/docs_check.py"""
import sys, pathlib
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent.as_uri() + "/"; bad = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: bad.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={"width": 1300, "height": 900}, locale="en-US"); c.route(lambda u: not u.startswith("file:"), lambda r: r.abort())
    for page in ["guide", "science"]:
        pg = c.new_page(); e = []; pg.on("pageerror", lambda x: e.append(str(x)))
        pg.goto(R + page + "/index.html"); pg.wait_for_timeout(1500); ev = pg.evaluate; ev("setLang('en')")
        ok(ev("document.querySelectorAll('#toc a').length") >= 15, f"{page}: contents built from the headings")
        ok(ev("[...document.querySelectorAll('article a[href^=\"#\"]')].every(a=>document.getElementById(a.hash.slice(1)))"), f"{page}: every internal link has a target")
        ev("[...document.querySelectorAll('img')].forEach(i=>i.loading='eager')"); pg.wait_for_timeout(1500)
        ok(ev("[...document.querySelectorAll('article img')].every(i=>i.naturalWidth>0)"), f"{page}: every screenshot loads")
        if page == "science":
            ok(ev("[...document.querySelectorAll('sup.fn a')].every(a=>document.getElementById(a.hash.slice(1)))"), "science: every footnote points to a reference")
            ok(ev("[...document.querySelectorAll('ol.refs li')].every(l=>document.querySelector('sup.fn a[href=\"#'+l.id+'\"]'))"), "science: every reference is cited")
            ok(ev("document.querySelectorAll('ol.refs a.back').length==document.querySelectorAll('ol.refs li').length"), "science: each reference links back to the text")
        else:
            ok(ev("document.querySelectorAll('article img').length") >= 20, "guide: screenshots included")
        ev("setLang('de')"); pg.wait_for_timeout(200)
        ok(ev("document.querySelector('#toc b').textContent") == "Inhalt" and ev("document.title").startswith("SwathPlan – ") and "Guide" not in ev("document.title"), f"{page}: page frame translated")
        ev("setLang('ar')"); pg.wait_for_timeout(200)
        ok(ev("document.querySelector('header').dir") == "rtl" and ev("document.querySelector('article').dir") == "ltr", f"{page}: right-to-left frame, English text left to right")
        ok(not e, f"{page}: no page errors {e}")
    pg = c.new_page(); e = []; pg.on("pageerror", lambda x: e.append(str(x))); pg.goto(R + "planner/index.html"); pg.wait_for_timeout(2500); pg.evaluate("setLang('en')")
    ok([a for a in pg.evaluate("[...document.querySelectorAll('#tmenu .tml a')].map(a=>a.dataset.p)")] == ["", "planner/", "infill/", "guide/", "science/"], "planner: tools menu lists the guide and science pages")
    ok(pg.evaluate("document.querySelectorAll('#guide .gcard').length") == 2, "planner: guide tab links to both pages")
    ok(not e, f"planner: no page errors {e}")
    pg = c.new_page(); pg.goto(R + "index.html"); pg.wait_for_timeout(1200)
    ok(pg.evaluate("!!document.querySelector('a[href=\"guide/\"]')&&!!document.querySelector('a[href=\"science/\"]')"), "home page links to both pages")
    b.close()
print("ALL OK" if not bad else f"{len(bad)} FAILED"); sys.exit(1 if bad else 0)
