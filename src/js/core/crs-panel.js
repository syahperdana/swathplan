// ---- coordinate system panel
const FLD=["da","dif","dx","dy","dz","tl0","tp0","tk","tfe","tfn"];
function syncCRS(){const v=$("xcrs").value,set=(i,x)=>{$(i).value=x};$("epBox").hidden=v!="epsg";$("qfBox").hidden=v!="tm";const ed=v=="tm";FLD.concat("pjN").forEach(i=>$(i).readOnly=!ed);$("pjN").readOnly=true;$("zone").readOnly=!(v=="utmN"||v=="utmS");
if(v=="geo"||v=="utmN"||v=="utmS")ELL.wgs.forEach((x,i)=>set(FLD[i],x));
if(v=="geo"){["tl0","tp0","tk","tfe","tfn","zone"].forEach(i=>set(i,"–"));set("pjN","Geographic (lon/lat), WGS84")}
else if(v=="utmN"||v=="utmS"){const z=Math.max(1,Math.min(60,Math.round(+$("zone").value)||52));set("zone",z);set("tl0",(z-1)*6-177);set("tp0",0);set("tk",.9996);set("tfe",500000);set("tfn",v=="utmS"?1e7:0);set("pjN","UTM zone "+z+(v=="utmS"?"S":"N")+" (Transverse Mercator), WGS84")}
else if(v=="tm"){set("pjN","Transverse Mercator (custom)");set("zone","–");if(!isFinite(+$("tl0").value)){ELL.wgs.forEach((x,i)=>set(FLD[i],x));set("tl0",127);set("tp0",0);set("tk",.9996);set("tfe",500000);set("tfn",0)}}
else{set("pjN","(from definition)");set("zone","–");FLD.forEach(i=>set(i,"–"));if(crsDef)p4Fill(crsDef)}}
function p4Fill(def){const set=(i,x)=>{$(i).value=x},m=k=>{const r=def.match(new RegExp("\\+"+k+"=(\\S+)"));return r?r[1]:null};if(def[0]!="+"){set("pjN","(WKT definition, see status)");return}
const E={WGS84:[6378137,298.257223563],GRS80:[6378137,298.257222101],bessel:[6377397.155,299.1528128],clrk66:[6378206.4,294.9786982],clrk80ign:[6378249.2,293.4660213],intl:[6378388,297],krass:[6378245,298.3],airy:[6377563.396,299.3249646],aust_SA:[6378160,298.25],GRS67:[6378160,298.2471674]},dn=m("datum"),el=m("ellps");let a=+m("a"),rf=+m("rf");
if(el&&E[el])[a,rf]=E[el];else if(dn=="WGS84"||dn=="NAD83")[a,rf]=E.WGS84;else if(dn=="NAD27")[a,rf]=E.clrk66;else if(a&&!rf){const b=+m("b");rf=b?a/(a-b):Infinity}
const tw=(m("towgs84")||"0,0,0").split(",").map(Number),pj=m("proj")||"?",num=(k,d)=>m(k)!=null?+m(k):d;set("da",a||"?");set("dif",rf===Infinity?"∞ (sphere)":rf||"?");set("dx",tw[0]||0);set("dy",tw[1]||0);set("dz",tw[2]||0);
if(pj=="utm"){const z=+m("zone");set("pjN","UTM zone "+z+(def.includes("+south")?"S":"N"));set("zone",z);set("tl0",(z-1)*6-177);set("tp0",0);set("tk",.9996);set("tfe",500000);set("tfn",def.includes("+south")?1e7:0)}
else{set("pjN",pj+(pj=="longlat"?" (geographic)":""));if(pj=="longlat"){["tl0","tp0","tk","tfe","tfn"].forEach(i=>set(i,"–"))}else{set("tl0",num("lon_0",0));set("tp0",num("lat_0",0));set("tk",num("k_0",num("k",1)));set("tfe",num("x_0",0));set("tfn",num("y_0",0))}}}
function mkConv(){const v=$("xcrs").value;if(v=="epsg"){if(!crsDef||!window.proj4)throw new Error(i18("Load an EPSG definition first (section {§crs})."));const T=proj4(crsDef,"EPSG:4326");return(x,y)=>{const q=T.forward([x,y]);return[q[1],q[0]]}}
const dt=[g("da"),g("dif"),g("dx"),g("dy"),g("dz")];if(v!="geo"&&!dt.every(isFinite))throw new Error(i18("Coordinate system parameters are incomplete."));const P=v=="geo"?null:crsP(dt);return(x,y)=>{let la,lo;if(v=="geo"){lo=x;la=y}else[la,lo]=tmInv(x,y,P);return toWGS(la,lo,dt)}}
$("xcrs").onchange=syncCRS;$("zone").onchange=syncCRS;$("qf").onchange=e=>{const d=ELL[e.target.value];if(d)d.forEach((x,i)=>{$(FLD[i]).value=x})};
