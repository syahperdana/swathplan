// ---- more export formats
const lns=()=>R.lines.concat(R.cross),azi=l=>(Math.atan2(l.b[0]-l.a[0],l.b[1]-l.a[1])/D+360)%360,
ddm=(v,lat)=>{const h=lat?(v>=0?"N":"S"):(v>=0?"E":"W"),a=Math.abs(v),d=Math.floor(a);return d+"° "+((a-d)*60).toFixed(4).padStart(7,"0")+"' "+h},
nm0=(v,lat)=>{const a=Math.abs(v),d=Math.floor(a);return String(d).padStart(lat?2:3,"0")+((a-d)*60).toFixed(4).padStart(7,"0")},
cks=t=>{let c=0;for(const ch of t)c^=ch.charCodeAt(0);return c.toString(16).toUpperCase().padStart(2,"0")},
gpx=b=>'<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="MBES Survey Planner" xmlns="http://www.topografix.com/GPX/1/1">\n'+b+'</gpx>\n',
pt=(p,tag)=>{const q=toLL(p);return`<${tag} lat="${q[0].toFixed(7)}" lon="${q[1].toFixed(7)}"></${tag}>`};
const EXP={
gpxR:()=>["survey_routes.gpx",gpx(paths().map(x=>`<rte><name>${esc(x.n)}</name>${x.p.map(q=>pt(q,"rtept")).join("")}</rte>\n`).join("")),"application/gpx+xml"],
gpxS:()=>{const a=[];R.lines.forEach((l,i)=>{a.push(...LP(l));if($("inclT").checked&&R.turns[i])a.push(...R.turns[i].pts.slice(1,-1))});return["survey_sequence.gpx",gpx(`<rte><name>Survey plan</name>${a.map(q=>pt(q,"rtept")).join("")}</rte>\n`),"application/gpx+xml"]},
gpxT:()=>["survey_tracks.gpx",gpx(paths().map(x=>`<trk><name>${esc(x.n)}</name><trkseg>${x.p.map(q=>pt(q,"trkpt")).join("")}</trkseg></trk>\n`).join("")),"application/gpx+xml"],
gpxW:()=>["survey_waypoints.gpx",gpx(lns().map(l=>{const a=toLL(l.a),b=toLL(l.b);return`<wpt lat="${a[0].toFixed(7)}" lon="${a[1].toFixed(7)}"><name>${esc(l.name)}_S</name></wpt>\n<wpt lat="${b[0].toFixed(7)}" lon="${b[1].toFixed(7)}"><name>${esc(l.name)}_E</name></wpt>\n`}).join("")),"application/gpx+xml"],
csvL:()=>["survey_lines.csv","Line,Type,Start_X,Start_Y,End_X,End_Y,Azimuth_deg,Length_m\n"+lns().map(l=>{const a=oc(l.a),b=oc(l.b);return[l.name,R.cross.includes(l)?"cross":"main",a[0],a[1],b[0],b[1],azi(l).toFixed(3),L(l).toFixed(1)].join(",")}).join("\n")+"\n","text/csv"],
csvV:()=>["survey_vertices.csv","Line,Kind,Seq,X,Y\n"+paths().map(x=>x.p.map((q,i)=>{const c=oc(q);return[x.n,x.k,i+1,c[0],c[1]].join(",")}).join("\n")).join("\n")+"\n","text/csv"],
txtV:()=>["survey_vertices.txt","Line\tSeq\tX\tY\n"+paths().map(x=>x.p.map((q,i)=>{const c=oc(q);return[x.n,i+1,c[0],c[1]].join("\t")}).join("\n")).join("\n")+"\n","text/plain"],
txtSE:()=>["survey_start_end.txt",lns().map(l=>{const a=oc(l.a),b=oc(l.b);return[l.name,a[0],a[1],b[0],b[1]].join(" ")}).join("\n")+"\n","text/plain"],
txtDM:()=>["survey_waypoints_ddm.txt",lns().map(l=>{const a=toLL(l.a),b=toLL(l.b);return`${l.name}_S  ${ddm(a[0],1)}  ${ddm(a[1],0)}\n${l.name}_E  ${ddm(b[0],1)}  ${ddm(b[1],0)}`}).join("\n")+"\n","text/plain"],
wkt:()=>["survey_lines_wkt.csv","Name,Kind,WKT\n"+paths().map(x=>`${x.n},${x.k},"LINESTRING(${x.p.map(q=>oc(q).join(" ")).join(", ")})"`).join("\n")+`\nboundary,area,"POLYGON((${poly.concat([poly[0]]).map(q=>oc(q).join(" ")).join(", ")}))"\n`,"text/csv"],
gml:()=>["survey_plan.gml",'<?xml version="1.0" encoding="UTF-8"?>\n<gml:FeatureCollection xmlns:gml="http://www.opengis.net/gml">\n'+paths().map(x=>`<gml:featureMember><Line><name>${esc(x.n)}</name><kind>${x.k}</kind><gml:LineString srsName="EPSG:4326"><gml:coordinates>${x.p.map(q=>{const c=toLL(q);return c[1].toFixed(7)+","+c[0].toFixed(7)}).join(" ")}</gml:coordinates></gml:LineString></Line></gml:featureMember>\n`).join("")+'</gml:FeatureCollection>\n',"application/gml+xml"],
mif:()=>{const geo=$("crs").value=="geo",e=new TextEncoder(),P=paths();let m='Version 300\nCharset "WindowsLatin1"\nDelimiter ","\n'+(geo?"CoordSys Earth Projection 1, 104":'CoordSys NonEarth Units "m"')+'\nColumns 3\n  Name Char(24)\n  Kind Char(8)\n  Length_m Float\nData\n\n';
P.forEach(x=>{m+="Pline "+x.p.length+"\n"+x.p.map(q=>oc(q).join(" ")).join("\n")+"\n"});return["survey_plan_mapinfo.zip",zipFiles([["survey_plan.mif",e.encode(m)],["survey_plan.mid",e.encode(P.map(x=>`"${x.n}","${x.k}",${plen(x.p).toFixed(1)}`).join("\n")+"\n")]]),"application/zip"]},
lnw:()=>["survey_plan.lnw","LNS "+lns().length+"\n"+lns().map(l=>{const q=LP(l);return`LIN ${q.length}\n${q.map(p=>{const c=oc(p);return`PTS ${c[0]} ${c[1]}`}).join("\n")}\nLNN ${l.name}\nEOL`}).join("\n")+"\n","text/plain"],
nmea:()=>["survey_waypoints.nmea",lns().map(l=>[[l.a,"S"],[l.b,"E"]].map(([q,t])=>{const c=toLL(q),b=`GPWPL,${nm0(c[0],1)},${c[0]>=0?"N":"S"},${nm0(c[1],0)},${c[1]>=0?"E":"W"},${l.name.replace(/[^A-Za-z0-9]/g,"")}${t}`;return"$"+b+"*"+cks(b)}).join("\r\n")).join("\r\n")+"\r\n","text/plain"]};
$("xBtn").onclick=()=>{if(!needs())return;const f=EXP[$("xfmt").value]();save(f[0],f[1],f[2])};

