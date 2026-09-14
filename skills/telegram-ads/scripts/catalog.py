#!/usr/bin/env python3
"""Read-only TGPages discovery. SQLite FTS5 and pymorphy3 Russian inflection expansion."""
import argparse,csv,json,os,sqlite3,sys
from pathlib import Path
from morphology import build_query

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--db');p.add_argument('--format',choices=['json','csv'],default='json')
 s=p.add_subparsers(dest='cmd',required=True)
 s.add_parser('stats')
 for name in ('search','similar'):
  q=s.add_parser(name);q.add_argument('--limit',type=int,default=30);q.add_argument('--category');q.add_argument('--microcategory');q.add_argument('--min-subscribers',type=int,default=0);q.add_argument('--exact',action='store_true',help='Отключить морфологию');q.add_argument('--explain-query',action='store_true',help='Вывести формы поиска в stderr')
  if name=='search':q.add_argument('--query',default='');q.add_argument('--match',choices=['all','any'],default='any')
  else:
   q.add_argument('--seed',required=True,help='TGPages UUID, @username or https://t.me/username');q.add_argument('--query',default='',help='Ограничить соседей словами, например географией')
 a=p.parse_args()
 if a.cmd in ('search','similar') and a.query and not a.exact:
  try:import pymorphy3
  except ImportError:
   python=Path.home()/'.local/share/telegram-ads/venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
   if python.is_file() and os.environ.get('TG_ADS_MORPH_REEXEC')!='1':
    os.environ['TG_ADS_MORPH_REEXEC']='1';os.execv(str(python),[str(python),str(Path(__file__).resolve()),*sys.argv[1:]])
   p.error('Нужен pymorphy3: python3 scripts/setup_catalog.py; либо --exact')
 config=Path.home()/'.config/telegram-ads/catalog.json'
 configured=json.loads(config.read_text()).get('db') if config.exists() else None
 candidate=a.db or os.environ.get('TELEGRAM_ADS_CATALOG') or configured or str(Path.home()/'.local/share/telegram-ads/channels.sqlite')
 dbpath=Path(candidate).expanduser().resolve()
 if not dbpath.is_file():p.error('База не найдена. Укажите --db, TELEGRAM_ADS_CATALOG или ~/.config/telegram-ads/catalog.json: {"db":"/path/channels.sqlite"}')
 db=sqlite3.connect(dbpath.as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row;db.execute('PRAGMA query_only=ON')
 if a.cmd=='stats':
  result={'database':str(dbpath),'channels':db.execute('SELECT count(*) FROM channels').fetchone()[0],'categories':[dict(x) for x in db.execute('SELECT category,microcategory,count(*) AS channels FROM channels GROUP BY category,microcategory ORDER BY category,microcategory')],'metadata':dict(db.execute('SELECT key,value FROM metadata'))}
  print(json.dumps(result,ensure_ascii=False,indent=2));return
 if not 1<=a.limit<=500:p.error('--limit должен быть от 1 до 500')
 filters=['c.subscribers>=?'];params=[a.min_subscribers]
 for field in ('category','microcategory'):
  value=getattr(a,field)
  if value:filters.append('c.'+field+'=?');params.append(value)
 fields='c.id,c.title,c.username,c.telegram_url,c.description,c.subscribers,c.category,c.microcategory,c.atlas_url,c.details_checked_at'
 if a.cmd=='search':
  tokens=a.query.split()
  if tokens:
   query,expanded=build_query(a.query,a.match,a.exact)
   if a.explain_query:print(json.dumps({'expanded_query':expanded},ensure_ascii=False),file=sys.stderr)
   sql='SELECT '+fields+',bm25(channel_search) AS text_rank FROM channel_search JOIN channels c ON c.rowid=channel_search.rowid WHERE channel_search MATCH ? AND '+' AND '.join(filters)+' ORDER BY text_rank,c.id LIMIT ?'
   rows=db.execute(sql,[query]+params+[a.limit])
  else:
   if not a.category and not a.microcategory:p.error('Укажите --query или категорию')
   rows=db.execute('SELECT '+fields+' FROM channels c WHERE '+' AND '.join(filters)+' ORDER BY c.subscribers DESC,c.id LIMIT ?',params+[a.limit])
  result=[dict(r,discovery='text_or_category') for r in rows]
 else:
  key=a.seed.removeprefix('https://t.me/').removeprefix('http://t.me/').removeprefix('@').rstrip('/')
  seeds=db.execute('SELECT id,x,y FROM channels WHERE id=? OR username=? COLLATE NOCASE',(key,key)).fetchall()
  if len(seeds)!=1:p.error('Seed не найден или неоднозначен; используйте UUID из поиска')
  seed=seeds[0]
  if a.query:
   query,expanded=build_query(a.query,exact=a.exact)
   if a.explain_query:print(json.dumps({'expanded_query':expanded},ensure_ascii=False),file=sys.stderr)
   filters.append('c.rowid IN (SELECT rowid FROM channel_search WHERE channel_search MATCH ?)');params.append(query)
  rows=db.execute('SELECT '+fields+',((c.x-?)*(c.x-?)+(c.y-?)*(c.y-?)) AS distance_squared FROM channels c WHERE c.id<>? AND '+' AND '.join(filters)+' ORDER BY distance_squared,c.id LIMIT ?',[seed['x'],seed['x'],seed['y'],seed['y'],seed['id']]+params+[a.limit])
  result=[dict(r,seed_id=seed['id'],discovery='map_2d_distance',audience_overlap=None) for r in rows]
 if a.format=='csv':
  if result:w=csv.DictWriter(sys.stdout,fieldnames=result[0].keys());w.writeheader();w.writerows(result)
 else:print(json.dumps(result,ensure_ascii=False,indent=2))
 db.close()
if __name__=='__main__':
 try:main()
 except (sqlite3.Error,ValueError,OSError,RuntimeError) as e:print('Ошибка каталога: '+str(e),file=sys.stderr);sys.exit(2)
