/* ===== hub page: languages, install, storage ===== */
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
const PK=(()=>{try{return JSON.parse(document.getElementById("langpack").textContent)}catch(e){return{en:[]}}})(),EN=PK.en,DICT=new Map(),RTL=new Set(["ar","ur"]);
let LANG="en";
const i18=(s,...a)=>{let t=DICT.get(s);if(t===undefined)t=s;return a.length?t.replace(/\{(\d+)\}/g,(m,i)=>a[+i]!==undefined?a[+i]:m):t};
const UNITS=[...document.querySelectorAll("[data-t]")].map(el=>({el,key:el.innerHTML.replace(/\s+/g," ").trim()}));
function setLang(l){if(!PK[l])l="en";LANG=l;DICT.clear();if(l!="en")EN.forEach((k,i)=>{const t=PK[l][i];if(t)DICT.set(k,t)});
const de=document.documentElement;de.lang=l;de.dir=RTL.has(l)?"rtl":"ltr";
UNITS.forEach(u=>{u.el.innerHTML=i18(u.key).replace(/IHO S-44/g,'<bdi class="nw">IHO S-44</bdi>')});document.title="SwathPlan – "+i18("Survey planning tools");
document.getElementById("langSel").value=l;showStore()}
// Same choice as the planner: a manual pick wins, then the planner's automatic pick, then the browser language.
function firstLang(){const m=LS("swp_lang")||LS("swp_langauto");if(m&&PK[m])return m;
for(const n of navigator.languages||[navigator.language||"en"]){const c=String(n).toLowerCase().split("-")[0];if(c=="fil"&&PK.tl)return"tl";if(PK[c])return c}return"en"}
const sel=document.getElementById("langSel");
LANGS.forEach(([c,n])=>{if(c=="en"||PK[c])sel.add(new Option(n,c))});
sel.onchange=()=>{LS("swp_lang",sel.value);setLang(sel.value)};
// install: Chrome/Edge/Android give a prompt; iPhone and iPad need Share > Add to Home Screen
const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform=="MacIntel"&&navigator.maxTouchPoints>1);
if(standalone){document.getElementById("instOk").hidden=false;document.getElementById("instBox").hidden=true}
else if(ios)document.getElementById("instIos").hidden=false;
const ib=document.getElementById("instBtn");
const canInstall=()=>{if(!standalone&&window.swpInstall)ib.hidden=false};
addEventListener("swp-installable",canInstall);
ib.onclick=()=>{const e=window.swpInstall;if(!e)return;e.prompt();e.userChoice.then(()=>{window.swpInstall=null;ib.hidden=true})};
addEventListener("appinstalled",()=>{ib.hidden=true});
function showStore(){const el=document.getElementById("store");if(!navigator.storage||!navigator.storage.estimate){el.textContent="";return}
navigator.storage.estimate().then(e=>{const mb=(e.usage||0)/1048576;el.textContent=i18("Offline storage used: {0}",(mb<10?mb.toFixed(1):Math.round(mb))+" MB")}).catch(()=>{})}
setLang(firstLang());
