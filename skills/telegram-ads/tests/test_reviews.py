import copy,importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('validator',Path(__file__).parents[1]/'scripts/validate_reviews.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
def document(rows):return {'schema_version':'1.0','channels':rows}
def row(i,status='reviewed',kind='target'):
 return dict(id=str(i),status=status,disposition=kind,reason='Matches stated need based on posts',observed_topics=['family'],audience_hypotheses=[],evidence=[{'url':'https://t.me/example/1','date':'2026-09-01','observation':'Family activity'},{'url':'https://t.me/example/2','date':'2026-09-02','observation':'Local school'}],sample={'requested_posts':20,'substantive_posts':2,'oldest':'2026-09-01','newest':'2026-09-02','retrieved_at':'2026-09-14','method':'fixture','truncated':False},scores={x:{'value':2,'reason':'Content evidence'} for x in ['need_fit','offer_fit','context_fit']},confidence='medium',geo={'status':'unknown','reason':'No audience measurements'},ads={'status':'unchecked'})
class Tests(unittest.TestCase):
 def test_original_failure(self):
  r=v.validate(document([{'id':str(i)} for i in range(150)]),document([row(i) for i in range(12)]));self.assertFalse(r['complete']);self.assertEqual(len(r['missing_ids']),138)
 def test_all_accounted_not_finished(self):
  rows=[row(i) for i in range(12)]+[row(i,'pending','needs_review') for i in range(12,150)]
  r=v.validate(document([{'id':str(i)} for i in range(150)]),document(rows));self.assertFalse(r['complete']);self.assertEqual(r['dispositions']['needs_review'],138);self.assertEqual(r['errors'],[])
 def test_complete_and_geo_separate(self):
  rows=[row(i,kind=k) for i,k in enumerate(['target','adjacent','expansion','reject'])];self.assertTrue(v.validate(document([{'id':str(i)} for i in range(4)]),document(rows))['complete'])
 def test_duplicate_and_unknown(self):
  r=v.validate(document([{'id':'1'}]),document([row(1),row(1),row(2)]));self.assertFalse(r['complete']);self.assertEqual(r['extra_ids'],['2']);self.assertEqual(r['duplicate_ids'],['1'])
 def test_fake_review_and_geo(self):
  r=row(1);r['evidence']=[];r['geo']['status']='audience_verified'
  self.assertGreaterEqual(len(v.validate(document([{'id':'1'}]),document([r]))['errors']),2)
 def test_unread_cannot_be_target(self):
  self.assertFalse(v.validate(document([{'id':'1'}]),document([row(1,'read_failed')]))['complete'])
if __name__=='__main__':unittest.main()
