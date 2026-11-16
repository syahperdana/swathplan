# Developing SwathPlan

`index.html` at the repository root is the tools hub (the home page), `planner/index.html` the survey planner (multibeam or geophysical, area or corridor), `infill/index.html` the infill planner, `mbes/`, `corridor/`, `geophys/` and `hub/` redirects for old links, and `sw.js` the offline service worker. GitHub Pages serves them, and each planner can also be downloaded as one file and opened offline. **All of them are build outputs: do not edit them by hand.** Edit the files in `src/` and run the build.

## Quick start

```sh
node tools/build.mjs           # rebuild the pages from src/
node tools/build.mjs --check   # verify the pages match src/ (also runs on every pull request)
```

Node 18 or newer is enough. No packages are installed.

## Layout

```
src/
  pages/planner.html  the survey planner (built to planner/index.html): list of HTML parts and CSS/JS parts, in order
  pages/*-redirect.html  old addresses (mbes/, corridor/, geophys/, hub/) that forward to the new pages
  pages/infill.html   the infill planner (built to infill/index.html)
  pages/hub.html      the tools hub, the home page (built to index.html)
  pages/hub-redirect.html  old hub/ address, sends visitors to the home page
  parts/              HTML pieces shared by the planner pages: header, each settings section,
                      map and results, guide, footer; sec0-setup.html is the survey type and shape
  css/swathplan.css   planner styles
  css/hub.css         hub styles
  js/hub/hub.js       hub languages, install button, storage note
  pwa/sw.js           service worker template (built to sw.js)
  js/core/            language list, i18n engine, offline app (pwa.js), coordinates, datums, EPSG/proj4, CRS panel, app state and .SPL files, language packs
  js/map/             map canvas, basemap tiles, coastline, pan and zoom, PMTiles reader, offline maps
  js/io/              imports (boundary, XYZ, grids) and exports (DXF, SHP, KML, RLN, Qinsy, GPX, CSV…)
  js/sheet/           map sheet, PDF writer, PDF report, image formats, projected grid
  js/mbes/            the MBES planner itself: catalogues, line generation, adaptive spacing, summary
  js/planner/         pre.js (MODE(), SWP_* values as getters), mode.js (shows what the survey needs, switches modes)
  js/geophys/         app.js: geophysical mode (sensor spacing, run-in, tie lines, checks)
  js/infill/          pre.js (labels and settings), app.js (tracks, coverage grid, gaps, infill lines)
  js/corridor/        engine.js (offset geometry, KP), app.js: corridor mode
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

## Lines with bends

A line is `{name, a, b}` (straight) or `{name, a, b, p:[points]}` when it follows a route. Read the points with `LP(l)` and the length with `L(l)`; every export, the map, the sheet and the report already do. A straight line gives exactly the same output as before.

## Uncertainty budget (all planners)

`parts/sec-tpu.html` and `js/mbes/tpu.js`: a simplified a priori TPU after Hare (1995). For each beam angle at the design depth it combines (RSS) range, angle (roll plus pointing), heave, water level, draft and sound speed into TVU, and positioning, heading, angle, pitch and sound speed into THU, then scales to 95 % (1.96σ vertical, 2.45σ horizontal) and compares with the IHO order (TVU `√(a² + (b·d)²)`, THU `a + b·d`). It finds the widest angle that meets both, can apply it to the swath angles, and adds a plan check (which also appears in the reports).

## Compare scenarios (all planners)

`parts/sec-tender.html` and `js/mbes/tender.js`. A scenario stores sensor, overlap, swath half-angle, speed, turn radius, day rate, hours per day and vessels (localStorage key `<SWP_STATE_KEY>_scen`). To compare, each scenario is written into the real inputs, `gen()` runs, the results are read from `SUM`/`R`, and the inputs are put back. Vessels divide the days; charged days are rounded up per vessel. The hub card opens `mbes/#tender`.

## Shared project (all planners and the hub)

`js/core/shared-project.js`, included right after `app-state.js`. Each planner keeps its own autosave; on top of that, a list of fields (`SH_F`: project details, sensor, depth, order, speed, turn radius, vessel length, CRS) plus `crsDef` and, in area planners, the closed survey area (WGS 84) are written to `swp_shared` whenever the planner saves and they differ. On load and when the tab becomes visible, a newer `swp_shared` written by another planner is applied (with a toast). `<SWP_STATE_KEY>_shseen` remembers the last version seen. `window.SWP_TOOL` names the planner (default "MBES line planner"); `window.SWP_SHARE_AREA=false` (corridor) shares the details but not the area. The checkbox `#shOn` (stored as `swp_share`, not in the autosave) turns sharing off. The hub shows the current project from `swp_shared`.

## The survey planner: one page, every kind of survey

