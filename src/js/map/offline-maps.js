/* ===== offline maps: your map file, saved tiles, shaded bathymetry, data kept between sessions ===== */
const WEB=/^https?:$/.test(location.protocol),TILES_CACHE="swp-tiles",SAVE_LIMIT=3000;
const mb=b=>{const m=b/1048576;return(m<10?m.toFixed(1):Math.round(m))+" MB"};

// ---- your map file (PMTiles) -------------------------------------------------------------
let pmInfo=null;const pmStatus=()=>{$("pmSt").textContent=pmInfo&&PM?i18("Map file: {0}, zoom {1}–{2}.",pmInfo.name,PM.h.minZ,PM.h.maxZ)+(pmInfo.kept?" "+i18("Kept in the app for offline use."):""):""};
async function pmTile(z,x,y){if(!PM)return null;const b=await PM.get(z,x,y);return b?new Blob([b],{type:PM.mime}):null}
async function opfs(){try{return navigator.storage&&navigator.storage.getDirectory?await navigator.storage.getDirectory():null}catch(e){return null}}
async function pmUse(file,name,choose){const pm=await pmOpen((o,l)=>file.slice(o,o+l).arrayBuffer());PM=pm;
for(const u in TC)if(u.startsWith("pmtiles:"))delete TC[u];
pmInfo={name,kept:false};pmStatus();$("pmDel").hidden=false;
if(choose){$("bm").value="pmtiles";pmShow();if(!closed&&pm.h.cLat){reorigin(pm.h.cLat,pm.h.cLon);V.cx=V.cy=0;V.k=cv.width/5000}}rq();return pm}
const pmShow=()=>{$("pmBox").hidden=$("bm").value!="pmtiles";saCheck()};
$("bm").addEventListener("change",pmShow);
$("pmF").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
try{await pmUse(f,f.name,true)}catch(x){$("pmSt").textContent=x.message;return}
const base=$("pmSt").textContent,d=await opfs();if(!d){$("pmSt").textContent=base+" "+i18("Open the file again next time: this browser cannot keep it.");return}
try{const est=navigator.storage.estimate?await navigator.storage.estimate():{};if(est.quota&&est.quota-est.usage<f.size*1.05)throw new Error(i18("Not enough storage space to keep the map file."));
$("pmSt").textContent=base+" "+i18("Saving the map file in the app…");
const fh=await d.getFileHandle("basemap.pmtiles",{create:true}),w=await fh.createWritable();await f.stream().pipeTo(w);
try{localStorage.setItem("swp_pm",f.name)}catch(x){}try{navigator.storage.persist&&navigator.storage.persist()}catch(x){}
pmInfo.kept=true;pmStatus();tcShow()}
catch(x){$("pmSt").textContent=base+" "+(x&&x.message&&!/createWritable|not a function/i.test(x.message)?x.message:i18("Open the file again next time: this browser cannot keep it."))}};
$("pmDel").onclick=async()=>{PM=null;pmInfo=null;for(const u in TC)if(u.startsWith("pmtiles:"))delete TC[u];$("pmSt").textContent="";$("pmDel").hidden=true;
try{const d=await opfs();if(d)await d.removeEntry("basemap.pmtiles")}catch(e){}try{localStorage.removeItem("swp_pm")}catch(e){}rq();tcShow()};
(async()=>{const d=await opfs();if(!d)return;try{const f=await(await d.getFileHandle("basemap.pmtiles")).getFile();if(!f.size)return;
let n="basemap.pmtiles";try{n=localStorage.getItem("swp_pm")||n}catch(e){}await pmUse(f,n,false);pmInfo.kept=true;pmStatus()}catch(e){}})();

