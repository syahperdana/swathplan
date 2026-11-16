"""Browser check of the infill planner: track import (text, CSV with names, GPX), coverage grid, gaps,
infill lines, XYZ coverage, coverage extent as area, exports, autosave and restore.

Usage: python3 -I test/infill_check.py infill/index.html
"""
import sys, pathlib
from playwright.sync_api import sync_playwright
ok_all = True
def check(c, msg):
    global ok_all
    print(("ok   " if c else "FAIL ") + msg); sys.stdout.flush(); ok_all &= bool(c)
INIT = """window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({n,t}));return}return _ck.call(this)};"""
# tracks across the default area at the planned spacing, two missing and one cut short
TRACKS = """(()=>{const S=params().S,xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys)-50,y1=Math.max(...ys)+50;let out=[],k=0;
for(let x=x0+S/2;x<x1+S;x+=S,k++){if(k==5||k==6)continue;const yy=k==12?(y0+y1)/2:y1;for(let y=y0;y<=yy;y+=5){const q=toLL([x,y]);out.push('L'+k+','+q[0].toFixed(8)+','+q[1].toFixed(8))}}return out.join('\\n')})()"""
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1400, 'height': 900}, locale='en-US', timezone_id='UTC')
    ctx.route(lambda u: not u.startswith('file:'), lambda r: r.abort()); ctx.add_init_script(INIT)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    U = pathlib.Path(sys.argv[1]).resolve().as_uri()
    pg.goto(U); pg.wait_for_timeout(2500); pg.evaluate("setLang('en')")
    check(pg.evaluate("R.lines.length") == 0, "no lines before any coverage is loaded")
    check(pg.evaluate("$('pre').value") == "IF", "infill line prefix")
    pg.evaluate("t=>{$('ifT').value=t}", pg.evaluate(TRACKS)); pg.evaluate("$('ifImp').click()"); pg.wait_for_timeout(2500)
    st = pg.evaluate("$('ifTSt').textContent"); print('   ', st)
    check(st.startswith("48 tracks"), "CSV rows with a line name split into 48 tracks")
    cov = float(pg.evaluate("$('ifCov').textContent").split()[0]); print('   ', pg.evaluate("$('ifSt').textContent"))
    check(95 < cov < 98, f"coverage {cov} %")
    check(pg.evaluate("IF.regions.length") == 2, "two gaps (missing pair, cut-short line)")
    ln = pg.evaluate("R.lines.map(l=>({g:l.gap,len:L(l)}))")
    check(len(ln) == 3 and [l['g'] for l in ln].count(1) == 2, "two infill lines across the wide gap, one across the short gap")
    # every gap cell lies within half a line spacing of an infill line
    worst = pg.evaluate("""(()=>{const G=IF.g,S=params().S;let w=0;IF.regions.forEach(r=>r.cells.forEach(k=>{const i=k%G.nx,j=(k-i)/G.nx,x=G.x0+(i+.5)*G.c,y=G.y0+(j+.5)*G.c;let d=1e9;
      R.lines.forEach(l=>{const a=l.a,b=l.b,dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))});w=Math.max(w,d)}));return w/(params().W/2)})()""")
    check(worst <= 1.0, f"all gap cells inside the infill swaths (worst {worst:.2f} of half a swath)")
    # a margin outside the boundary: the strip west of the first track becomes a gap, the coverage of the area itself is unchanged
    n0 = pg.evaluate("IF.regions.length"); c0 = pg.evaluate("$('ifCov').textContent")
    pg.evaluate("$('ifBuf').value=params().W;$('ifBuf').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(500)
    print('   ', pg.evaluate("$('ifSt').textContent"))
    xw = pg.evaluate("Math.min(...poly.map(p=>p[0]))")
    import os
    if os.environ.get('SHOT'): pg.evaluate("fit();render()"); pg.wait_for_timeout(400); pg.screenshot(path=os.environ['SHOT'])
    check(abs(float(pg.evaluate("$('ifCov').textContent").split()[0]) - float(c0.split()[0])) < 1, "margin outside the boundary: coverage of the area itself unchanged (grid shift only)")
    over = pg.evaluate("""(()=>{const G=IF.g;let a=0,b=0;R.lines.forEach(l=>{const n=Math.ceil(L(l)/G.c);for(let t=0;t<=n;t++){const x=l.a[0]+(l.b[0]-l.a[0])*t/n,y=l.a[1]+(l.b[1]-l.a[1])*t/n,i=Math.floor((x-G.x0)/G.c),j=Math.floor((y-G.y0)/G.c);if(i<0||j<0||i>=G.nx||j>=G.ny)continue;const k=j*G.nx+i;if(!G.ins[k])continue;b++;if(G.cov[k]>=255)a++}});return a/Math.max(1,b)})()""")
    check(over < 0.35, f"infill lines do not run across covered ground ({over*100:.0f} % of their length over covered cells, from the line extensions)")
    h = pg.evaluate("Math.max(...poly.map(p=>p[1]))-Math.min(...poly.map(p=>p[1]))")
    check(pg.evaluate("R.lines.filter(l=>Math.abs(l.b[0]-l.a[0])>Math.abs(l.b[1]-l.a[1])).length") >= 2, "the strips along the north and south edges get lines along the edge (east-west)")
    check(pg.evaluate("R.lines.length") < 20, f"a few lines around the margin, not many short ones ({pg.evaluate('R.lines.length')})")
    check(pg.evaluate(f"R.lines.some(l=>Math.max(l.a[0],l.b[0])<{xw})"), "an infill line runs outside the boundary to cover the margin")
    pg.evaluate("$('ifBuf').value=0;$('ifBuf').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(500)
    check(pg.evaluate("IF.regions.length") == n0, "margin 0: back to the gaps inside the area")
    check(abs(pg.evaluate("g('az')")) < 0.01 or abs(pg.evaluate("g('az')") - 180) < 0.01, "line direction follows the tracks (N-S)")
    chk = pg.evaluate("$('chk').innerText")
    check(chk.startswith("Coverage") and "No cross lines" not in chk and "overlap" not in chk.split('\n')[1], "infill plan checks")
    # XYZ soundings fill the short gap
    xyz = pg.evaluate("""(()=>{const S=params().S,xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys)-50,y1=Math.max(...ys)+50,xc=x0+S/2+12*S;let o=[];
      for(let x=xc-S/2-10;x<=xc+S/2+10;x+=4)for(let y=(y0+y1)/2-20;y<=y1;y+=4){const q=toLL([x,y]);o.push(q[1].toFixed(8)+' '+q[0].toFixed(8)+' 25')}return o.join('\\n')})()""")
    pg.evaluate("t=>{$('snd').value=t;$('xl').click()}", xyz); pg.wait_for_timeout(2500)
    check(pg.evaluate("IF.regions.length") == 1 and pg.evaluate("R.lines.length") == 2, "XYZ soundings close the short gap")
    pg.evaluate("$('ifX').click()"); pg.wait_for_timeout(500)
    check(pg.evaluate("IF.regions.length") == 2, "untick: soundings no longer count")
    pg.evaluate("$('ifX').click()"); pg.wait_for_timeout(500)
    # fixed width wider than the gap pair: no gap left
    pg.evaluate("$('ifWM').value='fixed';$('ifWF').value=200;$('ifWM').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(500)
    check(pg.evaluate("IF.regions.length") == 0 and "covered" in pg.evaluate("$('ifSt').textContent"), "fixed 200 m swath covers everything")
    pg.evaluate("$('ifWM').value='depth';$('ifWM').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(500)
    # exports
    pg.evaluate("window.__dl=[]")
    for b in ['ifCsv', 'eLnx', 'eKml', 'eGj']:
        if pg.evaluate(f"!!$('{b}')"): pg.evaluate(f"$('{b}').click()")
    pg.wait_for_timeout(1500)
    dl = pg.evaluate("window.__dl.map(d=>[d.n,d.t.length,d.t.split('\\n').length])"); print('   ', dl)
    gcsv = pg.evaluate("(window.__dl.find(d=>d.n=='coverage_gaps.csv')||{t:''}).t")
    check(gcsv.startswith("Gap,Area_m2") and len(gcsv.strip().split('\n')) == 2, "gaps CSV with one gap")
    check(len(dl) >= 2, "line exports work")
    # autosave + restore of tracks
    pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(3500)
    check(pg.evaluate("IFT.length") == 48 and pg.evaluate("R.lines.length") == 2, "tracks, soundings and plan restored after reload")
    check('swp_state_infill' in pg.evaluate("Object.keys(localStorage)"), "own autosave key")
    # GPX track and coverage extent as the area
    gpx = pg.evaluate("""(()=>{let s='<?xml version="1.0"?><gpx version="1.1"><trk><name>T1</name><trkseg>';for(let i=0;i<50;i++){const q=toLL([i*20,0]);s+='<trkpt lat="'+q[0]+'" lon="'+q[1]+'"/>'}return s+'</trkseg></trk></gpx>'})()""")
    pg.evaluate("$('ifClr').click()"); pg.wait_for_timeout(300)
    check(pg.evaluate("IFT.length") == 0, "clear tracks")
    pg.set_input_files('#ifF', files=[{'name': 'track.gpx', 'mimeType': 'application/gpx+xml', 'buffer': gpx.encode()}])
    pg.evaluate("$('ifImp').click()"); pg.wait_for_timeout(2000)
    check(pg.evaluate("IFT.length") == 1 and pg.evaluate("IFT[0].p.length") >= 40, "GPX track imported")
    pg.evaluate("$('ifArea').click()"); pg.wait_for_timeout(800)
    check(pg.evaluate("closed&&poly.length>=4") and abs(pg.evaluate("g('az')") - 90) < 0.5, "coverage extent as the area, direction E-W")
    check(not errs, f"no page errors {errs}")
    br.close()
print("ALL OK" if ok_all else "SOME CHECKS FAILED"); sys.exit(0 if ok_all else 1)
