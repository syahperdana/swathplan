/* ===== corridor mode of the survey planner: route, lines, KP, exports (active when MODE().corr) ===== */
let RT=[];const CO={P:null,C:null,L:0,off:[],segs:[]};// RT: route points [lat, lon] from the first to the last KP
const coRoute=()=>CG.clean(RT.map(q=>fromLL(q[0],q[1])));
// adaptive offsets for one stretch of the route (chainage a to b): the adaptive core in the corridor frame (q = offset to
// starboard, t = chainage), so each segment gets the spacing its own depths allow. With a centre line it grows outwards from it.
function coAdaptOffs(P,C,a,b,hw,centre){const L=Math.max(1,b-a),stp=Math.max(5,L/150),T=[];for(let t=a;t<b;t+=stp)T.push(t);T.push(b);
const F=T.map(t=>CG.at(P,C,t)),fi=t=>F[Math.max(0,Math.min(F.length-1,Math.round((t-a)/stp)))],raw=(q,t)=>{const f=fi(t);return depthRaw(f.p[0]+f.u[1]*q,f.p[1]-f.u[0]*q)},prof=()=>T,S=params().S,cap=adpCap();
let out,sh,A;if(!centre){const r=adaptCore({s0:-hw,s1:hw,S,prof,raw,stp,cap});out=r.out;sh=r.sh;A=r.A}
else{const rp=adaptCore({s0:0,s1:hw,S,prof,raw,stp,cap,first:0}),rn=adaptCore({s0:0,s1:hw,S,prof,raw:(q,t)=>raw(-q,t),stp,cap,first:0,swap:true});
out=rn.out.slice(1).map(v=>-v).reverse().concat(rp.out);sh=rp.sh.concat(rn.sh.map(z=>[-z[1],-z[0],z[2],z[3]]));A=rp.A+rn.A}
const polys=sh.map(z=>{const e=[],w=[];for(let t=z[2];t<z[3]+stp/2;t+=stp){const f=CG.at(P,C,Math.min(t,z[3]));e.push([f.p[0]+f.u[1]*z[0],f.p[1]-f.u[0]*z[0]]);w.push([f.p[0]+f.u[1]*z[1],f.p[1]-f.u[0]*z[1]])}return e.concat(w.reverse())});
return{off:[...new Set(out.map(v=>Math.round(v*100)/100))].sort((x,y)=>x-y),polys,A}}
function coOffsets(){const p=params();return $("coMode").value=="fixed"?CG.parseOffsets($("coOff").value):CG.swathOffsets(Math.max(1,g("coHW")),p.W,p.S,$("coCtr").checked)}
const _coArea=gen;gen=function(){if(!MODE().corr){CO.P=null;CO.L=0;CO.segs=[];return _coArea()}R={lines:[],turns:[],cross:[],tl:0,ol:0};CO.P=null;CO.L=0;CO.segs=[];
if(draw&&!closed){coStatus();return stats()}// a new route is being drawn: only its points are shown
const P=coRoute();if(P.length<2){poly=[];closed=false;draw=true;coStatus();return stats()}
const hw=Math.max(1,g("coHW"));poly=CG.outline(P,hw);closed=poly.length>=3;draw=false;
if(!depthOK()){const C0=CG.chain(P);CO.P=P;CO.C=C0;CO.L=C0[C0.length-1];CO.off=[];coStatus();return stats()}// no design depth: the corridor outline, no lines (the plan checks say why)
const{Rr}=params(),ext=Math.max(0,g("coExt")),offs=coOffsets(),pre=$("coPre").value;
const C=CG.chain(P),Lr=C[C.length-1];CO.P=P;CO.C=C;CO.L=Lr;CO.off=offs;
// lines across the corridor from port to starboard, alternating direction so each turn is short
// long routes in segments (KP ranges overlapping by coSegO); each segment has its own lines and outline
const SG=CG.segments(Lr,Math.max(0,g("coSeg"))*1000,Math.max(0,g("coSegO"))),multi=SG.length>1,ad=adpOn();ADP_SHORT=ad?{A:0,polys:[]}:null;CO.segOff=[];let sp=[];
SG.forEach((sg,si)=>{const Ps=multi?CG.subpath(P,C,sg.a,sg.b):P,tag=multi?pre+String(si+1).padStart(2,"0")+"_":pre;
if(multi)CO.segs.push({n:si+1,a:sg.a,b:sg.b,poly:CG.outline(Ps,hw)});
let so=offs;if(ad){const r=coAdaptOffs(P,C,sg.a,sg.b,hw,$("coCtr").checked);so=r.off;ADP_SHORT.A+=r.A;ADP_SHORT.polys.push(...r.polys)}CO.segOff.push(so);sp=sp.concat(so.slice(1).map((v,i)=>v-so[i]));
so.forEach((d,i)=>{let q=CG.extend(CG.offset(Ps,d),ext);if(i%2)q=q.slice().reverse();if(q.length>1)R.lines.push({name:CG.offName(tag,d),a:q[0],b:q[q.length-1],p:q,off:d,seg:si+1})})});
R.sp=sp;if(ad)CO.off=CO.segOff[0]||[];coTurns(Rr);
const XI=g("coXI"),k0=g("coKP0")*1000;
if(XI>0){const xe=hw+Math.max(0,g("coXE"));for(let k=Math.ceil(k0/XI-1e-9)*XI;k<=k0+Lr+1e-6&&R.cross.length<2000;k+=XI){const a=CG.at(P,C,k-k0),nv=[a.u[1],-a.u[0]];
R.cross.push({name:$("coXP").value+(k/1000).toFixed(3),a:[a.p[0]-nv[0]*xe,a.p[1]-nv[1]*xe],b:[a.p[0]+nv[0]*xe,a.p[1]+nv[1]*xe],kp:k/1000})}}
coStatus();stats()};
// turns between consecutive corridor lines, from the direction at the end of each line
function coTurns(Rr){R.turns=[];R.tl=0;for(let i=0;i+1<R.lines.length;i++){if(R.lines[i].seg!==R.lines[i+1].seg){const A=R.lines[i],B=R.lines[i+1],len=Math.hypot(B.a[0]-A.b[0],B.a[1]-A.b[1]);R.turns.push({pts:[A.b,B.a],len,ty:"t"});R.tl+=len;continue}/* to the next segment: a transit */const A=R.lines[i],B=R.lines[i+1],q=A.p,n=q.length,u=[q[n-1][0]-q[n-2][0],q[n-1][1]-q[n-2][1]],m=Math.hypot(u[0],u[1])||1,f=[u[0]/m,u[1]/m],
w=[B.a[0]-A.b[0],B.a[1]-A.b[1]];let nn=[f[1],-f[0]];if(nn[0]*w[0]+nn[1]*w[1]<0)nn=[-nn[0],-nn[1]];const S=Math.abs(B.off-A.off);
let pts=[A.b].concat(turnPts(A.b,f,nn,S,Rr).pts);pts.push(B.a);let len=0;for(let j=1;j<pts.length;j++)len+=Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);
R.turns.push({pts,len,ty:S<2*Rr?"w":"u"});R.tl+=len}
}
function coStatus(){const k0=g("coKP0");$("coOffB").hidden=$("coMode").value!="fixed";$("coCtrL").hidden=$("coMode").value=="fixed";
$("coLn").textContent=CO.P&&adpOn()&&CO.segOff&&CO.segOff.length?i18("{0} lines (adaptive, by segment)",CO.segOff.map(o=>o.length).join(" / ")):CO.off.length&&CO.P?CO.off.length+" · "+CO.off.map(v=>(v>0?"+":"")+(v%1?v.toFixed(1):v.toFixed(0))).join(", ")+" m":"-";
$("coSt").textContent=draw&&!closed&&poly.length?i18("Drawing the route: {0} points. Press Finish route when done.",poly.length):CO.P?i18("Route {0} km, KP {1} to {2}. {3} survey lines, {4} cross lines.",(CO.L/1000).toFixed(3),k0.toFixed(3),(k0+CO.L/1000).toFixed(3),R.lines.length,R.cross.length)+(CO.segs.length?" "+i18("{0} segments of up to {1} km, overlapping {2} m.",CO.segs.length,g("coSeg"),g("coSegO")):""):i18("No route yet. Draw it on the map or import it.")}

