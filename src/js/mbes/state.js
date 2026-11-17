let poly=[],closed=false,draw=true,o={lat:35,lon:127},V={cx:0,cy:0,k:.05},R={lines:[],turns:[],cross:[],tl:0},bath=null,sdp=null,cst={lines:[],polys:[],seg:null,mode:""};
const f1=(v,u="m",d=1)=>isFinite(v)?v.toFixed(d)+" "+u:"-",hm=h=>{let s=Math.round(h*3600);return Math.floor(s/3600)+"h "+String(Math.floor(s%3600/60)).padStart(2,"0")+"m"+(s%60?" "+String(s%60).padStart(2,"0")+"s":"")};
const g=i=>+$(i).value;
