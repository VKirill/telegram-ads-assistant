#!/usr/bin/env python3
"""Deterministic HTML report from final review JSON; Python standard library only."""
from pathlib import Path
import argparse, json, html

def render(data):
    candidates=data['candidates']
    reviews={x['id']:x for x in data['reviews']['channels']}
    cov=data['coverage']
    ids=[c['id'] for c in candidates]
    if len(set(ids))!=len(ids) or set(ids)!=set(reviews):
        raise ValueError('Candidates/reviews IDs must match and be unique')
    if len(data['reviews']['channels'])!=len(ids):
        raise ValueError('Duplicate reviews')
    from collections import Counter
    if dict(Counter(x['disposition'] for x in reviews.values()))!=cov['dispositions']:
        raise ValueError('Coverage counts do not match reviews')
    for c in candidates:
        if not c['url'].startswith(('https://','http://')):
            raise ValueError('Unsafe channel URL')
    for x in reviews.values():
        for e in x['evidence']:
            if not e['url'].startswith(('https://','http://')):
                raise ValueError('Unsafe evidence URL')
    template=(Path(__file__).resolve().parents[1]/'assets/report.html').read_text()
    if 'attribution' in data:
        import re
        attribution=data['attribution']
        url=attribution.get('url','')
        if url and not url.startswith('https://'):
            raise ValueError('Unsafe attribution URL')
        text=html.escape(attribution.get('text',''))
        link=('<a href="'+html.escape(url,quote=True)+'">'+html.escape(attribution.get('label',''))+'</a>') if url else ''
        template=re.sub(r'<p>Пример результата.*?</p>',lambda _: '<p>'+text+' '+link+'</p>',template)
    labels={'target':'Целевой','adjacent':'Смежный','expansion':'Для расширения','reject':'Отсеян','needs_review':'Требует проверки','manual_ads':'Для ручной рекламы'}
    states={'reviewed':'Посты прочитаны','prefiltered':'Отсев по метаданным','pending':'Ожидает чтения','read_failed':'Посты недоступны','size_filtered':'Меньше 1000 подписчиков'}
    esc=html.escape
    cards=''.join(f'<div class="card"><strong>{cov["dispositions"].get(k,0)}</strong>{v}</div>' for k,v in labels.items())
    t=template.replace('@@TITLE@@',esc(data['title'])).replace('@@INTRO@@',esc(data.get('intro','')))
    
    t+=f'<p><a href="channels.csv">Скачать полный CSV</a> · <a href="manual-ads.csv">Малые каналы: ручная реклама</a> · <a href="reviews.json">JSON с доказательствами</a> · <a href="report-data.json">Данные страницы</a></p><div class="cards">{cards}</div></header>'
    t+=f'<p class="note">Всего {cov["unique_candidates"]} кандидатов; для ручной рекламы: {cov["statuses"].get("size_filtered",0)}. Прочитаны посты: {cov["statuses"].get("reviewed",0)}; отсев по метаданным: {cov["statuses"].get("prefiltered",0)}; недоступны: {cov["statuses"].get("read_failed",0)}; ждут чтения: {cov["statuses"].get("pending",0)}. Подходящий контент — гипотеза для теста, не подтверждение состава подписчиков или доступности в Telegram Ads. Старые материалы API явно обозначены; новое чтение выполняется без авторизации через публичные страницы.</p>'
    t+='<div class="controls"><label>Канал, тема или причина<input id="q" placeholder="Например: адаптация, родители"></label><label>Категория<select id="kind"><option value="">Все категории</option>'+''.join(f'<option value="{k}">{v} ({cov["dispositions"].get(k,0)})</option>' for k,v in labels.items())+'</select></label><label>Стадия<select id="status"><option value="">Все стадии</option>'+''.join(f'<option value="{k}">{v}</option>' for k,v in states.items())+'</select></label><button id="reset" type="button">Сбросить фильтры</button></div><p id="active" aria-live="polite"></p><p id="count" aria-live="polite"></p><div class="table-wrap"><table><thead><tr><th>Канал</th><th>Решение</th><th>Темы и предполагаемая аудитория</th><th>Основания и доказательства</th></tr></thead><tbody>'
    for c in sorted(candidates,key=lambda c:(-(c['subscribers'] if type(c.get('subscribers')) is int else -1),c['title'].casefold(),c['id'])):
     x=reviews[c['id']];sm=x['sample'];method=sm['method']; origin='Публичный браузер' if method=='public-web-browser' else 'Ранее сохранённый материал ('+method+')' if method!='none' else 'Без чтения постов'
     topics='; '.join(str(v) for v in x['observed_topics'])
     hypotheses='<br><br>'.join(esc(str(h.get('hypothesis','')))+'<br><small>'+esc(str(h.get('basis','')))+'</small>' for h in x['audience_hypotheses'] if isinstance(h,dict))
     evidence=''.join('<p><a href="'+esc(e['url'],quote=True)+'">'+esc(str(e['date']))+'</a><br>'+esc(str(e['observation']))+'</p>' for e in x['evidence'])
     t+='<tr data-kind="'+x['disposition']+'" data-status="'+x['status']+'"><td><a href="'+esc(c['url'],quote=True)+'">'+esc(c['title'])+'</a><br><small>@'+esc(c['username'])+'<br>'+esc(str(c.get('subscribers','—')))+' подписчиков · снимок каталога</small><br><a href="https://t.me/s/'+esc(c['username'],quote=True)+'">Публичная лента</a></td><td><span class="badge">'+labels[x['disposition']]+'</span><p><small>'+states[x['status']]+'<br>Уверенность: '+{'low':'низкая','medium':'средняя','high':'высокая'}[x['confidence']]+'</small></p><small>'+esc(origin)+'<br>'+str(sm['substantive_posts'])+' содержательных постов<br>'+esc(str(sm.get('oldest') or '—'))+' — '+esc(str(sm.get('newest') or '—'))+'</small></td><td>'+esc(topics)+'<details><summary>Для кого пишет автор</summary>'+hypotheses+'</details></td><td>'+esc(x['reason'])+'<details><summary>Источники и публикации</summary>'+evidence+'<p>'+esc(str(x.get('prefilter_source','')) or '')+'</p><p>Найден: '+esc('; '.join(str(v.get('value',v)) for v in c['discovery_sources']))+'</p></details></td></tr>'
    t+='''</tbody></table></div><script>const q=document.querySelector('#q'),k=document.querySelector('#kind'),s=document.querySelector('#status'),rows=[...document.querySelectorAll('tbody tr')];function filter(){let n=0;for(const r of rows){const ok=(!k.value||r.dataset.kind===k.value)&&(!s.value||r.dataset.status===s.value)&&r.textContent.toLocaleLowerCase().includes(q.value.toLocaleLowerCase());r.hidden=!ok;if(ok)n++}document.querySelector('#active').textContent='Фильтры: '+[k.selectedOptions[0].textContent,s.selectedOptions[0].textContent,q.value?'Поиск: '+q.value:'Без поиска'].join(' · ');document.querySelector('#count').textContent='Показано каналов: '+n+' из '+rows.length}document.querySelector('#reset').addEventListener('click',()=>{q.value='';k.value='';s.value='';filter()});q.addEventListener('input',filter);k.addEventListener('change',filter);s.addEventListener('change',filter);filter()</script></html>'''
    return t

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run-dir',type=Path)
    p.add_argument('--data',type=Path,help='Previously generated report-data.json')
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    if bool(args.run_dir)==bool(args.data):
        p.error('Provide exactly one of --run-dir or --data')
    if args.data:
        data=json.loads(args.data.read_text())
    else:
        r=args.run_dir
        brief=json.loads((r/'brief.json').read_text())
        data={'schema_version':'1.0','title':brief['product']+' · '+brief.get('geography',''),
              'intro':brief.get('audience',''),
              'candidates':json.loads((r/'candidates.json').read_text())['channels'],
              'reviews':json.loads((r/'final/reviews.json').read_text()),
              'coverage':json.loads((r/'final/coverage.json').read_text())}
    page=render(data).encode('utf-8')
    payload=(json.dumps(data,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf-8')
    args.out.mkdir(parents=True,exist_ok=True)
    (args.out/'report.html').write_bytes(page)
    (args.out/'report-data.json').write_bytes(payload)
    print(json.dumps({'channels':len(data['candidates']),'html':str(args.out/'report.html')}))

if __name__=='__main__':
    main()
