"""Demo video of SwathPlan (docs/demo.mp4), recorded from the built pages.

Usage: python3 -I tools/make_demo.py      (after node tools/build.mjs; needs ffmpeg and pdftoppm)

Runs offline: the pages are served from this folder, every other request is refused, so the map shows the grid,
the built-in coastline and synthetic depths or terrain instead of basemap tiles and downloaded data.
Frames come from Chromium's screencast at 1920 x 1080; captions and the pointer are drawn in the page.
"""
import base64, time, functools, http.server, json, os, pathlib, shutil, subprocess, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORK = pathlib.Path("/tmp/swp_demo"); shutil.rmtree(WORK, ignore_errors=True); (WORK / "f").mkdir(parents=True)
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/demo.mp4"
PORT = 8791; BASE = f"http://localhost:{PORT}/"

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("localhost", PORT), functools.partial(Q, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()

# captions and pointer, drawn above the page
OVERLAY = r"""(()=>{if(window.__ov)return;const st=document.createElement('style');st.textContent=`
#__cap{position:fixed;left:50%;bottom:26px;transform:translate(-50%,12px);opacity:0;transition:opacity .35s,transform .35s;z-index:2147483646;
background:rgba(10,32,40,.92);color:#fff;font:600 21px/1.25 Inter,system-ui,sans-serif;padding:11px 20px 11px 12px;border-radius:14px;display:flex;align-items:center;gap:12px;
box-shadow:0 8px 26px rgba(0,0,0,.35);white-space:nowrap;pointer-events:none}
#__cap.on{opacity:1;transform:translate(-50%,0)}
#__cap b{background:#14b8a6;color:#04231f;border-radius:9px;min-width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px}
#__cur{position:fixed;left:640px;top:360px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#ff2d95;border:3px solid #fff;
box-shadow:0 2px 8px rgba(0,0,0,.45);z-index:2147483647;pointer-events:none;transition:left .7s cubic-bezier(.5,0,.2,1),top .7s cubic-bezier(.5,0,.2,1)}
#__cur.hide{opacity:0}
.__pulse{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:3px solid #ff2d95;z-index:2147483646;pointer-events:none;animation:__p .55s ease-out forwards}
@keyframes __p{to{transform:scale(3.2);opacity:0}}
#__shot{position:fixed;inset:0;z-index:2147483640;background:rgba(8,26,32,.78);display:flex;align-items:center;justify-content:center;gap:28px;opacity:0;transition:opacity .45s;pointer-events:none}
#__shot.on{opacity:1}#__shot img{max-height:84vh;max-width:86vw;box-shadow:0 14px 40px rgba(0,0,0,.5);border-radius:4px;transition:transform 6s linear}
#toast,.toast,#swpBar{display:none!important}`;document.head.appendChild(st);
const c=document.createElement('div');c.id='__cap';document.body.appendChild(c);const u=document.createElement('div');u.id='__cur';document.body.appendChild(u);
window.__ov={cap(n,t){c.classList.remove('on');setTimeout(()=>{c.innerHTML=(n?'<b>'+n+'</b>':'')+'<span>'+t+'</span>';c.classList.add('on')},n===null?0:260)},
nocap(){c.classList.remove('on')},
mv(x,y,ms){u.style.transition=`left ${ms}ms cubic-bezier(.5,0,.2,1),top ${ms}ms cubic-bezier(.5,0,.2,1)`;u.style.left=x+'px';u.style.top=y+'px'},
put(x,y){u.style.transition='none';u.style.left=x+'px';u.style.top=y+'px'},
pulse(){const r=u.getBoundingClientRect(),p=document.createElement('div');p.className='__pulse';p.style.left=(r.left+r.width/2)+'px';p.style.top=(r.top+r.height/2)+'px';document.body.appendChild(p);setTimeout(()=>p.remove(),700)},
hide(h){u.classList.toggle('hide',!!h)},
shot(srcs,zoom){let s=document.getElementById('__shot');if(!s){s=document.createElement('div');s.id='__shot';document.body.appendChild(s)}
s.innerHTML=srcs.map(x=>'<img src="'+x+'">').join('');requestAnimationFrame(()=>{s.classList.add('on');if(zoom)setTimeout(()=>s.querySelectorAll('img').forEach(i=>i.style.transform='scale('+zoom+')'),80)})},
noshot(){const s=document.getElementById('__shot');if(s)s.classList.remove('on')}};})()"""

# opening title: a survey area is drawn and filled with lines and turns, then the name and what it plans
INTRO = r"""<!DOCTYPE html><html><head><style>
html,body{margin:0;height:100%;overflow:hidden;background:radial-gradient(ellipse at 50% 45%,#0e5b61 0%,#08343d 55%,#041a20 100%);font-family:Inter,system-ui,sans-serif;color:#fff}
#grid{position:absolute;inset:-60px;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:48px 48px;animation:drift 8s linear infinite}
@keyframes drift{to{transform:translate(48px,48px)}}
svg{position:absolute;inset:0;width:100%;height:100%}
.edge{fill:none;stroke:#fff;stroke-width:2;stroke-dasharray:6 5;opacity:.9}
.ln{fill:none;stroke:#2dd4bf;stroke-width:2.2;stroke-linecap:round;transition:opacity 1s}
.tn{transition:opacity 1s}
svg.dim .ln,svg.dim .tn{opacity:.3}svg.dim .edge{opacity:.35!important}
.tn{fill:none;stroke:#ff4fa3;stroke-width:2;stroke-linecap:round}
.fill{fill:rgba(20,184,166,.10);opacity:0;transition:opacity 1s}
#t{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .8s}
#t.on{opacity:1}
#name{display:flex;align-items:center;gap:22px;transform:scale(.86);filter:blur(10px);transition:transform 1.1s cubic-bezier(.2,.8,.2,1),filter 1.1s}
#t.on #name{transform:none;filter:none}
#name img{width:92px;height:92px;border-radius:22px;box-shadow:0 10px 40px rgba(0,0,0,.45)}
#name b{font:800 86px/1 Inter,system-ui,sans-serif;letter-spacing:-1.5px;text-shadow:0 6px 30px rgba(0,0,0,.4)}
#name b span{color:#ff5fae}
#tag{margin-top:18px;font-size:27px;opacity:0;transform:translateY(10px);transition:all .7s .25s}
#t.on2 #tag{opacity:.95;transform:none}
#chips{margin-top:30px;display:flex;gap:12px}
#chips i{font-style:normal;font-weight:600;font-size:19px;padding:9px 16px;border-radius:999px;background:rgba(4,30,36,.65);border:1.5px solid rgba(45,212,191,.7);opacity:0;transform:translateY(14px) scale(.9);transition:all .45s cubic-bezier(.2,.9,.3,1.3)}
#chips i.on{opacity:1;transform:none}
#new{margin-top:30px;font-size:20px;letter-spacing:4px;text-transform:uppercase;color:#99f6e4;opacity:0;transition:opacity .6s}
#new.on{opacity:1}
#veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(4,26,32,.0),rgba(4,26,32,.75));opacity:0;transition:opacity .9s}
#veil.on{opacity:1}
#flash{position:absolute;inset:0;background:#f4f7f8;opacity:0;transition:opacity .45s}
</style></head><body><div id=grid></div><svg id=s viewBox="0 0 1280 720"></svg><div id=veil></div>
<div id=t><div id=name><img src="data:image/png;base64,%LOGO%"><b>Swath<span>Plan</span></b></div>
<div id=tag>Survey line planning that runs in your browser</div>
<div id=chips><i>Multibeam</i><i>Single-beam</i><i>Geophysical</i><i>Drone</i><i>Corridor</i><i>Infill</i></div>
<div id=new>What's new</div></div><div id=flash></div>
<script>
const S=document.getElementById('s'),NS='http://www.w3.org/2000/svg';
function el(n,a){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);S.appendChild(e);return e}
function draw(e,ms,delay){const L=e.getTotalLength();e.style.strokeDasharray=L;e.style.strokeDashoffset=L;e.getBoundingClientRect();
setTimeout(()=>{e.style.transition='stroke-dashoffset '+ms+'ms linear';e.style.strokeDashoffset=0},delay)}
// a tilted area with serpentine lines and turns
const P=[[300,190],[930,140],[1040,420],[860,590],[330,560]];
function go(){const poly=el('polygon',{points:P.map(p=>p.join(',')).join(' '),class:'fill'});const ed=el('path',{d:'M'+P.map(p=>p.join(',')).join('L')+'Z',class:'edge'});
ed.style.strokeDasharray='6 5';ed.style.opacity=0;ed.style.transition='opacity .5s';setTimeout(()=>{ed.style.opacity=.9;poly.style.opacity=1},50);
// lines: x from 340 to 1000, each clipped to the polygon (approximate top/bottom by interpolation)
const top=x=>x<930?190+(x-300)*(140-190)/630:140+(x-930)*(420-140)/110, bot=x=>x<860?560+(x-330)*(590-560)/530:590+(x-860)*(420-590)/180;
let d=0,k=0,prev=null;for(let x=345;x<=1000;x+=30,k++){const y0=top(x)+12,y1=bot(x)-12;if(y1-y0<60)continue;const up=k%2==0;
const a=up?[x,y1]:[x,y0],b=up?[x,y0]:[x,y1];
if(prev){const sx=prev[0],sy=prev[1],o=up?-28:28;const tn=el('path',{d:`M${sx},${sy} C${sx},${sy-o} ${a[0]},${a[1]-o} ${a[0]},${a[1]}`,class:'tn'});draw(tn,50,d);d+=36}
const ln=el('path',{d:`M${a[0]},${a[1]}L${b[0]},${b[1]}`,class:'ln'});draw(ln,70,d);d+=52;prev=b}
const T=document.getElementById('t'),V=document.getElementById('veil');
setTimeout(()=>{V.classList.add('on');T.classList.add('on');S.classList.add('dim')},1900);
setTimeout(()=>T.classList.add('on2'),2300);
document.querySelectorAll('#chips i').forEach((c,i)=>setTimeout(()=>c.classList.add('on'),3000+i*170));
setTimeout(()=>document.getElementById('new').classList.add('on'),4300);
setTimeout(()=>document.getElementById('flash').style.opacity=1,5900)}
</script></body></html>"""


class Rec:
    """Chromium screencast frames with their times; recording can pause across page loads."""
    def __init__(self, pg):
        self.pg, self.cdp, self.frames, self.on, self.t0, self.n = pg, pg.context.new_cdp_session(pg), [], False, None, 0
        self.cdp.on("Page.screencastFrame", self._frame)
        self.clock = 0.0  # seconds of video so far
    def _frame(self, e):
        try: self.cdp.send("Page.screencastFrameAck", {"sessionId": e["sessionId"]})
        except Exception: pass
        if not self.on: return
        t = e["metadata"]["timestamp"]
        if self.d is None: self.d = time.time() - t
        p = WORK / "f" / f"{self.n:06d}.jpg"; p.write_bytes(base64.b64decode(e["data"])); self.n += 1
        self.frames.append([str(p), self.clock + (t + self.d) - self.t0])
    def start(self):
        self.t0 = time.time(); self.d = None; self.on = True
        self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})
        self.pg.evaluate("document.body.style.transform='translateZ(0)';setTimeout(()=>document.body.style.transform='',60)")  # force a first frame
    def now(self):
        return self.clock + (time.time() - self.t0 if self.t0 is not None else 0)
    def stop(self):
        self.pg.wait_for_timeout(60)
        end = self.now(); self.on = False; self.cdp.send("Page.stopScreencast")
        if self.frames: self.frames.append([self.frames[-1][0], end]); self.clock = end + 1 / 30
    def hold(self, ms):
        """keep the picture for ms (the screencast sends nothing while the page is still)"""
        self.pg.wait_for_timeout(ms)
        if self.frames: self.frames.append([self.frames[-1][0], self.now()])


