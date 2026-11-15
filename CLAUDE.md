# Notes for AI assistants working on this repo

Read `DEVELOPMENT.md` first. The essentials:

- `index.html` (hub, home page), `mbes/index.html`, `corridor/index.html`, `hub/index.html` (redirect) and `sw.js` are generated. Edit `src/`, then run `node tools/build.mjs`. Never edit them directly.
- The JS parts in `src/js/` are ordered slices of one global script. Keep the include order in `src/pages/mbes.html`.
- Inside `initApp()`, defer anything that uses `PACKS` or `setLang` with `setTimeout`.
- Both planners are built from the same parts (`src/parts/`, `src/js/`). A change there affects both: check the MBES snapshot and run the corridor tests.
- Tool-specific behaviour goes through `window.SWP_*` values (set in `js/corridor/pre.js`) or wrappers in `js/corridor/app.js`, never by forking shared files.
- Element ids are global; the build rejects duplicates.
- Header space is tight on phones: compare header heights at 360–1400 px before and after any header change.
- English strings are the translation keys. A new or reworded English string needs an entry in every `src/lang/<code>.json`.
- Before and after a change, run `test/snapshot.py` and `test/compare.py`. A refactor must compare as identical.
- Work on a branch and open a pull request. `main` is published live by GitHub Pages.
- Package installs and outside websites may be unavailable in the sandbox: basemap tiles, bathymetry services and proj4 cannot be tested there.
