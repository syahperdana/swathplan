/* ===== shared project: project details, sensor, order, vessel and CRS follow you between planners ===== */
const SH_KEY="swp_shared",SH_ME=window.SWP_TOOL||"MBES line planner",shArea=()=>window.SWP_SHARE_AREA!==false,SH_SEEN=STATE_KEY+"_shseen";
const SH_F="prjN prjC prjV prjS prjNote sdate opH wx mob cal rate sens depth sMk sBm sFq sAn ord spd R loa xcrs zone pjN p4f tl0 tp0 tk tfe tfn da dif dx dy dz xord".split(" ");
SKIPU.add("shOn");
const shLS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
const shOn=()=>shLS("swp_share")!=="0";
const shGet=()=>{try{const s=JSON.parse(shLS(SH_KEY)||"null");return s&&s.v==1?s:null}catch(e){return null}};
let shSeen=+shLS(SH_SEEN)||0,shReady=false;
if(!shSeen){const own=loadState();if(own&&own.t)shSeen=own.t}// first run after an update: the planner's own last save
const shR=a=>a.map(q=>[+q[0].toFixed(7),+q[1].toFixed(7)]);
function shMine(){const u=collectUI(),ui={};SH_F.forEach(k=>{if(k in u)ui[k]=u[k]});const m={ui,crs:typeof crsDef=="string"?crsDef:""};
if(shArea()&&closed&&poly.length>=3)m.area={p:shR(poly.map(toLL)),c:1};return m}
const shSameUI=(a,b)=>SH_F.every(k=>!(k in a)||!(k in b)||String(a[k])==String(b[k]));
function shWrite(){if(!shReady||RESET||!shOn())return;const old=shGet(),m=shMine();
if(old&&shSameUI(m.ui,old.ui)&&m.crs==old.crs&&(!m.area||JSON.stringify(m.area)==JSON.stringify(old.area)))return;
const s={v:1,t:Date.now(),from:SH_ME,ui:Object.assign({},old&&old.ui,m.ui),crs:m.crs,area:m.area||(old&&old.area)||null};
shLS(SH_KEY,JSON.stringify(s));shSeen=s.t;shLS(SH_SEEN,String(s.t))}
function shCheck(){const sh=shGet();if(!sh||!shOn()||sh.t<=shSeen)return;shSeen=sh.t;shLS(SH_SEEN,String(sh.t));if(sh.from==SH_ME)return;
const m=shMine(),newArea=shArea()&&sh.area&&sh.area.p&&sh.area.p.length>=3&&JSON.stringify(sh.area)!==JSON.stringify(m.area);
if(shSameUI(m.ui,sh.ui||{})&&(!sh.crs||sh.crs==m.crs)&&!newArea)return;
const st=snapshot();Object.keys(sh.ui||{}).forEach(k=>{if(SH_F.includes(k))st.ui[k]=sh.ui[k]});if(sh.crs)st.crs=sh.crs;
if(newArea){st.polyLL=sh.area.p;st.closed=!!sh.area.c;st.o={lat:sh.area.p[0][0],lon:sh.area.p[0][1]};delete st.V;delete st.poly}
if(applyState(st)){if(newArea)fit(),render();saveState();toast(i18(newArea?"Project details and survey area updated from the {0}.":"Project details updated from the {0}.",i18(sh.from)),6000)}}
const _shSave=saveState;saveState=function(){_shSave();shWrite()};
addEventListener("pagehide",shWrite);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)shCheck()});
addEventListener("storage",e=>{if(e.key==SH_KEY&&!document.hidden)shCheck()});
setTimeout(()=>{shCheck();shReady=true;const c=$("shOn");if(c){c.checked=shOn();c.onchange=()=>{shLS("swp_share",c.checked?"1":"0");if(c.checked)shWrite()}}},600);