// ---- saved tiles (kept by the service worker as you view them) ----------------------------
async function tcShow(){if(!WEB||!window.caches)return;try{const n=(await(await caches.open(TILES_CACHE)).keys()).length;
let t=i18("Saved map tiles: {0}",n);if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();t+=" · "+i18("Offline storage used: {0}",mb(e.usage||0))}$("tcSt").textContent=t}catch(e){}}
$("tcClr").onclick=async()=>{try{await caches.delete(TILES_CACHE)}catch(e){}tcShow();rq()};
const zs=[];for(let z=3;z<=19;z++)zs.push(z);["saZ0","saZ1"].forEach((id,k)=>{const s=$(id);zs.forEach(z=>s.add(new Option(String(z),z)));s.value=k?16:12;s.addEventListener("change",saCheck)});
function saTiles(z0,z1){const P=closed&&poly.length>2?poly:[wc(0,cv.height),wc(cv.width,0)],xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),
mx=(arrMax(xs)-arrMin(xs))*.1+200,my=(arrMax(ys)-arrMin(ys))*.1+200,
sw=toLL([arrMin(xs)-mx,arrMin(ys)-my]),ne=toLL([arrMax(xs)+mx,arrMax(ys)+my]),L=[];
for(let z=z0;z<=z1;z++){const n=2**z,X=lo=>Math.floor((lo+180)/360*n),Y=la=>Math.floor((1-Math.log(Math.tan(la*D)+1/Math.cos(la*D))/Math.PI)/2*n);
const x0=X(sw[1]),x1=X(ne[1]),y0=Math.max(0,Y(ne[0])),y1=Math.min(n-1,Y(sw[0]));
if((x1-x0+1)*(y1-y0+1)+L.length>SAVE_LIMIT*4)return{n:Infinity,L};for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)L.push([((x%n)+n)%n,y,z])}return{n:L.length,L}}
let saRun=null;
function saCheck(){if(saRun)return;const url=$("bm").value=="custom"?$("bmU").value.trim():"";$("saGo").disabled=!url;
if(!url){$("saSt").textContent=i18("Choose Custom tile URL in the basemap list and enter its address first.");return}
let z0=+$("saZ0").value,z1=+$("saZ1").value;if(z1<z0)[z0,z1]=[z1,z0];const r=saTiles(z0,z1);
$("saSt").textContent=r.n>SAVE_LIMIT?i18("That is {0} tiles. Choose a smaller zoom range or area (limit {1}).",isFinite(r.n)?r.n:"> "+SAVE_LIMIT*4,SAVE_LIMIT):i18("{0} tiles, about {1} MB.",r.n,Math.max(1,Math.round(r.n*.02)))}
["bmU"].forEach(i=>$(i).addEventListener("input",saCheck));
$("saGo").onclick=async()=>{if(saRun){saRun.stop=true;return}const t=$("bmU").value.trim();if(!t||!window.caches)return;
let z0=+$("saZ0").value,z1=+$("saZ1").value;if(z1<z0)[z0,z1]=[z1,z0];const r=saTiles(z0,z1);if(r.n>SAVE_LIMIT)return saCheck();
const c=await caches.open(TILES_CACHE),run=saRun={stop:false};$("saGo").textContent=i18("Cancel");let done=0,fail=0,ok=0,i=0;
const one=async([x,y,z])=>{const u=tileURL(t,x,y,z);try{if(await c.match(u,{ignoreVary:true})){ok++;return}const res=await fetch(u,{mode:"cors"});if(!res.ok)throw 0;
const h=new Headers(res.headers);h.set("x-swp-saved",String(Date.now()));await c.put(u,new Response(await res.blob(),{status:200,headers:h}));ok++}catch(e){fail++}};
const worker=async()=>{while(!run.stop&&i<r.L.length){const k=r.L[i++];await one(k);done++;if(done%10==0||done==r.L.length)$("saSt").textContent=i18("Saving tiles: {0} of {1}…",done,r.L.length);
if(done>=8&&ok==0){run.stop=true;run.cors=true}}};
await Promise.all([worker(),worker(),worker(),worker()]);saRun=null;$("saGo").textContent=i18("Save area");
$("saSt").textContent=run.cors?i18("This tile server does not allow saving tiles."):i18("Saved {0} tiles for offline use ({1} failed).",ok,fail);tcShow();rq()};
if(WEB&&window.caches){$("offBox").hidden=false;tcShow()}else $("offNo").hidden=false;

