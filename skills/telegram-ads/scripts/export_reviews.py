#!/usr/bin/env python3
"""Merge validated review batches into a deterministic complete candidate table."""
import argparse
import csv
import json
import io
from pathlib import Path
from validate_reviews import validate
from channel_eligibility import route, size_review

FIELDS = ['id', 'username', 'title', 'url', 'subscribers', 'subscriber_count_checked_at', 'analysis_route', 'disposition', 'category', 'status',
          'decision_basis', 'reason', 'confidence', 'observed_topics',
          'audience_hypotheses', 'evidence', 'prefilter_source',
          'discovery_sources', 'sample', 'scores', 'geo', 'ads']
LABELS = dict(target='Целевой', adjacent='Смежный', expansion='Для расширения',
              reject='Отсеян', needs_review='Требует проверки', manual_ads='Для ручной рекламы')

def pending(rid):
    return dict(id=rid, status='pending', disposition='needs_review',
        reason='Результат анализа не предоставлен', confidence='low',
        observed_topics=[], audience_hypotheses=[], evidence=[],
        sample=dict(requested_posts=0, substantive_posts=0, oldest=None,
            newest=None, retrieved_at=None, method='none', truncated=False),
        scores={k: dict(value=None, reason='Не проверено') for k in
            ['need_fit', 'offer_fit', 'context_fit']},
        geo=dict(status='unknown', reason='Не проверено', source_url=None, measured_at=None),
        ads=dict(status='unchecked', source=None, checked_at=None))

def load_batch(path):
    doc = json.loads(path.read_text(encoding='utf-8'))
    if isinstance(doc, dict) and 'channels' in doc:
        if doc.get('schema_version') != '1.0' or not isinstance(doc['channels'], list):
            raise ValueError(f'{path}: invalid batch envelope')
        return doc['channels']
    if isinstance(doc, dict) and isinstance(doc.get('id'), str):
        return [doc]
    raise ValueError(f'{path}: expected review object or versioned batch')

def merge(candidates, reviews):
    initial = validate(candidates, {'schema_version': '1.0', 'channels': reviews})
    errors = [e for e in initial['errors'] if e != 'missing reviews']
    if errors:
        raise ValueError('; '.join(errors))
    by_id = {r['id']: r for r in reviews}
    missing = initial['missing_ids']
    for c in candidates['channels']:
        if c['id'] in by_id:
            r = by_id[c['id']]
            if route(c)=='manual_ads' and (r['status']!='size_filtered' or r['disposition']!='manual_ads'):
                raise ValueError(c['id']+': below 1000 subscribers; archive previous analysis and use size-filtered review')
            if route(c)=='unknown_size' and r['status'] not in ['pending','prefiltered']:
                raise ValueError(c['id']+': unknown subscriber count; verify metadata before analysis')
            if route(c)=='analyze' and r['status']=='size_filtered':
                raise ValueError(c['id']+': size filter conflicts with current subscriber count')
    ordered = [by_id.get(c['id'], pending(c['id']) if route(c)=='analyze' else size_review(c))
               for c in sorted(candidates['channels'], key=lambda c: c['id'])]
    merged = {'schema_version': '1.0', 'channels': ordered}
    coverage = validate(candidates, merged)
    coverage['missing_input_review_ids'] = missing
    return merged, coverage

def cell(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    text = '' if value is None else str(value)
    # CSV is opened in spreadsheets; keep external content from becoming formulas.
    if text.lstrip().startswith(('=', '+', '-', '@')) or text.startswith(('\t', '\r', '\n')):
        text = "'" + text
    return text

def export(candidates, reviews, out):
    merged, coverage = merge(candidates, reviews)
    metadata = {c['id']: c for c in candidates['channels']}
    # Serialize and encode every output before touching an existing result.
    payloads = {}
    for name, doc in [('reviews.json', merged), ('coverage.json', coverage)]:
        payloads[name] = (json.dumps(doc, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')
    buffer = io.StringIO(newline='')
    writer = csv.DictWriter(buffer, fieldnames=FIELDS, lineterminator='\n')
    writer.writeheader()
    manual_rows = []
    for r in merged['channels']:
        c = metadata[r['id']]
        row = {k: r.get(k) for k in FIELDS}
        row.update({k: c.get(k) for k in ['id', 'username', 'title', 'url', 'subscribers', 'discovery_sources']})
        row['subscriber_count_checked_at'] = c.get('details_checked_at')
        row['analysis_route'] = route(c)
        row['category'] = LABELS[r['disposition']]
        row['decision_basis'] = {'prefiltered': 'metadata', 'reviewed': 'posts',
            'read_failed': 'read_failed', 'pending': 'pending', 'size_filtered': 'subscriber_count'}[r['status']]
        rendered = {k: cell(row[k]) for k in FIELDS}
        writer.writerow(rendered)
        if r["disposition"] == "manual_ads": manual_rows.append(rendered)
    payloads['channels.csv'] = buffer.getvalue().encode('utf-8-sig')
    manual = io.StringIO(newline='')
    mw = csv.DictWriter(manual, fieldnames=FIELDS, lineterminator='\n')
    mw.writeheader(); mw.writerows(manual_rows)
    payloads['manual-ads.csv'] = manual.getvalue().encode('utf-8-sig')
    out.mkdir(parents=True, exist_ok=True)
    for name, payload in payloads.items():
        (out / name).write_bytes(payload)
    return coverage

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--candidates', type=Path, required=True)
    p.add_argument('--reviews', type=Path, nargs='+', required=True,
                   help='Review files or directories containing only review JSON files')
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    try:
        files = []
        for source in a.reviews:
            files.extend(sorted(source.glob('*.json')) if source.is_dir() else [source])
        reviews = [r for path in files for r in load_batch(path)]
        coverage = export(json.loads(a.candidates.read_text(encoding='utf-8')), reviews, a.out)
    except (ValueError, OSError, TypeError, KeyError) as e:
        p.exit(1, str(e) + '\n')
    print(json.dumps(coverage, ensure_ascii=False))
    return 0 if coverage['complete'] else 2

if __name__ == '__main__':
    raise SystemExit(main())
