"""Long corridors exported per segment: python3 -I test/segment_sheets_check.py planner/index.html"""
import sys,os,io,re,base64,zipfile
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
f=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'planner/index.html');bad=[]
INIT="""window.__dl=[];window.open=()=>null;const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.arrayBuffer()).then(b=>{let s='';const u=new Uint8Array(b);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));window.__dl.push({n,b:btoa(s)})});return}return _ck.call(this)};"""
def ok(c,m):
    print(('ok   ' if c else 'FAIL ')+m)
    if not c:bad.append(m)
def dl(pg,click,wait=120000):
    pg.evaluate("window.__dl=[]");pg.evaluate(click);pg.wait_for_function("window.__dl.length>0",timeout=wait);pg.wait_for_timeout(300)
    d=pg.evaluate("window.__dl[0]");return d['n'],base64.b64decode(d['b'])
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1400,'height':900},locale='en-US');c.route(lambda u: not u.startswith('file:'), lambda r: r.abort());c.add_init_script(INIT)
    pg=c.new_page();e=[];pg.on('pageerror',lambda x:e.append(str(x)));pg.goto('file://'+f+'?type=mbes&shape=corr');pg.wait_for_timeout(2500);ev=pg.evaluate;ev("setLang('en')")
    ev("$('coT').value='-6.05 106.40\\n-6.05 106.70\\n-6.25 106.80';$('coImp').click()");pg.wait_for_timeout(2500);ev("$('xpBase').checked=false")
    ok('3 segments' in ev("$('coSt').textContent") and not ev("$('xpSegW').hidden") and ev("$('xpSegs').value")=='seg','58 km route: 3 segments, per-segment sheets offered and chosen')
    n,bt=dl(pg,"$('xpFmt').value='pdfmap';$('xpImg').click()");ok(len(PdfReader(io.BytesIO(bt)).pages)==4,'PDF map sheet: overview + 3 segment pages in one file')
    n,bt=dl(pg,"$('xpPdf').click()");rep=len(PdfReader(io.BytesIO(bt)).pages)
    S=ev("sheetOps(xo()).map(s=>[s.label,s.sheetNo])");ok(S[0][0].startswith('Overview') and S[2]==['Segment 2, KP 19.950 to 40.050','Sheet 3 of 4'],'sheet labels and numbers')
    L1=ev("sheetLayout(xo()).D");L2=ev("sheetLayout(sheetOps(xo())[2]).D");ok(L2<L1,f'segment sheets are drawn at a larger scale (1:{L2} vs 1:{L1})')
    n,bt=dl(pg,"$('xpFmt').value='png';$('xpImg').click()");z=zipfile.ZipFile(io.BytesIO(bt)).namelist()
    ok(n.endswith('_sheets.zip') and len(z)==4 and any('segment_03.png' in x for x in z),'images: one per sheet, together in a zip')
    n,bt=dl(pg,"$('xpFmt').value='pngw';$('xpImg').click()");z=zipfile.ZipFile(io.BytesIO(bt)).namelist()
    ok(len(z)==12 and sum(x.endswith('.pgw') for x in z)==4,'georeferenced images: each with its world file and .prj')
    n,bt=dl(pg,"$('eDxf').click()");t=bt.decode();ly=set(re.findall(r'\n8\n([^\n]+)\n',t))
    ok({'line_S01','line_S03','cross_S02','turn_S02','segments','boundary'}<=ly and 'line' not in ly,'DXF: each segment on its own layers')
    ok(re.findall(r'\nVIEW\n2\n(\w+)',t)==['SEG01','SEG02','SEG03'] and t.index('TABLES')<t.index('ENTITIES'),'DXF: a named view per segment')
    ev("$('xpSegs').value='all'")
    n,bt=dl(pg,"$('xpFmt').value='pdfmap';$('xpImg').click()");ok(len(PdfReader(io.BytesIO(bt)).pages)==1,'whole-route choice: one sheet as before')
    n,bt=dl(pg,"$('xpPdf').click()");ok(len(PdfReader(io.BytesIO(bt)).pages)==rep-3,'whole-route choice: report has the single sheet')
    n,bt=dl(pg,"$('xpFmt').value='png';$('xpImg').click()");ok(n=='survey_plan_sheet.png','whole-route choice: a single image')
    ev("$('coSeg').value=0;$('coSeg').dispatchEvent(new Event('input'))");pg.wait_for_timeout(800);ok(ev("$('xpSegW').hidden"),'no split: the choice is hidden')
    n,bt=dl(pg,"$('eDxf').click()");t=bt.decode();ok('TABLES' not in t and 'line_S' not in t,'no split: DXF as before')
    ev("$('svG').value='area';$('svG').dispatchEvent(new Event('change'))");pg.wait_for_timeout(800);ok(ev("$('xpSegW').hidden"),'area survey: the choice is hidden')
    ok(not e,'no page errors '+str(e));b.close()
print('ALL OK' if not bad else f'{len(bad)} FAILED');sys.exit(1 if bad else 0)