`planner/index.html` holds every section. Two selects in the setup section choose the survey: `svT` (`mbes`, `sbes` or `geo`) and `svG` (`area` or `corr`). They are ordinary inputs, so they are autosaved and stored in `.SPL` files. `MODE()` (in `js/planner/pre.js`) returns `{geo, sbes, corr}` from them, and everything mode-specific asks it at call time.

- **`js/planner/pre.js`** runs first: `MODE()`, the autosave key `swp_state` (the old MBES key, so MBES sessions carry over) and the `SWP_*` values as getters that depend on the mode (sheet title, boundary label, report subtitle, map sheet rows).
- **`js/corridor/app.js`** and **`js/geophys/app.js`** wrap the shared functions as before, but each wrapper does nothing unless its mode is on (`if(!MODE().corr) return original()`). They combine: in a geophysical corridor, `params()` comes from the sensors and `gen()` from the corridor, and the geophysical run-in lengthens the first and last segment of every corridor line before the turns are redone (`coTurns`).
- **`js/planner/mode.js`** runs last. `applyMode()` hides the sections the survey does not need (geophysical sensors, multibeam sensor and swath, uncertainty budget, boundary import or route, line direction, adaptive spacing, tie line spacing) and re-points the drawing labels (`unitKey`). `setMode()` runs on a change of `svT`, `svG` or `gMB`: area → corridor makes a route from the area if there is none and keeps the area (`AREA_LL`, also autosaved); corridor → area brings the area back. `?type=…&shape=…` in the address sets the mode (the old pages use it).

**Section numbers** are not in the titles. Each section is `<details data-sec="name">`; `secNumber()` (in the i18n engine) numbers the visible top-level ones in order and puts the number in `summary[data-n]` (shown by CSS). Texts that point to a section write `section {§crs}`, `sections {§sensor} and {§swath}`, and so on; `i18()` and the page translation fill in the current number. Use a placeholder, never a number, in new strings.

### Corridor mode

The route section is `parts/sec3-corridor.html`. `gen()` makes the corridor lines, turns, cross lines at KP and the outline as `poly`; the drawing buttons and presets act on the route; route import, the KP table and route RLN; the route and KP labels on the map; the route in autosave and in `.SPL` files (`[ROUTE]`, corridor mode only). **Segments:** `CG.segments(L, coSeg km, coSegO m)` cuts long routes every `coSeg` km (default 20; 0 = never), adjacent segments overlapping by `coSegO` m (default 100, half added at each cut). Each segment gets `CG.subpath` of the route, its own offset lines (named `RL_01_S050`: prefix, segment, side and offset) and its own outline in `CO.segs`; between segments the vessel transits (`ty:"t"`). `SWP_SEGS` (corridor mode) gives the segment polygons with names and KP ranges to the DXF (layer `segments`, with labels), KML, GeoJSON, SHP (`segments`), the map sheet and the PDF report (a KP table). The DXF also carries the area or corridor boundary (layer `boundary`) in every mode.

Offsets are positive to starboard; lines are named by side and offset (`RL_C`, `RL_P050`, `RL_S050`), sailed port to starboard with alternating direction. `engine.js` is pure geometry and has its own tests.

### Single-beam mode

The section is `parts/sec2-sbes.html` (beam width, line spacing `sbSp`); the design depth input is moved into it while single beam is chosen (`applyMode`), and back. `js/sbes/app.js` wraps:

- `params()`: `S` is the line spacing, `W` the footprint `2·d·tan(beam/2)`.
- `summary()`: the multibeam checks (overlap, swath angle, ping rate, spacing cap) are removed and the S-44 rules for partial coverage added: Order 1a needs a feature search, Special and Exclusive need full coverage; spacing at most `max(3·depth, 25 m)`; coverage `(main + cross line length) × footprint / area` at least 5 %.
- Map sheet rows and the reports: `SWP_SENSORTXT` (sensor in words, also used for geophysical spreads) and `SWP_MBROWS` (false hides swath angles and overlap in both reports, and the PDF summary uses a sentence without them).

### Geophysical mode

The sensor section is `parts/sec2-geophys.html`; the multibeam sensor and swath sections show only when Multibeam is ticked in the spread. `js/geophys/app.js` wraps:

- `params()`: `S` and `W` come from the ticked sensors (the smallest spacing wins); the multibeam values stay in `mbS`/`mbW`, and `geo` holds the per-sensor rows and the driver.
  - Side-scan: `S = 2R / (coverage/100) × (1 − margin)`; max speed from ping rate `c/2R`, target length and pings on target. Coverage under 200 % is flagged (nadir gap).
  - Magnetometer: `S = 2·√(D² − h²)` (D detection distance, h sensor height); sample spacing at survey speed.
  - Sub-bottom and UHR seismic: grid spacing; seismic lines are extended by half the streamer at each end (full fold).
