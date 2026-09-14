"""Route channel metadata before any post reading. No network access."""
MIN_SUBSCRIBERS = 1000

def route(candidate):
    n = candidate.get('subscribers')
    if type(n) is not int or n < 0:
        return 'unknown_size'
    return 'analyze' if n >= MIN_SUBSCRIBERS else 'manual_ads'

def size_review(candidate):
    kind = route(candidate)
    if kind == 'analyze':
        raise ValueError('Eligible channel does not need size review')
    n = candidate.get('subscribers')
    reason = (f'В каталоге {n} подписчиков — меньше 1000. Для ручной рекламы; посты по этому маршруту не анализируются. Пригодность для посева не проверена.'
              if kind == 'manual_ads' else 'Число подписчиков неизвестно или некорректно. Уточнить метаданные до чтения постов; в очередь анализа не включён.')
    return dict(id=candidate['id'], status='size_filtered' if kind=='manual_ads' else 'pending',
        disposition='manual_ads' if kind=='manual_ads' else 'needs_review', reason=reason,
        confidence='low', observed_topics=[], audience_hypotheses=[], evidence=[],
        sample=dict(requested_posts=0, substantive_posts=0, oldest=None, newest=None,
                    retrieved_at=None, method='none', truncated=False),
        scores={k:dict(value=None, reason='Не анализировалось: фильтр размера') for k in ['need_fit','offer_fit','context_fit']},
        geo=dict(status='unknown', reason='Не проверено', source_url=None, measured_at=None),
        ads=dict(status='unchecked', source=None, checked_at=None),
        prefilter_source=candidate.get('atlas_url') or candidate.get('url') or candidate.get('telegram_url') or 'candidates.json',
        subscriber_count=n, subscriber_count_checked_at=candidate.get('details_checked_at'))
