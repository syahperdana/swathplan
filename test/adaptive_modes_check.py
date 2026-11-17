"""Adaptive spacing in corridor and geophysical modes, and best-fit infill lines.
python3 -I test/adaptive_modes_check.py   (uses planner/index.html and infill/index.html)"""
import os, sys
from playwright.sync_api import sync_playwright
bad = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: bad.append(m)
P = os.path.abspath('planner/index.html'); I = os.path.abspath('infill/index.html')
SLOPE = """(z0,z1,m)=>{const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs)-m,x1=Math.max(...xs)+m,y0=Math.min(...ys)-m,y1=Math.max(...ys)+m;const B={la:[],lo:[],z:[],bad:0,zmin:1e9,zmax:-1e9};
for(let x=x0;x<=x1;x+=20)for(let y=y0;y<=y1;y+=20){const d=z0+(z1-z0)*(x-x0)/(x1-x0);const ll=toLL([x,y]);B.la.push(ll[0]);B.lo.push(ll[1]);B.z.push(d);B.zmin=Math.min(B.zmin,d);B.zmax=Math.max(B.zmax,d)}bath=B;DG=null;analyse();gen()}"""
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 1400, 'height': 900}, locale='en-US'); c.route(lambda u: not u.startswith('file:'), lambda r: r.abort())
    e = []
    # corridor: a 6 km route deepening eastwards from 5 to 40 m, in three 2 km segments
    pg = c.new_page(); pg.on('pageerror', lambda x: e.append(str(x))); pg.goto('file://' + P + '?type=mbes&shape=corr'); pg.wait_for_timeout(2500); ev = pg.evaluate; ev("setLang('en')")
    ev("$('coT').value='-6.0 106.8\\n-6.0 106.854';$('coImp').click()"); pg.wait_for_timeout(1500)
    ev("$('coMode').value='swath';$('coHW').value=150;$('coSeg').value=2;$('coSegO').value=100;['coMode','coHW','coSeg','coSegO'].forEach(i=>$(i).dispatchEvent(new Event('input')))"); pg.wait_for_timeout(300)
    ev(f"({SLOPE})(5,40,300)")
    ok(not ev("$('adp').closest('label').hidden"), 'adaptive option offered in corridor mode')
    ev("$('adp').checked=true;$('adp').dispatchEvent(new Event('change'));gen()")
    n = ev("CO.segOff.map(o=>o.length)"); ok(len(n) == 3 and n[0] > n[1] > n[2], f'each segment gets its own spacing: {n} lines from shallow to deep')
    ok('adaptive, by segment' in ev("$('coLn').textContent") and ev("R.lines.length") == sum(n), 'corridor status lists the lines per segment')
    ok(ev("R.lines.every(l=>l.seg>=1)") and all(ev(f"R.lines.filter(l=>l.seg=={i+1}).length") == n[i] for i in range(3)), 'lines belong to their segment')
    ev("$('coMode').value='fixed';$('coMode').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
    ok(not ev("adpOn()"), 'fixed offsets: adaptive spacing does not apply'); ev("$('coMode').value='swath';$('coMode').dispatchEvent(new Event('input'))")
    # geophysical: multibeam and side-scan; the multibeam adapts under the side-scan spacing
    pg.goto('file://' + P + '?type=geo&shape=area'); pg.wait_for_timeout(2500); ev("setLang('en')")
    ev("o={lat:-6,lon:106.8};poly=[[-1500,-1000],[1500,-1000],[1500,1000],[-1500,1000]];closed=true;draw=false;$('az').value=0;gen()"); ev(f"({SLOPE})(5,65,300)")
    for g in ['gSS', 'gMG', 'gSB', 'gSE', 'gMB']: ev(f"$('{g}').checked=['gSS','gMB'].includes('{g}');$('{g}').dispatchEvent(new Event('change',{{bubbles:true}}))")
    ev("$('adp').checked=true;$('adp').dispatchEvent(new Event('change'));gen()")
    cap = ev("adpCap()"); sp = ev("R.sp")
    ok(ev("adpOn()") and 0 < cap < 1e9 and max(sp) <= cap + 0.01 and min(sp) < cap * 0.6, f'geophysical: spacing adapts ({min(sp):.1f}–{max(sp):.1f} m) under the side-scan limit {cap:.1f} m')
    ev("$('gMB').checked=false;$('gMB').dispatchEvent(new Event('change',{bubbles:true}));gen()"); ok(not ev("adpOn()"), 'without the multibeam the spread keeps one spacing')
    # infill: a diagonal holiday, an arc and a wide hole
    pg.goto('file://' + I); pg.wait_for_timeout(2500); ev("setLang('en')")
    ev("$('depth').value=20;$('depth').dispatchEvent(new Event('input'));o={lat:-6,lon:106.8};poly=[[-500,-500],[500,-500],[500,500],[-500,500]];closed=true;draw=false;$('az').value=0")
    ev("""(()=>{const B={la:[],lo:[],z:[],bad:0,zmin:20,zmax:20,xyz:1};const gap=(x,y)=>{const d1=Math.abs((x-y*0.6)+150)/Math.hypot(1,.6);if(d1<9&&y>-420&&y<380&&x<200)return true;
      const r=Math.hypot(x-250,y+250);if(Math.abs(r-170)<8&&x>200)return true;return x>180&&x<330&&y>150&&y<260};
      for(let x=-560;x<=560;x+=4)for(let y=-560;y<=560;y+=4){if(gap(x,y))continue;const ll=toLL([x,y]);B.la.push(ll[0]);B.lo.push(ll[1]);B.z.push(20)}bath=B;DG=null;if(!$('ifX').checked)$('ifX').click();gen()})()""")
    pg.wait_for_timeout(500)
    ok(ev("$('ifMode').value") == 'fit' and ev("$('ifAzB').hidden"), 'best fit by default; the track-direction button only for one direction')
    nf = ev("R.lines.length"); kf = ev("R.lines.reduce((s,l)=>s+L(l),0)")
    az = ev("R.lines.map(l=>((Math.atan2(l.b[0]-l.a[0],l.b[1]-l.a[1])/D)+360)%180)")
    ok(any(abs(a - 31) < 4 for a in az), f'diagonal holiday filled along its axis (about 31°): {[round(a) for a in az]}')
    ok(len(set(round(a / 10) for a in az)) >= 4, 'lines take different directions for different gaps and parts of the arc')
    ok(sum(1 for a in az if abs(a - 90) < 6) >= 2, 'the wide hole gets parallel lines along its long side (east–west)')
    ev("$('ifMode').value='one';$('ifMode').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(400)
    n1 = ev("R.lines.length"); k1 = ev("R.lines.reduce((s,l)=>s+L(l),0)"); a1 = ev("[...new Set(R.lines.map(l=>Math.round(((Math.atan2(l.b[0]-l.a[0],l.b[1]-l.a[1])/D)+360)%180)))]")
    ok(a1 == [0] and not ev("$('ifAzB').hidden"), 'one direction for all gaps: every line at the line direction')
    ok(nf < n1 and kf < k1, f'best fit needs fewer lines and kilometres ({nf} / {kf/1000:.2f} km against {n1} / {k1/1000:.2f} km)')
    # the wide hole on drying ground: no lines there, and the status says why
    ev("$('ifMode').value='fit';$('ifMode').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(300)
    ev("""(()=>{const B=bath;for(let i=0;i<B.z.length;i++){const p=fromLL(B.la[i],B.lo[i]);if(p[0]>140&&p[0]<370&&p[1]>110&&p[1]<300)B.z[i]=-1}B.zmin=-1;DG=null;gen()})()"""); pg.wait_for_timeout(500)
    nd = ev("R.lines.length"); st = ev("$('ifSt').textContent")
    ok(ev("IF.dry.size") == 1 and nd < nf and 'drying ground' in st, f'gap on drying ground gets no lines ({nf} → {nd}): {st[-110:]}')
    ok(not any(140 < (l['a'][0] + l['b'][0]) / 2 < 370 and 110 < (l['a'][1] + l['b'][1]) / 2 < 300 for l in ev("R.lines")), 'no line left in the drying hole')
    ev("$('depth').value=-5;$('depth').dispatchEvent(new Event('input'));gen()"); pg.wait_for_timeout(300)
    ok(ev("R.lines.length") == 0 and 'must be more than 0 m' in ev("$('ifSt').textContent"), f'design depth below 0 m: no lines, and the status says so {ev("R.lines.length")} {ev("$(\'ifSt\').textContent")}')
    ok(not e, f'no page errors {e[:2]}')
    b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED'); sys.exit(1 if bad else 0)
