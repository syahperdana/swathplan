/* ===== survey planner: show what the chosen survey needs, switch the corridor and geophysical parts on and off ===== */
// a text unit of the translation engine can be re-pointed at another English string
function unitKey(el,key){if(!el)return;UNITS.forEach(u=>{if((u.node&&u.node.parentNode===el)||u.el===el)u.key=key})}
let MODE_LAST=null,AREA_LL=null;// the survey area is kept while a corridor is planned, and comes back when switching back
{const st=loadState();if(st&&Array.isArray(st.areaLL))AREA_LL=st.areaLL}
const _mdSnap=snapshot;snapshot=function(){const s=_mdSnap();if(MODE().corr&&AREA_LL)s.areaLL=AREA_LL;return s};
const _mdApply=applyState;applyState=function(st){if(st&&Array.isArray(st.areaLL))AREA_LL=st.areaLL;return _mdApply(st)};
function applyMode(){const m=MODE(),mb=!m.geo||$("gMB").checked,sec=k=>document.querySelector('details[data-sec="'+k+'"]'),show=(e,v)=>{if(e)e.hidden=!v};
show(sec("geo"),m.geo);show(sec("sensor"),mb);show(sec("swath"),mb);show($("tpuD"),mb);
show(sec("bound"),!m.corr);show(sec("dir"),!m.corr);show(sec("route"),m.corr);
// adaptive spacing belongs to multibeam area surveys; tie lines by spacing to geophysical areas
const adp=$("adp"),ar=!m.corr&&!m.geo;if(adp){const d=adp.closest("div");[adp.closest("label"),$("mxS")&&$("mxS").closest(".r2"),$("spR")&&$("spR").closest(".kv"),d&&d.querySelector("p.note")].forEach(e=>show(e,ar));if(!ar&&adp.checked){adp.checked=false}}
const ti=$("gTI");if(ti){show(ti,!m.corr);show(ti.previousElementSibling,!m.corr)}
unitKey($("bDraw"),m.corr?"Draw route":"Draw area");unitKey($("bClose"),m.corr?"Finish route":"Close polygon");
unitKey($("hud"),m.corr?"Drag to pan · wheel to zoom · click to add route points":"Drag to pan · wheel to zoom · click to add vertices")}
function setMode(){const m=MODE(),was=MODE_LAST;MODE_LAST=m;applyMode();
if(was&&was.corr!==m.corr){if(m.corr){AREA_LL=closed&&poly.length>=3?poly.map(toLL):AREA_LL;if(draw&&!closed){poly=[];draw=true}else coFromArea()}
else{CO.P=null;if(AREA_LL&&AREA_LL.length>=3){poly=AREA_LL.map(q=>fromLL(q[0],q[1]));closed=true;draw=false}else if(!closed)draw=true}}
gen();setLang(LANG);if(was&&was.corr!==m.corr){fit();analyse();gen()}render();saveSoon()}
["svT","svG","gMB"].forEach(id=>$(id).addEventListener("change",setMode));
// links from the old tool pages and the hub: ?type=mbes|geo&shape=area|corr
(()=>{const q=new URLSearchParams(location.search),t=q.get("type"),s=q.get("shape");if(t&&[...$("svT").options].some(o=>o.value==t))$("svT").value=t;if(s&&[...$("svG").options].some(o=>o.value==s))$("svG").value=s;
if(t||s)history.replaceState(null,"",location.pathname+location.hash);
MODE_LAST=t||s?{geo:false,corr:false}:MODE();setMode()})();
