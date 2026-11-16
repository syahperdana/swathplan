"""Relief on the map sheet: shaded depths (or drone terrain), colour scale and contours in every export
python3 -I test/relief_check.py planner/index.html (GMRT mocked)"""
import sys,os,re,math,json,urllib.parse
from playwright.sync_api import sync_playwright
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html')
bad=[]
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
def depth(la,lo):return 15+40*abs(math.sin((la+6.03)*60))+20*(lo-106.8)*10
def gmrt(route):
    q=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(route.request.url).query));w,e,s,n=(float(q[k]) for k in ['minlongitude','maxlongitude','minlatitude','maxlatitude']);cs=float(q['mresolution'])/111320
    nx=max(2,round((e-w)/cs));ny=max(2,round((n-s)/cs))
    route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*'},body=f"ncols {nx}\nnrows {ny}\nxllcorner {w}\nyllcorner {s}\ncellsize {cs}\n"+"\n".join(" ".join(f"{-depth(n-(j+.5)*cs,w+(i+.5)*cs):.2f}" for i in range(nx)) for j in range(ny))+"\n")
HILL=open(os.path.join(os.path.dirname(__file__),'terrain_check.py')).read().split('HILL="""')[1].split('"""')[0]
SHEET="(async()=>{const op=xo();op.base=false;op.dpi=100;const r=await renderSheet(op,false);r.cv.width=0;return REL_LAST})()"
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US');c.route(re.compile('gmrt'),gmrt);c.route(lambda u: not u.startswith('file:') and 'gmrt' not in u, lambda r: r.abort())
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f+'?type=mbes&shape=area');pg.wait_for_timeout(2500);pg.evaluate("setLang('en')")
    ev=pg.evaluate
    ok(ev(SHEET)==None,'no depths loaded: no relief on the sheet')
    ev("$('gbSrc').value='gmrt';$('gbB').click()");pg.wait_for_function("bath&&bath.src=='GMRT'",timeout=60000);pg.wait_for_timeout(1000)
    R=ev(SHEET)
    ok(R and R['kind']=='depth' and R['step']>0,f"depths: shaded grid with contours every {R and R['step']} m")
    span=R['zmax']-R['zmin'];ok(3<=span/R['step']<=14,f"contour interval suits the range ({R['zmin']:.0f}–{R['zmax']:.0f} m): {span/R['step']:.1f} intervals")
    # zoomed in (larger scale): a finer interval
    ev("$('xpScale').value=5000");R2=ev(SHEET);ev("$('xpScale').value=0")
    ok(R2 and R2['step']<R['step'],f"larger scale, finer interval: {R2 and R2['step']} m at 1:5000")
    ev("$('xpCtr').checked=false");ok(ev(SHEET)['step']==0,'contours can be turned off');ev("$('xpCtr').checked=true")
    ev("$('xpSnd').checked=false");ok(ev(SHEET)==None,'depths can be left off the sheet');ev("$('xpSnd').checked=true")
    ev("$('sbS').checked=false");ok(ev(SHEET)==None,'with the shaded background off, soundings are drawn as dots (old style)');ev("$('sbS').checked=true")
    sv=ev("(async()=>{const op=xo();op.base=false;const r=await renderSheet(op,false,true);return [(r.svg.match(/<image/g)||[]).length,r.svg.includes('data:image/png')]})()")
    ok(sv[0]>=2 and sv[1],'SVG carries the shaded grid as an image')
    # the shaded grid on the sheet matches the map's colours: sample the sheet canvas inside the area
    px=ev("""(async()=>{const op=xo();op.base=false;op.dpi=60;const r=await renderSheet(op,true);const L=r.L,k=r.u||r.cv.width/L.fr[2],c=r.cv.getContext('2d');const d=c.getImageData(Math.round(r.cv.width*.3),Math.round(r.cv.height*.5),1,1).data;r.cv.width=0;return[...d]})()""")
    ok(px[2]>px[0]+30,f'map frame shows blue depth shading {px[:3]}')
    # drone: the terrain, with elevation contours, and the sheet rows for a drone
    ev("$('svT').value='uav';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(800);ev(f"({HILL})(80,300)");pg.wait_for_timeout(800)
    R=ev(SHEET)
    ok(R and R['kind']=='elev' and abs(R['zmin']-50)<1 and abs(R['zmax']-130)<1 and R['step']>0,f"drone: terrain 50–130 m with contours every {R and R['step']} m")
    ok(ev("$('uvTM').checked"),'terrain shown on the map by default')
    ok(ev("window.SWP_UAVSHEET")==True,'drone sheet: flight height instead of design depth, no turn radius or IHO order')
    ev("setLang('de')");pg.wait_for_timeout(300);ok(ev("i18('Ground elevation (m)')")=='Geländehöhe (m)','legend translated');ev("setLang('en')")
    ok(not e,f'no page errors {e[:3]}')
    b.close()
print("FAILED" if bad else "ALL OK");sys.exit(1 if bad else 0)
