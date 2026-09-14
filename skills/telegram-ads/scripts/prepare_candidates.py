#!/usr/bin/env python3
"""Split full discovery into post-reading queue and metadata-only inventories."""
import argparse,json
from pathlib import Path
from channel_eligibility import route,size_review

def prepare(doc):
    if not isinstance(doc,dict) or doc.get('schema_version')!='1.0' or not isinstance(doc.get('channels'),list):
        raise ValueError('Expected schema_version 1.0 and channels array')
    ids=set(); groups={k:[] for k in ['analyze','manual_ads','unknown_size']}
    for c in doc['channels']:
        if not isinstance(c,dict) or not isinstance(c.get('id'),str) or not c['id'].strip() or c['id'] in ids:
            raise ValueError('Missing or duplicate candidate ID')
        ids.add(c['id']); groups[route(c)].append(c)
    return groups

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('candidates',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    try:
        groups=prepare(json.loads(a.candidates.read_text(encoding='utf-8')))
        docs={name:{'schema_version':'1.0','channels':sorted(groups[k],key=lambda c:c['id'])} for k,name in
              [('analyze','analysis-candidates.json'),('manual_ads','manual-candidates.json'),('unknown_size','unknown-size-candidates.json')]}
        docs['size-filtered-reviews.json']={'schema_version':'1.0','channels':[size_review(c) for k in ['manual_ads','unknown_size'] for c in sorted(groups[k],key=lambda c:c['id'])]}
        payloads={name:(json.dumps(d,ensure_ascii=False,indent=2)+'\n').encode('utf-8') for name,d in docs.items()}
        a.out.mkdir(parents=True,exist_ok=True)
        for name,data in payloads.items():(a.out/name).write_bytes(data)
    except (ValueError,OSError,TypeError) as e:p.exit(1,str(e)+'\n')
    print(json.dumps({k:len(v) for k,v in groups.items()}))
if __name__=='__main__':main()
