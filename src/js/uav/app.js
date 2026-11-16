/* ===== drone (photogrammetry) mode of the survey planner: camera footprint, overlaps, photo trigger, batteries (active when MODE().uav) ===== */
const UV_CAM={m3e:[17.3,13,12.3,5280,.7],m4e:[17.3,13,12.3,5280,.5],p4r:[13.2,8.8,8.8,5472,2.5],p1:[35.9,24,35,8192,.7]};// approximate: sensor w/h mm, focal mm, image width px, shortest interval s
const uvKnMs=.5144;
function uvGeo(){const H=Math.max(1,g("uvH")),F=Math.max(.1,g("uvF")),across=H*Math.max(.1,g("uvSW"))/F,along=H*Math.max(.1,g("uvSH"))/F,gsd=across/Math.max(1,g("uvIW")),
so=Math.min(95,Math.max(0,g("uvSO")))/100,fo=Math.min(95,Math.max(0,g("uvFO")))/100,v=Math.max(.1,g("spd")*uvKnMs);
return{H,across,along,gsd,S:across*(1-so),dPh:along*(1-fo),v,tPh:along*(1-fo)/v}}
// spacing from the camera; tight turns (a half circle between neighbouring lines)
const _uvParams=params;params=function(){const p=_uvParams();if(!MODE().uav)return p;const U=uvGeo();p.mbS=p.S;p.mbW=p.W;p.S=Math.max(.5,U.S);p.W=U.across;p.Rr=Math.max(.5,U.S/2*.999);return p};
// a drone does not avoid land: lines are not trimmed to water
const _uvGen=gen;gen=function(){if(!MODE().uav)return _uvGen();const t=$("trim").checked;$("trim").checked=false;try{_uvGen()}finally{$("trim").checked=t}};
// time: no slow-down in turns; battery changes take the place of SVP casts
function uvWith(f){if(!MODE().uav)return f();const k={slow:$("slow").checked,svpI:$("svpI").value,svpD:$("svpD").value};$("slow").checked=false;$("svpI").value=Math.max(1,g("uvBat"))/60;$("svpD").value=Math.max(0,g("uvSwap"));
try{return f()}finally{$("slow").checked=k.slow;$("svpI").value=k.svpI;$("svpD").value=k.svpD}}
const _uvStats=stats;stats=function(){uvWith(_uvStats);uvShow()};
function uvShow(){if(!MODE().uav)return;const U=uvGeo(),ln=R.lines.concat(R.cross),Lm=ln.reduce((s,l)=>s+L(l),0),ph=ln.length?Math.round(Lm/U.dPh)+ln.length:0,ft=(Lm+(R.tl||0))/U.v/60,nb=Math.max(1,Math.ceil(ft/Math.max(1,g("uvBat"))));
$("uvGsd").textContent=(U.gsd*100).toFixed(2)+" cm/px";$("uvFp").textContent=U.across.toFixed(1)+" × "+U.along.toFixed(1)+" m";$("uvLs").textContent=U.S.toFixed(1)+" m";
$("uvPh").textContent=i18("{0} m ({1} s at {2} m/s)",U.dPh.toFixed(1),U.tPh.toFixed(1),U.v.toFixed(1));$("uvTot").textContent=ln.length?i18("{0} photos · {1} min · {2} batteries",ph,Math.round(ft),nb):"-";
$("tSvp").textContent=i18("{0} battery changes · {1}",Math.max(0,nb-1),hm(Math.max(0,nb-1)*g("uvSwap")/60))}
// plan checks: the vessel and IHO checks give way to height, photo interval and batteries
const _uvSum=summary;summary=function(){uvWith(()=>_uvSum.apply(this,arguments));if(!MODE().uav||!R.lines.length)return;const U=uvGeo(),ul=$("chk"),pre=t=>i18(t).split("{0}")[0];
const keep=["On-line efficiency","Average line length","Lines are long compared","transit leg"].map(k=>k.toLowerCase());
[...ul.children].forEach(li=>{const t=li.textContent.toLowerCase();if(!keep.some(k=>t.indexOf(k)>=0)&&!t.startsWith(pre("On-line efficiency {0} %.").toLowerCase()))li.remove()});
const C=[],add=(k,m)=>C.push('<li class="'+k+'">'+m+"</li>");
U.H>120?add("bad",i18("Flight height {0} m is above 120 m, the limit in many countries: check your local rules.",U.H)):add("ok",i18("Flight height {0} m.",U.H));
U.tPh<Math.max(.1,g("uvMI"))?add("bad",i18("A photo every {0} s is faster than the camera allows ({1} s): fly slower or lower the forward overlap.",U.tPh.toFixed(2),g("uvMI"))):add("ok",i18("A photo every {0} m ({1} s) gives {2} % forward overlap.",U.dPh.toFixed(1),U.tPh.toFixed(1),g("uvFO")));
add("inf",i18("Ground sample distance {0} cm/pixel at {1} m.",(U.gsd*100).toFixed(2),U.H));ul.insertAdjacentHTML("afterbegin",C.join(""))};
// camera presets
$("uvCam").addEventListener("change",()=>{const c=UV_CAM[$("uvCam").value];if(c){["uvSW","uvSH","uvF","uvIW","uvMI"].forEach((id,i)=>$(id).value=c[i])}gen();saveSoon()});
["uvSW","uvSH","uvF","uvIW","uvMI"].forEach(id=>$(id).addEventListener("input",()=>{$("uvCam").value="custom"}));
["uvSW","uvSH","uvF","uvIW","uvMI","uvH","uvFO","uvSO","uvBat","uvSwap"].forEach(id=>{const e=$(id);["input","change"].forEach(ev=>e.addEventListener(ev,()=>{gen();saveSoon()}))});
// map sheet, reports and waypoint exports
const uvSensorTxt=()=>{const o=$("uvCam").selectedOptions[0];return($("uvCam").value=="custom"?i18("Custom camera"):o.textContent)+", "+i18("{0} cm/px at {1} m",(uvGeo().gsd*100).toFixed(2),g("uvH"))};
const uvSensorRow=()=>[i18("Camera"),uvSensorTxt()];
const uvSwathRow=()=>[i18("Overlap (forward / side)"),g("uvFO")+" % / "+g("uvSO")+" %"];
const uvMission=()=>{const U=uvGeo();return{h:U.H,trig:U.dPh,v:U.v}};
const _uvSetLang=setLang;setLang=function(){const r=_uvSetLang.apply(this,arguments);try{uvShow()}catch(e){}return r};