- `gen()`: run-in (towed layback + seismic + extra) and run-out applied to the lines, turns redone, tie lines by spacing (areas only).
- `summary()`: sensor checks added to the plan checks. `stats()`: the multibeam block keeps showing multibeam values.

**Compare scenarios** follows the survey type: multibeam scenarios vary sensor, overlap and swath angle; single-beam ones the line spacing; geophysical ones side-scan range and coverage; both vary speed, turn radius, day rate, hours and vessels. Each scenario remembers its type.

## The infill planner

`infill/index.html` starts with **Survey data** (`parts/sec0-infill.html`, select `ifK`: `mbes` or `sss`), then the coordinate system, the multibeam sensor and swath (multibeam only), **Coverage and gaps** (`parts/sec3-infill.html`), the boundary and the rest. Cross lines and auto direction are hidden; scenarios, the uncertainty budget, global bathymetry and the profile calculator sit in a hidden block. The XYZ section's controls are moved into the coverage section at start-up (`#ifXYZ`). Elements with class `if-mbes` / `if-sss` show for one kind of data (`ifApplyKind`).

Coverage sources, all combined on one grid (`cov`: 255 = covered, otherwise the number of side-scan tracks that saw the cell):

- **Processed grids and mosaics** (`js/infill/tiff-mask.js`, `readTiffMask`): classic TIFF, strips or tiles, 1–4 interleaved samples, 8/16/32-bit integer or float, no compression, LZW, Deflate or PackBits, predictor 1/2/3. The raster becomes a "has data" mask, reduced so it has at most 4 million cells (a mask cell has data when any pixel in its block has). No data: the GDAL_NODATA tag, transparency, common fill values, and for mosaics black (and optionally white) background. Masks are kept in IndexedDB (`<key>:grids`) with their affine, EPSG and kind (`grid` for multibeam, `mosaic` for side-scan); only those of the current kind count. Position: the file's own EPSG when it is 4326 or WGS 84 / UTM (326xx, 327xx), otherwise the coordinate system of the CRS section (`ifConv`); converted through a lattice every 8 mask cells and interpolated (`ifGridWorld`). Every grid cell holding a valid mask cell is covered; the auto grid cell is at least 1.05 × the mask cell.
- **XYZ soundings** (multibeam): cells with a sounding.
- **Track lines** (`IFT`, kept in IndexedDB under `<key>:tracks`; text, CSV, GPX, KML, SHP, DXF, GeoJSON): multibeam tracks fill quads with port/starboard widths from `depthAt` × tan(angle) or a fixed width. Side-scan tracks fill each side from the towfish height (nadir gap) to the range, and a cell's count goes up once per track (`stamp`).

A cell is covered when `cov ≥ need` (1, or 2 for 200 % side-scan). Gaps are uncovered cells inside the area, joined with 8 neighbours; small ones are dropped. Infill lines per gap at `ifSpacing()`: the multibeam spacing, or `2·range·(1 − margin)/(coverage/100)` for side-scan. The overlay shows covered (green), seen once at 200 % (yellow), planned gap (red) and ignored gap (orange). A 200 % side-scan job with only a mosaic gets a note: a mosaic cannot show double coverage.

Tests: `python3 test/infill_check.py infill/index.html` (tracks, XYZ, exports, restore) and `python3 test/infill_sources_check.py infill/index.html` (grid holiday, UTM mosaic with and without EPSG, side-scan 100 % and 200 %, kind switch).

## .SPL project files: compatibility rules

Every version must open every older `.SPL` file, and older versions should open newer files as far as they can.

- The format stays `SWATHPLAN-SPL 1`: sections in brackets, `key = value` lines. Readers skip sections and keys they do not know, so new settings and sections (`[ROUTE]`, survey type `svT`, and so on) are safe to add.
- Never rename or reuse a setting key. If one must change, add the old name to `SPL_ALIAS` in `app-state.js` so older files keep working.
- A file is opened on top of the page defaults (`UI_DEFAULTS`, taken at start-up): settings an older file does not mention come out at their default, not at whatever was on screen. So a multibeam file from before the survey type existed opens as a multibeam area survey.
- `test/fixtures/spl_v1_original.spl` was saved by the original single-file planner. `python3 test/spl_compat_check.py planner/index.html [old/index.html]` opens it in the current planner (from a different mode) and checks the plan is unchanged; with an old planner page it also opens a new file there. Add a fixture whenever the format gains something important.

## Offline app (PWA)

