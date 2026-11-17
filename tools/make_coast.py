"""Build src/js/map/coast-data.js from Natural Earth ne_50m_coastline.shp (public domain).

Usage: python3 -I tools/make_coast.py path/to/ne_50m_coastline.shp [tolerance_deg] [--stats]

Lines are simplified (Douglas-Peucker, tolerance in degrees), then stored as Google
encoded polylines (precision 1e-3 deg, about 110 m), one string per line separated by
spaces. The planner draws them as a light offline coastline under the map tiles.
"""
import struct, sys, json, pathlib

shp = pathlib.Path(sys.argv[1]); tol = float(sys.argv[2]) if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else 0.01
stats = "--stats" in sys.argv


def read_lines(path):
    b = path.read_bytes(); o = 100; out = []
    while o + 8 <= len(b):
        ln = struct.unpack(">i", b[o + 4:o + 8])[0] * 2; c = o + 8
        st = struct.unpack("<i", b[c:c + 4])[0]
        if st in (3, 13, 23):  # polyline (with Z/M variants: XY part is the same)
            nparts, npts = struct.unpack("<ii", b[c + 36:c + 44])
            parts = list(struct.unpack("<%di" % nparts, b[c + 44:c + 44 + 4 * nparts])) + [npts]
            p0 = c + 44 + 4 * nparts
            pts = [struct.unpack("<dd", b[p0 + 16 * i:p0 + 16 * i + 16]) for i in range(npts)]
            for k in range(nparts): out.append(pts[parts[k]:parts[k + 1]])
        o = c + ln
    return out


def dp(P, t):
    if len(P) < 3: return P
    keep = [False] * len(P); keep[0] = keep[-1] = True; stack = [(0, len(P) - 1)]
    while stack:
        a, b = stack.pop(); ax, ay = P[a]; bx, by = P[b]; dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = P[i]
            if L2 == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                u = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); d = (ax + u * dx - px) ** 2 + (ay + u * dy - py) ** 2
            if d > best: best, bi = d, i
        if best > t * t: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(P, keep) if k]


def enc(v):
    v = ~(v << 1) if v < 0 else v << 1; s = ""
    while v >= 0x20: s += chr((0x20 | (v & 0x1f)) + 63); v >>= 5
    return s + chr(v + 63)


def encode(P):  # lat, lon pairs, precision 1e-3
    s = ""; la0 = lo0 = 0
    for lon, lat in P:
        la, lo = round(lat * 1000), round(lon * 1000); s += enc(la - la0) + enc(lo - lo0); la0, lo0 = la, lo
    return s


lines = read_lines(shp); n0 = sum(len(l) for l in lines)
simp = [s for s in (dp(l, tol) for l in lines) if len(s) >= 2]
# drop tiny closed islets that shrink to a point at this tolerance
simp = [s for s in simp if not (len(s) <= 3 and abs(s[0][0] - s[-1][0]) + abs(s[0][1] - s[-1][1]) < tol)]
data = " ".join(encode(s) for s in simp); n1 = sum(len(s) for s in simp)
js = ("/* ===== offline world coastline: Natural Earth 1:50m (public domain), simplified ===== */\n"
      "// Built by tools/make_coast.py: encoded polylines (lat, lon x 1e3), one per line, space separated.\n"
      "const COAST_NE=" + json.dumps(data) + ";\n")
if stats:
    print(f"tol {tol}: {len(lines)} lines {n0} pts -> {len(simp)} lines {n1} pts, {len(js)/1024:.0f} KB")
else:
    out = pathlib.Path(__file__).resolve().parent.parent / "src/js/map/coast-data.js"
    out.write_text(js, encoding="utf-8"); print(out, f"{len(js)/1024:.0f} KB, {len(simp)} lines, {n1} points (from {n0})")