// ---- drawing the route on the map ----
function coFinish(){if(!(draw&&!closed)||poly.length<2)return;const c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]),ll=toLL(c);
RT=poly.map(p=>toLL(p));reorigin(ll[0],ll[1]);V.cx-=c[0];V.cy-=c[1];closed=true;draw=false;gen();analyse();gen();saveSoon()}
const _coClose=close;close=function(){return MODE().corr?coFinish():_coClose()};$("bClose").onclick=()=>close();
const _coClear=clear;clear=function(){if(!MODE().corr)return _coClear();RT=[];poly=[];closed=false;draw=true;gen();saveSoon()};$("bClr").onclick=()=>clear();
const _coPre=$("pre2").onchange;$("pre2").onchange=e=>{if(!MODE().corr)return _coPre(e);const q=PRE[e.target.value];if(!q)return;o={lat:q[0],lon:q[1]};projC();const w=q[2]/2;RT=[[-w,0],[w,0]].map(p=>toLL(p));closed=true;draw=false;gen();fit();analyse();gen()};
$("coRev").onclick=()=>{if(RT.length<2)return;RT.reverse();gen();saveSoon()};
["coKP0","coHW","coMode","coCtr","coOff","coExt","coXI","coXE","coPre","coXP","coSeg","coSegO"].forEach(id=>{const e=$(id);["input","change"].forEach(ev=>e.addEventListener(ev,()=>{gen();saveSoon()}))});

