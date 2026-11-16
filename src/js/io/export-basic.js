function save(name,txt,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type}));a.download=name;a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},6000)}
const needs=()=>{if(!R.lines.length){alert(i18(window.SWP_NEED||"Draw and close an area first."));return false}if($("crs").value=="epsg"&&!(window.proj4&&crsDef)){alert(i18("Load an EPSG CRS first (section {§crs})."));return false}return true};
// corridor segments (closed polygons with names) when a long route is split
const segPolys=()=>(window.SWP_SEGS||[]);
const paths=()=>{const a=[];R.lines.forEach((l,i)=>{a.push({n:l.name,p:LP(l),k:"line",seg:l.seg});if($("inclT").checked&&R.turns[i])a.push({n:"T"+(i+1),p:R.turns[i].pts,k:"turn",seg:l.seg})});R.cross.forEach(l=>a.push({n:l.name,p:LP(l),k:"cross"}));return a};
$("eGj").onclick=()=>{if(!needs())return;const m=p=>{const q=toLL(p);return[+q[1].toFixed(7),+q[0].toFixed(7)]};save("survey_plan.geojson",JSON.stringify({type:"FeatureCollection",features:[{type:"Feature",properties:{name:"boundary"},geometry:{type:"Polygon",coordinates:[poly.concat([poly[0]]).map(m)]}}].concat(segPolys().map(sg=>({type:"Feature",properties:{name:sg.name,kind:"segment",kp_from:+sg.kp0.toFixed(3),kp_to:+sg.kp1.toFixed(3)},geometry:{type:"Polygon",coordinates:[sg.pts.concat([sg.pts[0]]).map(m)]}})),paths().map(x=>({type:"Feature",properties:{name:x.n,kind:x.k},geometry:{type:"LineString",coordinates:x.p.map(m)}})))},null,1),"application/geo+json")};
// a split corridor: each segment's lines on their own layers (line_S01, turn_S01, cross_S01; a cross line goes to the first segment holding its middle)
const dxfIn=(p,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>p[1])!=(P[j][1]>p[1])&&p[0]<(P[j][0]-P[i][0])*(p[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c};
function dxfLayer(SG){if(SG.length<2)return x=>x.k;return x=>{let n=x.seg;if(!n){const k=x.p.length,q=k%2?x.p[(k-1)/2]:[(x.p[k/2-1][0]+x.p[k/2][0])/2,(x.p[k/2-1][1]+x.p[k/2][1])/2],h=SG.find(sg=>dxfIn(q,sg.pts));n=h?h.n:0}return n?x.k+"_S"+String(n).padStart(2,"0"):x.k}}
// and a named view per segment (VIEW table entries), to jump to it in CAD
function dxfViews(SG){if(SG.length<2)return[];return SG.map(sg=>{const c=sg.pts.map(oc),xs=c.map(q=>q[0]),ys=c.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
return`0\nVIEW\n2\nSEG${String(sg.n).padStart(2,"0")}\n70\n0\n40\n${(y1-y0)*1.1}\n10\n${(x0+x1)/2}\n20\n${(y0+y1)/2}\n41\n${(x1-x0)*1.1}\n11\n0\n21\n0\n31\n1\n12\n0\n22\n0\n32\n0\n42\n50\n43\n0\n44\n0\n50\n0\n71\n0\n`})}
// layer colours (AutoCAD colour index), each kind clearly different
// survey lines cyan, cross lines orange, turns red, segment borders violet, boundary white (black on a white background)
const DXF_ACI={boundary:7,segments:190,line:4,cross:30,turn:1};
const dxfTable=(name,rows)=>`0\nTABLE\n2\n${name}\n70\n${rows.length}\n${rows.join("")}0\nENDTAB\n`;
$("eDxf").onclick=()=>{if(!needs())return;const SG=segPolys(),lay=dxfLayer(SG),E=[];
// a closed polyline (R12 POLYLINE with VERTEX entries) for the boundary and each segment border, so each is one object in CAD
const ring=(P,ly)=>{const Q=P.length>2&&P[0][0]==P[P.length-1][0]&&P[0][1]==P[P.length-1][1]?P.slice(0,-1):P;
E.push(`0\nPOLYLINE\n8\n${ly}\n66\n1\n10\n0\n20\n0\n30\n0\n70\n1\n`+Q.map(q=>{const a=oc(q);return`0\nVERTEX\n8\n${ly}\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n`}).join("")+`0\nSEQEND\n8\n${ly}\n`)};
if(closed&&poly.length>=3)ring(poly,"boundary");
SG.forEach(sg=>{ring(sg.pts,"segments");let cx0=0,cy0=0;sg.pts.forEach(p=>{cx0+=p[0]/sg.pts.length;cy0+=p[1]/sg.pts.length});const c=oc([cx0,cy0]);
E.push(`0\nTEXT\n8\nsegments\n10\n${c[0]}\n20\n${c[1]}\n30\n0\n40\n${Math.max(5,g("coHW")/4)}\n1\n${sg.name} KP ${sg.kp0.toFixed(3)}-${sg.kp1.toFixed(3)}\n`)});
// a straight survey or cross line stays one LINE; every turn or transit, and every bent (corridor) line, is one open polyline
paths().forEach(x=>{const ly=lay(x);if(x.p.length<2)return;if(x.p.length==2&&x.k!="turn"){const a=oc(x.p[0]),b=oc(x.p[1]);E.push(`0\nLINE\n8\n${ly}\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n11\n${b[0]}\n21\n${b[1]}\n31\n0\n`);return}
E.push(`0\nPOLYLINE\n8\n${ly}\n66\n1\n10\n0\n20\n0\n30\n0\n70\n0\n`+x.p.map(q=>{const a=oc(q);return`0\nVERTEX\n8\n${ly}\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n`}).join("")+`0\nSEQEND\n8\n${ly}\n`)});
// tables: line type, every layer used with its colour, the segment views
const L=[...new Set(E.map(e=>e.match(/\n8\n([^\n]+)\n/)[1]))],V=dxfViews(SG);
let h="0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n"+dxfTable("LTYPE",["0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n"])
+dxfTable("LAYER",L.map(n=>`0\nLAYER\n2\n${n}\n70\n0\n62\n${DXF_ACI[n.replace(/_S\d+$/,"")]||7}\n6\nCONTINUOUS\n`));if(V.length)h+=dxfTable("VIEW",V);h+="0\nENDSEC\n";
save("survey_plan.dxf",h+"0\nSECTION\n2\nENTITIES\n"+E.join("")+"0\nENDSEC\n0\nEOF\n","application/dxf")};
$("eLnx").onclick=()=>{if(!needs())return;let s='<?xml version="1.0"?>\n<LINEPLAN>\n<MAGVAR>0.0</MAGVAR>\n';R.lines.concat(R.cross).forEach(l=>{s+=`<LINE><NAME>${l.name}</NAME><PTS>${LP(l).map(q=>{const c=oc(q);return`<PT X="${c[0]}" Y="${c[1]}"/>`}).join("")}</PTS></LINE>\n`});save("survey_plan.lnx",s+"</LINEPLAN>\n","text/xml")};
function wpts(){const w=[];R.lines.forEach((l,i)=>{w.push(...LP(l));if($("inclT").checked&&R.turns[i])R.turns[i].pts.slice(1,-1).filter((_,j)=>j%3==0).forEach(p=>w.push(p))});return w.map(toLL)}
$("eQgc").onclick=()=>{if(!needs())return;const w=wpts();save("survey_mission.plan",JSON.stringify({fileType:"Plan",version:1,groundStation:"QGroundControl",geoFence:{circles:[],polygons:[],version:2},rallyPoints:{points:[],version:2},mission:{version:2,firmwareType:12,vehicleType:10,cruiseSpeed:g("spd")*.5144,hoverSpeed:2,plannedHomePosition:[w[0][0],w[0][1],0],items:(()=>{const U=window.SWP_UAV,h=U?U.h:0,it=w.map((p,i)=>({type:"SimpleItem",command:16,doJumpId:0,frame:3,autoContinue:true,params:[0,g("acc"),0,null,p[0],p[1],h]}));
// a drone flight: camera trigger distance on, then off at the end
if(U){it.splice(1,0,{type:"SimpleItem",command:206,doJumpId:0,frame:2,autoContinue:true,params:[+U.trig.toFixed(2),0,1,0,0,0,0]});it.push({type:"SimpleItem",command:206,doJumpId:0,frame:2,autoContinue:true,params:[0,0,1,0,0,0,0]})}it.forEach((x,i)=>x.doJumpId=i+1);return it})()}},null,1),"application/json")};
$("eMp").onclick=()=>{if(!needs())return;const w=wpts();let s="QGC WPL 110\n0\t1\t0\t16\t0\t0\t0\t0\t"+w[0][0]+"\t"+w[0][1]+"\t0\t1\n";const U=window.SWP_UAV,h=U?U.h:0;let n=1;w.forEach((p,i)=>{s+=`${n++}\t0\t3\t16\t0\t${g("acc")}\t0\t0\t${p[0].toFixed(7)}\t${p[1].toFixed(7)}\t${h}\t1\n`;if(U&&i==0)s+=`${n++}\t0\t2\t206\t${U.trig.toFixed(2)}\t0\t1\t0\t0\t0\t0\t1\n`});if(U)s+=`${n++}\t0\t2\t206\t0\t0\t1\t0\t0\t0\t0\t1\n`;save("survey_mission.waypoints",s,"text/plain")};

