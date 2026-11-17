/* ===== single-beam mode of the survey planner: line spacing, footprint, S-44 coverage checks (active when MODE().sbes) ===== */
const sbFoot=()=>2*Math.max(0,g("depth"))*Math.tan(Math.min(60,Math.max(.5,g("sbBW")))/2*D);// footprint diameter on a flat seabed
const sbMaxS=()=>Math.max(3*Math.max(0,g("depth")),25);// S-44 Order 2 / 1b: depths no more than 3 × depth or 25 m apart
// line spacing is set by the user, the "swath" is the footprint
const _sbParams=params;params=function(){const p=_sbParams();if(!MODE().sbes)return p;p.mbS=p.S;p.mbW=p.W;p.S=Math.max(1,g("sbSp"));p.W=sbFoot();return p};
function sbShow(){if(!MODE().sbes)return;const W=sbFoot(),S=Math.max(1,g("sbSp"));$("sbFp").textContent=W.toFixed(2)+" m";$("sbCv").textContent=(W/S*100).toFixed(1)+" %"}
const _sbStats=stats;stats=function(){_sbStats();sbShow()};
$("sbMax").onclick=()=>{$("sbSp").value=Math.round(sbMaxS());gen();saveSoon()};
["sbBW","sbSp"].forEach(id=>{const e=$(id);["input","change"].forEach(ev=>e.addEventListener(ev,()=>{gen();saveSoon()}))});
// plan checks: the multibeam checks are replaced by the S-44 rules for partial coverage
const _sbSum=summary;summary=function(){_sbSum.apply(this,arguments);if(!MODE().sbes||!R.lines.length)return;
const oi=+$("ord").value,on=ordN(oi),S=Math.max(1,g("sbSp")),W=sbFoot(),mx=sbMaxS(),A=closed&&poly.length>=3?area(poly):0,
Lm=R.lines.reduce((s,l)=>s+L(l),0),Lx=R.cross.reduce((s,l)=>s+L(l),0),cov=A>0?Math.min(1,(Lm+Lx)*W/A):W/S;
const pre=t=>i18(t).split("{0}")[0],drop=["Mean achieved coverage {0} % meets the {1} % target.","Achieved coverage {0} % is below the {1} % target.","Swath angle {0}° exceeds the catalogue maximum of {1}° for this sensor.","Swath angle {0}° is within the sensor maximum ({1}°).",
"Survey speed {0} kn is below the {1} kn limit for 3 pings on the smallest {2} feature.","Survey speed {0} kn exceeds {1} kn (3 pings on the smallest {2} feature). Slow down or raise the ping rate.","Maximum line spacing is capped at {0} m."].map(pre);
const ul=$("chk");[...ul.children].forEach(li=>{const t=li.textContent;if(drop.some(d=>d&&t.startsWith(d)))li.remove()});
const C=[],add=(k,m)=>C.push('<li class="'+k+'">'+m+"</li>");
if(oi<=1)add("bad",i18("{0} requires full bathymetric coverage, which a single-beam survey cannot give. Use multibeam.",on));
else if(oi==2)add("bad",i18("{0} requires a 100 % feature search: add side-scan sonar or use multibeam.",on));
S<=mx+1e-6?add("ok",i18("Line spacing {0} m is within the S-44 maximum of {1} m (3 × depth or 25 m).",S.toFixed(0),mx.toFixed(0))):add("bad",i18("Line spacing {0} m exceeds the S-44 maximum of {1} m (3 × depth or 25 m).",S.toFixed(0),mx.toFixed(0)));
cov>=.05?add("ok",i18("Bathymetric coverage about {0} %, cross lines included (S-44 asks at least 5 % for Order 2 and 1b).",(cov*100).toFixed(1))):add("bad",i18("Bathymetric coverage about {0} %, cross lines included, is below the 5 % S-44 minimum for Order 2 and 1b.",(cov*100).toFixed(1)));
ul.insertAdjacentHTML("afterbegin",C.join(""))};
// map sheet and reports describe the single beam
const sbSensorTxt=()=>i18("Single-beam echosounder, {0}° beam",g("sbBW"));
const sbSensorRow=()=>[i18("Sensor"),sbSensorTxt()];
const sbSwathRow=()=>[i18("Footprint / coverage"),sbFoot().toFixed(1)+" m / "+(sbFoot()/Math.max(1,g("sbSp"))*100).toFixed(1)+" %"];
const _sbSetLang=setLang;setLang=function(){const r=_sbSetLang.apply(this,arguments);try{sbShow()}catch(e){}return r};

/* typical transducers: the beam width (approximate) */
$("sbM").addEventListener("change",()=>{const v=+$("sbM").value;if(v){$("sbBW").value=v;$("sbBW").dispatchEvent(new Event("input"))}saveSoon()});
$("sbBW").addEventListener("input",e=>{if(e.isTrusted&&+$("sbM").value!==g("sbBW"))$("sbM").value="custom"});