def encode(frames, out):
    # a frame lasts until the next one; holds stretch the last picture
    fr = sorted(frames, key=lambda f: f[1]); lst = WORK / "list.txt"; L = []
    for i, f in enumerate(fr[:-1]):
        d = max(0.0, fr[i + 1][1] - f[1])
        if d > 0: L.append(f"file '{f[0]}'\nduration {d:.4f}")
    L.append(f"file '{fr[-1][0]}'\nduration 0.5\nfile '{fr[-1][0]}'")
    lst.write_text("\n".join(L) + "\n")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", str(out)], check=True)


with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--force-color-profile=srgb"])
    ctx = br.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1.5, locale="en-US")
    ctx.route(lambda u: not u.startswith(BASE), lambda r: r.abort())
    ctx.add_init_script("window.open=()=>null;window.alert=()=>{};try{localStorage.setItem('swp_lang','en')}catch(e){}")
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); ev = pg.evaluate
    rec = Rec(pg)

    def load(url, wait=2600):
        if rec.on: rec.stop()
        pg.goto(BASE + url); pg.wait_for_timeout(wait)
        if ev("typeof setLang=='function'"): ev("setLang('en')")
        ev(OVERLAY)
    def cap(n, t): ev("([n,t])=>__ov.cap(n,t)", [n, t])
    def box(sel):
        b = pg.locator(sel).first.bounding_box(); return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    def mv(x, y, ms=700): ev("([x,y,m])=>__ov.mv(x,y,m)", [x, y, ms]); pg.wait_for_timeout(ms + 60)
    def to(sel, ms=700, dx=0, dy=0):
        x, y = box(sel); mv(x + dx, y + dy, ms); return x + dx, y + dy
    def click(sel, ms=700, real=True, dx=0, dy=0):
        x, y = to(sel, ms, dx, dy); ev("__ov.pulse()")
        if real: pg.mouse.click(x, y)
        pg.wait_for_timeout(250)
        try:  # the layout may move after a click: keep the pointer on the control
            b = pg.locator(sel).first.bounding_box(); ev("([x,y])=>__ov.mv(x,y,160)", [b["x"] + b["width"] / 2 + dx, b["y"] + b["height"] / 2 + dy])
        except Exception: pass
    def canvas_click(fx, fy, ms=550):
        b = pg.locator("#cv").bounding_box(); x, y = b["x"] + b["width"] * fx, b["y"] + b["height"] * fy
        mv(x, y, ms); ev("__ov.pulse()"); pg.mouse.click(x, y); pg.wait_for_timeout(200)
    def opensec(*names):
        ev("ns=>{const f=n=>n[0]=='#'?document.querySelector(n).closest('details'):document.querySelector('details[data-sec='+n+']');document.querySelectorAll('aside details').forEach(d=>d.open=false);ns.forEach(n=>{const d=f(n);if(d)d.open=true})}", list(names))
    def scroll(sel, block="start", smooth=True):
        ev("([s,b,m])=>document.querySelector(s).scrollIntoView({block:b,behavior:m?'smooth':'auto'})", [sel, block, smooth]); pg.wait_for_timeout(900 if smooth else 150)
    def top(): ev("window.scrollTo({top:0,behavior:'smooth'});document.querySelector('aside').scrollTo&&document.querySelector('aside').scrollTo({top:0,behavior:'smooth'})"); pg.wait_for_timeout(700)
    def setv(id, v, evn="input"): ev("([i,v,e])=>{const x=$(i);if(x.type=='checkbox')x.checked=v;else x.value=v;x.dispatchEvent(new Event(e,{bubbles:true}))}", [id, v, evn])
    def sel_opt(id, v):
        click("#" + id, 600, real=False); pg.select_option("#" + id, v); pg.wait_for_timeout(200)

    BATH = """(()=>{const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs)-1500,x1=Math.max(...xs)+1500,y0=Math.min(...ys)-1500,y1=Math.max(...ys)+1500,cx=(x0+x1)/2,cy=(y0+y1)/2,st=Math.max(40,(x1-x0)/140);
const B={la:[],lo:[],z:[],bad:0,zmin:1e30,zmax:-1e30};for(let x=x0;x<=x1;x+=st)for(let y=y0;y<=y1;y+=st){const d=24+0.0042*((y-cy)+700*Math.sin((x-cx)/1900))+2.5*Math.sin((x-cx)/700)*Math.cos((y-cy)/900);
const ll=toLL([x,y]);B.la.push(ll[0]);B.lo.push(ll[1]);B.z.push(d);B.zmin=Math.min(B.zmin,d);B.zmax=Math.max(B.zmax,d)}bath=B;DG=null;analyse();gen()})()"""

    # ---------------------------------------------------------------- intro
    logo = base64.b64encode((ROOT / "icons/icon-192.png").read_bytes()).decode()
    pg.set_content(INTRO.replace("%LOGO%", logo)); pg.wait_for_timeout(400)
    rec.start(); ev("go()"); pg.wait_for_timeout(6400); rec.stop()

    # ---------------------------------------------------------------- 1 draw an area
    load("planner/?type=mbes&shape=area")
    ev("$('prjN').value='Java Sea approach';$('prjN').dispatchEvent(new Event('input'))")
    ev("$('ctr').checked=false;$('ctr').dispatchEvent(new Event('change'));$('adp').checked=false;$('adp').dispatchEvent(new Event('change'));if(typeof cstClear=='function')cstClear()")
    setv("depth", 25); ev("o={lat:-5.86,lon:106.82};poly=[];closed=false;draw=false;R.lines=[];R.cross=[];R.turns=[];bath=null;DG=null;rq();typeof fit=='function'&&fit()")
    ev("(()=>{const r=cv.getBoundingClientRect();if(typeof zoomAt=='function'){}})()")
    opensec("setup", "sensor"); ev("window.scrollTo(0,0)"); pg.wait_for_timeout(500)
    ev("__ov.put(900,420)")
    rec.start(); cap(1, "Draw the survey area right on the map"); rec.hold(720)
    click("#bDraw")
    for fx, fy in [(.22, .30), (.70, .22), (.84, .55), (.62, .86), (.26, .78)]: canvas_click(fx, fy)
    click("#bClose"); pg.wait_for_timeout(500); ev("typeof fit=='function'&&fit()"); rec.hold(1280)

    # ---------------------------------------------------------------- 2 every survey type
    cap(2, "One planner: multibeam, single-beam, geophysical or drone")
    pg.wait_for_timeout(400); x, y = to("#svT", 800)
    for v in ["sbes", "geo", "uav", "mbes"]:
        ev("__ov.pulse()"); pg.select_option("#svT", v); pg.wait_for_timeout(1150)
    to("#svG", 500); ev("__ov.pulse()"); rec.hold(720)

    # ---------------------------------------------------------------- 3 bathymetry, adaptive, contour lines
    ev("$('setup')&&0"); opensec("dir")
    cap(3, "Load bathymetry: shaded depths and adaptive line spacing")
    mv(1000, 380, 600); ev(BATH); pg.wait_for_timeout(1200)
    opensec("swath"); scroll("#adp", "center"); click("#adp"); pg.wait_for_timeout(1300); rec.hold(640)
    cap(None, "…or main lines that follow a depth contour")
    opensec("dir"); scroll("#ctr", "center"); click("#ctr"); pg.wait_for_timeout(1600)
    mv(950, 330, 900); rec.hold(1200)

    # ---------------------------------------------------------------- 4 S-44 and uncertainty
    cap(4, "IHO S-44 checks and an a priori uncertainty budget")
    opensec("#tpuC"); scroll("#tpuC", "center"); to("#tpuC", 700, -60, 20); pg.wait_for_timeout(1200)
    click("#tpuUse"); pg.wait_for_timeout(1000)
    ev("document.querySelector('#chk').scrollIntoView({block:'center',behavior:'smooth'})"); pg.wait_for_timeout(1000); to("#chk", 700, -150, -40); rec.hold(1440)

    # ---------------------------------------------------------------- 5 exports
    cap(5, "Export to HYPACK, EIVA, Qinsy, DXF, Shapefile, KML and more")
    opensec("exp"); scroll("details[data-sec=exp]", "start"); pg.wait_for_timeout(300)
    to("details[data-sec=exp] button", 700); pg.wait_for_timeout(300)
    for s in ["#eDxf", "details[data-sec=exp] button:nth-of-type(3)", "details[data-sec=exp] button:nth-of-type(6)"]:
        try: to(s, 500); ev("__ov.pulse()"); pg.wait_for_timeout(350)
        except Exception: pass
    rec.hold(720)

    # ---------------------------------------------------------------- 6 map sheet with contours
    cap(6, "A print-ready map sheet, now with shaded depths and contours")
    url = ev("(async()=>{const op=Object.assign(xo(),{base:false});op.dpi=150;const r=await renderSheet(op,false);const c=document.createElement('canvas'),k=1900/r.cv.width;c.width=1900;c.height=Math.round(r.cv.height*k);c.getContext('2d').drawImage(r.cv,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)})()")
    ev("__ov.hide(1)"); ev("u=>__ov.shot([u],1.12)", url); rec.hold(3360); ev("__ov.noshot();__ov.hide(0)"); pg.wait_for_timeout(500)

    # ---------------------------------------------------------------- 7 coastline
    ev("$('ctr').checked=false;$('ctr').dispatchEvent(new Event('change'));bath=null;DG=null;$('adp').checked=false;$('adp').dispatchEvent(new Event('change'))")
    ev("o={lat:-6.085,lon:106.86};poly=[[-6.118,106.835],[-6.118,106.885],[-6.055,106.885],[-6.055,106.835]].map(q=>fromLL(q[0],q[1]));closed=true;draw=false;gen();typeof fit=='function'&&fit()")
    ev("$('az').value=0;$('az').dispatchEvent(new Event('input'))") if ev("!!$('az')") else None
    setv("trim", False, "change"); opensec("coast"); ev("window.scrollTo(0,0)"); pg.wait_for_timeout(400)
    cap(7, "Lines trimmed to navigable water, turns checked against the coast")
    scroll("#cNE", "center"); click("#cNE", 600); pg.wait_for_timeout(2600); click("#trim", 600); pg.wait_for_timeout(1500)
    ev("window.scrollTo({top:0,behavior:'smooth'})"); pg.wait_for_timeout(700); mv(820, 420, 700); rec.hold(1040)
    pt = ev("(()=>{const i=(typeof TL_BAD!='undefined'&&TL_BAD.length)?TL_BAD[Math.floor(TL_BAD.length/2)]:-1,t=i>=0?R.turns[i]:null;if(!t)return null;const q=sc(t.pts[Math.floor(t.pts.length/2)]),r=cv.getBoundingClientRect(),k=cv.width/r.width;return [r.left+q[0]/k,r.top+q[1]/k]})()")
    if pt:
        mv(pt[0], pt[1], 700)
        for _ in range(5): pg.mouse.wheel(0, -240); pg.wait_for_timeout(220)
        pg.wait_for_timeout(500)
    rec.hold(1600)
    ev("document.querySelector('#chk').scrollIntoView({block:'start',behavior:'smooth'})"); pg.wait_for_timeout(900); to("#chk li.bad", 600, -200, 0) if ev("!!document.querySelector('#chk li.bad')") else None; rec.hold(1200)
    ev("$('cClr')&&$('cClr').click()")

    # ---------------------------------------------------------------- 8 corridor
    load("planner/?type=mbes&shape=corr")
    ev("$('coT').value='-5.95 106.30\\n-5.98 106.55\\n-6.06 106.68\\n-6.20 106.74';$('coImp').click()"); pg.wait_for_timeout(2600)
    ev("typeof fit=='function'&&fit()"); opensec("route"); ev("window.scrollTo(0,0)"); pg.wait_for_timeout(500); ev("__ov.put(880,300)")
    rec.start(); cap(8, "Corridors along a cable or pipeline route, with KP and segments"); rec.hold(1440)
    ev("(()=>{const r=cv.getBoundingClientRect();zoomAt(cv.width*.55,cv.height*.45,3);rq()})()"); pg.wait_for_timeout(600); mv(760, 380, 800); rec.hold(1440)

    # ---------------------------------------------------------------- 9 geophysical
    load("planner/?type=geo&shape=area")
    ev("o={lat:-5.86,lon:106.82};poly=[[-5.885,106.79],[-5.89,106.85],[-5.84,106.86],[-5.835,106.80]].map(q=>fromLL(q[0],q[1]));closed=true;draw=false;gen();typeof fit=='function'&&fit()")
    for g in ["gSS", "gMG", "gSB", "gSE", "gMB"]: ev(f"$('{g}').checked=false;$('{g}').dispatchEvent(new Event('change',{{bubbles:true}}))")
    ev(f"$('gSS').checked=true;$('gSS').dispatchEvent(new Event('change',{{bubbles:true}}))")
    opensec("geo"); pg.wait_for_timeout(600); ev("document.querySelector('details[data-sec=geo]').scrollIntoView({block:'start'})"); ev("__ov.put(300,300)")
    rec.start(); cap(9, "Geophysical spreads: the tightest sensor sets the line spacing"); rec.hold(640)
    for g in ["gMG", "gSB"]: click("#" + g, 650); pg.wait_for_timeout(900)
    mv(900, 380, 800); rec.hold(1040)

    # ---------------------------------------------------------------- 10 drone with terrain
    load("planner/?type=uav&shape=area")
    ev("o={lat:-6.62,lon:106.80};poly=[[-6.628,106.792],[-6.629,106.808],[-6.613,106.809],[-6.612,106.793]].map(q=>fromLL(q[0],q[1]));closed=true;draw=false;gen();typeof fit=='function'&&fit()")
    ev("$('uvPay').value='lidar';$('uvPay').dispatchEvent(new Event('change'));$('uvLid').value='l2';$('uvLid').dispatchEvent(new Event('change'));$('uvH').value=100;$('uvH').dispatchEvent(new Event('input'))")
    opensec("uav"); pg.wait_for_timeout(500); ev("document.querySelector('details[data-sec=uav]').scrollIntoView({block:'start'})"); ev("__ov.put(320,260)")
    rec.start(); cap(10, "Drone camera or LiDAR flights, with terrain following"); rec.hold(800)
    to("#uvLid", 600); rec.hold(400)
    ev("""(()=>{const B=tgBox(),G=tgNodes(B,150,5),c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);
for(let j=0;j<G.ny;j++)for(let i=0;i<G.nx;i++){const p=fromLL(G.la0+j*G.dla,G.lo0+i*G.dlo);G.z[j*G.nx+i]=260+90*Math.exp(-((p[0]-c[0]-300)**2+(p[1]-c[1]+200)**2)/(2*450*450))+35*Math.sin(p[0]/380)}tgSet(G,'terrain model')})()""")
    pg.wait_for_timeout(800)
    try:
        if not ev("$('uvTS').checked"): ev("$('uvTS').checked=true;$('uvTS').dispatchEvent(new Event('change',{bubbles:true}))")
    except Exception: pass
    pg.wait_for_timeout(600); scroll("#uvTP", "center"); to("#uvTP", 800, 0, 0); rec.hold(1600)
    mv(900, 330, 800); rec.hold(960)

    # ---------------------------------------------------------------- 11 infill
    load("infill/")
    setv("depth", 40); pg.wait_for_timeout(400)
    tr = ev("""(()=>{const S=params().S,xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys)-50,y1=Math.max(...ys)+50;let out=[],k=0;
for(let x=x0+S/2;x<x1+S;x+=S,k++){if(k==5||k==6)continue;const yy=k==12?(y0+y1)/2:y1;for(let y=y0;y<=yy;y+=5){const q=toLL([x,y]);out.push('L'+k+','+q[0].toFixed(8)+','+q[1].toFixed(8))}}return out.join('\\n')})()""")
    ev("t=>{$('ifT').value=t}", tr); ev("__ov.put(900,300)")
    rec.start(); cap(11, "Infill planner: find the holidays, plan the lines to fill them"); rec.hold(800)
    to("#ifImp", 700); ev("__ov.pulse()"); ev("$('ifImp').click()"); pg.wait_for_timeout(2400); ev("typeof fit=='function'&&fit()")
    ev("window.scrollTo(0,0)"); mv(860, 380, 800); rec.hold(1760)

    # ---------------------------------------------------------------- 12 guide, science, PDFs
    load("guide/", 1800)
    ev("__ov.put(700,300)")
    rec.start(); cap(12, "User guide and science pages in 22 languages, also as PDF"); rec.hold(960)
    for l in ["id", "ja", "ar"]:
        to("#langSel", 600); ev("__ov.pulse()"); pg.select_option("#langSel", l); pg.wait_for_timeout(1500)
    try: to("#pdfL", 700); ev("__ov.pulse()"); pg.wait_for_timeout(500)
    except Exception: pass
    covers = []
    for l in ["en", "ja", "ar"]:
        p = WORK / f"cov_{l}"; subprocess.run(["pdftoppm", "-r", "70", "-png", "-f", "1", "-l", "1", "-singlefile", str(ROOT / f"docs/pdf/swathplan-guide-{l}.pdf"), str(p)], check=True)
        covers.append("data:image/png;base64," + base64.b64encode((WORK / f"cov_{l}.png").read_bytes()).decode())
    ev("__ov.hide(1)"); ev("u=>__ov.shot(u,1.05)", covers); rec.hold(2400); ev("__ov.nocap()")
    pg.select_option("#langSel", "en")

    # ---------------------------------------------------------------- end card
    rec.stop()
    logo = base64.b64encode((ROOT / "icons/icon-192.png").read_bytes()).decode() if (ROOT / "icons/icon-192.png").exists() else ""
    pg.set_content(f"""<html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d3b45,#0f766e 70%,#14b8a6);font-family:Inter,system-ui,sans-serif;color:#fff">
<div id=c style="text-align:center;opacity:0;transform:translateY(14px);transition:all .9s">{f'<img src="data:image/png;base64,{logo}" style="width:96px;border-radius:22px;margin-bottom:18px">' if logo else ''}
<div style="font:700 64px Inter,system-ui">Swath<span style="color:#ff5fae">Plan</span></div>
<div style="font-size:26px;margin-top:12px;opacity:.92">Plan, check, export, print</div>
<div style="font-size:20px;margin-top:26px;opacity:.85">Free · works offline · 22 languages</div>
<div style="font-size:20px;margin-top:8px;opacity:.85">syahperdana.github.io/swathplan</div></div></body></html>""")
    pg.wait_for_timeout(300); rec.start(); ev("document.getElementById('c').style.opacity=1;document.getElementById('c').style.transform='none'"); pg.wait_for_timeout(1200); rec.hold(3040); rec.stop()
    br.close()

srv.shutdown()
print(f"{len(rec.frames)} frames, {rec.frames[-1][1]:.1f} s; page errors: {errs or 'none'}")
encode(rec.frames, OUT)
print("wrote", OUT)
