#!/usr/bin/env node
// SwathPlan build: assembles each page in src/pages/ into one self-contained HTML file.
// Plain Node (18+), no packages needed.
//
//   node tools/build.mjs           build all pages
//   node tools/build.mjs --check   build in memory and fail if the committed output differs
//
// Template markers (in src/pages/*.html):
//   <!--@include path-->   replaced by the file src/path, byte for byte. When the marker ends
//                          a line, that line break is dropped (the included file brings its own).
//   <!--@langpack-->       replaced by the language data built from src/lang/.
//   <!--@langpack subset-->  the same, limited to English strings that appear in the page.
//
// It also writes sw.js (the offline service worker) from src/pwa/sw.js, stamped with a
// version made from the app files, so every change reaches installed apps as an update.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const CHECK = process.argv.includes("--check");

// page template -> output file (relative to the repo root)
// the hub is the home page; hub/ only redirects there (old links)
const PAGES = { "hub.html": "index.html", "planner.html": "planner/index.html", "infill.html": "infill/index.html", "mbes-redirect.html": "mbes/index.html", "corridor-redirect.html": "corridor/index.html", "geophys-redirect.html": "geophys/index.html", "hub-redirect.html": "hub/index.html", "guide.html": "guide/index.html", "science.html": "science/index.html" };
// files the offline app keeps (relative to the site root); the pages above are added first
// the guide screenshots (docs/guide/*.jpg, made by tools/make_guide_shots.py) are kept too
const SHOTS = readdirSync(join(ROOT, "docs/guide")).filter((f) => f.endsWith(".jpg")).sort().map((f) => "docs/guide/" + f);
const STATIC = ["data/coast10m.js", ...SHOTS, "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

const read = (p) => readFileSync(p, "utf8");
const problems = [], notes = [];

// ---- languages -------------------------------------------------------------------
// en.json is the master list of English strings (the keys). Every other language file
// maps English text -> translation. A missing entry falls back to English at run time.
function loadLangs() {
  const order = JSON.parse(read(join(SRC, "lang/_order.json")));
  const en = JSON.parse(read(join(SRC, "lang/en.json")));
  const enSet = new Set(en);
  // names, formats and references that stay in English on purpose: not reported as missing
  const keep = new Set(JSON.parse(read(join(SRC, "lang/_keep-english.json"))));
  if (enSet.size !== en.length) problems.push("lang/en.json has duplicate English strings");
  const files = readdirSync(join(SRC, "lang")).filter((f) => /^[a-z]{2,3}\.json$/.test(f)).map((f) => f.slice(0, -5));
  for (const c of files) if (!order.includes(c)) problems.push(`lang/${c}.json is not listed in lang/_order.json`);
  const tr = {};
  for (const c of order) {
    if (c === "en") continue;
    const t = (tr[c] = JSON.parse(read(join(SRC, `lang/${c}.json`))));
    const stale = Object.keys(t).filter((k) => !enSet.has(k));
    if (stale.length) notes.push(`${c}: ${stale.length} translation(s) for English text that no longer exists, e.g. "${stale[0].slice(0, 60)}"`);
    const missing = en.filter((k) => !(Object.prototype.hasOwnProperty.call(t, k) && t[k] !== "") && !keep.has(k));
    if (missing.length) notes.push(`${c}: ${missing.length} string(s) untranslated (English is shown), e.g. "${missing[0].replace(/<[^>]+>/g, "").slice(0, 60)}"`);
  }
  return { order, en, tr };
}

// Same layout as Python's json.dumps(ensure_ascii=False); "</" is escaped so the data
// can never close its <script> tag early.
function langpack(L, only) {
  const keys = only ? L.en.filter((k) => only.includes(k)) : L.en;
  const s = (v) => JSON.stringify(v);
  const arr = (c) => (c === "en" ? keys : keys.map((k) => (Object.prototype.hasOwnProperty.call(L.tr[c], k) ? L.tr[c][k] : "")));
  return ("{" + L.order.map((c) => s(c) + ": [" + arr(c).map(s).join(", ") + "]").join(", ") + "}").replace(/<\//g, "<\\/");
}

// ---- templates -----------------------------------------------------------------------
function buildPage(tplName, L) {
  let html = read(join(SRC, "pages", tplName));
  // parts may include other parts (up to 5 levels deep)
  for (let i = 0; i < 5 && /<!--@include /.test(html); i++)
    html = html.replace(/<!--@include ([^\s>]+)-->(\r?\n)?/g, (_, p) => read(join(SRC, p)));
  html = html.replace("<!--@langpack-->", () => langpack(L));
  html = html.replace("<!--@langpack subset-->", () => langpack(L, html));
  if (/<!--@(include|langpack)/.test(html)) problems.push(`${tplName}: unresolved marker`);
  // element ids are global in this code base: a duplicate silently breaks a control
  const ids = new Map();
  const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  for (const m of body.matchAll(/\sid="([^"]+)"/g)) ids.set(m[1], (ids.get(m[1]) || 0) + 1);
  const dup = [...ids].filter(([, n]) => n > 1).map(([k]) => k);
  if (dup.length) problems.push(`${tplName}: duplicate element id(s): ${dup.join(", ")}`);
  return html;
}

const L = loadLangs();
const outputs = Object.entries(PAGES).map(([tpl, out]) => [out, buildPage(tpl, L)]);
// ---- translated articles of the guide and the science page ------------------------------------
// src/docs/<page>/<code>.json maps each English leaf block (inner HTML, footnotes as ⟦n⟧) to its translation;
// the cutting rules match tools/docs_i18n.py. Written to <page>/lang/<code>.html (the article only); the page loads
// it when that language is chosen. The references list stays English. A block without a translation stays English.
const LEAF = /<(h[1-4]|p|li|figcaption|td|th|caption|dt|dd|div)\b([^>]*)>/g, BLOCKT = /<(p|li|ul|ol|div|table|h[1-4]|figure|pre|tr|td|th)\b/;
const FNR = /<sup class="fn"><a href="#r(\d+)">\1<\/a><\/sup>/g, normW = (x) => x.replace(/\s+/g, " ").trim();
const tokFn = (x) => normW(x).replace(FNR, "⟦$1⟧"), untokFn = (x) => x.replace(/⟦(\d+)⟧/g, '<sup class="fn"><a href="#r$1">$1</a></sup>');
function translateArticle(art, T) {
  const r = art.indexOf('<ol class="refs"'), head = r < 0 ? art : art.slice(0, r), tail = r < 0 ? "" : art.slice(r);
  let out = "", i = 0, n = 0, m; LEAF.lastIndex = 0;
  while ((m = LEAF.exec(head))) {
    const tag = m[1], e = head.indexOf("</" + tag + ">", LEAF.lastIndex);
    if (e < 0) continue;
    const inner = head.slice(LEAF.lastIndex, e);
    if (BLOCKT.test(inner) || m[2].includes("data-t")) continue;
    const t = T[tokFn(inner)];
    if (t !== undefined) { out += head.slice(i, LEAF.lastIndex) + untokFn(t); i = e; n++; }
    LEAF.lastIndex = e + tag.length + 3;
  }
  return [out + head.slice(i) + tail, n];
}
const DOCN = [];
for (const page of ["guide", "science"]) {
  DOCN.push(page + ":");
  const dir = join(SRC, "docs", page);
  let files = [];
  try { files = readdirSync(dir).filter((f) => /^[a-z]{2,3}\.json$/.test(f)); } catch {}
  const src = read(join(SRC, "pages", page + ".html")), a = src.indexOf(">", src.indexOf("<article")) + 1, b = src.indexOf("</article>"), art = src.slice(a, b);
  for (const f of files) {
    const [html, n] = translateArticle(art, JSON.parse(read(join(dir, f))));
    outputs.push([page + "/lang/" + f.replace(".json", ".html"), "<!-- generated by tools/build.mjs from src/docs/" + page + "/" + f + " -->\n" + html]);
    DOCN.push(f.slice(0, -5) +  + n);
  }
}
// service worker: precache the pages and static files, versioned by their content
const h = createHash("sha256");
for (const [, html] of outputs) h.update(html);
for (const f of STATIC) h.update(readFileSync(join(ROOT, f)));
const version = h.digest("hex").slice(0, 12);
const precache = Object.values(PAGES).map((o) => o.replace(/(^|\/)index\.html$/, "$1") || "./").concat(STATIC);
outputs.push(["sw.js", read(join(SRC, "pwa/sw.js")).replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(precache))]);

let changed = 0;
for (const [out, html] of outputs) {
  const target = join(ROOT, out);
  let old = null;
  try { old = read(target); } catch {}
  if (CHECK) {
    if (old !== html) { problems.push(`${out} is out of date: run node tools/build.mjs`); changed++; }
    else console.log(`ok       ${out} matches the sources`);
  } else if (old !== html) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, html); changed++;
    console.log(`built    ${out}  (${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB)`);
  } else console.log(`same     ${out}  (no change)`);
}
if (DOCN.length) console.log("\nTranslated blocks: " + DOCN.join(" "));
if (notes.length) console.log("\nTranslations:\n  " + notes.join("\n  "));
if (problems.length) { console.error("\nProblems:\n  " + problems.join("\n  ")); process.exit(1); }
