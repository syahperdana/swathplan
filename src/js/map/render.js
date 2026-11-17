// map layers the user can hide (the checkboxes in the map legend); a missing checkbox counts as shown
const lyOn=id=>{const e=document.getElementById(id);return !e||e.checked};
function fit(){const P=poly.length?poly:[[-1000,-1000],[1000,1000]],xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),w=cv.clientWidth,h=cv.clientHeight,dx=arrMax(xs)-arrMin(xs)||100,dy=arrMax(ys)-arrMin(ys)||100;
V.cx=(arrMax(xs)+arrMin(xs))/2;V.cy=(arrMax(ys)+arrMin(ys))/2;V.k=Math.min(w/dx,h/dy)*.8}
const cv=$("cv"),cx=cv.getContext("2d");
const sc=p=>[(p[0]-V.cx)*V.k+cv.width/2,cv.height/2-(p[1]-V.cy)*V.k],wc=(x,y)=>[(x-cv.width/2)/V.k+V.cx,(cv.height/2-y)/V.k+V.cy];
function render(){clampV();const r=DPR(),CW=Math.max(1,Math.round(cv.clientWidth*r)),CH=Math.max(1,Math.round(cv.clientHeight*r));if(cv.width!=CW||cv.height!=CH){cv.width=CW;cv.height=CH}
cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.fillStyle="#d4e6ec";cx.fillRect(0,0,cv.width,cv.height);drawTiles();
const r1=cv.width/r;let st=[1,2,5,10,20,50,100,200,500,1e3,2e3,5e3,1e4,2e4,5e4,1e5].find(s=>s*V.k*r>70)||1e5;
cx.strokeStyle=$("bm").value=="none"?"#b5ccd4":"#ffffff66";cx.lineWidth=1;cx.fillStyle="#58727b";cx.font=11*r+"px "+FF;const a=wc(0,cv.height),b=wc(cv.width,0);while(st<1e9&&Math.max(b[0]-a[0],b[1]-a[1])/st>300)st*=2;
for(let x=Math.ceil(a[0]/st)*st;x<b[0];x+=st){const s=sc([x,0])[0];cx.beginPath();cx.moveTo(s,0);cx.lineTo(s,cv.height);cx.stroke()}
for(let y=Math.ceil(a[1]/st)*st;y<b[1];y+=st){const s=sc([0,y])[1];cx.beginPath();cx.moveTo(0,s);cx.lineTo(cv.width,s);cx.stroke()}
cx.fillText(i18("grid {0} m",st),cv.width-80*r,cv.height-10*r);
const path=(P,cl)=>{cx.beginPath();P.forEach((p,i)=>{const s=sc(p);i?cx.lineTo(s[0],s[1]):cx.moveTo(s[0],s[1])});if(cl)cx.closePath()};
if(poly.length&&lyOn("lyBnd")){path(poly,closed);if(closed){cx.fillStyle="#ffffff40";cx.fill()}cx.strokeStyle="#12262d";cx.lineWidth=2*r;cx.setLineDash([8*r,4*r]);cx.stroke();cx.setLineDash([]);poly.forEach(p=>{const s=sc(p);cx.fillStyle="#12262d";cx.fillRect(s[0]-3*r,s[1]-3*r,6*r,6*r)})}
drawBath();if(lyOn("lyCoast"))drawCoast();cx.lineWidth=1.6*r;cx.strokeStyle="#b0237a";if(lyOn("lyTurns"))R.turns.forEach(t=>{path(t.pts);cx.stroke()});
cx.strokeStyle="#d98a00";if(lyOn("lyCross"))R.cross.forEach(l=>{path(LP(l));cx.stroke()});
cx.strokeStyle="#0b6f6a";cx.lineWidth=2*r;if(lyOn("lyLines"))R.lines.forEach(l=>{path(LP(l));cx.stroke()});
}

