/* ===== infill planner: coverage grid from tracks and soundings, gaps, infill lines (runs after the shared planner) ===== */
let IFT=[];// acquired tracks: [{n:name, p:[[lat,lon],...]}]
const IF={g:null,img:null,regions:[],cov:0,gapA:0};
const ifKey=IDK("tracks");
// XYZ soundings loaded in section 11 count as coverage; the global bathymetry grid does not
const _ifXYZ=loadXYZ;loadXYZ=function(t){_ifXYZ(t);if(bath&&!bath.xyz){bath.xyz=1;try{IDB.set(IDK("bath"),bath).catch(()=>{})}catch(e){}savedBath=bath;gen()}};
const ifXYZ=()=>$("ifX").checked&&bath&&bath.xyz&&bath.z.length?bath:null;

// ---- reading tracks: text blocks split at blank lines or line names; files through the boundary reader ----
function ifBlocks(t){const out=[];let cur=[],name="";const flush=()=>{if(cur.length>=2)out.push({n:name,t:cur.join("\n")});cur=[]};
String(t).replace(/^﻿/,"").split(/\r?\n/).forEach(l=>{const s=l.trim();if(!s||/^(#|\/\/)/.test(s)){if(!s)flush();return}
const f=s.split(/[\t;,]+|\s+/).filter(Boolean),nn=f.filter(x=>NUMRE.test(x)).length;
if(nn<2){flush();name=s.slice(0,40);return}
if(!NUMRE.test(f[0])&&f.length>=3){if(f[0]!==name){flush();name=f[0]}cur.push(f.slice(1).join(" "))}else cur.push(s)});flush();return out}
async function ifRead(files,text){const out=[];
const txt=files.filter(f=>/\.(csv|txt|pos|nav)$/i.test(f.name)),other=files.filter(f=>!txt.includes(f));
// degrees where both columns are below 90 can be read either way: take the reading nearest the current area
const near=ll=>{const m=ll.reduce((s,q)=>[s[0]+q[1]/ll.length,s[1]+q[0]/ll.length],[0,0]);return Math.hypot(m[0]-o.lat,(m[1]-o.lon)*Math.cos(o.lat*D))};
const fromText=async(t,src)=>{for(const b of ifBlocks(t)){const h=parseXY(b.t);if(h.ring.length<2)continue;let ll=await importLL({kind:"user",hint:{deg:h.deg,swap:h.swap}},h.ring);
if(h.deg&&h.ring.every(q=>Math.abs(q[0])<=90&&Math.abs(q[1])<=90)){const alt=await importLL({kind:"user",hint:{deg:true,swap:!h.swap}},h.ring);if(near(alt)<near(ll))ll=alt}
out.push({n:b.n||src,p:ll.map(q=>[q[1],q[0]])})}};
for(const f of txt)await fromText(await f.text(),f.name.replace(/\.[^.]+$/,""));
if(text&&text.trim())await fromText(text,i18("Track"));
if(other.length){const r=await readBoundary(other,"",2);for(const ring of r.R){const ll=await importLL(Object.assign({},r),ring);out.push({n:other[0].name.replace(/\.[^.]+$/,""),p:ll.map(q=>[q[1],q[0]])})}}
return out}
// drop points closer than 0.5 m: positions at 10 Hz add nothing to the coverage
function ifThin(p){const q=[];let last=null;p.forEach(a=>{const w=fromLL(a[0],a[1]);if(!last||Math.hypot(w[0]-last[0],w[1]-last[1])>=.5){q.push(a);last=w}});if(q.length<2&&p.length>=2)return[p[0],p[p.length-1]];return q}
function ifTStatus(){const n=IFT.reduce((s,t)=>s+t.p.length,0);let km=0;IFT.forEach(t=>{for(let i=1;i<t.p.length;i++){const a=fromLL(t.p[i-1][0],t.p[i-1][1]),b=fromLL(t.p[i][0],t.p[i][1]);km+=Math.hypot(b[0]-a[0],b[1]-a[1])/1000}});
$("ifTSt").textContent=IFT.length?i18("{0} tracks, {1} positions, {2} km.",IFT.length,n,km.toFixed(2)):i18("No tracks loaded.")}
const ifStore=()=>{try{IDB.set(ifKey,IFT).catch(()=>{})}catch(e){}};
// mean direction of the tracks (axial, length weighted), 0–180°
function ifTrackAz(){let sx=0,sy=0;IFT.forEach(t=>{for(let i=1;i<t.p.length;i++){const a=fromLL(t.p[i-1][0],t.p[i-1][1]),b=fromLL(t.p[i][0],t.p[i][1]),dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(!l)continue;const th=Math.atan2(dx,dy)*2;sx+=l*Math.cos(th);sy+=l*Math.sin(th)}});
if(!sx&&!sy)return null;let az=Math.atan2(sy,sx)/2/D;az=(az%180+180)%180;return Math.round(az*1000)/1000}
function ifSetAz(az){if(az==null)return;$("az").value=az;$("azN").value=az;if($("azT"))$("azT").textContent=az.toFixed(3);gen();saveSoon()}

// ---- the coverage grid ----
function ifFill(P,x0,y0,c,nx,ny,A,v){// scanline fill of polygon P (world metres) into the grid
let ya=1e30,yb=-1e30;P.forEach(p=>{ya=Math.min(ya,p[1]);yb=Math.max(yb,p[1])});const j0=Math.max(0,Math.floor((ya-y0)/c)),j1=Math.min(ny-1,Math.ceil((yb-y0)/c));
for(let j=j0;j<=j1;j++){const y=y0+(j+.5)*c,xs=[];for(let i=0,k=P.length-1;i<P.length;k=i++){const a=P[k],b=P[i];if((a[1]>y)!=(b[1]>y))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]))}
xs.sort((p,q)=>p-q);for(let k=0;k+1<xs.length;k+=2){const i0=Math.max(0,Math.ceil((xs[k]-x0)/c-.5)),i1=Math.min(nx-1,Math.floor((xs[k+1]-x0)/c-.5));for(let i=i0;i<=i1;i++)A[j*nx+i]=v}}}
function ifCell(){const u=+$("ifC").value;if(u>0)return u;const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),bb=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));
let c=Math.max(.5,params().S/8,Math.sqrt(bb/1.5e6));const B=ifXYZ();if(B&&B.z.length>1){let n=0,a0=1e30,a1=-1e30,b0=1e30,b1=-1e30;for(let i=0;i<B.z.length;i++){const q=fromLL(B.la[i],B.lo[i]);if(!inPoly(q))continue;n++;a0=Math.min(a0,q[0]);a1=Math.max(a1,q[0]);b0=Math.min(b0,q[1]);b1=Math.max(b1,q[1])}
if(n>1)c=Math.max(c,1.5*Math.sqrt(Math.max(1,(a1-a0)*(b1-b0))/n))}// soundings need cells at least as large as their spacing
return +c.toPrecision(2)}
function ifGrid(){IF.g=null;IF.img=null;IF.regions=[];if(!closed||poly.length<3)return;
const c=ifCell(),xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs)-c,y0=Math.min(...ys)-c,nx=Math.ceil((Math.max(...xs)-x0)/c)+1,ny=Math.ceil((Math.max(...ys)-y0)/c)+1;
if(nx*ny>6e6)return;const ins=new Uint8Array(nx*ny),cov=new Uint8Array(nx*ny);ifFill(poly,x0,y0,c,nx,ny,ins,1);
const p=params(),ta=Math.tan(g("ap")*D),ts=Math.tan(g("as")*D),fixed=$("ifWM").value=="fixed",wf=Math.max(0,g("ifWF"))/2;
IFT.forEach(t=>{const w=t.p.map(q=>fromLL(q[0],q[1]));for(let i=1;i<w.length;i++){const a=w[i-1],b=w[i],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(l<1e-6)continue;
const ux=dx/l,uy=dy/l,lx=-uy,ly=ux;let wp,wsb;if(fixed){wp=wsb=wf}else{const d=Math.max(0,depthAt((a[0]+b[0])/2,(a[1]+b[1])/2));wp=d*ta;wsb=d*ts}
const e=c*.5;// a little overlap between segments so bends do not leave slivers
ifFill([[a[0]-ux*e+lx*wp,a[1]-uy*e+ly*wp],[b[0]+ux*e+lx*wp,b[1]+uy*e+ly*wp],[b[0]+ux*e-lx*wsb,b[1]+uy*e-ly*wsb],[a[0]-ux*e-lx*wsb,a[1]-uy*e-ly*wsb]],x0,y0,c,nx,ny,cov,1)}});
const B=ifXYZ();if(B)for(let k=0;k<B.z.length;k++){const q=fromLL(B.la[k],B.lo[k]),i=Math.floor((q[0]-x0)/c),j=Math.floor((q[1]-y0)/c);if(i>=0&&j>=0&&i<nx&&j<ny)cov[j*nx+i]=1}
// gaps: inside and not covered, joined with 8 neighbours
const lab=new Int32Array(nx*ny),regs=[],minA=Math.max(0,g("ifMin"));let nIn=0,nCov=0;
for(let k=0;k<nx*ny;k++)if(ins[k]){nIn++;if(cov[k])nCov++}
const st=new Int32Array(nx*ny);
for(let k=0;k<nx*ny;k++){if(!ins[k]||cov[k]||lab[k])continue;const id=regs.length+1,cells=[];let sp=0;st[sp++]=k;lab[k]=id;
while(sp){const m=st[--sp];cells.push(m);const i=m%nx,j=(m-i)/nx;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){if(!a&&!b)continue;const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=nx||jj>=ny)continue;const q=jj*nx+ii;if(ins[q]&&!cov[q]&&!lab[q]){lab[q]=id;st[sp++]=q}}}
regs.push({id,cells,A:cells.length*c*c})}
IF.regions=regs.filter(r=>r.A>=minA&&r.A>0);IF.g={x0,y0,c,nx,ny,ins,cov,lab};IF.cov=nIn?nCov/nIn:0;IF.gapA=IF.regions.reduce((s,r)=>s+r.A,0);
// the map overlay: one pixel per cell
const cvs=document.createElement("canvas");cvs.width=nx;cvs.height=ny;const g2=cvs.getContext("2d"),im=g2.createImageData(nx,ny),keep=new Uint8Array(regs.length+1);IF.regions.forEach(r=>keep[r.id]=1);
for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;if(!ins[k])continue;const o4=((ny-1-j)*nx+i)*4;if(cov[k]){im.data[o4]=40;im.data[o4+1]=170;im.data[o4+2]=90;im.data[o4+3]=70}else if(keep[lab[k]]){im.data[o4]=220;im.data[o4+1]=40;im.data[o4+2]=40;im.data[o4+3]=150}else{im.data[o4]=230;im.data[o4+1]=150;im.data[o4+2]=40;im.data[o4+3]=90}}
g2.putImageData(im,0,0);IF.img=cvs}

