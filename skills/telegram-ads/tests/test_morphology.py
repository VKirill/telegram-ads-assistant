import sys,sqlite3,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
from morphology import build_query,forms
class MorphTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.execute('CREATE VIRTUAL TABLE texts USING fts5(title,description)');self.db.executemany('INSERT INTO texts VALUES(?,?)',[('Жизнь в Испании','Семьи и родители'),('Психолога заметки','Работа с семьями в Испании'),('Новости','Психологами обсуждаются отношения'),('Туризм','Испания')])
 def tearDown(self):self.db.close()
 def matches(self,q,**kw):return self.db.execute('SELECT rowid FROM texts WHERE texts MATCH ?',(build_query(q,**kw)[0],)).fetchall()
 def test_cases(self):self.assertIn('испании',forms('Испания'));self.assertIn('психологами',forms('психолог'))
 def test_both_columns(self):self.assertEqual(len(self.matches('психолог')),2);self.assertEqual(len(self.matches('психолог',exact=True)),0)
 def test_all_grouping(self):self.assertEqual(len(self.matches('психолог Испания',match='all')),1)
 def test_reverse_inflection(self):self.assertEqual(self.matches('Испанией'),self.matches('Испания'))
 def test_exact(self):self.assertEqual(len(self.matches('Испания',exact=True)),1);self.assertEqual(len(self.matches('Испания')),3)
 def test_literal(self):self.assertEqual(build_query('Spain2026')[1],{'Spain2026':['spain2026']});self.matches('" OR 1=1')
if __name__=='__main__':unittest.main()
