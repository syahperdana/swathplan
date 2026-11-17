"""Dense XYZ grids: loading in steps, statistics, adaptive spacing over drying ground, depth legend, layers, removing data.
python3 -I test/bathy_load_check.py planner/index.html
A synthetic 1 m grid (480 000 points, UTM 51N) slopes from 4 m above datum (drying) to 20 m deep."""
import sys, os, tempfile, math
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'planner/index.html')
bad = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: bad.append(m)
# grid: x 474800..475399 (600 columns), y 97800..98599 (800 rows); depth = -4 + 24 * (x - 474800) / 600
tmp = tempfile.mkdtemp(); xyz = os.path.join(tmp, 'grid.xyz'); zs = []
with open(xyz, 'w') as fo:
    fo.write('E,N,Z\n')
    for j in range(800):
        y = 98599.5 - j
        for i in range(600):
            x = 474800.5 + i; z = -4 + 24 * (x - 474800) / 600; zs.append(z); fo.write(f'{x:.1f},{y:.1f},{z:.3f}\n')
# area: the middle of the grid, 400 m x 600 m
B = [(474900, 97900), (475300, 97900), (475300, 98500), (474900, 98500)]
inside = [-4 + 24 * (474800.5 + i - 474800) / 600 for i in range(600) if 474900 <= 474800.5 + i <= 475300]
zin_mean = sum(inside) / len(inside)
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 1400, 'height': 900}, locale='en-US'); c.route(lambda u: not u.startswith('file:'), lambda r: r.abort())
    pg = c.new_page(); e = []; pg.on('pageerror', lambda x: e.append(str(x))); pg.goto('file://' + f + '?type=mbes&shape=area'); pg.wait_for_timeout(2500); ev = pg.evaluate; ev("setLang('en')")
    ev("$('xcrs').value='utmN';$('zone').value=51;$('xcrs').dispatchEvent(new Event('change'))")
    ev("$('depth').value=10;$('ov').value=50;['depth','ov'].forEach(i=>$(i).dispatchEvent(new Event('input')))")
    ev("t=>{$('bT').value=t;$('bP').click()}", "\n".join(f"{x} {y}" for x, y in B)); pg.wait_for_timeout(800)
    ok(ev("closed") and ev("poly.length") == 4, 'boundary from pasted UTM coordinates')
    ev("$('hdr').value=1"); pg.set_input_files('#xf', xyz)
    ev("window.__gap=0;window.__last=performance.now();window.__hb=setInterval(()=>{const t=performance.now();__gap=Math.max(__gap,t-__last);__last=t},10)")
    ev("$('xl').click()"); pg.wait_for_function("bath&&sdp&&bath.z.length>0", timeout=120000); pg.wait_for_timeout(1200)
    n = ev("bath.z.length"); ok(n == 480000, f'all rows read ({n})')
    ok(ev("bath.la instanceof Float64Array && bath.z instanceof Float32Array"), 'stored as typed arrays')
    ok(abs(ev("bath.res") - 1) < 0.01, f"point spacing detected: {ev('bath.res')} m")
    gap = ev("__gap"); ok(gap < 1500, f'page kept responding while loading (longest pause {gap:.0f} ms)')
    S = ev("sdp"); ok(abs(S['min'] - min(inside)) < 0.02 and abs(S['max'] - max(inside)) < 0.02, f"inside-area min/max {S['min']:.2f}/{S['max']:.2f}")
    ok(abs(S['mean'] - zin_mean) < 0.05, f"inside-area mean {S['mean']:.2f} (expected {zin_mean:.2f})")
    ok(abs(S['med'] - zin_mean) < 0.1 and S['sd'] > 0, f"median {S['med']:.2f}, σ {S['sd']:.2f}")
    # georeferencing: a grid point lands where its UTM coordinates say (lattice interpolation)
    ll = ev("(()=>{const i=480000-1;return [bath.la[i],bath.lo[i]]})()"); ex = ev("(()=>{const c=mkConv();return c(475399.5,97800.5)})()")
    ok(abs(ll[0] - ex[0]) < 1e-8 and abs(ll[1] - ex[1]) < 1e-8, f'projected through the lattice to within 1 mm ({(ll[0]-ex[0])*1.1e5:.4f} m)')
    # legend
    ok(not ev("$('bLeg').hidden") and 'Inside area' in ev("$('bLegIn').textContent") and '480,000 points' in ev("$('bLegSt').textContent"), 'depth legend with statistics')
    ok(ev("$('bPal').value") == 'rainbow' and 'linear-gradient' in ev("$('bLegBar').style.background"), 'rainbow colour scale by default')
    s1 = ev("(()=>{const s=bathShade();return [s.W,s.H]})()"); ok(s1[0] >= 590 and s1[1] >= 790, f'shaded image at the grid spacing ({s1[0]} x {s1[1]} px)')
    px1 = ev("(()=>{const s=bathShade(),d=s.c.getContext('2d').getImageData(5,5,1,1).data;return [...d]})()")
    pg.select_option('#bPal', 'grey'); pg.wait_for_timeout(300)
    px2 = ev("(()=>{const s=bathShade(),d=s.c.getContext('2d').getImageData(5,5,1,1).data;return [...d]})()")
    ok(px1[:3] != px2[:3] and abs(px2[0] - px2[1]) < 6 and abs(px2[1] - px2[2]) < 6, f'colour scale changes the shading ({px1[:3]} → {px2[:3]})')
    pg.select_option('#bPal', 'rainbow')
    # adaptive spacing: the drying third of the area is left out, so the line count stays near the deep-water spacing
    ev("$('adp').checked=true;gen()"); na = ev("R.lines.length"); sp = ev("[Math.min(...R.sp),Math.max(...R.sp)]")
    ok(na < 60 and sp[0] >= 1.5, f'adaptive spacing with drying ground: {na} lines, spacing {sp[0]:.1f}–{sp[1]:.1f} m')
    chk = ev("[...document.querySelectorAll('#chk li')].map(l=>l.textContent).join('|')")
    ok('leaves out depths shallower than 2 m' in chk, 'plan check names the part left out')
    ev("$('adpMin').value=0;$('adpMin').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(500); n0 = ev("R.lines.length")
    ok(n0 > na, f'limit 0: very shallow water pulls the lines together ({n0} lines)')
    ev("$('adpMin').value=2;$('adpMin').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(500)
    # allowance: lines across the slope (azimuth 90) are spaced for all but their shallowest share
    ev("$('az').value=90;$('adpTol').value=0;gen()"); n0 = ev("R.lines.length"); a0 = ev("ADP_SHORT?ADP_SHORT.A:0")
    ev("$('adpTol').value=25;gen()"); n25 = ev("R.lines.length"); a25 = ev("ADP_SHORT.A"); ar = ev("area(poly)")
    ok(n25 < n0 * 0.8, f'allowance 25 %: fewer lines across the slope ({n0} → {n25})')
    ok(a25 > a0 and 0.02 < a25 / ar < 0.4, f'short-coverage stretches recorded ({a0/ar*100:.1f} % → {a25/ar*100:.1f} % of the area)')
    chk = ev("[...document.querySelectorAll('#chk li')].map(l=>l.textContent).join('|')")
    ok('gets less than the' in chk and 'coverage target' in chk, 'plan check gives the area below the coverage target')
    h1 = ev("(()=>{render();const d=cx.getImageData(0,0,cv.width,cv.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])|0;return h})()")
    ev("$('lyShort').checked=false;render()"); h2 = ev("(()=>{const d=cx.getImageData(0,0,cv.width,cv.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])|0;return h})()")
    ok(h1 != h2, 'orange stretches drawn on the map (layer Below target coverage)'); ev("$('lyShort').checked=true;$('adpTol').value=10;gen()")
    # overlap meaning, line direction, depth under the pointer
    ok(ev("$('covN').value") == '200' and 'about 2 swaths' in ev("$('covX').textContent"), f"50 % overlap shows as 200 % seabed coverage: {ev('$(\'covX\').textContent')}")
    ev("$('az').value=90;gen()"); chk = ev("[...document.querySelectorAll('#chk li')].map(l=>l.textContent).join('|')")
    ok('run across the depth contours' in chk and ('about 0°' in chk or 'about 180°' in chk), 'lines across the contours: plan check names the contour direction')
    km90 = ev("R.lines.reduce((s,l)=>s+L(l),0)"); ev("$('auto').click()"); pg.wait_for_function("!autoBusy", timeout=120000); az = ev("g('az')")
    ok(min(az, 180 - az) <= 10 and ev("R.lines.reduce((s,l)=>s+L(l),0)") < km90, f'Auto optimal with adaptive spacing turns the lines along the contours ({az:.0f}°)')
    bx = pg.locator('#cv').bounding_box(); pg.mouse.move(bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2); pg.wait_for_timeout(200)
    hud = ev("$('hud').textContent"); ok('depth' in hud and ' m' in hud, f'depth under the pointer: {hud}')
    # layers
    for lid in ['lyLines', 'lyTurns', 'lyCross', 'lyBnd', 'lyBath', 'lyCoast', 'lyBase', 'lyLeg']:
        ok(ev(f"$('{lid}').checked"), f'{lid} on by default') if lid in ('lyLines', 'lyBath') else None
    shot = lambda: ev("(()=>{render();const d=cx.getImageData(0,0,cv.width,cv.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])|0;return h})()")
    h0 = shot(); pg.click('#lyLines'); h1 = shot(); pg.click('#lyLines'); h2 = shot()
    ok(h0 != h1 and h0 == h2, 'Survey lines checkbox hides and shows the lines')
    ev("$('lyMore').open=true"); pg.click('#lyBath'); pg.wait_for_timeout(200)
    ok(not ev("$('sb').checked") and ev("$('bLeg').hidden"), 'Bathymetry layer off: soundings switch off and the legend hides')
    pg.click('#lyBath'); pg.wait_for_timeout(200); ok(ev("$('sb').checked") and not ev("$('bLeg').hidden"), 'and back on')
    # removing data
    nl = ev("R.lines.length"); pg.click('#lyClrB'); pg.wait_for_timeout(500)
    ok(ev("bath") is None and ev("sdp") is None and ev("$('bLeg').hidden") and ev("closed") and ev("R.lines.length") > 0, 'Remove bathymetry: depths gone, area and lines kept')
    pg.click('#lyClrP'); pg.wait_for_timeout(400); ok(not ev("closed") and ev("poly.length") == 0 and ev("R.lines.length") == 0, 'Remove survey border: area and lines gone')
    ok(not e, f'no page errors {e[:2]}')
    b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED'); sys.exit(1 if bad else 0)
