"""Equipment lists (side-scan models, single-beam transducers): python3 -I test/equipment_check.py planner/index.html"""
import sys,os
from playwright.sync_api import sync_playwright
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html');bad=[]
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US');c.route(lambda u: not u.startswith('file:'), lambda r: r.abort())
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f+'?type=geo&shape=area');pg.wait_for_timeout(2500);ev=pg.evaluate;ev("setLang('en')")
    ok(ev("$('gSM').value")=='custom' and ev("$('gSMn').hidden"),'custom by default, no note')
    ev("$('gSM').value='Klein 3900|900';$('gSM').dispatchEvent(new Event('change'))");pg.wait_for_timeout(400)
    ok(ev("$('gSR').value")=='50','choosing a model sets the range to its maximum at that frequency')
    ok(abs(ev("params().S")-2*50/2*0.9)<.01,'spacing follows the new range')
    ok(ev("SWP_SENSORROW()[1]")=='Side-scan sonar (Klein 3900, 900 kHz)','sheet and report name the model')
    pg.fill('#gSR','80');pg.wait_for_timeout(300)
    ok('warn' in ev("$('gSMn').className") and '80 m' in ev("$('gSMn').textContent"),'warning when the range is beyond the frequency')
    ev("setLang('de')");pg.wait_for_timeout(300)
    ok(ev("$('gSM').selectedOptions[0].textContent")=='900 kHz, bis 50 m je Seite','options follow the language')
    ev("setLang('en')");pg.wait_for_timeout(1500);pg.reload();pg.wait_for_timeout(2500)
    ok(ev("$('gSM').value")=='Klein 3900|900' and ev("$('gSR').value")=='80','choice and range restored after a reload')
    ev("$('svT').value='sbes';$('svT').dispatchEvent(new Event('change'))");pg.wait_for_timeout(500)
    ev("$('sbM').value='3';$('sbM').dispatchEvent(new Event('change'))");pg.wait_for_timeout(300)
    ok(ev("$('sbBW').value")=='3','single-beam transducer sets the beam width')
    pg.fill('#sbBW','5');pg.wait_for_timeout(300)
    ok(ev("$('sbM').value")=='custom','typing a beam width switches to custom')
    ok(not e,'no page errors '+str(e));b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED');sys.exit(1 if bad else 0)
