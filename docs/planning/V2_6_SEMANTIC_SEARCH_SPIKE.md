# Project Vault V2.6 Local Semantic Search Spike

Status: complete
Date: 2026-07-08

## Scope

V2.6 is a spike only.

Included:

- Compare current FTS5 Knowledge search against near-meaning queries.
- Use fixture data only.
- Produce keep/drop decision.

Not included:

- production vector dependency
- schema migration
- API change
- frontend change
- packaged installer validation

## Method

Run:

```powershell
cd D:\Workflows\ProjectVault
backend\.venv\Scripts\python.exe scripts\v2_6_semantic_search_spike.py
```

The script creates a release-validation fixture with three knowledge projects:

- wayfinding / customer circulation
- acoustic / noise control
- warm lighting / illumination

It checks exact queries and near-meaning queries against:

- existing FTS5 `category=knowledge`
- zero-dependency alias expansion proxy

## Decision Rule

If FTS5 misses near-meaning queries but a zero-dependency proxy recovers them, do not add a vector dependency yet.

Use this order:

1. keep current FTS5
2. add tiny alias/query expansion only if real users hit misses
3. evaluate vector search only after collecting real miss-query samples

## Current Recommendation

Do not add a vector dependency in V2.6.

Keep current FTS5 Knowledge search. If real usage shows repeated miss queries, add a tiny alias/query-expansion layer first. Reopen local vector search only after collecting real miss-query samples and confirming the dependency/runtime cost is worth it.

## Result

Report:

```text
release-validation/v2_6_semantic_search_spike-20260708-181223/semantic-search-spike-report.json
```

Summary:

| Check | FTS5 | Alias proxy |
| --- | ---: | ---: |
| Total hits | 3 / 6 | 6 / 6 |
| Near-meaning hits | 1 / 4 | 4 / 4 |
| Exact cases | 2 | 2 |
| Near-meaning cases | 4 | 4 |

FTS5 handled exact or overlapping-term searches, but missed several near-meaning queries:

- `sound absorption` -> `v26-acoustic`
- `quiet meeting room` -> `v26-acoustic`
- `cozy illumination` -> `v26-lighting`

The zero-dependency proxy recovered these with small fixture aliases. This proves there is recall value in query expansion, but not enough evidence to justify a production vector stack yet.

## Decision

`defer_vector_dependency`

Drop vector implementation from the current V2 path. Keep V2.6 as a completed spike and require separate user confirmation before any vector/PDF/DOCX dependency is added.

## Remaining Risk

The fixture is intentionally small. It proves the shape of the problem, not production ranking quality. A real vector evaluation should wait for real user searches that FTS5 fails to satisfy.
