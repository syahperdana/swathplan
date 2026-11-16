/* ===== long corridors, "one file per segment": every export runs once per segment, showing only that segment's
   lines, turns, cross lines, outline (as the boundary) and statistics; the files go into one zip ===== */
const PS_BTNS=["eLnx","eDxf","eShp","eEiva","eQin","eKml","xBtn","eGj","eQgc","eMp","xpPdf","xpImg"],PS_SHEETS=["xpPdf","xpImg"];
const psOn=()=>{const e=$("xpSegs");return!!e&&e.value=="file"&&typeof MODE=="function"&&MODE().corr&&typeof CO!="undefined"&&CO.segs&&CO.segs.length>1};
let psBusy=false;
// which segment each cross line belongs to: the first whose outline holds its middle
function psCrossSeg(S){const inP=(p,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>p[1])!=(P[j][1]>p[1])&&p[0]<(P[j][0]-P[i][0])*(p[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c};
return R.cross.map(l=>{const q=[(l.a[0]+l.b[0])/2,(l.a[1]+l.b[1])/2],h=S.find(sg=>inP(q,sg.poly));return h?h.n:0})}
async function psRun(btn){const S=CO.segs.slice(),K={lines:R.lines,turns:R.turns,cross:R.cross,tl:R.tl,poly,segs:CO.segs},cs=psCrossSeg(S),files=[],_save=save,mode=$("xpSegs").value;
let tag="";save=(name,data,type)=>files.push([tag?name.replace(/(\.[A-Za-z0-9]+)?$/,m=>"_"+tag+m):name,data,type]);psBusy=true;
const once=async()=>{const n0=files.length,r=btn.onclick.call(btn,{});if(r&&r.then)await r;for(let t=0;t<200&&files.length==n0&&!(r&&r.then);t++)await new Promise(z=>setTimeout(z,50));return files.length>n0};
try{
// map sheets and the report also get an overview of the whole route
if(PS_SHEETS.includes(btn.id)){tag="overview";$("xpSegs").value="all";await once();$("xpSegs").value=mode}
for(const sg of S){const idx=[];K.lines.forEach((l,i)=>{if(l.seg===sg.n)idx.push(i)});if(!idx.length)continue;
R.lines=idx.map(i=>K.lines[i]);R.turns=idx.slice(0,-1).map(i=>K.turns[i]&&K.turns[i].ty!="t"?K.turns[i]:null);R.tl=R.turns.reduce((s,t)=>s+(t&&t.len||0),0);
R.cross=K.cross.filter((_,i)=>cs[i]===sg.n);poly=sg.poly;CO.segs=[sg];stats();tag="S"+String(sg.n).padStart(2,"0");await once()}}
finally{Object.assign(R,{lines:K.lines,turns:K.turns,cross:K.cross,tl:K.tl});poly=K.poly;CO.segs=K.segs;save=_save;psBusy=false;stats();if(typeof rq=="function")rq()}
if(!files.length)return;const te=new TextEncoder(),Z=[];
for(const[n,d]of files)Z.push([n,typeof d=="string"?te.encode(d):d instanceof Uint8Array?d:d instanceof ArrayBuffer?new Uint8Array(d):new Uint8Array(await new Blob([d]).arrayBuffer())]);
const f0=files[files.length-1][0],ext=(f0.match(/\.([A-Za-z0-9]+)$/)||["",""])[1],stem=f0.replace(/_S\d+(\.[A-Za-z0-9]+)?$/,"").replace(/\.[A-Za-z0-9]+$/,"");
save(stem+(ext&&ext!="zip"?"_"+ext:"")+"_per_segment.zip",zipFiles(Z),"application/zip");
if(typeof toast=="function")toast(i18("Saved {0} files in one zip: one per segment.",files.length));else if(typeof xst=="function")xst(i18("Saved {0} files in one zip: one per segment.",files.length))}
// catch the click before the button's own handler, and run it per segment instead
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("button");if(!b||psBusy||!PS_BTNS.includes(b.id)||!psOn()||!b.onclick)return;
e.stopPropagation();e.preventDefault();psRun(b).catch(err=>{alert(err&&err.message||String(err))})},true);
