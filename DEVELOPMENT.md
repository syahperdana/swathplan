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

**Sheets per segment** (`js/sheet/segment-sheets.js`, on both pages): `sheetOps(op)` returns the map sheet options to render: just `op`, or, for a split corridor with `xpSegs` = `seg`, an overview plus one per segment with `ext` (the segment outline plus its own lines and turns, not the transit), `label` (drawn in the map frame) and `sheetNo` (in the title block). `sheetLayout` fits `ext` when given. `buildReport` adds a page per sheet; `xpImg` hands several sheets to `sheetsZip`. `xpSegW` is shown by a `gen` wrapper in `corridor/app.js`. The DXF (`dxfLayer`, `dxfViews` in `export-basic.js`) uses per-segment layers and a VIEW table only when there are two or more segments, so other DXF files are unchanged. Test: `python3 test/segment_sheets_check.py planner/index.html`.

**One file per segment** (`js/io/per-segment.js`, `xpSegs` = `file`): a capture-phase click listener catches the export buttons in `PS_BTNS` and runs each button's own handler once per segment instead. For each run `R.lines`, `R.turns` (transits dropped), `R.cross` (first segment holding the line's middle), `R.tl`, `poly` (the segment outline) and `CO.segs` (just that segment) are swapped, `stats()` is rerun so reports and sheets show that segment's figures, and `save()` is replaced to collect the files (`…_S01.ext`). Map sheets and the report also get an `_overview`. Everything is put back in a `finally`, then the files go into `…_per_segment.zip`. A new export works per segment as long as it reads `R`, `poly` and `SWP_SEGS` and writes through `save()`; add its button id to `PS_BTNS`.

Offsets are positive to starboard; lines are named by side and offset (`RL_C`, `RL_P050`, `RL_S050`), sailed port to starboard with alternating direction. `engine.js` is pure geometry and has its own tests.

### Equipment lists

- Side-scan models are `<optgroup>`s in `parts/sec2-geophys.html` (`gSM`), one `<option data-f data-r>` per frequency with its longest range per side. They must be in the page, not added by script: `initApp()` restores the saved state before `js/geophys/app.js` runs. The groups carry `data-i18n="off"`; `sssFill()` labels the options in the current language. Choosing one sets `gSR`; `sssNote()` warns when `gSR` is beyond it. `geoSensorRow` names the model.
- Single-beam transducers: `sbM` in `parts/sec2-sbes.html`, value = beam width; typing a beam width switches it to custom.
- Drone cameras: `UV_CAM` (see below).

To add a model, add an option with its published figures. Values are approximate and labelled so.

### Drone mode

The section is `parts/sec2-uav.html` (camera preset `uvCam`, sensor `uvSW`/`uvSH`, focal `uvF`, image width `uvIW`, shortest interval `uvMI`, height `uvH`, overlaps `uvFO`/`uvSO`, battery `uvBat`/`uvSwap`). While the drone is chosen, `applyMode` hides the vessel sections (turn, IHO, coastline, bathymetry, profile) and the SVP inputs, and moves the speed input into the drone section; a comment node marks where it goes back. The drone and the vessel keep separate speeds (`uvV`, `spdV`, swapped in `setMode`). `js/uav/app.js` wraps, each falling through when `MODE().uav` is off:

- `params()`: `S` = across-track footprint × (1 − side overlap), `W` the footprint, `Rr` = S/2 (tight turns).
- `gen()`: lines are not trimmed to water.
- `stats()` and `summary()`: run with no turn slow-down, and with battery changes standing in for SVP casts (`uvWith`); the plan checks become height (120 m warning), photo interval against the camera, and GSD.
- Exports read `window.SWP_UAV` (`{h, trig, v, wp}`): QGroundControl gets the height on every waypoint and `MAV_CMD_DO_SET_CAM_TRIGG_DIST` (206) on after the first waypoint and off at the end; Mission Planner the same. With `trig` 0 (LiDAR) no 206 commands are written.
- **LiDAR payload** (`#uvPay` = `lidar`; presets `UV_LID` = [FOV across °, single-return point rate pts/s, range at 10 % m]; inputs `uvLid`, `uvLF`, `uvLR`, `uvLX`, side overlap `uvLSO`, target density `uvLT`): `uvGeo()` returns `uvLGeo()` (swath 2H·tan(FOV/2), `S` = swath × (1 − overlap), density P/(v·swath) per pass and ÷(1 − overlap)), with `lidar:true`, `dPh` 0. Elements with class `uv-cam` / `uv-lid` inside `#uvBox` are shown by `uvPayShow()`. The plan checks become height, slant range at the swath edge against the detection range, and density against the target (with the highest speed that meets it).

