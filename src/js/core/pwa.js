/* ===== offline app (PWA): service worker, update banner, install ===== */
(()=>{
const web=/^https?:$/.test(location.protocol),T=(s,...a)=>typeof i18=="function"?i18(s,...a):s;
const root=(document.querySelector('meta[name="swp-root"]')||{}).content||"./";
// The hub only exists on the website: a downloaded copy links to the online hub.
// Manifest and icons are added on the website only, so a downloaded copy does not look for missing files.
if(web&&!document.querySelector('link[rel="manifest"]')){[["manifest","manifest.webmanifest"],["icon","icons/icon-192.png"],["apple-touch-icon","icons/apple-touch-icon.png"]].forEach(([r,h])=>{const l=document.createElement("link");l.rel=r;l.href=root+h;document.head.appendChild(l)});
const tc=document.createElement("meta");tc.name="theme-color";tc.content="#12262d";document.head.appendChild(tc)}
{const a=document.getElementById("logoHub");if(a){if(web)a.href=root;else{a.href="https://syahperdana.github.io/swathplan/";a.target="_blank";a.rel="noopener"}}}
// tools menu: the current page is marked; a downloaded copy links to the live site
document.querySelectorAll("#tmenu .tml a,a.swp-doc[data-p]").forEach(a=>{const p=a.dataset.p;if(web)a.href=root+p;else{a.href="https://syahperdana.github.io/swathplan/"+p;a.target="_blank";a.rel="noopener"}if(web&&p&&location.pathname.indexOf("/"+p)>=0)a.classList.add("on")});
{const m=document.getElementById("tmenu");if(m)document.addEventListener("click",e=>{if(m.open&&!m.contains(e.target))m.open=false})}
if(!document.getElementById("swpBarCss")){const st=document.createElement("style");st.id="swpBarCss";
st.textContent="#swpBar{position:fixed;left:50%;top:calc(var(--hh,0px) + 10px);transform:translateX(-50%);background:#12262d;color:#fff;border:1px solid #16c4b4;border-radius:8px;padding:7px 8px 7px 14px;display:flex;gap:10px;align-items:center;z-index:100;font-size:13px;box-shadow:0 4px 18px #0006;max-width:92vw}#swpBar button{background:#16c4b4;color:#06202b;border:0;border-radius:5px;padding:5px 11px;font-weight:600;cursor:pointer;margin:0;font-size:13px}#swpBar button.x{background:transparent;color:#9fc2bd;font-size:18px;line-height:1;padding:0 4px}@media print{#swpBar{display:none}}";
document.head.appendChild(st)}
let hideT;
function bar(msg,btn,fn,ms){let b=document.getElementById("swpBar");if(!b){b=document.createElement("div");b.id="swpBar";b.setAttribute("role","status");document.body.appendChild(b)}
b.textContent="";const m=document.createElement("span");m.textContent=msg;b.appendChild(m);
if(btn){const k=document.createElement("button");k.type="button";k.textContent=btn;k.onclick=fn;b.appendChild(k)}
const x=document.createElement("button");x.type="button";x.className="x";x.textContent="×";x.title=T("Close");x.setAttribute("aria-label",T("Close"));x.onclick=()=>b.remove();b.appendChild(x);
clearTimeout(hideT);if(ms)hideT=setTimeout(()=>b.remove(),ms)}
window.swpBar=bar;
// Chrome and Android offer installation through this event; the hub shows an Install button.
addEventListener("beforeinstallprompt",e=>{e.preventDefault();window.swpInstall=e;dispatchEvent(new Event("swp-installable"))});
const keep=()=>{try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persisted().then(p=>p||navigator.storage.persist())}catch(e){}};
addEventListener("appinstalled",keep);
if(!web||!("serviceWorker" in navigator))return;
// Installed apps ask the browser not to clear their offline data (no prompt in Chrome, Edge or Safari).
if(matchMedia("(display-mode: standalone)").matches||navigator.standalone)keep();
let wantReload=false;
navigator.serviceWorker.addEventListener("controllerchange",()=>{if(wantReload){wantReload=false;location.reload()}});
addEventListener("load",()=>{navigator.serviceWorker.register(root+"sw.js",{scope:root}).then(reg=>{
const offer=w=>bar(T("A new version of SwathPlan is ready."),T("Update"),()=>{wantReload=true;w.postMessage("skipWaiting")});
if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
reg.addEventListener("updatefound",()=>{const w=reg.installing;if(w)w.addEventListener("statechange",()=>{if(w.state!="installed")return;
if(navigator.serviceWorker.controller)offer(w);else bar(T("SwathPlan is ready to work offline."),null,null,7000)})});
// look for a new version whenever the app comes back to the screen
document.addEventListener("visibilitychange",()=>{if(document.visibilityState=="visible")reg.update().catch(()=>{})});
}).catch(e=>console.warn("Offline mode unavailable:",e))});
})();
