# Project Vault V2 Knowledge Platform Plan

Status: Accepted; V2.6 semantic search spike complete
Last Updated: 2026-07-08

## 1. Positioning

V2 目标不是立刻做 Agent，也不是直接上完整 RAG。

V2 目标是：

```text
把 V1 已经索引好的项目、文件、图纸、材料，沉淀成可审计、可搜索、可回写的结构化项目知识。
```

V2 应继续继承 V1 的本地优先边界：

- `project.json` 仍是业务数据源头。
- SQLite 仍是可重建索引缓存。
- 后端仍只绑定 loopback。
- 前端仍通过 API 访问数据，不直读本地绝对路径。
- AI Provider 仍由 AI Center 管理，API Key 不进源码、不进 `project.json`。
- 任何 AI 生成内容进入业务数据前必须可追踪、可复核、可覆盖。

## 2. Why V2

V1 已解决：

- 项目发现
- 项目初始化
- 文件/CAD/材料索引
- 全局搜索
- 项目详情浏览
- AI Provider 管理
- 本地安装包和 clean Windows 验证

但 V1 只展示 `ai_metadata` 字段，没有形成知识生产流程。

V2 补齐：

- 从项目资料中提取文本和证据。
- 生成项目摘要、核心需求、风险、经验。
- 将知识字段与文件来源、扫描历史、生成模型关联。
- 让用户先审阅，再写回 `project.json`。
- 让搜索能命中结构化知识，而不是只命中文件名。

## 3. Product Scope

### 3.1 Must Build

- Knowledge Center / Project Knowledge view
- 项目级知识字段：
  - 项目摘要
  - 核心需求
  - 特殊要求
  - 风险提示
  - 经验总结
  - 标签建议
- 文档文本提取流水线
- AI 提取草稿
- 人工确认后写回 `project.json`
- SQLite 同步和 FTS5 检索
- 知识生成历史记录
- 失败、跳过、无 Provider 的清晰状态

### 3.2 Should Build

- 按文件来源查看知识证据
- 重新生成单个字段
- 比较旧版和新版知识字段
- 导出项目知识摘要为 Markdown
- Dashboard 展示知识覆盖率

### 3.3 Not In First V2

- 自主 Agent
- 自动批量改真实项目文件
- 云同步
- 多人协同
- 权限系统
- 在线 CAD 查看/编辑
- 完整 RAG 问答
- 后台长期任务队列
- OCR 和图片理解

## 4. Core Workflow

```text
Select project
↓
Collect candidate documents
↓
Extract text locally
↓
Create knowledge draft
↓
User reviews changes
↓
Write approved fields to project.json
↓
Sync SQLite / FTS5
↓
Record history
```

Rules:

- 未经确认，不写 `project.json`。
- 无 AI Provider 时，允许只做文本提取和手动填写。
- 文本提取失败不能阻塞项目浏览。
- 生成内容必须保留来源文件和生成时间。
- 批量操作必须使用 fixture 验证，不碰真实项目资料。

## 5. Data Model Direction

V2 不急着引入向量库。

第一步先扩展结构化知识模型。

Recommended shape:

```json
{
  "ai": {
    "summary": "",
    "core_needs": [],
    "special_reqs": [],
    "risks": [],
    "lessons": [],
    "tags": [],
    "metadata_version": "2.0",
    "generated_at": "",
    "provider_name": "",
    "model_name": "",
    "evidence": [
      {
        "file_relative_path": "02_需求资料/brief.pdf",
        "field": "core_needs",
        "note": "source excerpt or short reason"
      }
    ]
  }
}
```

SQLite mirrors this for query speed.

Likely new or changed cache tables:

- `ai_metadata` extension for evidence/version fields
- `knowledge_sources`
- `knowledge_drafts`
- `knowledge_history`

Final schema requires a separate database migration plan before coding.

## 6. API Direction

Prefer extending current API style:

- envelope stays `status / data / message / meta`
- no absolute path exposure
- all file reads through `file_id`
- all writes explicit and reviewable

Candidate endpoints:

```text
GET  /api/v1/projects/{id}/knowledge
POST /api/v1/projects/{id}/knowledge/extract-text
POST /api/v1/projects/{id}/knowledge/draft
POST /api/v1/projects/{id}/knowledge/apply
GET  /api/v1/projects/{id}/knowledge/history
```

Do not add `/agent/run` in first V2.

Do not add `/search/semantic` until structured knowledge and FTS5 search work.

## 7. UI Direction

### 7.1 Project Detail

Add or upgrade the existing AI tab into:

```text
Knowledge
├── Summary
├── Needs
├── Risks
├── Lessons
├── Evidence
└── History
```

The view should support:

- empty state
- extracted text status
- draft review
- approve / discard
- field-level regenerate
- evidence list

### 7.2 Global Knowledge Center

Add only after Project Detail flow works.

Purpose:

- browse all project summaries
- filter by risk/tag/phase
- find projects by lessons learned
- inspect knowledge coverage

