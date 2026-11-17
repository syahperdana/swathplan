/* ===== toast, autosave, .SPL project files, geolocation (v2) ===== */
let _tt=0;function toast(msg,ms){let t=$("toast");if(!t){t=document.createElement("div");t.id="toast";t.setAttribute("role","status");document.body.appendChild(t)}const ft=document.querySelector("footer");t.style.bottom=((ft&&ft.offsetHeight)||0)+12+"px";// above the sticky footer
t.textContent=msg;t.className="on";clearTimeout(_tt);_tt=setTimeout(()=>{t.className=""},ms||5000)}
const SKIPU=new Set(["langSel","snd"]);var RESET=false,_st=0,touched=false;
const ctrls=()=>[...document.querySelectorAll("input[id],select[id],textarea[id]")].filter(e=>e.type!="file"&&e.type!="button"&&!SKIPU.has(e.id));
function collectUI(){const u={};ctrls().forEach(e=>{if(e.type=="checkbox"||e.type=="radio")u[e.id]=e.checked?1:0;else if(e.value.length<=20000)u[e.id]=e.value});return u}
function applyUI(u){Object.keys(u).forEach(k=>{const e=$(k);if(!e||SKIPU.has(k)||e.type=="file")return;const v=u[k];if(e.type=="checkbox"||e.type=="radio")e.checked=!!+v;else if(e.tagName=="SELECT"){if([...e.options].some(op=>op.value==v))e.value=v}else e.value=v})}
function snapshot(){return{v:1,t:Date.now(),ui:collectUI(),o:{lat:o.lat,lon:o.lon},poly:poly.map(p=>[p[0],p[1]]),closed,V:{cx:V.cx,cy:V.cy,k:V.k},crs:typeof crsDef=="string"?crsDef:""}}
const STATE_KEY=window.SWP_STATE_KEY||"swp_state";// each tool keeps its own autosave
function saveState(){if(RESET)return;try{localStorage.setItem(STATE_KEY,JSON.stringify(snapshot()))}catch(e){}}
function saveSoon(){if(RESET||_st)return;_st=setTimeout(()=>{_st=0;saveState()},1000)}
function loadState(){try{const s=JSON.parse(localStorage.getItem(STATE_KEY)||"null");return s&&s.v==1?s:null}catch(e){return null}}
function applyState(st){try{
if(st.o&&isFinite(st.o.lat)&&isFinite(st.o.lon))o={lat:+st.o.lat,lon:+st.o.lon};
if(st.ui&&/^carto/.test(st.ui.bm||""))st.ui.bm="esristreet";applyUI(st.ui||{});if(typeof st.crs=="string")crsDef=st.crs;
sel();syncCRS();applyUI(st.ui||{});
poly=st.polyLL?st.polyLL.map(a=>fromLL(a[0],a[1])):(st.poly||[]).map(p=>[+p[0],+p[1]]);poly=poly.filter(p=>isFinite(p[0])&&isFinite(p[1]));
closed=!!st.closed&&poly.length>=3;draw=!closed;
if(st.pre&&$("pre2"))$("pre2").value=st.pre;
if(st.V&&isFinite(st.V.k)&&isFinite(st.V.cx)&&isFinite(st.V.cy))V={cx:+st.V.cx,cy:+st.V.cy,k:+st.V.k};else fit();
clampV();projC();analyse();gen();return true}catch(e){console.error(e);return false}}
const escS=s=>String(s).replace(/\\/g,"\\\\").replace(/\r/g,"\\r").replace(/\n/g,"\\n"),unescS=s=>s.replace(/\\(\\|n|r)/g,(m,c)=>c=="n"?"\n":c=="r"?"\r":"\\");
function splText(){const s=snapshot(),L=["SWATHPLAN-SPL 1","# SwathPlan project file (plain text, UTF-8). Boundary = WGS 84 decimal degrees.","# Saved "+new Date().toISOString(),"","[ORIGIN]","lat = "+o.lat,"lon = "+o.lon,"","[VIEW]","cx = "+V.cx,"cy = "+V.cy,"k = "+V.k,"","[BOUNDARY]","closed = "+(closed?1:0),"# latitude longitude"];
poly.forEach(p=>{const q=toLL(p);L.push(q[0].toFixed(8)+" "+q[1].toFixed(8))});L.push("","[SETTINGS]");Object.keys(s.ui).forEach(k=>L.push(k+" = "+escS(s.ui[k])));
if(s.crs)L.push("","[CRSDEF]","def = "+escS(s.crs));L.push("","[END]","");return L.join("\n")}
function splParse(txt){const lines=txt.replace(/^﻿/,"").split(/\r?\n/);if(!/^SWATHPLAN-SPL\b/i.test((lines[0]||"").trim()))throw new Error("not a SwathPlan .SPL file");
const st={ui:{},polyLL:[],V:null,o:null,closed:false,crs:""};let sec="",ov={},vv={};
for(const raw of lines.slice(1)){const l=raw.trim();if(!l||l[0]=="#")continue;const m=l.match(/^\[(\w+)\]$/);if(m){sec=m[1].toUpperCase();continue}
if(sec=="BOUNDARY"&&l.indexOf("=")<0){const a=l.split(/[\s,;]+/).map(Number);if(a.length>=2&&isFinite(a[0])&&isFinite(a[1]))st.polyLL.push([a[0],a[1]]);continue}
const i=raw.indexOf("=");if(i<0)continue;const k=raw.slice(0,i).trim(),v=unescS(raw.slice(i+1).replace(/^ /,"").replace(/\r$/,""));
if(sec=="ORIGIN")ov[k]=+v;else if(sec=="VIEW")vv[k]=+v;else if(sec=="BOUNDARY"&&k=="closed")st.closed=v.trim()=="1";else if(sec=="SETTINGS")st.ui[k]=v;else if(sec=="CRSDEF"&&k=="def")st.crs=v}
if(isFinite(ov.lat)&&isFinite(ov.lon))st.o={lat:ov.lat,lon:ov.lon};if(isFinite(vv.k)&&isFinite(vv.cx)&&isFinite(vv.cy))st.V=vv;
if(!st.o&&st.polyLL.length){st.o={lat:st.polyLL[0][0],lon:st.polyLL[0][1]}}Object.keys(SPL_ALIAS).forEach(k=>{if(k in st.ui&&!(SPL_ALIAS[k] in st.ui))st.ui[SPL_ALIAS[k]]=st.ui[k]});return st}
const hav=(a,b,c,d)=>{const r=x=>x*D,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)))};
function nearestPre(lat,lon){let best=null,bd=1e18;for(const k in PRE){const q=PRE[k],d=hav(lat,lon,q[0],q[1]);if(d<bd){bd=d;best=k}}return best?{key:best,km:bd}:null}
const TZC={"Asia/Jakarta":[-6.1,106.8],"Asia/Makassar":[-5.1,119.4],"Asia/Jayapura":[-2.5,140.7],"Asia/Pontianak":[-0.0,109.3],"Asia/Singapore":[1.3,103.8],"Asia/Kuala_Lumpur":[3.1,101.7],"Asia/Bangkok":[13.8,100.5],"Asia/Ho_Chi_Minh":[10.8,106.7],"Asia/Manila":[14.6,121],"Asia/Hong_Kong":[22.3,114.2],"Asia/Shanghai":[31.2,121.5],"Asia/Taipei":[25,121.5],"Asia/Seoul":[35.1,129],"Asia/Tokyo":[35.7,139.8],"Asia/Kolkata":[19,72.8],"Asia/Calcutta":[19,72.8],"Asia/Karachi":[24.9,67],"Asia/Dhaka":[22.3,91.8],"Asia/Colombo":[6.9,79.9],"Asia/Dubai":[25.3,55.3],"Asia/Riyadh":[21.5,39.2],"Asia/Tehran":[27.2,56.3],"Asia/Baghdad":[30.5,47.8],"Asia/Jerusalem":[32.8,35],"Asia/Istanbul":[41,29],"Europe/Istanbul":[41,29],"Europe/London":[51.5,0.5],"Europe/Dublin":[53.3,-6.2],"Europe/Lisbon":[38.7,-9.1],"Europe/Madrid":[41.4,2.2],"Europe/Paris":[49.5,0.1],"Europe/Brussels":[51.2,4.4],"Europe/Amsterdam":[51.9,4.5],"Europe/Berlin":[53.5,10],"Europe/Rome":[44.4,8.9],"Europe/Athens":[37.9,23.6],"Europe/Stockholm":[57.7,11.9],"Europe/Oslo":[59.9,10.7],"Europe/Copenhagen":[55.7,12.6],"Europe/Helsinki":[60.2,24.9],"Europe/Warsaw":[54.4,18.6],"Europe/Moscow":[59.9,30.3],"Europe/Kiev":[46.5,30.7],"Europe/Kyiv":[46.5,30.7],"Africa/Cairo":[31.2,29.9],"Africa/Lagos":[6.4,3.4],"Africa/Johannesburg":[-29.9,31],"Africa/Nairobi":[-4,39.7],"Africa/Casablanca":[33.6,-7.6],"Africa/Algiers":[36.8,3],"Africa/Accra":[5.6,-0.2],"America/New_York":[40.6,-74],"America/Chicago":[29.7,-95],"America/Denver":[39.7,-105],"America/Los_Angeles":[33.7,-118.2],"America/Vancouver":[49.3,-123.1],"America/Toronto":[43.6,-79.4],"America/Halifax":[44.6,-63.6],"America/Mexico_City":[19.1,-96.1],"America/Panama":[9,-79.5],"America/Bogota":[10.4,-75.5],"America/Lima":[-12,-77.1],"America/Santiago":[-33,-71.6],"America/Sao_Paulo":[-23.9,-46.3],"America/Argentina/Buenos_Aires":[-34.6,-58.4],"Pacific/Auckland":[-36.8,174.8],"Australia/Sydney":[-33.9,151.2],"Australia/Melbourne":[-37.8,144.9],"Australia/Brisbane":[-27.4,153.1],"Australia/Perth":[-32,115.8],"Pacific/Honolulu":[21.3,-157.9]};
function tzGuess(){let id="";try{id=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}if(TZC[id])return TZC[id];const lon=-new Date().getTimezoneOffset()/60*15;return[10,lon]}
function geoByIP(){const get=(u,pick)=>{const c=window.AbortController?new AbortController():null;const t=setTimeout(()=>c&&c.abort(),4500);return fetch(u,c?{signal:c.signal}:{}).then(r=>r.json()).then(pick).catch(()=>null).finally(()=>clearTimeout(t))};
return get("https://ipwho.is/",j=>j&&j.success!==false&&isFinite(j.latitude)?[+j.latitude,+j.longitude,j.country_code]:null).then(r=>r||get("https://ipapi.co/json/",j=>j&&isFinite(j.latitude)?[+j.latitude,+j.longitude,j.country_code]:null))}
function gotoPreset(k){const s=$("pre2");s.value=k;s.onchange({target:s})}
function locate(manual){let fin=false;const done=(la,lo,src,cc)=>{if(fin||(!manual&&touched))return;fin=true;const n=nearestPre(la,lo);if(!n)return;autoLang(cc||ccFromPreset(n.key));gotoPreset(n.key);toast(i18("Nearest area preset to your location: {0} ({1} km, {2}).",n.key,Math.round(n.km),src),7000)};
const tz=()=>{const g=tzGuess();done(g[0],g[1],i18("time-zone estimate"))},net=()=>geoByIP().then(r=>r?done(r[0],r[1],i18("approximate, from network"),r[2]):tz());
if(navigator.geolocation){try{navigator.geolocation.getCurrentPosition(p=>done(p.coords.latitude,p.coords.longitude,i18("GPS / Wi-Fi")),()=>net(),{enableHighAccuracy:false,timeout:8000,maximumAge:3600000})}catch(e){net()}}else net()}
// .SPL compatibility: a file opens on top of the page defaults, so settings an older file does not
// mention come out as they were when it was saved (a key that is ever renamed goes in SPL_ALIAS)
let UI_DEFAULTS=null;const SPL_ALIAS={};
function initApp(){syncCRS();sel();setupLayout();UI_DEFAULTS=collectUI();setTimeout(()=>{try{const la=localStorage.getItem("swp_langauto");if(la&&!langManual()&&PACKS[la])setLang(la,1)}catch(e){}},0);const st=loadState();
if(st&&applyState(st)){setTimeout(()=>toast(i18("Restored your last session ({0}).",new Date(st.t).toLocaleString()),4000),0);setTimeout(()=>{if(!langManual()&&!localStorage.getItem("swp_langauto")){const g=tzGuess(),n=nearestPre(g[0],g[1]);if(n)autoLang(ccFromPreset(n.key),1);if(navigator.onLine)geoByIP().then(r=>r&&r[2]&&autoLang(r[2],1))}},1);return}
$("bm").value=navigator.onLine?"esristreet":"none";const g=tzGuess(),n=nearestPre(g[0],g[1]);gotoPreset(n?n.key:"South Korea — Busan");setTimeout(()=>{if(n)autoLang(ccFromPreset(n.key),1)},1);
if(navigator.onLine)setTimeout(()=>locate(false),50)}
cv.addEventListener("pointerdown",()=>{touched=true});document.addEventListener("input",e=>{touched=true;saveSoon()},true);document.addEventListener("change",()=>saveSoon(),true);
addEventListener("pagehide",saveState);document.addEventListener("visibilitychange",()=>{if(document.hidden)saveState()});
$("bLoc").onclick=()=>{toast(i18("Locating…"),3000);locate(true)};
// save: ask for the file name (default: the project name, else survey_plan) in a small in-page dialog
const splClean=v=>(v||"").trim().replace(/\.spl$/i,"").replace(/[\\\/:*?"<>|]+/g,"_").slice(0,80).trim();
function splAsk(def,cb){let d=$("splDlg");if(!d){d=document.createElement("div");d.id="splDlg";d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");
d.style.cssText="position:fixed;inset:0;background:#0006;display:flex;align-items:center;justify-content:center;z-index:1300";
d.innerHTML='<form style="background:#fff;color:#12262d;padding:16px 18px;border-radius:8px;width:min(420px,92vw);box-shadow:0 8px 30px #0004"><b id="splT" style="display:block;margin-bottom:8px"></b>'
+'<div style="display:flex;align-items:center;gap:4px"><input id="splN" type="text" style="flex:1;min-width:0" autocomplete="off" spellcheck="false"><span>.spl</span></div>'
+'<div style="text-align:right;margin-top:12px"><button type="button" id="splNo"></button><button type="submit" class="p" id="splOk"></button></div></form>';document.body.appendChild(d);
d.querySelector("form").onsubmit=e=>{e.preventDefault();const n=splClean($("splN").value)||"survey_plan";d.hidden=true;d.style.display="none";d._cb&&d._cb(n)};
$("splNo").onclick=()=>{d.hidden=true;d.style.display="none"};d.addEventListener("keydown",e=>{if(e.key=="Escape")$("splNo").click()});d.addEventListener("click",e=>{if(e.target===d)$("splNo").click()})}
$("splT").textContent=i18("Save the project as");$("splNo").textContent=i18("Cancel");$("splOk").textContent=i18("Save");d._cb=cb;$("splN").value=def;d.hidden=false;d.style.display="flex";setTimeout(()=>{$("splN").focus();$("splN").select()},0)}
$("spSave").onclick=()=>splAsk(splClean($("prjN").value)||"survey_plan",nm=>{save(nm+".spl",splText(),"text/plain;charset=utf-8");toast(i18("Project saved as {0}.spl",nm),4000)});
$("spImp").onchange=e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const r=new FileReader();r.onload=()=>{try{const st=splParse(String(r.result));if(UI_DEFAULTS)st.ui=Object.assign({},UI_DEFAULTS,st.ui);if(applyState(st)){saveState();toast(i18("Project loaded: {0}",f.name),4500)}else toast(i18("Could not apply the project file."),5000)}catch(err){toast(i18("Not a valid SwathPlan .SPL file."),5000)}};r.readAsText(f)};
$("spReset").onclick=()=>{if(!confirm(i18("Forget the saved settings and restart with defaults?")))return;RESET=true;try{localStorage.removeItem(STATE_KEY)}catch(e){}location.reload()};

initApp();
