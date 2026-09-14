#!/usr/bin/env python3
"""Validate channel review coverage; does not certify truth of evidence."""
import argparse,json,sys
from collections import Counter
from pathlib import Path

def validate(candidates,reviews):
 errors=[]
 def records(doc,name):
  if not isinstance(doc,dict) or doc.get('schema_version')!='1.0' or not isinstance(doc.get('channels'),list):
   errors.append(name+': expected schema_version 1.0 and channels array');return []
  result=[]
  for row in doc['channels']:
   if not isinstance(row,dict) or not isinstance(row.get('id'),str) or not row['id'].strip():errors.append(name+': invalid id');continue
   result.append(row)
  return result
 cs=records(candidates,'candidates');rs=records(reviews,'reviews')
 ci=Counter(x['id'] for x in cs);ri=Counter(x['id'] for x in rs)
 missing=sorted(ci.keys()-ri.keys());extra=sorted(ri.keys()-ci.keys());duplicates=sorted(k for k,v in ri.items() if v>1)
 if any(v>1 for v in ci.values()):errors.append('candidates contain duplicate IDs')
 if missing:errors.append('missing reviews')
 if extra:errors.append('unknown review IDs')
 if duplicates:errors.append('duplicate reviews')
 statuses=Counter();classes=Counter()
 for r in rs:
  rid=r['id'];status=r.get('status');kind=r.get('disposition');statuses[str(status)]+=1;classes[str(kind)]+=1
  def fail(why):errors.append(rid+': '+why)
  if status not in ['reviewed','prefiltered','read_failed','pending']:fail('invalid status')
  if kind not in ['target','adjacent','expansion','reject','needs_review']:fail('invalid disposition')
  if not isinstance(r.get('reason'),str) or not r['reason'].strip():fail('missing reason')
  if status in ['read_failed','pending'] and kind!='needs_review':fail('unread must be needs_review')
  if status=='prefiltered' and (kind!='reject' or not r.get('prefilter_source')):fail('prefilter requires reject and source')
  for key in ['observed_topics','audience_hypotheses','evidence']:
   if not isinstance(r.get(key),list):fail(key+' must be array')
  evidence=r.get('evidence') if isinstance(r.get('evidence'),list) else []
  valid_evidence=[e for e in evidence if isinstance(e,dict) and isinstance(e.get('url'),str) and e['url'].startswith('https://') and e.get('date') and e.get('observation')]
  if len(valid_evidence)!=len(evidence):fail('invalid evidence')
  sample=r.get('sample') if isinstance(r.get('sample'),dict) else {}
  n=sample.get('substantive_posts');requested=sample.get('requested_posts')
  if type(n)!=int or n<0 or type(requested)!=int or requested<0:fail('invalid sample counts');n=0
  if not isinstance(sample.get('truncated'),bool) or not sample.get('method'):fail('missing sample method/truncation')
  if status=='reviewed' and (not valid_evidence or n<1 or not all(sample.get(x) for x in ['oldest','newest','retrieved_at'])):fail('reviewed requires actual dated posts')
  if r.get('confidence') not in ['low','medium','high']:fail('invalid confidence')
  if r.get('confidence') in ['medium','high'] and status!='prefiltered' and (n<2 or len({e['url'] for e in valid_evidence})<2):fail('confidence needs two post sources')
  scores=r.get('scores') if isinstance(r.get('scores'),dict) else {}
  for key in ['need_fit','offer_fit','context_fit']:
   score=scores.get(key,{})
   if not isinstance(score,dict):fail('invalid score '+key);continue
   value=score.get('value')
   if 'value' not in score or value is not None and (type(value)!=int or not 0<=value<=3) or not score.get('reason'):fail('invalid score '+key)
  geo=r.get('geo') if isinstance(r.get('geo'),dict) else {}
  if geo.get('status') not in ['content_match','audience_verified','mismatch','unknown'] or not geo.get('reason'):fail('invalid geography')
  if geo.get('status')=='audience_verified' and not (geo.get('source_url') and geo.get('measured_at')):fail('verified audience requires measurement source/date')
  ads=r.get('ads') if isinstance(r.get('ads'),dict) else {}
  if ads.get('status') not in ['unchecked','available','unavailable']:fail('invalid ads status')
  if ads.get('status') in ['available','unavailable'] and not (ads.get('source') and ads.get('checked_at')):fail('ads status requires evidence')
 return {'unique_candidates':len(ci),'review_records':len(rs),'missing_ids':missing,'extra_ids':extra,'duplicate_ids':duplicates,'statuses':dict(statuses),'dispositions':dict(classes),'errors':errors,'complete':not errors and not classes.get('needs_review',0)}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('candidates',type=Path);p.add_argument('reviews',type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
 try:result=validate(json.loads(a.candidates.read_text()),json.loads(a.reviews.read_text()))
 except (ValueError,OSError) as e:p.exit(2,str(e)+'\n')
 text=json.dumps(result,ensure_ascii=False,indent=2)
 if a.output:a.output.write_text(text+'\n')
 print(text);return 0 if result['complete'] else 2
if __name__=='__main__':sys.exit(main())
