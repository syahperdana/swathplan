/* ===== docs pages (guide, science): the page frame follows the chosen language; the text itself is English for now ===== */
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
const PK=(()=>{try{return JSON.parse(document.getElementById("langpack").textContent)}catch(e){return{en:[]}}})(),EN=PK.en,DICT=new Map(),RTL=new Set(["ar","ur"]);
const i18=(s,...a)=>{let t=DICT.get(s);if(t===undefined)t=s;return a.length?t.replace(/\{(\d+)\}/g,(m,i)=>a[+i]!==undefined?a[+i]:m):t};
const UNITS=[...document.querySelectorAll("[data-t]")].map(el=>({el,key:el.innerHTML.replace(/\s+/g," ").trim()}));
const TITLE=document.body.dataset.title||"";
// only the frame (header, contents, footer) changes direction; the English text stays left to right
function setLang(l){if(!PK[l])l="en";DICT.clear();if(l!="en")EN.forEach((k,i)=>{const t=PK[l][i];if(t)DICT.set(k,t)});
const de=document.documentElement;de.lang=l;const rtl=RTL.has(l);document.querySelectorAll("header,#toc,footer").forEach(e=>e.dir=rtl?"rtl":"ltr");
UNITS.forEach(u=>{u.el.innerHTML=i18(u.key)});
// the page keeps its strings in their HTML form ("&amp;"), so the title is looked up that way
const tk=TITLE.replace(/&/g,"&amp;"),tt=i18(tk);document.title="SwathPlan – "+(tt!==tk?tt.replace(/&amp;/g,"&"):i18(TITLE));document.getElementById("langSel").value=l}
function firstLang(){const m=LS("swp_lang")||LS("swp_langauto");if(m&&PK[m])return m;
for(const n of navigator.languages||[navigator.language||"en"]){const c=String(n).toLowerCase().split("-")[0];if(c=="fil"&&PK.tl)return"tl";if(PK[c])return c}return"en"}
const sel=document.getElementById("langSel");LANGS.forEach(([c,n])=>{if(c=="en"||PK[c])sel.add(new Option(n,c))});
sel.onchange=()=>{LS("swp_lang",sel.value);setLang(sel.value)};
// contents: from the h2 and h3 of the article
{const toc=document.getElementById("toc"),art=document.querySelector("article");if(toc&&art){const used=new Set();
art.querySelectorAll("h2,h3").forEach(h=>{if(!h.id){let id=h.textContent.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");while(used.has(id))id+="-";h.id=id}used.add(h.id);
const a=document.createElement("a");a.href="#"+h.id;a.textContent=h.textContent.replace(/^\d+(\.\d+)*\s+/,m=>m);if(h.tagName=="H3")a.className="l3";toc.appendChild(a)});
// mark where the reader is
const links=[...toc.querySelectorAll("a")],hs=links.map(a=>document.getElementById(a.hash.slice(1)));
const spy=()=>{let k=0;hs.forEach((h,i)=>{if(h.getBoundingClientRect().top<80)k=i});links.forEach((a,i)=>a.classList.toggle("on",i==k))};addEventListener("scroll",spy,{passive:true});spy()}}
// footnotes: <sup class="fn"><a href="#r3">3</a></sup>; each reference gets a link back to where it was first cited
document.querySelectorAll("sup.fn a").forEach((a,i)=>{if(!a.id)a.id="c"+i});
document.querySelectorAll("ol.refs li[id]").forEach(li=>{const c=document.querySelector('sup.fn a[href="#'+li.id+'"]');if(c){const b=document.createElement("a");b.href="#"+c.id;b.className="back";b.textContent="↩";b.title="Back to the text";li.appendChild(b)}});
setLang(firstLang());
