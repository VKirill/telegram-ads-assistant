"""Expand Russian query tokens into dictionary inflections, not synonyms."""
import re
from functools import lru_cache

@lru_cache(maxsize=1)
def analyzer():
 try:
  from pymorphy3 import MorphAnalyzer
 except ImportError as e:
  raise RuntimeError('Установите зависимости: python3 scripts/setup_catalog.py; либо используйте --exact') from e
 return MorphAnalyzer(lang='ru')

@lru_cache(maxsize=2048)
def forms(token):
 original=token.casefold()
 result={original,original.replace('ё','е')}
 if re.fullmatch('[а-яё]+(?:-[а-яё]+)*',original):
  # All dictionary interpretations preserve recall for ambiguous inflected nouns.
  # Predicted forms of unknown names/brands are intentionally not expanded.
  for parse in analyzer().parse(original):
   if parse.is_known:
    for form in parse.lexeme:
     result.add(form.word);result.add(form.word.replace('ё','е'))
 if len(result)>256:raise ValueError('Слишком много форм слова; уточните запрос или используйте --exact')
 return sorted(result)

def build_query(text,match='any',exact=False):
 tokens=text.split()
 if len(tokens)>32:raise ValueError('Не более 32 слов в запросе; разбейте поиск на гипотезы')
 groups=[];expanded={}
 for token in tokens:
  words=[token] if exact else forms(token)
  expanded[token]=words
  group=' OR '.join('"'+word.replace('"','""')+'"' for word in words)
  groups.append('('+group+')')
 return (' AND ' if match=='all' else ' OR ').join(groups),expanded
