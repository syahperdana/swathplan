function chords(P,a,b,s){const r=[];for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],s1=p[0]*a[0]+p[1]*a[1],s2=q[0]*a[0]+q[1]*a[1];
if((s1<=s)!=(s2<=s)){const t1=p[0]*b[0]+p[1]*b[1],t2=q[0]*b[0]+q[1]*b[1];r.push(t1+(t2-t1)*(s-s1)/(s2-s1))}}r.sort((x,y)=>x-y);const o=[];for(let i=0;i+1<r.length;i+=2)if(r[i+1]-r[i]>1)o.push([r[i],r[i+1]]);return o}
function area(P){let s=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];s+=p[0]*q[1]-q[0]*p[1]}return Math.abs(s)/2}
function nLines(az,S){const n=[Math.cos(az*D),-Math.sin(az*D)],u=[Math.sin(az*D),Math.cos(az*D)],v=poly.map(p=>p[0]*n[0]+p[1]*n[1]);return linePositions(arrMin(v),arrMax(v),n,u,S).length}
function params(){const d=g("depth"),W=d*(Math.tan(g("ap")*D)+Math.tan(g("as")*D)),S=W*(1-g("ov")/100),Rr=g("R"),od=ORD[$("ord").value],tvu=Math.sqrt(od[1]**2+(od[2]*d)**2);return{d,W,S,Rr,od,tvu}}
function turnPts(P,f,n,S,Rr){const al=S>=2*Rr?0:Math.acos(S/(2*Rr)),pts=[],w=(F,L)=>[P[0]+f[0]*F+n[0]*L,P[1]+f[1]*F+n[1]*L];let F=0,L=0,ph=0,len=0;
const arc=(p1,sg)=>{const N=Math.max(2,Math.ceil(Math.abs(p1-ph)/(5*D)));const F0=F,L0=L,p0=ph;for(let i=1;i<=N;i++){const q=p0+(p1-p0)*i/N;F=F0+sg*Rr*(Math.sin(q)-Math.sin(p0));L=L0-sg*Rr*(Math.cos(q)-Math.cos(p0));pts.push(w(F,L))}ph=p1;len+=Rr*Math.abs(p1-p0)};
if(al>0)arc(-al,-1);arc(Math.PI,1);return{pts,len}}
function gen(){R={lines:[],turns:[],cross:[],tl:0,ol:0};if(!closed||poly.length<3){return stats()}
const{S,Rr}=params(),az=g("az"),u=[Math.sin(az*D),Math.cos(az*D)],n=[Math.cos(az*D),-Math.sin(az*D)],sv=poly.map(p=>p[0]*n[0]+p[1]*n[1]),tv=poly.map(p=>p[0]*u[0]+p[1]*u[1]);
const s0=arrMin(sv),s1=arrMax(sv);const ss=linePositions(s0,s1,n,u,S);R.sp=ss.slice(1).map((v,i)=>v-ss[i]);
let segs=[];ss.forEach((s,k)=>chords(poly,n,u,s).flatMap(c=>wr(s,c,n,u)).forEach(c=>segs.push({s,c,k})));
segs.forEach((sg,i)=>{const[a,b]=i%2?[sg.c[1],sg.c[0]]:sg.c;sg.a=[n[0]*sg.s+u[0]*a,n[1]*sg.s+u[1]*a];sg.b=[n[0]*sg.s+u[0]*b,n[1]*sg.s+u[1]*b];sg.f=i%2?[-u[0],-u[1]]:u});
R.lines=segs.map((s,i)=>({name:$("pre").value+(i+1),a:s.a,b:s.b}));
for(let i=0;i+1<segs.length;i++){const A=segs[i],B=segs[i+1];let pts=[A.b],len=0;
if(B.k==A.k+1){const t=turnPts(A.b,A.f,n,B.s-A.s,Rr);pts=pts.concat(t.pts)}pts.push(B.a);for(let j=1;j<pts.length;j++)len+=Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);R.turns.push({pts,len,ty:B.k==A.k+1?((B.s-A.s)<2*Rr?"w":"u"):"t"});R.tl+=len}
if($("cross").checked){const t0=arrMin(tv),t1=arrMax(tv);Array.from({length:Math.max(1,Math.min(99,Math.round(g("nx"))||2))},(_,j)=>(j+1)/(Math.max(1,Math.min(99,Math.round(g("nx"))||2))+1)).forEach((k,j)=>{const t=t0+(t1-t0)*k;chords(poly,u,n,t).flatMap(c=>wr(t,c,u,n)).forEach(c=>R.cross.push({name:$("crossPre").value+(R.cross.length+1),a:[u[0]*t+n[0]*c[0],u[1]*t+n[1]*c[0]],b:[u[0]*t+n[0]*c[1],u[1]*t+n[1]*c[1]]}))})}
stats()}
// a line is {name,a,b} or, when it bends (corridor), {name,a,b,p:[points]}
const LP=l=>l.p||[l.a,l.b],L=l=>{const q=LP(l);let s=0;for(let i=1;i<q.length;i++)s+=Math.hypot(q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]);return s};
function stats(){const p=params(),ln=R.lines,ol=ln.reduce((s,l)=>s+L(l),0),cl=R.cross.reduce((s,l)=>s+L(l),0),sp=g("spd"),ts=Math.max(1,sp-($("slow").checked?2:0));
$("tsp").value=ts;const to=(ol+cl)/(sp*NM),tt=R.tl/(ts*NM),A=closed?area(poly):0;
$("hD").textContent=f1(p.d);$("hL").textContent=ln.length+(R.cross.length?" + "+R.cross.length+" cross":"");$("hT").textContent=hm(to+tt);
$("W").textContent=f1(p.W);$("S").textContent=f1(p.S);if($("covX")){const ov=Math.min(99,g("ov"));$("covX").textContent=i18("{0} % (each point in about {1} swaths)",Math.round(100/(1-ov/100)),(1/(1-ov/100)).toFixed(ov%10?1:0).replace(/\.0$/,""))}$("dia").textContent=f1(2*p.Rr,"m",0);$("tT").textContent=hm(to+tt);$("tO").textContent=hm(to);$("tR").textContent=hm(tt);
$("lt").textContent=cst.seg&&cst.seg.length?i18("{0} segments, {1} m clearance",cst.seg.length/4,g("clr")):i18("off");$("nL").textContent=ln.length;$("nT").textContent=R.turns.length;const km=m=>(m/1000).toFixed(2)+" km ("+(m/NM).toFixed(2)+" NM)";
$("dL").textContent=km(ol);$("dT").textContent=km(R.tl);$("dG").textContent=km(ol+cl+R.tl);$("ar").textContent=(A/1e6).toFixed(3)+" km²";
$("qW").textContent=f1(p.W);$("qS").textContent=f1(p.S)+" ("+g("ov")+"%)";$("qT").textContent="±"+p.tvu.toFixed(3)+" m";
const sl=p.d/Math.cos(Math.max(g("ap"),g("as"))*D);$("ping").textContent=(1500/(2*sl)).toFixed(1)+" Hz";$("tvu").textContent="±"+p.tvu.toFixed(3)+" m";$("spdHint").textContent=i18("Suggested for {0}: about {1} kts (check along-track density).",ordN(+$("ord").value),p.od[3]);
$("azT").textContent=g("az").toFixed(3);$("ovT").textContent=g("ov");summary();render();saveSoon()}
