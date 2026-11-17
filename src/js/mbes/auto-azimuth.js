// Auto optimal azimuth. Uniform spacing: the fewest lines (ties: the middle of the best range).
// Adaptive spacing: the shortest survey time (line length plus turns), because there the fewest lines are often long lines
// across the depth contours, each spaced for its shallowest point; searched in steps with pauses so the page stays usable.
function adpCost(a,S){const n=[Math.cos(a*D),-Math.sin(a*D)],u=[Math.sin(a*D),Math.cos(a*D)],v=poly.map(p=>p[0]*n[0]+p[1]*n[1]),q=linePositions(arrMin(v),arrMax(v),n,u,S,true);
let L=0;q.forEach(s=>chords(poly,n,u,s).forEach(c=>L+=c[1]-c[0]));const Rr=g("R"),sp=g("spd"),ts=Math.max(1,sp-($("slow").checked?2:0));let T=0;
for(let i=0;i+1<q.length;i++)T+=turnPts([0,0],[0,1],[1,0],q[i+1]-q[i],Rr).len;return L/(sp*NM)+T/(ts*NM)}
let autoBusy=false;
$("auto").onclick=async()=>{if(!closed||autoBusy)return;const S=params().S,ad=$("adp").checked&&bath&&bath.z.length,mx=179.999;
 if(!ad){const ev=a=>nLines(a,S);let c=0,bn=1e9,pr=1;for(let a=0;a<180;a+=pr){const n=ev(a);if(n<bn){bn=n;c=a}}
  [.1,.01,.001].forEach(st=>{const lo=Math.max(0,c-pr),hi=Math.min(mx,c+pr),K=Math.round((hi-lo)/st),cand=[];let m=1e9;
   for(let i=0;i<=K;i++){const a=+(lo+i*st).toFixed(3),n=ev(a);if(n<m){m=n;cand.length=0}if(n==m)cand.push(a)}
   c=cand[Math.floor((cand.length-1)/2)];pr=st});
  $("az").value=$("azN").value=c.toFixed(3);gen();return}
 autoBusy=true;const btn=$("auto"),txt=btn.textContent,pause=()=>new Promise(r=>setTimeout(r,0));
 try{const A=[];for(let a=0;a<180;a+=10)A.push(a);let c=0,bc=1e30,done=0;const tot=A.length+8;
  const try1=async a=>{const t=adpCost(a,S);if(t<bc){bc=t;c=a}btn.textContent=i18("Searching… {0} %",Math.round(++done/tot*100));await pause()};
  for(const a of A)await try1(a);const c0=c;for(const d of [-6,-4,-2,2,4,6])await try1(((c0+d)%180+180)%180);const c1=c;for(const d of [-1,1])await try1(((c1+d)%180+180)%180);
  $("az").value=$("azN").value=c.toFixed(3);gen()}finally{btn.textContent=txt;autoBusy=false}};
