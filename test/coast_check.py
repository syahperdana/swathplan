"""Offline coastline: built-in Natural Earth option, coastline kept in the autosave and .SPL.
python3 -I test/coast_check.py planner/index.html [infill/index.html]"""
import sys,os,json
from playwright.sync_api import sync_playwright
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html');fi=os.path.abspath(sys.argv[2]) if len(sys.argv)>2 else None
INIT="""window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({n,t}));return}return _ck.call(this)};"""
bad=[]
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US');c.route(lambda u: not u.startswith('file:'), lambda r: r.abort());c.add_init_script(INIT)
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f);pg.wait_for_timeout(2500);ev=pg.evaluate;ev("setLang('en')")
    # an area across the Jakarta coastline: the south part is land
    ev("o={lat:-6.05,lon:106.85};poly=[[-6.15,106.7],[-6.15,107.0],[-5.95,107.0],[-5.95,106.7]].map(q=>fromLL(q[0],q[1]));closed=true;draw=false;gen()");pg.wait_for_timeout(500)
    L0=ev("R.lines.reduce((s,l)=>s+L(l),0)");ev("$('cNE').click()");pg.wait_for_timeout(3000)
    ok('Natural Earth 1:10m' in ev("$('cSt').textContent") and 'works offline' in ev("$('cSt').textContent") and ev("cst.mode")=='polys','built-in coastline: Natural Earth 1:10m land polygons, offline, kept')
    ok(ev("isLand(fromLL(-6.14,106.85))") and not ev("isLand(fromLL(-6.0,106.85))"),'land on the right side (Jakarta land, Java Sea water)')
    ok(ev("R.lines.reduce((s,l)=>s+L(l),0)")<L0*0.8 and ev("R.lines.filter(l=>isLand([(l.a[0]+l.b[0])/2,(l.a[1]+l.b[1])/2])).length")==0,'lines trimmed off land')
    # Sydney: a ring stored the other way round in Natural Earth, turned so land is still on the left
    ev("o={lat:-33.85,lon:151.3};poly=[[-33.95,151.15],[-33.95,151.45],[-33.75,151.45],[-33.75,151.15]].map(q=>fromLL(q[0],q[1]));closed=true;gen();$('cNE').click()");pg.wait_for_timeout(800)
    ok(ev("isLand(fromLL(-33.87,151.17))") and not ev("isLand(fromLL(-33.85,151.42))"),'reversed rings fixed (Sydney land, Tasman Sea water)')
    ev("o={lat:-6.05,lon:106.85};poly=[[-6.15,106.7],[-6.15,107.0],[-5.95,107.0],[-5.95,106.7]].map(q=>fromLL(q[0],q[1]));closed=true;gen();$('cNE').click()");pg.wait_for_timeout(1800)
    # turns against the coastline: turns at the trimmed south ends bulge onto Jakarta and are flagged
    nb=ev("TL_BAD.length");nt=ev("R.turns.length")
    ok(0<nb<nt and ev("$('chk').firstElementChild.className")=='bad' and 'turns cross land' in ev("$('chk').firstElementChild.textContent"),f'turns crossing land are flagged in the plan checks ({nb} of {nt})')
    ok(ev("(()=>{const B=new Set(TL_BAD),m=a=>a.reduce((s,t)=>s+toLL(t.pts[1])[0],0)/a.length;return m(R.turns.filter((t,i)=>B.has(i)))<m(R.turns.filter((t,i)=>!B.has(i)))})()"),'the flagged turns are the ones on the land (south) side')
    ev("fit();render()");red=ev("(()=>{const d=cx.getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<40&&d[i+2]<60)n++;return n})()")
    ok(red>200,'flagged turns are drawn in red on the map')
    n=ev("R.lines.reduce((s,l)=>s+L(l),0)");seg=ev("cst.seg.length")
    pg.reload();pg.wait_for_timeout(3000)
    ok(ev("cst.seg?cst.seg.length:0")==seg and abs(ev("R.lines.reduce((s,l)=>s+L(l),0)")-n)<1,'coastline and trimmed plan come back after a reload')
    t=ev("splText()");ok('[COASTLINE]' in t and '\np ' in t,'.SPL file carries the coastline')
    ev("$('cClr').click()");pg.wait_for_timeout(300);ev(f"applyState(splParse({json.dumps(t)}))");pg.wait_for_timeout(600)
    ok(ev("cst.seg?cst.seg.length:0")==seg,'opening the .SPL file restores the coastline')
    old=open(os.path.join(os.path.dirname(__file__),'fixtures','spl_v1_original.spl')).read()
    ev(f"applyState(splParse({json.dumps(old)}))");pg.wait_for_timeout(600);ok(not ev("cst.seg&&cst.seg.length"),'a file without a coastline opens without one')
    ev(f"applyState(splParse({json.dumps(t)}))");pg.wait_for_timeout(600)
    ev("window.__dl=[];$('cSave').click()");pg.wait_for_timeout(600);gj=json.loads(ev("window.__dl[0].t"))
    ok(gj['type']=='FeatureCollection' and len(gj['features'])>0,'coastline saved as GeoJSON')
    ev("setCst([[[106.80,-6.10],[106.90,-6.10]]],[],'OSM coastline loaded: 1 ways')");pg.wait_for_timeout(1500)
    pg.reload();pg.wait_for_timeout(3000)
    ok(ev("cst.seg?cst.seg.length/4:0")==1 and 'OSM' in ev("$('cSt').textContent"),'a downloaded (OSM) coastline is kept the same way')
    ok('coast' not in json.loads(ev("localStorage.getItem('swp_state')")),'autosave and share links do not carry the coastline')
    ev("$('cClr').click()");pg.wait_for_timeout(1500);pg.reload();pg.wait_for_timeout(3000)
    ok(not ev("cst.seg&&cst.seg.length"),'a removed coastline stays removed after a reload')
    # 1:10m land polygons on coasts where the 1:10m coastline lines run the other way
    for nm,la,lo,bx,land,sea in [('Perth',-32.0,115.75,[-32.1,115.6,-31.9,115.9],(-32.0,115.85),(-32.0,115.65)),('Lisbon',38.7,-9.3,[38.6,-9.5,38.8,-9.1],(38.75,-9.15),(38.65,-9.45)),('Rotterdam',51.95,4.0,[51.85,3.8,52.05,4.2],(51.9,4.15),(52.0,3.9))]:
        ev(f"o={{lat:{la},lon:{lo}}};poly=[[{bx[0]},{bx[1]}],[{bx[0]},{bx[3]}],[{bx[2]},{bx[3]}],[{bx[2]},{bx[1]}]].map(q=>fromLL(q[0],q[1]));closed=true;gen();$('cNE').click()");pg.wait_for_timeout(700)
        ok(ev(f"isLand(fromLL({land[0]},{land[1]}))") and not ev(f"isLand(fromLL({sea[0]},{sea[1]}))"),f'1:10m land and water on the right sides ({nm})')
    # synthetic coastlines south of an offshore area (drawn east to west, so land is to the south)
    ev("o={lat:-5.3,lon:106.85};poly=[[-5.35,106.8],[-5.35,106.9],[-5.25,106.9],[-5.25,106.8]].map(q=>fromLL(q[0],q[1]));closed=true;gen()")
    cs=lambda la:ev(f"setCst([[[107.0,{la}],[106.7,{la}]]],[],'test coastline')")
    cs(-5.36);pg.wait_for_timeout(800)
    ok(ev("TL_BAD.length")==0 and ev("$('chk').firstElementChild.className")=='ok' and 'All turns stay at least' in ev("$('chk').firstElementChild.textContent"),'turns clear of the coastline: one ok line in the plan checks')
    cs(-5.3505);pg.wait_for_timeout(800)
    ok(ev("TL_BAD.length")>0,'a coastline through the turn bulges flags those turns, even with the lines trimmed')
    ev("$('trim').checked=false");cs(-5.352);pg.wait_for_timeout(800);n30=ev("TL_BAD.length")
    ev("$('clr').value=300");cs(-5.352);pg.wait_for_timeout(800);n300=ev("TL_BAD.length")
    ok(n30==0 and n300>0,f'a turn within the clearance but not crossing is flagged ({n30} at 30 m, {n300} at 300 m)')
    ev("$('clr').value=30;$('trim').checked=true;$('cClr').click()");pg.wait_for_timeout(600)
    ok(ev("TL_BAD.length")==0 and 'turns' not in ev("$('chk').firstElementChild.textContent"),'no coastline: no turn check')
    ok(not e,'no page errors '+str(e))
    # a page used on its own, without data/coast10m.js: the 1:50m set in the page
    c2=b.new_context(locale='en-US');c2.route(lambda u: 'coast10m' in u or not u.startswith('file:'), lambda r: r.abort());p2=c2.new_page();p2.goto('file://'+f);p2.wait_for_timeout(2500);p2.evaluate("setLang('en')")
    p2.evaluate("o={lat:-6.05,lon:106.85};poly=[[-6.15,106.7],[-6.15,107.0],[-5.95,107.0],[-5.95,106.7]].map(q=>fromLL(q[0],q[1]));closed=true;draw=false;gen();$('cNE').click()");p2.wait_for_timeout(1500)
    ok('1:50m' in p2.evaluate("$('cSt').textContent") and 'not found' in p2.evaluate("$('cSt').textContent") and p2.evaluate("isLand(fromLL(-6.14,106.85))"),'without the data file: 1:50m fallback, and it says so')
    if fi:
        pi=c.new_page();e2=[];pi.on('pageerror',lambda x:e2.append(str(x)));pi.goto('file://'+fi);pi.wait_for_timeout(2500)
        ok(pi.evaluate("!!$('cNE')&&!!$('cSave')") and not e2,'infill page has the same coastline options '+str(e2))
        pi.evaluate("$('cNE').click()");pi.wait_for_timeout(1500);ok(not e2,'infill page runs the turn check without errors '+str(e2))
    b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED');sys.exit(1 if bad else 0)
