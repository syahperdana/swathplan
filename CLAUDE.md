# Notes for AI assistants working on this repo

Read `DEVELOPMENT.md` first. The essentials:

- `index.html` (hub, home page), `planner/index.html`, `infill/index.html`, `guide/index.html`, `science/index.html`, the redirects `mbes/`, `corridor/`, `geophys/`, `hub/` and `sw.js` are generated. Edit `src/`, then run `node tools/build.mjs`. Never edit them directly.
- The JS parts in `src/js/` are ordered slices of one global script. Keep the include order in `src/pages/planner.html`.
- Inside `initApp()`, defer anything that uses `PACKS` or `setLang` with `setTimeout`.
- All planners are built from the same parts (`src/parts/`, `src/js/`). A change there affects both: check the planner snapshot and run the corridor, geophysical and infill tests.
- Tool-specific behaviour goes through `window.SWP_*` values (set in each tool's `pre.js`) or wrappers in its `app.js`, never by forking shared files. In the survey planner, corridor and geophysical wrappers must check `MODE()` and fall through to the original when their mode is off.
- Never write a section number in a string: use `section {§name}` (the `data-sec` names). Sections are numbered at runtime in the order they are shown.
- Element ids are global; the build rejects duplicates.
- Header space is tight on phones: compare header heights at 360–1400 px before and after any header change.
- English strings are the translation keys. A new or reworded English string needs an entry in every `src/lang/<code>.json`.
- Before and after a change, run `test/snapshot.py` and `test/compare.py`. A refactor must compare as identical.
- Work on a branch and open a pull request into `beta`. `beta` is published at syahperdana.github.io/swathplan-beta (pushed to the `swathplan-beta` repository); `main` is the live site and only changes when the owner decides.
- Package installs and outside websites may be unavailable in the sandbox: basemap tiles, bathymetry services and proj4 cannot be tested there.
