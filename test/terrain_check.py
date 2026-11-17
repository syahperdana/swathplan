"""Drone terrain following: python3 -I test/terrain_check.py planner/index.html"""
import sys,json,os,tempfile
from playwright.sync_api import sync_playwright
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html')
INIT="""window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({n,t}));return}return _ck.call(this)};"""
bad=[]
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
# a synthetic terrain: 50 m plain with an 80 m high hill (sigma 300 m) at the area centre
HILL="""(h,s)=>{const B=tgBox(),G=tgNodes(B,150,5),c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);
for(let j=0;j<G.ny;j++)for(let i=0;i<G.nx;i++){const p=fromLL(G.la0+j*G.dla,G.lo0+i*G.dlo);G.z[j*G.nx+i]=50+h*Math.exp(-((p[0]-c[0])**2+(p[1]-c[1])**2)/(2*s*s))}tgSet(G,'test hill')}"""
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US');c.route(lambda u: not u.startswith('file:'), lambda r: r.abort());c.add_init_script(INIT)
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f+'?type=uav&shape=area');pg.wait_for_timeout(2500);pg.evaluate("setLang('en')")
    ev=pg.evaluate
    ev("$('uvPay').value='cam';$('uvPay').dispatchEvent(new Event('change'));$('uvCam').value='m3e';$('uvCam').dispatchEvent(new Event('change'));$('uvH').value=100;$('uvH').dispatchEvent(new Event('input'))");pg.wait_for_timeout(500)
    ok(not ev("$('uvTF').checked") and ev("tgPlan()")==None and ev("SWP_UAV.wp")==None,'no terrain: terrain following off, exports unchanged')
    ok(ev("$('uvTG').textContent")=='-','no terrain: no ground shown')
    ev("window.__dl=[];$('eQgc').click()");pg.wait_for_timeout(500);base=json.loads(ev("window.__dl[0].t"))['mission']['items']
    ev(f"({HILL})(80,300)");pg.wait_for_timeout(600)
    P=ev("(()=>{const P=tgPlan();return{amin:P.amin,amax:P.amax,gmin:P.gmin,gmax:P.gmax,n:P.K.length,nw:P.W.length,z0:P.z0,hi:P.hi}})()")
    ok(ev("$('uvTF').checked") and 'test hill' in ev("$('uvTSt').textContent"),'loading a terrain turns terrain following on')
    ok(P['amin']>=99.4,f"never closer than the flight height to the terrain: {P['amin']:.1f} m minimum")
    ok(P['amax']<140,f"height above ground stays near the flight height: up to {P['amax']:.1f} m")
    ok(P['gmax']-P['gmin']>60,f"ground along the lines {P['gmin']:.0f} to {P['gmax']:.0f} m")
    ok(P['n']<P['nw'],f"waypoints dropped where the ground is even: {P['n']} of {P['nw']}")
    ok(abs(P['hi']-(100+P['gmax']-P['z0']))<15,f"highest waypoint {P['hi']:.0f} m above take-off")
    chk=ev("$('chk').innerText")
    ok('Terrain following: the drone stays' in chk,'plan check: terrain following summary')
    ok('<svg' in ev("$('uvTP').innerHTML") and ev("$('uvTW').textContent").startswith(str(P['n'])+' · '),'profile and waypoint count shown')
    ev("window.__dl=[];$('eQgc').click()");pg.wait_for_timeout(500);it=json.loads(ev("window.__dl[0].t"))['mission']['items']
    hs=[x['params'][6] for x in it if x['command']==16]
    ok(len(hs)==P['n'] and max(hs)-min(hs)>50 and [x['params'][0] for x in it if x['command']==206]==[base[1]['params'][0],0],f'QGroundControl: {len(hs)} waypoints with heights {min(hs)} to {max(hs)} m, camera trigger kept')
    ev("window.__dl=[];$('eMp').click()");pg.wait_for_timeout(500);mp=[r.split('\t') for r in ev("window.__dl[0].t").strip().split('\n')[2:]]
    mh=[float(r[10]) for r in mp if r[3]=='16']
    ok(mh==hs,'Mission Planner: the same heights')
    # a valley: the drone goes down into it instead of flying straight over
    ev(f"({HILL})(-40,250)");pg.wait_for_timeout(500)
    ok(ev("tgPlan().amax")<112 and ev("tgPlan().amin")>=99.4,f"valley: height above ground {ev('tgPlan().amin'):.1f} to {ev('tgPlan().amax'):.1f} m")
    # flat ground: the waypoints are the line ends again
    ev(f"({HILL})(0,300)");pg.wait_for_timeout(500)
    ok(ev("tgPlan().K.length")==ev("wpts().length") and abs(ev("tgPlan().amax")-100)<.01,'flat ground: same waypoints as without terrain, at the flight height')
    # fixed height over the hill
    ev(f"({HILL})(80,300)");ev("$('uvTF').checked=false;$('uvH').value=50;$('uvTF').dispatchEvent(new Event('change'))");pg.wait_for_timeout(500)
    ok('The terrain rises' in ev("$('chk').innerText") and ev("SWP_UAV.wp")==None,'fixed height: warns when the hill rises above the flight altitude; exports at one height')
    ev("$('uvH').value=100;$('uvH').dispatchEvent(new Event('input'))");pg.wait_for_timeout(400)
    ok('height above ground varies' in ev("$('chk').innerText"),'fixed height: warns that the height above ground varies')
    ev("$('uvTO').value=0;$('uvTO').dispatchEvent(new Event('input'))");pg.wait_for_timeout(400)
    ok(abs(ev("tgPlan().amin")+30)<1 and 'rises 30 m' in ev("$('chk').innerText"),'take-off elevation 0 m: the 50 m plain and the hill are above the flight altitude')
    ev("$('uvTO').value='';$('uvTF').checked=true;$('uvTF').dispatchEvent(new Event('change'))");pg.wait_for_timeout(400)
    # LiDAR: slant range checked where the drone is highest above the ground
    ev("$('uvPay').value='lidar';$('uvPay').dispatchEvent(new Event('change'));$('uvLid').value='wingtra';$('uvLid').dispatchEvent(new Event('change'));$('uvH').value=60;$('uvH').dispatchEvent(new Event('input'))");pg.wait_for_timeout(500)
    ok(ev("SWP_UAV.trig")==0 and ev("SWP_UAV.wp.length")>2,'LiDAR: terrain heights, no camera trigger')
    ev("$('uvPay').value='cam';$('uvPay').dispatchEvent(new Event('change'))");pg.wait_for_timeout(300)
    # an ESRI ASCII file in lat/lon: a constant 200 m plateau
    B=ev("tgBox()");nx,ny=40,40;dx=(B['lo1']-B['lo0'])/(nx-1)
    asc=f"ncols {nx}\nnrows {ny}\nxllcorner {B['lo0']-dx/2}\nyllcorner {B['la0']-dx/2}\ncellsize {dx}\nNODATA_value -9999\n"+"\n".join(" ".join("200" for _ in range(nx)) for _ in range(int((B['la1']-B['la0'])/dx)+2))+"\n"
    asc=asc.replace(f"nrows {ny}",f"nrows {int((B['la1']-B['la0'])/dx)+2}")
    fn=os.path.join(tempfile.mkdtemp(),'plateau.asc');open(fn,'w').write(asc)
    ev("$('uvTS').value='file'");pg.set_input_files('#uvTFile',fn);pg.wait_for_timeout(1200)
    ok('plateau.asc' in ev("$('uvTSt').textContent") and abs(ev("tgPlan().gmin")-200)<.01 and abs(ev("tgPlan().gmax")-200)<.01,'ESRI ASCII elevation file: ground 200 m')
    # the area moved away from the loaded terrain
    ev("const q=poly.map(p=>[p[0]+50000,p[1]]);poly=q;gen()");pg.wait_for_timeout(500)
    ok('outside the terrain model' in ev("$('chk').innerText") and ev("SWP_UAV.wp")==None,'area away from the terrain: warned, exports at one height')
    # language and other modes
    ev("setLang('de')");pg.wait_for_timeout(400);ev("setLang('en')")
    ev("$('svT').value='mbes';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(600)
    ok(ev("window.SWP_UAV")==None and ev("tgPlan()")==None and 'Terrain following' not in ev("$('chk').innerText"),'multibeam mode: no terrain heights or checks')
    ok(not e,f'no page errors {e[:3]}')
    b.close()
print("FAILED" if bad else "ALL OK");sys.exit(1 if bad else 0)
