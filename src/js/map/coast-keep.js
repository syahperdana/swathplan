/* ===== coastline offline: the built-in Natural Earth coastline for land avoidance, and the loaded coastline in .SPL files.
   Between sessions the coastline is kept in IndexedDB by offline-maps.js; this file keeps that copy in step (open, remove). ===== */
const CK_MAX=2e7;// characters of encoded coastline written to a .SPL file
let CK_MSG="",CK_C=null;// the loaded coastline's description; cache of its encoded form
function ckEnc(pts){let s="",pa=0,po=0;const w=v=>{v=v<0?~(v<<1):v<<1;while(v>=32){s+=String.fromCharCode((32|(v&31))+63);v>>=5}s+=String.fromCharCode(v+63)};
for(const p of pts){const la=Math.round(p[1]*1e5),lo=Math.round(p[0]*1e5);w(la-pa);w(lo-po);pa=la;po=lo}return s}
function ckDec(s){const a=[];let i=0,la=0,lo=0;const rd=()=>{let r=0,sh=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32&&i<=s.length);return r&1?~(r>>1):r>>1};
while(i<s.length){la+=rd();lo+=rd();a.push([lo/1e5,la/1e5])}return a}
// the loaded coastline, encoded once per load: {m:"lines"|"polys", msg, l:[encoded…]} or null; big:true when too large to keep
function ckPack(){if(!cst||!cst.seg||!cst.seg.length)return null;if(CK_C&&CK_C.ref===cst)return CK_C.v;
const P=cst.mode=="polys",l=(P?cst.polys:cst.lines).map(ckEnc),n=l.reduce((s,x)=>s+x.length,0),v=n>CK_MAX?{big:true}:{m:P?"polys":"lines",msg:CK_MSG,l};CK_C={ref:cst,v};return v}
function ckKeptNote(){const k=ckPack();return !k?"":k.big?" "+i18("Too large to keep with the project: save it as GeoJSON and load the file next time."):" "+i18("Kept with the project, so it works offline.")}
function ckRestore(k){if(!k||!Array.isArray(k.l)){cst={lines:[],polys:[],seg:null,mode:""};CK_MSG="";$("cSt").textContent=i18("No coastline loaded.");ckForget();return}
const L=k.l.map(ckDec).filter(x=>x.length>1),P=k.m=="polys";CK_MSG=String(k.msg||"");cst={lines:P?[]:L,polys:P?L:[],seg:null,mode:P?"polys":"lines"};projC();
try{IDB.set(IDK("coast"),{l:P?[]:L,p:P?L:[],msg:CK_MSG}).catch(()=>{})}catch(e){}
$("cSt").textContent=i18("{0} ({1} segments)",CK_MSG||i18("Coastline"),cst.seg.length/4)+ckKeptNote()}
// every way of loading goes through setCst: remember the description, keep it, say so
{const _set=setCst;setCst=function(l,p,msg){CK_MSG=msg;_set(l,p,msg);$("cSt").textContent+=ckKeptNote();saveSoon()}}
const ckForget=()=>{try{IDB.del(IDK("coast")).catch(()=>{})}catch(e){}};
{const _clr=$("cClr").onclick;$("cClr").onclick=function(){_clr.apply(this,arguments);CK_MSG="";ckForget();saveSoon()}}
// built-in coastline (Natural Earth 1:50m, in the page): closed rings turned counter-clockwise so land is on the left, as in OSM; cut to the area
$("cNE").onclick=async()=>{if(!closed)return $("cSt").textContent=i18("Close an area first.");$("cSt").textContent=i18("Loading…");const N10=await neLoad10(),N=N10||neLoad();if(!N)return;
const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),m=Math.max(10000,g("clr")*5),lo=toLL([Math.min(...xs)-m,Math.min(...ys)-m]),hi=toLL([Math.max(...xs)+m,Math.max(...ys)+m]),
a0=Math.min(lo[0],hi[0]),a1=Math.max(lo[0],hi[0]),o0=Math.min(lo[1],hi[1]),o1=Math.max(lo[1],hi[1]),inB=(la,ln)=>la>=a0&&la<=a1&&ln>=o0&&ln<=o1,out=[];
if(N10){
// 1:10m land polygons: each ring cut to the box (Sutherland-Hodgman); a point inside a ring is land, whatever its direction
const clip=(R,inside,cut)=>{const o=[];for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length],pi=inside(p),qi=inside(q);if(pi)o.push(p);if(pi!=qi)o.push(cut(p,q))}return o};
const E=[[p=>p[0]>=o0,(p,q)=>[o0,p[1]+(q[1]-p[1])*(o0-p[0])/(q[0]-p[0])]],[p=>p[0]<=o1,(p,q)=>[o1,p[1]+(q[1]-p[1])*(o1-p[0])/(q[0]-p[0])]],
[p=>p[1]>=a0,(p,q)=>[p[0]+(q[0]-p[0])*(a0-p[1])/(q[1]-p[1]),a0]],[p=>p[1]<=a1,(p,q)=>[p[0]+(q[0]-p[0])*(a1-p[1])/(q[1]-p[1]),a1]]];
N.forEach(l=>{if(l.a1<a0||l.a0>a1||l.o1<o0||l.o0>o1)return;let R=[];for(let k=0;k<l.a.length;k+=2)R.push([l.a[k+1],l.a[k]]);
if(R.length>1&&R[0][0]==R[R.length-1][0]&&R[0][1]==R[R.length-1][1])R.pop();for(const[f,c]of E){R=clip(R,f,c);if(R.length<3)return}out.push(R.concat([R[0]]))})}
else{
const area=a=>{let s=0;for(let k=0;k<a.length-2;k+=2)s+=a[k+1]*a[k+2]-a[k+3]*a[k];return s/2};
N.forEach(l=>{if(l.a1<a0||l.a0>a1||l.o1<o0||l.o0>o1)return;let a=l.a;const n=a.length;
if(Math.abs(a[0]-a[n-2])<.0015&&Math.abs(a[1]-a[n-1])<.0015&&area(a)<0){const r=[];for(let k=n-2;k>=0;k-=2)r.push(a[k],a[k+1]);a=r}
let run=[];const flush=()=>{if(run.length>1)out.push(run);run=[]};
for(let k=0;k<n;k+=2){const on=inB(a[k],a[k+1]),prevOn=k>0&&inB(a[k-2],a[k-1]),nextOn=k+2<n&&inB(a[k+2],a[k+3]);
if(on||prevOn||nextOn)run.push([a[k+1],a[k]]);else flush()}flush()});
}
setCst(N10?[]:out,N10?out:[],!out.length?i18("No built-in coastline in this area (open water or inland)"):N10?i18("Built-in coastline loaded: Natural Earth 1:10m land, {0} land areas here. Accurate to a few hundred metres: good for offshore and coastal planning, not for harbours or close inshore work.",out.length):i18("Built-in coastline loaded: {0} lines. It is Natural Earth 1:50m, accurate to about 1 km: fine for keeping offshore lines off land, not for inshore work.",out.length)+" "+i18("The detailed 1:10m file (data/coast10m.js) was not found next to this page."))};
// save the loaded coastline as a file, to keep or to load elsewhere
$("cSave").onclick=()=>{if(!cst||!cst.seg||!cst.seg.length)return $("cSt").textContent=i18("No coastline loaded.");const P=cst.mode=="polys";
const fc={type:"FeatureCollection",features:(P?cst.polys:cst.lines).map(c=>({type:"Feature",properties:{source:CK_MSG},geometry:P?{type:"Polygon",coordinates:[c]}:{type:"LineString",coordinates:c}}))};
save("coastline.geojson",JSON.stringify(fc),"application/geo+json")};
// .SPL ([COASTLINE]: kind, note, then one encoded polyline per line after "p "; older versions skip the section). A parsed file always
// has st.coast (null when it has none), so opening a project replaces the coastline; the autosave and share links do not carry it.
{const _apply=applyState;applyState=function(st){const r=_apply.apply(this,arguments);if(st&&"coast" in st){ckRestore(st.coast);gen()}return r}}
{const _t=splText;splText=function(){const k=ckPack();if(!k||k.big)return _t();
const c=["[COASTLINE]","# coastline kept with the project: Google encoded polylines (1e-5 deg, latitude first), lon/lat rings or lines","kind = "+k.m,"note = "+escS(k.msg)].concat(k.l.map(x=>"p "+x),["",""]).join("\n");
return _t().replace("\n[SETTINGS]\n","\n"+c+"[SETTINGS]\n")}}
{const _p=splParse;splParse=function(txt){const st=_p(txt),m=String(txt).match(/\[COASTLINE\]([\s\S]*?)(?:\n\[|$)/);st.coast=null;
if(m){const L=m[1].split(/\r?\n/),kd=(L.find(x=>/^\s*kind\s*=/.test(x))||"").split("=")[1],nt=L.find(x=>/^\s*note\s*=/.test(x));
st.coast={m:/polys/.test(kd||"")?"polys":"lines",msg:nt?unescS(nt.slice(nt.indexOf("=")+1).replace(/^ /,"")):"",l:L.filter(x=>/^p /.test(x)).map(x=>x.slice(2).replace(/\r$/,""))}}return st}}
// start: offline-maps.js brings the coastline back from IndexedDB; pick up its description and say it is kept
setTimeout(async()=>{try{const c=await IDB.get(IDK("coast"));setTimeout(()=>{if(c&&cst.seg&&cst.seg.length){CK_MSG=c.msg||"";$("cSt").textContent+=ckKeptNote()}},400)}catch(e){}},0);