- **Relief on the map sheet** (`js/sheet/relief.js`, after `map-sheet.js` in both tools): `relLayer()` is the drone terrain (`tgShade()`, from `TG`, hypsometric colours and a hillshade) in drone mode, otherwise `bathShade(1024)` from `js/map/offline-maps.js` (the map's shaded depth grid, now also returning `Z`, `W`, `H`). `drawMapContent` calls `relDraw` when `xpSnd` is on and `sbS` (shaded background) is on or the drone is chosen. Otherwise the old dots are drawn. `relContours` averages the grid to ≤ 400 cells a side, smooths it, picks a round interval giving 4–10 levels (about one per 25 mm of frame) over the values inside the frame, and runs marching squares; labels are at most 40, 25 mm apart (45 mm on one level). `xpCtr` turns contours off. `relLegend` draws the colour scale and the interval; `H.l` grows to fit. `SvgCtx.drawImage` embeds a canvas as a PNG data URL. `REL_LAST` holds the last relief drawn (tests). In drone mode `SWP_UAVSHEET` makes the sheet show the flight height and drop turn radius and IHO order; `uvTM` draws the terrain on the map (a `drawBath` wrapper in `uav/terrain.js`). Test: `test/relief_check.py`. Use `arrMin(a)` / `arrMax(a)` (in `core/coords.js`) for arrays that can be long: `Math.min(...a)` overflows the call stack past about 100,000 values (it broke the map sheet for plans with thousands of lines).
- **Global bathymetry** (`js/io/bathy-global.js`, `#gbB`): `gbNear(m)` tests whether a lon/lat box comes within m metres of `poly` (centre inside, or an edge crossing the box). `gbPieces` splits the box into pieces of `cells` × `cells` at resolution r that pass the test, at most 40 (r × 1.4 until they fit). GMRT and EMODnet fetch each piece (two at a time) and add it to one set with `gridToBath(G, conv, src, B, cap)`; `parseASC` marks a cut-off file `short` and leaves the missing cells NaN, and such pieces are counted and reported with a link, not read. NCEI samples `gbPts` (points near the area, at most 12,000, 250 per request, three at a time). The header shows `Height:` (`#hDh`) instead of `Depth:` (`#hDd`) in drone mode. Test: `test/gbath_pieces_check.py` (services mocked).
- **Terrain following** (`js/uav/terrain.js`, included after `js/uav/app.js`; inputs `uvTF` on/off, `uvTS` source, `uvTD` waypoint spacing, `uvTO` take-off ground elevation, `uvTB`/`uvTFile` load; results `uvTG`, `uvTA`, `uvTW`, profile `uvTP`): `TG` is a regular lat/lon grid of ground elevations (NaN = none), sampled bilinearly by `tgZ(la,lo)` / `tgAt(p)`. It is built by `tgNodes` over `tgBox()` (lines, turns, area plus half a swath) and filled by `tgBin` from SRTM 30 m (`tgTiles`: AWS Terrain Tiles, terrarium PNGs decoded on a canvas, at most 36 tiles at zoom ≤ 13, sampled bilinearly; Open Topo Data's public API sends no CORS header, so browsers cannot use it), the NCEI mosaic (`getSamples`, 250 points) or a file (`parseTIFF`/`parseASC` from `io/bathy-global.js`, projected grids through `mkConv`). `tgSet` turns `uvTF` on. `tgPlan()` (cached on `R`, `R.lines`, `TG` and the inputs) builds the waypoints as `wpts()` does, densified every `uvTD` m. Each waypoint gets H + max ground on its two legs − z₀. A waypoint is dropped when the leg from the last kept one to the next passes it between 0.5 m below and 2 m above. It returns the kept indices `K`, heights `AI`, the height-above-ground and ground ranges along the lines, and the profile of the line over the most relief. `uvMission().wp` = `tgWp()` ([lat, lon, height above take-off] per kept waypoint) when terrain following is on; `export-basic.js` uses `SWP_UAV.wp` in place of `wpts()` and the constant height when it is present. `stats()` and `summary()` wraps fall through when `tgPlan()` is null (no drone mode, no terrain or no lines). The terrain grid is not saved in the state or `.SPL`. Test: `test/terrain_check.py`.

Camera presets in `UV_CAM` are approximate values.

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
- **Natural Earth 1:10m** (`data/coast10m.js`, 1.8 MB, built by `tools/make_coast10.py` from `ne_10m_land.geojson` and `ne_10m_minor_islands.geojson` in nvkelso/natural-earth-vector): land *polygons*, because the 1:10m coastline lines run in no consistent direction and most continental coasts are open pieces. Kept out of the pages so they stay small; `neLoad10()` adds it with a script tag (works from disk too) and the offline app caches it (in `STATIC` in `tools/build.mjs`). The map background switches to it when the view is under 8° tall; *Use built-in coastline* clips each ring to the area box (Sutherland-Hodgman) and loads it in polygon mode, a point inside a ring being land (even-odd). Without the file (a page saved on its own) both fall back to the 1:50m set in the page and say so.
- **Coastline offline** (`js/map/coast-keep.js`, on both pages): *Use built-in coastline* cuts the Natural Earth lines to the area (10 km margin) and loads them for land avoidance. With the 1:50m fallback: Natural Earth stores some closed rings clockwise (Australia, for example), so closed rings are turned counter-clockwise first, giving land on the left as in OSM; the open lines already are. Every load goes through `setCst`, which this file wraps to note that the coastline is kept. `offline-maps.js` keeps it between sessions in IndexedDB; *Remove coastline* and opening a project update that copy too. `.SPL` files carry it in a `[COASTLINE]` section (`kind`, `note`, then `p <encoded polyline>` lines, 1e-5 deg); a parsed file always has `st.coast`, null when it has none, so opening a project replaces the coastline. The autosave and share links do not carry it. Test: `python3 test/coast_check.py planner/index.html infill/index.html`.
- **Turns against the coastline** (`js/map/turn-land.js`, after `coast-keep.js` on both pages): `tlCheck()` fills `TL_BAD` with the indices of `R.turns` whose pieces cross a `cst.seg` segment, come within `g("clr")` of one (segment-to-segment distance), or whose middle point `isLand`. A grid of the segments (cells of max(200 m, 4 × clearance)) is cached per `cst.seg`. The `summary` wrapper puts one ok or bad line at the top of `#chk` (skipped for drones and without a coastline); the `render` wrapper draws flagged turns in red. Tested in `coast_check.py`.
- **Contour-following lines** (`js/mbes/contour-lines.js`, survey planner only, after `turn-land.js` so the corridor, geophysical, single-beam and drone wrappers of `gen` sit outside it): with `#ctr` ticked, an area plan and bathymetry loaded, the straight plan is made first (for the cross lines), then replaced. `ctrTrace` samples `depthAt` on a grid (`ctrGrid`, about 300 cells across) and traces the isobath with marching squares (`ctrMS`); the longest piece inside the area is smoothed, simplified and extended (`CG.extend`). `ctrField` holds the signed distance to it; the lines are its level sets at k·S (no loops, never crossing), cut by `ctrClip`/`ctrKeeper` to the area and water. Lines carry `p`, `off` and `row`; `R.ctr` marks the plan, `ctrTurns` builds the turns, and the geophysical wrapper uses it for run-in/run-out. `#ctrBox` is `hidden` in the HTML and shown by this file, so the infill page (same part) does not offer it. Test: `python3 test/contour_check.py planner/index.html infill/index.html`.
- **Multibeam catalogue** (`js/mbes/catalogues.js` `SENS`): `[name, maker, beams, frequency, max half-angle, source]`. The sixth field is only present for models checked against the maker's datasheet; `sSrcShow()` in `controls.js` shows it under the sensor values, or a not-yet-checked note. Entries are selected by index (saved in `#sens`), so add new models at the end of their maker's group only if you accept that saved indices shift, or at the very end. The science page table of checked models is generated from these fields by hand: update it with the catalogue.
- **Map source label** (`#mapSrc`): online map, saved tiles offline, your map file, plus bathymetry.
- Offline maps need the website or installed app (service worker and Cache API); the downloaded single file shows a note instead.

## Languages

- `i18(s, ...args)` translates. **The English string is the key**, with `{0}` placeholders.
- Static HTML text is translated by matching its English text. Put `data-i18n="off"` on elements that must not be translated.
- To add a string: add the English text to `src/lang/en.json` and the translations to each `src/lang/<code>.json`. A missing translation falls back to English, and the build lists what is missing.
- **Changing the English wording of a string changes its key.** Update the key in every language file too, or the translations are lost (the build reports these as "no longer exists").
- Translations of newer strings need native review. Hindi, Urdu, Russian, Korean, Tagalog, Vietnamese, Turkish, Polish, Thai and Malay are the least certain.

## Versions and releases

The version lives in one place, `src/version.json` (`"version": "1.1.0"`). The build replaces `__SWP_VERSION__` everywhere in the pages and scripts with it, shortened to `1.1` when the patch number is 0. It appears in the page footers (linked to the GitHub releases page), the About text in the planners, the map sheet, the PDF and HTML reports (and the PDF metadata), the `# Saved … with SwathPlan 1.1` comment line of .SPL files, and on the covers and running headers of the PDF guides (`tools/make_docs_pdf.py` reads the same file). Write the token, never a literal version number. Test: `python3 -I test/version_check.py`.

To release: raise the version in `src/version.json` (minor for features, patch for fixes only), add a section to `CHANGELOG.md`, run the build and `tools/make_docs_pdf.py`, and deploy to `main` as usual. Then fast-forward `beta` to `main` (the deploy merge commit) and create the GitHub release on `main` with tag `vX.Y.Z` and the changelog section as its notes. Tags and releases have to be made by the owner on GitHub; this sandbox cannot create them.

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

Equipment lists: `python3 test/equipment_check.py planner/index.html`.

Drone mode: `python3 test/uav_check.py planner/index.html` (GSD, spacing, photo distance, warnings, waypoint exports with height and camera trigger; LiDAR swath, density, range and density checks, no trigger, presets, reload; switching back).

Terrain following: `python3 -I test/terrain_check.py planner/index.html` (a synthetic hill: never below the flight height, waypoints dropped on even ground, QGroundControl and Mission Planner heights, flat ground gives the plain waypoints, fixed-height warnings, take-off elevation, LiDAR, an ESRI ASCII file, multibeam mode unaffected).

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

## Loaded depths (XYZ)

- `js/io/xyz.js` reads an XYZ file as a stream (`File.stream()` + `TextDecoderStream`), pausing every 2 MB so the page repaints and shows progress; pasted text is read in one go. `loadXYZ` is `async` (the infill planner awaits it).
- Projected coordinates go to lat/lon through a lattice of at most 257 × 257 exact conversions and bilinear interpolation (well under a millimetre off); geographic or small files are converted point by point.
- `bath` holds typed arrays (`la`, `lo`: Float64Array; `z`: Float32Array), plus `res` (point spacing in metres, the 25th percentile of neighbouring gaps). The global-bathymetry loaders still use plain arrays: code reading `bath` must only index and use `.length`.
- `analyse()` uses `polyTester(poly)` (edges bucketed in horizontal strips) and a 4096-step histogram for the percentiles, so a few million points take a fraction of a second. `sdp` carries min, p5, median, mean, max, σ, count and a 12-bin histogram (used by the PDF report).
- `bathShade(N)` builds the shaded image once per size and colour scale (`BSC` cache): at the data spacing when `bath.res` is known (up to 4096 px a side and 12 Mpx), otherwise at most 512 px. `palCol(k)` gives the colour of the chosen scale (`#bPal`: rainbow, blues, viridis, ocean, grey); the sheet relief uses it too.
- Adaptive spacing (`js/mbes/adaptive-spacing.js`) spaces each pair of neighbouring lines for a quantile of the overlap slack along the line, not its minimum: `#adpTol` (default 10 %) is the share of each line's length (its shallowest part) that may get less than the coverage target; 0 % is the old strict rule. The stretches that fall short are kept in `ADP_SHORT` (positions in the line frame, area) and drawn by `drawShort()` (layer `#lyShort`); the plan checks give their share of the area. It also ignores model depths shallower than `#adpMin` (default 2 m); `depthRaw` returns the unclamped depth, `depthAt` keeps the old clamp at 0.5 m for other users. `buildDG` sums into typed arrays.
- The adaptive algorithm is `adaptCore(o)` in `js/mbes/adaptive-spacing.js`, working in a frame of positions q across the lines and t along them (`prof(q)` gives the samples, `raw(q,t)` the model depth). `linePositions` uses it for areas (straight frame); `coAdaptOffs` in `js/corridor/app.js` uses it for each corridor segment (q = offset, t = chainage), so every segment gets the offsets its own depths allow (mirrored outwards from the centre line when that is on). `adpOn()` decides where it applies (areas, corridors in swath-width mode, geophysical spreads with the multibeam ticked); `adpCap()` limits the spacing to the closest of the other geophysical sensors. `ADP_SHORT` holds the short-coverage stretches as plan polygons.
- Infill best fit (`#ifMode` = fit, default): each gap's cells are fitted with a principal axis; a gap much wider across it than it is thick (curved, L-shaped) is split at the middle of its length and refitted (up to 6 levels), and each part gets lines along its own axis, as many as its width needs. Margin strips keep their edge direction; `one` puts every gap at the line direction as before. Test: `python3 -I test/adaptive_modes_check.py`. With loaded depths each gap part is spaced from its own depths (`ifLocS`: the `adpTol` quantile of the depths deeper than `xyzWetLim()`); an inner gap whose known depths are all shallower than that limit is left without lines and counted in `IF.dry` (status message).
- Drying ground in XYZ: `analyse()` in `js/io/xyz.js` also keeps `sdp.wet` (statistics of depths ≥ `xyzWetLim()`, which follows `#adpMin`, at least 0.5 m); the Apply shallowest / 5th percentile / mean buttons use it, so data reaching above the datum no longer gives a negative design depth. A design depth of 0 m or less gives no lines in any tool (`gen` in `plan.js` and the corridor `gen`, a wrapper at the end of `js/infill/app.js`), and the plan checks and infill status say so. Tests: `test/bathy_load_check.py`, `test/adaptive_modes_check.py`.
- Auto optimal (`js/mbes/auto-azimuth.js`): with adaptive spacing it minimises the survey time (`adpCost`: line length plus turns, from `linePositions(…, fast)` with a coarser profile and fewer bisection steps), searching in 10° then 2° and 1° steps with pauses; with uniform spacing it still minimises the number of lines. `contourAz()` fits a plane to the depth model and gives the contour direction for the plan check that warns when lines cross the contours.
- Seabed coverage: the user sets `#cov` (slider, 100–500 %) or `#covN` (100–1000 %); they write the hidden input `#ov` (overlap %, = 100 × (1 − 100 / coverage)), which stays the internal value used everywhere (and in saved projects, so old .SPL files keep working). `covOf`, `covF`, `covS` in `js/mbes/plan.js` convert and format; reports, the sheet, the plan checks and the tender list show coverage. Tender scenarios saved with an overlap (< 100) are converted on load. `#covX` gives the swaths per point; `hudZ()` in `js/map/interaction.js` adds the depth (or drone terrain height) under the pointer from the shaded grid.
- Map layers: `lyOn(id)` in `js/map/render.js`; the checkboxes live in `#leg` (`parts/map-results.html`). `lyBath` mirrors `#sb`. `clearBath()` removes the depths (and their saved copy).
- Test: `python3 -I test/bathy_load_check.py planner/index.html` (a 480 000-point 1 m grid with a drying third).

## User guide and science pages

`src/pages/guide.html` → `guide/index.html` and `src/pages/science.html` → `science/index.html` are documentation pages in the style of the home page (`css/hub.css` + `css/docs.css`, script `js/docs/docs.js`). The page frame (header, contents, footer, marked `data-t`) is translated with the `subset` langpack; the article text is translated per language (below). The contents list is built from the article's `h2` and `h3`, and footnotes (`<sup class="fn"><a href="#r3">3</a></sup>`) get a link back from their reference.

- **Screenshots**: `docs/guide/*.jpg`, made from the built pages by `python3 -I tools/make_guide_shots.py` (offline, no basemap). Rerun it after a visible change to a section and look at the pictures. The build adds them to the offline cache.
- **Science page rule**: every statement taken from a standard, paper, dataset or datasheet carries a footnote to the original source; SwathPlan's own methods say so instead. When a formula changes in the code, change it on the page too. When an equipment value changes, change the table in section 14 and its source.
- The planner's *Guide & science* tab now holds two cards linking to these pages (with the live site as the target in a downloaded copy, like the tools menu).
- **Article translations**: `src/docs/<page>/<code>.json` maps each English leaf block of the article (heading, paragraph, list item, caption, table cell, note; footnotes written as `⟦3⟧`) to its translation. The build writes `<page>/lang/<code>.html` fragments, and `docs.js` swaps in the fragment for the chosen language; a block with no entry stays English, and the references list always does. After any change to an English block, run `python3 tools/docs_i18n.py check` (counts, stale keys, footnote order and tag mismatches) and `python3 tools/docs_i18n.py missing <page> <code>`, and update every language.
  - `python3 tools/docs_i18n.py list <page>` prints the English keys in order. A convenient way to translate is one block per line in that order (a line of `=` keeps the English), then `python3 tools/docs_zip.py <page> <code> <file>`, which checks the line count, the footnote order and the tags, and writes the JSON.
  - Use the planner's own label for every control the text names (from `src/lang/<code>.json`), so the guide matches the app.
- **PDFs**: `python3 -I tools/make_docs_pdf.py [codes…]` (Playwright Chromium) writes `docs/pdf/swathplan-<guide|science>-<code>.pdf` for every language, or the ones given: a cover, a printed contents list with page numbers (two passes), numbered sections, running header and page footer, right-to-left for Arabic and Urdu. The *Download PDF* link (`#pdfL`) follows the page language. Rebuild the PDFs after changing the articles or the screenshots, and look at a few pages (CJK, Arabic, Hindi, Thai).
- **Demo video**: `docs/demo.mp4`, recorded from the built pages by `python3 -I tools/make_demo.py` (offline, served locally; needs ffmpeg and pdftoppm). It opens with an animated title, then one captioned scene per feature. Rerun it after a visible change, and look at the result.
- Test: `python3 -I test/docs_check.py` (contents, links, images, footnotes both ways, translated frame, the planner's and home page's links).

**DXF layout** (`$("eDxf")` in `export-basic.js`): R12 (`$ACADVER` AC1009) with a HEADER, a TABLES section (LTYPE `CONTINUOUS`; a LAYER entry with an AutoCAD colour for every layer written, from `DXF_ACI`: boundary 7, segments 190, line 4, cross 30, turn 1, per-segment layers like their base layer; the segment VIEW entries) and the ENTITIES. The boundary and each segment border are closed POLYLINEs (VERTEX…SEQEND), so each is one object. Every turn or transit, and every bent (corridor) line, is one open POLYLINE; straight survey and cross lines are LINEs. A segment border runs along the corridor boundary on its long sides, so its colour is what tells it apart in CAD.
