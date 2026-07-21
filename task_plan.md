# Project Vault 当前实施计划

> 最后更新：2026-07-20
> 本文件只保存当前阶段状态、长期边界和阶段门禁。逐次执行过程不再在这里累积；验证过程与最近进度见 `progress.md`，仍有效的技术事实与风险见 `findings.md`。

## 当前状态

- 当前版本：V2.0，已正式冻结。
- 阶段 0～10 已完成并冻结；本计划止于阶段 10。
- 阶段 7～10 已通过 [GitHub PR #9](https://github.com/Moses990/ProjectVault/pull/9) 并入远端主线，功能集成 merge SHA 为 `95862182a03ad5f46eee859fd15800c36d61637e`。
- 当前没有后续产品阶段；未来需求应单独立项，不延续本阶段编号。
- 安全加固：`fix/security-hardening-20260720` @ `ce60880`（冻结后维护，不新增产品功能；详见 `findings.md` 安全加固节）。

## 文件职责

- `task_plan.md`：当前阶段顺序、交付物、验收门禁和长期决策。
- `findings.md`：仍影响实现的架构事实、风险与已证实问题。
- `progress.md`：最近工作、验证结果、远端状态和恢复入口。
- Git、PR、CI 和本地验收报告承担详细历史追溯；不在本文件重复旧流水。

## 长期产品与数据边界

1. `project.json` 是业务真源；SQLite、FTS 和缓存均为可重建派生层。
2. 文件唯一性使用 `(project_id, relative_path)`；资源操作通过稳定 `file_id` 解析，并拒绝路径逃逸、符号链接和 junction。
3. Watcher 只写事件队列；增量扫描必须接收聚合后的 `changed_paths`，冷却窗口不能丢事件。
4. Knowledge 只允许 `Draft → 人工确认 → 备份 → 原子写入 → SQLite/FTS 同步`，不得绕过审阅直接写真实项目。
5. Provider 密钥只进入系统凭据管理器；SQLite 只保存引用。无认证服务必须由独立 `auth_mode="none"` 明确表达。
6. 开发和回归使用临时数据库、隔离 fixture 与 Mock Provider；正式数据库和真实项目默认只读。
7. 未经单独立项，不增加聊天、Agent、RAG、向量检索、OCR、网络搜索、云同步、多用户或权限系统。
8. 公开提交不得包含真实项目清单、绝对路径、截图、数据库、密钥或新增的本地 `docs/reviews/` 材料。

## 阶段门禁

### 启动阶段前

- 读取 `AGENTS.md`、`task_plan.md`、`findings.md`、`progress.md` 和相关架构文档。
- 明确目标、交付物、非目标、数据边界、执行清单和验收清单。
- 检查工作区与远端基线，保留无关的本地修改。
- 涉及 Schema、API、依赖、目录或发布链时，先确认迁移、回滚和文档同步方案。

### 关闭阶段前

- 完成功能、架构、产品范围和数据安全验收。
- 运行与风险匹配的专项测试、全量测试、构建或桌面验证，并记录真实结果。
- 对正式库和真实项目只做授权范围内的操作；需要写入时必须先备份并验证回滚。
- 更新三份连续性文件；只有验收通过后才能进入下一阶段。
- 提交前使用明确文件列表复查差异、隐私、生成物和 `git diff --check`。

## 当前阶段摘要

| 阶段 | 状态 | 交付与验收摘要 |
| --- | --- | --- |
| 0：真实使用反馈审查 | complete | 只读审查真实工作区，以隔离 fixture 复现问题并形成分阶段修复边界。 |
| 1：项目发现与初始化 | complete | 修复候选识别、层级发现和初始化安全；不把普通目录误写为项目。 |
| 2：索引审计与恢复 | complete | 建立备份、dry-run、可控重建和同卷原子恢复；SQLite 继续作为派生层。 |
| 3：搜索重构 | complete | 统一 FTS5 查询、结果契约与路径导航，并覆盖大结果集变量上限。 |
| 4：CAD Center | complete | 完成保守分类、未分类兜底、真实库只读核验和表格可用性。 |
| 5：展示层与历史体验 | complete | 统一名称、时间和历史展示；不改原始历史数据。 |
| 6：Settings、Onboarding 与桌面恢复 | complete | 完成设置、原生目录选择、首次启动、运行库对齐和 Windows SQLite 恢复链路。 |
| 7：Dashboard 产品化 | complete | 单个只读 summary 聚合、最近项目和活动降级策略已验收；不修改 Schema 或真实项目数据。 |
| 8：Project Library / Detail 产品化 | complete | 项目库、Files 目录树、Materials 可用性和 History 已验收；资源访问保持相对路径与只读边界。 |
| 9：全局搜索与命令面板 | complete | 统一结果模型、Ctrl+K、结果页和跨模块导航已验收。 |
| 10：AI Provider 与 Project Knowledge | complete | Provider 安全、模型选择、来源选择、Draft 审阅、History、桌面候选包和隔离端到端验收已完成。 |

## 阶段 7 / 8 保留门禁

`AGENTS.md` 要求相关改动先读取本节。阶段 7、8 已冻结；后续回归应保持：

- Dashboard 使用单个只读 summary 聚合；活动查询失败只能让活动模块降级，不能拖垮其余数据。
- Project Library / Detail 不得借机修改 Schema、真实 `project.json`、正式索引、历史或项目文件。
- Files 以物理目录导航、SQLite 补充元数据，必须保留空目录并区分 `indexed` / `available`。
- Materials 使用 `LEFT JOIN files`；缺失文件记录保留为 `available=false`，前端禁用不可用操作。
- 涉及阶段 7、8 的修改至少运行对应后端专项、前端专项、Next build、`cargo check`、`cargo test` 和 `git diff --check`；视觉改动需复核 1024×800。

## 当前验证基线

| 检查 | 最近确认结果 |
| --- | --- |
| 后端全量 | 154/154 通过 |
| 前端全量 | 100/100 通过 |
| Next 静态构建 | 通过，生成 11 页 |
| Rust | `cargo check` 通过；`cargo test` 2/2 通过 |
| GitHub 必需检查 | PR #9 `ci` 通过 |
| V2.0 安装包 | NSIS 构建通过；隔离本机安装验收 37/37 通过 |

这些数字是阶段 10 收口基线，不自动代表未来修改仍然通过；任何新阶段都必须重新验证受影响范围。

## 历史压缩摘要

- V1 基础与发布：完成桌面壳、数据库、项目发现、全量/增量扫描、Watcher、FTS5、API、前端 MVP、CAD Center、安装包与 Windows 验收，并发布 V1 系列检查点。
- V2.0：完成 Knowledge 架构规划、缩略图隔离、Provider 网络与凭据边界、真实 Provider 草稿验证、增量扫描和安装包收口，并正式冻结。
- 真实使用反馈：按上表阶段 0～10 完成发现、索引、搜索、展示、设置、Dashboard、项目库、Provider 与 Knowledge 的产品化和安全加固。
- 旧日期流水、重复状态切换、临时阻塞和逐次命令已从本文件移除；需要追溯时查看 Git/PR、`progress.md` 及本地验收记录。

## 冻结状态

V2.0 是本计划的最终冻结版本，不再新增阶段。未来如有需求，使用新的独立计划管理。
