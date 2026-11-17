"""The version from src/version.json is shown in every tool and written into project files and reports.
python3 -I test/version_check.py"""
import json, os, sys
from playwright.sync_api import sync_playwright
bad = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: bad.append(m)
v = json.load(open('src/version.json'))['version']; V = v[:-2] if v.endswith('.0') else v
P = {'hub': 'index.html', 'planner': 'planner/index.html', 'infill': 'infill/index.html', 'guide': 'guide/index.html', 'science': 'science/index.html'}
for k, f in P.items():
    s = open(f, encoding='utf8').read(); ok('__SWP_VERSION__' not in s, f'{k}: no unresolved version token')
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 1400, 'height': 900}, locale='en-US'); c.route(lambda u: not u.startswith('file:'), lambda r: r.abort())
    for k, f in P.items():
        pg = c.new_page(); e = []; pg.on('pageerror', lambda x: e.append(str(x))); pg.goto('file://' + os.path.abspath(f)); pg.wait_for_timeout(1500)
        ft = pg.evaluate("[...document.querySelectorAll('footer')].map(f=>f.textContent).join(' ')")
        ok(f' {V}' in ft, f'{k}: footer shows the version ({ft.strip()[:90]}…)')
        a = pg.evaluate("(document.querySelector('footer a[href*=\"releases\"]')||{}).href||''"); ok(a.endswith('/releases'), f'{k}: version links to the release notes')
        if k == 'planner':
            spl = pg.evaluate("splText()"); ok(f'with SwathPlan {V}' in spl.split('\n')[2], 'project file records the version')
            ok(pg.evaluate("splParse(splText())") is not None, 'project file with the version line opens again')
        ok(not e, f'{k}: no page errors {e[:1]}')
        pg.close()
    b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED'); sys.exit(1 if bad else 0)