// ---- infill lines: across each gap at the planned spacing ----
gen=function(){R={lines:[],turns:[],cross:[],tl:0,ol:0};IF.regions=[];
if(!closed||poly.length<3){ifShow();return stats()}
ifGrid();const G=IF.g;if(!G||!(IFT.length||ifXYZ())){IF.regions=G?IF.regions:[];ifShow();return stats()}
const{S,Rr}=params(),az=g("az"),u=[Math.sin(az*D),Math.cos(az*D)],n=[Math.cos(az*D),-Math.sin(az*D)],ext=Math.max(0,g("ifExt")),c=G.c,pre=$("pre").value;
const regs=IF.regions.map(r=>{let s0=1e30,s1=-1e30,ss=0;const P=r.cells.map(k=>{const i=k%G.nx,j=(k-i)/G.nx,x=G.x0+(i+.5)*c,y=G.y0+(j+.5)*c,s=x*n[0]+y*n[1],t=x*u[0]+y*u[1];s0=Math.min(s0,s);s1=Math.max(s1,s);ss+=s;return[s,t]});return{r,P,s0,s1,sm:ss/P.length}});
regs.sort((a,b)=>a.sm-b.sm);const segs=[];
regs.forEach((G2,ri)=>{const w=G2.s1-G2.s0+c,nl=Math.max(1,Math.ceil(w/S-1e-9)),mid=(G2.s0+G2.s1)/2;
for(let k=0;k<nl;k++){const s=mid+(k-(nl-1)/2)*S,half=Math.min(S,w)/2+c/2;let t0=1e30,t1=-1e30;G2.P.forEach(q=>{if(Math.abs(q[0]-s)<=half){t0=Math.min(t0,q[1]);t1=Math.max(t1,q[1])}});
if(t0>t1)continue;t0-=c/2+ext;t1+=c/2+ext;segs.push({s,t0,t1,ri,k})}});
segs.forEach((sg,i)=>{const rev=i%2,a=rev?sg.t1:sg.t0,b=rev?sg.t0:sg.t1;sg.a=[n[0]*sg.s+u[0]*a,n[1]*sg.s+u[1]*a];sg.b=[n[0]*sg.s+u[0]*b,n[1]*sg.s+u[1]*b];sg.f=rev?[-u[0],-u[1]]:u});
R.lines=segs.map((s,i)=>({name:pre+(i+1),a:s.a,b:s.b,gap:s.ri+1}));R.sp=segs.slice(1).filter((s,i)=>s.ri==segs[i].ri).map((s,i)=>S);
for(let i=0;i+1<segs.length;i++){const A=segs[i],B=segs[i+1],adj=B.ri==A.ri&&B.k==A.k+1;let pts=[A.b],len=0;
if(adj){const t=turnPts(A.b,A.f,n,B.s-A.s,Rr);pts=pts.concat(t.pts)}pts.push(B.a);for(let j=1;j<pts.length;j++)len+=Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);
R.turns.push({pts,len,ty:adj?((B.s-A.s)<2*Rr?"w":"u"):"t"});R.tl+=len}
ifShow();stats()};
function ifShow(){const G=IF.g,has=IFT.length||ifXYZ();
$("ifCov").textContent=G&&has?(IF.cov*100).toFixed(1)+" %":"-";
$("ifGap").textContent=G&&has?i18("{0} ({1} m²)",IF.regions.length,Math.round(IF.gapA).toLocaleString()):"-";
let t;if(!closed||poly.length<3)t=IFT.length?i18("Use the coverage extent as the area, or draw or import the area (section 9)."):i18("Draw or import the survey area (section 9) and load the coverage.");
else if(!G)t=i18("The area is too large for this grid cell. Enter a larger grid cell.");
else if(!has)t=i18("No coverage loaded yet: add the acquired tracks or load XYZ soundings (section 11).");
else if(!IF.regions.length)t=i18("No gaps larger than {0} m²: the area is covered.",g("ifMin"));
else{const km=R.lines.reduce((s,l)=>s+L(l),0)/1000;t=i18("{0} infill lines, {1} km, across {2} gaps. Grid cell {3} m.",R.lines.length,km.toFixed(2),IF.regions.length,G.c)}
$("ifSt").textContent=t}
// draw the coverage under the lines and the tracks over it
const _ifTiles=drawTiles;drawTiles=function(){_ifTiles();const G=IF.g;if(!G||!IF.img||!$("ifShow").checked||!(IFT.length||ifXYZ()))return;
const a=sc([G.x0,G.y0+G.ny*G.c]),b=sc([G.x0+G.nx*G.c,G.y0]);cx.save();cx.imageSmoothingEnabled=false;cx.drawImage(IF.img,a[0],a[1],b[0]-a[0],b[1]-a[1]);
if(IFT.length){cx.strokeStyle="rgba(20,70,40,.75)";cx.lineWidth=1.2*DPR();IFT.forEach(t=>{cx.beginPath();t.p.forEach((q,i)=>{const s=sc(fromLL(q[0],q[1]));i?cx.lineTo(s[0],s[1]):cx.moveTo(s[0],s[1])});cx.stroke()})}cx.restore()};

