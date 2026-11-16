// ---- global bathymetry
const newB=src=>({la:[],lo:[],z:[],bad:0,zmin:1e30,zmax:-1e30,a0:90,a1:-90,o0:360,o1:-360,src});
function addPt(B,la,lo,z){if(!isFinite(la+lo+z)||z<=0||z>12000){B.bad++;return}B.la.push(la);B.lo.push(lo);B.z.push(z);B.zmin=Math.min(B.zmin,z);B.zmax=Math.max(B.zmax,z);B.a0=Math.min(B.a0,la);B.a1=Math.max(B.a1,la);B.o0=Math.min(B.o0,lo);B.o1=Math.max(B.o1,lo)}
function setBath(B,msg){if(!B.z.length)throw new Error(i18("no sea-floor values in this area (land only, or no data coverage)"));bath=B;DG=null;
if(!closed){reorigin((B.a0+B.a1)/2,(B.o0+B.o1)/2);const dx=Math.max(50,(B.o1-B.o0)*111320*Math.cos(o.lat*D)),dy=Math.max(50,(B.a1-B.a0)*111132.9);V.cx=V.cy=0;V.k=Math.min(cv.width/dx,cv.height/dy)*.8}
$("adp").checked=true;analyse();gen();$("gbSt").textContent=i18("{0}: {1} depth values, {2} to {3} m ({4} land/no-data cells skipped). Adaptive line spacing is now on.",msg,B.z.length,B.zmin.toFixed(1),B.zmax.toFixed(1),B.bad)}
function parseASC(t){const L=t.split(/\r?\n/),h={};let i=0;for(;i<L.length&&/^[A-Za-z_]/.test(L[i].trim());i++){const m=L[i].trim().split(/\s+/);h[m[0].toLowerCase()]=+m[1]}
const nx=h.ncols,ny=h.nrows,cs=h.cellsize||h.dx;if(!(nx>0&&ny>0&&cs>0))throw new Error(i18("not a valid ESRI ASCII grid"));const x0=h.xllcorner!=null?h.xllcorner:h.xllcenter-cs/2,y0=h.yllcorner!=null?h.yllcorner:h.yllcenter-cs/2,data=new Float32Array(nx*ny).fill(NaN);let k=0;
for(;i<L.length&&k<nx*ny;i++){const r=L[i].trim();if(r)for(const v of r.split(/\s+/)){if(k<nx*ny)data[k++]=+v}}return{short:k<nx*ny,w:nx,h:ny,xl:x0,yt:y0+ny*cs,dx:cs,dy:cs,data,nodata:h.nodata_value!=null?h.nodata_value:-9999}}
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
function gridToBath(G,conv,src,B0,cap){const B=B0||newB(src),st=Math.max(1,Math.ceil(Math.sqrt(G.w*G.h/(cap||150000))));let cvt=null;
if(conv=="auto"){let ng=0,ps=0;for(let k=0;k<G.data.length;k+=7){const v=G.data[k];if(v<0)ng++;else if(v>0)ps++}conv=ng>=ps?"elev":"depth"}
for(let j=0;j<G.h;j+=st)for(let i=0;i<G.w;i+=st){const v=G.data[j*G.w+i];if(!isFinite(v)||v===G.nodata){B.bad++;continue}const x=G.xl+(i+.5)*G.dx,y=G.yt-(j+.5)*G.dy;let la=y,lo=x;
if(Math.abs(x)>360||Math.abs(y)>90){if(!cvt)cvt=mkConv();[la,lo]=cvt(x,y)}addPt(B,la,lo,conv=="depth"?v:-v)}return B}
async function gbGet(url,opt,bin){const c=new AbortController(),t=setTimeout(()=>c.abort(),90000);try{const r=await fetch(url,Object.assign({signal:c.signal},opt||{}));if(!r.ok)throw new Error("HTTP "+r.status);return bin?await r.arrayBuffer():await r.text()}finally{clearTimeout(t)}}
// only what the survey needs: a test "is this lon/lat box within m metres of the area", pieces of the box that pass it
// (at most 40, coarser when there would be more), and a point grid near the area (at most cap points)
function gbNear(m){const segBox=(a,b,x0,y0,x1,y1)=>{let t0=0,t1=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const[p,q]of[[-dx,a[0]-x0],[dx,x1-a[0]],[-dy,a[1]-y0],[dy,y1-a[1]]]){if(p==0){if(q<0)return false}else{const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r}else{if(r<t0)return false;if(r<t1)t1=r}}}return true};
return(w1,e1,s1,n1)=>{const A=fromLL(s1,w1),Z=fromLL(n1,e1),x0=A[0]-m,y0=A[1]-m,x1=Z[0]+m,y1=Z[1]+m;if(inPoly([(x0+x1)/2,(y0+y1)/2]))return true;
for(let i=0,j=poly.length-1;i<poly.length;j=i++)if(segBox(poly[j],poly[i],x0,y0,x1,y1))return true;return false}}
function gbPieces(w,e,s,n,r,cells,near){for(let it=0;it<12;it++){const sy=r*cells/111132.9,sx=sy/Math.max(.05,Math.cos((s+n)/2*D)),P=[];
for(let y=s;y<n-1e-9;y+=sy)for(let x=w;x<e-1e-9;x+=sx){const q=[x,Math.min(e,x+sx),y,Math.min(n,y+sy),r];if(near(q[0],q[1],q[2],q[3]))P.push(q)}if(P.length<=40||it==11)return P;r*=1.4}}
function gbPts(w,e,s,n,sp,near,cap){const T=gbPieces(w,e,s,n,Math.max(sp,500),40,near),cell=(q,d)=>{const a=[],dy=d/111132.9,dx=dy/Math.max(.05,Math.cos((q[2]+q[3])/2*D));for(let y=q[2]+dy/2;y<q[3];y+=dy)for(let x=q[0]+dx/2;x<q[1];x+=dx)if(near(x,x,y,y))a.push([x,y]);return a};
const A=T.reduce((t,q)=>t+(q[1]-q[0])*(q[3]-q[2])*111320*111132.9*Math.cos((q[2]+q[3])/2*D),0);let d=Math.max(sp,Math.sqrt(A/(cap*20))),P=[];for(let it=0;it<20;it++){P=[];let over=false;for(const q of T){P.push(...cell(q,d));if(P.length>cap){over=true;break}}if(!over)break;d*=1.3}return P}
$("gbB").onclick=async()=>{const st=$("gbSt"),lk=$("gbLink");lk.innerHTML="";if(!closed||poly.length<3){st.textContent=i18("Close an area first (draw, preset or import).");return}
const ll=poly.map(toLL),la=ll.map(q=>q[0]),lo=ll.map(q=>q[1]),m=Math.max(.003,(arrMax(la)-arrMin(la))*.03,(arrMax(lo)-arrMin(lo))*.03),s=Math.max(-90,arrMin(la)-m),n=Math.min(90,arrMax(la)+m),w=arrMin(lo)-m,e=arrMax(lo)+m,res=+$("gbRes").value,src=$("gbSrc").value,f5=v=>v.toFixed(5),
wm=(e-w)*111320*Math.cos((s+n)/2*D),hm=(n-s)*111132.9,grid=(nx,ny)=>{const a=[];for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)a.push([w+(i+.5)*(e-w)/nx,n-(j+.5)*(n-s)/ny]);return a};let url="";
try{st.textContent="Downloading…";
const near=gbNear(Math.max(500,res*3));
if(src!="ncei"){const R0=Math.max(src=="gmrt"?100:115,res),P=gbPieces(w,e,s,n,R0,300,near),B=newB(src=="gmrt"?"GMRT":"EMODnet");let done=0,bad=0,first="";
const one=async q=>{const[w1,e1,s1,n1,r]=q;const u=src=="gmrt"?"https://www.gmrt.org/services/GridServer?minlongitude="+f5(w1)+"&maxlongitude="+f5(e1)+"&minlatitude="+f5(s1)+"&maxlatitude="+f5(n1)+"&format=esriascii&layer=topo&mresolution="+Math.round(r)
:"https://ows.emodnet-bathymetry.eu/wcs?service=wcs&version=1.0.0&request=getcoverage&coverage=emodnet:mean&crs=EPSG:4326&BBOX="+[w1,s1,e1,n1].map(f5).join(",")+"&format=image/tiff&interpolation=nearest&resx="+(r/111320).toFixed(8)+"&resy="+(r/111320).toFixed(8);
try{const G=src=="gmrt"?parseASC(await gbGet(u)):await parseTIFF(await gbGet(u,{},true));if(G.short)throw new Error("cut short");gridToBath(G,src=="gmrt"?"elev":"auto",B.src,B,Math.max(20000,400000/P.length))}catch(er){bad++;if(!first){first=u;url=u}if(bad==P.length)throw er}
st.textContent=i18("Downloading… {0} of {1} pieces",++done,P.length)};
for(let k=0;k<P.length;k+=2)await Promise.all(P.slice(k,k+2).map(one));
setBath(B,B.src);if(bad){st.textContent+=" "+i18("{0} of {1} pieces could not be downloaded or were cut short, so depths may be missing there: try a coarser resolution, or open the link below.",bad,P.length);lk.innerHTML="<a href=\""+first+"\" target=\"_blank\" rel=\"noopener\">"+i18("Open this request in your browser to download the grid")+"</a>, "+i18("then load the file below.")}}
else{const pts=gbPts(w,e,s,n,Math.max(100,res),near,12000),B=newB("NOAA NCEI");let done=0;
const one=async ch=>{const j=JSON.parse(await gbGet("https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/getSamples",{method:"POST",body:new URLSearchParams({geometry:JSON.stringify({points:ch,spatialReference:{wkid:4326}}),geometryType:"esriGeometryMultipoint",returnFirstValueOnly:"true",interpolation:"RSP_BilinearInterpolation",f:"json"})}));
if(j.error)throw new Error(j.error.message||"service error");(j.samples||[]).forEach((q,i)=>{const pt=ch[q.locationId!=null?q.locationId:i];if(pt)addPt(B,pt[1],pt[0],-parseFloat(q.value))});st.textContent=i18("Downloading… {0} of {1} pieces",++done,Math.ceil(pts.length/250))};
const C=[];for(let a=0;a<pts.length;a+=250)C.push(pts.slice(a,a+250));for(let k=0;k<C.length;k+=3)await Promise.all(C.slice(k,k+3).map(one));setBath(B,"NOAA NCEI")}

}catch(err){st.textContent=i18("Could not use this source: {0}. It may be offline, blocked by the browser (CORS) or busy. Try another source, or download a grid and load it below.",err.message);if(url)lk.innerHTML="<a href=\""+url+"\" target=\"_blank\" rel=\"noopener\">"+i18("Open this request in your browser to download the grid")+"</a>, "+i18("then load the file below.")}};
$("gbF").onchange=async e=>{const f=e.target.files[0];if(!f)return;const st=$("gbSt");try{st.textContent=i18("Reading {0}…",f.name);const G=/\.tiff?$/i.test(f.name)?await parseTIFF(await f.arrayBuffer()):parseASC(await f.text());setBath(gridToBath(G,$("gbZ").value,f.name),f.name)}catch(err){st.textContent=i18("Could not read this grid: {0}",err.message)}};

