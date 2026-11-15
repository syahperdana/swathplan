# Developing SwathPlan

`index.html` at the repository root is the MBES planner. GitHub Pages serves it, and people can also download it and open it offline. `hub/index.html` is the tools hub and `sw.js` is the offline service worker. **All three are build outputs: do not edit them by hand.** Edit the files in `src/` and run the build.

## Quick start

```sh
node tools/build.mjs           # rebuild index.html from src/
node tools/build.mjs --check   # verify index.html matches src/ (also runs on every pull request)
```

Node 18 or newer is enough. No packages are installed.

## Layout

```
src/
  pages/mbes.html     the planner: HTML body plus the list of CSS/JS parts, in order
  pages/hub.html      the tools hub (built to hub/index.html)
  css/swathplan.css   planner styles
  css/hub.css         hub styles
  js/hub/hub.js       hub languages, install button, storage note
  pwa/sw.js           service worker template (built to sw.js)
  js/core/            language list, i18n engine, offline app (pwa.js), coordinates, datums, EPSG/proj4, CRS panel, app state and .SPL files, language packs
  js/map/             map canvas, basemap tiles, coastline, pan and zoom
  js/io/              imports (boundary, XYZ, grids) and exports (DXF, SHP, KML, RLN, Qinsy, GPX, CSV…)
  js/sheet/           map sheet, PDF writer, PDF report, image formats, projected grid
  js/mbes/            the MBES planner itself: catalogues, line generation, adaptive spacing, summary
  lang/en.json        the English strings (these are the translation keys)
  lang/<code>.json    one file per language: { "English text": "translation" }
  lang/_order.json    language order in the packed data
  lang/_keep-english.json  names and references that stay English on purpose
tools/build.mjs       the build
test/                 behaviour snapshot tests
manifest.webmanifest  app manifest (static, edit directly)
icons/                app icons (static)
```

### How the page is assembled

`src/pages/mbes.html` contains markers that the build replaces:

- `<!--@include js/core/coords.js-->` inserts that file byte for byte. When the marker ends a line, the line break is dropped, because the file brings its own.
- `<!--@langpack-->` inserts the language data built from `src/lang/`.
- `<!--@langpack subset-->` inserts only the strings that appear in that page (the hub uses this to stay small).

The JS parts are **slices of one script, in their original order**, and they still share one global scope. So:

- Keep the include order. A part may use functions and variables from parts above it at load time, and only call parts below it from event handlers or later code.
- Inside `initApp()` (in `js/core/app-state.js`), anything that uses `PACKS` or `setLang` must be deferred with `setTimeout`, because `js/core/lang-packs.js` runs after `initApp()`. Skipping this caused a real "Cannot access PACKS before initialization" error.
- Element ids are global. The build fails if the page has a duplicate id.

Some part names are approximate: for example `js/mbes/catalogues.js` also defines `$`, `D` and `NM`, which everything uses. The parts will be untangled into properly shared modules step by step, with the snapshot tests guarding each step.

## Offline app (PWA)

- `src/js/core/pwa.js` runs on both pages. On the website it registers `sw.js`, adds the manifest and icons, and shows a banner when the app is ready offline or a new version is waiting. On a downloaded copy (`file://`) it does nothing except point the hub links to the online hub.
- The build stamps `sw.js` with a version made from the pages, the manifest and the icons, so **every change to them reaches installed apps as an update**. A new version waits until the user taps *Update*; it never reloads the page by itself.
- The service worker answers app files from the cache of its own version, so the app opens offline and never mixes two versions. proj4 and EPSG definitions are kept in a separate runtime cache. Map tiles, bathymetry and place search go to the network.
- When you add a file the app needs offline, add it to `STATIC` in `tools/build.mjs`.
- The header has no spare room on phones: the grid icon (`#tabH`) shows above 700 px, and on phones the logo (`#logoHub`) is the link to the hub. Check header heights at 360–1400 px after any header change.

## Languages

- `i18(s, ...args)` translates. **The English string is the key**, with `{0}` placeholders.
- Static HTML text is translated by matching its English text. Put `data-i18n="off"` on elements that must not be translated.
- To add a string: add the English text to `src/lang/en.json` and the translations to each `src/lang/<code>.json`. A missing translation falls back to English, and the build lists what is missing.
- **Changing the English wording of a string changes its key.** Update the key in every language file too, or the translations are lost (the build reports these as "no longer exists").
- Translations of newer strings need native review. Hindi, Urdu, Russian, Korean, Tagalog, Vietnamese, Turkish, Polish, Thai and Malay are the least certain.

## Testing

The snapshot test drives the page in headless Chromium (Python Playwright) with a frozen clock and no network. It plans a fixed area and records every export, the page text in all 22 languages and three layouts.

```sh
python3 test/snapshot.py index.html /tmp/before     # before your change
# ...edit src/, run the build...
python3 test/snapshot.py index.html /tmp/after
python3 test/compare.py /tmp/before /tmp/after       # PASS, or a list of what changed
```

To test the offline app, serve the repository as `/swathplan/` over http (service workers do not run on `file://`), for example by copying it into `/tmp/site/swathplan/` and running `python3 -m http.server` in `/tmp/site`. In Chromium's DevTools, *Application → Service workers* has an *Offline* switch.

For a pure refactor, the comparison must pass. For a feature, read the list of differences and confirm each one is intended.

Also check by hand after any visible change: switch languages and look for missing strings; draw an area and change azimuth, cross lines and prefixes; export the sheet in UTM and in lat/lon; try a narrow phone viewport and a short desktop viewport.

## Notes on the code

- The map is a canvas (`#cv`) with raster tiles. The basemap needs internet and the page copes when tiles fail to load.
- Plan geometry uses a local frame in metres around the area origin `o`. `toLL` and `fromLL` convert between it and lat/lon.
- `utm(lat, lon, zone)` adds 1e7 to the northing in the southern hemisphere. `oc(p)` returns output coordinates following the export CRS select `#crs` (`geo`, `utm` or `epsg`).
- EPSG and custom CRS use proj4, loaded from the internet. The EPSG path has not been tested against the real library.
- Layout: header and footer are fixed, with heights in the CSS variables `--hh`, `--fh` and `--jh`, set by `setupLayout()`. Desktop is two panes at min-width 901px and min-height 520px; below that it stacks.

### Exports

- **EIVA RLN:** `"Line name"`, then `E,N,KP` rows with CRLF line endings. KP is cumulative kilometres to 8 decimals.
- **Qinsy `.qgfline`:** a binary chunk format reverse-engineered from one sample file. Tags are stored reversed; each chunk has a flags field (1 = group, 0 = leaf) and a size; coordinates are double triplets with a per-vertex distance attribute and the CRS as WKT. It writes WGS 84 UTM and straight lines only. A real Qinsy import has never been tested.
- **HYPACK LNX/LNW:** written from memory of the format. A test import is needed.
- **Map sheet:** one canvas drawing used for PNG, JPG and PDF. Its grid follows the export CRS (projected E/N, lat/lon, or both via `#xpGrid`). Sheet text is drawn at tiny sizes under a scale transform; `fixCtx` redraws it at real size to fix letter spacing.

## Known caveats

- Qinsy and HYPACK exports are unverified against the real software.
- Sonar catalogue values are approximate and compiled from public information.
- The EPSG path, Firefox and Safari have not been tested by the automated tests.
- SwathPlan is a planning aid. Results must be checked against equipment specifications, the current IHO S-44 and the client's requirements.
