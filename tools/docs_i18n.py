"""Translations of the guide and the science page.

The article of src/pages/<page>.html is cut into leaf blocks (headings, paragraphs, list items, captions, table cells,
notes); the references list stays English. Each block's inner HTML, with footnotes written as ⟦3⟧, is a key in
src/docs/<page>/<code>.json ({ English block: translation }). tools/build.mjs applies them (same cutting rules) and
writes <page>/lang/<code>.html; a missing block stays English.

  python3 tools/docs_i18n.py list guide            # the English blocks, as JSON (key list)
  python3 tools/docs_i18n.py missing guide de      # blocks with no German translation yet
  python3 tools/docs_i18n.py check                 # every language: counts, stale keys, footnote and tag mismatches
"""
import re, sys, json, os, glob
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LEAF = re.compile(r'<(h[1-4]|p|li|figcaption|td|th|caption|dt|dd|div)\b([^>]*)>')
BLOCK = re.compile(r'<(p|li|ul|ol|div|table|h[1-4]|figure|pre|tr|td|th)\b')
FN = re.compile(r'<sup class="fn"><a href="#r(\d+)">\1</a></sup>')
def article(page):
    s = open(os.path.join(ROOT, 'src/pages', page + '.html'), encoding='utf8').read()
    a = s.index('<article'); a = s.index('>', a) + 1; b = s.index('</article>')
    art = s[a:b]; r = art.find('<ol class="refs"')
    return art if r < 0 else art[:r]
def norm(x): return re.sub(r'\s+', ' ', x).strip()
def tok(x): return FN.sub(lambda m: '⟦' + m.group(1) + '⟧', norm(x))
def blocks(art):
    out = []; i = 0
    while True:
        m = LEAF.search(art, i)
        if not m: break
        tag = m.group(1); e = art.find('</' + tag + '>', m.end())
        inner = art[m.end():e] if e >= 0 else ''
        if e < 0 or BLOCK.search(inner) or 'data-t' in m.group(2): i = m.end(); continue
        if re.search(r'[A-Za-z]{2}', re.sub(r'<[^>]+>', '', inner)): out.append(tok(inner))
        i = e + len(tag) + 3
    return out
def keys(page):
    seen = []; [seen.append(k) for k in blocks(article(page)) if k not in seen]; return seen
def tags(x): return sorted(re.findall(r'</?[a-z]+', x))
if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'list': print(json.dumps(keys(sys.argv[2]), ensure_ascii=False, indent=0))
    elif cmd == 'missing':
        p, c = sys.argv[2], sys.argv[3]; f = os.path.join(ROOT, 'src/docs', p, c + '.json')
        have = json.load(open(f, encoding='utf8')) if os.path.exists(f) else {}
        print(json.dumps([k for k in keys(p) if k not in have], ensure_ascii=False, indent=0))
    elif cmd == 'check':
        bad = 0
        for p in ['guide', 'science']:
            K = keys(p); ks = set(K)
            for f in sorted(glob.glob(os.path.join(ROOT, 'src/docs', p, '*.json'))):
                d = json.load(open(f, encoding='utf8')); c = os.path.basename(f)[:-5]
                stale = [k for k in d if k not in ks]
                mis = [k for k in d if k in ks and (re.findall('⟦\\d+⟧', k) != re.findall('⟦\\d+⟧', d[k]) or tags(k) != tags(d[k]))]
                print(f'{p:8} {c}: {sum(k in d for k in K)}/{len(K)} blocks' + (f', {len(stale)} stale' if stale else '') + (f', {len(mis)} footnote/tag mismatches' if mis else ''))
                for k in mis[:3]: print('   mismatch:', k[:90])
                bad += len(mis)
        sys.exit(1 if bad else 0)
