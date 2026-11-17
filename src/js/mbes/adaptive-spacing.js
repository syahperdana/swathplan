// ---- depth model and optimal (adaptive) line positions
let DG=null;
const dgStamp=()=>o.lat+","+o.lon+","+(bath?bath.z.length:0)+","+poly.length+","+(poly[0]||[]).join();
function buildDG(){DG=null;if(!bath||!bath.z.length||!poly.length)return;const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),m=1500,x0=arrMin(xs)-m,x1=arrMax(xs)+m,y0=arrMin(ys)-m,y1=arrMax(ys)+m,P=[];
for(let i=0;i<bath.z.length;i++){const p=fromLL(bath.la[i],bath.lo[i]);if(p[0]<x0||p[0]>x1||p[1]<y0||p[1]>y1)continue;P.push([p[0],p[1],bath.z[i]])}
if(!P.length)return;const cs=Math.max(5,Math.sqrt((x1-x0)*(y1-y0)/Math.min(40000,P.length))),cells=new Map();let zmax=0;
P.forEach(p=>{const k=Math.floor((p[0]-x0)/cs)*100000+Math.floor((p[1]-y0)/cs),c=cells.get(k)||[0,0];c[0]+=p[2];c[1]++;cells.set(k,c)});cells.forEach(c=>{zmax=Math.max(zmax,c[0]/c[1])});DG={cs,x0,y0,cells,zmax:zmax||g("depth"),stamp:dgStamp()}}
function depthAt(x,y){if(!DG||DG.stamp!=dgStamp())buildDG();if(!DG||!DG.cells.size)return g("depth");const ix=Math.floor((x-DG.x0)/DG.cs),iy=Math.floor((y-DG.y0)/DG.cs);
for(let r=0;r<=8;r++){let m=1e30;for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){if(Math.max(Math.abs(a),Math.abs(b))!=r)continue;const c=DG.cells.get((ix+a)*100000+iy+b);if(c)m=Math.min(m,c[0]/c[1])}if(m<1e29)return Math.max(.5,m)}return g("depth")}
function linePositions(s0,s1,n,u,S){const ov=g("ov")/100,W=params().W,ad=$("adp").checked&&bath&&bath.z.length;
if(!ad){S=Math.max(S,.05,(s1-s0)/3000);const out=[];let s=s0+S/2;if(s>s1)return[(s0+s1)/2];out.push(s);for(;out.length<4000;){const nx=s+S;if(nx<=s1){out.push(nx);s=nx;continue}if(s+W/2<s1){const f=Math.min(nx,s1-.05*S);if(f>s+1e-6)out.push(f)}break}return out}
const tp=Math.tan(g("ap")*D),ts=Math.tan(g("as")*D),mw=g("mxW")>0?g("mxW"):1e18,tv=poly.map(p=>p[0]*u[0]+p[1]*u[1]),stp=Math.max(5,(arrMax(tv)-arrMin(tv))/150),
hw=(d,k,plus)=>Math.min(d*((k%2==0)==plus?ts:tp),mw/2),Wt=d=>Math.min(d*(tp+ts),mw),dep=(q,t)=>depthAt(n[0]*q+u[0]*t,n[1]*q+u[1]*t),
prof=q=>{const a=[];chords(poly,n,u,q).forEach(c=>{const m=Math.max(2,Math.ceil((c[1]-c[0])/stp)+1);for(let i=0;i<m;i++)a.push(c[0]+(c[1]-c[0])*i/(m-1))});return a};
if(!DG||DG.stamp!=dgStamp())buildDG();const zmax=DG?DG.zmax:g("depth"),Smax=g("mxS")>0?g("mxS"):Math.min(zmax*(tp+ts),mw)*(1-ov),Smin=.5;
let T=prof(s0+S/2);if(!T.length)T=prof(s0+S);const dmin=T.length?Math.min(...T.map(t=>dep(s0+S/2,t))):g("depth"),Sf=Math.max(Smin,Math.min(Smax,Math.min(dmin*(tp+ts),mw)*(1-ov)));
let s=s0+Sf/2;if(s>s1)return[(s0+s1)/2];const out=[s];let k=0;
for(let it=0;it<3000;it++){const Tp=prof(s),mh=Tp.length?Math.min(...Tp.map(t=>hw(dep(s,t),k,true))):hw(g("depth"),k,true);if(s+mh>=s1)break;
const F=sn=>{const T=prof(sn);if(!T.length)return 1;let m=1e30;for(const t of T){const dp=dep(s,t),dn=dep(sn,t);m=Math.min(m,hw(dp,k,true)+hw(dn,k+1,false)-ov*(Wt(dp)+Wt(dn))/2)}return m-(sn-s)};
let hi=Math.min(s+Smax,s1-Math.max(.5,.01*Smax));if(hi<=s+1e-6)break;let lo=Math.min(s+Smin,hi);
if(!prof(hi).length)for(let j=19;j>=1;j--){const q=s+(hi-s)*j/20;if(prof(q).length){hi=q;break}}
let sn;if(F(hi)>=0)sn=hi;else if(F(lo)<0)sn=lo;else{for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(F(mid)>=0)lo=mid;else hi=mid}sn=lo}
out.push(sn);s=sn;k++}return out}

