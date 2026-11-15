"""Browser check of the corridor planner: route import, layouts, every export, .SPL round trip, autosave.

Usage: python3 -I test/corridor_check.py corridor/index.html mbes/index.html
"""
import base64, json, re, sys, pathlib
from playwright.sync_api import sync_playwright
def log(*a): print(*a); sys.stdout.flush()
INIT="""window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.arrayBuffer()).then(b=>{let s='';const u=new Uint8Array(b);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));window.__dl.push({n,b:btoa(s)})});return}return _ck.call(this)};"""
with sync_playwright() as p:
    br=p.chromium.launch();ctx=br.new_context(viewport={'width':1400,'height':900},locale='en-US',timezone_id='UTC')
    ctx.route(lambda u: not u.startswith('file:'), lambda r: r.abort());ctx.add_init_script(INIT)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:(errs.append('dialog: '+d.message),d.dismiss()))
    U=pathlib.Path(sys.argv[1]).resolve().as_uri()
    pg.goto(U);pg.wait_for_timeout(2500);pg.evaluate("setLang('en')")
    # a bending cable route near Jakarta Bay (lat, lon pasted)
    route="-6.0500, 106.7000\n-6.0450, 106.7300\n-6.0300, 106.7500\n-6.0320, 106.7800\n-6.0100, 106.8000"
    pg.evaluate("v=>{$('coT').value=v;$('coHW').value=150;$('coExt').value=50;$('coXI').value=500;$('coKP0').value=12.345}",route)
    pg.evaluate("$('coImp').click()");pg.wait_for_timeout(1500)
    log('import:',pg.evaluate("$('coImpSt').textContent"))
    log('status:',pg.evaluate("$('coSt').textContent"),'|',pg.evaluate("$('coLn').textContent"))
    info=pg.evaluate("""({names:R.lines.map(l=>l.name),pts:R.lines.map(l=>l.p.length),len:R.lines.map(l=>Math.round(L(l))),cross0:R.cross[0]&&R.cross[0].name,crossN:R.cross.length,turns:R.turns.map(t=>t.ty)})""")
    log('lines:',info)
    pg.evaluate("fit();rq()");pg.wait_for_timeout(600);pg.screenshot(path='/tmp/cor_bend.png')
    # fixed offsets
    pg.evaluate("$('coMode').value='fixed';$('coMode').dispatchEvent(new Event('change'));$('coOff').value='0, ±50, ±100, ±150';$('coOff').dispatchEvent(new Event('input'))")
    log('fixed:',pg.evaluate("R.lines.map(l=>l.name).join(' ')"))
    # exports
    def grab(js):
        pg.evaluate("window.__dl=[]");pg.evaluate(js);pg.wait_for_timeout(700);return [(d['n'],base64.b64decode(d['b'])) for d in pg.evaluate("window.__dl")]
    pg.evaluate("$('crs').value='utm';$('crs').dispatchEvent(new Event('change'))")
    outs={}
    for b in ['eEiva','eLnx','eDxf','eKml','eGj','eShp','eQin','coKPx','coRln']:
        for n,d in grab(f"$('{b}').click()"): outs[n]=d
    for v in pg.evaluate("[...$('xfmt').options].map(o=>o.value)"):
        for n,d in grab(f"$('xfmt').value='{v}';$('xBtn').click()"): outs[n]=d
    log('exports:',len(outs),sorted(outs))
    rln=outs['survey_runlines.rln'].decode();blocks=re.split(r'\r\n(?=")',rln.strip())
    log('RLN lines:',len(blocks),'| first:',blocks[0].split('\r\n')[0],'rows',len(blocks[0].split('\r\n'))-1,'| last KP of line 1:',blocks[0].split('\r\n')[-1].split(',')[-1])
    lnx=outs['survey_plan.lnx'].decode();log('LNX first line pts:',lnx.split('<LINE>')[1].count('<PT '))
    kp=outs['route_kp_table.csv'].decode().strip().split('\n');log('KP table rows:',len(kp)-1,'|',kp[0],'|',kp[1],'|',kp[-1])
    rr=outs['route_kp.rln'].decode().split('\r\n');log('route RLN:',rr[0],rr[1],'...',rr[-2])
    gj=json.loads(outs['survey_plan.geojson']);log('GeoJSON features:',len(gj['features']),'| first line coords:',len(gj['features'][1]['geometry']['coordinates']))
    q=outs['survey_lines.qgfline'];log('Qinsy size:',len(q),'magic ok:',q[:4]==bytes([0x81,0x51,0x47,0x46]))
    # SPL round trip
    spl=grab("$('spSave').click()")[0][1].decode();log('SPL has ROUTE:', '[ROUTE]' in spl, '| route pts:', len(re.search(r'\[ROUTE\]([\s\S]*?)\n\[',spl).group(1).strip().split('\n'))-1)
    import tempfile;SPL=tempfile.mktemp(suffix='.spl');open(SPL,'w').write(spl)
    pg.evaluate("$('bClr').click()");log('after clear lines:',pg.evaluate('R.lines.length'))
    pg.set_input_files('#spImp',SPL);pg.wait_for_timeout(1500)
    log('after SPL open:',pg.evaluate("RT.length"),pg.evaluate("$('coSt').textContent"))
    # reverse
    k=pg.evaluate("R.cross.map(x=>x.name).slice(0,2)");pg.evaluate("$('coRev').click()");log('reverse: cross before',k,'after',pg.evaluate("R.cross.map(x=>x.name).slice(0,2)"))
    pg.evaluate("$('coRev').click()")
    # autosave kept separately from the MBES planner
    pg.wait_for_timeout(1500);pg.reload();pg.wait_for_timeout(2500)
    log('after reload:',pg.evaluate("RT.length"),pg.evaluate("$('coSt').textContent"),'| mode:',pg.evaluate("$('coMode').value"))
    keys=pg.evaluate("Object.keys(localStorage)");log('storage keys:',keys)
    pg.goto(pathlib.Path(sys.argv[2]).resolve().as_uri());pg.wait_for_timeout(2500)
    log('MBES page: lines',pg.evaluate("R.lines.length"),'has route var:',pg.evaluate("typeof RT"))
    log('errors:',errs)
    br.close()
