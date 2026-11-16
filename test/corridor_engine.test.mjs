// Unit tests for the corridor geometry (offsets, bends, KP, names). Run: node test/corridor_engine.test.mjs
import { readFileSync } from "node:fs";
const CG = new Function(readFileSync(new URL("../src/js/corridor/engine.js", import.meta.url),"utf8")+";return CG;")();
const ok=(c,m)=>console.log((c?"ok  ":"FAIL")+" "+m);
const plen=P=>{let s=0;for(let i=1;i<P.length;i++)s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return s};
// straight route: offsets are parallel, same length
let R=[[0,0],[1000,0]];
let o=CG.offset(R,50);ok(Math.abs(o[0][1]+50)<1e-9&&Math.abs(plen(o)-1000)<1e-9,"straight: +50 is 50 m starboard (south of eastbound), same length");
// right-angle bend (east then north = left turn): starboard side is outer -> round join; port side inner
R=[[0,0],[1000,0],[1000,1000]];
const so=CG.offset(R,100),po=CG.offset(R,-100);
const distToRoute=p=>{let m=1e9;for(let i=1;i<R.length;i++){const a=R[i-1],b=R[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));m=Math.min(m,Math.hypot(a[0]+dx*t-p[0],a[1]+dy*t-p[1]))}return m};
ok(so.every(p=>Math.abs(distToRoute(p)-100)<0.5),"outer offset stays 100 m from route everywhere ("+so.length+" pts)");
ok(po.every(p=>Math.abs(distToRoute(p)-100)<0.5),"inner offset stays 100 m from route ("+po.length+" pts)");
ok(Math.abs(plen(po)-(900+900))<1e-6,"inner corner length 1800 m: got "+plen(po).toFixed(3));
ok(Math.abs(plen(so)-(1000+1000+Math.PI/2*100))<0.5,"outer corner length 2000+arc: got "+plen(so).toFixed(2));
// hairpin: inner offset larger than the turn -> loop removed, no self crossing
R=[[0,0],[1000,0],[1000,60],[0,60]];
const hp=CG.offset(R,-80);let selfx=0;for(let i=0;i<hp.length-1;i++)for(let j=i+2;j<hp.length-1;j++){const a=hp[i],b=hp[i+1],c=hp[j],d=hp[j+1];const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)continue;const q=[c[0]-a[0],c[1]-a[1]],t=(q[0]*s[1]-q[1]*s[0])/den,u=(q[0]*r[1]-q[1]*r[0])/den;if(t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9)selfx++}
ok(selfx==0,"hairpin inner offset has no self-crossing ("+hp.length+" pts)");
// zigzag with many short segments
R=[];for(let i=0;i<200;i++)R.push([i*20,(i%2)*8]);const zz=CG.offset(R,40);ok(zz.length>2&&zz.every(p=>isFinite(p[0]+p[1])),"zigzag offset finite");
// offsets parsing and swath coverage
ok(JSON.stringify(CG.parseOffsets("0, ±25, -50 50"))=="[-50,-25,0,25,50]","parse offsets");
const sw=CG.swathOffsets(100,60,45,true);ok(JSON.stringify(sw)=="[-90,-45,0,45,90]","swath offsets with centre "+JSON.stringify(sw));
ok(Math.max(...sw)+30>=100,"outer swath reaches corridor edge");
const sw2=CG.swathOffsets(100,60,45,false);ok(Math.max(...sw2)+30>=100&&!sw2.includes(0),"swath offsets without centre "+JSON.stringify(sw2));
ok(CG.offName("RL_",-25)=="RL_P025"&&CG.offName("RL_",0)=="RL_C"&&CG.offName("RL_",12.5)=="RL_S012.5","names");
// chainage and point at
R=[[0,0],[300,400],[300,1000]];const C=CG.chain(R);ok(C[2]==1100,"chainage 1100");const a=CG.at(R,C,600);ok(Math.abs(a.p[0]-300)<1e-9&&Math.abs(a.p[1]-500)<1e-9&&Math.abs(a.u[1]-1)<1e-9,"point at 600 m");
// outline polygon closes around route
const ol=CG.outline([[0,0],[1000,0],[1000,1000]],100);ok(ol.length>6,"outline "+ol.length+" pts");
const ex=CG.extend([[0,0],[100,0]],50);ok(ex[0][0]==-50&&ex[1][0]==150,"extension");
// route segments: every 20 km with 100 m overlap; a 45 km route gives 3 segments
let sg=CG.segments(45000,20000,100);ok(sg.length==3&&sg[0].a==0&&sg[0].b==20050&&sg[1].a==19950&&sg[1].b==40050&&sg[2].a==39950&&sg[2].b==45000,"segments 0–20.05, 19.95–40.05, 39.95–45 km");
ok(CG.segments(15000,20000,100).length==1&&CG.segments(15000,0,100).length==1,"short route or 0 km: one segment");
// cutting a bent route by chainage keeps the vertices in between and ends at the exact points
R=[[0,0],[300,400],[300,1000]];const Cs=CG.chain(R),sp=CG.subpath(R,Cs,250,800);
ok(sp.length==3&&Math.abs(sp[0][0]-150)<1e-9&&Math.abs(sp[0][1]-200)<1e-9&&sp[1][0]==300&&sp[1][1]==400&&Math.abs(sp[2][1]-700)<1e-9&&Math.abs(plen(sp)-550)<1e-9,"subpath 250–800 m: 550 m through the bend");
