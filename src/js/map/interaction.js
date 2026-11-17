/* ===== map interaction, zoom limits, tile cache (v2) ===== */
function DPR(){return Math.min(window.devicePixelRatio||1,2)}
function clampV(){if(!isFinite(V.k)||V.k<=0)V.k=.05;V.k=Math.min(30,Math.max(2e-5,V.k));if(!isFinite(V.cx))V.cx=0;if(!isFinite(V.cy))V.cy=0;
const lo=(-85-o.lat)*111132.9,hi=(85-o.lat)*111132.9;V.cy=Math.min(hi,Math.max(lo,V.cy))}
function zoomAt(px,py,k){const r=DPR(),w=wc(px*r,py*r);V.k*=k;clampV();const w2=wc(px*r,py*r);V.cx+=w[0]-w2[0];V.cy+=w[1]-w2[1];clampV();rq()}
const PT=new Map();let pinch=null;
cv.addEventListener("pointerdown",e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){}PT.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
if(PT.size==1)cv._d={x:e.offsetX,y:e.offsetY,m:false,cx:V.cx,cy:V.cy};else{cv._d=null;const[a,b]=[...PT.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,k:V.k}}});
cv.addEventListener("pointermove",e=>{const p=PT.get(e.pointerId);if(p){p.x=e.offsetX;p.y=e.offsetY}
if(PT.size>=2&&pinch){const[a,b]=[...PT.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1;zoomAt((a.x+b.x)/2,(a.y+b.y)/2,pinch.k*d/pinch.d/V.k);return}
const r=DPR();if(e.pointerType!="touch"){const ll=toLL(wc(e.offsetX*r,e.offsetY*r));$("hud").textContent=ll[0].toFixed(5)+"°N  "+ll[1].toFixed(5)+"°E"+hudZ(ll[0],ll[1])}
const d=cv._d;if(d){if(Math.abs(e.offsetX-d.x)+Math.abs(e.offsetY-d.y)>4)d.m=true;if(d.m){V.cx=d.cx-(e.offsetX-d.x)*r/V.k;V.cy=d.cy+(e.offsetY-d.y)*r/V.k;clampV();rq()}}});
const pend=e=>{PT.delete(e.pointerId);if(PT.size<2)pinch=null};
cv.addEventListener("pointerup",e=>{const d=cv._d;cv._d=null;pend(e);if(d&&!d.m&&draw&&!closed){const r=DPR();poly.push(wc(e.offsetX*r,e.offsetY*r));rq();saveSoon()}});
cv.addEventListener("pointercancel",e=>{cv._d=null;pend(e)});
cv.addEventListener("dblclick",()=>{if(draw&&poly.length>2)close()});
cv.addEventListener("wheel",e=>{e.preventDefault();let dy=e.deltaY;if(e.deltaMode==1)dy*=16;else if(e.deltaMode==2)dy*=cv.clientHeight;dy=Math.max(-150,Math.min(150,dy));
zoomAt(e.offsetX,e.offsetY,Math.exp(-dy*(e.ctrlKey?.01:.002)))},{passive:false});
$("bm").addEventListener("input",()=>{tileOK=0;tileErr=0});


// the depth (or, for drones, the ground height) under the pointer, from the shaded grid at the data's own spacing
function hudZ(la,lo){try{let L=null,dk=true;if(window.SWP_UAVSHEET&&typeof tgShade=="function"){L=tgShade();dk=false}if((!L||!L.Z)&&typeof bath!="undefined"&&bath&&bath.z&&bath.z.length&&typeof bathShade=="function"){L=bathShade();dk=true}
if(!L||!L.Z||lo<L.o0||lo>L.o1||la<L.a0||la>L.a1)return"";const x=Math.min(L.W-1,Math.floor((lo-L.o0)/(L.o1-L.o0)*L.W)),y=Math.min(L.H-1,Math.floor((L.a1-la)/(L.a1-L.a0)*L.H)),v=L.Z[y*L.W+x];
if(!isFinite(v))return"";const t=Math.abs(v)<100?v.toFixed(2):v.toFixed(1);return"  ·  "+(dk?i18("depth {0} m",t):i18("elevation {0} m",t))}catch(e){return""}}
