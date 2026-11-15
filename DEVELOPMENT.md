# Developing SwathPlan

`index.html` at the repository root is the tools hub (the home page), `mbes/index.html` the MBES planner, `corridor/index.html` the corridor planner, `geophys/index.html` the geophysical planner, `hub/index.html` a redirect for old links and `sw.js` the offline service worker. GitHub Pages serves them, and each planner can also be downloaded as one file and opened offline. **All of them are build outputs: do not edit them by hand.** Edit the files in `src/` and run the build.

## Quick start

```sh
node tools/build.mjs           # rebuild the pages from src/
node tools/build.mjs --check   # verify the pages match src/ (also runs on every pull request)
```

Node 18 or newer is enough. No packages are installed.

## Layout

```
src/
  pages/mbes.html     the MBES planner (built to mbes/index.html): list of HTML parts and CSS/JS parts, in order
  pages/corridor.html the corridor planner (built to corridor/index.html)
  pages/geophys.html  the geophysical planner (built to geophys/index.html)
  pages/hub.html      the tools hub, the home page (built to index.html)
  pages/hub-redirect.html  old hub/ address, sends visitors to the home page
  parts/              HTML pieces shared by the planner pages: header, each settings section,
                      map and results, guide, footer (sec3-corridor.html is corridor only)
  css/swathplan.css   planner styles
  css/hub.css         hub styles
  js/hub/hub.js       hub languages, install button, storage note
  pwa/sw.js           service worker template (built to sw.js)
  js/core/            language list, i18n engine, offline app (pwa.js), coordinates, datums, EPSG/proj4, CRS panel, app state and .SPL files, language packs
  js/map/             map canvas, basemap tiles, coastline, pan and zoom, PMTiles reader, offline maps
  js/io/              imports (boundary, XYZ, grids) and exports (DXF, SHP, KML, RLN, Qinsy, GPX, CSV…)
  js/sheet/           map sheet, PDF writer, PDF report, image formats, projected grid
  js/mbes/            the MBES planner itself: catalogues, line generation, adaptive spacing, summary
  js/geophys/         pre.js (labels and settings), app.js (sensor spacing, run-in, tie lines, checks)
  js/corridor/        pre.js (labels and settings applied first), engine.js (offset geometry, KP), app.js
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

## The corridor planner

`corridor/index.html` is the MBES planner with three changes, so it gets every shared feature (map, offline maps, coordinate systems, coastline, bathymetry, IHO checks, turns, cost, exports, sheet, report, languages):

- **Section 3** is `parts/sec3-corridor.html`. The MBES section 3 and the boundary import (section 9) are still in the page, hidden, because the shared code expects their controls.
- **`js/corridor/pre.js` runs first** and sets per-tool values that the shared code reads: `SWP_STATE_KEY` (own autosave key and saved data), `SWP_TITLE`, `SWP_NEED`, `SWP_SHEET_TITLE`, `SWP_BOUND`, `SWP_BOUND_PDF`, `SWP_REPORT_SUB`, `SWP_AZROW`. It also renames a few labels (Draw route, Finish route).
- **`js/corridor/app.js` runs after the planner has started** and replaces `gen()` (corridor lines, turns, cross lines at KP, outline as `poly`), rewires the drawing buttons and the area presets, adds route import, the KP table and route RLN, draws the route and KP labels, and adds the route to autosave and `.SPL` files (a `[ROUTE]` section).

Offsets are positive to starboard of the route direction. Lines are named by side and offset (`RL_C`, `RL_P050`, `RL_S050`), sailed from port to starboard with alternating direction. `engine.js` is pure geometry and has its own tests.

## The geophysical planner

`geophys/index.html` is the MBES area planner with section 2 replaced by `parts/sec2-geophys.html` (sensor calculator), which includes the multibeam swath block inside it (parts can include parts). `js/geophys/app.js` wraps:

- `params()`: `S` and `W` come from the ticked sensors (the smallest spacing wins); the multibeam values stay in `mbS`/`mbW`, and `geo` holds the per-sensor rows and the driver.
  - Side-scan: `S = 2R / (coverage/100) × (1 − margin)`; max speed from ping rate `c/2R`, target length and pings on target. Coverage under 200 % is flagged (nadir gap).
  - Magnetometer: `S = 2·√(D² − h²)` (D detection distance, h sensor height); sample spacing at survey speed.
  - Sub-bottom and UHR seismic: grid spacing; seismic lines are extended by half the streamer at each end (full fold).
- `gen()`: run-in (towed layback + seismic + extra) and run-out applied to the lines, turns redone, tie lines by spacing.
- `summary()`: sensor checks added to the plan checks. `stats()`: the multibeam block keeps showing multibeam values.
- Map sheet rows through `SWP_SENSORROW` and `SWP_SWATHROW`.

Test: `python3 test/geophys_check.py geophys/index.html`.

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
python3 test/snapshot.py mbes/index.html /tmp/before     # before your change
# ...edit src/, run the build...
python3 test/snapshot.py mbes/index.html /tmp/after
python3 test/compare.py /tmp/before /tmp/after       # PASS, or a list of what changed
```

Corridor planner: `node test/corridor_engine.test.mjs` (geometry) and `python3 test/corridor_check.py corridor/index.html mbes/index.html` (route import, layouts, every export, `.SPL` round trip, separate autosave).

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
