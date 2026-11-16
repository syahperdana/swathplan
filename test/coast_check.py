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
    L0=ev("R.lines.reduce((s,l)=>s+L(l),0)");ev("$('cNE').click()");pg.wait_for_timeout(800)
    ok('Natural Earth' in ev("$('cSt').textContent") and 'works offline' in ev("$('cSt').textContent"),'built-in coastline loads offline and says it is kept')
    ok(ev("isLand(fromLL(-6.14,106.85))") and not ev("isLand(fromLL(-6.0,106.85))"),'land on the right side (Jakarta land, Java Sea water)')
    ok(ev("R.lines.reduce((s,l)=>s+L(l),0)")<L0*0.8 and ev("R.lines.filter(l=>isLand([(l.a[0]+l.b[0])/2,(l.a[1]+l.b[1])/2])).length")==0,'lines trimmed off land')
    # Sydney: a ring stored the other way round in Natural Earth, turned so land is still on the left
    ev("o={lat:-33.85,lon:151.3};poly=[[-33.95,151.15],[-33.95,151.45],[-33.75,151.45],[-33.75,151.15]].map(q=>fromLL(q[0],q[1]));closed=true;gen();$('cNE').click()");pg.wait_for_timeout(800)
    ok(ev("isLand(fromLL(-33.87,151.17))") and not ev("isLand(fromLL(-33.85,151.42))"),'reversed rings fixed (Sydney land, Tasman Sea water)')
    ev("o={lat:-6.05,lon:106.85};poly=[[-6.15,106.7],[-6.15,107.0],[-5.95,107.0],[-5.95,106.7]].map(q=>fromLL(q[0],q[1]));closed=true;gen();$('cNE').click()");pg.wait_for_timeout(1800)
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
    ok(not e,'no page errors '+str(e))
    if fi:
        pi=c.new_page();e2=[];pi.on('pageerror',lambda x:e2.append(str(x)));pi.goto('file://'+fi);pi.wait_for_timeout(2500)
        ok(pi.evaluate("!!$('cNE')&&!!$('cSave')") and not e2,'infill page has the same coastline options '+str(e2))
    b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED');sys.exit(1 if bad else 0)
