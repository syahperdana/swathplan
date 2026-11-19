# Changelog

SwathPlan versions follow [semantic versioning](https://semver.org/): a new feature raises the minor number (1.1 → 1.2), a fix alone raises the patch number (1.1 → 1.1.1). The version is shown in the footer of every page, on the PDF guides, map sheets and reports, and in saved .SPL files. Release notes are on the [GitHub releases page](https://github.com/syahperdana/swathplan/releases).

## 1.1.1 (2026-11-19)

### Fixes
- Corridor: drawing a route and pressing *Finish route* closed the route points into a polygon instead of making the corridor when the design depth was 0 m or less (multibeam and geophysical surveys). The corridor is now always built; only the lines that depend on the design depth wait for a valid one, and the plan checks say so. Drone surveys, geophysical spreads without the multibeam and corridors with fixed offsets no longer need the design depth at all (#56)

## 1.1 (2026-11-17)

Working properly with real survey data, thanks to user feedback.

### Bathymetry from XYZ
- Large files (a million points of a 1 m grid) load in a few seconds, read in steps so the page stays usable; grids down to 0.5 m are drawn cell by cell (#46)
- Depth legend with statistics inside the area, colour scales (rainbow, blues, viridis, ocean, grey) and the depth under the pointer (#46, #47)
- Map layer toggles, and buttons to remove the bathymetry or the survey border without resetting the project (#46)
- The design-depth buttons leave out drying ground, so data above the datum no longer gives a negative design depth (#51)

### Line spacing
- Seabed coverage (%) replaces lateral overlap: 100 % means the swaths just meet, 200 % that every point is seen twice (#48)
- Adaptive spacing: correct spacing with dense data, and an allowance for the shallowest share of each line; the stretches below target are shown in orange and reported in the plan checks (#46, #49)
- Coverage readout, plan checks for lines that cross the depth contours, and *Auto optimal* by survey time (#47)
- Adaptive spacing in corridors (per segment) and for the multibeam in geophysical surveys (#50)

### Infill planner
- Best-fit lines: each gap gets lines along its own axis and shape; curved and L-shaped gaps are split (#50)
- Each gap is spaced from its own depths; gaps on drying ground get no lines and are reported (#51)

### Fixes
- A design depth of 0 m or less gives no lines and a clear message (#51)

### Documentation
- User guide, science page and PDFs updated in all 22 languages (#52)
- The version is shown in the tools, PDFs, reports and project files

## 1.0

The first public release: the survey planner (multibeam, single-beam, geophysical and drone surveys over an area or along a corridor), the infill planner, and the user guide and science page in 22 languages.
