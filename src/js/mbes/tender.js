/* ===== compare scenarios (tender): the same plan with different sensors, settings and rates ===== */
const TEN_KEY=(window.SWP_STATE_KEY||"swp_state")+"_scen";
let TEN=[];try{TEN=JSON.parse(localStorage.getItem(TEN_KEY)||"[]")}catch(e){TEN=[]}
const tenSave=()=>{try{localStorage.setItem(TEN_KEY,JSON.stringify(TEN))}catch(e){}};
const TEN_F=[["sens",i18("Sensor")],["ov",i18("Overlap (%)")],["ang",i18("Swath half-angle (°)")],["spd",i18("Survey speed (kn)")],["R",i18("Turn radius (m)")],["rate",i18("Day rate")],["opH",i18("Hours per day")],["ves",i18("Vessels")]];
function tenNow(){return{name:i18("Scenario {0}",String.fromCharCode(65+TEN.length%26)),sens:$("sens").value,ov:g("ov"),ang:Math.max(g("ap"),g("as")),spd:g("spd"),R:g("R"),rate:g("rate"),opH:g("opH"),ves:1}}
// plan one scenario with the planner itself, then put the settings back
function tenRun(s){const ids=["sens","ov","ap","as","spd","R","rate","opH"],keep={};ids.forEach(i=>keep[i]=$(i).value);const kR=R,kS=SUM;
try{$("sens").value=s.sens;$("ov").value=s.ov;$("ap").value=$("as").value=s.ang;$("spd").value=s.spd;$("R").value=s.R;$("rate").value=s.rate;$("opH").value=s.opH;gen();
const v=Math.max(1,Math.round(s.ves)||1),days=SUM.days/v,dc=Math.ceil(SUM.dc/v-1e-9)*v;
return{lines:R.lines.length+R.cross.length,km:(SUM.ol+SUM.xl)/1000,kmT:(SUM.ol+SUM.xl+SUM.tl)/1000,h:SUM.tot,days,cost:dc*s.rate,sp:SUM.sp}}
finally{ids.forEach(i=>$(i).value=keep[i]);gen()}}
function tenShow(){const L=$("tenList");L.innerHTML="";const sensOpts=$("sens").innerHTML;
TEN.forEach((s,i)=>{const d=document.createElement("div");d.style.cssText="border:1px solid var(--bd);border-radius:6px;padding:6px 8px;margin:6px 0;background:#fff";
d.innerHTML='<div style="display:flex;gap:6px;align-items:center"><input data-k="name" style="flex:1;font-weight:600" value=""><button type="button" data-a="apply">'+i18("Apply")+'</button><button type="button" data-a="del" title="'+i18("Remove")+'">×</button></div><div class="r2" style="margin-top:4px"></div>';
const g2=d.querySelector(".r2");TEN_F.forEach(([k,lab])=>{const w=document.createElement("div");w.innerHTML="<label>"+lab+"</label>"+(k=="sens"?'<select data-k="sens">'+sensOpts+"</select>":'<input type="number" data-k="'+k+'" step="any">');g2.appendChild(w)});
d.querySelectorAll("[data-k]").forEach(e=>{e.value=s[e.dataset.k];e.addEventListener("change",()=>{s[e.dataset.k]=e.dataset.k=="name"||e.dataset.k=="sens"?e.value:+e.value;tenSave();tenCompare()})});
d.querySelector('[data-a="del"]').onclick=()=>{TEN.splice(i,1);tenSave();tenShow()};
d.querySelector('[data-a="apply"]').onclick=()=>{$("sens").value=s.sens;$("ov").value=s.ov;$("ap").value=$("as").value=s.ang;$("spd").value=s.spd;$("R").value=s.R;$("rate").value=s.rate;$("opH").value=s.opH;gen();saveSoon();toast(i18("Scenario applied: {0}",s.name),3500)};
L.appendChild(d)});tenCompare()}
let TENR=[];
function tenCompare(){const O=$("tenOut");if(!TEN.length){O.innerHTML='<p class="note">'+i18("No scenarios yet.")+"</p>";TENR=[];return}
if(!R.lines.length){O.innerHTML='<p class="note">'+i18(window.SWP_NEED||"Draw and close an area first.")+"</p>";TENR=[];return}
TENR=TEN.map(s=>({s,r:tenRun(s)}));const best=k=>Math.min(...TENR.map(x=>x.r[k]).filter(v=>v>0)),bd=best("days"),bc=best("cost");
const th=t=>'<th style="text-align:right;padding:2px 4px">'+t+"</th>",td=(t,b)=>'<td style="text-align:right;padding:2px 4px'+(b?";font-weight:700;color:#0b6f6a":"")+'">'+t+"</td>";
let h='<table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0"><tr><th style="text-align:left">'+i18("Scenario")+"</th>"+th(i18("Lines"))+th(i18("Line km"))+th(i18("Days"))+th(i18("Cost"))+"</tr>";
TENR.forEach(({s,r})=>{h+='<tr style="border-top:1px solid #dde5e4"><td>'+s.name.replace(/</g,"&lt;")+"<br><small style=\"color:#5b6e75\">"+r.sp+"</small></td>"+td(r.lines)+td(r.kmT.toFixed(1))+td(r.days.toFixed(2),r.days==bd)+td(s.rate>0?Math.round(r.cost).toLocaleString():"–",s.rate>0&&r.cost==bc)+"</tr>"});
O.innerHTML=h+"</table>"}
$("tenAdd").onclick=()=>{TEN.push(tenNow());tenSave();tenShow();$("tenD").open=true};
$("tenCsv").onclick=()=>{if(!TENR.length)return;let t=["Scenario","Sensor","Overlap_pct","Swath_half_angle_deg","Speed_kn","Turn_radius_m","Day_rate","Hours_per_day","Vessels","Lines","Line_km_incl_turns","Hours","Days","Cost","Spacing"].join(",")+"\n";
TENR.forEach(({s,r})=>{const sn=(SENS[s.sens]||[""])[0];t+=[s.name,sn,s.ov,s.ang,s.spd,s.R,s.rate,s.opH,s.ves,r.lines,r.kmT.toFixed(3),r.h.toFixed(2),r.days.toFixed(3),Math.round(r.cost),r.sp].map(v=>'"'+String(v).replace(/"/g,"'")+'"').join(",")+"\n"});save("scenario_comparison.csv",t,"text/csv")};
$("tenD").addEventListener("toggle",()=>{if($("tenD").open)tenShow()});
// the hub's "Tender comparison" opens a planner at #tender
setTimeout(()=>{if(location.hash=="#tender"){const d=$("tenD");d.open=true;if(!TEN.length){TEN.push(tenNow());tenSave()}tenShow();d.scrollIntoView({block:"start"})}},800);
