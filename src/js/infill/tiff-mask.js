/* ===== infill: read a GeoTIFF (processed bathymetry grid or side-scan mosaic) as a "has data" mask =====
   Classic TIFF, strips or tiles, 1–4 samples (chunky), 8/16/32-bit integer or 32/64-bit float,
   no compression, LZW, Deflate or PackBits, predictor 1/2/3. Large rasters are reduced: a mask cell
   has data when any pixel in its block has data. Returns the mask, its affine and the file's EPSG. */
function tifLZW(src,outLen){const out=new Uint8Array(outLen);let op=0,bp=0,nb=9,dict=[],prev=null;const reset=()=>{dict=[];for(let i=0;i<256;i++)dict.push([i]);dict.push(null,null);nb=9};reset();
const rd=()=>{let v=0;for(let i=0;i<nb;i++){const by=src[bp>>3];if(by===undefined)return 257;v=(v<<1)|((by>>(7-(bp&7)))&1);bp++}return v};
for(;;){const c=rd();if(c==257)break;if(c==256){reset();prev=null;continue}let e;if(c<dict.length&&dict[c])e=dict[c];else if(prev)e=prev.concat(prev[0]);else break;
for(let i=0;i<e.length&&op<outLen;i++)out[op++]=e[i];if(prev)dict.push(prev.concat(e[0]));prev=e;const n=dict.length+1;nb=n>=4096?12:n>=2048?12:n>=1024?11:n>=512?10:9;if(op>=outLen)break}return out}
function tifPackBits(src,outLen){const out=new Uint8Array(outLen);let i=0,o=0;while(i<src.length&&o<outLen){const n=(src[i]<<24)>>24;i++;if(n>=0){for(let k=0;k<=n&&o<outLen;k++)out[o++]=src[i++]}else if(n!=-128){const b=src[i++];for(let k=0;k<1-n&&o<outLen;k++)out[o++]=b}}return out}
async function tifInflate(u){return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer())}
// opt: {kind:"grid"|"mosaic", black:true, white:false, maxCells:4e6}
async function readTiffMask(buf,opt){const dv=new DataView(buf),le=dv.getUint16(0)==0x4949,U16=o=>dv.getUint16(o,le),U32=o=>dv.getUint32(o,le);
if(U16(2)==43)throw new Error(i18("BigTIFF is not supported: export the GeoTIFF as a standard TIFF (under 4 GB)"));if(U16(2)!=42)throw new Error(i18("not a TIFF file"));
const p=U32(4),cnt=U16(p),T={};for(let i=0;i<cnt;i++){const e=p+2+12*i,ty=U16(e+2),c=U32(e+4),sz={1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,16:8}[ty]||1;T[U16(e)]={ty,c,o:c*sz<=4?e+8:U32(e+8)}}
const val=(tag,d)=>{const x=T[tag];if(!x)return d;const a=[];for(let i=0;i<x.c;i++)a.push(x.ty==3?U16(x.o+2*i):x.ty==4?U32(x.o+4*i):x.ty==12?dv.getFloat64(x.o+8*i,le):x.ty==11?dv.getFloat32(x.o+4*i,le):x.ty==5?U32(x.o+8*i)/U32(x.o+8*i+4):x.ty==16?Number(dv.getBigUint64(x.o+8*i,le)):dv.getUint8(x.o+i));return a};
const str=tag=>{const x=T[tag];if(!x)return null;let s="";for(let i=0;i<x.c;i++){const ch=dv.getUint8(x.o+i);if(!ch)break;s+=String.fromCharCode(ch)}return s};
const W=val(256)[0],H=val(257)[0],spp=val(277,[1])[0],bps=val(258,[8])[0],comp=val(259,[1])[0],pred=val(317,[1])[0],sf=val(339,[1])[0],planar=val(284,[1])[0],extra=val(338,[]);
if(comp==7||comp==6)throw new Error(i18("JPEG-compressed TIFF is not supported: export it with LZW, Deflate or no compression"));
if(![1,5,8,32946,32773].includes(comp))throw new Error(i18("TIFF compression {0} is not supported",comp));
if(planar!=1&&spp>1)throw new Error(i18("separate-plane TIFF is not supported: export it as an interleaved (pixel) TIFF"));
const nd=str(42113),ndv=nd!=null&&nd.trim()!==""?parseFloat(nd):null;
// georeference: tiepoint + pixel scale, or a full transformation matrix
let A;const sc=val(33550),tp=val(33922),mt=val(34264);if(mt&&mt.length>=8)A=[mt[3],mt[0],mt[1],mt[7],mt[4],mt[5]];else if(sc&&tp)A=[tp[3]-tp[0]*sc[0],sc[0],0,tp[4]+tp[1]*sc[1],0,-sc[1]];else throw new Error(i18("the TIFF has no georeference"));
const gk=val(34735,[]),key=k=>{for(let i=4;i+3<gk.length;i+=4)if(gk[i]==k)return gk[i+1]==0?gk[i+3]:null;return null};
if(key(1025)==2){A[0]-=A[1]/2+A[2]/2;A[3]-=A[4]/2+A[5]/2}// pixel-is-point
const epsg=key(3072)||key(2048)||null;
const B=bps/8,tiled=!!T[324],offs=val(tiled?324:273),lens=val(tiled?325:279),tw=tiled?val(322)[0]:W,th=tiled?val(323)[0]:val(278,[H])[0],nTx=Math.ceil(W/tw);
const f=Math.max(1,Math.ceil(Math.sqrt(W*H/((opt&&opt.maxCells)||4e6)))),mw=Math.ceil(W/f),mh=Math.ceil(H/f),mask=new Uint8Array(mw*mh);
const alpha=extra.length?spp-extra.length:spp==2||spp==4?spp-1:-1,mos=opt&&opt.kind=="mosaic";
const fills=[-9999,-32767,-32768,-99999,3.4028234663852886e38,-3.4028234663852886e38,1e30,-1e30];
const valid=(px)=>{if(alpha>=0&&px[alpha]==0)return false;const n=alpha>=0?alpha:spp;
if(ndv!=null){let all=true;for(let s=0;s<n;s++)if(px[s]!=ndv){all=false;break}if(all)return false}
if(mos){let z=true,w=true;const top=(1<<Math.min(bps,16))-1;for(let s=0;s<n;s++){if(px[s]!=0)z=false;if(px[s]!=top)w=false}if(z&&opt.black!==false)return false;if(w&&opt.white)return false;return true}
const v=px[0];if(!isFinite(v))return false;if(ndv==null&&fills.some(q=>Math.abs(v-q)<1e-6*Math.max(1,Math.abs(q))))return false;return true};
const px=new Float64Array(spp);let any=0;
for(let k=0;k<offs.length;k++){const x0=tiled?(k%nTx)*tw:0,y0=tiled?Math.floor(k/nTx)*th:k*th,bw=tiled?tw:W,bh=tiled?th:Math.min(th,H-y0);if(bh<=0)continue;
const need=bw*bh*spp*B;let u=new Uint8Array(buf,offs[k],Math.min(lens[k],buf.byteLength-offs[k]));
if(comp==8||comp==32946)u=await tifInflate(u);else if(comp==5)u=tifLZW(u,need);else if(comp==32773)u=tifPackBits(u,need);
if(u.length<need){const t=new Uint8Array(need);t.set(u);u=t}
const rowB=bw*spp*B;
if(pred==2){for(let r=0;r<bh;r++){const o=r*rowB;if(B==1){for(let i=spp;i<rowB;i++)u[o+i]=(u[o+i]+u[o+i-spp])&255}else{const d=new DataView(u.buffer,u.byteOffset+o,rowB),g=B==2?(i=>d.getUint16(i*2,le)):(i=>d.getUint32(i*4,le)),s=B==2?((i,v)=>d.setUint16(i*2,v&65535,le)):((i,v)=>d.setUint32(i*4,v>>>0,le));for(let i=spp;i<bw*spp;i++)s(i,g(i)+g(i-spp))}}}
let D=new DataView(u.buffer,u.byteOffset,u.byteLength),rd;
if(pred==3){// floating point predictor: undo the byte differencing, then un-shuffle the bytes (most significant first)
const o2=new Uint8Array(need),n=bw*spp;for(let r=0;r<bh;r++){const o=r*rowB;for(let i=spp;i<rowB;i++)u[o+i]=(u[o+i]+u[o+i-spp])&255;for(let i=0;i<n;i++)for(let b=0;b<B;b++)o2[o+i*B+b]=u[o+b*n+i]}
D=new DataView(o2.buffer);rd=i=>B==4?D.getFloat32(i*4,false):D.getFloat64(i*8,false)}
else rd=B==1?(i=>D.getUint8(i)):B==2?(sf==2?(i=>D.getInt16(i*2,le)):(i=>D.getUint16(i*2,le))):B==4?(sf==3?(i=>D.getFloat32(i*4,le)):sf==2?(i=>D.getInt32(i*4,le)):(i=>D.getUint32(i*4,le))):(i=>D.getFloat64(i*8,le));
for(let r=0;r<bh;r++){const y=y0+r;if(y>=H)break;const my=(y/f|0)*mw;for(let c=0;c<bw;c++){const x=x0+c;if(x>=W)break;const mi=my+(x/f|0);if(mask[mi])continue;const b=(r*bw+c)*spp;for(let s=0;s<spp;s++)px[s]=rd(b+s);if(valid(px)){mask[mi]=1;any++}}}}
// affine of the mask cells
const M=[A[0],A[1]*f,A[2]*f,A[3],A[4]*f,A[5]*f];
return{mw,mh,mask,A:M,epsg,f,W,H,any,geo:Math.abs(A[0])<=360&&Math.abs(A[3])<=90&&Math.abs(A[1])<1}}