// switching from an area: a route along the middle of the area, unless one is kept from before
function coFromArea(){if(RT.length<2&&closed&&poly.length>=3){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),y=(arrMin(ys)+arrMax(ys))/2;RT=[[arrMin(xs),y],[arrMax(xs),y]].map(p=>toLL(p))}
if(RT.length>=2){closed=true;draw=false}}

// ---- route import (same readers as the boundary import, lines of 2+ points) ----
$("coImp").onclick=async()=>{const st=$("coImpSt"),files=[...$("coF").files],txt=$("coT").value.trim();
if(!files.length&&!txt){st.textContent=i18("Choose a file or paste the route points first.");return}
try{st.textContent=i18("Reading…");const r=await readBoundary(files,files.length?"":txt,2);
const pl=x=>{let s=0;for(let i=1;i<x.length;i++)s+=Math.hypot(x[i][0]-x[i-1][0],x[i][1]-x[i-1][1]);return s};let best=r.R[0];r.R.forEach(x=>{if(pl(x)>pl(best))best=x});
const ll=await importLL(r,best);RT=ll.map(p=>[p[1],p[0]]);
const c=RT.reduce((a,q)=>[a[0]+q[0]/RT.length,a[1]+q[1]/RT.length],[0,0]);o={lat:c[0],lon:c[1]};projC();closed=true;draw=false;gen();fit();analyse();gen();saveSoon();
st.textContent=i18("Route imported: {0} points, {1} km. {2}.",RT.length,(CO.L/1000).toFixed(3),r.note)}catch(e){st.textContent=i18("Import failed: {0}",e.message)}};

