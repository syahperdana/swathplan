
/* ===== language packs, selector, import/export ===== */
const PK=(()=>{let o={en:[],_:{}};try{o=JSON.parse($("langpack").textContent)}catch(e){}return o})(),EN=PK.en,PACKS={};
LANGS.forEach(([c,n])=>{PACKS[c]={name:n,arr:c=="en"?null:PK[c]||[]}});
try{const ex=JSON.parse(localStorage.getItem("swp_packs")||"{}");Object.keys(ex).forEach(c=>regPack(c,ex[c]))}catch(e){}
function regPack(c,p){PACKS[c]={name:p.name||c,map:p.strings||{},rtl:!!p.rtl,latin:p.latin!==false};if(p.rtl)RTL.add(c);if(p.latin===false)LATIN.delete(c);else LATIN.add(c);if(!LANGS.some(x=>x[0]==c))LANGS.push([c,p.name||c])}
function fillLangSel(){const s=$("langSel");s.innerHTML="";LANGS.forEach(([c,n])=>s.add(new Option(n,c)));s.value=LANG}
function setLang(l,keep){if(!PACKS[l])l="en";const P=PACKS[l];LANG=l;DICT.clear();if(l!="en"){if(P.arr)EN.forEach((k,i)=>{const t=P.arr[i];if(t)DICT.set(k,t)});else Object.keys(P.map).forEach(k=>{if(P.map[k])DICT.set(k,P.map[k])})}
const de=document.documentElement;de.lang=l;de.dir=RTL.has(l)?"rtl":"ltr";applyUnits();document.title=i18(window.SWP_TITLE||"SwathPlan – MBES Survey Line Planner (Offline)");
const ps=+$("sens").value||0,po=$("ord").value,pp=$("pre2").value;buildSens(ps);buildOrd();buildPre();$("ord").value=po;try{$("pre2").value=pp}catch(e){}
if(!keep)try{localStorage.setItem("swp_lang",l)}catch(e){}
$("langSel").value=l;try{stats()}catch(e){console.error(e)}}
$("langSel").onchange=e=>setLang(e.target.value);
$("langTpl").onclick=()=>{const o={code:"xx",name:"Language name",rtl:false,latin:true,note:"Fill in the translations; leave a value empty to keep English. Keep {0},{1}… placeholders and HTML tags.",strings:{}};const cur=LANG!="en"?DICT:null;[...new Set(EN)].forEach(k=>{o.strings[k]=cur&&cur.get(k)||""});const b=new Blob([JSON.stringify(o,null,1)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="swathplan_language_template.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
$("langImp").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);if(!p.code||!p.strings)throw 0;const c=String(p.code).toLowerCase();regPack(c,p);try{const ex=JSON.parse(localStorage.getItem("swp_packs")||"{}");ex[c]=p;localStorage.setItem("swp_packs",JSON.stringify(ex))}catch(x){}fillLangSel();setLang(c)}catch(x){alert(i18("Not a valid SwathPlan language pack."))}};r.readAsText(f);e.target.value=""};
fillLangSel();{let l="en";try{l=localStorage.getItem("swp_lang")||"en"}catch(e){}if(l!="en")setLang(l,1)}