// ---- built-in world coastline (Natural Earth 1:50m), drawn under the tiles ----
let NE=null,NE10=null,NE10p=null;
// encoded polylines (lat, lon x q) -> [{a:[lat,lon,…], bounding box}]
function neDec(str,q){return str.split(" ").map(s=>{const a=[];let i=0,la=0,lo=0;const rd=()=>{let r=0,sh=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);return r&1?~(r>>1):r>>1};
while(i<s.length){la+=rd();lo+=rd();a.push(la/q,lo/q)}let a0=90,a1=-90,o0=360,o1=-360;for(let k=0;k<a.length;k+=2){a0=Math.min(a0,a[k]);a1=Math.max(a1,a[k]);o0=Math.min(o0,a[k+1]);o1=Math.max(o1,a[k+1])}return{a,a0,a1,o0,o1}})}
function neLoad(){if(NE||typeof COAST_NE!="string")return NE;NE=neDec(COAST_NE,1e3);return NE}
// Natural Earth 1:10m: a separate file (data/coast10m.js, 1.7 MB), loaded when first needed; null when it is not there (a page saved on its own)
function neLoad10(){if(NE10)return Promise.resolve(NE10);if(NE10p)return NE10p;
NE10p=new Promise(res=>{const done=()=>{if(typeof window.COAST_NE10=="string"){NE10=neDec(window.COAST_NE10,1e4);window.COAST_NE10=null}if(!NE10)NE10p=null;res(NE10)};
if(typeof window.COAST_NE10=="string")return done();const s=document.createElement("script");s.src=new URL("../data/coast10m.js",location.href).href;s.onload=done;s.onerror=()=>{NE10p=null;res(null)};document.head.append(s)});return NE10p}
let neDrawn=false;
function drawNE(){neDrawn=false;if(typeof noTiles!="undefined"&&noTiles)return;const ck=document.getElementById("neC");if(ck&&!ck.checked)return;
const tl=toLL(wc(0,0)),br=toLL(wc(cv.width,cv.height)),dl=Math.abs(tl[0]-br[0]);
// zoomed in to a few degrees: the 1:10m coastline (loaded once, then redrawn); farther out, or until it arrives: 1:50m
if(dl<8&&!NE10&&!NE10p)neLoad10().then(r=>{if(r)rq()});const L=dl<8&&NE10?NE10:neLoad();if(!L)return;
const m=dl*.2+.05,la0=Math.min(tl[0],br[0])-m,la1=Math.max(tl[0],br[0])+m,lo0=Math.min(tl[1],br[1])-2*m,lo1=Math.max(tl[1],br[1])+2*m;
if(dl>70)return;// the local map frame is for survey areas, not whole oceans
const r=DPR();cx.save();cx.strokeStyle="#8a6d3b";cx.lineWidth=1.1*r;cx.globalAlpha=.85;cx.beginPath();
L.forEach(l=>{if(l.a1<la0||l.a0>la1||l.o1<lo0||l.o0>lo1)return;for(let k=0;k<l.a.length;k+=2){const s=sc(fromLL(l.a[k],l.a[k+1]));k?cx.lineTo(s[0],s[1]):cx.moveTo(s[0],s[1])}neDrawn=true});
cx.stroke();cx.restore()}
const _neTiles=drawTiles;drawTiles=function(){if(lyOn("lyBase"))drawNE();return _neTiles.apply(this,arguments)};
{const ck=document.getElementById("neC");if(ck)ck.addEventListener("change",rq)}

// ---- map source label ------------------------------------------------------------------------
let _ms="";
function mapSrc(){const b=$("bm").value,P=[];
if(b=="pmtiles")P.push(PM?i18("Your map file"):i18("No map file loaded"));
else if(b!="none")P.push(navigator.onLine===false?(tileOK?i18("Offline: saved map tiles"):i18("Offline: no saved tiles here")):i18("Online map"));
if(neDrawn&&(b=="none"||(navigator.onLine===false&&!tileOK)||(b=="pmtiles"&&!PM)))P.push(i18("World coastline"));if(bath&&$("sb").checked&&$("sbS").checked)P.push(i18("Bathymetry"));
const s=P.join(" + "),e=$("mapSrc");if(s!==_ms){_ms=s;e.textContent=s;e.hidden=!s}
const hd=$("hud");e.style.bottom=(innerWidth<=700&&hd&&hd.offsetParent?hd.offsetHeight+16:30)+"px"}
// texts written by this module follow a language change (setLang is defined later, so wrap it after load)
setTimeout(()=>{if(typeof setLang!="function")return;const _sl=setLang;setLang=function(){const r=_sl.apply(this,arguments);try{_ms="";mapSrc();pmStatus();tcShow();saCheck()}catch(e){}try{if(bath)analyse()}catch(e){}return r}},0);
addEventListener("online",()=>{rq();tcShow()});addEventListener("offline",rq);

