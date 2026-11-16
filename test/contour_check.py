"""Contour-following lines: main lines parallel to a depth contour of the loaded bathymetry.
python3 -I test/contour_check.py planner/index.html [infill/index.html]"""
import sys,os,json,time
from playwright.sync_api import sync_playwright
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html');fi=os.path.abspath(sys.argv[2]) if len(sys.argv)>2 else None
INIT="""window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({n,t}));return}return _ck.call(this)};"""
# a 6 x 4 km area on a seabed sloping north, with isobaths that wave east-west
SETUP="""o={lat:-8.5,lon:115.2};poly=[[-3000,-2000],[3000,-2000],[3000,2000],[-3000,2000]];closed=true;draw=false;
const B={la:[],lo:[],z:[],bad:0,zmin:1e30,zmax:-1e30};for(let x=-5000;x<=5000;x+=100)for(let y=-4000;y<=4000;y+=100){const d=20+0.006*(y+600*Math.sin(x/1500));const ll=toLL([x,y]);B.la.push(ll[0]);B.lo.push(ll[1]);B.z.push(d);B.zmin=Math.min(B.zmin,d);B.zmax=Math.max(B.zmax,d)}
bath=B;DG=null;analyse();gen()"""
bad=[]
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
ON="$('ctr').checked=true;$('ctr').dispatchEvent(new Event('change'))"
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US');c.route(lambda u: not u.startswith('file:'), lambda r: r.abort());c.add_init_script(INIT)
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f);pg.wait_for_timeout(2500);ev=pg.evaluate;ev("setLang('en')")
    ok(not ev("$('ctrBox').hidden") and not ev("$('ctr').checked"),'the option is in Line direction, off by default')
    ev(SETUP);n0=ev("R.lines.length");ok(not ev("R.lines.some(l=>l.p)"),'off: straight lines as before')
    t=time.time();ev(ON);dt=time.time()-t
    ok(ev("!!R.ctr") and 'Lines follow the 25.0 m contour' in ev("$('ctrSt').textContent"),'on: lines follow the design-depth contour, status says so')
    ok(dt<3,f'plan time {dt:.2f} s')
    ok(ev("R.lines.every(l=>l.p&&l.p.length>2&&l.a===l.p[0]&&l.b===l.p[l.p.length-1])"),'lines are bent polylines with matching ends')
    ok(ev("R.lines.every(l=>l.p.every(q=>ctrPip(poly,q)||Math.abs(q[0])>2999||Math.abs(q[1])>1999))"),'lines stay inside the area')
    # isobaths at 25 m run along y = 833 - 600 sin(x/1500): the line on the contour holds the depth within half a metre
    ok(ev("R.lines.some(l=>{const z=l.p.map(q=>20+0.006*(q[1]+600*Math.sin(q[0]/1500)));return Math.min(...z)>24.5&&Math.max(...z)<25.5&&L(l)>5000})"),'the line on the contour stays within 0.5 m of 25 m depth')
    sp=ev("(()=>{const A=R.lines.filter(l=>l.row===10)[0],B=R.lines.filter(l=>l.row===11)[0];const m=A.p[Math.floor(A.p.length/2)];let d=1e9;for(let i=1;i<B.p.length;i++)d=Math.min(d,tlPS(B.p[i-1][0],B.p[i-1][1],B.p[i][0],B.p[i][1],m));return [d,params().S]})()")
    ok(abs(sp[0]-sp[1])<0.05*sp[1],f'neighbouring lines are one spacing apart ({sp[0]:.1f} m vs {sp[1]:.1f} m)')
    ok(ev("(()=>{const X=(a,b,c,d)=>{const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0};for(let i=0;i+1<R.lines.length;i++){const A=R.lines[i].p,B=R.lines[i+1].p;for(let j=1;j<A.length;j++)for(let k=1;k<B.length;k++)if(X(A[j-1],A[j],B[k-1],B[k]))return false}return true})()"),'neighbouring lines never cross')
    ok(ev("R.turns.length==R.lines.length-1 && R.turns.filter(t=>t.ty!='t').length>=R.lines.length*0.8"),'serpentine order with Williamson/U-turns between rows')
    ok(ev("R.cross.length")==2 and ev("R.cross.every(l=>!l.p)"),'cross lines stay straight')
    ev("$('ctrD').value=30;$('ctrD').dispatchEvent(new Event('input'))");pg.wait_for_timeout(900)
    ok('30.0 m contour' in ev("$('ctrSt').textContent"),'a chosen contour depth is used')
    ev("$('ctrD').value=500;$('ctrD').dispatchEvent(new Event('input'))");pg.wait_for_timeout(900)
    ok(not ev("!!R.ctr") and ev("R.lines.length")==n0 and 'Depths in the area: 4.4 to 35.0 m' in ev("$('ctrSt').textContent"),'a depth outside the area falls back to straight lines and gives the depth range')
    ev("$('ctrD').value=0;$('ctrD').dispatchEvent(new Event('input'))");pg.wait_for_timeout(900)
    # exports carry the bent lines
    ev("window.__dl=[];$('eDxf').click()")
    pg.wait_for_timeout(800);dl=ev("window.__dl.map(d=>[d.n,d.t.length,(d.t.match(/VERTEX/g)||[]).length])")
    ok(dl and any(x[2]>100 for x in dl),'DXF export writes the bent lines as polylines '+str(dl[:1]))
    # kept in the autosave and .SPL
    n=ev("R.lines.length");pg.reload();pg.wait_for_timeout(3500)
    ok(ev("$('ctr').checked") and ev("!!R.ctr") and ev("R.lines.length")==n,'the option and the plan come back after a reload')
    t2=ev("splText()");ok('ctr' in t2,'.SPL file carries the option')
    # geophysical survey: run-in and run-out lengthen the bent lines, turns follow
    ev("$('svT').value='geo';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(1200)
    ev("$('gEX').value=100;$('gEX').dispatchEvent(new Event('input',{bubbles:true}));$('gEX').dispatchEvent(new Event('change',{bubbles:true}))");pg.wait_for_timeout(1000)
    ok(ev("!!R.ctr && R.lines.length>10 && R.lines.every(l=>l.p) && R.turns.length==R.lines.length-1"),'geophysical survey uses the contour lines')
    ev("$('svT').value='sbes';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(1200)
    ok(ev("!!R.ctr && R.lines.length>10"),'single-beam survey uses the contour lines')
    ev("$('svT').value='uav';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(1200)
    ok(ev("$('ctrBox').hidden") and not ev("!!R.ctr"),'drones: option hidden, straight lines')
    ev("$('svT').value='mbes';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(1200)
    # coastline: lines cut to water
    ev("setCst([[[115.25,-8.51],[115.15,-8.51]]],[],'test coastline')");pg.wait_for_timeout(1500)
    yc=ev("fromLL(-8.51,115.2)[1]")
    ok(ev("!!R.ctr && R.lines.length>10") and ev(f"R.lines.every(l=>l.p.every(q=>q[1]>={yc}+g('clr')-1))"),'with a coastline and trimming, lines stop at the clearance from the coast')
    ev("$('cClr').click()");pg.wait_for_timeout(600)
    # no bathymetry
    ev("bath=null;DG=null;gen()");pg.wait_for_timeout(500)
    ok(not ev("!!R.ctr") and 'Load bathymetry first' in ev("$('ctrSt').textContent"),'without bathymetry: straight lines and a note')
    ok(not e,'no page errors '+str(e))
    if fi:
        pi=c.new_page();e2=[];pi.on('pageerror',lambda x:e2.append(str(x)));pi.goto('file://'+fi);pi.wait_for_timeout(2500)
        ok(pi.evaluate("$('ctrBox').hidden") and not e2,'infill page: option hidden '+str(e2))
    b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED');sys.exit(1 if bad else 0)
