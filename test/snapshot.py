"""Behaviour snapshot for a SwathPlan build.

Loads a page in headless Chromium with a frozen clock, plans a fixed test
area, then records:
  - the visible text of the page in every language,
  - every export (all buttons, every "More formats" and map-image option),
    in the UTM and WGS84 coordinate modes and every sheet grid mode,
  - console errors and alert() messages,
  - screenshots at a phone, a short-desktop and a normal-desktop size.

Usage:  python3 -I test/snapshot.py PAGE.html OUTPUT_DIR
Compare two runs with:  python3 -I test/compare.py DIR_A DIR_B
"""
import sys, os, re, json, hashlib, pathlib, datetime
from playwright.sync_api import sync_playwright

page_path = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
(out / "exports").mkdir(exist_ok=True)
(out / "text").mkdir(exist_ok=True)
(out / "shots").mkdir(exist_ok=True)

FROZEN = datetime.datetime(2026, 1, 15, 3, 0, 0, tzinfo=datetime.timezone.utc)
log = {"errors": [], "dialogs": [], "exports": {}, "missing": []}


def sha(b):
    # PDF creation time depends on how long the run took; ignore that field only.
    b = re.sub(rb"/CreationDate \(D:\d+\)", b"/CreationDate (D:0)", b)
    return hashlib.sha256(b).hexdigest()


with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1400, "height": 900}, 
                         locale="en-US", timezone_id="UTC")
    # Block every outside request so runs are repeatable (tiles, geo-IP, proj4).
    ctx.route(lambda url: not url.startswith("file:") and not url.startswith("data:")
              and not url.startswith("blob:"), lambda r: r.abort())
    pg = ctx.new_page()
    pg.clock.install(time=FROZEN)
    pg.on("pageerror", lambda e: log["errors"].append(str(e)))
    pg.on("console", lambda m: m.type == "error" and log["errors"].append("console: " + m.text))

    def on_dialog(d):
        log["dialogs"].append(d.message)
        d.dismiss()
    pg.on("dialog", on_dialog)

    pg.add_init_script("""try{localStorage.clear()}catch(e){}
      window.__dl=[]; window.open=()=>null;
      const _ck=HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click=function(){ if(this.download&&this.href.startsWith('blob:')){
          const n=this.download; fetch(this.href).then(r=>r.arrayBuffer()).then(b=>{
            let s='';const u=new Uint8Array(b);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));
            window.__dl.push({n,b:btoa(s)})}); return; }
        return _ck.call(this) };""")
    pg.goto(page_path.as_uri())
    pg.clock.run_for(3000)
    pg.evaluate("setLang('en')")
    pg.clock.run_for(500)

    # ---- fixed test plan ----------------------------------------------------
    pg.evaluate("""() => {
      const s = $("pre2"); s.value = s.options[2].value; s.dispatchEvent(new Event("change"));
      const set = (id, v) => { const e = $(id); if (e.type == "checkbox") e.checked = v; else e.value = v;
                               e.dispatchEvent(new Event("input")); };
      set("depth", 18); set("ov", 25); set("R", 40); set("spd", 5);
      set("az", 33); set("azN", 33); set("cross", true); set("nx", 3);
      set("pre", "ML"); set("crossPre", "XL"); set("inclT", true);
      $("prjN") && set("prjN", "Snapshot test area");
    }""")
    pg.clock.run_for(1500)
    log["plan"] = pg.evaluate("({pre: $('pre2').value, lines: R.lines.length, cross: R.cross.length,"
                              " turns: R.turns.length, header: $('hT').textContent})")

    import base64
    def grab(tag, click_js):
        pg.evaluate("window.__dl=[]")
        pg.evaluate(click_js)
        got = []
        for _ in range(40):
            pg.clock.run_for(500)
            pg.wait_for_timeout(50)
            got = pg.evaluate("window.__dl")
            if got:
                pg.clock.run_for(1000); pg.wait_for_timeout(100)
                got = pg.evaluate("window.__dl"); break
        if not got:
            log["missing"].append(tag); return
        for d in got:
            data = base64.b64decode(d["b"]); name = f"{tag}__{d['n']}"
            (out / "exports" / name).write_bytes(data); log["exports"][name] = sha(data)

    buttons = ["eDxf", "eEiva", "eGj", "eKml", "eLnx", "eMp", "eQgc", "eQin", "eShp", "rep"]
    for crs in ["utm", "geo"]:
        pg.evaluate(f"$('crs').value='{crs}';$('crs').dispatchEvent(new Event('change'))")
        pg.clock.run_for(300)
        for b in buttons:
            grab(f"{crs}_{b}", f"$('{b}').click()")
        for v in pg.evaluate("[...$('xfmt').options].map(o=>o.value)"):
            grab(f"{crs}_xfmt-{v}", f"$('xfmt').value='{v}';$('xBtn').click()")
        for grid in pg.evaluate("[...$('xpGrid').options].map(o=>o.value)"):
            pg.evaluate(f"$('xpGrid').value='{grid}';$('xpDpi').value='150'")
            grab(f"{crs}_grid-{grid}_pdf", "$('xpPdf').click()")
            for v in pg.evaluate("[...$('xpFmt').options].map(o=>o.value)"):
                if grid != pg.evaluate("$('xpGrid').options[0].value") and v not in ("png", "svg", "pdf"):
                    continue  # all formats once; grid variants only for the main three
                grab(f"{crs}_grid-{grid}_img-{v}", f"$('xpFmt').value='{v}';$('xpImg').click()")

    # ---- every language -------------------------------------------------------
    codes = pg.evaluate("Object.keys(PACKS)")
    log["languages"] = codes
    for c in codes:
        pg.evaluate(f"setLang('{c}')")
        pg.clock.run_for(400)
        txt = pg.evaluate("(()=>{const t=document.getElementById('toast');if(t)t.remove();return document.body.innerText})()")
        (out / "text" / f"{c}.txt").write_text(txt, encoding="utf-8")
    pg.evaluate("setLang('en')")
    pg.clock.run_for(400)

    # ---- layouts ----------------------------------------------------------------
    for name, w, h in [("desktop", 1400, 900), ("short", 1280, 560), ("phone", 390, 844)]:
        pg.set_viewport_size({"width": w, "height": h})
        pg.clock.run_for(800)
        pg.screenshot(path=str(out / "shots" / f"{name}.png"))
        log.setdefault("layout", {})[name] = pg.evaluate(
            "['--hh','--fh','--jh'].map(v=>getComputedStyle(document.documentElement).getPropertyValue(v))")
    br.close()

(out / "log.json").write_text(json.dumps(log, indent=1, ensure_ascii=False), encoding="utf-8")
print(json.dumps({k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in log.items()}, indent=1))