// ---- shaded bathymetry -------------------------------------------------------------------------
// The depth points are turned once into a shaded image (coloured by the chosen scale, lit from the north-west), which is
// then just scaled on screen: smooth to pan. On the map the image follows the data's own spacing (a 0.5 m grid shows its
// 0.5 m cells) up to 4096 pixels a side and 12 million pixels; the sheet asks for a smaller one. One image is kept per size.
const BSC=new Map();
function hsl2rgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return[f(0)*255,f(8)*255,f(4)*255]}
function bathShade(Nmax){Nmax=Nmax||4096;const pal=($("bPal")||{}).value||"rainbow",key=Nmax+":"+pal;let c=BSC.get(key);if(c&&c.b===bath)return c;if(BSC.size&&[...BSC.values()][0].b!==bath)BSC.clear();
c=bathShadeBuild(Nmax,pal);BSC.set(key,c);return c}
function bathShadeBuild(Nmax,pal){const B=bath,n=B.z.length;let a0=90,a1=-90,o0=360,o1=-360;
for(let i=0;i<n;i++){const la=B.la[i],lo=B.lo[i];if(la<a0)a0=la;if(la>a1)a1=la;if(lo<o0)o0=lo;if(lo>o1)o1=lo}
if(!(a1>a0&&o1>o0))return{b:B,N:Nmax,c:null};
const mx=(o1-o0)*111320*Math.cos((a0+a1)/2*D),my=(a1-a0)*111132.9,asp=mx/my;
// pixel size: the point spacing when known (one pixel per grid cell), otherwise from the number of points
let W,H;if(B.res>0){const px=Math.max(B.res,Math.max(mx,my)/Nmax,Math.sqrt(mx*my/12e6));W=Math.max(8,Math.round(mx/px)+1);H=Math.max(8,Math.round(my/px)+1)}
else{const N=Math.max(32,Math.min(Math.min(Nmax,512),Math.round(Math.sqrt(n)*1.2)));W=Math.max(8,Math.round(asp>=1?N:N*asp));H=Math.max(8,Math.round(asp>=1?N/asp:N))}
// pixel centres on the data: the outer points fall in the middle of the edge pixels
const pa=(a1-a0)/(H-1||1),po=(o1-o0)/(W-1||1);a0-=pa/2;a1+=pa/2;o0-=po/2;o1+=po/2;
const S=new Float32Array(W*H),C=new Uint16Array(W*H),ka=H/(a1-a0),ko=W/(o1-o0);
for(let i=0;i<n;i++){const x=Math.min(W-1,Math.floor((B.lo[i]-o0)*ko)),y=Math.min(H-1,Math.floor((a1-B.la[i])*ka)),k=y*W+x;S[k]+=B.z[i];C[k]++}
let Z=new Float32Array(W*H).fill(NaN);for(let k=0;k<W*H;k++)if(C[k])Z[k]=S[k]/C[k];
// close small gaps (rounding of a grid onto the pixels, sparse soundings): one pass on a fine grid, three on a coarse one
for(let pass=0,np=B.res>0?1:3;pass<np;pass++){const Y=Z.slice();for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x;if(!isNaN(Z[k]))continue;let s=0,m=0;
for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=H)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const v=Z[yy*W+xx];if(v===v){s+=v;m++}}}if(m>=2)Y[k]=s/m}Z=Y}
const cvs=document.createElement("canvas");cvs.width=W;cvs.height=H;const g=cvs.getContext("2d"),im=g.createImageData(W,H),sp=(B.zmax-B.zmin)||1,pxm=Math.max(mx/W,my/H),rel=Math.max(sp/Math.max(W,H)*3,pxm*.35);
// the colour scale as a 256-step table
const LUT=new Uint8Array(256*3);for(let i=0;i<256;i++){const c=palCol(i/255,pal);LUT[i*3]=c[0];LUT[i*3+1]=c[1];LUT[i*3+2]=c[2]}
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x,v=Z[k];if(v!==v)continue;const e=x<W-1?Z[k+1]:v,w=x>0?Z[k-1]:v,s=y<H-1?Z[k+W]:v,nn=y>0?Z[k-W]:v;
const gx=e===e&&w===w?(w-e)/2:0,gy=nn===nn&&s===s?(s-nn)/2:0,sh=Math.max(-1,Math.min(1,(gy-gx)/rel)),f=1+sh*.22,li=Math.max(0,Math.min(255,Math.round((v-B.zmin)/sp*255)))*3,p=k*4;
im.data[p]=Math.min(255,LUT[li]*f);im.data[p+1]=Math.min(255,LUT[li+1]*f);im.data[p+2]=Math.min(255,LUT[li+2]*f);im.data[p+3]=225}
g.putImageData(im,0,0);return{b:B,N:Nmax,c:cvs,a0,a1,o0,o1,Z,W,H,zmin:B.zmin,zmax:B.zmax,kind:"depth"}}
const _drawBath=drawBath;
drawBath=function(){if(!bath||!$("sb").checked)return;if(!$("sbS").checked)return _drawBath();const s=bathShade();if(!s.c)return _drawBath();
const p=sc(fromLL(s.a1,s.o0)),q=sc(fromLL(s.a0,s.o1));cx.save();cx.imageSmoothingEnabled=(q[0]-p[0])<s.W*3;cx.drawImage(s.c,p[0],p[1],q[0]-p[0],q[1]-p[1]);cx.restore();
if(poly.length&&lyOn("lyBnd")){const r=DPR();cx.beginPath();poly.forEach((pt,i)=>{const t=sc(pt);i?cx.lineTo(t[0],t[1]):cx.moveTo(t[0],t[1])});if(closed)cx.closePath();cx.strokeStyle="#12262d";cx.lineWidth=2*r;cx.setLineDash([8*r,4*r]);cx.stroke();cx.setLineDash([])}};
$("sbS").addEventListener("change",rq);$("sb").addEventListener("change",()=>{$("lyBath").checked=$("sb").checked;bathLegend();rq()});
// map layer checkboxes: Bathymetry is the same switch as "Show soundings on map"; the colour scale redraws the shading
$("lyBath").addEventListener("change",()=>{$("sb").checked=$("lyBath").checked;bathLegend();rq();saveSoon()});
["lyLines","lyTurns","lyCross","lyBnd","lyCoast","lyBase","lyLeg"].forEach(id=>$(id).addEventListener("change",()=>{bathLegend();rq();saveSoon()}));
$("bPal").addEventListener("change",()=>{bathLegend();rq();saveSoon()});
$("lyClrB").onclick=$("xClr").onclick=$("gbClr").onclick=()=>{if(bath)clearBath()};$("lyClrP").onclick=$("bClr2").onclick=()=>{clear();analyse()};
setTimeout(()=>{$("lyBath").checked=$("sb").checked;bathLegend()},0);

