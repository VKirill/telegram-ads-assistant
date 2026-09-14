# Контракт результатов отбора 1.0

UTF-8 JSON — общий формат обоих профилей. Не сохранять в нём секреты, полные чужие переписки или персональные сведения читателей. Отчёт описывает контент публичной площадки.

`candidates.json`: `{"schema_version":"1.0","channels":[{"id":"stable-id","username":"example","url":"https://t.me/example","title":"Название","discovery_sources":[{"type":"query","value":"Валенсия родители"}]}]}`. Один ID на площадку после дедупликации; происхождение не терять.

`reviews.json`: `{"schema_version":"1.0","channels":[...]}`. Каждый элемент имеет поля:

| Поле | Контракт |
|---|---|
| id | Тот же стабильный ID из candidates |
| status | reviewed / prefiltered / read_failed / pending |
| disposition | target / adjacent / expansion / reject / needs_review |
| reason | Содержательное основание решения; для сбоя — причина/следующий шаг |
| observed_topics | Массив наблюдаемых тем; [] при отсутствии данных |
| audience_hypotheses | Массив объектов {hypothesis, basis}; не выдавать предположение за замер |
| evidence | Массив {url, date, observation}; для reviewed это ссылки на реально прочитанные посты, подтверждающие конкретные выводы, не первые произвольные посты/заглушки/главная канала |
| sample | {requested_posts, substantive_posts, oldest, newest, retrieved_at, method, truncated}; отсутствующие даты null, method для нового чтения public-web-browser, для предоставленных материалов provided-export с указанием происхождения, при отсутствии чтения none; у исторических записей сохраняй фактический исходный method |
| scores | need_fit, offer_fit, context_fit: каждый {value: 0..3 или null, reason: строка} |
| confidence | low / medium / high |
| geo | {status: content_match/audience_verified/mismatch/unknown, reason, source_url, measured_at}; audience_verified требует источника измерения и даты |
| ads | {status: unchecked/available/unavailable, source, checked_at}; unchecked не подтверждает возможность размещения |
| prefilter_source | Строка происхождения решения по метаданным; обязательна при prefiltered |

prefiltered допускает только reject. read_failed/pending допускают только needs_review. reviewed означает публикации реально прочитаны; при сомнениях disposition тоже needs_review. Отсутствующий доступ не равен reject.

Посты: из анализа исключены пустые части альбомов, отдельно учтены реклама и репосты. Не добавлять ссылки, которые агент не читал. При substantive_posts меньше 2 уверенность только low. Для medium/high нужны минимум две различные ссылки на публикации. У target/adjacent/expansion оценки могут быть неизвестны, но недостающее не заменяется нулём.

Пример непроверенной записи (учебный ID, не реальная рекомендация):

```json
{
  "id": "example-id",
  "status": "pending",
  "disposition": "needs_review",
  "reason": "В очереди на чтение публикаций",
  "observed_topics": [],
  "audience_hypotheses": [],
  "evidence": [],
  "sample": {"requested_posts": 20, "substantive_posts": 0, "oldest": null, "newest": null, "retrieved_at": null, "method": "none", "truncated": false},
  "scores": {
    "need_fit": {"value": null, "reason": "Посты ещё не прочитаны"},
    "offer_fit": {"value": null, "reason": "Посты ещё не прочитаны"},
    "context_fit": {"value": null, "reason": "Посты ещё не прочитаны"}
  },
  "confidence": "low",
  "geo": {"status": "unknown", "reason": "Не проверено", "source_url": null, "measured_at": null},
  "ads": {"status": "unchecked", "source": null, "checked_at": null}
}
```

`coverage.json` формирует валидатор: количество уникальных candidates, записей reviews, пропуски/лишние/дубли, счётчики статусов и классов, complete. `complete=true` означает все кандидаты получили законченное решение по имеющимся доказательствам, но не готовность оплачивать рекламу и не охват всех каналов Telegram. Географические и кабинетные unknown сохраняются отдельно.
