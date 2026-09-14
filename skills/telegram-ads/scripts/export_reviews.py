#!/usr/bin/env python3
"""Merge validated review batches into a deterministic complete candidate table."""
import argparse
import csv
import json
from pathlib import Path
from validate_reviews import validate

FIELDS = ['id', 'username', 'title', 'url', 'disposition', 'category', 'status',
          'decision_basis', 'reason', 'confidence', 'observed_topics',
          'audience_hypotheses', 'evidence', 'prefilter_source',
          'discovery_sources', 'sample', 'scores', 'geo', 'ads']
LABELS = dict(target='Целевой', adjacent='Смежный', expansion='Для расширения',
              reject='Отсеян', needs_review='Требует проверки')

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
    ordered = [by_id.get(c['id'], pending(c['id']))
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
    out.mkdir(parents=True, exist_ok=True)
    for name, doc in [('reviews.json', merged), ('coverage.json', coverage)]:
        (out / name).write_text(json.dumps(doc, ensure_ascii=False, sort_keys=True, indent=2) + '\n', encoding='utf-8')
    with (out / 'channels.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, lineterminator='\n')
        writer.writeheader()
        for r in merged['channels']:
            c = metadata[r['id']]
            row = {k: r.get(k) for k in FIELDS}
            row.update({k: c.get(k) for k in ['id', 'username', 'title', 'url', 'discovery_sources']})
            row['category'] = LABELS[r['disposition']]
            row['decision_basis'] = {'prefiltered': 'metadata', 'reviewed': 'posts',
                'read_failed': 'read_failed', 'pending': 'pending'}[r['status']]
            writer.writerow({k: cell(row[k]) for k in FIELDS})
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
