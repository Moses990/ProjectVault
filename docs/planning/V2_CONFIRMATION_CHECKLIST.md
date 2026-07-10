# Project Vault V2 Confirmation Checklist

Status: Accepted through V2.5 beta checkpoint
Last Updated: 2026-07-08

## 1. Confirm Scope

- [x] V2 首轮定位为 Knowledge Platform。
- [x] V2 首轮不做 Agent OS。
- [x] V2 首轮不做完整 RAG 问答。
- [x] V2 首轮不做云同步、多人协同、权限系统、在线 CAD 编辑。
- [x] 任何 AI 生成内容必须先成为 draft，用户确认后才写入 `project.json`。

## 2. Confirm Data Contract

- [x] `project.json` 继续作为业务数据源头。
- [x] SQLite 继续作为可重建缓存。
- [x] V2 可以扩展 `project.json.ai` 字段。
- [x] V2 可以增加 `knowledge_sources`、`knowledge_drafts`、`knowledge_history` 缓存表。
- [x] approved knowledge 才进入 FTS5 搜索。
- [x] unapproved draft 不进入全局搜索。

## 3. Confirm API Contract

- [x] 新 API 放在 `/api/v1/projects/{project_id}/knowledge...` 下，保持现有 API 版本。
- [x] 仍使用 `status / data / message / meta` envelope。
- [x] 所有文件输入只接受 `file_id`。
- [x] API 不返回本地绝对路径。
- [x] apply draft 必须带 `confirm=true`。

## 4. Confirm UI Direction

- [x] Project Detail 中现有 AI tab 可以升级为 Knowledge 视图。
- [x] 先做单项目 Knowledge flow，再做全局 Knowledge Center。
- [x] Search 后续增加 Knowledge 分组。
- [x] AI Provider 缺失时，Knowledge UI 显示可配置入口，不伪造结果。

## 5. Confirm Extraction Scope

Implemented first pass:

```text
.txt / .md / .csv / .json only
```

Deferred:

```text
.docx / .pdf and any new extraction dependency
```

Original options:

```text
Option A: .txt / .md / .csv / .json only
Option B: Option A + .docx if existing dependency supports it
Option C: Option B + .pdf if existing dependency/tool supports it
```

Reason:

```text
The beta checkpoint keeps dependency risk low and uses controlled unsupported-format failures.
```

## 6. Confirm Evidence Policy

Implemented:

```text
short excerpt + file reference
```

Original options:

```text
Option A: file reference only
Option B: short excerpt + file reference
```

Reason:

```text
User can audit why AI made a suggestion.
```

## 7. Confirm Draft Policy

Implemented:

```text
one active draft per project
```

Original options:

```text
Option A: one active draft per project
Option B: multiple draft versions per project
```

Reason:

```text
Less UI and data complexity for first V2.
```

## 8. Confirm Release Plan

- [x] V2 implementation starts after this checklist is accepted.
- [x] Each milestone must pass backend tests and frontend build/test.
- [x] Any `project.json` write path must have fixture test and backup verification.
- [x] Any installer-impacting change requires local installed validation.
- [x] Any new dependency requires explicit confirmation.

## 10. Beta Checkpoint

V2.1-V2.5 are frozen as the first V2 beta acceptance node.

Remaining confirmation gates:

- [ ] real AI generation
- [ ] semantic/vector search dependency
- [ ] packaged installer release
- [ ] batch apply across projects

## 9. Default Approval Bundle

If no changes requested, default V2 implementation starts with:

```text
Scope: Knowledge Platform only
Extraction: Option B
Evidence: Option B
Draft policy: Option A
UI: rename AI tab to Knowledge
Semantic search: spike only after FTS5 knowledge search works
```
