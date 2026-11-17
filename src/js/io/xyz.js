function loadXYZ(txt){const cv2=mkConv(),sw=$("xord").value=="yx",sg=$("zsg").value=="down"?1:-1,uf=+$("zun").value,off=g("zoff"),rows=txt.split(/\r?\n/),B={la:[],lo:[],z:[],bad:0,zmin:1e30,zmax:-1e30};
let a0=1e9,a1=-1e9,o0=1e9,o1=-1e9;for(let i=g("hdr");i<rows.length;i++){const m=rows[i].trim().split(/[,;\s]+/);if(m.length<3)continue;let x=+m[0],y=+m[1];const z=+m[2];if(!isFinite(x+y+z)){B.bad++;continue}if(sw)[x,y]=[y,x];
let la,lo;try{[la,lo]=cv2(x,y)}catch(e){B.bad++;continue}if(!(Math.abs(la)<=90&&Math.abs(lo)<=360)){B.bad++;continue}
const d=sg*z*uf+off;B.la.push(la);B.lo.push(lo);B.z.push(d);a0=Math.min(a0,la);a1=Math.max(a1,la);o0=Math.min(o0,lo);o1=Math.max(o1,lo);B.zmin=Math.min(B.zmin,d);B.zmax=Math.max(B.zmax,d)}
if(!B.z.length){$("sndR").textContent=i18("No valid XYZ rows found. Check the column order, coordinate system and header lines.");return}
bath=B;if(!closed){reorigin((a0+a1)/2,(o0+o1)/2);const dx=Math.max(50,(o1-o0)*111320*Math.cos(o.lat*D)),dy=Math.max(50,(a1-a0)*111132.9);V.cx=V.cy=0;V.k=Math.min(cv.width/dx,cv.height/dy)*.8}analyse();gen()}
function analyse(){if(!bath){return}const z=[];for(let i=0;i<bath.z.length;i++)if(!closed||inPoly(fromLL(bath.la[i],bath.lo[i])))z.push(bath.z[i]);
if(!z.length){sdp=null;$("sndR").textContent=i18("{0} points loaded, none inside the area.",bath.z.length);return}z.sort((a,b)=>a-b);
sdp={min:z[0],max:z[z.length-1],p5:z[Math.floor(z.length*.05)],mean:z.reduce((a,b)=>a+b,0)/z.length};
$("sndR").textContent=i18("{0} points loaded ({1} skipped). {2}: {3} points, min {4} m, 5th pct {5} m, mean {6} m, max {7} m. Map dots: light = shallow, dark = deep.",bath.z.length,bath.bad,closed?i18("Inside area"):i18("All"),z.length,sdp.min.toFixed(1),sdp.p5.toFixed(1),sdp.mean.toFixed(1),sdp.max.toFixed(1))}
function drawBath(){if(!bath||!$("sb").checked)return;const n=bath.z.length,st=Math.max(1,Math.floor(n/5000)),r=DPR(),sp=(bath.zmax-bath.zmin)||1;
for(let i=0;i<n;i+=st){const s=sc(fromLL(bath.la[i],bath.lo[i]));if(s[0]<0||s[1]<0||s[0]>cv.width||s[1]>cv.height)continue;const k=(bath.z[i]-bath.zmin)/sp;cx.fillStyle=`hsl(215,75%,${82-k*55}%)`;cx.fillRect(s[0]-2*r,s[1]-2*r,4*r,4*r)}}
$("xl").onclick=async()=>{if($("xcrs").value=="epsg"){if(!crsDef)return alert(i18("Load an EPSG code or definition first."));try{await ensureP4()}catch(e){return alert(i18("The proj4 library is not available. Connect to the internet once, or load proj4.js from a file."))}}const f=$("xf").files[0];if(f){const r=new FileReader();r.onload=()=>loadXYZ(r.result);r.readAsText(f)}else loadXYZ($("snd").value)};
const ap=v=>{if(sdp&&isFinite(v)){$("depth").value=v.toFixed(1);$("qd").value=v.toFixed(1);gen()}};$("sMin").onclick=()=>ap(sdp&&sdp.min);$("sP5").onclick=()=>ap(sdp&&sdp.p5);$("sMean").onclick=()=>ap(sdp&&sdp.mean);

