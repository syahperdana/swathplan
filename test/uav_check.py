"""Drone (photogrammetry) mode checks: python3 -I test/uav_check.py planner/index.html"""
import sys,json,os
from playwright.sync_api import sync_playwright
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html')
INIT="""window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({n,t}));return}return _ck.call(this)};"""
bad=[]
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US');c.route(lambda u: not u.startswith('file:'), lambda r: r.abort());c.add_init_script(INIT)
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f+'?type=uav&shape=area');pg.wait_for_timeout(2500);pg.evaluate("setLang('en')")
    ev=pg.evaluate
    ok(ev("$('spd').parentElement.id")=='uvSpd','speed input moves into the drone section')
    ok(all(ev(f"!!document.querySelector('details[data-sec={k}]').hidden") for k in ['turn','iho','coast']),'vessel sections hidden')
    ev("$('uvCam').value='m3e';$('uvCam').dispatchEvent(new Event('change'));$('uvH').value=100;$('uvFO').value=75;$('uvSO').value=65;$('spd').value=19.44;$('spd').dispatchEvent(new Event('input'))");pg.wait_for_timeout(500)
    ok(ev("$('uvGsd').textContent")=='2.66 cm/px','GSD 2.66 cm/px for the Mavic 3E at 100 m')
    ok(abs(ev("params().S")-100*17.3/12.3*.35)<.01,'line spacing = footprint x (1 - side overlap)')
    ok(ev("$('uvPh').textContent").startswith('26.4 m'),'photo distance = along footprint x (1 - forward overlap)')
    ok(ev("[...new Set(R.turns.map(t=>t.ty))].join()")=='u','tight turns between lines')
    ev("$('uvH').value=150;$('uvH').dispatchEvent(new Event('input'))");pg.wait_for_timeout(400)
    ok('above 120 m' in ev("$('chk').innerText"),'height warning above 120 m')
    ev("$('uvH').value=100;$('uvFO').value=95;$('uvMI').value=2;$('uvH').dispatchEvent(new Event('input'))");pg.wait_for_timeout(400)
    ok('faster than the camera allows' in ev("$('chk').innerText"),'photo interval warning')
    ev("$('uvFO').value=75;$('uvMI').value=0.7;$('uvH').dispatchEvent(new Event('input'))");pg.wait_for_timeout(400)
    ev("window.__dl=[];$('eQgc').click()");pg.wait_for_timeout(600);it=json.loads(ev("window.__dl[0].t"))['mission']['items']
    ok(it[0]['params'][6]==100 and [x['params'][0] for x in it if x['command']==206]==[26.42,0],'QGroundControl plan: height and camera trigger on/off')
    ok([x['doJumpId'] for x in it]==list(range(1,len(it)+1)),'QGroundControl item numbering')
    ev("window.__dl=[];$('eMp').click()");pg.wait_for_timeout(600);mp=ev("window.__dl[0].t").split('\n')
    ok(mp[2].split('\t')[10]=='100' and mp[3].split('\t')[3]=='206','Mission Planner: height and camera trigger')
    ok(ev("SWP_SHEET_TITLE")=='DRONE FLIGHT PLAN','sheet title')
    ev("$('svT').value='mbes';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(600)
    ok(ev("$('spd').closest('details').dataset.sec")=='iho' and ev("$('spd').value")=='6','back to multibeam: speed returns with the vessel value')
    ok(ev("$('slow').checked") and ev("$('svpI').value")=='4','vessel settings untouched')
    ev("window.__dl=[];$('eQgc').click()");pg.wait_for_timeout(600);it=json.loads(ev("window.__dl[0].t"))['mission']['items']
    ok(all(x['command']==16 and x['params'][6]==0 for x in it),'multibeam waypoint export unchanged')
    ok(not e,'no page errors '+str(e));b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED');sys.exit(1 if bad else 0)
