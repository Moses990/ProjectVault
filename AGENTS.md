# Project Vault Agent Instructions

除非用户明确要求其他语言，本项目所有回复必须使用中文。

## 开始任何开发前必须读取

1. `task_plan.md`
2. `findings.md`
3. `progress.md`

这三份文件是当前项目执行的主依据：

- `task_plan.md`：阶段顺序、交付物、验收标准。
- `findings.md`：PRD 和架构文件提炼出的产品范围、技术约束、风险。
- `progress.md`：已完成工作、验证记录、当前阶段和下一步。

## 开发必须遵守

- 严格按照 `docs/product/Project Vault V1.0 产品需求文档（PRD）.md` 的 V1 范围开发。
- 每个阶段开始前，必须读取对应的架构文件。
- 每个阶段完成后，必须按 `task_plan.md` 的验收标准检查。
- 验收通过后，必须更新 `progress.md`。
- 如阶段状态变化，必须同步更新 `task_plan.md`。

## 阶段门禁

- 不能跳阶段开发。若确实需要调整顺序，必须先更新 `task_plan.md` 的决策记录。
- 每个阶段开始时，必须先列出本阶段执行清单和验收清单。
- 每个阶段结束时，必须同时完成三类验收：功能验收、架构验收、产品范围验收。
- 未通过验收的问题必须记录到 `progress.md`，不能只在聊天中说明。
- 每次引入新依赖、改数据库结构、改 API 契约、改目录结构，都必须同步更新相关文档。

## 关键架构约束

- `project.json` 是业务数据源头。
- SQLite 只做索引缓存，不作为业务主库。
- 文件索引必须使用 `relative_path`，不能用绝对路径作为文件唯一性。
- Watcher 不能直接写数据库，只能进入事件队列。
- 前端不能直接读取本地绝对路径，资产必须通过 `file_id` 和后端流接口获取。
- Tauri 必须先验证 Python Sidecar、动态端口和退出清理，再进入深层功能开发。
- V1 不做 AI 聊天、Agent、RAG、多人协同、权限系统和云同步。

## 安全与配置

- 禁止提交真实 API Key、Token、密码、私有路径凭据。
- 本地密钥只能放在 `.env.local`、系统凭据管理器或被 `.gitignore` 排除的本地配置中。
- 示例配置只能使用占位值，例如 `YOUR_API_KEY_HERE`。
- 不读取或复制旧目录里的 `config/local_settings.json` 到新项目。

## 数据与测试

- 开发测试必须使用专门的测试目录或样例项目，不能直接破坏真实项目资料。
- 任何会写入 `project.json`、移动文件、删除文件、批量改名的功能，必须先做 dry-run 或测试样例验证。
- 运行数据库文件 `database/*.db` 不作为源代码提交。
- `release-validation/` 只保留可复查的报告、截图和说明；运行库、备份、fixture 根目录和 `paths.txt` 不作为源码提交。
- 提交前必须复查高风险验证产物：`git ls-files release-validation | rg "(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)"` 应无命中。
- 每个核心阶段至少保留一条可复现验证命令或检查方法。

## V1.3 / V1.4 工作流

- 涉及视觉、信息架构或 onboarding 时，先读取 `docs/planning/NEXT_PRODUCT_DIRECTION.md`、`docs/planning/V1_3_VISUAL_ALIGNMENT_PLAN.md`、`docs/planning/V1_4_ONBOARDING_WORKFLOW_PLAN.md`。
- 执行 V1.3 / V1.4 任务前，先判断任务类别：视觉样式调整、信息架构调整、交互流程调整、组件抽象、真实 API 接入、桌面端启动或打包问题。
- 除非任务明确属于后端、数据库或 Tauri 启动/打包问题，不得主动修改 `backend/`、`database/`、`desktop/src-tauri/` 的核心逻辑。
- UI 修改优先集中在 `frontend/`，复用现有组件、`frontend/lib/api.ts`、现有状态管理方式和 `frontend/app/globals.css` token/class。
- V1.3 视觉对齐以 `archive-essence-design` 的 Sidebar、TopBar、grid background、dense information layout 为参考，但必须复用现有 Next/FastAPI/SQLite/Tauri 架构和真实 API。
- V1.3 当前已完成视觉基线、Dashboard/Sidebar/TopBar、二级页面 polish、Project Detail 数据态复查和全局残余样式清理；后续 UI 任务应基于现状收口，不再重做 shell。
- 不复制参考项目 mock 数据；没有真实数据时使用专门 fixture，并记录到 `release-validation/`。
- V1.4 onboarding 优先复用现有 Settings、Dashboard、Sidebar、候选发现、初始化、扫描、AI Provider、备份 API；不要为首轮流程新增后端接口或数据库 schema，除非现有 API 无法覆盖。
- 可选 AI Provider 和备份设置不能阻塞项目初始化；跳过状态只允许保存在浏览器本地状态，不写入业务数据。
- V1.4 当前已完成 Settings onboarding、Dashboard readiness、Sidebar 状态、可选 AI、可选备份和开发态端到端回归；剩余重点是 packaged installer / 本机安装包路径复验。
- 品牌方向保持 `Project Vault`，沿用 `frontend/app/components/Sidebar.tsx` 的 `project-vault-logo.svg`、`brand-mark`、`brand-copy` 和 archive 深色密集视觉；不要引入无依据的新 LOGO、吉祥物、营销口号或独立品牌系统。

## Git 与变更管理

- 开发前查看当前工作区状态，避免覆盖用户改动。
- 完成一个阶段并通过验收后，应形成一个清晰检查点。
- 不执行破坏性 Git 操作，例如 `reset --hard` 或强制覆盖用户文件，除非用户明确要求。
- 发现非本次任务产生的修改时，先保留并说明，不擅自回滚。

## 运行环境

- 主工作区固定为 `D:\Workflows\ProjectVault`。
- 开发工具位于 `D:\DevTools`。
- 新增工具或依赖时，优先安装或缓存到 D 盘。
- 注意 3000 和 8000 端口冲突；启动失败时先检查旧进程。
- npm 审计修复不得随意使用 `--force`，除非已确认不会破坏 Next/React 版本兼容。

## 常用验证命令

- 前端构建：在 `frontend` 目录运行 `cmd /c npm run build`。
- 前端测试：在 `frontend` 目录运行 `cmd /c npm run test`。
- 后端测试：在 `backend` 目录优先使用 `.venv\Scripts\python.exe -m unittest discover -s tests -v`。
- 桌面 Rust 检查：在 `desktop/src-tauri` 目录运行 `cargo check`。
- 静态样式回归：`rg -n 'style=\{\{|style="' frontend/app`；当前只允许 `DirectoryTree.tsx` 的动态 `--tree-depth` 变量。
- Git whitespace 检查：`git diff --check`；若只出现既有 LF/CRLF 提示，需在结果中说明。
- 本地 Web 验证遇到端口占用时，不强杀无关旧进程；优先换用 3002、3003、3004 等临时端口，并在 `progress.md` 记录实际端口。

## 阶段流程

```text
读取 task_plan.md
↓
读取 findings.md 和 progress.md
↓
读取当前阶段相关架构文件
↓
列出本阶段执行清单
↓
开发
↓
按架构文件和 task_plan.md 验收
↓
更新 progress.md
↓
必要时更新 task_plan.md
```

## 当前主工作区

`D:\Workflows\ProjectVault`

原桌面目录只作为历史来源，不再作为主开发目录。
