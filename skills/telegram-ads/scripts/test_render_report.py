import unittest
from channel_eligibility import size_review
from render_report import render

class ReportTests(unittest.TestCase):
    def data(self):
        c={'id':'one','title':'<script>alert(1)</script>','username':'sample','url':'https://t.me/sample','subscribers':65,'discovery_sources':[]}
        x=size_review(c)
        return {'title':'<img src=x onerror=alert(1)>','intro':'Audience','candidates':[c], 'reviews':{'channels':[x]},'coverage':{'unique_candidates':1,'dispositions':{'manual_ads':1},'statuses':{'size_filtered':1}}}
    def test_determinism_and_escaping(self):
        d=self.data(); a=render(d)
        self.assertEqual(a,render(d))
        self.assertNotIn('<script>alert(1)</script>',a)
        self.assertIn('&lt;script&gt;',a)
        self.assertNotIn('<img src=x',a)
        self.assertEqual(a.count('<tr data-kind='),1)
    def test_coverage_mismatch(self):
        d=self.data();d['coverage']['dispositions']['manual_ads']=2
        with self.assertRaises(ValueError):render(d)
    def test_unsafe_url(self):
        d=self.data();d['candidates'][0]['url']='javascript:alert(1)'
        with self.assertRaises(ValueError):render(d)

if __name__=='__main__':unittest.main()
