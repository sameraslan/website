"""Match a RateYourMusic export against the full music-map catalog.

Usage: python3 match_rym.py <catalog_dir> <rym_export.csv> <work_dir>

<catalog_dir> holds the full 4081-album pipeline output (metadata.json).
Rows with rating 0 are skipped. Writes <work_dir>/matches.json (catalog id ->
RYM row), unmatched.json and rated_rows.json. Known matcher mistakes are
corrected by overrides.json, which build.mjs applies.
"""
import csv, json, os, re, unicodedata, html, collections, sys, difflib

CATALOG, CSV_PATH, WORK = sys.argv[1:4]
meta=json.load(open(os.path.join(CATALOG, "metadata.json")))
rows=list(csv.reader(open(CSV_PATH,encoding='utf-8')))[1:]

def norm(s):
    s=html.unescape(s)
    s=unicodedata.normalize('NFKD',s)
    s=''.join(c for c in s if not unicodedata.combining(c)).lower()
    s=s.replace('&',' and ').replace('’',"'").replace("'",'').replace('yr ','your ')
    s=re.sub(r"\b(the|a|an)\b"," ",s)
    s=re.sub(r"[^\w]+"," ",s)
    return ' '.join(s.split())
def title_variants(t):
    t=html.unescape(t); out={norm(t)}
    # strip parenthetical / bracket suffixes (deluxe, remaster, etc)
    b=re.sub(r"\s*[\(\[].*?[\)\]]","",t).strip()
    out.add(norm(b))
    for inner in re.findall(r"\[(.*?)\]",t): out.add(norm(inner))
    b2=re.split(r"\s+[-–—:]\s+",b)[0]; out.add(norm(b2))
    return {x for x in out if x}
def artist_variants(r):
    first,last,flo,llo=r[1].strip(),r[2].strip(),r[3].strip(),r[4].strip()
    names={(first+' '+last).strip(),(flo+' '+llo).strip(),last,llo}
    out=set()
    for n in names:
        if not n: continue
        out.add(norm(n))
        for part in re.split(r"\s*(?:&amp;|&|,| and | with | x | feat\. )\s*",html.unescape(n)):
            if part.strip(): out.add(norm(part))
    return {x for x in out if x}

idx=collections.defaultdict(list)
for m in meta:
    for tv in title_variants(m['title']):
        idx[tv].append(m)

matched={}; unmatched=[]; rated=[r for r in rows if r[7]!='0']
for r in rated:
    avs=artist_variants(r); hits=[]
    for tv in title_variants(r[5]):
        for m in idx.get(tv,[]):
            mav={norm(m['artist'])}|{norm(p) for p in re.split(r"\s*(?:&|,| and | with )\s*",m['artist']) if p.strip()}
            if avs & mav and m not in hits: hits.append(m)
    if not hits:
        for m in meta:
            mav={norm(m['artist'])}|{norm(p) for p in re.split(r"\s*(?:&|,| and | with )\s*",m['artist']) if p.strip()}
            if avs & mav:
                for tv in title_variants(r[5]):
                    for mt in title_variants(m['title']):
                        if difflib.SequenceMatcher(None,tv,mt).ratio()>=0.9 and m not in hits: hits.append(m)
    if hits:
        for m in hits: matched.setdefault(m['id'],(r,m))
    else: unmatched.append(r)
print("rated",len(rated),"matched rym rows",len(rated)-len(unmatched),"unique catalog ids",len(matched))
json.dump({k:{'rym':v[0],'title':v[1]['title'],'artist':v[1]['artist']} for k,v in matched.items()},open(os.path.join(WORK,"matches.json"),"w"),ensure_ascii=False,indent=0)
json.dump(unmatched,open(os.path.join(WORK,"unmatched.json"),"w"),ensure_ascii=False)
json.dump(rated,open(os.path.join(WORK,"rated_rows.json"),"w"),ensure_ascii=False)
