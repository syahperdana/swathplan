/* ===== corridor geometry: offsets, KP, cross lines (plan frame, metres) ===== */
// Offsets are measured to the right of the route direction: positive = starboard, negative = port.
const CG=(()=>{
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],add=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k],len=v=>Math.hypot(v[0],v[1]);
function clean(P){const o=[];P.forEach(p=>{if(!o.length||len(sub(p,o[o.length-1]))>1e-6)o.push([p[0],p[1]])});return o}
function chain(P){const c=[0];for(let i=1;i<P.length;i++)c.push(c[i-1]+len(sub(P[i],P[i-1])));return c}
// point and unit tangent at chainage s along P
function at(P,C,s){s=Math.max(0,Math.min(C[C.length-1],s));let i=1;while(i<C.length-1&&C[i]<s)i++;
const a=P[i-1],b=P[i],L=C[i]-C[i-1]||1,t=(s-C[i-1])/L,u=sub(b,a),m=len(u)||1;return{p:[a[0]+u[0]*t,a[1]+u[1]*t],u:[u[0]/m,u[1]/m]}}
function segX(a,b,c,d){const r=sub(b,a),s=sub(d,c),den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;
const q=sub(c,a),t=(q[0]*s[1]-q[1]*s[0])/den,u=(q[0]*r[1]-q[1]*r[0])/den;return t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9?{t,p:[a[0]+r[0]*t,a[1]+r[1]*t]}:null}
// cut out the small loops an offset forms on the inside of tight bends
function unloop(Q,d){const lim=Math.max(50,30*Math.abs(d));let i=0;const out=Q.slice();
while(i<out.length-3){let cut=null,run=0;for(let j=i+2;j<out.length-1;j++){run+=len(sub(out[j],out[j-1]));if(run>lim)break;const x=segX(out[i],out[i+1],out[j],out[j+1]);if(x)cut={j,p:x.p}}
if(cut){out.splice(i+1,cut.j-i,cut.p)}else i++}return out}
function offset(P,d,step=10){if(P.length<2||Math.abs(d)<1e-9)return P.map(p=>[p[0],p[1]]);
const S=[];for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],v=sub(b,a),m=len(v);if(m<1e-9)continue;const u=[v[0]/m,v[1]/m],n=[u[1],-u[0]];S.push({a:add(a,n,d),b:add(b,n,d),u,v:b})}
if(!S.length)return P.map(p=>[p[0],p[1]]);const out=[S[0].a];
for(let i=0;i<S.length-1;i++){const A=S[i],B=S[i+1],cr=A.u[0]*B.u[1]-A.u[1]*B.u[0],dot=A.u[0]*B.u[0]+A.u[1]*B.u[1];
if(Math.abs(cr)<1e-9&&dot>0){out.push(A.b);continue}
if(cr*d>0||(Math.abs(cr)<1e-9&&dot<0)){// outer side of the bend: round join around the route vertex
const V=A.v,a0=Math.atan2(A.b[1]-V[1],A.b[0]-V[0]);let a1=Math.atan2(B.a[1]-V[1],B.a[0]-V[0]),da=a1-a0;
while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;const k=Math.max(1,Math.ceil(Math.abs(da)/(step*Math.PI/180))),r=Math.abs(d);
for(let j=0;j<=k;j++){const q=a0+da*j/k;out.push([V[0]+r*Math.cos(q),V[1]+r*Math.sin(q)])}}
else{// inner side: meet where the two offset segments cross
const r=sub(A.b,A.a),s=sub(B.b,B.a),den=r[0]*s[1]-r[1]*s[0],q=sub(B.a,A.a),t=(q[0]*s[1]-q[1]*s[0])/den;out.push([A.a[0]+r[0]*t,A.a[1]+r[1]*t])}}
out.push(S[S.length-1].b);return unloop(clean(out),d)}
function extend(Q,e){if(e<=0||Q.length<2)return Q;const q=Q.map(p=>[p[0],p[1]]),n=q.length,
u0=sub(q[0],q[1]),m0=len(u0)||1,u1=sub(q[n-1],q[n-2]),m1=len(u1)||1;q[0]=add(q[0],u0,e/m0);q[n-1]=add(q[n-1],u1,e/m1);return q}
// "0, ±25, -50 50" -> sorted unique offsets
function parseOffsets(t){const o=[];String(t||"").replace(/[;\s]+/g,",").split(",").forEach(x=>{x=x.trim();if(!x)return;const pm=/^(±|\+\/-|\+-)/.test(x),v=parseFloat(x.replace(/^(±|\+\/-|\+-)/,""));
if(!isFinite(v))return;if(pm){o.push(v,-v)}else o.push(v)});return[...new Set(o.map(v=>Math.round(v*100)/100))].sort((a,b)=>a-b)}
// offsets that cover the corridor with a swath W at spacing S (centre line optional)
function swathOffsets(hw,W,S,centre){if(!(S>0))return[0];const need=Math.max(0,hw-W/2),o=[];
if(centre){const k=Math.ceil(need/S-1e-9);for(let i=-k;i<=k;i++)o.push(i*S)}
else{const k=Math.max(1,Math.ceil((need+S/2)/S-1e-9));for(let i=0;i<k;i++){o.push(S/2+i*S,-(S/2+i*S))}}
return[...new Set(o.map(v=>Math.round(v*100)/100))].sort((a,b)=>a-b)}
const offName=(pre,v)=>{if(Math.abs(v)<1e-9)return pre+"C";const a=Math.round(Math.abs(v)*10)/10,s=String(Math.floor(a)).padStart(3,"0")+(a%1?"."+a.toFixed(1).split(".")[1]:"");return pre+(v<0?"P":"S")+s};
function outline(P,hw){if(P.length<2||!(hw>0))return[];const L=offset(P,-hw),Rt=offset(P,hw);return L.concat(Rt.reverse())}
return{clean,chain,at,offset,extend,parseOffsets,swathOffsets,offName,outline,unloop}})();