// ---- route exports: KP table and route RLN with route KP ----
const coKPs=()=>{const I=Math.max(1,g("coKI")),k0=g("coKP0")*1000,k1=k0+CO.L,ks=[k0];for(let k=Math.ceil(k0/I+1e-9)*I;k<k1-1e-6;k+=I)ks.push(k);ks.push(k1);return ks};
const coFmt=()=>{const geo=$("crs").value!="utm"&&$("crs").value!="epsg";return p=>oc(p).map(v=>v.toFixed(geo?8:3))};
$("coKPx").onclick=()=>{if(!CO.P||!needs())return;const k0=g("coKP0")*1000,f=coFmt(),geo=$("crs").value=="geo";
let t="KP,"+(geo?"Longitude_out,Latitude_out":"Easting,Northing")+",Latitude,Longitude,Bearing_deg\n";
coKPs().forEach(k=>{const a=CG.at(CO.P,CO.C,k-k0),ll=toLL(a.p),br=(Math.atan2(a.u[0],a.u[1])/D+360)%360;t+=[(k/1000).toFixed(3)].concat(f(a.p),[ll[0].toFixed(8),ll[1].toFixed(8),br.toFixed(2)]).join(",")+"\n"});
save("route_kp_table.csv",t,"text/csv")};
$("coRln").onclick=()=>{if(!CO.P||!needs())return;const k0=g("coKP0")*1000,f=coFmt();let t='"'+String($("coPre").value+"ROUTE").replace(/"/g,"'")+'"\r\n';
CO.P.forEach((p,i)=>{t+=f(p).join(",")+","+((k0+CO.C[i])/1000).toFixed(8)+"\r\n"});save("route_kp.rln",t,"text/plain")};

// ---- route on the map: centreline and KP labels ----
// the corridor outline is computed, not edited: draw it without the corner markers of an area
const coOut=(fill)=>{if(!CO.P||poly.length<3)return;const r=DPR();cx.beginPath();poly.forEach((p,i)=>{const t=sc(p);i?cx.lineTo(t[0],t[1]):cx.moveTo(t[0],t[1])});cx.closePath();
if(fill){cx.fillStyle="#ffffff40";cx.fill()}else{cx.strokeStyle="#12262d";cx.lineWidth=1.5*r;cx.setLineDash([8*r,4*r]);cx.stroke();cx.setLineDash([])}};
const _coTiles=drawTiles;drawTiles=function(){_coTiles();if(CO.P&&!(draw&&!closed))coOut(true)};
const _coRender=render;render=function(){if(draw&&!closed)coStatus();const keep=poly,on=CO.P&&!(draw&&!closed);if(on)poly=[];try{_coRender()}finally{poly=keep}if(!on)return;const r=DPR();cx.save();coOut(false);
if(CO.segs.length){cx.lineWidth=1.4*r;cx.strokeStyle="#6a3d9a";cx.setLineDash([5*r,3*r]);CO.segs.forEach(sg=>{cx.beginPath();sg.poly.forEach((p,i)=>{const t=sc(p);i?cx.lineTo(t[0],t[1]):cx.moveTo(t[0],t[1])});cx.closePath();cx.stroke()});cx.setLineDash([]);
cx.font="bold "+10*r+"px "+FF;cx.textBaseline="middle";CO.segs.forEach(sg=>{const m=CG.at(CO.P,CO.C,(sg.a+sg.b)/2),t=sc(m.p),txt=i18("Segment {0}",sg.n),w=cx.measureText(txt).width+8*r;cx.fillStyle="#6a3d9ae6";cx.fillRect(t[0]-w/2,t[1]-8*r,w,16*r);cx.fillStyle="#fff";cx.fillText(txt,t[0]-w/2+4*r,t[1])})}
cx.strokeStyle="#12262d";cx.lineWidth=1.3*r;cx.setLineDash([12*r,4*r,2*r,4*r]);cx.beginPath();CO.P.forEach((p,i)=>{const s=sc(p);i?cx.lineTo(s[0],s[1]):cx.moveTo(s[0],s[1])});cx.stroke();cx.setLineDash([]);
cx.font=10*r+"px "+FF;cx.textBaseline="middle";let last=null;const lab=(p,t)=>{const s=sc(p);if(last&&Math.hypot(s[0]-last[0],s[1]-last[1])<70*r)return;last=s;
const w=cx.measureText(t).width+6*r,x=s[0]+4*r+w>cv.width-2*r?s[0]-4*r-w:s[0]+4*r;cx.fillStyle="#ffffffd9";cx.fillRect(x,s[1]-7*r,w,14*r);cx.fillStyle="#12262d";cx.fillText(t,x+3*r,s[1])};
const k0=g("coKP0");lab(CO.P[0],"KP "+k0.toFixed(3));R.cross.forEach(x=>lab(x.b,"KP "+x.kp.toFixed(3)));const ke=k0+CO.L/1000,lc=R.cross[R.cross.length-1];last=null;if(!lc||Math.abs(lc.kp-ke)>5e-4)lab(CO.P[CO.P.length-1],"KP "+ke.toFixed(3));cx.restore()};

// map sheet: KP range instead of a line azimuth
const coSegs=()=>CO.segs.length?CO.segs.map(sg=>({n:sg.n,name:i18("Segment {0}",sg.n),kp0:g("coKP0")+sg.a/1000,kp1:g("coKP0")+sg.b/1000,pts:sg.poly})):[];
const coAzRow=()=>[i18("KP range / speed"),CO.P?g("coKP0").toFixed(3)+" – "+(g("coKP0")+CO.L/1000).toFixed(3)+" / "+g("spd")+" kn":"–"];
// texts written here follow a language change
const _coSetLang=setLang;setLang=function(){const r=_coSetLang.apply(this,arguments);try{coStatus()}catch(e){}return r};
// ---- autosave and .SPL files carry the route ----
const _coSnap=snapshot;snapshot=function(){const s=_coSnap();s.route=RT.map(q=>[q[0],q[1]]);return s};
const _coApply=applyState;applyState=function(st){RT=Array.isArray(st&&st.route)?st.route.filter(q=>q&&isFinite(q[0])&&isFinite(q[1])).map(q=>[+q[0],+q[1]]):[];return _coApply(st)};
const _coSplT=splText;splText=function(){if(!MODE().corr)return _coSplT();const r=["[ROUTE]","# latitude longitude (KP runs from the first point)"].concat(RT.map(q=>q[0].toFixed(8)+" "+q[1].toFixed(8)),["",""]).join("\n");return _coSplT().replace("\n[SETTINGS]\n","\n"+r+"[SETTINGS]\n")};
const _coSplP=splParse;splParse=function(txt){const st=_coSplP(txt),m=String(txt).match(/\[ROUTE\]([\s\S]*?)(?:\n\[|$)/);
if(m)st.route=m[1].split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&l[0]!="#").map(l=>l.split(/[\s,;]+/).map(Number)).filter(a=>a.length>=2&&isFinite(a[0])&&isFinite(a[1]));return st};

// ---- start: the planner restored the session with the area generator; redo it as a corridor if that is the mode ----
(()=>{const st=loadState();if(st&&Array.isArray(st.route))RT=st.route.filter(q=>q&&isFinite(q[0])&&isFinite(q[1]));if(!MODE().corr)return;
if(st&&!st.closed&&Array.isArray(st.poly)&&st.poly.length){closed=false;draw=true;gen();return}// a route was being drawn: carry on
coFromArea();gen();if(!st)fit();analyse();gen()})();

// the export section offers one sheet per segment when the route is split
{const _g=gen;gen=function(){const r=_g.apply(this,arguments),w=$("xpSegW");if(w)w.hidden=!(MODE().corr&&CO.segs&&CO.segs.length>1);return r}}
