/* ===== long corridors: the map sheet as an overview plus one sheet per segment (PDF pages, or images in one zip) ===== */
function sheetOps(op){const S=window.SWP_SEGS||[],e=$("xpSegs");if(S.length<2||!e||e.value!="seg")return[op];const N=S.length+1;
return[Object.assign({},op,{label:i18("Overview: whole route"),sheetNo:i18("Sheet {0} of {1}",1,N),file:"overview"})].concat(S.map((sg,i)=>Object.assign({},op,{ext:segExt(sg),
label:i18("{0}, KP {1} to {2}",sg.name,sg.kp0.toFixed(3),sg.kp1.toFixed(3)),sheetNo:i18("Sheet {0} of {1}",i+2,N),file:"segment_"+String(sg.n).padStart(2,"0")})))}
// a segment sheet shows the segment outline and its own lines and turns (run-in included), not the transit to the next segment
function segExt(sg){const P=sg.pts.slice();R.lines.forEach((l,i)=>{if(l.seg!==sg.n)return;P.push(...LP(l));const t=R.turns[i];if(t&&t.ty!="t"&&R.lines[i+1]&&R.lines[i+1].seg===sg.n)t.pts.forEach(q=>P.push(q))});return P}
async function sheetsZip(SO,f,base){const files=[],te=new TextEncoder(),geoF=/gtif|pngw|jpgw/.test(f),
prj='GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
for(let i=0;i<SO.length;i++){const nm=base+"_"+SO[i].file;xst(i18("Rendering map sheet {0} of {1}…",i+1,SO.length));
if(f=="svg"){const r=await renderSheet(Object.assign({},SO[i],{base:false}),false,true);files.push([nm+".svg",te.encode(r.svg)]);continue}
const res=await withFallback(SO[i],q=>renderSheet(q,geoF)),cv2=res.cv,L=res.L,dpi=res.dpi,mpp=L.mpm/res.u,dlon=mpp/(111320*Math.cos(o.lat*D)),dlat=mpp/111132.9,
tl=toLL([L.cx-L.fr[2]/2*L.mpm,L.cy+L.fr[3]/2*L.mpm]),geo={dx:dlon,dy:dlat,x0:tl[1],y0:tl[0]},wld=dlon+"\n0\n0\n"+(-dlat)+"\n"+(tl[1]+dlon/2)+"\n"+(tl[0]-dlat/2)+"\n";let blob,ext;
if(f=="png"||f=="pngw"){blob=await pngDpi(await toBlobP(cv2,"image/png"),dpi);ext=".png"}else if(f=="jpg"||f=="jpgw"){blob=new Blob([jpegDpi(new Uint8Array(await(await toBlobP(cv2,"image/jpeg",.92)).arrayBuffer()),dpi)]);ext=".jpg"}
else if(f=="webp"){blob=await toBlobP(cv2,"image/webp",.9);if(!blob||blob.type!="image/webp")throw new Error(i18("this browser cannot encode WebP"));ext=".webp"}else if(f=="bmp"){blob=makeBMP(cv2,dpi);ext=".bmp"}
else if(f=="tif"){blob=await makeTIFF(cv2,dpi);ext=".tif"}else{blob=await makeTIFF(cv2,dpi,geo);ext="_geotiff.tif"}
files.push([nm+ext,new Uint8Array(await blob.arrayBuffer())]);if(f=="pngw"||f=="jpgw")files.push([nm+(f=="pngw"?".pgw":".jgw"),te.encode(wld)],[nm+".prj",te.encode(prj)]);cv2.width=0}
const zb=zipFiles(files);save(base+"_sheets.zip",zb,"application/zip");xst(i18("Saved {0} map sheets in one zip ({1} MB): an overview and one sheet per segment.",SO.length,(zb.size/1048576).toFixed(1)))}