### 7.3 Search

Update search grouping only after data exists:

```text
Projects
Files
CAD
Materials
Knowledge
```

## 8. Implementation Phases

### Phase 14.1: V2 Planning and Schema RFC

Status: complete

Deliverables:

- V2 product plan
- knowledge field contract
- `project.json` compatibility rules
- database migration proposal
- API sketch

Exit:

- no code required
- plan accepted
- open risks listed

### Phase 14.2: Knowledge Read Model

Goal:

Show existing `ai_metadata` cleanly as V2 Knowledge UI.

Scope:

- reuse current `projects/{id}/ai-metadata`
- no generation yet
- no new schema unless required
- improve empty states and field layout

Validation:

- frontend build
- fixture project with existing AI fields
- no V1 navigation regression

Status: complete

### Phase 14.3: Text Extraction Foundation

Goal:

Extract readable text from safe document types.

Initial formats:

- `.txt`
- `.md`
- `.csv`
- `.json`
- `.docx` if existing dependency supports it
- `.pdf` only if existing dependency or installed tool is already available

Out of scope:

- OCR
- image understanding
- CAD parsing

Validation:

- fixture files only
- extracted text size limits
- controlled errors for unsupported formats

Status: complete

### Phase 14.4: Knowledge Drafts

Goal:

Create draft knowledge from extracted text.

Rules:

- AI optional
- draft stored separately from approved project knowledge
- user must approve before `project.json` write
- provider/model metadata recorded

Validation:

- no Provider path works
- Provider success path works with mock/test provider
- failed generation does not corrupt existing fields

Status: complete

### Phase 14.5: Apply and Sync

Goal:

Approved knowledge writes back to `project.json`, then syncs SQLite and FTS5.

Rules:

- backup before write
- only approved fields change
- history event recorded
- search finds approved knowledge

Validation:

- red/green fixture test
- repeat apply is idempotent
- broken `project.json` is rejected safely

Status: complete

### Phase 14.6: Knowledge Search and Coverage

Goal:

Make knowledge searchable and visible globally.

Scope:

- add Knowledge group to search results
- add knowledge coverage metrics
- optional Dashboard summary

Validation:

- FTS5 query under existing performance target
- no vector dependency

Status: complete for Knowledge search; Dashboard coverage metric deferred.

### Phase 14.7: Semantic Search Spike

Goal:

Evaluate local vector search only after Phase 14.6 is stable.

Rules:

- spike only
- no cloud dependency
- no required runtime dependency unless accepted
- compare against FTS5 usefulness

Exit:

- keep or drop decision
- no production feature unless value is proven

Status: complete

Result:

- Report: `release-validation/v2_6_semantic_search_spike-20260708-181223/semantic-search-spike-report.json`.
- FTS5 hit 3 / 6 total cases and 1 / 4 near-meaning cases.
- zero-dependency alias proxy hit 6 / 6 total cases and 4 / 4 near-meaning cases.
- Decision: defer vector dependency. Keep FTS5; consider small query expansion only after real miss-query samples.

## 9. Validation Matrix

Minimum checks per coding phase:

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m unittest discover -s tests -v

cd D:\Workflows\ProjectVault\frontend
cmd /c npm run build
cmd /c npm run test
```

If desktop packaging or static export changes:

```powershell
cd D:\Workflows\ProjectVault\desktop\src-tauri
cargo check
```

If `project.json` write behavior changes:

- fixture project test
- backup verification
- rollback check

## 10. Risks

| Risk | Control |
| --- | --- |
| AI hallucination enters business data | Draft-only until user approves |
| Generated data overwrites curated data | Field-level diff and explicit apply |
| Text extraction pulls huge files | Size limits and truncation policy |
| V2 drifts into Agent system | `/agent/run` stays out of first V2 |
| RAG added before data quality exists | Vector search delayed to spike |
| Real project data damaged | Fixture-only validation before write |
| API grows too broad | Start with Project Detail Knowledge flow |

## 11. Open Questions

1. Should approved knowledge live only in `project.json`, or also in sidecar markdown under project folder?
2. Which document formats are required for first real user value: PDF, DOCX, XLSX, or plain text only?
3. Should knowledge drafts persist across app restarts before approval?
4. Should evidence store short excerpts, file references only, or both?
5. Should V2 include manual editing first, before AI generation?

## 12. Immediate Next Step

Next task:

```text
Choose the next V2 lane: beta packaged validation retry, real AI generation planning, or a small alias/query-expansion proposal.
```

Planning package:

```text
docs/planning/V2_KNOWLEDGE_PLATFORM_PLAN.md
docs/planning/V2_SCHEMA_API_RFC.md
docs/planning/V2_EXECUTION_PLAN.md
docs/planning/V2_CONFIRMATION_CHECKLIST.md
```

V2.1-V2.6 are now frozen as a beta knowledge checkpoint plus semantic-search spike. New dependency, installer release, real AI generation, or production semantic search still requires separate confirmation.
