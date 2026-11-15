// ---- XYZ bathymetry
const ELL={wgs:[6378137,298.257223563,0,0,0],grs80:[6378137,298.257222101,0,0,0],tokyo:[6377397.155,299.1528128,-146.414,507.337,680.507],nad27:[6378206.4,294.9786982,-8,160,176],bessel:[6377397.155,299.1528128,0,0,0],clrk66:[6378206.4,294.9786982,0,0,0],intl:[6378388,297,0,0,0],krass:[6378245,298.3,0,0,0],airy:[6377563.396,299.3249646,0,0,0]};
const Mf=(p,a,e2)=>{const e4=e2*e2,e6=e4*e2;return a*((1-e2/4-3*e4/64-5*e6/256)*p-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*p)+(15*e4/256+45*e6/1024)*Math.sin(4*p)-35*e6/3072*Math.sin(6*p))};
function tmInv(E,N,P){const{a,f,l0,p0,k0,FE,FN}=P,e2=f*(2-f),ep=e2/(1-e2),mu=(Mf(p0,a,e2)+(N-FN)/k0)/(a*(1-e2/4-3*e2*e2/64-5*e2**3/256)),q=Math.sqrt(1-e2),e1=(1-q)/(1+q),
p1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu),
s=Math.sin(p1),c=Math.cos(p1),t=Math.tan(p1),C1=ep*c*c,T1=t*t,N1=a/Math.sqrt(1-e2*s*s),R1=a*(1-e2)/(1-e2*s*s)**1.5,d=(E-FE)/(N1*k0);
return[(p1-N1*t/R1*(d*d/2-(5+3*T1+10*C1-4*C1*C1-9*ep)*d**4/24+(61+90*T1+298*C1+45*T1*T1-252*ep-3*C1*C1)*d**6/720))/D,(l0+(d-(1+2*T1+C1)*d**3/6+(5-2*C1+28*T1-3*C1*C1+8*ep+24*T1*T1)*d**5/120)/c)/D]}
function toWGS(la,lo,[a,i,dx,dy,dz]){if(!dx&&!dy&&!dz&&Math.abs(a-6378137)<1)return[la,lo];const f=1/i,e2=f*(2-f),p=la*D,l=lo*D,sp=Math.sin(p),cp=Math.cos(p),sl=Math.sin(l),cl=Math.cos(l),w=1-e2*sp*sp,Rn=a/Math.sqrt(w),Rm=a*(1-e2)/w**1.5,da=6378137-a,df=1/298.257223563-f,b=a*(1-f);
return[la+(-dx*sp*cl-dy*sp*sl+dz*cp+da*Rn*e2*sp*cp/a+df*(Rm*a/b+Rn*b/a)*sp*cp)/Rm/D,lo+(-dx*sl+dy*cl)/(Rn*cp)/D]}
function crsP(dt){return{a:dt[0],f:1/dt[1],l0:g("tl0")*D,p0:g("tp0")*D,k0:g("tk"),FE:g("tfe"),FN:g("tfn")}}
function inPoly(p){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!=(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c}
