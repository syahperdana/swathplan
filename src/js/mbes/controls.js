function close(){if(poly.length<3)return;const c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]),ll=toLL(c);reorigin(ll[0],ll[1]);V.cx-=c[0];V.cy-=c[1];closed=true;draw=false;analyse();gen()}
function clear(){poly=[];closed=false;draw=true;gen()}
$("bClose").onclick=close;$("bClr").onclick=clear;$("bDraw").onclick=()=>{poly=[];closed=false;draw=true;gen()};$("bFit").onclick=()=>{fit();render()};
$("pre2").onchange=e=>{const q=PRE[e.target.value];if(!q)return;o={lat:q[0],lon:q[1]};projC();const[w,h]=[q[2]/2,q[3]/2];poly=[[-w,-h],[w,-h],[w,h],[-w,h]];closed=true;draw=false;fit();analyse();gen()};
function sel(){const s=SENS[$("sens").value];$("sMk").textContent=i18(String(s[1]));$("sBm").textContent=i18(String(s[2]));$("sFq").textContent=i18(String(s[3]));$("sAn").textContent=s[4]+"°";sSrcShow();$("ap").value=$("as").value=s[4]-5>0?Math.min(60,s[4]):60;stats()}
$("sens").onchange=sel;
["depth","ap","as","ov","R","spd","ord","slow","cross","nx","crossPre","pre","clr","trim","adp","mxS","mxW","adpMin","adpTol","opH","wx","mob","cal","svpI","svpD","rate","pingU","bwA","sdate"].forEach(i=>$(i).addEventListener("input",()=>{if(i=="depth")$("qd").value=g("depth");genD()}));let _gt=0;function genD(){clearTimeout(_gt);_gt=setTimeout(gen,90)}
$("az").oninput=()=>{$("azN").value=g("az");genD()};$("azN").oninput=()=>{$("az").value=g("azN");genD()};
document.querySelectorAll("[data-az]").forEach(b=>b.onclick=()=>{$("az").value=$("azN").value=b.dataset.az;gen()});
$("auto").onclick=()=>{if(!closed)return;const S=params().S;let best=0,bn=1e9;const ad=$("adp").checked&&bath;for(let a=0;a<180;a+=ad?5:1){const n=nLines(a,S);if(n<bn){bn=n;best=a}}if(ad)for(let a=Math.max(0,best-4);a<=Math.min(179,best+4);a++){const n=nLines(a,S);if(n<bn){bn=n;best=a}}$("az").value=$("azN").value=best;gen()};
$("loaR").onclick=()=>{$("R").value=Math.round(2.5*g("loa"));gen()};
function turnLen(S,r){const al=S>=2*r?0:Math.acos(S/(2*r));return r*al+r*(Math.PI+al)+(S>2*r?S-2*r:0)}
$("qb").onclick=()=>{const cov=2*g("qd")*Math.tan(g("qa")*D),sp=cov*100/(g("qo")<100?100/(1-Math.max(0,g("qo"))/100):g("qo")),n=g("qn"),len=g("ql")*NM,v=g("qs"),ts=Math.max(1,v-2),r=2.5*g("qL");
const on=n*len/(v*NM),tt=(n-1)*turnLen(sp,r)/(ts*NM),row=(a,b)=>`<div class="kv"><span>${a}</span><b>${b}</b></div>`;
$("qr").innerHTML=row("Total time",hm(on+tt))+row("Coverage",f1(cov))+row("Line spacing",f1(sp))+row("On-line time",hm(on))+row("Turn time",hm(tt))+row("Total distance",((n*len+(n-1)*turnLen(sp,r))/NM).toFixed(2)+" NM")+`<p class="note">Turn radius assumed 2.5 × LOA = ${r.toFixed(0)} m.</p>`};

// where the catalogue values come from: a checked datasheet, or not yet checked
function sSrcShow(){const e=$("sSrc"),s=SENS[$("sens").value];if(!e||!s)return;e.textContent=s[1]=="-"?"":s[5]?i18("Checked against the manufacturer's datasheet: {0}.",s[5]):i18("Not yet checked against a datasheet: treat these values as approximate.");e.className="note"+(s[5]||s[1]=="-"?"":" warn")}
{const _sl=setLang;setLang=function(){const r=_sl.apply(this,arguments);try{sSrcShow()}catch(x){}return r}}

// seabed coverage controls: the slider (100–500 %) and the number box (100–1000 %) set the internal overlap "ov"
{const setCov=(v,src)=>{v=Math.max(100,Math.min(1000,+v||100));$("ov").value=+(100*(1-100/v)).toFixed(4);if(src!="n")$("covN").value=v;if(src!="r")$("cov").value=Math.min(500,v);gen()};
$("cov").addEventListener("input",()=>setCov($("cov").value,"r"));$("covN").addEventListener("change",()=>setCov($("covN").value,"n"));$("covN").addEventListener("input",()=>{const v=+$("covN").value;if(v>=100&&v<=1000)setCov(v,"n")})}
