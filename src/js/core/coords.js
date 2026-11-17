// min / max of an array of any length (Math.min(...a) overflows the call stack past about 100,000 values)
function arrMin(a){let m=Infinity;for(let i=0;i<a.length;i++){const v=a[i];if(v<m||v!==v)m=v;if(m!==m)return m}return m}
function arrMax(a){let m=-Infinity;for(let i=0;i<a.length;i++){const v=a[i];if(v>m||v!==v)m=v;if(m!==m)return m}return m}
function toLL(p){const la=o.lat+p[1]/111132.9;return[la,o.lon+p[0]/(111320*Math.cos(o.lat*D))]}
function fromLL(la,lo){return[(lo-o.lon)*111320*Math.cos(o.lat*D),(la-o.lat)*111132.9]}
function utm(lat,lon,z){const a=6378137,f=1/298.257223563,k0=.9996,e2=f*(2-f),ep=e2/(1-e2),p=lat*D,l0=((z-1)*6-177)*D,s=Math.sin(p),c=Math.cos(p),t=Math.tan(p),N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep*c*c,A=c*(lon*D-l0),e4=e2*e2,e6=e4*e2;
const M=a*((1-e2/4-3*e4/64-5*e6/256)*p-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*p)+(15*e4/256+45*e6/1024)*Math.sin(4*p)-35*e6/3072*Math.sin(6*p));
const x=k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120)+5e5,y=k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720));return[x,lat<0?y+1e7:y]}
function oc(p){const[la,lo]=toLL(p);if($("crs").value=="epsg"&&window.proj4&&crsDef)return proj4("EPSG:4326",crsDef,[lo,la]).map(v=>+v.toFixed(3));return $("crs").value=="utm"?utm(la,lo,Math.floor((o.lon+180)/6)+1).map(v=>+v.toFixed(2)):[+lo.toFixed(7),+la.toFixed(7)]}
