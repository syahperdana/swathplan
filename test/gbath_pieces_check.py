"""Global bathymetry over a long corridor, with the services mocked: python3 -I test/gbath_pieces_check.py planner/index.html
GMRT and EMODnet are fetched in pieces near the route only, NOAA NCEI as points near the route; a piece that comes back
cut short is reported and not read as zero depth."""
import sys,os,json,math,urllib.parse,struct
from playwright.sync_api import sync_playwright
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html')
bad=[]
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
REQ={'gmrt':[],'ncei':0}
def depth(la,lo):return 20+10*math.sin(la*7)+5*math.cos(lo*5)
def gmrt(route):
    q=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(route.request.url).query));w,e,s,n=(float(q[k]) for k in ['minlongitude','maxlongitude','minlatitude','maxlatitude'])
    cs=float(q['mresolution'])/111320;nx=max(2,round((e-w)/cs));ny=max(2,round((n-s)/cs));REQ['gmrt'].append((w,e,s,n))
    rows=[" ".join(f"{-depth(n-(j+.5)*cs,w+(i+.5)*cs):.2f}" for i in range(nx)) for j in range(ny)]
    if len(REQ['gmrt'])==3:rows=rows[:ny//3]      # the third piece is cut short
    route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*'},body=f"ncols {nx}\nnrows {ny}\nxllcorner {w}\nyllcorner {s}\ncellsize {cs}\nnodata_value -99999\n"+"\n".join(rows)+"\n")
def ncei(route):
    body=dict(urllib.parse.parse_qsl(route.request.post_data));pts=json.loads(body['geometry'])['points'];REQ['ncei']+=len(pts)
    route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'samples':[{'locationId':i,'value':str(-depth(p[1],p[0]))} for i,p in enumerate(pts)]}))
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US')
    import re
    c.route(re.compile(r'gmrt\.org'),gmrt);c.route(re.compile(r'ngdc\.noaa\.gov'),ncei);c.route(lambda u: not u.startswith('file:') and 'gmrt.org' not in u and 'ngdc.noaa.gov' not in u, lambda r: r.abort())
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f+'?type=mbes&shape=corr');pg.wait_for_timeout(2500);pg.evaluate("setLang('en')")
    ev=pg.evaluate
    # a 330 km diagonal route
    route="-6.0, 106.7\n-5.2, 107.4\n-4.6, 108.0\n-4.0, 108.6"
    ev("v=>{$('coT').value=v;$('coHW').value=500;$('coXI').value=0}",route);ev("$('coImp').click()");pg.wait_for_timeout(3000)
    ok(ev("closed&&poly.length>3"),'corridor built')
    ev("$('gbSrc').value='gmrt';$('gbRes').value='100';$('gbB').click()");pg.wait_for_timeout(15000)
    st=ev("$('gbSt').textContent");n=len(REQ['gmrt'])
    W,E,S,N=106.7,108.6,-6.0,-4.0;box=(E-W)*(N-S);got=sum((q[1]-q[0])*(q[3]-q[2]) for q in REQ['gmrt'])
    ok(2<=n<=40,f'GMRT fetched in {n} pieces')
    ok(got<0.5*box,f'only pieces near the route: {got:.2f} of {box:.2f} square degrees of the box')
    ok('1 of' in st and 'cut short' in st and ev("$('gbLink').innerHTML").count('gmrt.org')==1,'the cut-short piece is reported, with a link')
    ok(ev("bath.z.every(z=>z>0)") and ev("bath.z.length")>20000,f"{ev('bath.z.length')} depth values, none read as zero from the cut-short piece")
    # depths along the route, every 5 km: a value within 1 km, except in the cut-short piece
    far=ev("""(()=>{const R=RT.map(q=>fromLL(q[0],q[1])),P=bath.la.map((la,i)=>fromLL(la,bath.lo[i])),cells=new Map(),k=(x,y)=>Math.floor(x/1000)+','+Math.floor(y/1000);
    P.forEach(p=>{const q=k(p[0],p[1]);if(!cells.has(q))cells.set(q,[]);cells.get(q).push(p)});let miss=0,tot=0;
    for(let i=1;i<R.length;i++){const a=R[i-1],b=R[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let s=0;s<L;s+=5000){const x=a[0]+(b[0]-a[0])*s/L,y=a[1]+(b[1]-a[1])*s/L;tot++;let f=false;
    for(let dx=-1;dx<=1&&!f;dx++)for(let dy=-1;dy<=1&&!f;dy++)for(const p of cells.get((Math.floor(x/1000)+dx)+','+(Math.floor(y/1000)+dy))||[])if(Math.hypot(p[0]-x,p[1]-y)<1000){f=true;break}if(!f)miss++}}return[miss,tot]})()""")
    ok(far[0]<=far[1]*0.25 and far[1]>=60,f'depths along the route: {far[1]-far[0]} of {far[1]} points every 5 km have a value within 1 km')
    # NOAA NCEI: points near the route only
    ev("$('gbSrc').value='ncei';$('gbB').click()");pg.wait_for_timeout(15000)
    ok('NOAA NCEI' in ev("$('gbSt').textContent") and 1000<REQ['ncei']<=12000,f"NCEI: {REQ['ncei']} points near the route")
    nf=ev("""(()=>{const R=RT.map(q=>fromLL(q[0],q[1]));let mx=0;bath.la.forEach((la,i)=>{const p=fromLL(la,bath.lo[i]);let d=1e18;for(let j=1;j<R.length;j++){const a=R[j-1],b=R[j],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(a[0]+t*dx-p[0],a[1]+t*dy-p[1]))}mx=Math.max(mx,d)});return mx})()""")
    ok(nf<5000,f'NCEI points all within {nf/1000:.1f} km of the route')
    ok(not e,f'no page errors {e[:3]}')
    # drone mode: the header shows the flight height, not the depth
    ev("$('svT').value='uav';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(800)
    ok(ev("!$('hDh').hidden&&$('hDd').hidden&&$('hD').textContent")=='100 m','drone: header shows Height: 100 m')
    ev("$('svT').value='mbes';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(800)
    ok(ev("$('hDh').hidden&&!$('hDd').hidden&&$('hD').textContent.endsWith(' m')"),'multibeam: header shows Depth again')
    ev("setLang('id')");pg.wait_for_timeout(300)
    ok(ev("$('hDd').textContent")!='Depth:','header label translated')
    b.close()
print("FAILED" if bad else "ALL OK");sys.exit(1 if bad else 0)
