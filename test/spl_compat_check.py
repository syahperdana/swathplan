""".SPL compatibility: a project saved by the original single-file planner (test/fixtures/spl_v1_original.spl)
must open in the current planner with the same plan, whatever mode the planner was in. Optionally, a file
saved by the current planner is opened in an old planner (pass its index.html as the second argument).

Usage: python3 -I test/spl_compat_check.py planner/index.html [old/index.html]
"""
import sys, json, pathlib
from playwright.sync_api import sync_playwright
ok_all = True
def check(c, msg):
    global ok_all
    print(("ok   " if c else "FAIL ") + msg); sys.stdout.flush(); ok_all &= bool(c)
FX = pathlib.Path(__file__).parent / 'fixtures'
spl = (FX / 'spl_v1_original.spl').read_text(); want = json.loads((FX / 'spl_v1_original.json').read_text())
INIT = """window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({n,t}));return}return _ck.call(this)};"""
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1400, 'height': 900}, locale='en-US', timezone_id='Asia/Jakarta')
    ctx.route(lambda u: not u.startswith('file:'), lambda r: r.abort()); ctx.add_init_script(INIT)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri() + '?type=geo&shape=corr'); pg.wait_for_timeout(2500)
    pg.evaluate("$('depth').value=80;$('depth').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
    pg.set_input_files('#spImp', files=[{'name': 'legacy.spl', 'mimeType': 'text/plain', 'buffer': spl.encode()}]); pg.wait_for_timeout(1500)
    got = pg.evaluate("({type:$('svT').value,shape:$('svG').value,lines:R.lines.length,cross:R.cross.length,S:params().S,az:g('az'),depth:g('depth'),name:$('prjN').value,pre:$('pre').value})")
    check(got['type'] == 'mbes' and got['shape'] == 'area', f"opens as a multibeam area survey (was geophysical corridor): {got['type']}/{got['shape']}")
    check(got['lines'] == want['lines'] and got['cross'] == want['cross'], f"same lines as the original planner: {got['lines']}+{got['cross']} (expected {want['lines']}+{want['cross']})")
    check(abs(got['S'] - want['S']) < 1e-6 and abs(got['az'] - want['az']) < 1e-9 and got['depth'] == 32, f"same spacing {got['S']:.3f} m, azimuth {got['az']}°, depth {got['depth']} m")
    check(got['name'] == 'Legacy harbour survey' and got['pre'] == 'HB', "project name and line prefix")
    pg.evaluate("window.__dl=[];$('spSave').click()"); pg.wait_for_timeout(800)
    new = pg.evaluate("window.__dl[0].t")
    check(new.startswith('SWATHPLAN-SPL 1') and 'svT = mbes' in new, "saved again in the same format, with the survey type")
    if len(sys.argv) > 2:
        po = ctx.new_page(); po.goto(pathlib.Path(sys.argv[2]).resolve().as_uri()); po.wait_for_timeout(2500)
        po.set_input_files('#spImp', files=[{'name': 'new.spl', 'mimeType': 'text/plain', 'buffer': new.encode()}]); po.wait_for_timeout(1500)
        old = po.evaluate("({lines:R.lines.length,az:g('az'),depth:g('depth')})")
        check(old['lines'] == want['lines'] and old['depth'] == 32, f"the old planner opens the new file: {old}")
    check(not errs, f"no page errors {errs[:3]}")
    br.close()
print("ALL OK" if ok_all else "SOME CHECKS FAILED"); sys.exit(0 if ok_all else 1)
