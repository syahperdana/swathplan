/* ===== contour-following lines (survey planner, area shape): the main lines run parallel to one depth contour of the
   loaded bathymetry, offset at the line spacing, cut to the area and to navigable water. Cross lines stay straight.
   Off, or without bathymetry, the straight-line plan is used unchanged. ===== */
const ctrOn=()=>{const c=$("ctr");return!!c&&c.checked&&!MODE().corr&&!MODE().uav&&closed&&poly.length>2};
const ctrPip=(P,p)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>p[1])!=(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c};
const ctrLen=P=>{let s=0;for(let i=1;i<P.length;i++)s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return s};
// marching squares on a grid of values Z ((nx+1) × (ny+1) nodes from x0,y0, cell cs) at one level: joined polylines
function ctrMS(Z,nx,ny,x0,y0,cs,z0){const zv=(i,j)=>Z[j*(nx+1)+i],eid=(i,j,v)=>(j*(nx+1)+i)*2+v,
pt=(i1,j1,i2,j2)=>{const a=zv(i1,j1),b=zv(i2,j2),t=Math.abs(b-a)<1e-12?.5:(z0-a)/(b-a);return[x0+(i1+(i2-i1)*t)*cs,y0+(j1+(j2-j1)*t)*cs]},S=[];
for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=zv(i,j)>z0,b=zv(i+1,j)>z0,c=zv(i+1,j+1)>z0,d=zv(i,j+1)>z0;if(a==b&&b==c&&c==d)continue;
const E={B:[eid(i,j,0),()=>pt(i,j,i+1,j)],Rt:[eid(i+1,j,1),()=>pt(i+1,j,i+1,j+1)],T:[eid(i,j+1,0),()=>pt(i,j+1,i+1,j+1)],Lf:[eid(i,j,1),()=>pt(i,j,i,j+1)]},
add=(e1,e2)=>S.push([E[e1][0],E[e1][1](),E[e2][0],E[e2][1]()]),cr=[];if(a!=b)cr.push("B");if(b!=c)cr.push("Rt");if(c!=d)cr.push("T");if(d!=a)cr.push("Lf");
if(cr.length==2)add(cr[0],cr[1]);else{const m=(zv(i,j)+zv(i+1,j)+zv(i+1,j+1)+zv(i,j+1))/4>z0;
if(a)(m?(add("B","Rt"),add("T","Lf")):(add("Lf","B"),add("Rt","T")));else(m?(add("Lf","B"),add("Rt","T")):(add("B","Rt"),add("T","Lf")))}}
const at=new Map();S.forEach((s,k)=>{[s[0],s[2]].forEach(e=>{const l=at.get(e);l?l.push(k):at.set(e,[k])})});const used=new Uint8Array(S.length),out=[];
const walk=(e,arr)=>{for(;;){const l=at.get(e)||[],n=l.find(x=>!used[x]);if(n===undefined)return;used[n]=1;const s=S[n];if(s[0]==e){arr.push(s[3]);e=s[2]}else{arr.push(s[1]);e=s[0]}}};
S.forEach((s,k)=>{if(used[k])return;used[k]=1;const f=[s[1],s[3]];walk(s[2],f);const b=[];walk(s[0],b);out.push(b.reverse().concat(f))});return out}
// a grid over the area with a margin, sized to about 300 cells across
function ctrGrid(m){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),ext=Math.max(arrMax(xs)-arrMin(xs),arrMax(ys)-arrMin(ys)),cs=Math.max(5,ext/300),
x0=arrMin(xs)-m-cs,y0=arrMin(ys)-m-cs;return{cs,x0,y0,nx:Math.ceil((arrMax(xs)+m+cs-x0)/cs),ny:Math.ceil((arrMax(ys)+m+cs-y0)/cs)}}
// the contour at depth z0, and the depth range inside the area
function ctrTrace(z0){const G=ctrGrid(0),Z=new Float64Array((G.nx+1)*(G.ny+1));let zmin=1e30,zmax=-1e30;
for(let j=0;j<=G.ny;j++)for(let i=0;i<=G.nx;i++){const x=G.x0+i*G.cs,y=G.y0+j*G.cs,z=depthAt(x,y);Z[j*(G.nx+1)+i]=z;if(ctrPip(poly,[x,y])){zmin=Math.min(zmin,z);zmax=Math.max(zmax,z)}}
return{lines:ctrMS(Z,G.nx,G.ny,G.x0,G.y0,G.cs,z0),zmin,zmax,cs:G.cs}}
// signed distance from the base line (positive to starboard) and the station along it, on a grid
function ctrField(base,G){const n=(G.nx+1)*(G.ny+1),F=new Float64Array(n),C=[0];for(let i=1;i<base.length;i++)C.push(C[i-1]+Math.hypot(base[i][0]-base[i-1][0],base[i][1]-base[i-1][1]));
for(let j=0;j<=G.ny;j++)for(let i=0;i<=G.nx;i++){const x=G.x0+i*G.cs,y=G.y0+j*G.cs;F[j*(G.nx+1)+i]=ctrNear(base,C,[x,y]).sd}return F}
function ctrNear(base,C,p){let bd=1e30,sd=0,st=0;for(let k=1;k<base.length;k++){const a=base[k-1],b=base[k],ex=b[0]-a[0],ey=b[1]-a[1],L2=ex*ex+ey*ey||1e-9;
let t=((p[0]-a[0])*ex+(p[1]-a[1])*ey)/L2;t=Math.max(0,Math.min(1,t));const d=Math.hypot(a[0]+t*ex-p[0],a[1]+t*ey-p[1]);
if(d<bd){bd=d;sd=(ex*(p[1]-a[1])-ey*(p[0]-a[0]))>0?-d:d;st=C[k-1]+t*Math.sqrt(L2)}}return{d:bd,sd,st}}
// Chaikin smoothing that keeps the ends, then drop points closer than d
function ctrSmooth(P,d){let Q=P;for(let r=0;r<2;r++){if(Q.length<3)break;const o=[Q[0]];for(let i=0;i<Q.length-1;i++){const a=Q[i],b=Q[i+1];o.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]])}o.push(Q[Q.length-1]);Q=o}
const o=[Q[0]];for(let i=1;i<Q.length-1;i++)if(Math.hypot(Q[i][0]-o[o.length-1][0],Q[i][1]-o[o.length-1][1])>=d)o.push(Q[i]);o.push(Q[Q.length-1]);return o}
// Douglas-Peucker, to keep the exported lines small
function ctrDP(P,tol){if(P.length<3)return P;const keep=new Uint8Array(P.length);keep[0]=keep[P.length-1]=1;const st=[[0,P.length-1]];
while(st.length){const[a,b]=st.pop();let m=-1,dm=tol;for(let i=a+1;i<b;i++){const d=tlPS(P[a][0],P[a][1],P[b][0],P[b][1],P[i]);if(d>dm){dm=d;m=i}}if(m>0){keep[m]=1;st.push([a,m],[m,b])}}
return P.filter((_,i)=>keep[i])}
// is a point usable: inside the area and, with trimming on and a coastline loaded, on water outside the clearance
function ctrKeeper(step){const trim=$("trim").checked&&cst&&cst.seg&&cst.seg.length,I=trim&&typeof tlIndex=="function"?tlIndex():null,cl=Math.max(0,g("clr")),r=Math.max(cl,step),S=cst.seg;
let need=true,land=false;return p=>{if(!ctrPip(poly,p)){need=true;return false}if(!I)return true;let d=1e30;for(const k of tlNear(I,p,p,r))d=Math.min(d,tlPS(S[k],S[k+1],S[k+2],S[k+3],p));
if(d<r){need=true;return d>=cl&&!isLand(p)}if(need){land=isLand(p);need=false}return!land}}
// a polyline cut into the pieces that are usable, ends refined by bisection
function ctrClip(q,step,ok){const P=[];for(let i=1;i<q.length;i++){const a=q[i-1],b=q[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let k=i==1?0:1;k<=n;k++)P.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}
const K=P.map(ok),edge=(i,o)=>{let a=P[i],b=P[o];for(let r=0;r<8;r++){const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(ctrPip(poly,m)&&ok(m))a=m;else b=m}return a},out=[];let cur=null;
for(let i=0;i<P.length;i++){if(K[i]){if(!cur){cur=i>0?[edge(i,i-1)]:[];}cur.push(P[i])}else if(cur){cur.push(edge(i-1,i));out.push(cur);cur=null}}if(cur)out.push(cur);return out}
let CTR_MSG=null;const ctrMsg=()=>CTR_MSG?(CTR_MSG.raw||i18(...CTR_MSG)):"";
// the lines: offsets of the extended contour at multiples of the spacing, serpentine order
function ctrPlan(Rr,S){CTR_MSG=null;if(!bath||!bath.z||!bath.z.length){CTR_MSG=["Load bathymetry first (section {§gbath} or {§xyz}); straight lines are used until then."];return false}
const z0=g("ctrD")>0?g("ctrD"):g("depth"),T=ctrTrace(z0),f1z=v=>(Math.round(v*10)/10).toFixed(1),inArea=P=>P.filter(p=>ctrPip(poly,p)).length;
let best=null,bs=0;T.lines.forEach(P=>{const s=inArea(P);if(P.length>1&&s>bs){bs=s;best=P}});
if(!best){CTR_MSG=["No {0} m contour crosses the area; straight lines are used. Depths in the area: {1} to {2} m.",f1z(z0),f1z(T.zmin),f1z(T.zmax)];return false}
const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),diag=Math.hypot(arrMax(xs)-arrMin(xs),arrMax(ys)-arrMin(ys));
const base=ctrDP(CG.extend(ctrSmooth(best,T.cs/2),diag),T.cs/8),C=[0];for(let i=1;i<base.length;i++)C.push(C[i-1]+Math.hypot(base[i][0]-base[i-1][0],base[i][1]-base[i-1][1]));
const dmax=Math.max(...poly.map(p=>ctrNear(base,C,p).d)),K=Math.ceil(dmax/S)+1;if(2*K+1>800){CTR_MSG=["Too many contour lines for this area at this spacing; straight lines are used."];return false}
// offset lines: level sets of the signed distance, so they never loop or cross
const G=ctrGrid(0),F=ctrField(base,G),step=Math.max(2,Math.min(S/4,25)),ok=ctrKeeper(step),rows=[];
for(let k=-K;k<=K;k++){const pcs=[];ctrMS(F,G.nx,G.ny,G.x0,G.y0,G.cs,k*S).forEach(q=>{if(q.length<2)return;if(ctrNear(base,C,q[0]).st>ctrNear(base,C,q[q.length-1]).st)q=q.slice().reverse();
ctrClip(ctrSmooth(q,0),step,ok).forEach(p=>{p=ctrDP(p,.5);if(p.length>1&&ctrLen(p)>=Math.min(50,S))pcs.push({p,st:ctrNear(base,C,p[0]).st})})});
pcs.sort((a,b)=>a.st-b.st);if(pcs.length)rows.push({off:k*S,pc:pcs.map(o=>o.p)})}
if(!rows.length){CTR_MSG=["No {0} m contour crosses the area; straight lines are used. Depths in the area: {1} to {2} m.",f1z(z0),f1z(T.zmin),f1z(T.zmax)];return false}
R.lines=[];rows.forEach((r,ri)=>{let pc=r.pc;if(ri%2)pc=pc.slice().reverse().map(p=>p.slice().reverse());pc.forEach(p=>R.lines.push({name:$("pre").value+(R.lines.length+1),a:p[0],b:p[p.length-1],p,off:r.off,row:ri}))});
R.sp=rows.slice(1).map((r,i)=>Math.abs(r.off-rows[i].off));R.ctr={z:z0};ctrTurns(Rr);
CTR_MSG=["Lines follow the {0} m contour: {1} lines, {2} m apart.",f1z(z0),R.lines.length,f1z(S)];return true}
// turns: to the next row a Williamson or U-turn (as in corridors), along the same row a straight transit
function ctrTurns(Rr){R.turns=[];R.tl=0;for(let i=0;i+1<R.lines.length;i++){const A=R.lines[i],B=R.lines[i+1];let pts=[A.b],ty="t";const S=Math.abs(B.off-A.off);
if(B.row==A.row+1){const q=A.p,n=q.length,u=[q[n-1][0]-q[n-2][0],q[n-1][1]-q[n-2][1]],m=Math.hypot(u[0],u[1])||1,f=[u[0]/m,u[1]/m],w=[B.a[0]-A.b[0],B.a[1]-A.b[1]];
let nn=[f[1],-f[0]];if(nn[0]*w[0]+nn[1]*w[1]<0)nn=[-nn[0],-nn[1]];pts=pts.concat(turnPts(A.b,f,nn,S,Rr).pts);ty=S<2*Rr?"w":"u"}
pts.push(B.a);const len=ctrLen(pts);R.turns.push({pts,len,ty});R.tl+=len}}
{const _g=gen;gen=function(){const box=$("ctrBox");if(box)box.hidden=MODE().uav;if(!ctrOn()){const st=$("ctrSt");if(st)st.textContent="";return _g.apply(this,arguments)}
_g.apply(this,arguments);const keep={lines:R.lines,turns:R.turns,tl:R.tl,sp:R.sp},p=params();let ok=false;try{ok=ctrPlan(p.Rr,p.S)}catch(e){CTR_MSG={raw:String(e&&e.message||e)};ok=false}
if(!ok){R.lines=keep.lines;R.turns=keep.turns;R.tl=keep.tl;R.sp=keep.sp;delete R.ctr}const st=$("ctrSt");if(st){st.textContent=ctrMsg();st.className="note"+(ok?"":" warn")}stats()}}
// the box is only wired up in the survey planner
{const b=$("ctrBox");if(b){b.hidden=false;$("ctr").addEventListener("change",()=>gen());$("ctrD").addEventListener("input",()=>genD())}}
{const b=$("ctrBox");if(b)setTimeout(()=>{if($("ctr").checked&&closed)gen()},0)}
{const _sl=setLang;setLang=function(){const r=_sl.apply(this,arguments);try{const st=$("ctrSt");if(st&&ctrOn())st.textContent=ctrMsg()}catch(e){}return r}}
