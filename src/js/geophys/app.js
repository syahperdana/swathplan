/* ===== geophysical planner: sensor spacing, run-in, tie lines, checks (runs after the shared planner) ===== */
const KN=.5144;
// what each ticked sensor needs; the closest spacing drives the plan
function geoCalc(mb){const on=id=>$(id).checked,v=id=>g(id),spd=v("spd"),rows=[];let runIn=0,runOut=0,towed=false;
if(on("gSS")){towed=true;const R=Math.max(1,v("gSR")),C=+$("gSC").value||200,ov=Math.min(50,Math.max(0,v("gSO"))),S=2*R/(C/100)*(1-ov/100),prf=1500/(2*R),vmax=Math.max(0,v("gSL"))*prf/Math.max(1,v("gSP"))/KN,gap=2*Math.max(0,v("gSA"));
rows.push({k:"sss",n:i18("Side-scan sonar"),S,W:2*R,ok:true,info:i18("{0} m range, {1} % coverage; max {2} kn for {3} pings on a {4} m target",R,C,vmax.toFixed(1),v("gSP"),v("gSL")),vmax,gap,C})}
if(on("gMG")){towed=true;const h=Math.max(0,v("gMA")),Dd=Math.max(0,v("gMD")),ok=Dd>h,S=ok?2*Math.sqrt(Dd*Dd-h*h):NaN,ds=spd*KN/Math.max(1,v("gMF"));
rows.push({k:"mag",n:i18("Magnetometer"),S,W:S,ok,info:ok?i18("targets within {0} m of the sensor at {1} m height; a sample every {2} m at {3} kn",Dd,h,ds.toFixed(2),spd):i18("detection distance must be larger than the sensor height"),ds})}
if(on("gSB"))rows.push({k:"sbp",n:i18("Sub-bottom profiler"),S:Math.max(1,v("gBS")),W:Math.max(1,v("gBS")),ok:true,info:i18("grid spacing")});
if(on("gSE")){towed=true;const Ls=Math.max(0,v("gEL"));runIn=Math.max(runIn,Ls/2);runOut=Math.max(runOut,Ls/2);
rows.push({k:"uhr",n:i18("UHR seismic (2D)"),S:Math.max(1,v("gES")),W:Math.max(1,v("gES")),ok:true,info:i18("lines extended {0} m at each end for full fold (half the streamer)",(Ls/2).toFixed(0))})}
if(on("gMB"))rows.push({k:"mbes",n:i18("Multibeam"),S:mb.S,W:mb.W,ok:true,info:i18("{0} m swath at {1} m design depth, {2} % overlap",mb.W.toFixed(1),mb.d,g("ov"))});
if(towed)runIn+=Math.max(0,v("gLB"));const ex=Math.max(0,v("gEX"));runIn+=ex;runOut+=ex;
const ok=rows.filter(r=>r.ok&&r.S>0);let drv=null;ok.forEach(r=>{if(!drv||r.S<drv.S)drv=r});
return{rows,drv,S:drv?drv.S:mb.S,W:drv?(drv.k=="mbes"?mb.W:drv.k=="sss"?drv.W:drv.S/(1-g("ov")/100)):mb.W,runIn,runOut}}
// spacing from the sensors, the multibeam values kept for the swath block
const _geoParams=params;params=function(){const p=_geoParams(),G=geoCalc(p);p.mbS=p.S;p.mbW=p.W;p.S=G.S;p.W=G.W;p.geo=G;return p};
function geoShow(){const p=params(),G=p.geo,f=v=>isFinite(v)?v.toFixed(1)+" m":"–";
let h='<table style="width:100%;border-collapse:collapse;margin:6px 0;font-size:12px"><tr><th style="text-align:left">'+i18("Sensor")+'</th><th style="text-align:right">'+i18("Line spacing")+"</th></tr>";
G.rows.forEach(r=>{const d=G.drv===r;h+='<tr style="'+(d?"font-weight:700;":"")+'border-top:1px solid #dde5e4"><td>'+r.n+(d?" ◀":"")+'</td><td style="text-align:right">'+f(r.S)+'</td></tr><tr><td colspan=2 style="color:'+(r.ok?"#5b6e75":"#b0237a")+';padding-bottom:4px">'+r.info+"</td></tr>"});
h+="</table>";h+=G.drv?"<b>"+i18("Line spacing used: {0}, set by {1}.",f(G.S),G.drv.n)+"</b>":"<b>"+i18("No sensor ticked: the multibeam spacing is used.")+"</b>";
if(G.runIn||G.runOut)h+="<br>"+i18("Line run-in {0} m, run-out {1} m (layback, seismic fold and extra extension).",G.runIn.toFixed(0),G.runOut.toFixed(0));
$("gRes").innerHTML=h;["gSS","gMG","gSB","gSE"].forEach(id=>{$(id+"b").hidden=!$(id).checked})}
// lines: run-in and run-out, turns redone, tie lines by spacing
const _geoGen=gen;gen=function(){_geoGen();if(!R.lines.length){geoShow();return}const p=params(),G=p.geo,Rr=p.Rr;let ch=false;
if(G.runIn>0||G.runOut>0){R.lines.forEach(l=>{const d=[l.b[0]-l.a[0],l.b[1]-l.a[1]],m=Math.hypot(d[0],d[1])||1,u=[d[0]/m,d[1]/m];l.a=[l.a[0]-u[0]*G.runIn,l.a[1]-u[1]*G.runIn];l.b=[l.b[0]+u[0]*G.runOut,l.b[1]+u[1]*G.runOut]});
const old=R.turns;R.turns=[];R.tl=0;for(let i=0;i+1<R.lines.length;i++){const A=R.lines[i],B=R.lines[i+1],d=[A.b[0]-A.a[0],A.b[1]-A.a[1]],m=Math.hypot(d[0],d[1])||1,f=[d[0]/m,d[1]/m],w=[B.a[0]-A.b[0],B.a[1]-A.b[1]];
let nn=[f[1],-f[0]];if(nn[0]*w[0]+nn[1]*w[1]<0)nn=[-nn[0],-nn[1]];const S=Math.abs(nn[0]*w[0]+nn[1]*w[1]),ty=old[i]?old[i].ty:"u";let pts=[A.b];
if(ty!="t")pts=pts.concat(turnPts(A.b,f,nn,S,Rr).pts);pts.push(B.a);let len=0;for(let j=1;j<pts.length;j++)len+=Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);R.turns.push({pts,len,ty});R.tl+=len}ch=true}
const T=g("gTI");if(T>0&&$("cross").checked&&closed){const az=g("az"),u=[Math.sin(az*D),Math.cos(az*D)],n=[Math.cos(az*D),-Math.sin(az*D)],tv=poly.map(q=>q[0]*u[0]+q[1]*u[1]),t0=Math.min(...tv),t1=Math.max(...tv),k=Math.max(1,Math.min(500,Math.floor((t1-t0)/T))),st=t0+((t1-t0)-(k-1)*T)/2;
R.cross=[];for(let j=0;j<k;j++){const t=st+j*T;if(t<=t0||t>=t1)continue;chords(poly,u,n,t).flatMap(c=>wr(t,c,u,n)).forEach(c=>R.cross.push({name:$("crossPre").value+(R.cross.length+1),a:[u[0]*t+n[0]*c[0],u[1]*t+n[1]*c[0]],b:[u[0]*t+n[0]*c[1],u[1]*t+n[1]*c[1]]}))}ch=true}
if(ch)stats();geoShow()};
// the multibeam block keeps showing multibeam values
const _geoStats=stats;stats=function(){_geoStats();const p=params();$("W").textContent=f1(p.mbW);$("S").textContent=f1(p.mbS)};
// plan checks for the sensors
const _geoSum=summary;summary=function(){_geoSum();if(!R.lines.length)return;const G=params().geo,spd=g("spd"),C=[],add=(k,m)=>C.push('<li class="'+k+'">'+m+"</li>");
G.rows.forEach(r=>{if(r.k=="sss"){if(r.C<200)add("bad",i18("Side-scan at {0} % coverage leaves the nadir gap under each line (about {1} m wide) seen only once or not at all. Use 200 % to see every point twice.",r.C,r.gap.toFixed(0)));else add("ok",i18("Side-scan 200 % coverage: the nadir gap under each line is covered by the neighbouring lines."));
spd>r.vmax?add("bad",i18("Survey speed {0} kn is above the side-scan limit of {1} kn for the chosen target and pings.",spd,r.vmax.toFixed(1))):add("ok",i18("Survey speed {0} kn is within the side-scan limit of {1} kn.",spd,r.vmax.toFixed(1)))}
if(r.k=="mag")r.ok?add("inf",i18("Magnetometer: the farthest point between lines is {0} m from the sensor (limit {1} m).",Math.hypot(r.S/2,g("gMA")).toFixed(1),g("gMD"))):add("bad",i18("Magnetometer: the detection distance is not larger than the sensor height, so targets cannot be found between lines."))});
if(G.drv)add("inf",i18("Line spacing used: {0}, set by {1}.",G.S.toFixed(1)+" m",G.drv.n));$("chk").insertAdjacentHTML("afterbegin",C.join(""))};
// map sheet rows describe the spread
window.SWP_SENSORROW=()=>{const G=params().geo;return[i18("Sensors"),G.rows.length?G.rows.map(r=>r.n).join(", "):i18("Multibeam")]};
window.SWP_SWATHROW=()=>{const G=params().geo;return[i18("Spacing set by"),G.drv?G.drv.n:i18("Multibeam")]};
["gSS","gSR","gSC","gSO","gSA","gSL","gSP","gMG","gMA","gMD","gMF","gSB","gBS","gSE","gES","gEL","gMB","gLB","gEX","gTI"].forEach(id=>{const e=$(id);["input","change"].forEach(ev=>e.addEventListener(ev,()=>{gen();saveSoon()}))});
const _geoSetLang=setLang;setLang=function(){const r=_geoSetLang.apply(this,arguments);try{geoShow()}catch(e){}return r};
gen();
