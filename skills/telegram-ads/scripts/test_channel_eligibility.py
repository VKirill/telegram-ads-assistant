import unittest
from channel_eligibility import route,size_review
from prepare_candidates import prepare
from export_reviews import merge,pending

class SizeGateTests(unittest.TestCase):
    def test_boundary_and_unknown(self):
        for count,expected in [(65,'manual_ads'),(0,'manual_ads'),(999,'manual_ads'),(1000,'analyze'),(1001,'analyze'),(None,'unknown_size'),('1K','unknown_size'),(-1,'unknown_size'),(True,'unknown_size')]:
            with self.subTest(count=count):self.assertEqual(route({'subscribers':count}),expected)

    def test_queue_has_only_eligible_and_inventory_is_complete(self):
        cs={'schema_version':'1.0','channels':[{'id':str(n),'subscribers':n} for n in [65,999,1000,1001]]+[{'id':'unknown'}]}
        groups=prepare(cs)
        self.assertEqual([r['id'] for r in groups['analyze']],['1000','1001'])
        self.assertEqual(sum(map(len,groups.values())),5)
        reviews,coverage=merge(cs,[])
        self.assertEqual(len(reviews['channels']),5)
        self.assertEqual(coverage['dispositions']['manual_ads'],2)
        self.assertFalse(coverage['complete'])

    def test_cannot_sneak_small_channel_into_analysis(self):
        cs={'schema_version':'1.0','channels':[{'id':'tiny','subscribers':65}]}
        with self.assertRaises(ValueError):merge(cs,[pending('tiny')])
        merged,coverage=merge(cs,[size_review(cs['channels'][0])])
        self.assertTrue(coverage['complete'])
        self.assertEqual(merged['channels'][0]['sample']['substantive_posts'],0)

    def test_duplicate_candidate_fails(self):
        with self.assertRaises(ValueError):prepare({'schema_version':'1.0','channels':[{'id':'a'},{'id':'a'}]})

if __name__=='__main__':unittest.main()
