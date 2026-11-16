"""Browser check of the infill planner's data sources: processed bathymetry grid (GeoTIFF, lat/lon, no-data),
side-scan mosaic (GeoTIFF, UTM with its EPSG code, and without one through section CRS), side-scan
tracks with 100 % and 200 % coverage, the kind switch and restore.

Usage: python3 -I test/infill_sources_check.py infill/index.html
"""
import sys, io, pathlib
import numpy as np
from PIL import Image, TiffImagePlugin
from playwright.sync_api import sync_playwright
ok_all = True
def check(c, msg):
    global ok_all
    print(("ok   " if c else "FAIL ") + msg); sys.stdout.flush(); ok_all &= bool(c)
def tif(arr, mode, x0, y0, px, py, comp, nd=None, epsg=None):
    d = TiffImagePlugin.ImageFileDirectory_v2()
    d[33550] = (px, py, 0.0); d.tagtype[33550] = 12
    d[33922] = (0.0, 0.0, 0.0, x0, y0, 0.0); d.tagtype[33922] = 12
    if nd is not None: d[42113] = nd; d.tagtype[42113] = 2
    if epsg: d[34735] = (1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, epsg); d.tagtype[34735] = 3
    b = io.BytesIO(); Image.fromarray(arr, mode).save(b, format='TIFF', compression=comp, tiffinfo=d); return b.getvalue()
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1400, 'height': 900}, locale='en-US', timezone_id='Asia/Jakarta')
    ctx.route(lambda u: not u.startswith('file:'), lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()); pg.wait_for_timeout(2500); pg.evaluate("setLang('en')")
    secs = lambda: pg.evaluate("[...document.querySelectorAll('details[data-sec]')].filter(d=>!d.closest('[hidden]')).map(d=>d.dataset.sec)")
    v = secs(); check(v[:5] == ['ifsetup', 'crs', 'sensor', 'swath', 'infill'] and 'xyz' not in v, f"multibeam sections {v[:6]}")
    check(pg.evaluate("!!$('ifXYZ').querySelector('#snd')"), "XYZ soundings input sits in the coverage section")
    la0, la1, lo0, lo1 = pg.evaluate("(()=>{const ll=poly.map(toLL),la=ll.map(q=>q[0]),lo=ll.map(q=>q[1]);return[Math.min(...la),Math.max(...la),Math.min(...lo),Math.max(...lo)]})()")
    m = 0.002; W = H = 400; px = (lo1 - lo0 + 2 * m) / W; py = (la1 - la0 + 2 * m) / H
    g = np.full((H, W), -22.0, np.float32); g[160:240, 160:240] = -9999
    pg.set_input_files('#ifGF', files=[{'name': 'surface.tif', 'mimeType': 'image/tiff', 'buffer': tif(g, 'F', lo0 - m, la1 + m, px, py, 'tiff_lzw', nd='-9999')}]); pg.wait_for_timeout(2500)
    exp = 100 * 0.04 * ((lo1 - lo0 + 2 * m) * (la1 - la0 + 2 * m)) / ((lo1 - lo0) * (la1 - la0))
    cov = float(pg.evaluate("$('ifCov').textContent").split()[0])
    check(abs((100 - cov) - exp) < 0.8, f"grid holiday found: {100 - cov:.1f} % of the area (expected {exp:.1f} %)")
    check(pg.evaluate("IF.regions.length") == 1 and pg.evaluate("R.lines.length") > 3, f"one holiday, {pg.evaluate('R.lines.length')} infill lines")
    # side-scan
    pg.evaluate("$('ifK').value='sss';$('ifK').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(800)
    v = secs(); check('sensor' not in v and 'swath' not in v and pg.evaluate("$('ifGSt').innerText") == 'No grid loaded.', f"side-scan sections {v[:4]}, bathymetry grid set aside")
    e0, e1, n0, n1 = pg.evaluate("(()=>{const e=poly.map(p=>oc(p));return[Math.min(...e.map(q=>q[0])),Math.max(...e.map(q=>q[0])),Math.min(...e.map(q=>q[1])),Math.max(...e.map(q=>q[1]))]})()")
    W2 = H2 = 500; p2 = (e1 - e0 + 100) / W2; q2 = (n1 - n0 + 100) / H2
    mo = np.random.randint(30, 220, (H2, W2)).astype(np.uint8); mo[200:300, 200:300] = 0
    expm = 100 * (100 * p2 * 100 * q2) / pg.evaluate("area(poly)")
    pg.set_input_files('#ifGF', files=[{'name': 'mosaic_epsg.tif', 'mimeType': 'image/tiff', 'buffer': tif(mo, 'L', e0 - 50, n1 + 50, p2, q2, 'tiff_deflate', epsg=32748)}]); pg.wait_for_timeout(2500)
    st = pg.evaluate("$('ifGSt').innerText"); cov = float(pg.evaluate("$('ifCov').textContent").split()[0])
    check('EPSG 32748' in st and abs((100 - cov) - expm) < 1.0, f"UTM mosaic with its EPSG code: gap {100 - cov:.1f} % (expected {expm:.1f} %) · {st}")
    check('cannot show where the seabed was seen twice' in pg.evaluate("$('ifSt').textContent"), "200 % with a mosaic only: note to load the tracks")
    pg.evaluate("$('ifGClr').click()"); pg.wait_for_timeout(300)
    pg.evaluate("$('xcrs').value='utmS';$('zone').value='48';$('zone').dispatchEvent(new Event('change',{bubbles:true}));$('xcrs').dispatchEvent(new Event('change',{bubbles:true}))"); pg.wait_for_timeout(300)
    pg.set_input_files('#ifGF', files=[{'name': 'mosaic_plain.tif', 'mimeType': 'image/tiff', 'buffer': tif(mo, 'L', e0 - 50, n1 + 50, p2, q2, 'packbits')}]); pg.wait_for_timeout(2500)
    cov = float(pg.evaluate("$('ifCov').textContent").split()[0])
    check(abs((100 - cov) - expm) < 1.0 and 'section' in pg.evaluate("$('ifGSt').innerText"), f"mosaic without EPSG through the section CRS: gap {100 - cov:.1f} %")
    pg.evaluate("$('ifGClr').click()"); pg.wait_for_timeout(300)
    # side-scan tracks: 200 % spacing is 2 × 75 × 0.9 / 2 = 67.5 m; one track left out
    check(abs(pg.evaluate("ifSpacing()") - 67.5) < 1e-9, "infill line spacing for 200 % side-scan (67.5 m)")
    trk = pg.evaluate("""(()=>{const S=67.5,xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs)-75,x1=Math.max(...xs)+75,y0=Math.min(...ys)-50,y1=Math.max(...ys)+50;let out=[],k=0;
      for(let x=x0;x<x1+S;x+=S,k++){if(k==8)continue;out.push('T'+k);for(let y=y0;y<=y1;y+=10){const q=toLL([x,y]);out.push(q[0].toFixed(8)+' '+q[1].toFixed(8))}out.push('')}return out.join('\\n')})()""")
    pg.evaluate("t=>{$('ifT').value=t;$('ifImp').click()}", trk); pg.wait_for_timeout(2500)
    once = pg.evaluate("(()=>{const G=IF.g;let n=0;for(let k=0;k<G.cov.length;k++)if(G.ins[k]&&G.cov[k]==1)n++;return n})()")
    check(once > 0 and pg.evaluate("IF.regions.length") >= 1 and pg.evaluate("R.lines.length") >= 1, f"200 %: strip seen once is a gap ({once} cells), infill lines planned")
    # the missing track's strip is covered once: an infill line runs along it
    xm = pg.evaluate("(()=>{const xs=poly.map(p=>p[0]);return Math.min(...xs)-75+8*67.5})()")
    near = pg.evaluate(f"R.lines.some(l=>Math.abs((l.a[0]+l.b[0])/2-({xm}))<67.5)")
    check(near, "an infill line runs along the missing track")
    pg.evaluate("$('ifReq').value='100';$('ifReq').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(800)
    check(float(pg.evaluate("$('ifCov').textContent").split()[0]) > 99.9 and abs(pg.evaluate("ifSpacing()") - 135) < 1e-9, "100 %: the same tracks cover everything")
    pg.evaluate("$('ifReq').value='200';$('ifReq').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(800)
    pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(3500)
    check(pg.evaluate("$('ifK').value") == 'sss' and pg.evaluate("IFT.length") > 40, "kind and tracks restored after reload")
    pg.evaluate("$('ifK').value='mbes';$('ifK').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(800)
    check('surface.tif' in pg.evaluate("$('ifGSt').innerText"), "bathymetry grid kept and shown again for multibeam")
    check(not errs, f"no page errors {errs[:3]}")
    br.close()
print("ALL OK" if ok_all else "SOME CHECKS FAILED"); sys.exit(0 if ok_all else 1)
