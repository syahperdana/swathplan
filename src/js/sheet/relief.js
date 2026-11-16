/* ===== relief on the map sheet and in the map exports: the shaded depth grid (or, for a drone, the terrain), a colour scale and contours ===== */
// A layer: c (canvas, one pixel per cell, north up), a0/a1 lat and o0/o1 lon of its edges, Z (values, NaN = none, row 0 north), W×H, zmin/zmax, kind
// ("depth": blue, light = shallow; "elev": green to brown to white, light = high). Pixel centres are at o0 + (x + ½)·(o1 − o0)/W.
let REL_LAST=null;// the last relief drawn on a sheet (for the legend and the tests)
const relUav=()=>typeof MODE=="function"&&MODE().uav;
const relDepthCol=k=>hsl2rgb(215,75,Math.max(18,Math.min(90,82-k*55)));
const REL_ELEV=[[0,[96,150,92]],[.3,[196,201,128]],[.6,[178,138,90]],[.85,[140,108,84]],[1,[238,234,228]]];
function relElevCol(k){k=Math.max(0,Math.min(1,k));for(let i=1;i<REL_ELEV.length;i++){const[a,ca]=REL_ELEV[i-1],[b,cb]=REL_ELEV[i];if(k<=b){const t=(k-a)/(b-a||1);return ca.map((v,j)=>v+(cb[j]-v)*t)}}return REL_ELEV[REL_ELEV.length-1][1]}
// the drone terrain as a layer, with a hillshade (light from the north-west)
let TGS=null;
function tgShade(){if(typeof TG=="undefined"||!TG)return null;if(TGS&&TGS.T===TG)return TGS;const W=TG.nx,H=TG.ny,Z=new Float32Array(W*H);let lo=1e9,hi=-1e9;
for(let j=0;j<H;j++)for(let i=0;i<W;i++){const v=TG.z[(H-1-j)*W+i];Z[j*W+i]=v;if(isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v)}}
if(!(hi>=lo))return TGS={T:TG,c:null};const cv=document.createElement("canvas");cv.width=W;cv.height=H;const g=cv.getContext("2d"),im=g.createImageData(W,H),sp=(hi-lo)||1,
cs=TG.dla*111132.9,at=(x,y)=>{x=Math.max(0,Math.min(W-1,x));y=Math.max(0,Math.min(H-1,y));const v=Z[y*W+x];return isFinite(v)?v:null};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=Z[y*W+x];if(!isFinite(v))continue;const e=at(x+1,y),w=at(x-1,y),s=at(x,y+1),n=at(x,y-1),gx=e!=null&&w!=null?(e-w)/(2*cs):0,gy=n!=null&&s!=null?(n-s)/(2*cs):0,
sh=Math.max(-1,Math.min(1,(gy-gx)*1.5)),c=relElevCol((v-lo)/sp),p=(y*W+x)*4,f=1+sh*.28;im.data[p]=Math.min(255,c[0]*f);im.data[p+1]=Math.min(255,c[1]*f);im.data[p+2]=Math.min(255,c[2]*f);im.data[p+3]=235}
g.putImageData(im,0,0);return TGS={T:TG,c:cv,a0:TG.la0-TG.dla/2,a1:TG.la0+(H-.5)*TG.dla,o0:TG.lo0-TG.dlo/2,o1:TG.lo0+(W-.5)*TG.dlo,Z,W,H,zmin:lo,zmax:hi,kind:"elev"}}
// the layer for the sheet: the drone terrain in drone mode, otherwise the loaded depths
function relLayer(){if(relUav()){const t=tgShade();if(t&&t.c)return t}if(typeof bath!="undefined"&&bath&&bath.z&&bath.z.length&&typeof bathShade=="function"){const s=bathShade(1024);if(s&&s.c)return s}return null}
// contours: the grid averaged to at most 400 cells a side and smoothed, levels at a round interval chosen so that about
// one level per 25 mm of the map frame (4 to 10) spans the values inside the frame; marching squares, labels kept apart
function relContours(Ly,inFr,frmm){const f=Math.max(1,Math.ceil(Math.max(Ly.W,Ly.H)/400)),W=Math.ceil(Ly.W/f),H=Math.ceil(Ly.H/f),G=new Float32Array(W*H).fill(NaN);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0,n=0;for(let b=0;b<f;b++)for(let a=0;a<f;a++){const xx=x*f+a,yy=y*f+b;if(xx>=Ly.W||yy>=Ly.H)continue;const v=Ly.Z[yy*Ly.W+xx];if(isFinite(v)){s+=v;n++}}if(n)G[y*W+x]=s/n}
const S=G.slice();for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!isFinite(G[y*W+x]))continue;let s=0,n=0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const xx=x+a,yy=y+b;if(xx<0||yy<0||xx>=W||yy>=H)continue;const v=G[yy*W+xx];if(isFinite(v)){s+=v;n++}}S[y*W+x]=s/n}
const LO=x=>Ly.o0+(x+.5)*f*(Ly.o1-Ly.o0)/Ly.W,LA=y=>Ly.a1-(y+.5)*f*(Ly.a1-Ly.a0)/Ly.H;let lo=1e9,hi=-1e9;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=S[y*W+x];if(isFinite(v)&&inFr(LA(y),LO(x))){lo=Math.min(lo,v);hi=Math.max(hi,v)}}if(!(hi>lo))return null;
const nt=Math.max(4,Math.min(10,Math.round(frmm/25))),raw=(hi-lo)/nt,p10=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(m=>m*p10).find(v=>v>=raw*.999);
const lv=[];for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step)lv.push(+v.toFixed(6));const segs=lv.map(()=>[]);
for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){const a=S[y*W+x],b=S[y*W+x+1],c=S[(y+1)*W+x+1],d=S[(y+1)*W+x];if(!(isFinite(a)&&isFinite(b)&&isFinite(c)&&isFinite(d)))continue;
const mn=Math.min(a,b,c,d),mx=Math.max(a,b,c,d);lv.forEach((L,li)=>{if(L<mn||L>=mx)return;const P=[],e=(p,q,vp,vq,xp,yp,xq,yq)=>{if((vp<L)!=(vq<L)){const t=(L-vp)/(vq-vp);P.push([xp+(xq-xp)*t,yp+(yq-yp)*t])}};
e(0,1,a,b,x,y,x+1,y);e(1,2,b,c,x+1,y,x+1,y+1);e(2,3,c,d,x+1,y+1,x,y+1);e(3,0,d,a,x,y+1,x,y);for(let i=0;i+1<P.length;i+=2)segs[li].push([LA(P[i][1]),LO(P[i][0]),LA(P[i+1][1]),LO(P[i+1][0])])})}
return{step,lv,segs}}
const relFmt=(v,step)=>step<1?v.toFixed(step<.1?2:1):String(Math.round(v));
// draw the layer and its contours into the map frame (sheet units: mm); returns what the legend needs
function relDraw(c,P,fx,fy,fw,fh,op){const Ly=relLayer();if(!Ly)return null;const p=P(fromLL(Ly.a1,Ly.o0)),q=P(fromLL(Ly.a0,Ly.o1));c.save();c.imageSmoothingEnabled=true;c.drawImage(Ly.c,p[0],p[1],q[0]-p[0],q[1]-p[1]);c.restore();
let C=null;if(op.ctr!==false){const inFr=(la,lo)=>{const s=P(fromLL(la,lo));return s[0]>=fx&&s[0]<=fx+fw&&s[1]>=fy&&s[1]<=fy+fh};C=relContours(Ly,inFr,Math.min(fw,fh));
if(C){const dk=Ly.kind=="depth";C.segs.forEach((sg,li)=>{if(!sg.length)return;const idx=Math.round(C.lv[li]/C.step)%5==0;c.beginPath();sg.forEach(s=>{const a=P(fromLL(s[0],s[1])),b=P(fromLL(s[2],s[3]));c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])});
c.lineWidth=idx?.2:.11;c.strokeStyle=dk?"rgba(16,52,84,.55)":"rgba(80,52,30,.6)";c.stroke()});
// labels: at most 40, 25 mm from any other label and 45 mm from one of the same level
const put=[];c.font="1.7px "+FF;c.textAlign="center";c.textBaseline="middle";C.segs.forEach((sg,li)=>{const t=relFmt(C.lv[li],C.step),tw=c.measureText(t).width+.8;for(let i=0;i<sg.length&&put.length<40;i+=7){const s=sg[i],m=P(fromLL((s[0]+s[2])/2,(s[1]+s[3])/2));
if(m[0]<fx+4||m[0]>fx+fw-4||m[1]<fy+3||m[1]>fy+fh-3)continue;if(put.some(u=>Math.hypot(u[0]-m[0],u[1]-m[1])<(u[2]==li?45:25)))continue;put.push([m[0],m[1],li]);
c.fillStyle="rgba(255,255,255,.75)";c.fillRect(m[0]-tw/2,m[1]-1.1,tw,2.2);c.fillStyle=dk?"#103454":"#50341e";c.fillText(t,m[0],m[1])}});c.textAlign="left";c.textBaseline="alphabetic"}}
return{kind:Ly.kind,zmin:Ly.zmin,zmax:Ly.zmax,step:C?C.step:0}}
// legend: the colour scale with its range, and the contour interval (w: width of the legend column, sheet units)
function relLegend(c,RL,y,w,T){const dk=RL.kind=="depth";T(i18(dk?"Depth (m), light = shallow":"Ground elevation (m)"),0,y,2.2);y+=1.6;const n=32,bw=w-6;
for(let i=0;i<n;i++){const k=i/(n-1),col=dk?relDepthCol(k):relElevCol(k);c.fillStyle="rgb("+col.map(v=>Math.round(v)).join(",")+")";c.fillRect(i*bw/n,y,bw/n+.05,2.2)}c.strokeStyle="#5b6e75";c.lineWidth=.1;c.strokeRect(0,y,bw,2.2);
const fm=v=>Math.abs(v)>=100?v.toFixed(0):v.toFixed(1);T(fm(RL.zmin),0,y+5,1.9,0,"#5b6e75");T(fm((RL.zmin+RL.zmax)/2),bw/2,y+5,1.9,0,"#5b6e75","center");T(fm(RL.zmax),bw,y+5,1.9,0,"#5b6e75","right");y+=8.6;
if(RL.step){c.strokeStyle=dk?"rgba(16,52,84,.7)":"rgba(80,52,30,.75)";c.lineWidth=.2;c.beginPath();c.moveTo(0,y-.6);c.lineTo(8,y-.6);c.stroke();T(i18(dk?"Depth contours every {0} m":"Elevation contours every {0} m",relFmt(RL.step,RL.step)),10,y,2.2);y+=3.5}return y}
