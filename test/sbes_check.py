"""Browser check of single-beam mode in the survey planner: sections, spacing and footprint,
S-44 checks per order, map sheet and report text, scenarios, corridor, switching back.

Usage: python3 -I test/sbes_check.py planner/index.html
"""
import sys, re, math, pathlib
from playwright.sync_api import sync_playwright
ok_all = True
def check(c, msg):
    global ok_all
    print(("ok   " if c else "FAIL ") + msg); sys.stdout.flush(); ok_all &= bool(c)
INIT = """window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({n,t}));return}return _ck.call(this)};"""
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1400, 'height': 900}, locale='en-US', timezone_id='UTC')
    ctx.route(lambda u: not u.startswith('file:'), lambda r: r.abort()); ctx.add_init_script(INIT)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri() + '?type=sbes&shape=area'); pg.wait_for_timeout(2500); pg.evaluate("setLang('en')")
    vis = pg.evaluate("[...document.querySelectorAll('details[data-sec]')].filter(d=>!d.closest('[hidden]')).map(d=>d.dataset.sec)")
    check('sbes' in vis and 'sensor' not in vis and 'swath' not in vis and 'geo' not in vis and not pg.evaluate("!$('tpuD').hidden"), f"single-beam sections {vis}")
    check(pg.evaluate("$('depth').parentElement.id") == 'sbDepth', "design depth shown in the single-beam section")
    pg.evaluate("$('depth').value=20;$('sbBW').value=8;$('sbSp').value=50;$('sbSp').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(400)
    fp = 2 * 20 * math.tan(math.radians(4))
    check(abs(pg.evaluate("params().W") - fp) < 1e-6 and pg.evaluate("params().S") == 50, f"footprint {fp:.2f} m and spacing 50 m drive the plan")
    xs = pg.evaluate("(()=>{const n=[Math.cos(g('az')*D),-Math.sin(g('az')*D)];const s=R.lines.map(l=>l.a[0]*n[0]+l.a[1]*n[1]).sort((a,b)=>a-b);return s.slice(1).map((v,i)=>v-s[i])})()")
    check(len(xs) > 5 and all(abs(abs(d) - 50) < 0.01 for d in xs[:-1]) and 0 < xs[-1] <= 50.01, "lines are 50 m apart (the last one closes on the edge)")
    pg.evaluate("$('sbMax').click()"); pg.wait_for_timeout(300)
    check(pg.evaluate("+$('sbSp').value") == 60, "S-44 maximum button: 3 × 20 m = 60 m")
    pg.evaluate("$('depth').value=5;$('depth').dispatchEvent(new Event('input'));$('sbMax').click()"); pg.wait_for_timeout(300)
    check(pg.evaluate("+$('sbSp').value") == 25, "S-44 maximum is 25 m in shallow water")
    pg.evaluate("$('depth').value=20;$('depth').dispatchEvent(new Event('input'));$('sbSp').value=60;$('sbSp').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(400)
    def first(o):
        pg.evaluate(f"$('ord').value={o};$('ord').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(400); return pg.evaluate("$('chk').innerText").split('\n')
    c = first(4); check(c[0].startswith('Line spacing 60 m is within'), f"Order 2: {c[0]}")
    check(any('Bathymetric coverage about' in l for l in c) and not any(k in ' '.join(c) for k in ['overlap', 'Swath angle', 'pings on the smallest']), "coverage check, no multibeam checks")
    check(first(2)[0].startswith('Order 1a requires a 100 % feature search'), "Order 1a: feature search warning")
    check(first(0)[0].startswith('Exclusive Order requires full bathymetric coverage'), "Exclusive Order: full coverage warning")
    pg.evaluate("$('sbSp').value=90;$('sbSp').dispatchEvent(new Event('input'))"); c = first(4)
    check(c[0].startswith('Line spacing 90 m exceeds'), "spacing above 3 × depth flagged")
    check(pg.evaluate("SWP_SHEET_TITLE") == 'SINGLE-BEAM SURVEY LINE PLAN' and pg.evaluate("SWP_SENSORROW()[1]").startswith('Single-beam'), "map sheet title and sensor row")
    pg.evaluate("window.__dl=[];$('rep').click()"); pg.wait_for_timeout(1200)
    h = pg.evaluate("(window.__dl.find(d=>d.n.endsWith('.html'))||{t:''}).t")
    rows = dict(re.findall(r'<td>(Sensor|Swath angles[^<]*|Overlap)</td><td>([^<]*)', h))
    check(rows.get('Sensor', '').startswith('Single-beam') and 'Overlap' not in rows, f"report: {rows}")
    pg.evaluate("$('tenAdd').click()"); pg.wait_for_timeout(400)
    check(pg.evaluate("[...document.querySelectorAll('#tenList label')].map(l=>l.textContent)")[0] == 'Line spacing (m)', "scenarios compare the line spacing")
    pg.evaluate("$('svG').value='corr';$('svG').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(800)
    offs = pg.evaluate("CO.off")
    check(len(offs) > 1 and all(abs((offs[i+1] - offs[i]) - 90) < 0.01 for i in range(len(offs) - 1)), f"single-beam corridor lines {offs} m")
    pg.evaluate("$('svT').value='mbes';$('svG').value='area';$('svT').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(800)
    check(pg.evaluate("$('depth').closest('details').dataset.sec") == 'sensor' and abs(pg.evaluate("params().S") - 90) > 1, "back to multibeam: depth home, swath spacing")
    pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(2500)
    check(pg.evaluate("$('svT').value") == 'mbes' and pg.evaluate("+$('sbSp').value") == 90, "type and single-beam settings kept after reload")
    check(not errs, f"no page errors {errs[:3]}")
    br.close()
print("ALL OK" if ok_all else "SOME CHECKS FAILED"); sys.exit(0 if ok_all else 1)
