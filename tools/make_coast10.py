"""Build data/coast10m.js from the Natural Earth 1:10m land polygons (public domain).

Usage: python3 -I tools/make_coast10.py ne_10m_land.geojson ne_10m_minor_islands.geojson [--note "version, commit"]

Land polygons, not the coastline lines: the 1:10m coastline runs in no consistent direction
and most continental coasts are open pieces, so the side of the land cannot be told from it.
A point inside a ring (even-odd, so holes work) is land, whatever the direction.

The GeoJSON files are in https://github.com/nvkelso/natural-earth-vector (folder geojson/).
Lines are lightly simplified (Douglas-Peucker, 0.0003 deg, about 33 m: Natural Earth 10m points
are already far apart) and stored as Google encoded polylines with precision 1e-4 deg (about 11 m),
one per line, space separated. The pages load the file only when it is needed (the built-in
coastline button, or the offline map background when zoomed in); the 1:50m set in the page is
the fallback.
"""
import json, sys, pathlib

args = [a for a in sys.argv[1:] if not a.startswith("--")]
note = sys.argv[sys.argv.index("--note") + 1] if "--note" in sys.argv else ""
if "--note" in sys.argv: args.remove(note)
TOL, Q = 0.0003, 1e4


def dp(P, t):
    if len(P) < 3: return P
    keep = [False] * len(P); keep[0] = keep[-1] = True; st = [(0, len(P) - 1)]
    while st:
        a, b = st.pop(); ax, ay = P[a]; bx, by = P[b]; dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy; best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = P[i]
            if L2 == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                u = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); d = (ax + u * dx - px) ** 2 + (ay + u * dy - py) ** 2
            if d > best: best, bi = d, i
        if best > t * t: keep[bi] = True; st += [(a, bi), (bi, b)]
    return [p for p, k in zip(P, keep) if k]


def enc(v):
    v = ~(v << 1) if v < 0 else v << 1; s = ""
    while v >= 0x20: s += chr((0x20 | (v & 0x1f)) + 63); v >>= 5
    return s + chr(v + 63)


def encode(P):  # lat, lon pairs, precision 1e-4
    s = ""; a0 = o0 = 0
    for lon, lat in P:
        a, o = round(lat * Q), round(lon * Q); s += enc(a - a0) + enc(o - o0); a0, o0 = a, o
    return s


lines = []
for f in args:
    for ft in json.load(open(f, encoding="utf-8"))["features"]:
        g = ft["geometry"]
        if not g: continue
        t, c = g["type"], g["coordinates"]
        lines += [c] if t == "LineString" else c if t in ("MultiLineString", "Polygon") else [r for poly in c for r in poly] if t == "MultiPolygon" else []
n0 = sum(map(len, lines))
simp = [s for s in (dp([tuple(p[:2]) for p in l], TOL) for l in lines) if len(s) >= 4]  # rings: at least a triangle, closed
data = " ".join(encode(s) for s in simp)
js = ("/* ===== offline world coastline, Natural Earth 1:10m land polygons with minor islands (public domain, naturalearthdata.com)"
      + (" " + note if note else "") + " ===== */\n"
      "// Built by tools/make_coast10.py: encoded rings (lat, lon x 1e4), one per land ring, space separated. Loaded on demand.\n"
      "window.COAST_NE10=" + json.dumps(data) + ";\n")
out = pathlib.Path(__file__).resolve().parent.parent / "data/coast10m.js"
out.parent.mkdir(exist_ok=True); out.write_text(js, encoding="utf-8")
print(out, f"{len(js)/1024:.0f} KB, {len(simp)} lines, {sum(map(len, simp))} points (from {n0})")
