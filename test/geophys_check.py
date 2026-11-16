"""Browser check of the geophysical planner: sensor spacing, run-in, tie lines, checks, exports, autosave.

Usage: python3 -I test/geophys_check.py geophys/index.html
"""
import base64, sys, pathlib, math
from playwright.sync_api import sync_playwright
INIT="""window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.arrayBuffer()).then(b=>{let s='';const u=new Uint8Array(b);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));window.__dl.push({n,b:btoa(s)})});return}return _ck.call(this)};"""
bad=[]
def check(c,m):
    print(("ok   " if c else "FAIL ")+m); sys.stdout.flush()
    if not c: bad.append(m)
with sync_playwright() as p:
    br=p.chromium.launch();ctx=br.new_context(viewport={'width':1400,'height':900},locale='en-US',timezone_id='UTC')
    ctx.route(lambda u: not u.startswith('file:'), lambda r: r.abort());ctx.add_init_script(INIT)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:(errs.append('dialog: '+d.message),d.dismiss()))
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri()+'?type=geo&shape=area');pg.wait_for_timeout(2500);pg.evaluate("setLang('en')")
    set_=lambda d:pg.evaluate("d=>{for(const k in d){const e=$(k);if(e.type=='checkbox')e.checked=d[k];else e.value=d[k];e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}}",d) or pg.wait_for_timeout(400)
    S=lambda:pg.evaluate("params().S");drv=lambda:pg.evaluate("params().geo.drv?params().geo.drv.k:null")
    set_({'gSS':True,'gSR':75,'gSC':'200','gSO':10,'gMG':False,'gSB':False,'gSE':False,'gMB':False,'gLB':0,'gEX':0,'gTI':0})
    check(abs(S()-67.5)<1e-9 and drv()=='sss',f"SSS 75 m, 200 %, 10 %: spacing {S()} (expect 67.5)")
    set_({'gSC':'100'});check(abs(S()-135)<1e-9,f"SSS 100 %: spacing {S()} (expect 135)")
    chk=pg.evaluate("$('chk').innerText");check('nadir gap' in chk,"100 % coverage warns about the nadir gap")
    set_({'gSC':'200','spd':8});chk=pg.evaluate("$('chk').innerText");check('above the side-scan limit' in chk,"8 kn flagged above the 6.5 kn side-scan limit")
    set_({'spd':5})
    set_({'gMG':True,'gMA':3,'gMD':8});exp=2*math.sqrt(64-9)
    check(abs(S()-exp)<1e-9 and drv()=='mag',f"MAG 8 m detection at 3 m height drives: {S():.3f} (expect {exp:.3f})")
    set_({'gMD':2});chk=pg.evaluate("$('chk').innerText");check(drv()=='sss' and 'cannot be found' in chk,"MAG detection below height: flagged, SSS drives again")
    set_({'gMG':False,'gSE':True,'gES':25,'gEL':300,'gLB':40,'gEX':10})
    g=pg.evaluate("({ri:params().geo.runIn,ro:params().geo.runOut,k:params().geo.drv.k})");check(g['k']=='uhr' and g['ri']==150+40+10 and g['ro']==150+10,f"seismic drives; run-in {g['ri']} (expect 200), run-out {g['ro']} (expect 160)")
    raw=pg.evaluate("(()=>{const q=params(),az=g('az'),u=[Math.sin(az*D),Math.cos(az*D)],tv=poly.map(p=>p[0]*u[0]+p[1]*u[1]);return Math.max(...tv)-Math.min(...tv)})()")
    ln=pg.evaluate("Math.max(...R.lines.map(l=>L(l)))");check(abs(ln-(raw+360))<1,f"longest line {ln:.1f} = area length {raw:.1f} + 360 m extension")
    gaps=pg.evaluate("R.turns.map((t,i)=>{const A=R.lines[i],B=R.lines[i+1];return Math.hypot(t.pts[0][0]-A.b[0],t.pts[0][1]-A.b[1])+Math.hypot(t.pts[t.pts.length-1][0]-B.a[0],t.pts[t.pts.length-1][1]-B.a[1])})")
    check(max(gaps)<1e-6,"turns start at each line end and finish at the next line start")
    set_({'gTI':400});n=pg.evaluate("R.cross.length");check(n==math.floor(raw/400)+1 or n==math.floor(raw/400),f"tie lines every 400 m: {n} over {raw:.0f} m")
    set_({'gSE':False,'gMB':True});check(drv()=='mbes' or drv()=='sss',f"multibeam joins the spread, driver: {drv()}")
    check(pg.evaluate("$('W').textContent")==pg.evaluate("f1(params().mbW)"),"multibeam block still shows the multibeam swath")
    # exports and sheet
    pg.evaluate("$('crs').value='utm';$('crs').dispatchEvent(new Event('change'))")
    def grab(js):
        pg.evaluate("window.__dl=[]");pg.evaluate(js);pg.wait_for_timeout(1500);return [(d['n'],base64.b64decode(d['b'])) for d in pg.evaluate("window.__dl")]
    outs={}
    for b in ['eEiva','eLnx','eDxf','eShp','eQin','rep']:
        for n_,d in grab(f"$('{b}').click()"): outs[n_]=d
    for n_,d in grab("$('xpFmt').value='png';$('xpImg').click()"): outs[n_]=d
    check(len(outs)>=7,f"exports and sheet: {sorted(outs)}")
    # autosave separate
    pg.wait_for_timeout(1500);pg.reload();pg.wait_for_timeout(2500)
    check(pg.evaluate("$('gMB').checked&&$('gTI').value=='400'"),"settings restored after reload")
    check(pg.evaluate("$('svT').value")=='geo' and 'swp_state' in pg.evaluate("Object.keys(localStorage)"),"survey type and settings kept in the planner autosave")
    # geophysical survey along a route: towed layback lengthens the start of every corridor line
    pg.evaluate("$('svG').value='corr';$('svG').dispatchEvent(new Event('change'))");pg.wait_for_timeout(800)
    n=pg.evaluate("R.lines.length");check(n>0 and pg.evaluate("!!CO.P"),f"geophysical corridor: {n} lines along the route")
    secs=pg.evaluate("[...document.querySelectorAll('details[data-sec]')].filter(d=>!d.closest('[hidden]')).map(d=>d.dataset.sec)")
    check('geo' in secs and 'route' in secs and 'bound' not in secs and 'dir' not in secs,f"geophysical corridor sections {secs}")
    lb=pg.evaluate("g('gLB')");L1=pg.evaluate("L({a:R.lines[0].a,b:R.lines[0].b,p:R.lines[0].p})")
    pg.evaluate("$('gLB').value=0;$('gLB').dispatchEvent(new Event('input'))");pg.wait_for_timeout(300)
    L0=pg.evaluate("L({a:R.lines[0].a,b:R.lines[0].b,p:R.lines[0].p})")
    check(lb>0 and abs(L1-L0-lb)<0.5,f"layback adds the run-in to corridor lines ({L1-L0:.1f} m for {lb} m)")
    check(pg.evaluate("R.turns.length")==pg.evaluate("R.lines.length")-1,"turns redone between corridor lines")
    # side-scan list: 20 models, every option has a frequency and range, saved values of the first list still exist
    ev=pg.evaluate
    opts=ev("[...$('gSM').querySelectorAll('option[data-f]')].map(o=>[o.value,+o.dataset.f,+o.dataset.r,o.parentElement.label])")
    check(len(opts)>=40 and len({o[3] for o in opts})>=20 and all(o[1]>0 and o[2]>0 for o in opts),f"{len({o[3] for o in opts})} side-scan models, {len(opts)} frequencies, each with a range per side")
    check(all(v in [o[0] for o in opts] for v in ['EdgeTech 4125|400','EdgeTech 4200|300','EdgeTech 4200|600','Klein 3900|445','Klein 4900|900']),"saved side-scan values of the earlier list still match")
    ev("$('gSM').value='EdgeTech 4205|120';$('gSM').dispatchEvent(new Event('change'))");pg.wait_for_timeout(300)
    check(ev("g('gSR')")==600,"EdgeTech 4205 at 120 kHz sets 600 m per side")
    check(not errs,f"no page errors {errs[:3]}")
    br.close()
print("FAILED" if bad else "ALL OK"); sys.exit(1 if bad else 0)
