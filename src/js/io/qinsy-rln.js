const QWKT="COMPD_CS[\"WGS 84 / UTM zone @Z@@H@ + EGM96 height\",PROJCS[\"WGS 84 / UTM zone @Z@@H@\",GEOGCS[\"WGS 84\",DATUM[\"World Geodetic System 1984\",SPHEROID[\"WGS 84\",6378137,298.257223563,UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]],AUTHORITY[\"EPSG\",\"7030\"]],AUTHORITY[\"EPSG\",\"6326\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9102\"]],AUTHORITY[\"EPSG\",\"4326\"]],PROJECTION_NAME[\"UTM zone @Z@@H@\",AUTHORITY[\"EPSG\",\"@EP@\"]],PROJECTION[\"Transverse Mercator\",AUTHORITY[\"EPSG\",\"9807\"]],PARAMETER[\"latitude_of_origin\",0,UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9102\"]]],PARAMETER[\"central_meridian\",@CM@,UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9102\"]]],PARAMETER[\"false_easting\",500000,UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]]],PARAMETER[\"false_northing\",@FN@,UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]]],PARAMETER[\"scale_factor\",0.9996,UNIT[\"unity\",1,AUTHORITY[\"EPSG\",\"9201\"]]],UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]],AUTHORITY[\"EPSG\",\"@EC@\"]],VERT_CS[\"EGM96 height\",VERT_DATUM[\"EGM96 geoid\",2005,AUTHORITY[\"EPSG\",\"5171\"]],AXIS[\"height\",UP],UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]],AUTHORITY[\"EPSG\",\"5773\"]]],TRANSFORM[\"WGS 84 to EGM96 height (EGM96)\",PARAM_MT[\"Geoid_Height_Model\",PARAMETER[\"geoid_model_name\",\"Mean Sea Level - EGM96 (Earth)\"],PARAMETER[\"geoid_model_file\",\"EGM96.BIN\"],PARAMETER[\"model_datum_name\",\"WGS 84\"],PARAMETER[\"file_format\",\"LLDLLD\"],PARAMETER[\"file_type\",\"binary\"],PARAMETER[\"file_unit\",UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9102\"]]],PARAMETER[\"interpolation_method\",\"spline\"],PARAMETER[\"transformation_accuracy\",0.2,UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]]],PARAMETER[\"qps_id\",\"4\"],UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]],AUTHORITY[\"EPSG\",\"9661\"]],GEOGCS[\"WGS 84\",DATUM[\"World Geodetic System 1984\",SPHEROID[\"WGS 84\",6378137,298.257223563,UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]],AUTHORITY[\"EPSG\",\"7030\"]],AUTHORITY[\"EPSG\",\"6326\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9102\"]],AUTHORITY[\"EPSG\",\"4326\"]],VERT_CS[\"EGM96 height\",VERT_DATUM[\"EGM96 geoid\",2005,AUTHORITY[\"EPSG\",\"5171\"]],AXIS[\"height\",UP],UNIT[\"meter\",1,AUTHORITY[\"EPSG\",\"9001\"]],AUTHORITY[\"EPSG\",\"5773\"]],AUTHORITY[\"EPSG\",\"10084\"]]";
const QTE=new TextEncoder();
function qCat(a){let n=0;a.forEach(x=>n+=x.length);const r=new Uint8Array(n);let o=0;a.forEach(x=>{r.set(x,o);o+=x.length});return r}
function qTag(t){return QTE.encode(t.split("").reverse().join(""))}
function qU(v,n){const b=new Uint8Array(n);const dv=new DataView(b.buffer);n==2?dv.setUint16(0,v,true):dv.setUint32(0,v,true);return b}
function qF(a){const b=new Uint8Array(a.length*8),dv=new DataView(b.buffer);a.forEach((v,i)=>dv.setFloat64(i*8,v,true));return b}
function qLeaf(t,body){return qCat([qTag(t),qU(0,2),qU(body.length,4),body])}
function qGrp(t,kids){const b=qCat(kids);return qCat([qTag(t),qU(1,2),qU(b.length,4),b])}
function qFix(t,body){return qCat([qTag(t),body])}
function qStr(s){return QTE.encode(s)}
function qCstm(kv){const p=[qU(kv.length,4)];kv.forEach(e=>{const k=qStr(e[0]),v=qStr(e[1]);p.push(qU(k.length,4),k,qU(v.length,4),v)});return qCat(p)}
function qWkt(zone,north){return QWKT.replace(/@Z@/g,zone).replace(/@H@/g,north?"N":"S").replace(/@EP@/g,(north?16000:16100)+zone).replace(/@EC@/g,(north?32600:32700)+zone).replace(/@CM@/g,zone*6-183).replace(/@FN@/g,north?0:10000000)}
/* lines: [{name,pts:[[E,N],[E,N]], id?,refid?,extra?,vx?}]; opts: zone,north,layer,layer2,ids */
function qgfBuild(lines,op){
 const RED=Uint8Array.of(255,0,0,255),RED2=Uint8Array.of(255,0,0,128),GRN=Uint8Array.of(0,128,0,255);
 let nid=op.firstId||93;
 const L=lines.map(l=>{const nm=qStr(l.name),id=l.id!=null?l.id:nid++;
  const xyz=[];l.pts.forEach(p=>xyz.push(p[0],p[1],0));
  let len=0;for(let i=1;i<l.pts.length;i++)len+=Math.hypot(l.pts[i][0]-l.pts[i-1][0],l.pts[i][1]-l.pts[i-1][1]);
  const vx=l.vx||[0,len];
  const k=[qFix("Colr",GRN),qFix("Idnr",qU(id,4)),qLeaf("name",nm),qLeaf("text",nm),qLeaf("lcol",GRN)];
  if(l.refid!=null)k.push(qLeaf("cstm",qCstm([["refid",String(l.refid)]])));
  k.push(qLeaf("gl3d",qF(xyz)),qLeaf("glat",qStr("pmxv")),qLeaf("glvd",qF(vx)));
  if(l.extra)k.push(qLeaf("glat",qStr("1agq")),qLeaf("glvd",qF([0,0])),qLeaf("glat",qStr("2agq")),qLeaf("glvd",qF([0,0])));
  return qGrp("line",k)});
 const lay=qStr(op.layer),lay2=qStr(op.layer2),ids=op.ids||{layer:1,top:2,tail:nid};
 const g1=qGrp("grup",[qLeaf("layr",lay),qLeaf("lwid",qF([0.001])),qFix("Idnr",qU(ids.layer,4)),qLeaf("styl",qU(0,4)),qLeaf("name",lay),qLeaf("text",new Uint8Array(0)),qLeaf("lcol",RED),qLeaf("fcol",RED2),qLeaf("lbpl",qU(1,4)),qLeaf("lbhd",qU(0,4))].concat(L));
 const g2=qGrp("grup",[qLeaf("layr",lay2),qFix("Idnr",qU(ids.tail,4)),qLeaf("name",lay2),qLeaf("lcol",RED),qLeaf("fcol",RED2)]);
 const top=qGrp("grup",[qLeaf("wktp",qStr(qWkt(op.zone,op.north))),qFix("Idnr",qU(ids.top,4)),qLeaf("cstm",qCstm([["FileType","Lineplanning"]])),g1,g2]);
 return qCat([Uint8Array.of(0x81,0x51,0x47,0x46,13,10,26,10),top])}
function rlnText(P,fm){let t="";P.forEach(x=>{t+='"'+String(x.n).replace(/"/g,"'")+'"\r\n';let k=0;x.p.forEach((p,i)=>{if(i)k+=Math.hypot(p[0]-x.p[i-1][0],p[1]-x.p[i-1][1]);t+=fm(p).join(",")+","+(k/1000).toFixed(8)+"\r\n"})});return t}
$("eEiva").onclick=()=>{if(!needs())return;const geo=$("crs").value!="utm"&&$("crs").value!="epsg";save("survey_runlines.rln",rlnText(paths(),p=>oc(p).map(v=>v.toFixed(geo?8:3))),"text/plain")};
$("eQin").onclick=()=>{if(!R.lines.length){alert(i18(window.SWP_NEED||"Draw and close an area first."));return}
 const zone=Math.floor((o.lon+180)/6)+1,north=o.lat>=0;
 const L=paths().filter(x=>x.k!="turn").map(x=>({name:x.n,pts:x.p.map(q=>{const t=toLL(q);return utm(t[0],t[1],zone)})}));
 save("survey_lines.qgfline",qgfBuild(L,{zone,north,layer:"SWATHPLAN",layer2:"SURVEYLINES"}),"application/octet-stream")};

