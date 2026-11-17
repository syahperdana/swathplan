// ---- depth model and optimal (adaptive) line positions
let DG=null;
const dgStamp=()=>o.lat+","+o.lon+","+(bath?bath.z.length:0)+","+poly.length+","+(poly[0]||[]).join();
function buildDG(){DG=null;if(!bath||!bath.z.length||!poly.length)return;const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),m=1500,x0=arrMin(xs)-m,x1=arrMax(xs)+m,y0=arrMin(ys)-m,y1=arrMax(ys)+m,N=bath.z.length;
// count the points in the box first (cell size: about 40 000 cells over the box), then sum them per cell in typed arrays
const kx=111320*Math.cos(o.lat*D),ky=111132.9;let P=0;for(let i=0;i<N;i++){const x=(bath.lo[i]-o.lon)*kx,y=(bath.la[i]-o.lat)*ky;if(x>=x0&&x<=x1&&y>=y0&&y<=y1)P++}
if(!P)return;const cs=Math.max(5,Math.sqrt((x1-x0)*(y1-y0)/Math.min(40000,P))),nx=Math.ceil((x1-x0)/cs)+1,ny=Math.ceil((y1-y0)/cs)+1,S=new Float64Array(nx*ny),C=new Uint32Array(nx*ny);
for(let i=0;i<N;i++){const x=(bath.lo[i]-o.lon)*kx,y=(bath.la[i]-o.lat)*ky;if(x<x0||x>x1||y<y0||y>y1)continue;const k=Math.floor((y-y0)/cs)*nx+Math.floor((x-x0)/cs);S[k]+=bath.z[i];C[k]++}
const cells=new Map();let zmax=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;if(!C[k])continue;cells.set(i*100000+j,[S[k],C[k]]);zmax=Math.max(zmax,S[k]/C[k])}
DG={cs,x0,y0,cells,zmax:zmax||g("depth"),stamp:dgStamp()}}
function depthAt(x,y){const d=depthRaw(x,y);return d==null?g("depth"):Math.max(.5,d)}
// the mean depth of the nearest model cell (null without a model); may be zero or negative over drying ground
function depthRaw(x,y){if(!DG||DG.stamp!=dgStamp())buildDG();if(!DG||!DG.cells.size)return null;const ix=Math.floor((x-DG.x0)/DG.cs),iy=Math.floor((y-DG.y0)/DG.cs);
for(let r=0;r<=8;r++){let m=1e30;for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){if(Math.max(Math.abs(a),Math.abs(b))!=r)continue;const c=DG.cells.get((ix+a)*100000+iy+b);if(c)m=Math.min(m,c[0]/c[1])}if(m<1e29)return m}return null}
function linePositions(s0,s1,n,u,S,fast){const ov=g("ov")/100,W=params().W,ad=$("adp").checked&&bath&&bath.z.length;
if(!ad){S=Math.max(S,.05,(s1-s0)/3000);const out=[];let s=s0+S/2;if(s>s1)return[(s0+s1)/2];out.push(s);for(;out.length<4000;){const nx=s+S;if(nx<=s1){out.push(nx);s=nx;continue}if(s+W/2<s1){const f=Math.min(nx,s1-.05*S);if(f>s+1e-6)out.push(f)}break}return out}
const tp=Math.tan(g("ap")*D),ts=Math.tan(g("as")*D),mw=g("mxW")>0?g("mxW"):1e18,tv=poly.map(p=>p[0]*u[0]+p[1]*u[1]),stp=Math.max(5,(arrMax(tv)-arrMin(tv))/(fast?60:150)),
hw=(d,k,plus)=>Math.min(d*((k%2==0)==plus?ts:tp),mw/2),Wt=d=>Math.min(d*(tp+ts),mw),dmn=Math.max(.1,adpMin()),dep=(q,t)=>{const d=depthRaw(n[0]*q+u[0]*t,n[1]*q+u[1]*t);return d==null?g("depth"):d>=dmn?d:null},
prof=q=>{const a=[];chords(poly,n,u,q).forEach(c=>{const m=Math.max(2,Math.ceil((c[1]-c[0])/stp)+1);for(let i=0;i<m;i++)a.push(c[0]+(c[1]-c[0])*i/(m-1))});return a};
if(!DG||DG.stamp!=dgStamp())buildDG();const zmax=DG?DG.zmax:g("depth"),Smax=g("mxS")>0?g("mxS"):Math.min(zmax*(tp+ts),mw)*(1-ov),Smin=.5;
let T=prof(s0+S/2);if(!T.length)T=prof(s0+S);const D0=T.map(t=>dep(s0+S/2,t)).filter(d=>d!=null),dmin=D0.length?Math.min(...D0):zmax,Sf=Math.max(Smin,Math.min(Smax,Math.min(dmin*(tp+ts),mw)*(1-ov)));
let s=s0+Sf/2;if(s>s1)return[(s0+s1)/2];const out=[s];let k=0;
for(let it=0;it<3000;it++){const Tp=prof(s),Dp=Tp.map(t=>dep(s,t)).filter(d=>d!=null),mh=Dp.length?Math.min(...Dp.map(d=>hw(d,k,true))):hw(Tp.length?zmax:g("depth"),k,true);if(s+mh>=s1)break;
const F=sn=>{const T=prof(sn);if(!T.length)return 1;let m=1e30;for(const t of T){const dp=dep(s,t),dn=dep(sn,t);if(dp==null||dn==null)continue;m=Math.min(m,hw(dp,k,true)+hw(dn,k+1,false)-ov*(Wt(dp)+Wt(dn))/2)}return m>=1e29?Smax-(sn-s):m-(sn-s)};
let hi=Math.min(s+Smax,s1-Math.max(.5,.01*Smax));if(hi<=s+1e-6)break;let lo=Math.min(s+Smin,hi);
if(!prof(hi).length)for(let j=19;j>=1;j--){const q=s+(hi-s)*j/20;if(prof(q).length){hi=q;break}}
let sn;if(F(hi)>=0)sn=hi;else if(F(lo)<0)sn=lo;else{for(let i=0,ni=fast?13:28;i<ni;i++){const mid=(lo+hi)/2;if(F(mid)>=0)lo=mid;else hi=mid}sn=lo}
out.push(sn);s=sn;k++}return out}

