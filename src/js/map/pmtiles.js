/* ===== PMTiles v3 reader (raster basemap files, read in small pieces) ===== */
// Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
// read(offset, length) -> Promise<ArrayBuffer>. Only the header, the directories that are
// needed and the tiles on screen are read, so even a very large file uses little memory.
function pmTileId(z,x,y){let acc=0;for(let t=0;t<z;t++)acc+=4**t;const n=2**z;let d=0;
for(let s=n/2;s>=1;s/=2){const rx=(x&s)>0?1:0,ry=(y&s)>0?1:0;d+=s*s*((3*rx)^ry);
if(ry==0){if(rx==1){x=n-1-x;y=n-1-y}const t=x;x=y;y=t}}return acc+d}
async function pmInflate(buf,comp){if(comp<=1)return buf;if(comp!=2)throw new Error(i18("This map file uses a compression the browser cannot read (use gzip or none)."));
if(typeof DecompressionStream=="undefined")throw new Error(i18("This browser cannot read compressed map files. Update the browser."));
return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()}
function pmDir(buf){const b=new Uint8Array(buf);let p=0;const v=()=>{let r=0,m=1,c;do{c=b[p++];r+=(c&127)*m;m*=128}while(c&128);return r};
const n=v(),E=new Array(n);let id=0;for(let i=0;i<n;i++){id+=v();E[i]={id}}for(let i=0;i<n;i++)E[i].run=v();for(let i=0;i<n;i++)E[i].len=v();
for(let i=0;i<n;i++){const o=v();E[i].off=o==0&&i>0?E[i-1].off+E[i-1].len:o-1}return E}
async function pmOpen(read){const H=new DataView(await read(0,127));
const magic=String.fromCharCode(...new Uint8Array(H.buffer,0,7));if(magic!="PMTiles")throw new Error(i18("Not a PMTiles file."));
if(H.getUint8(7)!=3)throw new Error(i18("Only PMTiles version 3 is supported."));
const u=o=>Number(H.getBigUint64(o,true)),i32=o=>H.getInt32(o,true)/1e7;
const h={rootOff:u(8),rootLen:u(16),metaOff:u(24),metaLen:u(32),leafOff:u(40),dataOff:u(56),ic:H.getUint8(97),tc:H.getUint8(98),type:H.getUint8(99),
minZ:H.getUint8(100),maxZ:H.getUint8(101),bounds:[i32(102),i32(106),i32(110),i32(114)],cz:H.getUint8(118),cLon:i32(119),cLat:i32(123)};
const MIME={2:"image/png",3:"image/jpeg",4:"image/webp",5:"image/avif"};
if(h.type==1)throw new Error(i18("This is a vector map file. SwathPlan can show raster map files (PNG, JPEG or WebP tiles)."));
if(!MIME[h.type])throw new Error(i18("Unknown tile type in this map file."));
const root=pmDir(await pmInflate(await read(h.rootOff,h.rootLen),h.ic)),leaves=new Map();
let meta={};try{if(h.metaLen)meta=JSON.parse(new TextDecoder().decode(await pmInflate(await read(h.metaOff,h.metaLen),h.ic)))}catch(e){}
const find=(E,id)=>{let lo=0,hi=E.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(E[m].id<id)lo=m+1;else if(E[m].id>id)hi=m-1;else return E[m]}
const e=hi>=0?E[hi]:null;return e&&(e.run==0||id<e.id+e.run)?e:null};
async function get(z,x,y){if(z<h.minZ||z>h.maxZ)return null;const id=pmTileId(z,x,y);let E=root;
for(let depth=0;depth<4;depth++){const e=find(E,id);if(!e)return null;
if(e.run>0){const t=await read(h.dataOff+e.off,e.len);return h.tc==2?await pmInflate(t,2):t}
const k=h.leafOff+e.off;if(!leaves.has(k)){if(leaves.size>64)leaves.delete(leaves.keys().next().value);leaves.set(k,pmInflate(await read(k,e.len),h.ic).then(pmDir))}E=await leaves.get(k)}return null}
return{h,meta,mime:MIME[h.type],get}}
