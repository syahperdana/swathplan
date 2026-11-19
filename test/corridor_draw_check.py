"""Drawing a corridor route on the map gives a route and its corridor, never a closed polygon of the route points,
whatever the design depth. A design depth of 0 m or less stops only the lines that depend on it.
python3 -I test/corridor_draw_check.py planner/index.html"""
import os, sys
from playwright.sync_api import sync_playwright
bad = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: bad.append(m)
F = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'planner/index.html')
with sync_playwright() as p:
    b = p.chromium.launch()
    def page(q):  # a fresh browser context each time, so no autosave carries over
        c = b.new_context(viewport={'width': 1400, 'height': 900}); c.route(lambda u: not u.startswith('file:'), lambda r: r.abort())
        pg = c.new_page(); E = []; pg.on('pageerror', lambda x: E.append(str(x))); pg.goto('file://' + F + q); pg.wait_for_timeout(1200); return pg, E
    def draw(pg, depth, extra=''):
        ev = pg.evaluate
        ev(extra or '0'); pg.wait_for_timeout(300); ev(f"$('depth').value='{depth}';$('depth').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(200)
        pg.click('#bDraw'); bb = pg.locator('#cv').bounding_box()
        for fx, fy in [(.3, .6), (.5, .45), (.7, .55)]:
            pg.mouse.click(bb['x'] + bb['width'] * fx, bb['y'] + bb['height'] * fy); pg.wait_for_timeout(120)
        pg.click('#bClose'); pg.wait_for_timeout(700)
        return dict(rt=ev("RT.length"), corr=ev("!!CO.P"), poly=ev("poly.length"), lines=ev("R.lines.length"), chk=ev("[...document.querySelectorAll('#chk li')].map(l=>l.textContent).join('|')"))
    for t in ['mbes', 'geo']:
        for d in ['25', '', '-5']:
            pg, E = page(f'?type={t}&shape=corr'); r = draw(pg, d)
            ok(r['rt'] == 3 and r['corr'] and r['poly'] > 3, f'{t}, depth "{d}": the route and its corridor ({r["poly"]} outline points), not a closed route polygon')
            need = t == 'mbes'
            if d == '25' or not need: ok(r['lines'] > 0, f'{t}, depth "{d}": {r["lines"]} lines')
            else: ok(r['lines'] == 0 and 'must be more than 0 m' in r['chk'], f'{t}, depth "{d}": no lines, and the plan checks say why')
            ok(not E, f'{t}, depth "{d}": no page errors {E[:1]}'); pg.close()
    pg, E = page('?type=mbes&shape=corr'); r = draw(pg, '-5', "$('coMode').value='fixed';$('coMode').dispatchEvent(new Event('change'))")
    ok(r['corr'] and r['lines'] > 0, f'fixed offsets do not need the design depth ({r["lines"]} lines)'); pg.close()
    pg, E = page('?type=geo&shape=corr'); r = draw(pg, '-5', "$('gMB').checked=true;$('gMB').dispatchEvent(new Event('change'))")
    ok(r['corr'] and r['lines'] == 0 and 'must be more than 0 m' in r['chk'], f'geophysical with the multibeam ticked needs the design depth'); pg.close()
    pg, E = page('?type=uav'); pg.evaluate("$('depth').value='-5';$('depth').dispatchEvent(new Event('input'))")
    pg.click('#bDraw'); bb = pg.locator('#cv').bounding_box()
    for fx, fy in [(.3, .3), (.7, .3), (.7, .7), (.3, .7)]: pg.mouse.click(bb['x'] + bb['width'] * fx, bb['y'] + bb['height'] * fy); pg.wait_for_timeout(120)
    pg.click('#bClose'); pg.wait_for_timeout(700)
    ok(pg.evaluate("R.lines.length") > 0, f'drone area ignores the design depth ({pg.evaluate("R.lines.length")} lines)'); pg.close()
    b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED'); sys.exit(1 if bad else 0)
