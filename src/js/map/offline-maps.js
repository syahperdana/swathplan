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
mx=(Math.max(...xs)-Math.min(...xs))*.1+200,my=(Math.max(...ys)-Math.min(...ys))*.1+200,
sw=toLL([Math.min(...xs)-mx,Math.min(...ys)-my]),ne=toLL([Math.max(...xs)+mx,Math.max(...ys)+my]),L=[];
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

// ---- map source label ------------------------------------------------------------------------
let _ms="";
function mapSrc(){const b=$("bm").value,P=[];
if(b=="pmtiles")P.push(PM?i18("Your map file"):i18("No map file loaded"));
else if(b!="none")P.push(navigator.onLine===false?(tileOK?i18("Offline: saved map tiles"):i18("Offline: no saved tiles here")):i18("Online map"));
if(bath&&$("sb").checked&&$("sbS").checked)P.push(i18("Bathymetry"));
const s=P.join(" + "),e=$("mapSrc");if(s!==_ms){_ms=s;e.textContent=s;e.hidden=!s}
const hd=$("hud");e.style.bottom=(innerWidth<=700&&hd&&hd.offsetParent?hd.offsetHeight+16:30)+"px"}
// texts written by this module follow a language change (setLang is defined later, so wrap it after load)
setTimeout(()=>{if(typeof setLang!="function")return;const _sl=setLang;setLang=function(){const r=_sl.apply(this,arguments);try{_ms="";mapSrc();pmStatus();tcShow();saCheck()}catch(e){}return r}},0);
addEventListener("online",()=>{rq();tcShow()});addEventListener("offline",rq);

// ---- shaded bathymetry -------------------------------------------------------------------------
// The depth points are turned once into a small shaded image (light = shallow, dark = deep, lit from
// the north-west), which is then just scaled on screen: smooth to pan, light on a phone.
let BS=null;
function hsl2rgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return[f(0)*255,f(8)*255,f(4)*255]}
function bathShade(){if(BS&&BS.b===bath)return BS;const B=bath,n=B.z.length;let a0=90,a1=-90,o0=360,o1=-360;
for(let i=0;i<n;i++){const la=B.la[i],lo=B.lo[i];if(la<a0)a0=la;if(la>a1)a1=la;if(lo<o0)o0=lo;if(lo>o1)o1=lo}
if(!(a1>a0&&o1>o0))return BS={b:B,c:null};
const asp=(o1-o0)*Math.cos((a0+a1)/2*D)/(a1-a0),N=Math.max(32,Math.min(512,Math.round(Math.sqrt(n)*1.2))),W=Math.max(8,Math.round(asp>=1?N:N*asp)),H=Math.max(8,Math.round(asp>=1?N/asp:N));
const S=new Float32Array(W*H),C=new Uint16Array(W*H);
for(let i=0;i<n;i++){const x=Math.min(W-1,Math.floor((B.lo[i]-o0)/(o1-o0)*W)),y=Math.min(H-1,Math.floor((a1-B.la[i])/(a1-a0)*H)),k=y*W+x;S[k]+=B.z[i];C[k]++}
let Z=new Float32Array(W*H).fill(NaN);for(let k=0;k<W*H;k++)if(C[k])Z[k]=S[k]/C[k];
for(let pass=0;pass<3;pass++){const Y=Z.slice();for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x;if(!isNaN(Z[k]))continue;let s=0,m=0;
for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const v=Z[yy*W+xx];if(!isNaN(v)){s+=v;m++}}if(m>=2)Y[k]=s/m}Z=Y}
const cvs=document.createElement("canvas");cvs.width=W;cvs.height=H;const g=cvs.getContext("2d"),im=g.createImageData(W,H),sp=(B.zmax-B.zmin)||1,rel=sp/Math.max(W,H)*3;
const at=(x,y)=>{x=Math.max(0,Math.min(W-1,x));y=Math.max(0,Math.min(H-1,y));const v=Z[y*W+x];return isNaN(v)?null:v};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=Z[y*W+x];if(isNaN(v))continue;const k=(v-B.zmin)/sp,e=at(x+1,y),w=at(x-1,y),s=at(x,y+1),nn=at(x,y-1);
const gx=e!=null&&w!=null?(w-e)/2:0,gy=nn!=null&&s!=null?(s-nn)/2:0,sh=Math.max(-1,Math.min(1,(gy-gx)/rel)),[r,gg,bb]=hsl2rgb(215,75,Math.max(18,Math.min(90,82-k*55+sh*9)));
const p=(y*W+x)*4;im.data[p]=r;im.data[p+1]=gg;im.data[p+2]=bb;im.data[p+3]=220}
g.putImageData(im,0,0);return BS={b:B,c:cvs,a0,a1,o0,o1}}
const _drawBath=drawBath;
drawBath=function(){if(!bath||!$("sb").checked)return;if(!$("sbS").checked)return _drawBath();const s=bathShade();if(!s.c)return _drawBath();
const p=sc(fromLL(s.a1,s.o0)),q=sc(fromLL(s.a0,s.o1));cx.save();cx.imageSmoothingEnabled=true;cx.drawImage(s.c,p[0],p[1],q[0]-p[0],q[1]-p[1]);cx.restore();
if(poly.length){const r=DPR();cx.beginPath();poly.forEach((pt,i)=>{const t=sc(pt);i?cx.lineTo(t[0],t[1]):cx.moveTo(t[0],t[1])});if(closed)cx.closePath();cx.strokeStyle="#12262d";cx.lineWidth=2*r;cx.setLineDash([8*r,4*r]);cx.stroke();cx.setLineDash([])}};
$("sbS").addEventListener("change",rq);$("sb").addEventListener("change",rq);

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
