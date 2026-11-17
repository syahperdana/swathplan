/* ===== a priori uncertainty (TPU) by beam angle, against the IHO S-44 order ===== */
const TPU_TH=[[1,0],[2,0],[5,.05],[5,.05],[20,.1]];// THU limit: a + b × depth (m), per order
function tpuAt(th,d){const v=id=>Math.max(0,+$(id).value||0),r=th*D,c=1500,tn=Math.tan(r),cs=Math.cos(r),sl=d/cs,
sa=Math.hypot(v("tRP"),v("tBA"))*D,sp=v("tRP")*D,sh=v("tHdg")*D,dth=tn*v("tSVs")/c;
const z=Math.sqrt((v("tRng")*cs)**2+(d*tn*sa)**2+v("tHv")**2+v("tTide")**2+v("tDr")**2+(d*v("tSVp")/c)**2+(d*tn*dth)**2);
const x=d*tn,h=Math.sqrt(v("tPos")**2+(x*sh)**2+(d*sa)**2+(sl*sp)**2+(x*v("tSVp")/c)**2+(d*dth)**2+(v("tRng")*Math.sin(r))**2+v("tDr")**2);
return{tvu:1.96*z,thu:2.45*h}}
function tpuLim(d){const oi=+$("ord").value,od=ORD[oi],th=TPU_TH[oi];return{tvu:Math.sqrt(od[1]**2+(od[2]*d)**2),thu:th[0]+th[1]*d}}
function tpuCalc(){const d=Math.max(.5,g("depth")),L=tpuLim(d),mx=Math.min(85,Math.max(g("ap"),g("as"),+((SENS[$("sens").value]||[])[4])||75)),pts=[];let ok=0;
for(let a=0;a<=mx+1e-9;a+=.5){const t=tpuAt(a,d);pts.push([a,t.tvu,t.thu]);if(t.tvu<=L.tvu&&t.thu<=L.thu&&ok==a)ok=a+.5}
return{d,L,mx,pts,ok:Math.max(0,Math.min(mx,ok-.5))}}
let TPU=null;
function tpuShow(){const D2=document.getElementById("tpuD");if(!D2)return;TPU=tpuCalc();const T=TPU,cv2=$("tpuC"),c=cv2.getContext("2d"),W=cv2.width,H=cv2.height,pl=46,pr=10,pt=12,pb=30;
c.clearRect(0,0,W,H);c.font="12px "+FF;c.fillStyle="#5b6e75";c.strokeStyle="#dde5e4";c.lineWidth=1;
const ymax=Math.max(150,...T.pts.map(p=>Math.max(p[1]/T.L.tvu,p[2]/T.L.thu)*100).filter(isFinite).map(v=>Math.min(v,400))),X=a=>pl+(W-pl-pr)*a/T.mx,Y=v=>H-pb-(H-pt-pb)*Math.min(v,ymax)/ymax;
for(let v=0;v<=ymax;v+=50){c.beginPath();c.moveTo(pl,Y(v));c.lineTo(W-pr,Y(v));c.stroke();c.fillText(v+" %",4,Y(v)+4)}
for(let a=0;a<=T.mx;a+=15){c.fillText(a+"°",X(a)-8,H-10)}
c.strokeStyle="#b0237a";c.setLineDash([6,4]);c.beginPath();c.moveTo(pl,Y(100));c.lineTo(W-pr,Y(100));c.stroke();c.setLineDash([]);
const line=(k,col)=>{c.strokeStyle=col;c.lineWidth=2.2;c.beginPath();T.pts.forEach((p,i)=>{const y=Y(p[k]/(k==1?T.L.tvu:T.L.thu)*100);i?c.lineTo(X(p[0]),y):c.moveTo(X(p[0]),y)});c.stroke()};
line(1,"#0b6f6a");line(2,"#d98a00");c.lineWidth=1;
c.fillStyle="#0b6f6a";c.fillText(i18("TVU"),W-pr-90,pt+12);c.fillStyle="#d98a00";c.fillText(i18("THU"),W-pr-45,pt+12);
if(T.ok>0){c.fillStyle="#0b6f6a22";c.fillRect(pl,pt,X(T.ok)-pl,H-pt-pb)}
const n=tpuAt(0,T.d),e=tpuAt(T.ok,T.d),w=2*T.d*Math.tan(T.ok*D);
$("tpuR").textContent=i18("At {0} m depth: TVU ±{1} m at nadir (limit ±{2} m), THU {3} m (limit {4} m). The order is met out to ±{5}° (swath about {6} m), where TVU is ±{7} m and THU {8} m.",
T.d.toFixed(1),n.tvu.toFixed(3),T.L.tvu.toFixed(3),n.thu.toFixed(2),T.L.thu.toFixed(1),T.ok.toFixed(1),w.toFixed(0),e.tvu.toFixed(3),e.thu.toFixed(2));
$("tpuUse").textContent=i18("Use ±{0}° as the swath angles",T.ok.toFixed(1));$("tpuUse").disabled=!(T.ok>5)}
$("tpuUse").onclick=()=>{if(!TPU||!(TPU.ok>5))return;["ap","as"].forEach(id=>{$(id).value=TPU.ok.toFixed(1)});gen();saveSoon()};
["tPos","tHdg","tRP","tBA","tHv","tTide","tDr","tRng","tSVs","tSVp"].forEach(id=>$(id).addEventListener("input",()=>{tpuShow();summary();saveSoon()}));
// plan check: swath wider than the angle the uncertainty budget supports
const _tpuSum=summary;summary=function(){_tpuSum.apply(this,arguments);try{if($("tpuD").closest("[hidden]"))return;// not part of this survey
tpuShow();if(!R.lines.length||!TPU)return;const a=Math.max(g("ap"),g("as"));
$("chk").insertAdjacentHTML("beforeend",'<li class="'+(a<=TPU.ok+.05?"ok":"bad")+'">'+(a<=TPU.ok+.05?i18("Uncertainty budget: the order is met across the whole swath (±{0}°, usable to ±{1}°).",a,TPU.ok.toFixed(1)):i18("Uncertainty budget: beams beyond ±{0}° do not meet the order at {1} m (swath set to ±{2}°). Narrow the swath or improve the system.",TPU.ok.toFixed(1),TPU.d.toFixed(1),a))+"</li>")}catch(e){}};
