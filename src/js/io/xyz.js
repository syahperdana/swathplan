// ---- XYZ soundings: read in steps (the page stays responsive), projected through a fine lattice, stored as typed arrays
// fast point-in-polygon for many points: the edges are bucketed by horizontal strips
function polyTester(P){const n=P.length;if(n<3)return()=>true;let y0=1e30,y1=-1e30,x0=1e30,x1=-1e30;P.forEach(p=>{y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0])});
const ns=Math.max(1,Math.min(4096,n*4)),h=(y1-y0)/ns||1,B=Array.from({length:ns},()=>[]);
for(let i=0;i<n;i++){const a=P[i],b=P[(i+1)%n],s0=Math.max(0,Math.floor((Math.min(a[1],b[1])-y0)/h)),s1=Math.min(ns-1,Math.floor((Math.max(a[1],b[1])-y0)/h));for(let s=s0;s<=s1;s++)B[s].push(i)}
return(x,y)=>{if(y<y0||y>y1||x<x0||x>x1)return false;const E=B[Math.min(ns-1,Math.floor((y-y0)/h))];let c=false;
for(let k=0;k<E.length;k++){const i=E[k],a=P[i],b=P[(i+1)%n];if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c}}
// colour scales for depths: k = 0 shallowest, 1 deepest
const PALS={rainbow:[[0,[200,30,45]],[.18,[240,120,30]],[.36,[245,215,55]],[.54,[70,185,90]],[.72,[40,150,205]],[.88,[45,80,190]],[1,[85,40,150]]],
blues:[[0,[198,222,248]],[.25,[150,190,236]],[.5,[93,150,222]],[.75,[44,104,186]],[1,[20,58,112]]],
viridis:[[0,[253,231,37]],[.25,[94,201,98]],[.5,[33,145,140]],[.75,[59,82,139]],[1,[68,1,84]]],
ocean:[[0,[230,248,240]],[.3,[120,210,200]],[.6,[35,140,170]],[1,[10,40,90]]],
grey:[[0,[240,240,240]],[1,[45,45,45]]]};
function palCol(k,name){const L=PALS[name||(($("bPal")||{}).value)]||PALS.rainbow;k=Math.max(0,Math.min(1,isFinite(k)?k:0));
for(let i=1;i<L.length;i++){const[a,ca]=L[i-1],[b,cb]=L[i];if(k<=b){const t=(k-a)/(b-a||1);return ca.map((v,j)=>v+(cb[j]-v)*t)}}return L[L.length-1][1]}
const palCss=name=>"linear-gradient(90deg,"+(PALS[name]||PALS.rainbow).map(([k,c])=>"rgb("+c.join(",")+") "+(k*100).toFixed(0)+"%").join(",")+")";

