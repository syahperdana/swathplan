"""Compare two snapshot folders made by snapshot.py.

Usage: python3 -I test/compare.py BASELINE_DIR CANDIDATE_DIR
Exit code 0 when every export, every language text and the plan summary match.
Screenshots are compared by pixel and reported, since font rendering can vary.
"""
import sys, json, pathlib, hashlib

a, b = (pathlib.Path(x) for x in sys.argv[1:3])
la, lb = (json.loads((d / "log.json").read_text(encoding="utf-8")) for d in (a, b))
bad = []

if la["plan"] != lb["plan"]:
    bad.append(f"plan differs: {la['plan']} vs {lb['plan']}")
for k in sorted(set(la["exports"]) | set(lb["exports"])):
    if la["exports"].get(k) != lb["exports"].get(k):
        bad.append("export differs: " + k)
for f in sorted((a / "text").glob("*.txt")):
    g = b / "text" / f.name
    if not g.exists() or f.read_bytes() != g.read_bytes():
        bad.append("language text differs: " + f.name)
new_err = [e for e in lb["errors"] if "ERR_FAILED" not in e]
if new_err:
    bad.append(f"page errors: {new_err[:5]}")
if lb["missing"]:
    bad.append(f"missing exports: {lb['missing']}")
if la.get("layout") != lb.get("layout"):
    bad.append(f"layout variables differ: {la.get('layout')} vs {lb.get('layout')}")
for f in sorted((a / "shots").glob("*.png")):
    g = b / "shots" / f.name
    same = g.exists() and hashlib.sha256(f.read_bytes()).digest() == hashlib.sha256(g.read_bytes()).digest()
    print(f"screenshot {f.name}: {'identical' if same else 'DIFFERENT (check by eye)'}")

print(f"{len(la['exports'])} exports, {len(list((a / 'text').glob('*.txt')))} languages compared")
if bad:
    print("FAIL\n  " + "\n  ".join(bad))
    sys.exit(1)
print("PASS: identical behaviour")
