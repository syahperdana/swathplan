// ---- global bathymetry
const newB=src=>({la:[],lo:[],z:[],bad:0,zmin:1e30,zmax:-1e30,a0:90,a1:-90,o0:360,o1:-360,src});
function addPt(B,la,lo,z){if(!isFinite(la+lo+z)||z<=0||z>12000){B.bad++;return}B.la.push(la);B.lo.push(lo);B.z.push(z);B.zmin=Math.min(B.zmin,z);B.zmax=Math.max(B.zmax,z);B.a0=Math.min(B.a0,la);B.a1=Math.max(B.a1,la);B.o0=Math.min(B.o0,lo);B.o1=Math.max(B.o1,lo)}
function setBath(B,msg){if(!B.z.length)throw new Error(i18("no sea-floor values in this area (land only, or no data coverage)"));bath=B;DG=null;
if(!closed){reorigin((B.a0+B.a1)/2,(B.o0+B.o1)/2);const dx=Math.max(50,(B.o1-B.o0)*111320*Math.cos(o.lat*D)),dy=Math.max(50,(B.a1-B.a0)*111132.9);V.cx=V.cy=0;V.k=Math.min(cv.width/dx,cv.height/dy)*.8}
$("adp").checked=true;analyse();gen();$("gbSt").textContent=i18("{0}: {1} depth values, {2} to {3} m ({4} land/no-data cells skipped). Adaptive line spacing is now on.",msg,B.z.length,B.zmin.toFixed(1),B.zmax.toFixed(1),B.bad)}
function parseASC(t){const L=t.split(/\r?\n/),h={};let i=0;for(;i<L.length&&/^[A-Za-z_]/.test(L[i].trim());i++){const m=L[i].trim().split(/\s+/);h[m[0].toLowerCase()]=+m[1]}
const nx=h.ncols,ny=h.nrows,cs=h.cellsize||h.dx;if(!(nx>0&&ny>0&&cs>0))throw new Error(i18("not a valid ESRI ASCII grid"));const x0=h.xllcorner!=null?h.xllcorner:h.xllcenter-cs/2,y0=h.yllcorner!=null?h.yllcorner:h.yllcenter-cs/2,data=new Float32Array(nx*ny);let k=0;
for(;i<L.length&&k<nx*ny;i++){const r=L[i].trim();if(r)for(const v of r.split(/\s+/)){if(k<nx*ny)data[k++]=+v}}return{w:nx,h:ny,xl:x0,yt:y0+ny*cs,dx:cs,dy:cs,data,nodata:h.nodata_value!=null?h.nodata_value:-9999}}
async function parseTIFF(buf){const dv=new DataView(buf),le=dv.getUint16(0)==0x4949,U16=o=>dv.getUint16(o,le),U32=o=>dv.getUint32(o,le);if(U16(2)!=42)throw new Error(i18("not a standard TIFF (BigTIFF is not supported)"));
const p=U32(4),cnt=U16(p),T={};for(let i=0;i<cnt;i++){const e=p+2+12*i,ty=U16(e+2),c=U32(e+4),sz={1:1,2:1,3:2,4:4,5:8,12:8}[ty]||1;T[U16(e)]={ty,c,o:c*sz<=4?e+8:U32(e+8)}}
const val=(tag,d)=>{const x=T[tag];if(!x)return d;const a=[];for(let i=0;i<x.c;i++)a.push(x.ty==3?U16(x.o+2*i):x.ty==4?U32(x.o+4*i):x.ty==12?dv.getFloat64(x.o+8*i,le):x.ty==5?U32(x.o+8*i)/U32(x.o+8*i+4):dv.getUint8(x.o+i));return a};
const W=val(256)[0],H=val(257)[0],bps=val(258,[8])[0],comp=val(259,[1])[0],pred=val(317,[1])[0],sf=val(339,[1])[0];if(val(277,[1])[0]!=1)throw new Error(i18("multi-band TIFF is not supported"));if(pred==3||(pred==2&&sf==3))throw new Error(i18("TIFF predictor not supported"));
const sc=val(33550),tp=val(33922);if(!sc||!tp)throw new Error(i18("the TIFF has no georeference"));const tiled=!!T[324],offs=val(tiled?324:273),lens=val(tiled?325:279),tw=tiled?val(322)[0]:W,th=tiled?val(323)[0]:val(278,[H])[0],nTx=Math.ceil(W/tw),out=new Float32Array(W*H);
const rd=(b,i)=>bps==32?(sf==3?b.getFloat32(4*i,le):sf==2?b.getInt32(4*i,le):b.getUint32(4*i,le)):bps==16?(sf==2?b.getInt16(2*i,le):b.getUint16(2*i,le)):b.getUint8(i);
for(let k=0;k<offs.length;k++){let u=new Uint8Array(buf,offs[k],lens[k]);if(comp==8||comp==32946)u=new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());else if(comp!=1)throw new Error("TIFF compression "+comp+" is not supported");
const b=new DataView(u.buffer,u.byteOffset,u.byteLength),x0=tiled?(k%nTx)*tw:0,y0=tiled?Math.floor(k/nTx)*th:k*th,bw=tiled?tw:W,bh=tiled?th:Math.min(th,H-y0);
for(let r=0;r<bh&&y0+r<H;r++){let prev=0;for(let c=0;c<bw;c++){let v=rd(b,r*bw+c);if(pred==2){v+=prev;prev=v}if(x0+c<W)out[(y0+r)*W+x0+c]=v}}}
const nd=T[42113]?parseFloat(String.fromCharCode(...new Uint8Array(buf,T[42113].o,Math.max(0,T[42113].c-1)))):undefined;
return{w:W,h:H,xl:tp[3]-tp[0]*sc[0],yt:tp[4]+tp[1]*sc[1],dx:sc[0],dy:sc[1],data:out,nodata:nd}}
function gridToBath(G,conv,src){const B=newB(src),st=Math.max(1,Math.ceil(Math.sqrt(G.w*G.h/150000)));let cvt=null;
if(conv=="auto"){let ng=0,ps=0;for(let k=0;k<G.data.length;k+=7){const v=G.data[k];if(v<0)ng++;else if(v>0)ps++}conv=ng>=ps?"elev":"depth"}
for(let j=0;j<G.h;j+=st)for(let i=0;i<G.w;i+=st){const v=G.data[j*G.w+i];if(!isFinite(v)||v===G.nodata){B.bad++;continue}const x=G.xl+(i+.5)*G.dx,y=G.yt-(j+.5)*G.dy;let la=y,lo=x;
if(Math.abs(x)>360||Math.abs(y)>90){if(!cvt)cvt=mkConv();[la,lo]=cvt(x,y)}addPt(B,la,lo,conv=="depth"?v:-v)}return B}
async function gbGet(url,opt,bin){const c=new AbortController(),t=setTimeout(()=>c.abort(),90000);try{const r=await fetch(url,Object.assign({signal:c.signal},opt||{}));if(!r.ok)throw new Error("HTTP "+r.status);return bin?await r.arrayBuffer():await r.text()}finally{clearTimeout(t)}}
$("gbB").onclick=async()=>{const st=$("gbSt"),lk=$("gbLink");lk.innerHTML="";if(!closed||poly.length<3){st.textContent=i18("Close an area first (draw, preset or import).");return}
const ll=poly.map(toLL),la=ll.map(q=>q[0]),lo=ll.map(q=>q[1]),m=Math.max(.003,(Math.max(...la)-Math.min(...la))*.03,(Math.max(...lo)-Math.min(...lo))*.03),s=Math.max(-90,Math.min(...la)-m),n=Math.min(90,Math.max(...la)+m),w=Math.min(...lo)-m,e=Math.max(...lo)+m,res=+$("gbRes").value,src=$("gbSrc").value,f5=v=>v.toFixed(5),
wm=(e-w)*111320*Math.cos((s+n)/2*D),hm=(n-s)*111132.9,grid=(nx,ny)=>{const a=[];for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)a.push([w+(i+.5)*(e-w)/nx,n-(j+.5)*(n-s)/ny]);return a};let url="";
try{st.textContent="Downloading…";
if(src=="gmrt"){url="https://www.gmrt.org/services/GridServer?minlongitude="+f5(w)+"&maxlongitude="+f5(e)+"&minlatitude="+f5(s)+"&maxlatitude="+f5(n)+"&format=esriascii&layer=topo&mresolution="+Math.max(100,res);setBath(gridToBath(parseASC(await gbGet(url)),"elev","GMRT"),"GMRT")}
else if(src=="emod"){const rd=Math.max(res,115)/111320,k=Math.max(1,(e-w)/rd/1500,(n-s)/rd/1500),rx=(rd*k).toFixed(8);url="https://ows.emodnet-bathymetry.eu/wcs?service=wcs&version=1.0.0&request=getcoverage&coverage=emodnet:mean&crs=EPSG:4326&BBOX="+[w,s,e,n].map(f5).join(",")+"&format=image/tiff&interpolation=nearest&resx="+rx+"&resy="+rx;setBath(gridToBath(await parseTIFF(await gbGet(url,{},true)),"auto","EMODnet"),"EMODnet")}
else{const pts=grid(Math.max(6,Math.min(60,Math.ceil(wm/Math.max(100,res)))),Math.max(6,Math.min(60,Math.ceil(hm/Math.max(100,res))))),B=newB("NOAA NCEI");
for(let a=0;a<pts.length;a+=250){const ch=pts.slice(a,a+250),j=JSON.parse(await gbGet("https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/getSamples",{method:"POST",body:new URLSearchParams({geometry:JSON.stringify({points:ch,spatialReference:{wkid:4326}}),geometryType:"esriGeometryMultipoint",returnFirstValueOnly:"true",interpolation:"RSP_BilinearInterpolation",f:"json"})}));
if(j.error)throw new Error(j.error.message||"service error");(j.samples||[]).forEach((q,i)=>{const pt=ch[q.locationId!=null?q.locationId:i];if(pt)addPt(B,pt[1],pt[0],-parseFloat(q.value))})}setBath(B,"NOAA NCEI")}

}catch(err){st.textContent=i18("Could not use this source: {0}. It may be offline, blocked by the browser (CORS) or busy. Try another source, or download a grid and load it below.",err.message);if(url)lk.innerHTML="<a href=\""+url+"\" target=\"_blank\" rel=\"noopener\">"+i18("Open this request in your browser to download the grid")+"</a>, "+i18("then load the file below.")}};
$("gbF").onchange=async e=>{const f=e.target.files[0];if(!f)return;const st=$("gbSt");try{st.textContent=i18("Reading {0}…",f.name);const G=/\.tiff?$/i.test(f.name)?await parseTIFF(await f.arrayBuffer()):parseASC(await f.text());setBath(gridToBath(G,$("gbZ").value,f.name),f.name)}catch(err){st.textContent=i18("Could not read this grid: {0}",err.message)}};

