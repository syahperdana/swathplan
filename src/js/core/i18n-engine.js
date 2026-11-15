let LANG="en";const DICT=new Map(),LATIN=new Set(["en","id","de","fr","it","es","nl","af","pt","tl","ms","sv","da","no","nb","fi","ca"]),RTL=new Set(["ar","he","fa","ur"]),CJKL=new Set(["ja","zh","ko"]),
FF='"Segoe UI","Noto Sans","Noto Sans CJK SC","Noto Sans CJK JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","Noto Sans Arabic","Noto Naskh Arabic","Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR","Nirmala UI","Kohinoor Devanagari","Noto Sans Devanagari","Noto Sans Bengali","Leelawadee UI","Noto Sans Thai","Noto Sans Hebrew","Arial Unicode MS","Tahoma",Arial,sans-serif',
i18=(s,...a)=>{let t=DICT.get(s);if(t===undefined)t=s;return a.length&&typeof t=="string"?t.replace(/\{(\d+)\}/g,(m,i)=>a[+i]!==undefined?a[+i]:m):t};
const UNITS=(()=>{const U=[],norm=s=>s.replace(/\s+/g," ").trim(),SK=new Set(["SCRIPT","STYLE","svg","SVG","CANVAS","TEXTAREA","PRE"]),INL=new Set(["B","I","EM","STRONG","CODE","SUB","SUP","A","SPAN","BR","KBD","SMALL","U"]),LET=/[A-Za-zÀ-ɏ]{2}/;
const inl=el=>[...el.querySelectorAll("*")].every(c=>INL.has(c.tagName)&&!c.id);
const walk=el=>{if(SK.has(el.tagName)||el.getAttribute("data-i18n")=="off"||el.closest("#sens,#ord,#pre2"))return;
["title","placeholder","aria-label"].forEach(a=>{const v=el.getAttribute(a);if(v&&LET.test(v))U.push({k:"a",el,a,key:norm(v)})});
const hasTxt=[...el.childNodes].some(n=>n.nodeType==3&&LET.test(n.nodeValue));
if(hasTxt&&el.children.length&&!el.id&&inl(el)){U.push({k:"h",el,key:norm(el.innerHTML)});return}
[...el.childNodes].forEach(n=>{if(n.nodeType==3){if(LET.test(n.nodeValue)){const m=n.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);U.push({k:"t",node:n,pre:m[1]?" ":"",post:m[3]?" ":"",key:norm(m[2])})}}else if(n.nodeType==1)walk(n)})};
walk(document.body);return U})();
window.__units=()=>UNITS.map(u=>u.key);
const applyUnits=()=>UNITS.forEach(u=>{const t=DICT.get(u.key),v=t===undefined?u.key:t;if(u.k=="t")u.node.nodeValue=u.pre+v+u.post;else if(u.k=="h")u.el.innerHTML=v;else u.el.setAttribute(u.a,v)});