- `src/js/core/pwa.js` runs on both pages. On the website it registers `sw.js`, adds the manifest and icons, and shows a banner when the app is ready offline or a new version is waiting. On a downloaded copy (`file://`) it does nothing except point the hub links to the online hub.
- The build stamps `sw.js` with a version made from the pages, the manifest and the icons, so **every change to them reaches installed apps as an update**. A new version waits until the user taps *Update*; it never reloads the page by itself.
- The service worker answers app files from the cache of its own version, so the app opens offline and never mixes two versions. proj4 and EPSG definitions are kept in a separate runtime cache. Map tiles, bathymetry and place search go to the network.
- When you add a file the app needs offline, add it to `STATIC` in `tools/build.mjs`.
- The header has no spare room on phones: the grid icon (`#tabH`) shows above 700 px, and on phones the logo (`#logoHub`) is the link to the hub. Check header heights at 360–1400 px after any header change.

## Offline maps

All in `src/js/map/offline-maps.js` (with `pmtiles.js` and small hooks in `tiles.js`):

- **Tiles kept as you browse:** the service worker stores cross-origin tiles whose path ends in `z/x/y` (or Esri `/tile/z/y/x`) in the `swp-tiles` cache, cache-first, refreshed in the background after 30 days, at most 6,000 tiles (oldest dropped first). Only CORS answers are kept: opaque answers count as several MB each in browser quotas. The built-in providers load with CORS; a Custom tile URL loads without it, so for custom servers use *Save area*.
- **Save area:** for the Custom tile URL only, because the built-in servers (OpenStreetMap, Esri) do not allow bulk downloads. Limit 3,000 tiles per run, 4 requests at a time, written straight into `swp-tiles`.
- **Your map file (PMTiles v3, raster):** read in pieces with `Blob.slice`, never loaded whole. Kept in the Origin Private File System (`basemap.pmtiles`) where the browser allows `createWritable`; otherwise it lasts for the session. Vector PMTiles are refused with a message. `test/make_pmtiles.py` writes test files (`--leaves` for leaf directories).
- **Shaded bathymetry:** the loaded depth points are binned once into a small image (up to 512 px), gaps filled three cells deep, coloured by depth and lit from the north-west, then scaled on screen. *Shaded depth background* off brings back the dots.
- **Kept between sessions:** loaded bathymetry and coastline are stored in IndexedDB (`swathplan` / `kv`) and restored on start. A fresh start or *Reset* forgets them.
- **Built-in world coastline:** Natural Earth 1:50m coastline (public domain), simplified to about 1 km and stored as encoded polylines in `src/js/map/coast-data.js` (185 KB). It is drawn under the tiles, so it shows when there are no tiles (offline, basemap None, no map file). Rebuild it with `python3 tools/make_coast.py ne_50m_coastline.shp 0.01`. It hides when the view spans more than 70° of latitude, where the local map frame no longer fits.
- **Map source label** (`#mapSrc`): online map, saved tiles offline, your map file, plus bathymetry.
- Offline maps need the website or installed app (service worker and Cache API); the downloaded single file shows a note instead.

## Languages

- `i18(s, ...args)` translates. **The English string is the key**, with `{0}` placeholders.
- Static HTML text is translated by matching its English text. Put `data-i18n="off"` on elements that must not be translated.
- To add a string: add the English text to `src/lang/en.json` and the translations to each `src/lang/<code>.json`. A missing translation falls back to English, and the build lists what is missing.
- **Changing the English wording of a string changes its key.** Update the key in every language file too, or the translations are lost (the build reports these as "no longer exists").
- Translations of newer strings need native review. Hindi, Urdu, Russian, Korean, Tagalog, Vietnamese, Turkish, Polish, Thai and Malay are the least certain.

## Testing

The snapshot test drives the page in headless Chromium (Python Playwright) with a frozen clock and no network. It plans a fixed area and records every export, the page text in all 22 languages and three layouts.

```sh
python3 test/snapshot.py planner/index.html /tmp/before  # before your change
# ...edit src/, run the build...
python3 test/snapshot.py planner/index.html /tmp/after
python3 test/compare.py /tmp/before /tmp/after       # PASS, or a list of what changed
```

Infill planner: `python3 test/infill_check.py infill/index.html` (track import, gaps, infill lines, XYZ coverage, exports, restore) and `python3 test/infill_sources_check.py infill/index.html` (GeoTIFF grids and mosaics, side-scan coverage).

`.SPL` compatibility: `python3 test/spl_compat_check.py planner/index.html`.

The snapshot runs the planner in its default mode (multibeam, area), so its exports are those of the original MBES planner.

Corridor mode: `node test/corridor_engine.test.mjs` (geometry) and `python3 test/corridor_check.py planner/index.html` (route import, layouts, every export, `.SPL` round trip, switching to area and back).

Single-beam mode: `python3 test/sbes_check.py planner/index.html` (spacing and footprint, S-44 checks per order, sheet and report text, scenarios, corridor, switching back).

Geophysical mode: `python3 test/geophys_check.py planner/index.html` (sensor spacing, run-in, tie lines, exports, and a geophysical corridor).

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
