"""Screenshots for the user guide (docs/guide/*.jpg), taken from the built pages.

Usage: python3 -I tools/make_guide_shots.py        (after node tools/build.mjs)

Runs offline: the map has no basemap tiles, only the grid and the built-in coastline.
Rerun it after a visible change to a section, then check the pictures in guide/.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/guide"; OUT.mkdir(parents=True, exist_ok=True)
P = (ROOT / "planner/index.html").as_uri(); I = (ROOT / "infill/index.html").as_uri(); H = (ROOT / "index.html").as_uri()
Q = 78  # JPEG quality

# numbered markers drawn over a screenshot: [(css selector, label, dx, dy)]
MARK = """(ms)=>{document.querySelectorAll('.gshot').forEach(e=>e.remove());ms.forEach(([sel,t,dx,dy])=>{const e=document.querySelector(sel);if(!e)return;const r=e.getBoundingClientRect(),b=document.createElement('div');
b.className='gshot';b.textContent=t;Object.assign(b.style,{position:'fixed',left:(r.left+(dx||8))+'px',top:(r.top+(dy||8))+'px',width:'30px',height:'30px',borderRadius:'50%',background:'#ff2d95',color:'#fff',font:'bold 17px system-ui',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999,boxShadow:'0 0 0 3px #fff,0 2px 6px #0006'});document.body.appendChild(b)})}"""
AREA = "o={lat:-6.02,lon:106.865};poly=[[-6.034,106.851],[-6.036,106.877],[-6.008,106.881],[-6.004,106.856]].map(q=>fromLL(q[0],q[1]));closed=true;draw=false;gen();if(typeof fit=='function')fit()"
# toasts (location hints) would cover the pictures
NOTOAST = "(()=>{const s=document.createElement('style');s.textContent='#toast,.toast,#swpBar{display:none!important}';document.head.appendChild(s)})()"


def shot(pg, name, sel=None, full=False, clip=None):
    p = str(OUT / (name + ".jpg"))
    if sel: pg.locator(sel).first.screenshot(path=p, type="jpeg", quality=Q)
    else: pg.screenshot(path=p, type="jpeg", quality=Q, full_page=full, clip=clip)
    print("  ", name)


# sections by data-sec name, or "#id" of an element inside an unnamed section
SEL = "n=>n[0]=='#'?document.querySelector(n).closest('details'):document.querySelector('details[data-sec='+n+']')"
def opensec(pg, *names):
    pg.evaluate("ns=>{const f=" + SEL + ";document.querySelectorAll('aside details').forEach(d=>d.open=false);ns.forEach(n=>{const d=f(n);if(d)d.open=true})}", list(names)); pg.wait_for_timeout(300)
def secsel(name):
    return f"details[data-sec={name}]" if name[0] != "#" else f"details:has({name})"


def scroll_to(pg, sec):
    pg.evaluate("s=>{const f=" + SEL + ";f(s).scrollIntoView({block:'start'})}", sec); pg.wait_for_timeout(200)


with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 1400, "height": 860}, locale="en-US", device_scale_factor=1)
    ctx.route(lambda u: not u.startswith("file:"), lambda r: r.abort())
    ctx.add_init_script("window.open=()=>null;window.alert=()=>{};")
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))

    # home page
    pg.goto(H); pg.wait_for_timeout(1200); pg.evaluate("setLang('en')"); shot(pg, "hub", clip={"x": 0, "y": 0, "width": 1400, "height": 760})

    # survey planner: overview with markers
    pg.goto(P + "?type=mbes&shape=area"); pg.wait_for_timeout(2500); pg.evaluate("setLang('en')")
    pg.evaluate("$('prjN').value='Tanjung Priok approach';$('prjN').dispatchEvent(new Event('input'))")
    pg.evaluate(NOTOAST); pg.evaluate("$('depth').value=30;$('depth').dispatchEvent(new Event('input'))"); pg.evaluate(AREA); pg.wait_for_timeout(1200)
    opensec(pg, "setup", "sensor"); pg.evaluate("window.scrollTo(0,0)")
    pg.evaluate(MARK, [["header", "1", 238, 12], ["aside", "2", 372, 78], ["#cv", "3", 200, 60], ["#mapwrap + *", "4", 300, 6]]); pg.wait_for_timeout(200)
    shot(pg, "planner-overview"); pg.evaluate(MARK, [])

    # header and tools menu
    pg.evaluate("document.getElementById('tmenu').open=true"); pg.wait_for_timeout(200)
    shot(pg, "header", clip={"x": 0, "y": 0, "width": 1400, "height": 190}); pg.evaluate("document.getElementById('tmenu').open=false")

    # setup
    opensec(pg, "setup"); scroll_to(pg, "setup"); shot(pg, "setup", sel="details[data-sec=setup]")

    # drawing an area: map toolbar while drawing
    pg.evaluate("poly=[[-6.034,106.851],[-6.036,106.877],[-6.008,106.881]].map(q=>fromLL(q[0],q[1]));closed=false;draw=true;R.lines=[];R.cross=[];R.turns=[];rq()"); pg.wait_for_timeout(500)
    shot(pg, "draw-area", sel="#cv")
    pg.evaluate(AREA); pg.wait_for_timeout(800)

    # sensor, swath, direction, turns, IHO
    opensec(pg, "sensor", "swath"); scroll_to(pg, "sensor")
    b1 = pg.locator("details[data-sec=sensor]").bounding_box(); b2 = pg.locator("details[data-sec=swath]").bounding_box()
    shot(pg, "sensor-swath", clip={"x": b1["x"], "y": b1["y"], "width": b1["width"], "height": min(840, b2["y"] + b2["height"] - b1["y"])})
    opensec(pg, "dir", "turn"); scroll_to(pg, "dir")
    b1 = pg.locator("details[data-sec=dir]").bounding_box(); b2 = pg.locator("details[data-sec=turn]").bounding_box()
    shot(pg, "direction-turn", clip={"x": b1["x"], "y": b1["y"], "width": b1["width"], "height": min(840, b2["y"] + b2["height"] - b1["y"])})
    opensec(pg, "iho"); scroll_to(pg, "iho"); shot(pg, "iho", sel="details[data-sec=iho]")

    # Williamson turns, zoomed on the line ends
    pg.evaluate("(()=>{const t=R.turns.find(t=>t&&t.ty=='w')||R.turns.find(t=>t);const p=t.pts[Math.floor(t.pts.length/2)],q=sc(p),r=cv.getBoundingClientRect(),k=cv.width/r.width;zoomAt(q[0],q[1],8);rq()})()")
    pg.wait_for_timeout(600); shot(pg, "turns", sel="#cv"); pg.evaluate("typeof fit=='function'&&fit()"); pg.wait_for_timeout(400)

    # results and plan checks
    pg.evaluate("window.scrollTo(0,document.querySelector('#mapwrap').getBoundingClientRect().bottom+window.scrollY-6)"); pg.wait_for_timeout(300)
    x0 = pg.evaluate("document.querySelector('aside').getBoundingClientRect().right"); shot(pg, "results", clip={"x": x0, "y": 0, "width": 1400 - x0, "height": 860})
    pg.evaluate("document.querySelector('#chk').scrollIntoView({block:'start'})"); pg.wait_for_timeout(300); shot(pg, "checks", sel="#chk")

    # coastline: built-in, Jakarta shore
    pg.evaluate("o={lat:-6.08,lon:106.86};poly=[[-6.13,106.80],[-6.13,106.93],[-6.03,106.93],[-6.03,106.80]].map(q=>fromLL(q[0],q[1]));closed=true;draw=false;gen();typeof fit=='function'&&fit()")
    pg.evaluate("$('trim').checked=true;$('cNE').click()"); pg.wait_for_timeout(3500); pg.evaluate("window.scrollTo(0,0)")
    shot(pg, "coast-map", sel="#cv"); opensec(pg, "coast"); scroll_to(pg, "coast"); shot(pg, "coast", sel="details[data-sec=coast]")
    pg.evaluate("$('cClr').click()"); pg.evaluate(AREA); pg.wait_for_timeout(800)

    # uncertainty budget and tender comparison
    opensec(pg, "#tpuC"); scroll_to(pg, "#tpuC"); pg.wait_for_timeout(400); shot(pg, "tpu", sel="#tpuD")
    opensec(pg, "#tenAdd"); scroll_to(pg, "#tenAdd")
    pg.evaluate("$('tenAdd').click()"); pg.evaluate("$('ov').value=20;$('ov').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
    pg.evaluate("$('tenAdd').click()"); pg.evaluate("$('spd').value=8;$('spd').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300); pg.evaluate("$('tenAdd').click()"); pg.wait_for_timeout(500)
    shot(pg, "tender", sel="#tenD")

    # export section and a map sheet
    opensec(pg, "exp"); scroll_to(pg, "exp"); pg.wait_for_timeout(300)
    b = pg.locator("details[data-sec=exp]").bounding_box(); shot(pg, "export", clip={"x": b["x"], "y": b["y"], "width": b["width"], "height": min(860 - b["y"], b["height"])})
    pg.evaluate("$('xpBase').checked=false")
    url = pg.evaluate("(async()=>{const r=await renderSheet(Object.assign(xo(),{base:false}),false);const c=document.createElement('canvas'),k=1600/r.cv.width;c.width=1600;c.height=Math.round(r.cv.height*k);c.getContext('2d').drawImage(r.cv,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82)})()")
    import base64; (OUT / "sheet.jpg").write_bytes(base64.b64decode(url.split(",")[1])); print("   sheet")

    # project panel
    opensec(pg, "#prjN"); scroll_to(pg, "#prjN"); shot(pg, "project", sel="details:has(#prjN)")

    # survey types: single-beam, geophysical, drone
    for t, sec, nm in [("sbes", "sbes", "sbes"), ("geo", "geo", "geophys"), ("uav", "uav", "drone")]:
        pg.goto(P + f"?type={t}&shape=area"); pg.wait_for_timeout(2200); pg.evaluate("setLang('en')"); pg.evaluate(NOTOAST); pg.evaluate(AREA); pg.wait_for_timeout(600)
        opensec(pg, sec); scroll_to(pg, sec); shot(pg, nm, sel=f"details[data-sec={sec}]")

    # corridor with segments
    pg.goto(P + "?type=mbes&shape=corr"); pg.wait_for_timeout(2500); pg.evaluate("setLang('en')"); pg.evaluate(NOTOAST)
    pg.evaluate("$('coT').value='-6.05 106.40\\n-6.05 106.70\\n-6.25 106.80';$('coImp').click()"); pg.wait_for_timeout(2500)
    pg.evaluate("typeof fit=='function'&&fit()"); pg.wait_for_timeout(400); pg.evaluate("window.scrollTo(0,0)"); shot(pg, "corridor-map", sel="#cv")
    opensec(pg, "route"); scroll_to(pg, "route"); b = pg.locator("details[data-sec=route]").bounding_box()
    shot(pg, "corridor", clip={"x": b["x"], "y": b["y"], "width": b["width"], "height": min(860 - b["y"], b["height"])})

    # infill planner: tracks with two gaps
    pg.goto(I); pg.wait_for_timeout(2500); pg.evaluate("setLang('en')"); pg.evaluate(NOTOAST); pg.evaluate("$('depth').value=40;$('depth').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(400)
    tr = pg.evaluate("""(()=>{const S=params().S,xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys)-50,y1=Math.max(...ys)+50;let out=[],k=0;
for(let x=x0+S/2;x<x1+S;x+=S,k++){if(k==5||k==6)continue;const yy=k==12?(y0+y1)/2:y1;for(let y=y0;y<=yy;y+=5){const q=toLL([x,y]);out.push('L'+k+','+q[0].toFixed(8)+','+q[1].toFixed(8))}}return out.join('\\n')})()""")
    pg.evaluate("t=>{$('ifT').value=t}", tr); pg.evaluate("$('ifImp').click()"); pg.wait_for_timeout(2500); pg.evaluate("typeof fit=='function'&&fit()"); pg.wait_for_timeout(400)
    pg.evaluate("window.scrollTo(0,0)"); shot(pg, "infill-map", sel="#cv")
    opensec(pg, "infill"); scroll_to(pg, "infill"); sec = "infill"; pg.wait_for_timeout(300)
    b = pg.locator(f"details[data-sec={sec}]").bounding_box(); shot(pg, "infill", clip={"x": b["x"], "y": b["y"], "width": b["width"], "height": min(860 - b["y"], b["height"])})
    br.close()
print("errors:", errs or "none"); sys.exit(1 if errs else 0)
