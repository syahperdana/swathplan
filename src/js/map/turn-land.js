/* ===== turns against the coastline: a turn that crosses the coast, comes within the safety clearance, or lies on land
   is flagged in the plan checks and drawn in red on the map (needs a loaded coastline) ===== */
let TL_IDX=null,TL_BAD=[];
// a grid of the coastline segments, rebuilt when the coastline changes
function tlIndex(){if(!cst||!cst.seg||!cst.seg.length)return null;if(TL_IDX&&TL_IDX.ref===cst.seg)return TL_IDX;
const S=cst.seg,cs=Math.max(200,4*Math.max(0,g("clr"))),G=new Map(),key=(i,j)=>i+","+j;
for(let k=0;k<S.length;k+=4){const x0=Math.min(S[k],S[k+2]),x1=Math.max(S[k],S[k+2]),y0=Math.min(S[k+1],S[k+3]),y1=Math.max(S[k+1],S[k+3]);
for(let i=Math.floor(x0/cs);i<=Math.floor(x1/cs);i++)for(let j=Math.floor(y0/cs);j<=Math.floor(y1/cs);j++){const kk=key(i,j);let a=G.get(kk);if(!a)G.set(kk,a=[]);a.push(k)}}
TL_IDX={ref:S,cs,G,key};return TL_IDX}
// segments in the cells around a piece of a turn, widened by r
function tlNear(I,p,q,r){const o=new Set(),i0=Math.floor((Math.min(p[0],q[0])-r)/I.cs),i1=Math.floor((Math.max(p[0],q[0])+r)/I.cs),j0=Math.floor((Math.min(p[1],q[1])-r)/I.cs),j1=Math.floor((Math.max(p[1],q[1])+r)/I.cs);
if((i1-i0+1)*(j1-j0+1)>4e4){for(const a of I.G.values())a.forEach(k=>o.add(k));return o}
for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const a=I.G.get(I.key(i,j));if(a)a.forEach(k=>o.add(k))}return o}
const tlPS=(x1,y1,x2,y2,p)=>{const ex=x2-x1,ey=y2-y1,L2=ex*ex+ey*ey||1e-9;let t=((p[0]-x1)*ex+(p[1]-y1)*ey)/L2;t=Math.max(0,Math.min(1,t));return Math.hypot(x1+t*ex-p[0],y1+t*ey-p[1])};
const tlCross=(a,b,c,d)=>{const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0};
// shortest distance between a piece of a turn (a-b) and coastline segment k: 0 when they cross
function tlSS(S,k,a,b){const c=[S[k],S[k+1]],d=[S[k+2],S[k+3]];if(tlCross(a,b,c,d))return 0;
return Math.min(tlPS(c[0],c[1],d[0],d[1],a),tlPS(c[0],c[1],d[0],d[1],b),tlPS(a[0],a[1],b[0],b[1],c),tlPS(a[0],a[1],b[0],b[1],d))}
// indices of turns that touch land: crossing, inside the clearance, or wholly on land
function tlCheck(){TL_BAD=[];const I=tlIndex();if(!I||!R.turns||!R.turns.length)return TL_BAD;const S=cst.seg,cl=Math.max(0,g("clr"));
R.turns.forEach((t,ti)=>{if(!t||!t.pts||t.pts.length<2)return;const P=t.pts;let hit=false;
for(let i=1;i<P.length&&!hit;i++)for(const k of tlNear(I,P[i-1],P[i],cl))if(tlSS(S,k,P[i-1],P[i])<cl||(cl===0&&tlSS(S,k,P[i-1],P[i])===0)){hit=true;break}
if(!hit&&isLand(P[Math.floor(P.length/2)]))hit=true;if(hit)TL_BAD.push(ti)});return TL_BAD}
// plan checks: one line, ok or not
{const _sum=summary;summary=function(){const r=_sum.apply(this,arguments);try{if(window.SWP_UAV||!cst||!cst.seg||!cst.seg.length||!R.turns.length){TL_BAD=[];return r}
const B=tlCheck(),ul=$("chk"),cl=Math.max(0,g("clr"));if(!ul)return r;
ul.insertAdjacentHTML("afterbegin",B.length?'<li class="bad">'+i18("{0} of {1} turns cross land or come within the {2} m clearance (red on the map). Shorten the lines at those ends, use a smaller turning radius, or move the boundary away from the coast.",B.length,R.turns.filter(t=>t).length,cl)+"</li>":'<li class="ok">'+i18("All turns stay at least {0} m from the coastline.",cl)+"</li>")}catch(e){}return r}}
// the map: flagged turns drawn over in red
{const _rd=render;render=function(){const r=_rd.apply(this,arguments);if(!TL_BAD.length)return r;const k=DPR();cx.save();cx.strokeStyle="#e0001b";cx.lineWidth=3.2*k;
TL_BAD.forEach(ti=>{const t=R.turns[ti];if(!t)return;cx.beginPath();t.pts.forEach((p,i)=>{const s=sc(p);i?cx.lineTo(s[0],s[1]):cx.moveTo(s[0],s[1])});cx.stroke()});cx.restore();return r}}