// ---- bathymetry and coastline kept between sessions (IndexedDB) ---------------------------------
const IDK=k=>(window.SWP_STATE_KEY?window.SWP_STATE_KEY+":":"")+k;// saved data per tool
const IDB=(()=>{let P=null;const db=()=>P||(P=new Promise((ok,no)=>{const r=indexedDB.open("swathplan",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
const tx=(m,f)=>db().then(d=>new Promise((ok,no)=>{const t=d.transaction("kv",m),q=f(t.objectStore("kv"));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)}));
return{get:k=>tx("readonly",s=>s.get(k)),set:(k,v)=>tx("readwrite",s=>s.put(v,k)),del:k=>tx("readwrite",s=>s.delete(k))}})();
let savedBath=null;
const _analyse=analyse;analyse=function(){_analyse.apply(this,arguments);if(bath&&bath!==savedBath){savedBath=bath;try{IDB.set(IDK("bath"),bath).catch(()=>{})}catch(e){}}};
const _setCst=setCst;setCst=function(l,p,msg){_setCst(l,p,msg);try{IDB.set(IDK("coast"),{l,p,msg}).catch(()=>{})}catch(e){}};
let hadState=false;try{hadState=!!localStorage.getItem(window.SWP_STATE_KEY||"swp_state")}catch(e){}// read before autosave writes it again
setTimeout(async()=>{try{
if(!hadState){await IDB.del(IDK("bath"));await IDB.del(IDK("coast"));return}// fresh start or Reset: forget them
const c=await IDB.get(IDK("coast"));if(c&&(c.l||c.p)&&!(cst.seg&&cst.seg.length)){_setCst(c.l||[],c.p||[],c.msg||"")}
const b=await IDB.get(IDK("bath"));if(b&&b.z&&b.z.length&&!bath){bath=b;savedBath=b;DG=null;analyse();gen();try{$("gbSt").textContent=i18("Restored from the last session.")}catch(e){}}
rq()}catch(e){}},300);
