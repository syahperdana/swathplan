function addModel(a){if(a.length<5||!a[0])return false;SENS.push([a[0],a[1]||"Other",a[2]||"n/a",a[3]||"n/a",+a[4]||65]);return true}
$("mBtn").onclick=()=>{if(addModel($("mAdd").value.split(",").map(x=>x.trim()))){buildSens(SENS.length-1);sel();$("mAdd").value=""}else alert(i18("Enter: Model, Maker, beams, frequency, max half-angle"))};
$("mF").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let n=0;r.result.split(/\r?\n/).forEach(l=>{if(addModel(l.split(",").map(x=>x.trim())))n++});buildSens(0);sel();alert(i18("{0} models imported.",n))};r.readAsText(f)};

