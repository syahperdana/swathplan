$("auto").onclick=()=>{if(!closed)return;const S=params().S,ad=$("adp").checked&&bath,ev=a=>nLines(a,S),mx=179.999;
 let c=0,bn=1e9,pr=ad?5:1;for(let a=0;a<180;a+=pr){const n=ev(a);if(n<bn){bn=n;c=a}}
 (ad?[1,.1,.01,.001]:[.1,.01,.001]).forEach(st=>{const lo=Math.max(0,c-pr),hi=Math.min(mx,c+pr),K=Math.round((hi-lo)/st),cand=[];let m=1e9;
  for(let i=0;i<=K;i++){const a=+(lo+i*st).toFixed(3),n=ev(a);if(n<m){m=n;cand.length=0}if(n==m)cand.push(a)}
  c=cand[Math.floor((cand.length-1)/2)];pr=st});
 $("az").value=$("azN").value=c.toFixed(3);gen()};

