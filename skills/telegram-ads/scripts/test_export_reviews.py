import csv
import tempfile
import unittest
from pathlib import Path
from export_reviews import export, merge, pending

class ExportTests(unittest.TestCase):
    def setUp(self):
        self.cs = {'schema_version':'1.0','channels':[
            {'id':'b','subscribers':1000,'title':'=1+1','discovery_sources':[{'value':'город'}]},
            {'id':'a','subscribers':2000,'title':'Текст, с "кавычками"\nи переносом'}]}
        self.reject = pending('a')
        self.reject.update(status='prefiltered', disposition='reject',
            reason='Футбольный канал', prefilter_source='https://example.org/channel')

    def test_full_pool_and_missing(self):
        merged, coverage = merge(self.cs, [self.reject])
        self.assertEqual([r['id'] for r in merged['channels']], ['a','b'])
        self.assertEqual(merged['channels'][0]['disposition'], 'reject')
        self.assertEqual(coverage['missing_input_review_ids'], ['b'])
        self.assertFalse(coverage['complete'])
        self.assertEqual(coverage['errors'], [])

    def test_reject_duplicates_unknown_invalid(self):
        for rows in [[self.reject,self.reject],[pending('unknown')],[{'id':'a'}]]:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                merge(self.cs, rows)

    def test_csv_roundtrip_determinism_and_no_write_on_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)
            export(self.cs, [self.reject], out)
            before={p.name:p.read_bytes() for p in out.iterdir()}
            with (out/'channels.csv').open(encoding='utf-8-sig',newline='') as f:
                rows=list(csv.DictReader(f))
            self.assertEqual(rows[0]['title'], self.cs['channels'][1]['title'])
            self.assertEqual(rows[0]['category'],'Отсеян')
            self.assertEqual(rows[0]['decision_basis'],'metadata')
            self.assertEqual(rows[1]['title'],"'=1+1")
            export(self.cs,[self.reject],out)
            self.assertEqual(before,{p.name:p.read_bytes() for p in out.iterdir()})
            with self.assertRaises(ValueError):
                export(self.cs,[self.reject,self.reject],out)
            self.assertEqual(before,{p.name:p.read_bytes() for p in out.iterdir()})

    def test_invalid_unicode_does_not_damage_previous_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)
            export(self.cs, [self.reject], out)
            before={p.name:p.read_bytes() for p in out.iterdir()}
            broken=dict(self.reject, reason='broken emoji ' + chr(0xD83D))
            with self.assertRaises(UnicodeEncodeError):
                export(self.cs, [broken], out)
            self.assertEqual(before, {p.name:p.read_bytes() for p in out.iterdir()})

if __name__ == '__main__':
    unittest.main()
