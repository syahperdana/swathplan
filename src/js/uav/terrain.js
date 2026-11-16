/* ===== drone terrain following: a terrain model (SRTM 30 m, NOAA NCEI mosaic or a file) and a height per waypoint, so the drone keeps the set height above the ground (active when MODE().uav) ===== */
// TG: a regular lat/lon grid of ground elevations (m, up): nodes at la0+j*dla, lo0+i*dlo; NaN where there is no value
let TG=null,TGC=null;
function tgZ(la,lo){if(!TG)return NaN;const fx=(lo-TG.lo0)/TG.dlo,fy=(la-TG.la0)/TG.dla;if(!(fx>=0&&fy>=0&&fx<=TG.nx-1&&fy<=TG.ny-1))return NaN;
const i=Math.min(TG.nx-2,Math.floor(fx)),j=Math.min(TG.ny-2,Math.floor(fy)),a=fx-i,b=fy-j,Z=(p,q)=>TG.z[q*TG.nx+p];let s=0,w=0;
[[Z(i,j),(1-a)*(1-b)],[Z(i+1,j),a*(1-b)],[Z(i,j+1),(1-a)*b],[Z(i+1,j+1),a*b]].forEach(([z,k])=>{if(isFinite(z)&&k>0){s+=z*k;w+=k}});return w>1e-9?s/w:NaN}
const tgAt=p=>{const l=toLL(p);return tgZ(l[0],l[1])};
// the box to cover: lines, turns and area, plus half a swath and 100 m
function tgBox(){const P=[];R.lines.forEach(l=>P.push(...LP(l)));(R.turns||[]).forEach(t=>t&&t.pts&&P.push(...t.pts));if(closed)P.push(...poly);if(!P.length)return null;
const m=Math.max(150,uvGeo().across/2+100),xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),a=toLL([Math.min(...xs)-m,Math.min(...ys)-m]),b=toLL([Math.max(...xs)+m,Math.max(...ys)+m]);
return{la0:a[0],lo0:a[1],la1:b[0],lo1:b[1],wm:Math.max(...xs)-Math.min(...xs)+2*m,hm:Math.max(...ys)-Math.min(...ys)+2*m}}
// a grid over the box with at most N nodes a side and at least sp m between them
function tgNodes(B,N,sp){const s=Math.max(sp,Math.max(B.wm,B.hm)/(N-1)),nx=Math.max(2,Math.ceil(B.wm/s)+1),ny=Math.max(2,Math.ceil(B.hm/s)+1);
return{la0:B.la0,lo0:B.lo0,dla:(B.la1-B.la0)/(ny-1),dlo:(B.lo1-B.lo0)/(nx-1),nx,ny,z:new Float32Array(nx*ny).fill(NaN)}}
// scattered points into the grid (mean per node), then holes filled from their neighbours
function tgBin(G,P){const s=new Float64Array(G.nx*G.ny),c=new Uint32Array(G.nx*G.ny);P.forEach(([la,lo,z])=>{const i=Math.round((lo-G.lo0)/G.dlo),j=Math.round((la-G.la0)/G.dla);if(i<0||j<0||i>=G.nx||j>=G.ny||!isFinite(z))return;s[j*G.nx+i]+=z;c[j*G.nx+i]++});
for(let k=0;k<s.length;k++)if(c[k])G.z[k]=s[k]/c[k];
for(let it=0;it<3;it++){const Z=G.z.slice();for(let j=0;j<G.ny;j++)for(let i=0;i<G.nx;i++){if(isFinite(Z[j*G.nx+i]))continue;let t=0,n=0;
for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const p=i+a,q=j+b;if(p<0||q<0||p>=G.nx||q>=G.ny)continue;const v=Z[q*G.nx+p];if(isFinite(v)){t+=v;n++}}if(n)G.z[j*G.nx+i]=t/n}}return G}
function tgSet(G,src){let lo=1e9,hi=-1e9,n=0;G.z.forEach(v=>{if(isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);n++}});if(!n)throw new Error(i18("no terrain values in this area"));
G.src=src;TG=G;TGC=null;$("uvTF").checked=true;$("uvTSt").textContent=i18("{0}: {1} terrain points, ground {2} to {3} m. Terrain following is on.",src,n,Math.round(lo),Math.round(hi));gen();saveSoon()}
async function tgLoad(){const st=$("uvTSt"),src=$("uvTS").value;if(src=="file"){$("uvTFile").click();return}const B=tgBox();if(!B){st.textContent=i18("Close an area first (draw, preset or import).");return}
try{st.textContent=i18("Downloading the terrain… {0} %",0);
if(src=="ncei"){const G=tgNodes(B,70,30),pts=[];for(let j=0;j<G.ny;j++)for(let i=0;i<G.nx;i++)pts.push([G.lo0+i*G.dlo,G.la0+j*G.dla]);const P=[];
for(let a=0;a<pts.length;a+=250){const ch=pts.slice(a,a+250),r=JSON.parse(await gbGet("https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/getSamples",{method:"POST",body:new URLSearchParams({geometry:JSON.stringify({points:ch,spatialReference:{wkid:4326}}),geometryType:"esriGeometryMultipoint",returnFirstValueOnly:"true",interpolation:"RSP_BilinearInterpolation",f:"json"})}));
if(r.error)throw new Error(r.error.message||"service error");(r.samples||[]).forEach((q,i)=>{const p=ch[q.locationId!=null?q.locationId:i];if(p)P.push([p[1],p[0],parseFloat(q.value)])});st.textContent=i18("Downloading the terrain… {0} %",Math.round(100*Math.min(1,(a+250)/pts.length)))}
tgSet(tgBin(G,P),"NOAA NCEI")}
else{const G=tgNodes(B,50,30),pts=[];for(let j=0;j<G.ny;j++)for(let i=0;i<G.nx;i++)pts.push([G.la0+j*G.dla,G.lo0+i*G.dlo]);const P=[];
for(let a=0;a<pts.length;a+=100){if(a)await new Promise(r=>setTimeout(r,1100));const ch=pts.slice(a,a+100),r=JSON.parse(await gbGet("https://api.opentopodata.org/v1/srtm30m?locations="+ch.map(q=>q[0].toFixed(6)+","+q[1].toFixed(6)).join("|")));
if(r.status!="OK")throw new Error(r.error||"service error");r.results.forEach((q,i)=>{if(q.elevation!=null)P.push([ch[i][0],ch[i][1],q.elevation])});st.textContent=i18("Downloading the terrain… {0} %",Math.round(100*Math.min(1,(a+100)/pts.length)))}
tgSet(tgBin(G,P),"SRTM 30 m")}}
catch(err){st.textContent=i18("Could not download the terrain: {0}. The service may be offline, blocked by the browser or busy: try the other source or a file.",err.message)}}
// a GeoTIFF or ESRI ASCII elevation grid, in lat/lon or in the coordinate system of section {§crs}
async function tgFile(f){const st=$("uvTSt");try{st.textContent=i18("Reading {0}…",f.name);const B=tgBox();if(!B)throw new Error(i18("Close an area first (draw, preset or import)."));
const F=/\.tiff?$/i.test(f.name)?await parseTIFF(await f.arrayBuffer()):parseASC(await f.text()),geo=Math.abs(F.xl)<=360&&Math.abs(F.yt)<=90,cm=geo?F.dx*111320*Math.cos((B.la0+B.la1)/2*D):F.dx,
G=tgNodes(B,200,Math.max(5,cm)),st2=Math.max(1,Math.ceil(Math.sqrt(F.w*F.h/400000))),P=[];let cv=null;const pad=.2*(Math.max(G.dla,G.dlo)*G.nx);
for(let j=0;j<F.h;j+=st2)for(let i=0;i<F.w;i+=st2){const v=F.data[j*F.w+i];if(!isFinite(v)||v===F.nodata||v<-1e4)continue;let x=F.xl+(i+.5)*F.dx,y=F.yt-(j+.5)*F.dy,la=y,lo=x;
if(!geo){if(!cv)cv=mkConv();[la,lo]=cv(x,y)}if(la<B.la0-pad||la>B.la1+pad||lo<B.lo0-pad||lo>B.lo1+pad)continue;P.push([la,lo,v])}
tgSet(tgBin(G,P),f.name)}catch(err){st.textContent=i18("Could not read this grid: {0}",err.message)}}
// waypoints along the lines (as exported), a vertex flag, and the line each belongs to (-1 for turns)
function tgRoute(d){const W=[];R.lines.forEach((l,i)=>{const q=LP(l);for(let k=0;k<q.length-1;k++){const a=q[k],b=q[k+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/d));
for(let m=0;m<n;m++)W.push([a[0]+(b[0]-a[0])*m/n,a[1]+(b[1]-a[1])*m/n,m==0,i])}const z=q[q.length-1];W.push([z[0],z[1],true,i]);
if($("inclT").checked&&R.turns[i])R.turns[i].pts.slice(1,-1).filter((_,j)=>j%3==0).forEach(p=>W.push([p[0],p[1],true,-1]))});return W}
// heights: each waypoint flies at the set height above the highest ground on its two legs, so the straight leg between two waypoints never comes
// closer to the terrain model than the set height; waypoints that the leg from the last kept one would pass over (within 0.5 m) are dropped
function tgPlan(){if(!MODE().uav||!TG||!R.lines.length)return null;const tf=$("uvTF").checked,U=uvGeo(),H=U.H,d=Math.max(5,g("uvTD")),to=$("uvTO").value.trim(),
key=[H,d,tf,to,$("inclT").checked].join();if(TGC&&TGC.R===R&&TGC.L===R.lines&&TGC.T===TG&&TGC.k==key)return TGC.v;
const W=tgRoute(d),n=W.length,fs=Math.max(1,Math.min(10,d/4)),cd=[0];for(let k=1;k<n;k++)cd.push(cd[k-1]+Math.hypot(W[k][0]-W[k-1][0],W[k][1]-W[k-1][1]));
const smp=(a,b,f)=>{const m=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/fs));for(let k=0;k<=m;k++)f(k/m,tgAt([a[0]+(b[0]-a[0])*k/m,a[1]+(b[1]-a[1])*k/m]))};
const sm=[];for(let k=0;k<n-1;k++){let m=-1e9;smp(W[k],W[k+1],(t,z)=>{if(isFinite(z)&&z>m)m=z});sm.push(m)}
const z0=to!==""?g("uvTO"):W.map(tgAt).find(isFinite);if(!isFinite(z0))return null;let miss=0;
const A=W.map((p,k)=>{const m=Math.max(k>0?sm[k-1]:-1e9,k<n-1?sm[k]:-1e9);if(m<-1e8){miss++;return H}return tf?H+m-z0:H});
const K=[0];if(tf){let a=0;for(let k=1;k<n-1;k++){let ok=!W[k][2]&&W[k+1][3]==W[a][3];if(ok)for(let j=a+1;j<=k;j++){if(A[a]+(A[k+1]-A[a])*(cd[j]-cd[a])/(cd[k+1]-cd[a])<A[j]-.5){ok=false;break}}if(!ok){K.push(k);a=k}}}else for(let k=1;k<n-1;k++)K.push(k);
if(n>1)K.push(n-1);const AI=new Float64Array(n);for(let q=0;q<K.length-1;q++){const a=K[q],b=K[q+1];for(let j=a;j<=b;j++)AI[j]=b>a?A[a]+(A[b]-A[a])*(cd[j]-cd[a])/(cd[b]-cd[a]):A[a]}
let amin=1e9,amax=-1e9,gmin=1e9,gmax=-1e9;const PR=R.lines.map(()=>({s:[],g:[],a:[]}));
for(let k=0;k<n-1;k++){const ln=W[k][3]>=0&&W[k][3]==W[k+1][3];smp(W[k],W[k+1],(t,z)=>{if(!isFinite(z))return;const al=AI[k]+(AI[k+1]-AI[k])*t+z0,h=al-z;
if(ln){amin=Math.min(amin,h);amax=Math.max(amax,h);gmin=Math.min(gmin,z);gmax=Math.max(gmax,z)}if(ln){const q=PR[W[k][3]];q.s.push(cd[k]+(cd[k+1]-cd[k])*t);q.g.push(z);q.a.push(al)}})}
// the profile shown: the line over the most relief (the longest when the ground is even)
const rel=q=>q.g.length?Math.max(...q.g)-Math.min(...q.g):-1,pr=PR.reduce((m,q,i)=>{const r=rel(q),lq=L(R.lines[i]);return r>m.r+.5||(Math.abs(r-m.r)<=.5&&lq>m.l)?{r,l:lq,q}:m},{r:-2,l:0,q:PR[0]}).q;
const v=amax<-1e8?null:{tf,H,z0,W,K,AI,amin,amax,gmin,gmax,miss,hi:Math.max(...K.map(k=>AI[k])),pr,src:TG.src};TGC={R,L:R.lines,T:TG,k:key,v};return v}
// for the waypoint exports: [lat, lon, height above take-off] when terrain following is on
function tgWp(){const P=tgPlan();return P&&P.tf?P.K.map(k=>{const l=toLL(P.W[k]);return[l[0],l[1],+P.AI[k].toFixed(1)]}):undefined}
// profile of one line: ground (filled) and flight path
function tgProf(P){const p=P.pr;if(p.s.length<2)return"";const w=320,h=96,s1=p.s[p.s.length-1]-p.s[0]||1,g0=Math.min(...p.g),a1=Math.max(...p.a),lo=g0-.08*((a1-g0)||1),hi=a1,r=(hi-lo)||1,
X=s=>((s-p.s[0])/s1*w).toFixed(1),Y=z=>(h-4-(z-lo)/r*(h-14)).toFixed(1),st=Math.max(1,Math.floor(p.s.length/300)),ix=p.s.map((_,i)=>i).filter(i=>i%st==0||i==p.s.length-1);
return'<svg viewBox="0 0 '+w+' '+h+'" width="100%" role="img" aria-label="'+i18("Profile of the line over the most relief: ground and flight path")+'"><polygon fill="#d9c7a3" points="0,'+h+" "+ix.map(i=>X(p.s[i])+","+Y(p.g[i])).join(" ")+" "+w+","+h+'"/>'
+'<polyline fill="none" stroke="#1f6fb2" stroke-width="1.6" points="'+ix.map(i=>X(p.s[i])+","+Y(p.a[i])).join(" ")+'"/><text x="2" y="10" font-size="9" fill="currentColor">'+Math.round(hi)+' m</text><text x="2" y="'+(h-6)+'" font-size="9" fill="currentColor">'+Math.round(g0)+" m</text></svg>"}
function tgShow(){if(!MODE().uav)return;const P=tgPlan(),f=(a,b)=>i18("{0} to {1} m",Math.round(a),Math.round(b));
$("uvTG").textContent=P?f(P.gmin,P.gmax):"-";$("uvTA").textContent=P?f(P.amin,P.amax):"-";$("uvTW").textContent=P&&P.tf?P.K.length+" · "+Math.round(P.hi)+" m":"-";$("uvTP").innerHTML=P?tgProf(P):""}
const _tgStats=stats;stats=function(){const r=_tgStats.apply(this,arguments);tgShow();return r};
// plan checks over the terrain
const _tgSum=summary;summary=function(){const r=_tgSum.apply(this,arguments);const P=tgPlan();if(!P)return r;const U=uvGeo(),C=[],add=(k,m)=>C.push('<li class="'+k+'">'+m+"</li>"),R0=x=>Math.round(x);
if(P.tf){add("ok",i18("Terrain following: the drone stays {0} to {1} m above the terrain model; ground from {2} to {3} m.",R0(P.amin),R0(P.amax),R0(P.gmin),R0(P.gmax)));
if(!U.lidar&&P.amax>1.05*P.H)add("inf",i18("Ground sample distance {0} to {1} cm/pixel as the height above ground changes.",(U.gsd*100*P.amin/P.H).toFixed(2),(U.gsd*100*P.amax/P.H).toFixed(2)));
if(U.lidar&&P.amax/Math.cos(U.fov/2*D)>U.rng)add("bad",i18("Where the drone is highest above the ground ({0} m), the slant range at the swath edge is {1} m, beyond the {2} m detection range on dark (10 %) ground.",R0(P.amax),R0(P.amax/Math.cos(U.fov/2*D)),U.rng));
if(P.K.length>700)add("bad",i18("{0} waypoints: some autopilots hold fewer (often about 700 on ArduPilot boards). Raise the waypoint spacing or split the mission.",P.K.length))}
else{P.amin<=0?add("bad",i18("The terrain rises {0} m above the flight altitude: turn on terrain following or fly higher.",R0(-P.amin))):P.amin<.8*P.H||P.amax>1.2*P.H?add("bad",i18("Over the terrain the height above ground varies from {0} to {1} m, so the image scale and side overlap change: turn on terrain following.",R0(P.amin),R0(P.amax))):add("ok",i18("Height above ground {0} to {1} m over the terrain model.",R0(P.amin),R0(P.amax)));
if(P.amax>120&&P.H<=120)add("bad",i18("Over low ground the drone is up to {0} m above it, above the 120 m limit in many countries.",R0(P.amax)))}
if(P.miss)add("bad",i18("{0} waypoints are outside the terrain model and keep the take-off height: load the terrain for a larger area.",P.miss));
$("chk").insertAdjacentHTML("afterbegin",C.join(""));return r};
$("uvTB").onclick=tgLoad;$("uvTFile").onchange=e=>{const f=e.target.files[0];if(f)tgFile(f);e.target.value=""};
["uvTF","uvTD","uvTO"].forEach(id=>{const e=$(id);["input","change"].forEach(ev=>e.addEventListener(ev,()=>{gen();saveSoon()}))});
