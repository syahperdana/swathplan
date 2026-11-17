const ORDN=["Exclusive Order","Special Order","Order 1a","Order 1b","Order 2"],ordN=i=>i18(ORDN[i]);
function buildOrd(){const c=$("ord").value;$("ord").innerHTML="";ORDN.forEach((s,i)=>$("ord").add(new Option(i18(s),i)));if(c!=="")$("ord").value=c}


