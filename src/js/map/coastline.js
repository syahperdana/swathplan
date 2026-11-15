// ---- coastline / land
function projC(){const a=[],add=(p,q)=>{const u=fromLL(p[1],p[0]),v=fromLL(q[1],q[0]);a.push(u[0],u[1],v[0],v[1])};
cst.lines.forEach(l=>{for(let i=1;i<l.length;i++)add(l[i-1],l[i])});cst.polys.forEach(r=>{for(let i=0;i<r.length;i++)add(r[i],r[(i+1)%r.length])});cst.seg=Float64Array.from(a)}
function isLand(p){const S=cst.seg;if(cst.mode=="polys"){let c=false;for(let i=0;i<S.length;i+=4){const y1=S[i+1],y2=S[i+3];if((y1>p[1])!=(y2>p[1])&&p[0]<(S[i+2]-S[i])*(p[1]-y1)/(y2-y1)+S[i])c=!c}return c}
let bd=1e30,bs=0;for(let i=0;i<S.length;i+=4){const x1=S[i],y1=S[i+1],ex=S[i+2]-x1,ey=S[i+3]-y1,L2=ex*ex+ey*ey||1e-9;let t=((p[0]-x1)*ex+(p[1]-y1)*ey)/L2;t=Math.max(0,Math.min(1,t));const dx=x1+t*ex-p[0],dy=y1+t*ey-p[1],dd=dx*dx+dy*dy;if(dd<bd){bd=dd;bs=ex*(p[1]-y1)-ey*(p[0]-x1)}}return bs>0}
function wr(s,c,a,b){const S=cst.seg;if(!S||!S.length||!$("trim").checked)return[c];const cl=Math.max(g("clr"),.01),B=[a[0]*s,a[1]*s],pt=t=>[B[0]+b[0]*t,B[1]+b[1]*t],p0=pt(c[0]),p1=pt(c[1]),
bx0=Math.min(p0[0],p1[0])-cl,bx1=Math.max(p0[0],p1[0])+cl,by0=Math.min(p0[1],p1[1])-cl,by1=Math.max(p0[1],p1[1])+cl,cr=[],bl=[],X=(u,v)=>u[0]*v[1]-u[1]*v[0];
const lin=(q0,q1,lo,hi)=>{if(Math.abs(q1)<1e-12)return q0>=lo&&q0<=hi?[-1e18,1e18]:null;const u=(lo-q0)/q1,v=(hi-q0)/q1;return[Math.min(u,v),Math.max(u,v)]};
const circ=Q=>{const v=[B[0]-Q[0],B[1]-Q[1]],bb=b[0]*v[0]+b[1]*v[1],d=bb*bb-(v[0]*v[0]+v[1]*v[1]-cl*cl);return d<0?null:[-bb-Math.sqrt(d),-bb+Math.sqrt(d)]};
for(let i=0;i<S.length;i+=4){const x1=S[i],y1=S[i+1],x2=S[i+2],y2=S[i+3];if(Math.max(x1,x2)<bx0||Math.min(x1,x2)>bx1||Math.max(y1,y2)<by0||Math.min(y1,y2)>by1)continue;
const u=[x2-x1,y2-y1],L=Math.hypot(u[0],u[1]);if(L<1e-9)continue;const df=[x1-B[0],y1-B[1]],den=X(b,u);
if(Math.abs(den)>1e-12){const t=X(df,u)/den,w=X(df,b)/den;if(w>=0&&w<1&&t>=c[0]&&t<=c[1])cr.push(t)}
const e=[u[0]/L,u[1]/L],m=[-e[1],e[0]],bm=[B[0]-x1,B[1]-y1],st=lin(bm[0]*e[0]+bm[1]*e[1],b[0]*e[0]+b[1]*e[1],0,L),sp=lin(bm[0]*m[0]+bm[1]*m[1],b[0]*m[0]+b[1]*m[1],-cl,cl),iv=[circ([x1,y1]),circ([x2,y2])];
if(st&&sp){const lo=Math.max(st[0],sp[0]),hi=Math.min(st[1],sp[1]);if(lo<=hi)iv.push([lo,hi])}const f=iv.filter(Boolean);if(f.length)bl.push([Math.min(...f.map(q=>q[0])),Math.max(...f.map(q=>q[1]))])}
cr.sort((x,y)=>x-y);let ld=isLand(p0);const ts=[c[0],...cr,c[1]];for(let i=0;i<ts.length-1;i++){if(ld)bl.push([ts[i],ts[i+1]]);ld=!ld}
bl.sort((x,y)=>x[0]-y[0]);const out=[];let cur=c[0];for(const[lo,hi]of bl){if(hi<=cur)continue;if(lo>cur+1)out.push([cur,Math.min(lo,c[1])]);cur=Math.max(cur,hi);if(cur>=c[1])break}
if(c[1]>cur+1)out.push([cur,c[1]]);return out.filter(q=>q[1]-q[0]>1)}
function drawCoast(){const S=cst.seg;if(!S||!S.length)return;const r=DPR(),pth=()=>{cx.beginPath();for(let i=0;i<S.length;i+=4){const a=sc([S[i],S[i+1]]),b=sc([S[i+2],S[i+3]]);cx.moveTo(a[0],a[1]);cx.lineTo(b[0],b[1])}};
cx.lineCap=cx.lineJoin="round";pth();cx.lineWidth=Math.max(1,2*g("clr")*V.k);cx.strokeStyle="#c0392b30";cx.stroke();pth();cx.lineWidth=1.5*r;cx.strokeStyle="#8a5a14";cx.stroke();cx.lineCap="butt"}
function setCst(l,p,msg){cst={lines:l,polys:p,seg:null,mode:p.length?"polys":"lines"};projC();$("cSt").textContent=i18("{0} ({1} segments)",msg,cst.seg.length/4);gen()}
$("cOSM").onclick=async()=>{if(!closed)return $("cSt").textContent=i18("Close an area first.");const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),m=Math.max(3000,g("clr")*5),lo=toLL([Math.min(...xs)-m,Math.min(...ys)-m]),hi=toLL([Math.max(...xs)+m,Math.max(...ys)+m]);
const q=`[out:json][timeout:60];way["natural"="coastline"](${lo[0]},${lo[1]},${hi[0]},${hi[1]});out geom;`;$("cSt").textContent=i18("Downloading from Overpass…");
for(const u of["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"]){try{const r=await fetch(u,{method:"POST",body:"data="+encodeURIComponent(q)});if(!r.ok)throw 0;const j=await r.json();
const L=j.elements.filter(e=>e.geometry).map(e=>e.geometry.map(p=>[p.lon,p.lat]));return setCst(L,[],L.length?i18("OSM coastline loaded: {0} ways",L.length):i18("No OSM coastline in this area (open water or inland)"))}catch(e){}}
$("cSt").textContent=i18("Download failed. Check your internet connection, or load a GeoJSON file instead.")};
$("cF").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const L=[],P=[],walk=g=>{if(!g)return;if(g.type=="FeatureCollection")g.features.forEach(walk);else if(g.type=="Feature")walk(g.geometry);else if(g.type=="GeometryCollection")g.geometries.forEach(walk);
else if(g.type=="Polygon")g.coordinates.forEach(x=>P.push(x));else if(g.type=="MultiPolygon")g.coordinates.forEach(y=>y.forEach(x=>P.push(x)));else if(g.type=="LineString")L.push(g.coordinates);else if(g.type=="MultiLineString")g.coordinates.forEach(x=>L.push(x))};
walk(JSON.parse(r.result));if(!L.length&&!P.length)throw 0;setCst(P.length?[]:L,P,(P.length?i18("Land polygons loaded"):i18("Coastlines loaded (land assumed on the left of line direction, as in OSM)")))}catch(x){$("cSt").textContent=i18("Could not read this GeoJSON file.")}};r.readAsText(f)};
$("cClr").onclick=()=>{cst={lines:[],polys:[],seg:null,mode:""};$("cSt").textContent=i18("No coastline loaded.");gen()};
