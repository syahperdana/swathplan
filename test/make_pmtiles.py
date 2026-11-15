"""Write a small raster PMTiles v3 file for testing the reader.

Each tile is a PNG showing its z/x/y. Usage:
  python3 test/make_pmtiles.py OUT.pmtiles [--maxzoom 4] [--leaves] [--jpeg]
--leaves puts every entry in leaf directories (as large real files do).
"""
import sys, io, gzip, json, struct, argparse
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("--maxzoom", type=int, default=4)
ap.add_argument("--leaves", action="store_true"); ap.add_argument("--jpeg", action="store_true")
a = ap.parse_args()


def tile_id(z, x, y):
    acc = sum(4 ** t for t in range(z)); n = 2 ** z; d = 0; s = n // 2
    while s >= 1:
        rx = 1 if x & s else 0; ry = 1 if y & s else 0
        d += s * s * ((3 * rx) ^ ry)
        if ry == 0:
            if rx == 1: x, y = n - 1 - x, n - 1 - y
            x, y = y, x
        s //= 2
    return acc + d


def varint(v):
    out = bytearray()
    while True:
        b = v & 127; v >>= 7
        out.append(b | (128 if v else 0))
        if not v: return bytes(out)


def directory(entries):  # entries: (id, offset, length, run)
    b = bytearray(varint(len(entries))); last = 0
    for e in entries: b += varint(e[0] - last); last = e[0]
    for e in entries: b += varint(e[3])
    for e in entries: b += varint(e[2])
    for i, e in enumerate(entries):
        b += varint(0 if i > 0 and e[1] == entries[i-1][1] + entries[i-1][2] else e[1] + 1)
    return gzip.compress(bytes(b), mtime=0)


tiles = []
for z in range(a.maxzoom + 1):
    for x in range(2 ** z):
        for y in range(2 ** z):
            im = Image.new("RGB", (256, 256), ((40 * z) % 255, 120 + 10 * (x % 5), 180 - 10 * (y % 5)))
            d = ImageDraw.Draw(im); d.rectangle([0, 0, 255, 255], outline=(255, 255, 255))
            d.text((90, 120), f"{z}/{x}/{y}", fill=(255, 255, 255))
            bio = io.BytesIO(); im.save(bio, "JPEG" if a.jpeg else "PNG"); tiles.append((tile_id(z, x, y), bio.getvalue()))
tiles.sort()
data = bytearray(); entries = []
for tid, b in tiles:
    entries.append((tid, len(data), len(b), 1)); data += b

if a.leaves:
    leaf_blobs = bytearray(); root = []
    for i in range(0, len(entries), 50):
        chunk = entries[i:i+50]; blob = directory(chunk)
        root.append((chunk[0][0], len(leaf_blobs), len(blob), 0)); leaf_blobs += blob
    root_b = directory(root)
else:
    leaf_blobs = b""; root_b = directory(entries)

meta = gzip.compress(json.dumps({"name": "test", "attribution": "Test tiles"}).encode(), mtime=0)
root_off = 127; meta_off = root_off + len(root_b); leaf_off = meta_off + len(meta); data_off = leaf_off + len(leaf_blobs)
hdr = b"PMTiles" + bytes([3]) + struct.pack("<QQQQQQQQQQQ", root_off, len(root_b), meta_off, len(meta), leaf_off, len(leaf_blobs),
                                             data_off, len(data), len(tiles), len(entries), len(tiles))
hdr += bytes([1, 2, 1, 3 if a.jpeg else 2, 0, a.maxzoom]) + struct.pack("<iiii", int(-180e7), int(-85e7), int(180e7), int(85e7))
hdr += bytes([2]) + struct.pack("<ii", int(106.8e7), int(-6.1e7))
assert len(hdr) == 127, len(hdr)
open(a.out, "wb").write(hdr + root_b + meta + leaf_blobs + bytes(data))
print(a.out, len(tiles), "tiles", len(hdr) + len(root_b) + len(meta) + len(leaf_blobs) + len(data), "bytes")
