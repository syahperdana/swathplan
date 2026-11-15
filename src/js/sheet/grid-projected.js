function utmInv(E,N,z,south){const a=6378137,f=1/298.257223563,k0=.9996,e2=f*(2-f),ep2=e2/(1-e2),x=E-5e5,y=south?N-1e7:N,M=y/k0,mu=M/(a*(1-e2/4-3*e2*e2/64-5*e2**3/256)),e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
const p1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
const s=Math.sin(p1),c=Math.cos(p1),t=Math.tan(p1),C1=ep2*c*c,T1=t*t,N1=a/Math.sqrt(1-e2*s*s),R1=a*(1-e2)/Math.pow(1-e2*s*s,1.5),d=x/(N1*k0);
const la=p1-(N1*t/R1)*(d*d/2-(5+3*T1+10*C1-4*C1*C1-9*ep2)*d**4/24+(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*d**6/720);
const lo=(d-(1+2*T1+C1)*d**3/6+(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*d**5/120)/c;
return[la/D,((z-1)*6-177)+lo/D]}
/* projected grid system for the sheet, or null when the export CRS is geographic */
function gridX(){const v=$("crs").value;
 if(v=="utm"){const z=Math.floor((o.lon+180)/6)+1,so=o.lat<0;return{tag:"UTM "+z+(so?"S":"N"),fwd:(la,lo)=>utm(la,lo,z),inv:(E,N)=>utmInv(E,N,z,so)}}
 if(v=="epsg"&&window.proj4&&crsDef){try{const p=proj4(crsDef);if(p.oProj&&p.oProj.projName=="longlat")return null;
  const t=($("epSt").textContent||"").split(" → ")[0].trim();
  return{tag:t||"Custom CRS",fwd:(la,lo)=>proj4("EPSG:4326",crsDef,[lo,la]),inv:(E,N)=>{const r=proj4(crsDef,"EPSG:4326",[E,N]);return[r[1],r[0]]}}}catch(e){}}
 return null}
function gridTag(){const X=gridX(),md=$("xpGrid").value;return!X||md=="geo"?"WGS 84 lat/lon":md=="both"?X.tag+" + lat/lon":X.tag}
function grat(L){const g0=gratG(L),X=gridX(),md=$("xpGrid").value;if(!X||md=="geo")return g0;
 const[fx,fy,fw,fh]=L.fr,hw=fw/2*L.mpm,hh=fh/2*L.mpm,x0=L.cx-hw,x1=L.cx+hw,y0=L.cy-hh,y1=L.cy+hh;
 let e0=1e99,e1=-1e99,n0=1e99,n1=-1e99;
 for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){const q=toLL([x0+(x1-x0)*i/8,y0+(y1-y0)*j/8]),r=X.fwd(q[0],q[1]);e0=Math.min(e0,r[0]);e1=Math.max(e1,r[0]);n0=Math.min(n0,r[1]);n1=Math.max(n1,r[1])}
 if(!isFinite(e0+e1+n0+n1))return g0;
 const span=Math.min(e1-e0,n1-n0),S=[1e6,5e5,2e5,1e5,5e4,2e4,1e4,5e3,2e3,1e3,500,200,100,50,20,10,5,2,1,.5,.2,.1],st=S.find(v=>span/v>=4)||S[S.length-1];
 const vals=(lo,hi)=>{const r=[];for(let v=Math.ceil(lo/st-1e-9)*st;v<=hi+1e-9;v+=st)r.push(+v.toFixed(6));return r};
 const toP=(E,N)=>{const q=X.inv(E,N);return fromLL(q[0],q[1])},NS=16;
 const eL=vals(e0,e1).map(E=>{const pts=[];for(let i=0;i<=NS;i++)pts.push(toP(E,n0+(n1-n0)*i/NS));return{v:E,pts}});
 const nL=vals(n0,n1).map(N=>{const pts=[];for(let i=0;i<=NS;i++)pts.push(toP(e0+(e1-e0)*i/NS,N));return{v:N,pts}});
 const hit=(pts,ax,val)=>{for(let i=0;i+1<pts.length;i++){const a=pts[i][ax],b=pts[i+1][ax];if(a!=b&&(a-val)*(b-val)<=0){const t=(val-a)/(b-a);return pts[i][1-ax]+(pts[i+1][1-ax]-pts[i][1-ax])*t}}return null};
 eL.forEach(l=>{l.top=hit(l.pts,1,y1);l.bot=hit(l.pts,1,y0)});nL.forEach(l=>{l.left=hit(l.pts,0,x0);l.right=hit(l.pts,0,x1)});
 return{proj:true,tag:X.tag,st,eL,nL,x0,x1,y0,y1,geo:md=="both"?g0:null}}
function gBands(G,band,fx,fy,fw,fh,bw){const asc=a=>a.sort((p,q)=>p-q),f=(k,e)=>asc(G[k].filter(l=>l[e]!=null).map(l=>l[e]));
 band(f("eL","top"),G.x0,G.x1,fy-bw,1);band(f("eL","bot"),G.x0,G.x1,fy+fh,1);band(f("nL","left"),G.y0,G.y1,fx-bw,0);band(f("nL","right"),G.y0,G.y1,fx+fw,0)}
function gFmt(v,st){return st<1?v.toFixed(st<.1?2:1):String(Math.round(v))}
function gLabels(c,G,X,Y,T,fx,fy,fw,fh,fs,bw){
 if(G.geo){const g=G.geo,fz=fs*.9,col="#8a3f00";
  g.lon.forEach(v=>{const x=X(fromLL(g.lat0,v)[0]);if(x<fx+8||x>fx+fw-8)return;const s=fdeg(v,0,g.st);T(s,x,fy+fz+.8,fz,0,col,"center");T(s,x,fy+fh-1.2,fz,0,col,"center")});
  g.lat.forEach(v=>{const y=Y(fromLL(v,o.lon)[1]);if(y<fy+8||y>fy+fh-8)return;const s=fdeg(v,1,g.st);c.save();c.translate(fx+fz+.8,y);c.rotate(-Math.PI/2);T(s,0,0,fz,0,col,"center");c.restore();c.save();c.translate(fx+fw-1.2,y);c.rotate(-Math.PI/2);T(s,0,0,fz,0,col,"center");c.restore()})}
 G.eL.forEach(l=>{const s=gFmt(l.v,G.st)+" E";if(l.top!=null){const x=X(l.top);if(x>=fx+3&&x<=fx+fw-3)T(s,x,fy-bw-1,fs,0,0,"center")}if(l.bot!=null){const x=X(l.bot);if(x>=fx+3&&x<=fx+fw-3)T(s,x,fy+fh+bw+fs+.6,fs,0,0,"center")}});
 G.nL.forEach(l=>{const s=gFmt(l.v,G.st)+" N";if(l.left!=null){const y=Y(l.left);if(y>=fy+3&&y<=fy+fh-3){c.save();c.translate(fx-bw-1,y);c.rotate(-Math.PI/2);T(s,0,0,fs,0,0,"center");c.restore()}}
  if(l.right!=null){const y=Y(l.right);if(y>=fy+3&&y<=fy+fh-3){c.save();c.translate(fx+fw+bw+fs+.6,y);c.rotate(-Math.PI/2);T(s,0,0,fs,0,0,"center");c.restore()}}})}
