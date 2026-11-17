"""Turn a line file (one translated block per line, in the order of `docs_i18n.py list <page>`; '=' keeps English)
into src/docs/<page>/<code>.json.   python3 tools/docs_zip.py guide de lines.txt"""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docs_i18n import keys, tags, ROOT
import re
page, code, fn = sys.argv[1:4]
K = keys(page); L = [l.rstrip('\n') for l in open(fn, encoding='utf8') if l.strip() != '' or False]
if len(L) != len(K): sys.exit(f'{len(L)} lines for {len(K)} blocks')
out = {}; bad = []
for i, (k, t) in enumerate(zip(K, L)):
    t = t.strip()
    if t == '=': continue
    if re.findall('⟦\\d+⟧', k) != re.findall('⟦\\d+⟧', t) or tags(k) != tags(t): bad.append((i, k[:70], t[:70]))
    out[k] = t
for b in bad: print('MISMATCH', b)
if bad: sys.exit(1)
d = os.path.join(ROOT, 'src/docs', page); os.makedirs(d, exist_ok=True)
json.dump(out, open(os.path.join(d, code + '.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f'{page} {code}: {len(out)} of {len(K)} blocks')
