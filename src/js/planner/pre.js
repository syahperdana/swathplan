/* ===== survey planner: one page for MBES or geophysical surveys, over an area or along a route ===== */
// the survey type and shape come from the two selects of the setup section (autosaved like any input)
const MODE=()=>{const t=document.getElementById("svT"),s=document.getElementById("svG");return{geo:!!t&&t.value=="geo",sbes:!!t&&t.value=="sbes",corr:!!s&&s.value=="corr"}};
window.SWP_STATE_KEY="swp_state";window.SWP_TITLE="SwathPlan – Survey Planner (Offline)";
Object.defineProperties(window,{
SWP_TOOL:{get:()=>"Survey planner"},
SWP_SHARE_AREA:{get:()=>!MODE().corr},
SWP_NEED:{get:()=>MODE().corr?"Draw or import a route first.":"Draw and close an area first."},
SWP_SHEET_TITLE:{get:()=>{const m=MODE();return m.geo?(m.corr?"GEOPHYSICAL CORRIDOR SURVEY LINE PLAN":"GEOPHYSICAL SURVEY LINE PLAN"):m.sbes?(m.corr?"SINGLE-BEAM CORRIDOR SURVEY LINE PLAN":"SINGLE-BEAM SURVEY LINE PLAN"):(m.corr?"CORRIDOR SURVEY LINE PLAN":"MBES SURVEY LINE PLAN")}},
SWP_BOUND:{get:()=>MODE().corr?"Corridor boundary":"Survey area boundary"},
SWP_BOUND_PDF:{get:()=>MODE().corr?"Corridor boundary (WGS 84)":"Survey area boundary (WGS 84)"},
SWP_REPORT_SUB:{get:()=>{const m=MODE();return m.geo?"Geophysical survey line plan and IHO S-44 summary":m.sbes?"Single-beam survey line plan and IHO S-44 summary":m.corr?"Corridor survey line plan and IHO S-44 summary":"MBES survey line plan and IHO S-44 summary"}},
// map sheet rows: set by the corridor and geophysical parts when their mode is on
SWP_AZROW:{get:()=>MODE().corr&&typeof coAzRow=="function"?coAzRow:undefined},
SWP_SEGS:{get:()=>MODE().corr&&typeof coSegs=="function"?coSegs():[]},
SWP_SENSORROW:{get:()=>MODE().geo&&typeof geoSensorRow=="function"?geoSensorRow:MODE().sbes&&typeof sbSensorRow=="function"?sbSensorRow:undefined},
SWP_SWATHROW:{get:()=>MODE().geo&&typeof geoSwathRow=="function"?geoSwathRow:MODE().sbes&&typeof sbSwathRow=="function"?sbSwathRow:undefined},
// reports: the sensor in words, and whether multibeam swath and overlap apply
SWP_SENSORTXT:{get:()=>MODE().sbes&&typeof sbSensorTxt=="function"?sbSensorTxt():MODE().geo&&typeof geoSensorRow=="function"?geoSensorRow()[1]:undefined},
SWP_MBROWS:{get:()=>{const m=MODE(),mb=document.getElementById("gMB");return !m.sbes&&(!m.geo||!!(mb&&mb.checked))}}});
(()=>{const q=s=>document.querySelector(s),t=(s,v)=>{const e=q(s);if(e)e.textContent=v};
t(".brand small","Survey planner · multibeam and geophysical · area or corridor");
const f=q("footer");if(f)f.innerHTML="© 2026 <b>Aldwin Syahperdana</b>. All rights reserved. · SwathPlan Survey Planner · A planning aid only: verify all results against your equipment specifications, the current IHO S-44 and your client's requirements.";
const g=q("#guide .lead");if(g){const b=document.createElement("div");b.className="card";b.innerHTML="<h3>Survey planner: quick start</h3><ol><li>Choose the survey type and shape (section {§setup}): multibeam or geophysical, over an area or along a route.</li><li>Set the coordinate system (section {§crs}) before importing files without one.</li><li>Set the equipment: the multibeam and swath, or the geophysical sensors in the spread.</li><li>Draw or import the survey boundary or route, then check the lines, turns and plan checks.</li><li>Export the lines (section {§exp}).</li></ol><p>Sections that do not apply to the chosen survey are hidden, so the section numbers follow what you see.</p>";g.after(b)}})();