const XYZ_STEP=150000;// points projected between pauses (without the lattice)
const xyzPause=()=>new Promise(r=>setTimeout(r,0));
function xyzMsg(t){const e=$("sndR");if(e)e.textContent=t}
let xyzBusy=false;
async function loadXYZ(txt){if(xyzBusy)return;xyzBusy=true;try{return await _loadXYZ(txt)}finally{xyzBusy=false}}
// src: a File (read as a stream, so a large file is never held as one string) or pasted text
async function _loadXYZ(src){const t0=performance.now();let cv2;try{cv2=mkConv()}catch(e){xyzMsg(e.message);return}
const sw=$("xord").value=="yx",sg=$("zsg").value=="down"?1:-1,uf=+$("zun").value,off=g("zoff"),hdr=Math.max(0,g("hdr")|0),geo=$("xcrs").value=="geo",size=typeof src=="string"?src.length:src.size;
// 1. read the numbers: x, y, z per row (any of space, tab, comma, semicolon between them)
let cap=Math.max(1024,Math.ceil(size/18)),X=new Float64Array(cap),Y=new Float64Array(cap),Z=new Float32Array(cap),n=0,bad=0,row=0,done=0,rest="",nextPause=2e6;
const grow=()=>{cap*=2;const a=new Float64Array(cap),b=new Float64Array(cap),c=new Float32Array(cap);a.set(X);b.set(Y);c.set(Z);X=a;Y=b;Z=c};
const isSep=c=>c==32||c==9||c==44||c==59||c==13,v=[0,0,0];
const lines=(txt,last)=>{const L=txt.length;let pos=0;while(pos<L){let e=txt.indexOf("\n",pos);if(e<0){if(!last){rest=txt.slice(pos);return}e=L}
if(row++>=hdr){let p=pos,f=0;while(f<3&&p<e){while(p<e&&isSep(txt.charCodeAt(p)))p++;if(p>=e)break;const s=p;while(p<e&&!isSep(txt.charCodeAt(p)))p++;v[f++]=+txt.slice(s,p)}
if(f==3){if(v[0]===v[0]&&v[1]===v[1]&&v[2]===v[2]&&isFinite(v[0]+v[1]+v[2])){if(n>=cap)grow();X[n]=sw?v[1]:v[0];Y[n]=sw?v[0]:v[1];Z[n]=sg*v[2]*uf+off;n++}else bad++}else if(e>pos+1)bad++}
pos=e+1}rest=""};
if(typeof src=="string")lines(src,true);
else{const rd=src.stream().pipeThrough(new TextDecoderStream()).getReader();for(;;){const{value,done:end}=await rd.read();if(end)break;done+=value.length;lines(rest+value,false);
if(done>=nextPause){nextPause=done+2e6;xyzMsg(i18("Reading XYZ… {0} %",Math.min(99,Math.round(done/size*100))));await xyzPause()}}if(rest)lines(rest,true)}
if(!n){xyzMsg(i18("No valid XYZ rows found. Check the column order, coordinate system and header lines."));return}
// 2. point spacing (metres) from neighbouring rows: the 25th percentile of the gaps, which is the cell size of a grid file
let sx0=1e300,sx1=-1e300,sy0=1e300,sy1=-1e300,zmin=1e30,zmax=-1e30;for(let i=0;i<n;i++){const x=X[i],y=Y[i],z=Z[i];if(x<sx0)sx0=x;if(x>sx1)sx1=x;if(y<sy0)sy0=y;if(y>sy1)sy1=y;if(z<zmin)zmin=z;if(z>zmax)zmax=z}
const ds=[];for(let i=1;i<n&&ds.length<20000;i+=Math.max(1,Math.floor(n/20000))){const d=Math.hypot(X[i]-X[i-1],Y[i]-Y[i-1]);if(d>0)ds.push(d)}ds.sort((a,b)=>a-b);
let res=ds.length?ds[Math.floor(ds.length*.25)]:0;if(geo)res*=111320*Math.cos(((sy0+sy1)/2)*D);
xyzMsg(i18("Projecting… {0} %",0));await xyzPause();
// 3. horizontal positions to lat/lon, written over X (latitude) and Y (longitude). Projected data: exact conversion on a
// lattice of at most 257 x 257 nodes, then bilinear interpolation (the projection is smooth: well under a millimetre off)
let lat=null;
if(!geo&&n>20000){const nx=Math.max(2,Math.min(257,Math.ceil((sx1-sx0)/25)+1)),ny=Math.max(2,Math.min(257,Math.ceil((sy1-sy0)/25)+1)),dx=(sx1-sx0)/(nx-1)||1,dy=(sy1-sy0)/(ny-1)||1,A=new Float64Array(nx*ny),O=new Float64Array(nx*ny);
try{for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const q=cv2(sx0+i*dx,sy0+j*dy);if(!(isFinite(q[0])&&isFinite(q[1])))throw 0;A[j*nx+i]=q[0];O[j*nx+i]=q[1]}lat=1}catch(e){lat=null}
if(lat)for(let i0=0;i0<n;i0+=1e6){for(let i=i0,e=Math.min(n,i0+1e6);i<e;i++){let fx=(X[i]-sx0)/dx,fy=(Y[i]-sy0)/dy,ix=Math.min(nx-2,fx|0),iy=Math.min(ny-2,fy|0);fx-=ix;fy-=iy;const k=iy*nx+ix,
w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;X[i]=A[k]*w00+A[k+1]*w10+A[k+nx]*w01+A[k+nx+1]*w11;Y[i]=O[k]*w00+O[k+1]*w10+O[k+nx]*w01+O[k+nx+1]*w11}
if(i0+1e6<n){xyzMsg(i18("Projecting… {0} %",Math.round(i0/n*100)));await xyzPause()}}}
if(!lat){let m=0;for(let i=0;i<n;i++){let q;try{q=cv2(X[i],Y[i])}catch(e){q=null}if(!q||!(Math.abs(q[0])<=90&&Math.abs(q[1])<=360)){bad++;continue}
X[m]=q[0];Y[m]=q[1];Z[m]=Z[i];m++;if(i%XYZ_STEP==0&&i){xyzMsg(i18("Projecting… {0} %",Math.round(i/n*100)));await xyzPause()}}n=m}
if(!n){xyzMsg(i18("No valid XYZ rows found. Check the column order, coordinate system and header lines."));return}
const cut=(A)=>n<A.length*.85?A.slice(0,n):A.subarray(0,n);
const B={la:cut(X),lo:cut(Y),z:cut(Z),bad,zmin,zmax,res:+res.toFixed(3),src:"XYZ"};X=Y=Z=null;
let a0=1e9,a1=-1e9,o0=1e9,o1=-1e9;for(let i=0;i<n;i++){const p=B.la[i],q=B.lo[i];if(p<a0)a0=p;if(p>a1)a1=p;if(q<o0)o0=q;if(q>o1)o1=q}
bath=B;DG=null;if(!closed){reorigin((a0+a1)/2,(o0+o1)/2);const dx=Math.max(50,(o1-o0)*111320*Math.cos(o.lat*D)),dy=Math.max(50,(a1-a0)*111132.9);V.cx=V.cy=0;V.k=Math.min(cv.width/dx,cv.height/dy)*.8}
// 4. statistics, depth model, lines and the shaded image, with a pause between them so the page can repaint
xyzMsg(i18("Analysing {0} points…",n.toLocaleString()));await xyzPause();const _gen=gen;gen=()=>{};try{analyse()}finally{gen=_gen}const st=$("sndR").textContent;
xyzMsg(st+" "+i18("Planning lines…"));await xyzPause();buildDG();await xyzPause();gen();await xyzPause();try{bathShade()}catch(e){}$("sndR").textContent=st;B.ms=Math.round(performance.now()-t0);render();return B}
// depth statistics, inside the area when there is one (a fast polygon test and a typed sort: a few hundred ms for a million points)
// depths shallower than this are left out of the design-depth buttons (the adaptive limit where there is one, at least 0.5 m)
const xyzWetLim=()=>Math.max(.5,typeof adpMin=="function"?adpMin():.5);
function analyse(){if(!bath){sdp=null;bathLegend();return}const N=bath.z.length,T=closed&&poly.length>2?polyTester(poly):null;let m=0,s=0,s2=0,z0=1e30,z1=-1e30;
// percentiles from a fine histogram (4096 steps over the depth range: within a few millimetres) instead of sorting millions of values
const NB=4096,lo=bath.zmin,hi=bath.zmax,w=(hi-lo)/NB||1,Hf=new Uint32Array(NB),kx=111320*Math.cos(o.lat*D),ky=111132.9,LA=bath.la,LO=bath.lo,ZZ=bath.z,wl=xyzWetLim();let wm=0,ws=0,w0=1e30;
for(let i=0;i<N;i++){if(T&&!T((LO[i]-o.lon)*kx,(LA[i]-o.lat)*ky))continue;const v=ZZ[i];m++;s+=v;s2+=v*v;if(v<z0)z0=v;if(v>z1)z1=v;if(v>=wl){wm++;ws+=v;if(v<w0)w0=v}Hf[Math.min(NB-1,Math.max(0,Math.floor((v-lo)/w)))]++}
if(!m){sdp=null;$("sndR").textContent=i18("{0} points loaded, none inside the area.",N);bathLegend();return}const mean=s/m;
const q=f=>{const t=f*m;let c=0;for(let k=0;k<NB;k++){c+=Hf[k];if(c>=t)return Math.min(z1,Math.max(z0,lo+(k+.5)*w))}return z1};
const nb=12,hist=new Array(nb).fill(0);for(let k=0;k<NB;k++)if(Hf[k]){const v=lo+(k+.5)*w;hist[Math.min(nb-1,Math.max(0,Math.floor((v-z0)/((z1-z0)||1)*nb)))]+=Hf[k]}
sdp={min:z0,max:z1,p5:q(.05),med:q(.5),mean,sd:Math.sqrt(Math.max(0,s2/m-mean*mean)),n:m,hist};
// for the design-depth buttons: the same without drying ground and very shallow water (a design depth must be positive)
if(wm&&wm<m){const qw=f=>{const t=f*wm;let c=0;for(let k=0;k<NB;k++){const v=lo+(k+.5)*w;if(v<wl)continue;c+=Hf[k];if(c>=t)return Math.max(w0,v)}return z1};sdp.wet={min:w0,p5:qw(.05),mean:ws/wm,lim:wl,f:1-wm/m}}
$("sndR").textContent=i18("{0} points loaded ({1} skipped). {2}: {3} points, min {4} m, 5th pct {5} m, mean {6} m, max {7} m.",N.toLocaleString(),bath.bad,closed?i18("Inside area"):i18("All"),m.toLocaleString(),sdp.min.toFixed(1),sdp.p5.toFixed(1),sdp.mean.toFixed(1),sdp.max.toFixed(1))+
(bath.res?" "+i18("Point spacing about {0} m.",bath.res<1?bath.res.toFixed(2):bath.res.toFixed(1)):"")+(bath.res&&bath.res<.5?" "+i18("Finer than 0.5 m: grid the data to 0.5–1 m before loading for a quicker planner."):"")+(sdp.wet?" "+i18("{0} % of these are shallower than {1} m (drying ground or very shallow water); the buttons below leave them out.",(sdp.wet.f*100).toFixed(0),sdp.wet.lim.toFixed(1)):"");bathLegend()}
// soundings as dots when the shaded background is off: colour from the chosen scale
function drawBath(){if(!bath||!$("sb").checked)return;const n=bath.z.length,st=Math.max(1,Math.floor(n/5000)),r=DPR(),sp=(bath.zmax-bath.zmin)||1;
for(let i=0;i<n;i+=st){const s=sc(fromLL(bath.la[i],bath.lo[i]));if(s[0]<0||s[1]<0||s[0]>cv.width||s[1]>cv.height)continue;const c=palCol((bath.z[i]-bath.zmin)/sp);cx.fillStyle="rgb("+c.map(Math.round).join(",")+")";cx.fillRect(s[0]-2*r,s[1]-2*r,4*r,4*r)}}
// the depth legend on the map: colour scale, range and statistics
function bathLegend(){const e=$("bLeg");if(!e)return;const on=!!(bath&&bath.z&&bath.z.length&&$("sb").checked&&(!$("lyLeg")||$("lyLeg").checked)&&!window.SWP_UAVSHEET);e.hidden=!on;if(!on)return;
const p=($("bPal")||{}).value||"rainbow";$("bLegBar").style.background=palCss(p);const f=v=>Math.abs(v)<100?v.toFixed(1):v.toFixed(0);$("bLegMin").textContent=f(bath.zmin);$("bLegMid").textContent=f((bath.zmin+bath.zmax)/2);$("bLegMax").textContent=f(bath.zmax);
const S=sdp,t=[i18("{0} points",bath.z.length.toLocaleString())];if(bath.res)t.push(i18("spacing {0} m",bath.res<1?bath.res.toFixed(2):bath.res.toFixed(1)));
$("bLegSt").textContent=t.join(" · ");$("bLegIn").textContent=S?(closed?i18("Inside area"):i18("All"))+": "+i18("min {0} · mean {1} · median {2} · max {3} · σ {4} m",f(S.min),f(S.mean),f(S.med),f(S.max),S.sd.toFixed(2)):""}
// remove the loaded depths (the rest of the project stays)
function clearBath(){bath=null;sdp=null;DG=null;try{BSC.clear()}catch(e){}try{savedBath=null;IDB.del(IDK("bath")).catch(()=>{})}catch(e){}$("sndR").textContent=i18("Bathymetry removed.");try{$("gbSt").textContent=""}catch(e){}bathLegend();gen();render();try{saveSoon()}catch(e){}}
$("xl").onclick=async()=>{if($("xcrs").value=="epsg"){if(!crsDef)return alert(i18("Load an EPSG code or definition first."));try{await ensureP4()}catch(e){return alert(i18("The proj4 library is not available. Connect to the internet once, or load proj4.js from a file."))}}const f=$("xf").files[0];
if(f){xyzMsg(i18("Reading XYZ… {0} %",0));loadXYZ(f)}else loadXYZ($("snd").value)};
// the design depth from the depths inside the area, leaving out drying ground and very shallow water
const ap=k=>{if(!sdp)return;const W=sdp.wet,v=W?W[k]:sdp[k];if(!isFinite(v)||v<=0)return toast(i18("No depths deeper than {0} m inside the area.",(W?W.lim:.5).toFixed(1)),4000);$("depth").value=v.toFixed(1);$("qd").value=v.toFixed(1);gen()};
$("sMin").onclick=()=>ap("min");$("sP5").onclick=()=>ap("p5");$("sMean").onclick=()=>ap("mean");