// ---- controls ----
$("ifImp").onclick=async()=>{const f=[...$("ifF").files],t=$("ifT").value;if(!f.length&&!t.trim())return $("ifTSt").textContent=i18("Choose a file or paste positions first.");
$("ifTSt").textContent=i18("Reading…");try{const add=await ifRead(f,t);if(!add.length)throw new Error(i18("No line with at least 2 points was found in this file."));
add.forEach(x=>{x.p=ifThin(x.p)});const first=!IFT.length;IFT=IFT.concat(add);$("ifF").value="";$("ifT").value="";ifStore();
if(!closed){ifExtent()}else{if(first)ifSetAz(ifTrackAz());gen();render()}ifTStatus();toast(i18("{0} tracks added.",add.length),3500)}catch(e){$("ifTSt").textContent=i18("Import failed: {0}",e.message)}};
$("ifClr").onclick=()=>{if(IFT.length&&!confirm(i18("Remove all loaded tracks?")))return;IFT=[];ifStore();ifTStatus();gen();render()};
// a convex hull around the tracks' swaths (and the soundings) as the area
function ifExtent(){const P=[];const fixed=$("ifWM").value=="fixed",half=fixed?g("ifWF")/2:Math.max(g("ap"),g("as"))>0?g("depth")*Math.tan(Math.max(g("ap"),g("as"))*D):0;
const LL=[];IFT.forEach(t=>t.p.forEach(q=>LL.push(q)));const B=ifXYZ();if(B)for(let i=0;i<B.z.length;i+=Math.max(1,Math.floor(B.z.length/20000)))LL.push([B.la[i],B.lo[i]]);
if(LL.length<2)return toast(i18("No coverage loaded yet: add the acquired tracks or load XYZ soundings (section 11)."),4000);
const m=LL.reduce((s,q)=>[s[0]+q[0]/LL.length,s[1]+q[1]/LL.length],[0,0]);reorigin(m[0],m[1]);
LL.forEach(q=>{const w=fromLL(q[0],q[1]);for(let k=0;k<8;k++){const a=k*Math.PI/4;P.push([w[0]+Math.cos(a)*half,w[1]+Math.sin(a)*half])}});
const h=ifHull(P);if(h.length<3)return;poly=h;closed=true;draw=false;projC();fit();ifSetAz(ifTrackAz());analyse();gen();render();saveSoon()}
function ifHull(P){P=P.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
up.pop();lo.pop();return lo.concat(up)}
$("ifArea").onclick=ifExtent;$("ifAz").onclick=()=>{const a=ifTrackAz();if(a==null)return toast(i18("No tracks loaded."),3000);ifSetAz(a)};
["ifWM","ifWF","ifX","ifC","ifMin","ifExt"].forEach(id=>$(id).addEventListener("change",()=>{gen();render()}));$("ifShow").addEventListener("change",()=>render());
$("ifCsv").onclick=()=>{const G=IF.g;if(!G||!IF.regions.length)return toast(i18("No gaps to export."),3000);
let t="Gap,Area_m2,Cells,Centre_lat,Centre_lon,Centre_E,Centre_N\n";
IF.regions.forEach((r,i)=>{let x=0,y=0;r.cells.forEach(k=>{const ii=k%G.nx,jj=(k-ii)/G.nx;x+=G.x0+(ii+.5)*G.c;y+=G.y0+(jj+.5)*G.c});x/=r.cells.length;y/=r.cells.length;const ll=toLL([x,y]);let en=["",""];try{const q=oc([x,y]);if(q&&isFinite(q[0]))en=[q[0].toFixed(2),q[1].toFixed(2)]}catch(e){}
t+=[i+1,Math.round(r.A),r.cells.length,ll[0].toFixed(7),ll[1].toFixed(7),en[0],en[1]].join(",")+"\n"});save("coverage_gaps.csv",t,"text/csv")};
SKIPU.add("ifT");
// status lines are built in the current language: rebuild them when it changes
const _ifLang=setLang;setLang=function(){const r=_ifLang.apply(this,arguments);try{ifTStatus();ifShow()}catch(e){}return r};
// plan checks: the overlap is judged against the gaps, and infill needs no cross lines
const _ifSum=summary;summary=function(){_ifSum.apply(this,arguments);if(!R.lines.length)return;
const W=params().W,wS=R.lines.reduce((s,l)=>s+L(l),0)*W,gA=IF.gapA,ov=gA>0&&wS>0?1-gA/wS:NaN;
if($("dCov"))$("dCov").textContent=gA>0&&wS>0?(wS/gA).toFixed(2)+" ×":"–";if($("dOv"))$("dOv").textContent="–";
const pre=t=>i18(t).split("{0}")[0],drop=[pre("Achieved overlap {0} % is below the {1} % target."),pre("Mean achieved overlap {0} % meets the {1} % target."),i18("No cross lines: tick the option in section 3 for QC.")];
const ul=$("chk");[...ul.children].forEach(li=>{const t=li.textContent;if(drop.some(d=>d&&t.startsWith(d)))li.remove()});
const li=document.createElement("li");li.className=wS>=gA?"ok":"bad";li.textContent=i18("Coverage {0} % of the area; the infill lines sweep {1} × the gap area ({2} gaps).",(IF.cov*100).toFixed(1),isFinite(ov)?(wS/gA).toFixed(1):"–",IF.regions.length);ul.prepend(li)};
// restore the tracks saved on this device
(async()=>{try{const t=await IDB.get(ifKey);if(Array.isArray(t)&&t.length){IFT=t.filter(x=>x&&Array.isArray(x.p)&&x.p.length>=2);ifTStatus();gen();render()}}catch(e){}})();
setTimeout(()=>{ifTStatus();gen();render()},0);
