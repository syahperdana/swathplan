/* ===== compare scenarios (tender): the same plan with different settings and rates ===== */
const TEN_KEY=(window.SWP_STATE_KEY||"swp_state")+"_scen";
let TEN=[];try{TEN=JSON.parse(localStorage.getItem(TEN_KEY)||"[]")}catch(e){TEN=[]}
// scenarios saved before the coverage control stored the overlap (0–80 %): turn it into seabed coverage (100 % and up)
TEN.forEach(s=>{if(typeof s.ov=="number"&&s.ov<100){const c=100/(1-Math.min(s.ov,99)/100);s.ov=Math.abs(c-Math.round(c))<.05?Math.round(c):+c.toFixed(1)}});
const tenSave=()=>{try{localStorage.setItem(TEN_KEY,JSON.stringify(TEN))}catch(e){}};
// what can be compared depends on what sets the lines: the multibeam, or the geophysical spread
const tenType=()=>typeof MODE!="function"?"mbes":MODE().uav?"uav":MODE().geo?"geo":MODE().sbes?"sbes":"mbes";
const TEN_COMMON=[{k:"spd",l:"Survey speed (kn)",id:["spd"],c:"Speed_kn"},{k:"R",l:"Turn radius (m)",id:["R"],c:"Turn_radius_m"},{k:"rate",l:"Day rate",id:["rate"],c:"Day_rate"},{k:"opH",l:"Hours per day",id:["opH"],c:"Hours_per_day"},{k:"ves",l:"Vessels",id:[],c:"Vessels"}];
const TEN_DEF={mbes:[{k:"sens",l:"Sensor",id:["sens"],sel:1,c:"Sensor"},{k:"ov",l:"Seabed coverage (%)",id:["ov"],c:"Coverage_pct"},{k:"ang",l:"Swath half-angle (°)",id:["ap","as"],c:"Swath_half_angle_deg"}].concat(TEN_COMMON),
uav:[{k:"uvH",l:"Flight height above ground (m)",id:["uvH"],c:"Height_m"},{k:"uvSO",l:"Side overlap (%)",id:["uvSO"],c:"Side_overlap_pct"},{k:"uvFO",l:"Forward overlap (%)",id:["uvFO"],c:"Forward_overlap_pct"}].concat(TEN_COMMON),
sbes:[{k:"sbSp",l:"Line spacing (m)",id:["sbSp"],c:"Line_spacing_m"}].concat(TEN_COMMON),
geo:[{k:"gSR",l:"Range per side (m)",id:["gSR"],c:"Sidescan_range_m"},{k:"gSC",l:"Seabed coverage",id:["gSC"],sel:1,c:"Sidescan_coverage_pct"}].concat(TEN_COMMON)};
const tenF=()=>TEN_DEF[tenType()],tenList=()=>TEN.filter(s=>(s.type||"mbes")==tenType());
const tenGet=f=>f.k=="ov"?+covS():f.k=="ves"?1:f.k=="ang"?Math.max(g("ap"),g("as")):f.sel?$(f.id[0]).value:g(f.id[0]);
const tenPut=(f,v)=>f.k=="ov"?($("ov").value=+(100*(1-100/Math.max(100,+v||100))).toFixed(4)):f.id.forEach(i=>{$(i).value=v});
function tenNow(){const s={type:tenType(),name:i18("Scenario {0}",String.fromCharCode(65+tenList().length%26))};tenF().forEach(f=>s[f.k]=tenGet(f));return s}
// plan one scenario with the planner itself, then put the settings back
function tenRun(s){const F=tenF(),ids=[].concat(...F.map(f=>f.id)),keep={};ids.forEach(i=>keep[i]=$(i).value);
try{F.forEach(f=>{if(f.id.length&&s[f.k]!==undefined)tenPut(f,s[f.k])});gen();
const v=Math.max(1,Math.round(s.ves)||1),days=SUM.days/v,dc=Math.ceil(SUM.dc/v-1e-9)*v;
return{lines:R.lines.length+R.cross.length,km:(SUM.ol+SUM.xl)/1000,kmT:(SUM.ol+SUM.xl+SUM.tl)/1000,h:SUM.tot,days,cost:dc*s.rate,sp:SUM.sp}}
finally{ids.forEach(i=>$(i).value=keep[i]);gen()}}
function tenShow(){const L=$("tenList");L.innerHTML="";
tenList().forEach(s=>{const d=document.createElement("div");d.style.cssText="border:1px solid var(--bd);border-radius:6px;padding:6px 8px;margin:6px 0;background:#fff";
d.innerHTML='<div style="display:flex;gap:6px;align-items:center"><input data-k="name" style="flex:1;font-weight:600" value=""><button type="button" data-a="apply">'+i18("Apply")+'</button><button type="button" data-a="del" title="'+i18("Remove")+'">×</button></div><div class="r2" style="margin-top:4px"></div>';
const g2=d.querySelector(".r2");tenF().forEach(f=>{const w=document.createElement("div");w.innerHTML="<label>"+i18(f.l)+"</label>"+(f.sel?'<select data-k="'+f.k+'">'+$(f.id[0]).innerHTML+"</select>":'<input type="number" data-k="'+f.k+'" step="any">');g2.appendChild(w)});
const sel=new Set(tenF().filter(f=>f.sel).map(f=>f.k));
d.querySelectorAll("[data-k]").forEach(e=>{e.value=s[e.dataset.k];e.addEventListener("change",()=>{s[e.dataset.k]=e.dataset.k=="name"||sel.has(e.dataset.k)?e.value:+e.value;tenSave();tenCompare()})});
d.querySelector('[data-a="del"]').onclick=()=>{TEN.splice(TEN.indexOf(s),1);tenSave();tenShow()};
d.querySelector('[data-a="apply"]').onclick=()=>{tenF().forEach(f=>{if(f.id.length&&s[f.k]!==undefined)tenPut(f,s[f.k])});gen();saveSoon();toast(i18("Scenario applied: {0}",s.name),3500)};
L.appendChild(d)});tenCompare()}
let TENR=[];
function tenCompare(){const O=$("tenOut"),list=tenList();if(!list.length){O.innerHTML='<p class="note">'+i18("No scenarios yet.")+"</p>";TENR=[];return}
if(!R.lines.length){O.innerHTML='<p class="note">'+i18(window.SWP_NEED||"Draw and close an area first.")+"</p>";TENR=[];return}
TENR=list.map(s=>({s,r:tenRun(s)}));const best=k=>Math.min(...TENR.map(x=>x.r[k]).filter(v=>v>0)),bd=best("days"),bc=best("cost");
const th=t=>'<th style="text-align:right;padding:2px 4px">'+t+"</th>",td=(t,b)=>'<td style="text-align:right;padding:2px 4px'+(b?";font-weight:700;color:#0b6f6a":"")+'">'+t+"</td>";
let h='<table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0"><tr><th style="text-align:left">'+i18("Scenario")+"</th>"+th(i18("Lines"))+th(i18("Line km"))+th(i18("Days"))+th(i18("Cost"))+"</tr>";
TENR.forEach(({s,r})=>{h+='<tr style="border-top:1px solid #dde5e4"><td>'+s.name.replace(/</g,"&lt;")+"<br><small style=\"color:#5b6e75\">"+r.sp+"</small></td>"+td(r.lines)+td(r.kmT.toFixed(1))+td(r.days.toFixed(2),r.days==bd)+td(s.rate>0?Math.round(r.cost).toLocaleString():"–",s.rate>0&&r.cost==bc)+"</tr>"});
O.innerHTML=h+"</table>"}
$("tenAdd").onclick=()=>{TEN.push(tenNow());tenSave();tenShow();$("tenD").open=true};
$("tenCsv").onclick=()=>{if(!TENR.length)return;const F=tenF();let t=["Scenario"].concat(F.map(f=>f.c),["Lines","Line_km_incl_turns","Hours","Days","Cost","Spacing"]).join(",")+"\n";
TENR.forEach(({s,r})=>{t+=[s.name].concat(F.map(f=>f.k=="sens"?(SENS[s.sens]||[""])[0]:s[f.k]),[r.lines,r.kmT.toFixed(3),r.h.toFixed(2),r.days.toFixed(3),Math.round(r.cost),r.sp]).map(v=>'"'+String(v).replace(/"/g,"'")+'"').join(",")+"\n"});save("scenario_comparison.csv",t,"text/csv")};
$("tenD").addEventListener("toggle",()=>{if($("tenD").open)tenShow()});
// a link to #tender opens the section
setTimeout(()=>{if(location.hash=="#tender"){const d=$("tenD");d.open=true;if(!tenList().length){TEN.push(tenNow());tenSave()}tenShow();d.scrollIntoView({block:"start"})}},800);