// adaptive spacing leaves out depths shallower than this (drying ground, water too shallow to cover): without it one
// shoal or drying bank along a line would set the spacing of the whole line
const adpMin=()=>{const v=g("adpMin");return isFinite(v)?v:2};
// share of the depth model inside the area that is shallower than that (for the plan checks)
function adpShallowShare(){if(!$("adp").checked||!bath||!bath.z.length||!closed)return null;if(!DG||DG.stamp!=dgStamp())buildDG();if(!DG)return null;const T=polyTester(poly),dm=adpMin();let a=0,b=0;
DG.cells.forEach((c,k)=>{const ix=Math.floor(k/100000),iy=k-ix*100000,x=DG.x0+(ix+.5)*DG.cs,y=DG.y0+(iy+.5)*DG.cs;if(!T(x,y))return;b++;if(c[0]/c[1]<dm)a++});return b?{f:a/b,dm}:null}
// the general direction of the depth contours in the area: a plane fitted to the depth model (null when nearly flat)
function contourAz(){if(!bath||!bath.z.length||!closed)return null;if(!DG||DG.stamp!=dgStamp())buildDG();if(!DG)return null;const T=polyTester(poly);let n=0,sx=0,sy=0,sz=0,sxx=0,syy=0,sxy=0,sxz=0,syz=0,zmin=1e9,zmax=-1e9;
DG.cells.forEach((c,k)=>{const ix=Math.floor(k/100000),iy=k-ix*100000,x=DG.x0+(ix+.5)*DG.cs,y=DG.y0+(iy+.5)*DG.cs,z=c[0]/c[1];if(!T(x,y)||z<adpMin())return;n++;sx+=x;sy+=y;sz+=z;sxx+=x*x;syy+=y*y;sxy+=x*y;sxz+=x*z;syz+=y*z;zmin=Math.min(zmin,z);zmax=Math.max(zmax,z)});
if(n<20)return null;const mx=sx/n,my=sy/n,mz=sz/n,Cxx=sxx/n-mx*mx,Cyy=syy/n-my*my,Cxy=sxy/n-mx*my,Cxz=sxz/n-mx*mz,Cyz=syz/n-my*mz,det=Cxx*Cyy-Cxy*Cxy;if(Math.abs(det)<1e-9)return null;
const a=(Cxz*Cyy-Cyz*Cxy)/det,b=(Cyz*Cxx-Cxz*Cxy)/det,ext=Math.sqrt(Cxx+Cyy)*2;if(Math.hypot(a,b)*ext<.25*Math.max(1,zmax-zmin)&&Math.hypot(a,b)*ext<1)return null;
return((Math.atan2(-b,a)/D)%180+180)%180}
