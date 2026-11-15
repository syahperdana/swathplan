// ---- v3: crisp sheet text (canvas), flexible x/y text parsing, auto language, layout helpers
function fixCtx(c){const P=CanvasRenderingContext2D.prototype,nat=Object.getOwnPropertyDescriptor(P,"font"),ft=P.fillText,mt=P.measureText;let f="10px Arial";
try{c.textRendering="geometricPrecision"}catch(e){}try{c.fontKerning="normal"}catch(e){}
Object.defineProperty(c,"font",{get(){return f},set(v){f=String(v);nat.set.call(c,f)},configurable:true});
const sc=()=>{const m=c.getTransform();return Math.hypot(m.a,m.b)||1},big=s=>f.replace(/(\d*\.?\d+)px/,(a,n)=>(+n*s)+"px");
c.fillText=function(t,x,y){const s=sc();this.save();nat.set.call(this,big(s));this.scale(1/s,1/s);ft.call(this,t,x*s,y*s);this.restore()};
c.measureText=function(t){const s=sc();this.save();nat.set.call(this,big(s));const r=mt.call(this,t);this.restore();return{width:r.width/s}};return c}
const NUMRE=/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
function parseXY(t){t=String(t).replace(/^﻿/,"").replace(/[\]\)]\s*,?\s*[\[\(]/g,"\n").replace(/[\[\]\(\)\{\}]/g," ");
let L=t.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!/^(#|\/\/)/.test(s));
if(L.length==1&&/^[-+\d.eE]+\s*,\s*[-+\d.eE]+([\s;]+[-+\d.eE]+\s*,\s*[-+\d.eE]+)+$/.test(L[0]))L=L[0].replace(/\s*,\s*/g,",").split(/[\s;]+/);
const dc=s=>/^[-+]?\d+,\d+$/.test(s)?s.replace(",","."):s;
const rows=L.map(l=>{let a;if(l.includes("\t"))a=l.split("\t").map(s=>dc(s.trim()));else if(l.includes(";"))a=l.split(";").map(s=>dc(s.trim()));else{const w=l.split(/\s+/);if(w.length>=2&&w.length<=3&&w.every(s=>/^[-+]?\d+,\d+$/.test(s)&&(s.split(",")[1].length<=8))&&!l.includes(", "))a=w.map(dc);else if(l.includes(","))a=l.split(",").map(s=>s.trim());else a=w}return a.filter((s,i,r)=>s!==""||i<r.length-1)});
let hdr=null;if(rows.length&&rows[0].some(s=>s!==""&&!NUMRE.test(s))&&rows.length>1&&rows[1].some(s=>NUMRE.test(s)))hdr=rows.shift().map(s=>s.toLowerCase().replace(/[^a-z]/g,""));
let ix=-1,iy=-1,named=null;if(hdr){const xi=hdr.findIndex(h=>/^(x|e|east|easting|lon|lng|long|longitude)$/.test(h)),yi=hdr.findIndex(h=>/^(y|n|north|northing|lat|latitude)$/.test(h));if(xi>=0&&yi>=0&&xi!=yi){ix=xi;iy=yi;named={lat0:/^lat/.test(hdr[xi]),lon:/^(lon|lng|long)/.test(hdr[xi])||/^(lon|lng|long)/.test(hdr[yi]),lat:/^lat/.test(hdr[yi])||/^lat/.test(hdr[xi])}}}
const nums=rows.map(r=>r.map(s=>NUMRE.test(s)?+s:NaN));
if(ix<0){const r0=nums.find(r=>r.filter(isFinite).length>=2)||[];let idx=r0.map((v,i)=>isFinite(v)?i:-1).filter(i=>i>=0);
if(idx.length>=3&&idx[0]==0){const c0=nums.map(r=>r[0]).filter(isFinite);if(c0.length>2&&c0.every((v,i)=>Number.isInteger(v)&&(i==0||v==c0[i-1]+1||v==c0[i-1])))idx=idx.slice(1)}ix=idx[0];iy=idx[1]}
const ring=[];if(ix>=0&&iy>=0)nums.forEach(r=>{if(isFinite(r[ix])&&isFinite(r[iy]))ring.push([r[ix],r[iy]])});
let deg=false,swap=false;if(ring.length){const A=ring.map(p=>Math.abs(p[0])),B=ring.map(p=>Math.abs(p[1])),mA=Math.max(...A),mB=Math.max(...B);
if(named&&named.lon&&named.lat&&mA<=360&&mB<=360){deg=true;swap=named.lat0}else if(mA<=180&&mB<=90){deg=true;swap=mA<=90&&mB<=90?($("xord").value=="yx"):false}else if(mA<=90&&mB<=180){deg=true;swap=true}}
return{ring,deg,swap}}
