const TC={},TCN=[],PROV={osmfr:["https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png","© OpenStreetMap France, © OpenStreetMap contributors"],esristreet:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}","© Esri, HERE, Garmin, © OpenStreetMap contributors"],esritopo:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}","© Esri, HERE, Garmin, USGS, NGA"],esrigray:["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}","© Esri, HERE, Garmin"],osm:["https://tile.openstreetmap.org/{z}/{x}/{y}.png","© OpenStreetMap contributors"],topo:["https://a.tile.opentopomap.org/{z}/{x}/{y}.png","© OpenTopoMap, OpenStreetMap"],sat:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}","Imagery © Esri"],ocean:["https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}","© Esri, GEBCO, NOAA"]};
let rqf=0;const rq=()=>{if(!rqf){rqf=1;requestAnimationFrame(()=>{rqf=0;render()})}};
const qk=(x,y,z)=>{let t="";for(let i=z;i>0;i--)t+=((y>>(i-1))&1)*2+((x>>(i-1))&1);return t};
let tileOK=0,tileErr=0,tileFB=0;const BUILTIN=t=>Object.keys(PROV).some(k=>PROV[k][0]==t);
const PMT="pmtiles:{z}/{x}/{y}";let PM=null;
function tileURL(t,x,y,z){return t.replace("{z}",z).replace("{x}",x).replace("{y}",y).replace("{q}",qk(x,y,z)).replace("{s}","abc"[(x+y)%3])}
function tileImg(t,x,y,z){const url=tileURL(t,x,y,z);let i=TC[url];if(!i){i=TC[url]=new Image();i.decoding="async";
if(t==PMT){i.onload=()=>{i.ok=1;rq()};i.onerror=()=>{i.bad=1};pmTile(z,x,y).then(b=>{if(b)i.src=URL.createObjectURL(b);else i.bad=1}).catch(()=>{i.bad=1})}
else{if(BUILTIN(t))i.crossOrigin="anonymous";try{i.referrerPolicy="strict-origin-when-cross-origin"}catch(_){}i.onload=()=>{i.ok=1;tileOK++;rq()};i.onerror=()=>{i.bad=1;tileErr++;tileFail()};i.src=url}
TCN.push(url);if(TCN.length>700)TCN.splice(0,150).forEach(u=>{const q=TC[u];if(q){q.onload=q.onerror=null;if(q.src&&q.src.startsWith("blob:"))URL.revokeObjectURL(q.src);delete TC[u]}})}return i.ok?i:null}
function tileFail(){if(tileOK||tileErr<6||tileFB>1)return;const b=$("bm"),nx={osm:"osmfr",osmfr:"esristreet",topo:"esristreet"}[b.value];if(!nx)return;tileFB++;tileErr=0;b.value=nx;toast(i18("The basemap server did not answer; switched to {0}.",b.options[b.selectedIndex].text),6000);rq()}
function layer(t,zr){const w=cv.width,h=cv.height,c=toLL([V.cx,V.cy]);let z=Math.max(1,Math.min(19,Math.round(Math.log2(156543.03*Math.cos(c[0]*D)*V.k))));if(zr)z=Math.min(zr[1],Math.max(zr[0],z));
const tl=toLL(wc(0,0)),br=toLL(wc(w,h)),X=lo=>(lo+180)/360*2**z,Y=la=>(1-Math.log(Math.tan(la*D)+1/Math.cos(la*D))/Math.PI)/2*2**z;let x0,x1,y0,y1;
for(;;z--){x0=Math.floor(X(tl[1]));x1=Math.floor(X(br[1]));y0=Math.floor(Y(tl[0]));y1=Math.floor(Y(br[0]));if((x1-x0+1)*(y1-y0+1)<=60||z<=(zr?zr[0]:1))break}if(zr&&(x1-x0+1)*(y1-y0+1)>400)return;
const n=2**z,ll=(x,y)=>[Math.atan(Math.sinh(Math.PI*(1-2*y/n)))/D,x/n*360-180];
for(let x=x0;x<=x1;x++)for(let y=Math.max(0,y0);y<=Math.min(n-1,y1);y++){const im=tileImg(t,((x%n)+n)%n,y,z);if(!im)continue;const a=ll(x,y),b=ll(x+1,y+1),p=sc(fromLL(a[0],a[1])),q=sc(fromLL(b[0],b[1]));cx.drawImage(im,p[0],p[1],q[0]-p[0]+.6,q[1]-p[1]+.6)}}
function drawTiles(){if(noTiles||!lyOn("lyBase"))return;const b=$("bm").value;let at="";if(b=="pmtiles"){if(PM){layer(PMT,[PM.h.minZ,PM.h.maxZ]);at=String(PM.meta.attribution||i18("Your map file")).replace(/<[^>]*>/g,"")}}else if(b!="none"){const t=b=="custom"?$("bmU").value.trim():(PROV[b]||PROV.esristreet)[0];if(t){layer(t);at=b=="custom"?"Custom tiles":(PROV[b]||PROV.esristreet)[1]}}
if($("sea").checked){layer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png");at+=" + OpenSeaMap"}$("attr").textContent=at;if(typeof mapSrc=="function")mapSrc()}
["bm","bmU","sea","sb"].forEach(i=>$(i).addEventListener("input",rq));
$("goB").onclick=async()=>{const t=$("goT").value.trim(),m=t.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);let la,lo;
if(m){la=+m[1];lo=+m[2]}else{try{const j=await(await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(t))).json();if(!j.length)return alert(i18("Place not found."));la=+j[0].lat;lo=+j[0].lon}catch(e){return alert(i18("Place search needs internet. Enter \"lat, lon\" instead."))}}
reorigin(la,lo);V.cx=V.cy=0;V.k=cv.width/5000;analyse();gen()};
function reorigin(la,lo){const ps=poly.map(toLL);o={lat:la,lon:lo};poly=ps.map(p=>fromLL(p[0],p[1]));projC()}
