# Project Vault Phase 0 到 11 产品实施计划

> 当前事实更新时间：2026-07-20
> 本文件保留阶段顺序、交付物与验收标准，供 `AGENTS.md` 阶段门禁使用。后续各节中的“当前状态”和日期是历史检查点，不代表此刻状态；当前执行事实以本节、`findings.md` 和 `progress.md` 为准。
> 历史条目中的 `docs/reviews/` 路径仅是本地验收证据索引；公开仓库不随附包含真实环境信息的报告、截图或清单。

## 当前执行摘要（2026-07-20）

- V2 Beta `2.0.0-beta.1` 与阶段 10 已完成验收；阶段 11 未定义、未启动。
- 当前任务是把阶段 7～10 的已验收实现经代码审查、必需 CI 和 PR 并入远端 `main`。
- 公开集成不包含新增 `docs/reviews/`、截图、真实项目清单、本机绝对路径或本地阶段标签。
- 合并前门禁：后端全量、前端全量、Next 静态构建、Rust 检查、`git diff --check`、公开差异隐私扫描、GitHub 必需检查 `ci`。
- 本轮只完成远端集成与连续性文件同步，不进入阶段 11，不修改真实项目文件或正式数据库。

## 目标

把 Project Vault 从"文档和原型"推进到一版可本地运行的 V1 产品。V1 的核心价值是：自动读取现有项目目录和 `project.json`，建立 SQLite 索引，让用户能快速浏览项目、搜索文件、管理 CAD 图纸，并管理 AI Provider 配置。

## 产品边界

### V1 必须实现

- Dashboard：首页指标、最近项目、活动记录。
- Projects：项目列表、筛选、排序、收藏、打开项目。
- Project Detail：Overview、Files、Drawings、Materials、AI、History 六个 Tab。
- Search：全局搜索，支持 Ctrl+K。
- CAD Center：跨项目 CAD 汇总、分类、版本链。
- AI Center：Provider 管理、测试连接、安全保存密钥引用。
- Settings：项目根目录、扫描设置、缓存/备份入口。

### V1 明确不做

- OA、报销、任务管理、思维导图。
- 在线 CAD 查看、在线编辑文件。
- AI 聊天、Agent、RAG、多人协作、权限系统、网同步。
- 跨项目材料库。

## 总体开发原则

1. 先打通运行链路，再做完整页面。
2. 先做数据库和扫描器，再做搜索，再做前端。
3. `project.json` 是业务资源元数据，SQLite 只做索引缓存。
4. 文件表使用 `relative_path`，不能把绝对文件路径作为文件唯一性。
5. 任何阶段没有通过验收，不进入下一阶段。
6. 每次完成阶段必须更新 `progress.md`。

## 项目管理规则

### 阶段启动检查

每个阶段启动前必须完成：

- 读取 `AGENTS.md`。
- 读取 `task_plan.md / findings.md / progress.md`。
- 读取本阶段相关架构文档。
- 列出本阶段执行清单。
- 列出本阶段验收清单。
- 确认没有未处理的接口冲突、依赖安装失败或数据库迁移陷阱。

### 阶段验收检查

每个阶段结束时必须完成：

- 功能验收：功能是否达到本阶段目标。
- 架构验收：是否遵循数据库、API、扫描器、Watcher、Tauri 等架构层约定。
- 产品范围验收：是否符合 PRD，是否做了 V1 明确不做内容。
- 验证记录：命令、接口返回、页面检查或数据库检查必须写入 `progress.md`。
- 文档同步：如接口、表结构、目录、启动方式变化，必须更新对应文档。

### 安全与数据保护

- 禁止提交真实 API Key、Token、密码。
- 真实配置只允许放在被忽略的本地文件或系统密钥管理器中。
- 批量写入、删除、移动真实项目文件前必须使用测试项目验证。
- 任何会修改 `project.json` 的功能必须保留回滚或备份策略。

### 依赖与环境规则

- 开发工具优先使用 `D:\DevTools`。
- 项目主目录固定为 `D:\Workflows\ProjectVault`。
- 依赖安装物如 `.venv`、`node_modules`、`.next`、运行数据库不得作为源代码提交。
- npm 审计恢复不能直接使用 `--force`，除非单独确认版本兼容。

### 检查点规则

- 每完成一个 Phase，必须在 `progress.md` 记录完成时间、改动清单、验证结果和遗留风险。
- 若阶段状态从 `pending` 变为 `in_progress` 或 `complete`，必须同步更新本文件。
- 若发现计划顺序需要调整，必须在"决策记录"中说明原因。

## 阶段计划

### Phase 0：工具准备与可运行骨架

状态：complete

目标：建立正式项目结构，确认后端、数据库、前端能跑通。

交付物：

- `backend/` FastAPI 框架。
- `frontend/` Next.js 框架。
- `desktop/` Tauri 预留目录。
- `database/` SQLite 运行目录。
- `docs/` 文档结构。
- 健康检查接口 `GET /api/v1/health`。
- SQLite 初始表结构。

验收标准：

- 后端可启动。
- 前端可启动。
- `GET /api/v1/health` 返回 `status=ok`。
- `database/project_vault.db` 自动生成。
- 基础表存在：`projects / files / drawings / materials / ai_metadata / ai_providers / scan_history / system_settings`。
- 前端页面显示 Backend online 和 Database ready。

验证命令：
```powershell
cd D:\Workflows\ProjectVaultackend
.venv\Scripts\python.exe -m compileall app
```

```powershell
cd D:\Workflows\ProjectVaultrontend
npm run build
```

### Phase 1：桌面壳链路验证

状态：complete

目标：验证 Tauri 能启动并守护 Python 后端，避免后期打包返工。

交付物：

- `desktop/` 中的最小 Tauri 应用。
- Python 后端 Sidecar 打包或可执行启动验证。
- 动态端口分配方案。
- 前端读取后端端口的方案。
- 应用退出时清理 Python 进程。

验收标准：

- Tauri 窗口能打开。
- Tauri 能拉起 Python 后端。
- 前端能请求 `/api/v1/health`。
- 固定端口冲突不会阻止应用启动。
- 关闭窗口后无残留 Python 后端进程。

不通过时不能继续：

- 如果 Sidecar 无法启动或退出清理失败，不进入扫描器阶段。

### Phase 2：数据库 Schema 与迁移机制

状态：complete

目标：把文档中的数据库设计落到代码，并支持后续升级。

交付物：

- 完整 SQLite Schema。
- `schema_migrations` 或等效迁移记录。
- `PRAGMA journal_mode=WAL`。
- `PRAGMA auto_vacuum=INCREMENTAL`。
- Repository 层基础封装。

验收标准：

- 全部 V1 表创建完成。
- 可重复启动，不重复破坏已有库。
- 删除数据库后可自动重建。
- `files` 表使用 `UNIQUE(project_id, relative_path)`。
- 不出现 `file_path` 作为文件唯一索引。

### Phase 3：项目发现与初始化

状态：complete

目标：解决"存量项目如何进入系统"的冷启动问题。

交付物：

- `GET /api/v1/projects/candidates`。
- `POST /api/v1/projects/initialize`。
- 只扫描根目录第一层的候选发现逻辑。
- 初始化时写入默认 `project.json`。

验收标准：

- 能列出没有 `project.json` 的候选文件夹。
- 不自动把候选目录写入数据库。
- 用户确认后才写入 `project.json` 并进入扫描。
- 已有 `project.json` 的项目不会被重复初始化。

### Phase 4：Full Scanner

状态：complete

目标：扫描项目根目录，读取 `project.json`，写入项目和文件索引。

交付物：

- Scanner Engine。
- 项目识别：必须存在 `project.json`。
- 文件扫描：写入 `files.relative_path`。
- 项目统计：文件数、CAD 数、材料数。
- 扫描历史记录。

验收标准：

- 能扫描测试项目并写入 SQLite。
- 项目、文件、图纸、材料数量正确。
- 路径全部按相对路径存储。
- 同一项目重复扫描不会制造重复记录。
- 扫描错误会写入 `scan_history`。

### Phase 5：增量扫描与符号迁移

状态：complete

目标：支持文件新增、修改、删除、移动，并避免移动盘符变化造成数据灾难。

交付物：

- Hash Diff。
- 增量扫描。
- 项目 Relocation 处理。
- 删除安全边界。

验收标准：

- 新文件、修改文件、删除文件都正确更新数据库。
- 相同 `project_id` 但 `project_path` 变化时只更新项目路径。
- 不因旧路径消失而级联删除项目数据。
- 增量扫描正确率目标大于 99%。

### Phase 6：File Watcher 与事件队列

状态：complete

目标：监控本地变化，但保持 Watcher 轻量和安全。

交付物：

- Watchdog 监听器。
- Event Queue。
- 2 秒防抖。
- 临时文件黑名单。
- Watcher 不直接写数据库。

验收标准：

- Create / Modify / Delete / Move 事件能进入队列。
- `.bak / .sv$ / ~$*.docx / Thumbs.db / desktop.ini` 等被忽略。
- 常规变化 2 秒内触发同步。
- Watcher 不直接执行数据库写入。

### Phase 7：FTS5 全局搜索

状态：complete

目标：实现用户 3 秒内定位任意项目和资产的核心能力。

交付物：

- FTS5 虚拟表。
- 项目、文件、CAD、材料索引。
- `GET /api/v1/search`。
- Recent Search 预留。

验收标准：

- 能搜索项目名、项目 ID、文件名、CAD 名称、材料名、标签、备注。
- 10,000 文件内容查询小于 100ms。
- 搜索结果按 Projects / Files / CAD / Materials 分类。

### Phase 8：核心 API 完整化

状态：complete

目标：为前端页面提供稳定的数据接口。

交付物：

- Dashboard APIs。
- Projects APIs。
- Project Detail APIs。
- Files APIs。
- Drawings APIs。
- Materials/Assets APIs。
- Settings APIs。
- History APIs。
- Scanner APIs。

验收标准：

- API 返回结构统一：`status / data / message / meta`。
- Projects 列表支持筛选、排序、分页。
- 文件列表返回 `relative_path`。
- 资产预览只能通过 `file_id` 请求。
- Scanner 状态与触发入口可用。
- 不出现 `GET /api/file?path=C:/...` 这类路径直传接口。

### Phase 9：前端 MVP

状态：complete

目标：做出可实际使用的 V1 界面。

交付物：

- Dashboard。
- Projects 表格/卡片。
- Project Detail 六 Tab。
- Command Palette。
- Settings。
- AI Center Provider 管理。

验收标准：

- 用户能从 Dashboard 进入项目。
- 用户能筛选、排序、收藏项目。
- 用户能查看项目文件、CAD、材料、AI 字段和历史。
- Ctrl+K 能搜索资产。
- AI Center 只做 Provider 管理，不做 AI 聊天。
- 页面在桌面窄屏和宽屏下不出现明显内容重叠。

### Phase 10：CAD Center

状态：complete

目标：让用户不用资源管理器也能快速找图。

交付物：

- CAD 分类识别。
- CAD 版本链。
- CAD Center 跨项目列表。
- 快速打开图纸和项目。

验收标准：

- 平面图、立面图、天花板图、节点图、构造图、其他都能分类。
- 版本链能识别 V1、V2、FINAL 等常见命名。
- 分类准确率目标大于 90%。

### Phase 11：系统功能与维护任务

状态：complete

目标：补充日常使用、维护和安全边界。

交付物：

- Explorer Open / Reveal Folder。
- Settings 保存。
- History 页面。
- 数据库维护任务。
- 日志保留策略。
- 备份/恢复入口。

验收标准：

- 打开文件功能只对本地可访问且属于受管项目根目录的路径生效。
- `scan_history` 普通日志保留 30 天。
- Warning/Error 最长保留 180 天。
- 数据库维护任务都能执行 `incremental_vacuum`。
- 备份/恢复入口只操作 SQLite 缓存，不修改项目业务文件。

### Phase 12：V1 Release Candidate

状态：complete

目标：冻结 V1 功能，完成发布前验收。

交付物：

- V1 RC 构建。
- 发布检查清单。
- 使用说明。
- 回滚和重建说明文档。

验收标准：

- Full Scan 通过。
- Incremental Scan 通过。
- Watcher 通过。
- SQLite/FTS5 通过。
- Dashboard/Projects/Files/CAD Center 通过。
- Settings/History/Explorer Integration 通过。
- Tauri Sidecar lifecycle 通过。
- 查询小于 100ms。
- 支持 100,000 文件测试。
- 启动小于 3 秒。

## Phase 12 RC 状态记录（2026-06-25）

- 开发环境 RC 验收脚本已通过：`scripts/phase12_rc_check.py --files 100000`。
- 100k 临时样本结果：Full Scan 100,004 files / 25,011 ms；known changed-path Incremental Scan 370 ms；FTS rows 100,008；Search 2.869 ms；Backup/Restore 通过。
- 已新增发布文档：`docs/release/V1_RC_CHECKLIST.md`、`docs/release/USER_GUIDE.md`、`docs/release/ROLLBACK_REBUILD.md`。
- 发布门禁已通过：生产级 Tauri Sidecar 打包完成；`externalBin` 已配置；桌面主进程已改为启动 bundled sidecar；clean Windows Sandbox 已验证无 Python/Node 环境可安装并启动。

## 当前状态

- Phase 0 已完成。
- Phase 1 已完成。
- Phase 2 已完成。
- Phase 3 已完成。
- Phase 4 已完成。
- Phase 5 已完成。
- Phase 6 已完成。
- Phase 7 已完成。
- Phase 8 已完成。
- Phase 9 已完成。
- Phase 10 已完成。
- Phase 11 已完成。
- Phase 12：V1 Release Candidate 已完成。
- Phase 12.1 Production Sidecar Packaging 与 Clean Windows backend/sidecar validation 已完成。
- Phase 12.2 Packaged UI Render Validation / V1 Final Clean Windows 验收已完成。
- Phase 13：V1 发布收口与实机使用验证已完成；Phase 13.1、13.2、13.3、13.4 均已完成。
- Phase 14：V2 Knowledge Platform 已确认；V2.1-V2.5 已完成自动测试、浏览器/Chrome smoke、人工验收，并固化为首个 V2 beta 可验收节点；V2.6 Local Semantic Search Spike 已完成，结论为暂不引入向量依赖。

## V1.2.1 Installer Hotfix（2026-06-29）

- 状态：complete。
- 修复 1：WebView2 Fixed Runtime 检测——`check_webview2_runtime()` 新增 bundled Fixed Runtime 目录和 Program Files Evergreen 路径检查。
- 修复 2：Dashboard 前端重试——`page.tsx` 增加自动重试（3 次/2s 间隔）和手动重试按钮。
- 修复 3：FastAPI CORS origin——`main.py` 将硬编码 `allow_origins` 改为 `allow_origin_regex` 匹配任意 loopback 端口。
- NSIS installer 重新打包验证通过：246,769,064 bytes。
- 详细记录见 `progress.md`。

## 决策记录

- 新工作区固定为 `D:\Workflows\ProjectVault`。
- 原桌面目录作为历史源保留，不再作为主开发目录。
- 原 `docs/project-management` 是历史"本地项目舵手"规划，不做为 Project Vault 主规划。
- Project Vault 主规划以根目录 `task_plan.md` 为准。

## Phase 12.1 Production Sidecar Packaging 更新（2026-06-25）

状态：complete。生产 sidecar 打包链路已在本机实现，clean Windows 10/11 无 Python/Node 安装启动验收已通过。

已完成：

- 新增 `scripts/build_backend_sidecar.ps1`，用 PyInstaller 生成 Windows sidecar exe。
- 新增 `backend/requirements-build.txt`，把 PyInstaller 固定为构建依赖，不混入运行依赖。
- `desktop/src-tauri/tauri.conf.json` 已配置 `bundle.externalBin: ["binaries/project-vault-backend"]`。
- `desktop/src-tauri/src/main.rs` 已改为通过 Tauri shell sidecar 启动 `project-vault-backend`，不再依赖 `backend/.venv/Scripts/python.exe`。
- PyInstaller frozen 环境的默认 SQLite 路径已改为 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`，避免写入临时解包目录。
- 新增 `backend/tests/test_phase12_sidecar_packaging.py`，锁定 sidecar 构建脚本、Tauri externalBin、Rust launcher 和 frozen 数据库路径。

Clean Windows 验收结果：

- Windows Sandbox 中 `python` 与 `node` 均不可执行。
- NSIS installer 静默安装成功，退出码为 0。
- 安装后的 `project-vault.exe` 可启动。
- Bundled `project-vault-backend` sidecar 可启动，health 地址为 `http://127.0.0.1:49829/api/v1/health`，返回 `status=ok`。
- SQLite 路径为 `C:\Users\WDAGUtilityAccount\AppData\Local\ProjectVault\database\project_vault.db`，符合 `%LOCALAPPDATA%\ProjectVault\database` 约束。
- 关闭桌面应用后 `project-vault-backend` 退出清理通过。
- 验收报告：`release-validation/clean-windows-validation.json`，`passed: true`。

## Clean Windows 最终门禁复查（2026-06-25 17:35）

状态：blocked by environment。生产 sidecar 打包链路与自动化验收脚本已准备，但当前宿主机仍不能执行最终 clean Windows 验收。

复查结论：

- Windows Sandbox 不可用：`C:\Windows\System32\WindowsSandbox.exe` 不存在。
- Hyper-V 服务存在，但当前进程执行 `Get-VM` 无权限，不能创建或管理 clean VM。
- Docker 当前为 `desktop-linux` 上下文，不能代表 Windows 桌面 installer 验收。
- WSL 无发行版，且不是 Windows installer 验收目标。
- 未发现 VirtualBox、VMware、QEMU、Vagrant、Packer 或云 CLI 可即时提供 clean Windows 桌面环境。
- Computer Use 可见的 Project Vault 窗口来自 `desktop\src-tauri\target\debug\project-vault.exe`，属于宿主机 debug build，不是 clean 环境安装结果。
- 宿主机 health 命中开发库 `D:\Workflows\ProjectVault\database\project_vault.db`，不能作为 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db` 的 clean packaged app 证据。

V1 Final 门禁：必须在 clean Windows 10/11、无 Python/Node 的独立环境中运行更新后的 `scripts/verify_clean_windows_release.ps1`，取得 `clean-windows-validation.json` 的 `passed: true`，并人工确认安装后的主 Dashboard 可渲染后，才能把 Phase 12 / V1 Final 标记为 complete。

## Clean Windows 验收完成记录（2026-06-25 17:52）

状态：complete。此前环境阻塞已解除，Windows Sandbox 成功运行 clean Windows validation。

验收证据：

- 报告文件：`release-validation/clean-windows-validation.json`。
- 报告结论：`passed: true`。
- installer：`Project Vault_0.1.0_x64-setup.exe`，大小 21,794,961 bytes。
- `python_unavailable`：pass。
- `node_unavailable`：pass。
- `installer_silent_run`：pass，退出码 0。
- `app_started`：pass。
- `backend_health`：pass，`status=ok`。
- `database_path`：pass，数据库位于 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`。
- `backend_exit_cleanup`：pass。

V1 Final 判定：Phase 12 / V1 Final 可以标记为 complete。

## Phase 12.2 Packaged UI Render Validation（2026-06-25）

状态：complete。

问题：

- clean Windows 自动验收曾通过 installer、sidecar health、数据库路径与退出清理，但手动打开 Sandbox 桌面应用时没有出现主页面。

根因：

- Tauri `frontendDist` 原先指向 `../../frontend/.next`。`.next` 是 Next.js 内部构建目录，不是可直接由 Tauri WebView 加载的静态站点。

修复：

- `frontend/next.config.ts` 已改为 `output: "export"` 与 `trailingSlash: true`。
- `desktop/src-tauri/tauri.conf.json` 已改为 `frontendDist: "../../frontend/out"`。
- 删除静态导出不兼容的 `frontend/app/api/health/route.ts`。
- Project Detail 从动态 `/projects/[id]` 改为静态 `/project-detail?id=...`，相关 Dashboard、Projects、CAD Center、History、Command Palette 跳转已同步。
- `frontend/lib/api.ts` 改为每次请求动态读取 `window.__BACKEND_PORT__`，避免端口注入时序导致请求走错相对路径。
- `scripts/verify_clean_windows_release.ps1` 已新增 `app_main_window` 检查，防止只验证 backend health 而漏掉主窗口。

本机验证：

- `cmd /c npm run build` 通过，静态导出生成 `frontend/out`，路由包含 `/`、`/project-detail`、`/projects`、`/cad-center`、`/history`、`/settings`、`/ai-center`。
- `cargo check` 通过。
- `backend\.venv\Scripts\python.exe -m unittest tests.test_phase12_sidecar_packaging -v` 通过，新增测试锁定 Tauri 使用 `frontend/out` 且不再指向 `.next`。
- `cmd /c npm run check` 通过，已重新生成 `Project Vault_0.1.0_x64-setup.exe`。
- 用户确认：本地安装后的 Project Vault 可以打开主页面。

仍需完成：

- 在 clean Windows Sandbox 中用更新后的 installer 重新运行 `verify_clean_windows_release.ps1`。
- 确认报告包含 `app_main_window=pass`。
- 人工确认 Sandbox 中主 Dashboard 可见、核心导航可切换。

## Phase 12.2 Packaged UI Render Validation 更新（2026-06-25 18:40）

状态：in_progress。已完成本机修复、打包和 smoke；仍等待 clean Windows Sandbox 复验，V1 Final 暂不能标记 complete。

修复内容：

- 桌面主进程启动内置静态前端 HTTP server，只监听 `127.0.0.1:<frontend_port>`。
- WebView 改为导航到 `http://127.0.0.1:<frontend_port>/`。
- 静态 server 通过 Tauri asset resolver 服务 `frontend/out` 打包资源。
- HTML 返回前注入 `window.__BACKEND_PORT__ = <backend_port>`，避免导航时序导致端口注入丢失。
- 子路由资源请求如 `/projects/_next/static/...` 会归一化到 `/_next/static/...`。
- `scripts/verify_clean_windows_release.ps1` 新增 `frontend_render`，要求 packaged frontend HTML 包含 `Project Vault V1` 和 `__BACKEND_PORT__`，防止只验证窗口存在导致黑屏误判。

本机验收记录：

- `backend/.venv/Scripts/python.exe -m unittest tests.test_phase12_sidecar_packaging -v`：7 tests OK。
- `cargo check`：通过。
- PowerShell 验收脚本语法检查：通过。
- `cmd /c npm run build`：通过。
- `backend/.venv/Scripts/python.exe -m compileall app tests`：通过。
- `cmd /c npm run check`：通过，重新生成 `desktop/src-tauri/target/debug/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`。
- 本机 packaged smoke：frontend HTML、嵌套路由 `_next` 资源、backend health、`%LOCALAPPDATA%` 数据库路径均通过。

最终验收标准：

- 在 clean Windows Sandbox 使用最新 installer 和更新后的 `verify_clean_windows_release.ps1` 重新运行。
- `clean-windows-validation.json` 必须 `passed=true`。
- steps 中必须包含 `frontend_render=pass`。
- 人工确认安装后 Dashboard 主页面可见，核心导航可切换。

## Phase 12.2 Release GUI Installer 更新（2026-06-25 19:05）

状态：in_progress。已确认此前 Sandbox 反复出现的黑色窗口来自 debug NSIS build；该窗口标题为完整 exe 路径，属于 console subsystem，不是最终 GUI WebView 验收对象。

已完成：
- `cmd /c npm run build` 已生成 release NSIS installer：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`。
- release `project-vault.exe` 已验证为 Windows GUI subsystem；debug `project-vault.exe` 为 Console subsystem。
- `scripts/ProjectVaultCleanWindows.wsb` 已从 debug NSIS 目录改为映射 release NSIS 目录。

仍需完成：
- 关闭当前 Windows Sandbox 并重新打开 `scripts/ProjectVaultCleanWindows.wsb`。
- 重新运行 clean Windows validation，确认 `passed=true`、`app_main_webview_window=pass`、`frontend_render=pass`。
- 人工确认 Sandbox 中打开的是标题为 `Project Vault` 的 Dashboard 主窗口，而不是完整 exe 路径标题的黑色控制台窗口。

## Phase 12.2 WebView2 Runtime Packaging 更新（2026-06-25 19:15）

状态：in_progress。release GUI installer 在 Sandbox 中已显示 `Project Vault` 主窗口，但 clean Windows 当前用户缺少 WebView2 Runtime，导致 Tauri 弹出 `Could not find the WebView2 Runtime`。

修复：
- `desktop/src-tauri/tauri.conf.json` 已配置 `bundle.windows.webviewInstallMode.type = offlineInstaller`、`silent = true`，由 NSIS 安装包负责安装 WebView2 Runtime。
- 已重新执行 `cmd /c npm run build` 生成 release NSIS installer，包体大小为 223,434,661 bytes，符合嵌入 WebView2 离线安装器后的量级。
- `scripts/verify_clean_windows_release.ps1` 新增 `webview2_runtime_available` 验收步骤，安装后必须检测到 WebView2 Runtime，否则失败。

仍需完成：
- 关闭并重新打开 Windows Sandbox，使用最新 release NSIS installer 重新运行 clean validation。
- 报告必须包含 `webview2_runtime_available=pass`、`app_main_webview_window=pass`、`frontend_render=pass` 且 `passed=true`。
- 人工确认 Dashboard 主页面可见。

## Phase 12.2 WebView2 Fixed Runtime Packaging 更新（2026-06-26 09:21）

状态：in_progress。上一轮 `offlineInstaller` 能让 Sandbox 报告 WebView2 注册表存在，但手动打开仍出现 `Could not find the WebView2 Runtime`，说明仅检查 Evergreen Runtime 注册表不足以证明 Tauri/Wry 可创建 WebView。

修复：

- `desktop/src-tauri/tauri.conf.json` 已从 `offlineInstaller` 改为 `webviewInstallMode.type = fixedRuntime`。
- 新增 `scripts/prepare_webview2_fixed_runtime.ps1`，固定下载并校验 Microsoft WebView2 Fixed Version Runtime `149.0.4022.96` x64，SHA256 为 `C4B3F527B5C6D29BAFFB6EC6B4E1EC7404F9417AC4153DAA57634B389203FDF4`。
- Fixed runtime 解压目录为 `desktop/src-tauri/binaries/webview2-fixed-runtime/Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64`，其中包含 `msedgewebview2.exe`。
- `.gitignore` 已排除 `desktop/src-tauri/binaries/webview2-fixed-runtime/`，大体积运行时由准备脚本重建，不作为源码提交。
- `scripts/verify_clean_windows_release.ps1` 已新增 `fixed_webview2_runtime_bundled` 与 `webview2_runtime_error_dialog_absent`，不再把 `frontend_render=pass` 或 WebView2 注册表存在误判为 UI 最终通过。
- 已重新执行 release build，最新 installer 为 `desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`，大小 `240,129,228` bytes。

本机验证：

- `backend/.venv/Scripts/python.exe -m unittest tests.test_phase12_sidecar_packaging -v`：12 tests OK。
- PowerShell 语法检查：`verify_clean_windows_release.ps1` 与 `prepare_webview2_fixed_runtime.ps1` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\prepare_webview2_fixed_runtime.ps1`：fixed runtime already prepared。
- `cmd /c npm run build`：frontend build 通过。
- `backend/.venv/Scripts/python.exe -m compileall app tests`：通过。
- `cargo check`：通过。
- `cd desktop; cmd /c npm run build`：release NSIS 生成成功。

仍需完成：

- 关闭并重新打开 Windows Sandbox，使用最新 release NSIS installer 重新运行 clean validation。
- 报告必须包含 `fixed_webview2_runtime_bundled=pass`、`webview2_runtime_error_dialog_absent=pass`、`app_main_webview_window=pass`、`frontend_render=pass` 且 `passed=true`。
- 人工确认 Dashboard 主页面可见。通过前，V1 Final 仍不能标记 complete。

## Phase 12.2 / V1 Final Clean Windows 验收完成（2026-06-26 09:41）

状态：complete。Windows Sandbox 中已使用最新 release NSIS installer 完成 clean Windows 验收，且用户已人工确认沙盒桌面 `Project Vault` 图标可以直接打开软件主页面。

最终证据：

- 报告文件：`release-validation/clean-windows-validation.json`。
- 报告结论：`passed=true`。
- installer：`C:\Users\WDAGUtilityAccount\Desktop\nsis\Project Vault_0.1.0_x64-setup.exe`，大小 `240,129,228` bytes。
- clean 前置条件：`python_unavailable=pass`、`node_unavailable=pass`。
- 安装：`installer_silent_run=pass`，退出码 0。
- Fixed WebView2：`fixed_webview2_runtime_bundled=pass`，安装目录包含 `msedgewebview2.exe`。
- WebView2 错误弹窗：`webview2_runtime_error_dialog_absent=pass`。
- 主窗口：`app_main_webview_window=pass`，窗口标题 `Project Vault`。
- 后端：`backend_health=pass`，`status=ok`，端口 `49823`。
- 前端：`frontend_render=pass`，`http://127.0.0.1:49824/` 返回 200，包含 Project Vault shell 与 backend port injection。
- 数据库：`database_path=pass`，路径位于 `C:\Users\WDAGUtilityAccount\AppData\Local\ProjectVault\database\project_vault.db`。
- 退出清理：`backend_exit_cleanup=pass`，检查的后端 PID 为 `3792`。

V1 Final 判定：可以标记 complete。

## Phase 13：V1 发布收口与实机使用验证

状态：complete。

目标：在 V1 Final clean Windows 门禁通过后，把当前版本固化为可交付、可复现、可维护的 V1.0 检查点，并完成本机真实使用路径验收。

交付物：

- V1 release manifest，记录 installer 路径、大小、hash、构建时间和验收报告。
- 发布状态文档清理，确保当前状态不再显示 Phase 12 阻塞。
- 本机真实使用路径验收记录。
- 发布质量清单，覆盖安装、卸载、重装、断网、数据库路径、退出清理和边界输入。
- V1.0 checkpoint/tag 准备说明。

验收标准：

- `docs/release/V1_RELEASE_MANIFEST.md` 存在，并记录 installer SHA256 与 clean Windows report SHA256。
- README、`task_plan.md`、`progress.md` 的当前状态一致指向 V1 Final complete / Phase 13 complete。
- 本机正式安装包完成一次人工主流程：打开应用、设置项目根目录、扫描测试项目、浏览 Dashboard/Projects/Project Detail/CAD Center/Search/Settings、验证备份/恢复入口。
- 不引入 V2 范围功能：AI Chat、Agent、RAG、云同步、多用户协作、权限系统、在线 CAD 查看/编辑均保持排除。
- 完成最终检查点前，至少重新运行后端测试、前端 build、Tauri check 或 release build 中的必要组合。

### Phase 13.1 发布状态与产物固化（2026-06-26）

状态：complete。

已完成：

- 新增 `docs/release/V1_RELEASE_MANIFEST.md`。
- 记录 release installer：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`。
- 记录 installer 大小：`240,129,228` bytes。
- 记录 installer SHA256：`0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`。
- 记录 clean Windows validation report：`release-validation/clean-windows-validation.json`。
- 记录 report SHA256：`1A128EA00BFF4C25648B09AF2D3F95904FCDAF2B129E5EF4EBA02F32D86D5E2D`。
- 更新 README 发布证据入口。
- 修正本文件“当前状态”，Phase 12.2 不再显示为待复验。

验收结果：

- 发布产物与 clean Windows 验收报告已固化到 `docs/release/V1_RELEASE_MANIFEST.md`。
- README、`task_plan.md`、`progress.md` 已同步 V1 Final complete / Phase 13 in progress 状态。

### Phase 13.2 本机正式安装包真实使用路径验收（2026-06-26）

状态：complete。

目标：验证已固定 release installer 在本机正式安装后，主流真实使用路径可以跑通，且不依赖开发模式或源码服务。

已完成：

- 新增 `scripts/verify_local_installed_usage.ps1`。
- 使用 release installer 静默安装到隔离的当前用户测试目录。
- 验收前备份并清空本机 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`，验收后恢复原数据库。
- 创建专用测试项目根目录：`release-validation/local-usage-fixture`，不使用真实生产资料。
- 启动安装后的 `project-vault.exe`，确认主窗口标题为 `Project Vault`。
- 验证 sidecar health、packaged frontend HTML、backend port injection 与 `%LOCALAPPDATA%` 数据库路径。
- 通过 API 模拟真实主流程：保存 Settings root_path、发现候选项目、初始化项目、扫描项目、检查 Dashboard、Projects、Project Detail Files/Drawings/Materials、CAD Center、Search、History、Backup/Restore。
- 关闭应用后验证 `project-vault-backend` 退出清理。

验收证据：

- 报告文件：`release-validation/local-installed-usage-validation.json`。
- 报告结论：`passed=true`。
- 报告 SHA256：`1B31EC6AC8B87563094072DE496D64DB465783580A0030D06DB48C3DAE6157AE`。
- installer SHA256：`0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`。

### Phase 13.3 发布质量清单与 V1.0 检查点准备

状态：complete。

目标：完成最终发布收口前的质量清单，明确 V1.0 checkpoint/tag 准备条件。

已完成：

- 新增 `scripts/verify_phase13_release_quality.ps1`。
- 新增 `docs/release/V1_RELEASE_QUALITY_CHECKLIST.md`。
- 使用 release installer 完成安装 / 卸载 / 重装检查。
- 完成 loopback-only 启动检查：后端和前端均通过 `127.0.0.1:<dynamic_port>` 提供服务；未修改宿主机网络状态。
- 完成无效 `root_path`、损坏 `project.json`、不可访问目录等边界输入检查。
- 复核 release 文档：`V1_RELEASE_MANIFEST.md`、`CLEAN_WINDOWS_VALIDATION.md`、`LOCAL_INSTALLED_USAGE_VALIDATION.md`、`USER_GUIDE.md`、`ROLLBACK_REBUILD.md`。
- 最终验证组合通过：后端 64 项 unittest、前端 `npm run build`、桌面 `npm run check`。
- 输出 V1.0 checkpoint/tag 准备说明。

验收证据：

- 报告文件：`release-validation/phase13-release-quality-validation.json`。
- 报告结论：`passed=true`。
- 报告 SHA256：`BB183E9F90481CE3D65395E8EF2D3E8DFF2ED01BD68EF25569909B93DC3CB3A9`。
- installer SHA256：`0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`。

V1.0 checkpoint/tag 判定：已具备准备条件。打 tag 前仍需做常规仓库卫生检查，确保不把 `.venv`、`node_modules`、运行数据库、fixture 输出或 fixed WebView2 runtime 下载目录作为源码产物提交。

### Phase 13.4 V1.0 checkpoint 仓库卫生检查

状态：complete。

目标：在打 V1.0 checkpoint/tag 前，确认源码索引不包含运行依赖、构建产物、临时验收 fixture 和本机备份快照。

已完成：

- 补充 `.gitignore`：忽略 `desktop/node_modules/`、`*.bak.*`、`release-validation/*fixture*/`。
- 从 Git 索引移除 `desktop/node_modules`，本地文件保留。
- 从 Git 索引移除 `task_plan.md.bak.*` 与 `progress.md.bak.*`，本地文件保留。
- 复查高风险跟踪路径：未发现 `node_modules`、`.venv`、`target`、`frontend/out`、fixture、`.bak`、运行数据库、fixed WebView2 runtime 下载目录仍被 Git 跟踪。
- 保留发布证据报告：`release-validation/*.json` 与 `release-validation/*.txt`。

验证：

- `backend`：`.venv\Scripts\python.exe -m compileall app tests` 通过。
- `frontend`：`cmd /c npm run build` 通过。
- `desktop/src-tauri`：`cargo check` 通过。

V1.0 checkpoint/tag 判定：仓库卫生检查已通过，可以进入提交/tag 步骤。提交前仍应人工复核 `git diff --cached`，确认 staged 范围符合预期。

## V1.2.0 Release（2026-06-26）

状态：complete。

审查报告 44 项发现全部处理完毕（Phase 1/2/3）。V1.2.0 标签已推送远程（`git push origin v1.2.0`）。

完成内容：

- Phase 1 发布阻塞项：UI 语言统一、React 错误边界、router.push 导航修复、CSP 安全头 + Host 验证、新用户引导、恢复确认弹窗、启动时序修复。
- Phase 2 快速改进：useApi hook、共享组件（ConfirmDialog/ErrorBanner/EmptyState/Pagination）、core_api.py 模块拆分、Watcher 队列接入、项目卡片视图、搜索结果跳转、AI Provider 真实测试。
- Phase 3 战略功能：文件预览与缩略图、目录树导航、AI 项目分析、CSV 导出、真实 scanner_status、自动扫描开关、可配置备份保留、首页收藏、页面 meta、查询长度校验、速率限制、路径遍历防护、Rust 结构化日志、WebView2 运行时检测、前端测试套件。

验证结果：

- 前端 build：9 路由静态生成，818ms。
- 前端测试：7 passed（2 files）。
- Rust check：30.92s，无错误。
- 后端测试：64 tests OK（既有套件）。

发布说明：`docs/release/V1.2.0_RELEASE_NOTES.md`。

## Phase 14：V2 Knowledge Platform Planning（2026-07-08）

状态：complete。

目标：在 V1.4 发布闭环后，规划 V2 知识平台。V2 首轮重点是结构化项目知识、文本提取、AI 草稿、人工确认、`project.json` 回写和 FTS5 检索；不直接进入 Agent、完整 RAG、云同步、权限系统或多人协同。

已启动：

- 新增 `docs/planning/V2_KNOWLEDGE_PLATFORM_PLAN.md`。
- 新增 `docs/planning/V2_SCHEMA_API_RFC.md`。
- 新增 `docs/planning/V2_EXECUTION_PLAN.md`。
- 新增 `docs/planning/V2_CONFIRMATION_CHECKLIST.md`。
- 明确 V2 的首轮边界：先结构化知识，再文本提取，再 AI 草稿，再人工确认写回。
- 明确语义搜索只作为后置 spike，必须等结构化知识和 FTS5 检索稳定后再判断是否进入产品。

当前执行：

- V2.0 Planning Freeze 已由用户确认。
- V2.1 Knowledge Read Model 已通过自动测试/审查和人工验收：复用现有 `ai_metadata` 和 `/projects/{project_id}/ai-metadata`，完成 Project Detail Knowledge 读视图。
- V2.2 Text Extraction Foundation 与 V2.3 Knowledge Draft Store 已通过自动测试、浏览器 smoke 和用户人工验收，状态为 `complete`。
- V2.4 Apply Approved Knowledge 与 V2.5 Knowledge Search 已通过自动测试、Chrome smoke 和用户人工验收，状态为 `complete`。
- V2.1-V2.5 已固化为首个 V2 beta acceptance checkpoint，记录见 `docs/release/V2_BETA_ACCEPTANCE_CHECKPOINT.md`。
- 本轮已执行首次 SQLite schema migration 到 `user_version=2`，新增 `knowledge_sources / knowledge_drafts / knowledge_history`。
- 本轮新增 Knowledge API：`GET /projects/{project_id}/knowledge`、`POST /extract-text`、`POST /draft`。
- 范围控制：V2.4 首次 `project.json` 写入只允许用户确认后的单项目草稿应用；写前备份，写后同步 SQLite/FTS；未引入依赖，未改 Tauri/installer；AI draft 生成仍等待首次 AI 生成确认。
- V2.6 Local Semantic Search Spike 已完成：FTS5 命中 3/6，近义查询命中 1/4；零依赖 alias proxy 命中 6/6，近义查询命中 4/4。
- V2.6 决策：`defer_vector_dependency`。保持 FTS5；只有出现真实 miss-query 样本后才考虑小型 query expansion；向量依赖继续需要用户单独确认。
- 最新 installer 的本机安装包级验证已通过：32 个步骤全部 pass，V2 packaged knowledge file/index/extract/draft/apply/search 均通过；installer SHA256 `9099FA65EA69A0A030DADB0955339637CE7411C5E682E16B66FCCEC96FE4EB41`。
- 剩余发布风险：latest installer 还没有重新跑 clean Windows Sandbox，不作为 release-grade installer 声明。
- V2.7 Real AI Draft Generation 已获用户确认并启动：复用现有 Provider 和文本来源，只生成草稿，不自动写 `project.json`，不新增依赖/schema。
- 本轮同步推进 beta 仓库检查点、自动 review/test、远端 CI、installer 本机/clean Windows 验证，最后进入人工验收。
- 向量依赖、批量 apply、DOCX 与图片 OCR 继续延后；2026-07-13 真实使用验证已补充文本型 PDF 本地提取。
- V2.7 已完成并通过人工验收：AI 草稿记录 provider/model，失败不会写入已确认知识，旧 direct analyze 路径不能绕过草稿/确认门禁。
- V2 beta release evidence：GitHub CI、33 步本机安装包回归、15 步 clean Windows 验证均通过；installer SHA256 `FCA20A8EBFDF08C6F2C6C5216F00355E6C55546ECD259E85D9A501E819AA668F`。
- V2 Beta 真实使用验证已启动并完成自动阶段：使用真实室内设计项目的隔离副本，覆盖导入、扫描、索引、提取、AI 草稿、确认写入、备份、SQLite/FTS5、重启与异常路径；报告见 `docs/release/V2_BETA_REAL_USAGE_VALIDATION.md`。
- 当前状态：`accepted`。用户已通过一键整理、Provider 配置提示和草稿处理流程验收；真实外部 Provider 的持续内容质量与隐私授权仍按实际项目使用观察。
- 2026-07-13 简化决策：项目知识改为“一键整理项目知识 → AI 建议 → 确认写入 / 放弃草稿”。隐藏提取、手动草稿、字段复选框和索引细节；保留备份、人工确认、证据回溯和搜索同步。

## Phase 15：V2 知识链路审查与最小加固（2026-07-13）

状态：complete。

目标：审查真实使用后的 V2 知识链路，优先修复可由本地资料触发的资源风险和无有效来源的 AI 草稿风险；不改变既有确认写入、备份和 SQLite/FTS 同步边界。

执行清单：

- 审查文本/PDF 提取、来源校验、草稿创建和确认写入调用链。
- 为已证实缺口补充最小服务层保护和回归测试。
- 运行知识 API 回归、全后端测试、前端相关测试和构建。

验收清单：

- PDF 与普通文本遵循同一受控提取上限。
- AI 草稿必须建立在已就绪来源上；手动草稿既有能力不受影响。
- 不新增依赖、schema、API 契约或桌面端改动。

结果：PDF 提取已逐页截断，累计文本不超过 `MAX_SOURCE_BYTES`；AI 草稿既有 `ready_sources_required` 服务层门禁已复核，无需重复实现。后端 87 项测试、前端 11 项测试和前端生产构建均通过。

## Phase 16：资产缩略图缓存隔离修复（2026-07-13）

状态：complete。

目标：修复同名图片跨目录或跨项目命中同一缩略图缓存的问题，保持资产只经 `file_id` 访问的架构边界。

验收清单：

- 缩略图缓存键使用稳定的 `file_id`，不使用文件名。
- 同名图片生成独立缓存文件和正确内容。
- 不新增依赖、API 契约、schema 或桌面端改动。

结果：缓存键已改为 `file_id`；PIL 读取改为上下文管理，避免 Windows 上图源文件被锁定。新增同名图片隔离回归；后端 88 项、前端 11 项均通过。

## Phase 17：AI Provider 网络边界审查（2026-07-13）

状态：complete。

目标：限制 Provider 服务地址和远端错误信息，确保 AI 草稿失败不会将第三方响应正文回显给前端；不改变现有 API、数据表或桌面端打包路径。

验收清单：

- Provider 创建和更新只接受具备主机名的 HTTP(S) 基础地址。
- 真实 AI 调用仅返回 HTTP 状态码，不返回第三方响应正文。
- 既有 Provider 连接测试可将存量无效地址报告为受控状态。
- 运行 Provider/知识 API 回归与后端全量测试。

结果：创建、更新和存量测试均限制为有主机名的 HTTP(S) 地址；AI 草稿远端失败仅返回 `api_error: <状态码>`，不回显响应正文。后端 88 项测试通过。

## Phase 18：AI Provider 系统凭据存储（2026-07-13）

状态：complete。

目标：实现既有“OS 托管加密”要求。新的 API 密钥写入 Windows 凭据管理器，SQLite 仅保存可解析的凭据引用；旧数据库明文配置在首次使用时迁移。

验收清单：

- 新建、更新、连接测试、AI 草稿和删除均使用同一凭据解析逻辑。
- 不向 API 返回密钥，也不在 SQLite 保存新密钥明文。
- 存量明文仅在成功写入系统凭据后替换为引用，失败仍保持可用。
- 使用标准库实现，不新增依赖、schema 或桌面端打包变动。

结果：新增 `provider_credentials.py`，通过 Windows Credential Manager 保存密钥，SQLite 保存 `wincred:<provider_id>` 引用。创建、轮换、清空和删除均维护对应凭据；连接测试和草稿调用读取引用。存量明文在首次使用且凭据写入成功后迁移。定向 27 项、后端全量 89 项测试和真实系统凭据往返验证均通过。

## Phase 19：Provider 凭据迁移与发布检查点（2026-07-13）

状态：complete。

目标：在应用启动时主动迁移旧 Provider 明文密钥，随后完成提交、推送和 GitHub CI 核验。

验收清单：

- 启动时迁移所有可写入 Windows Credential Manager 的旧密钥；失败项不清空原值。
- 新增最小回归，证明迁移后 SQLite 只保留引用。
- 提交前完成安全导向代码审查、全量后端与前端验证、发布产物卫生检查。
- 以独立分支提交、推送并创建草稿 PR；核验对应 GitHub Actions 结果。

结果：主动迁移已落地；本地运行库无待迁移项。变更已提交为 `9a732b5`、推送至 `agent/provider-security-hardening`，草稿 PR #4 已创建；GitHub Actions run #9 的后端测试、前端构建与测试全部成功。

## Phase 20：真实 Provider 草稿验证

状态：complete。

结果：用户已配置可用 Provider，并明确授权发送三份选定 Markdown 会议纪要的摘录。真实请求成功创建 AI 草稿，记录了 Provider 和模型；经确认后，原 active manual draft 已标记为 discarded。一次 2000-token 请求因推理输出耗尽共享预算而未生成草稿；默认预算提升到 4096 并增加回归断言后，使用同一三份来源的真实请求成功。用户人工确认写入后，七类草稿字段、标签和证据均已写入 `project.json`；备份、成功历史记录及 SQLite 索引同步均已只读复核。

## Phase 21：最新 Beta 发布与增量扫描收口（2026-07-13）

状态：complete。

目标：将当前 PR #4 的 Provider 安全、真实草稿写入和知识页适配修复构建为可验证的桌面安装包；在通过审查和 CI 后合并 PR；随后修复 Watcher 已知事件仍退化为全量增量扫描的问题。

执行清单：

- 重新构建 `2.0.0-beta.1` 安装包，并运行本机安装包回归；只使用专用 fixture 和临时安装目录。
- 检查 PR #4 的最新提交、CI、审查线程和发布产物卫生；满足条件后合并至 `main`。
- 跟踪 Watcher 队列到 `scan_project_incremental()` 的完整调用链；将已聚合的变更路径交给现有 `changed_paths` 快路径，并补充移动、新增、修改、删除的回归。

验收清单：

- 安装包包含当前 `489828d` 及其父提交，能启动、加载前端、运行后端、完成知识资料的索引/草稿/确认流程并正常退出。
- PR #4 无未解决审查线程，最新 CI 通过，且不提交运行数据库、备份或 fixture 根目录。
- Watcher 对已知文件事件不枚举整个项目；增、改、删、移动保留现有数据与 `file_id` 语义，且只刷新受影响的 FTS 实体。

结果：阶段 1 的 `2.0.0-beta.1` 安装包本机验收 33/33 步通过；阶段 2 的 PR #4 已在 CI 通过后合并为 `ba14023`；阶段 3 的 Watcher 修复通过定向 14 项和后端全量 92 项测试，并在 PR #5 CI 通过后合并为 `f866b42`。包含阶段 3 Watcher 修复的安装包已从 `fc747e4` 重建并通过同一套本机验收；用户明确决定本次不执行 clean Windows 验收，本机安装验收即为当前交付门禁。

## Phase 22：真实使用反馈阶段 0 审查（2026-07-15）

状态：complete。

目标：只读审查真实使用反馈对应的代码、数据库、API、前端和桌面入口；确认根因、影响范围、数据风险、迁移边界与后续修复顺序。

执行清单：

- 读取 `AGENTS.md`、`task_plan.md`、`findings.md`、`progress.md` 与用户指定架构/规划/发布文档。
- 核对当前分支、Commit、远端、版本面、前端技术栈、Tauri 与 SQLite 结构。
- 审查项目发现/初始化、全量扫描、搜索、CAD 分类、历史展示、设置、主题、onboarding、Dashboard、AI Provider 调用链。
- 使用隔离临时目录复现项目层级、中文搜索和 CAD 分类现象。
- 运行现有后端、前端、Next 构建和 Tauri 检查；不修改代码、数据库、真实项目资料或 `project.json`。

交付物：

- `docs/reviews/2026-07-15_Project_Vault_Real_World_Audit.md`

验收结果：

- 后端 unittest：92 tests OK。
- 前端 Vitest：3 files / 11 tests passed。
- 前端生产构建：9 个静态路由生成成功；保留既有 Next `output: export` rewrites 警告。
- Tauri：`cargo check` 通过。
- 隔离复现确认：项目候选规则过宽、中文/业务关键词搜索存在 FTS5 miss、CAD 分类覆盖不足。
- 阶段门禁：审查报告完成后停止，不进入代码修复阶段。

## 反馈修复阶段 1：Project Discovery & Project Hierarchy（2026-07-15）

状态：complete。

目标：阻止标准资料子目录被识别或初始化为独立项目，保持“项目库根目录 → 项目 → 项目资料目录 → 文件”的层级。

执行清单：

- [x] 复核阶段 0 审查证据、架构约束和现有调用方。
- [x] 在共享 discovery 层增加标准资料目录识别。
- [x] 候选发现跳过 `00_项目档案` 至 `07_现场资料`。
- [x] 对误选单项目根目录返回受控错误。
- [x] 在初始化入口增加二次防护，禁止向标准资料目录写入 `project.json`。
- [x] 补充隔离临时目录回归测试。
- [x] 同步核心引擎实现计划。

验收结果：

- [x] 项目库根目录下的真实项目仍能作为候选。
- [x] 项目内部标准资料目录不再作为候选。
- [x] 误选含多个标准资料目录的单项目根目录不会静默产生候选。
- [x] 直接初始化标准资料目录不会写入 `project.json` 或 SQLite。
- [x] 不改数据库 Schema、`project.json` Schema 或真实项目资料。
- [x] 定向测试 8 项通过。

下一阶段门禁：先经用户确认，再执行索引关系重建与项目/CAD/材料归属修复；本阶段不自动清理已有错误 `project.json`。

## 阶段 1任务单补充：Project Discovery & Initialization Safety（2026-07-15）

状态：complete。

验收清单：

- [x] 新增独立 `project_structure.py` 规则模块。
- [x] 候选返回已有项目、待初始化项目、疑似资料子目录、待确认目录四类。
- [x] 标准资料目录不可初始化。
- [x] 单项目根目录检测并返回受控提示。
- [x] 初始化需要 `confirmed_paths`，未确认不写入。
- [x] Onboarding 默认只选择可信 `pending_project`。
- [x] Onboarding 展示目录分类；疑似资料目录不可选。
- [x] Dashboard 待处理数量只统计可初始化目录。
- [x] 后端全量 96 项通过，前端 11 项通过，生产构建成功。

范围门禁：未修改搜索、CAD 分类、Dashboard 结构、AI Center、数据库 Schema 或 `project.json` Schema；未执行索引重建；阶段 1完成后停止。

## 反馈修复阶段 2：Controlled Index Audit, Backup & Rebuild（2026-07-15）

状态：complete。

目标：只处理 SQLite 派生索引，先 Dry Run，再备份并在事务中重建有效项目、文件、CAD、材料及现有 FTS 索引；不修改真实项目文件、`project.json` 或数据库 Schema。

执行清单：

- [x] 阶段 1全量测试前置验证。
- [x] 新增只读项目索引审查和错误索引识别。
- [x] 新增 SQLite 备份校验与唯一备份命名。
- [x] 新增事务化索引重建和失败回滚。
- [x] 对嵌套 `project.json` 做识别/排除，不自动删除源文件。
- [x] 对受保护知识数据设置阻断门禁。
- [x] 增加 Settings 的“检查索引 / 备份并重建”最小入口。
- [x] 增加阶段 2自动化测试。
- [x] 完成全量后端、前端测试和前端构建后关闭阶段。

范围门禁：不修改搜索召回、CAD 分类规则、Dashboard、历史展示、主题、AI Center 或数据库 Schema；未对真实运行库执行重建，等待用户确认 Dry Run 报告后再决定。

验收结果：后端全量 `102 tests OK`；阶段 2专项 `6 tests OK`；前端 Vitest `3 files / 11 tests passed`；Next 构建 `9` 个静态路由成功。报告：`docs/reviews/2026-07-15_Project_Vault_Phase_2_Index_Rebuild_Report.md`。

## 反馈修复阶段 3：Search Refactor（2026-07-15）

状态：complete。

目标：修复项目名、中文文件名、业务关键词和文件扩展名的搜索召回，同时保持现有 SQLite FTS5、API 契约和数据库 Schema。

执行清单：

- [x] 复核阶段 2完成状态和搜索架构边界。
- [x] 复核现有 FTS5 查询、索引字段和搜索 API。
- [x] 复现并记录中文/业务关键词 miss。
- [x] 增加查询 NFKC 规范化、最小业务别名和 LIKE 兜底。
- [x] 增加结果去重并保持分类过滤。
- [x] 补充中文、扩展名、局部文件名和回归性能测试。
- [x] 运行全量验证，生成阶段 3报告并停止。

范围门禁：不修改数据库 Schema、FTS tokenizer、CAD 分类、历史展示、Dashboard、设置、AI Center 或真实项目文件；不引入向量检索和新依赖。

验收结果：阶段 3搜索专项 `6 tests OK`；后端全量 `103 tests OK`；前端 Vitest `3 files / 11 tests passed`；Next 构建 `9` 个静态路由成功。报告：`docs/reviews/2026-07-15_Project_Vault_Phase_3_Search_Report.md`。

## 反馈修复阶段 2.5：真实库 Dry Run 验证（2026-07-15）

状态：complete（真实库只读 Dry Run 完成；未执行 rebuild）。

执行清单：

- [x] 读取当前 Settings 与 SQLite，只使用只读连接。
- [x] 使用已授权的真实项目库根目录显式调用现有 `/api/v1/system/index/audit` 路由。
- [x] 确认审计返回 `status=ready`，有效项目数为 0。
- [x] 确认 11 个顶层目录均为 `confirmation_required`，未自动纳入项目或初始化。
- [x] 确认未扫描其他历史验证数据库或其他用户目录。
- [x] 确认未执行 index rebuild、SQLite 写入或真实文件操作。
- [x] 生成真实库 Dry Run 报告。

结果：指定根目录下 11 个顶层目录均未配置 `project.json`，也未满足标准项目目录识别条件；有效项目、疑似错误索引、嵌套 `project.json`、缺失索引、缺失路径和预计重建项目均为 0。文件/CAD/材料计划重建数量也为 0，但这只代表没有有效项目进入重建范围，不代表目录内没有文件。

报告：`docs/reviews/2026-07-15_Project_Vault_Real_Library_Dry_Run_Report.md`。

下一步门禁：先确认项目目录并通过受控初始化流程处理；在用户确认前不执行 rebuild。

## 反馈修复阶段 2.6：Project Candidate Recognition for Real-World Workspaces（2026-07-15）

状态：complete（代码、隔离测试和真实库只读 Dry Run 已完成；未初始化、未重建）。

执行清单：

- [x] 复核阶段 2.5 真实目录结果和阶段 1初始化门禁。
- [x] 新增已初始化、标准结构、普通候选、疑似子目录、非项目和待确认分类。
- [x] 增加文件元数据、设计类扩展名、业务目录信号和可读证据。
- [x] 保持普通候选必须确认，候选发现不写入 `project.json` 或 SQLite。
- [x] 更新 Onboarding 候选展示和 API/架构文档。
- [x] 增加隔离候选识别与系统目录初始化保护测试。
- [x] 对已授权的真实项目库完成只读候选 Dry Run。
- [x] 完成后端全量、前端测试和前端生产构建。

验收结果：真实目录 11 个顶层目录中识别出 10 个 `ordinary_project_candidate`、1 个 `confirmation_required`；所有候选 `requires_confirmation=true`，`will_write_project_json=false`；SQLite 哈希未变化；未执行真实初始化或 index rebuild。

报告：`docs/reviews/2026-07-15_Project_Vault_Phase_2_6_Candidate_Recognition_Report.md`。

下一步门禁：等待用户确认候选项目后，再单独进入受控初始化阶段。

## 反馈修复阶段 2.7：Controlled Real Project Initialization（2026-07-15）

状态：complete。

唯一允许初始化目录：

- 授权项目 A
- 授权项目 B
- 授权项目 C

执行清单：

- [x] 对三个允许目录执行路径、项目名、符号链接、`project.json` 冲突和文件指纹前置检查。
- [x] 输出初始化变更预览，确认预计仅创建各自根目录的一个 `project.json`。
- [x] 按顺序逐个调用正式初始化服务，每个项目立即验证后才进入下一个。
- [x] 初始化后重新执行真实库 Dry Run，确认 3 个有效项目且无异常。
- [x] 通过 Dry Run 门禁后备份 SQLite 并调用正式 rebuild 接口。
- [x] 验证项目、文件、CAD、材料、FTS、搜索和原文件保护。
- [x] 更新阶段报告并停止，不进入阶段 4。

严格门禁：不初始化允许列表之外目录；不覆盖已有 `project.json`；不创建标准目录；不修改业务文件；不修改数据库 Schema 或 `project.json` Schema；任一项目初始化失败立即停止。验收结果：三个授权项目初始化成功，Dry Run 和官方重建通过，后端 106 tests、前端 11 tests、Next 构建 9 个静态路由通过。报告：`docs/reviews/2026-07-15_Project_Vault_Phase_2_7_Real_Initialization_Report.md`。

## 反馈修复阶段 4：CAD Center Classification & Table Usability（2026-07-15）

状态：complete。

执行清单：

- [x] 只读统计真实 125 个 CAD 的分类基线、项目分布和未知明细。
- [x] 复核 CAD 扩展名、分类器、索引写入、筛选 API 与前端调用链。
- [x] 最小扩展 DWG/DXF、分类体系、优先级、目录上下文与运行时证据。
- [x] 将算法未知统一为“待分类”，不新增数据库 migration。
- [x] 修复 CAD Center 列契约、长文字、版本、时间与筛选可读性。
- [x] 对真实索引重新分类并验证 125 个 CAD，不修改真实 CAD 文件。
- [x] 完成分类抽样、项目/分类过滤、后端/前端测试和生产构建。
- [x] 在 1440/1280/1024 视口完成真实 UI 交互与截图验收。
- [x] 生成阶段 4 报告并停止，不进入阶段 4B 或阶段 5。

范围门禁：不修改项目发现/初始化、数据库 Schema、`project.json` Schema、搜索算法、真实项目目录或 CAD 文件；分类只写入 SQLite 派生索引。

验收结果：真实 125 个 CAD 已完成受控重分类，最终待分类 15 个；项目/文件/CAD/材料/FTS 计数保持 `3/444/125/273/848`，125 个 CAD 的路径、大小和修改时间不变。后端全量 108 tests、前端 11 tests、Next 生产构建及 1440/1280/1024 三档真实 UI 验收通过。报告：`docs/reviews/2026-07-15_Project_Vault_Phase_4_CAD_Center_Report.md`。

## 反馈修复阶段 5：Unified Presentation Layer & History Experience（2026-07-15）

状态：complete。

执行清单：

- [x] 只读统计真实 `scan_history` 的数量、事件、状态、消息格式与项目关联。
- [x] 审查 History、Project History、Dashboard、Sidebar 及全局同类字段。
- [x] 建立共享时间、相对时间、事件、状态、扫描消息与项目显示转换层。
- [x] 历史 API 一次 JOIN 项目名称，保留原始字段并处理系统/已移除项目。
- [x] 统一全局历史、项目历史与 Dashboard 最近活动，增加默认隐藏的技术详情。
- [x] Sidebar 从 `frontend/package.json` 的版本生成单一真实版本源，移除 `v1.3` 硬编码。
- [x] 增加后端历史 API 与前端展示层专项测试。
- [x] 扫描用户可见 ISO、UUID、snake_case、英文状态和原始扫描参数残留。
- [x] 完成后端/前端全量测试、生产构建和 1440/1280/1024 真实 UI 验收截图。
- [x] 生成阶段 5 报告并停止，不进入阶段 6。

范围门禁：不修改数据库 Schema、migration、`project.json` Schema、真实项目文件、真实 `scan_history` 原始值、CAD 分类、搜索、项目发现、设置、AI Center 或 Dashboard 整体信息架构；不生成假历史。

验收结果：真实 `scan_history=0`，未插入假历史；统一展示层、历史项目名 JOIN、技术详情、Dashboard/Project History 一致性和 Sidebar 版本源完成。后端 110 tests、前端 20 tests、Next 9 路由构建及 1440/1280/1024 UI 验收通过。报告：`docs/reviews/2026-07-15_Project_Vault_Phase_5_Presentation_History_Report.md`。

## 反馈修复阶段 6：Settings System, Native Folder Picker & First-Run Onboarding（2026-07-15）

状态：complete（最终安装版人工补验通过；不进入阶段 7）。

执行清单：

- [x] 审查 Settings 前后端契约、真实消费方及无效控件。
- [x] 复用现有设置存储，完成正式字段验证、持久化和重启读取。
- [x] 复用现有 Candidate API，在保存根路径前完成目录预检查和确认。
- [x] 使用与 Tauri 2 兼容的官方能力接入 Windows 原生目录选择；浏览器模式安全降级。
- [x] 建立独立首次启动流程、明确完成状态、路径失效恢复及重新运行入口。
- [x] 完成 system/dark/light 主题即时切换、持久化和系统主题监听。
- [x] 修复 Sidebar 根路径与真实版本的稳定布局。
- [x] 保持索引维护安全门禁，隐藏或只读标注尚未真实可用的设置。
- [x] 通过正式 Settings API 保存已授权的真实项目库根目录，验证重启保持且不重复初始化。
- [x] 完成真实 Windows 桌面应用“浏览文件夹 → 原生选择器 → 重新选择当前目录 → 3/7/1 → 取消确认”完整交互验收。
- [x] 补充真实 1440×900 Settings 截图，验证页面无横向溢出、路径/版本/卡片/按钮布局，并定位圆形 N 为开发服务器注入的 `NEXTJS-PORTAL`；静态桌面构建未发现该入口，未删除。
- [x] 生成阶段 6 报告与指定截图并停止，不进入阶段 7。

范围门禁：不修改数据库 Schema、migration、`project.json` Schema、真实项目文件、搜索算法、CAD 分类、历史展示、Dashboard 整体结构或 AI 数据模型；不自动初始化其余候选，不创建标准目录。

阶段前真实基线：projects/files/drawings/materials/FTS=`3/444/125/273/848`，`project.json=3`，`user_version=2`，`scan_history=0`；允许变化仅限现有设置/元数据记录。

## 反馈修复阶段 6.1：Desktop Runtime Database Alignment & Initialization Incident Audit（2026-07-15）

状态：complete（只读事故审查完成；未修复，不进入阶段 7）。

执行清单：

- [x] 从正在运行的 `v2.0.0-beta.1` 进程、sidecar 命令行和 health API 确认 SQLite 绝对路径。
- [x] 只读统计当前桌面库、仓库库、LocalAppData 库及可能运行库，列出全部项目并解释 Dashboard 10 项目来源。
- [x] 只读扫描真实根目录全部 `project.json`，核对新增三个文件的时间、哈希、内容、项目 ID 和生成来源。
- [x] 关联 SQLite 创建时间、scan_history、桌面日志与初始化调用路径，确认发生非授权初始化但不归责具体操作者。
- [x] 复现“无法打开目录选择窗口”，收集前端、WebView、Tauri/Rust、插件、capability 和 bundle 证据。
- [x] 输出单一运行数据库方案、影响分析、恢复选项、迁移风险和最小修复建议；本阶段未实施。
- [x] 创建 `docs/reviews/2026-07-15_Project_Vault_Phase_6_1_Runtime_Data_Incident_Audit.md`，移除阶段 6 中已通过主题验证的旧阻塞内容并停止。

严格边界：禁止 index rebuild、删除/覆盖/清空 SQLite、删除或修改 `project.json`、初始化项目、继续 Onboarding、移动或修改业务文件、修改数据库 Schema、增加 migration、修改业务代码。允许只读命令、运行当前桌面构建复现错误、创建审查报告及更新连续性文件。

审查结论：当前正式桌面运行库为 LocalAppData 主库，已确认旧 01～07 错误索引和本次三项非授权正式初始化；目录选择器被 localhost capability scope 与 CSP 同时阻断。报告：`docs/reviews/2026-07-15_Project_Vault_Phase_6_1_Runtime_Data_Incident_Audit.md`。阶段 6.1 状态：complete；不进入阶段 7。

## 阶段 6.2：Controlled Incident Recovery, Runtime Database Alignment & Native Folder Picker Fix（2026-07-15）

状态：blocked（Windows 原子替换 LocalAppData 主库失败；已回滚三个 project.json，未尝试第二方案，不进入阶段 7）。

用户授权：归档当前 LocalAppData 事故库及三个未经授权 `project.json`，撤销这三个文件，以已验证的仓库 3 项目基线原子替换 LocalAppData 正式库；修复数据库运行规则、Tauri localhost capability/CSP 和受控错误日志；完成测试、打包及桌面验收。

严格门禁：先停全部 Project Vault 进程，再用 SQLite Backup API 保全事故库；不手工逐表删除、不自动合并、不在库被占用时替换；不删除或移动任何业务文件/目录/CAD/PDF/图片/Office 文件；不重新初始化、不无确认 rebuild、不改任一 schema/migration。任一步验证失败即停止并按事故归档回滚，不尝试第二方案。

执行清单：

- [x] 停止运行环境并记录进程、WAL/SHM 状态。
- [x] 创建 `recovery/2026-07-15_runtime_incident/`，用 SQLite Backup API 保存事故库，并归档 WAL/SHM 与三个 `project.json`。
- [x] 只读验证仓库基线 `3/444/125/273/848/0`、integrity、版本、项目和 Settings。
- [x] 校验归档后仅删除三份授权 `project.json`，验证 Candidate 恢复 `3/7/1`。
- [ ] 验证临时基线库后原子替换 LocalAppData 主库，清理已失效 WAL/SHM，复核完整计数和 integrity。（失败：Windows `File.Replace` 返回“无法删除要被替换的文件”；按门禁停止。）
- [ ] 最小修复运行数据库隔离、只读诊断信息、localhost capability/CSP 与开发日志。
- [ ] 增加路径/权限/取消专项测试，运行完整测试、Next/Tauri/桌面构建和真实桌面验收。
- [ ] 创建阶段 6.2 报告；全部通过后将阶段 6 标记 complete，停止，不进入阶段 7。

失败回滚：事故数据库已完整归档；LocalAppData 主库仍为原事故状态并通过 integrity；三份已短暂撤销的 `project.json` 已按归档 SHA-256 恢复。报告：`docs/reviews/2026-07-15_Project_Vault_Phase_6_2_Recovery_Report.md`。本阶段不得继续替换、修复或验收，等待新的明确授权。

## 阶段 6.2A：Windows SQLite 文件替换阻塞审查（2026-07-15）

状态：complete（只读诊断完成；不执行恢复，不进入阶段 7）。

目标：在不触碰 LocalAppData 正式数据库、真实项目文件、业务代码和数据库结构的前提下，审查 Windows `File.Replace` 返回“无法删除要被替换的文件”的可证实原因。

- [x] 记录正式数据库、WAL/SHM 的状态、属性、ACL 与删除权限证据。
- [x] 审查关联进程、可用句柄工具、Restart Manager / OpenFiles 结果以及安全与同步程序证据。
- [x] 在独立临时目录完成 A/B/C 隔离复现，并审查阶段 6.2 的实际调用参数、卷与备份路径。
- [x] 仅评估恢复替代方案，创建 `docs/reviews/2026-07-15_Project_Vault_Phase_6_2A_File_Replacement_Audit.md` 后停止。

严格禁止：再次删除任何 `project.json`、替换/复制覆盖正式数据库、逐表删除、rebuild、初始化、修改真实业务文件、Schema、migration 或业务代码。

审查结论：`File.Replace` 的 source/destination 在 `C:`，但 backup 位于 `D:`；同卷 A/B/C 全部成功，复制该跨卷参数的隔离实验稳定复现原错误（`0x80070497` / Win32 1175）。恢复仍须新授权；推荐同卷 backup 的受控 `File.Replace`，不执行。

## 阶段 6.2B：Same-Volume Atomic Recovery（2026-07-16）

状态：complete（同卷恢复、撤销与人工验收通过；不进入阶段 6.3 或阶段 7）。

- [x] 停止并记录全部连接 LocalAppData 目标库的 Project Vault 运行环境；重新用 SQLite Backup API 保全事故库及 WAL/SHM。
- [x] 验证 `project_vault.db.restore.tmp` 的 SHA、完整性、版本、计数、项目与 Settings；任一不符即停止。
- [x] 以 C: 同卷 source/destination/backup 执行一次 `File.Replace`；失败即停止，不尝试第二方案。
- [x] 成功后处理已归档的旧 WAL/SHM，验证正式库，归档同卷事故 backup。
- [x] 校验归档后仅撤销三个授权 `project.json`，验证根目录与 Candidate 结果；异常即按门禁回滚。
- [x] 启动 v2.0.0-beta.1 验证 health 与 Dashboard，写入 `docs/reviews/2026-07-16_Project_Vault_Phase_6_2B_Recovery_Report.md` 后停止。

严格禁止：D: backup path、copy overwrite、逐表删除、自动合并、rebuild、初始化、数据库或 project.json Schema 修改、业务文件修改、Tauri/CSP 修改和阶段 7。

## 阶段 6.3：Desktop Runtime Isolation & Native Folder Picker Closure（2026-07-16）

状态：complete（最终安装版人工补验通过；阶段 6 完成，不进入阶段 7）。

- [x] 审查并统一后端数据库路径解析、启动入口、Health 与 Settings 诊断；定义 production/debug/development/test 数据源。
- [x] 修复 Tauri `main` 的最小 localhost remote capability scope 与 CSP `ipc.localhost`；保留受控目录选择错误日志。
- [x] 增加运行模式、Health、Settings、选择器取消/预检查专项测试；不触碰真实业务数据。
- [x] 完成后端/前端/Cargo/桌面/NSIS 构建与隔离 Debug、生产桌面实机验收。
- [x] 输出阶段 6.3 报告；满足全部阶段 6 条件后标记阶段 6 complete，停止。

严格禁止：替换或覆盖正式数据库、修改真实 `project.json`、初始化候选、rebuild、清空历史、Schema 修改、业务文件修改、Dashboard/CAD/搜索/AI Center 改动、阶段 7。

## 阶段 7：Dashboard Productization & Workspace Information Architecture（2026-07-16）

状态：complete（用户已完成新安装版深浅主题人工验收；基线已冻结为 `phase-7-complete`）。

- [x] 从 `3c6073c` / `phase-6.3-complete` 建立 `feat/phase-7-dashboard`；运行产物只作本机忽略。
- [x] 以单一只读 Dashboard summary 聚合统计、最近项目、工作区有效状态与最多五条活动；无 N+1。
- [x] 完成四项统计、8/4 布局、真实快速入口、中文状态、Skeleton、错误/模块降级、主题与 1024 响应式。
- [x] 完成后端 117/117、前端 31/31、Next 构建、cargo check/test 和六张截图。
- [x] 只读审查正式 LocalAppData `scan_history` 与阶段冻结基线的差异；来源仍为 E（证据不足），用户授权保留历史并关闭阶段。
- [x] 新阶段 7 安装版已经用户人工确认深色/浅色 Dashboard 正常；Windows 自动截图限制仅作证据限制记录，不再阻止阶段关闭。

当前桌面构建门禁：独立 release 刷新尝试被 sidecar 最终写入的 `WinError 5` 阻断；PyInstaller 失败但构建脚本误返回 0，不得把该产物作为正式桌面运行件。

## 阶段 7.2：Reliable Desktop Build & Production Dashboard Acceptance（2026-07-16）

状态：complete（用户人工验收通过，纳入阶段 7 冻结）。

- [x] 修复 `build:sidecar` 对 PyInstaller 外部命令失败的非零退出传播，并以隔离输出验证。
- [x] 在隔离目录构建新 sidecar，核验 SHA/时间变化及临时数据库上的 health、summary 200。
- [x] 使用独立 `target-phase7-final` 构建唯一 NSIS 安装包，记录产物身份与所有构建退出码。
- [x] 安装并验收新 desktop-production：health/summary 和正式统计已通过；用户人工确认新安装版深色/浅色 Dashboard 正常。Windows 自动截图未伪造。
- [x] 只读复核正式数据及历史门禁：`scan_history=4` 保留，来源仍为 E；用户授权以“不写入虚构/测试历史”为关闭门禁并标记阶段 7 complete。

严格禁止：删除或修改正式 `scan_history`、写入正式测试/验收历史、扫描/初始化/重建、修改项目数据或 `project.json`、修改 Dashboard 产品功能、进入阶段 8、提交或打标签。

严格禁止：修改正式数据库、清空/伪造历史、修改真实 `project.json` 或业务文件、初始化、rebuild、Schema/migration 修改、进入阶段 8、自动提交或自动打标签。

## 阶段 8：Project Library & Project Detail Productization（2026-07-16）

状态：complete（已完成最终人工验收并冻结为 `19bbf2f` / `phase-8-complete`）。

- [x] 完成 Projects、Project Detail、Files、Drawings、Materials、History 与现有 API 的只读矩阵审查。
- [x] 在不改 Schema、真实项目数据、分类规则或桌面配置的前提下，实现项目库、详情外壳和安全的项目内资源浏览。
- [x] 使用临时数据库和隔离目录覆盖路径边界、层级、自然排序、项目隔离与加载/错误状态。
- [x] 完成正式只读数据复核、主题/响应式/键盘验收、报告和截图；等待用户验收，不提交、不打标签、不进入阶段 9。

严格禁止：修改数据库或 `project.json` Schema、真实 `project.json`、真实项目文件、项目/候选初始化、索引重建、CAD 分类规则、搜索算法、Dashboard、Settings、Onboarding、Tauri、AI 业务流程，或向正式库插入测试历史。

## 阶段 9：Global Search & Command Palette Productization（2026-07-17）

状态：complete（阶段 9.1、9.2、9.2A、9.3 及用户最终验收均已完成；不进入阶段 10）。

Git 基线：`19bbf2f46f968fa1dc32c695f8d4f93519d0d878`，标签 `phase-8-complete`，分支 `feat/phase-9-global-search`；启动时工作区干净。

目标：将既有 FTS5 搜索产品化为全局 Command Palette 与 `/search` 完整结果页；复用阶段 3 的后端规范化、别名、LIKE 兜底与实体去重，不重做搜索引擎。

执行清单：

- [ ] 审查现有搜索 API、TopBar/Palette、项目详情定位与安全文件操作的真实契约和调用方。
- [ ] 定义只含现有字段的统一前端结果模型；按 `file_id` 合并同一物理文件的 CAD/材料标签，不以文件名猜测。
- [ ] 实现全局 `Ctrl/Meta+K` Palette：焦点管理、IME、键盘选择、120–180ms 防抖、旧请求取消、真实本地最近记录。
- [ ] 实现 `/search` URL 状态、类型/项目筛选与真实分页；不向前端一次返回全部 FTS 记录。
- [ ] 复用项目详情 Files/Drawings/Materials 的 URL 定位与 `file_id` 安全操作；不可用文件只允许查看索引上下文。
- [ ] 在隔离 fixture 与正式数据库只读副本完成搜索、性能、主题、1024×800、可访问性和桌面验证。
- [ ] 运行专项与全量后端/前端测试、Next build、cargo check/test、`git diff --check`；生成阶段报告与指定截图。

范围门禁：只搜索真实索引的项目名、文件名、相对路径/目录、扩展名、CAD/材料分类及已确认元数据；不称为全文搜索，不搜索正文/OCR/网络内容，不改 Schema、`project.json`、正式索引、真实项目文件或 `scan_history`，不新增依赖，不进入阶段 10，不自动提交或打标签。

验收清单：

- [ ] 项目/文件/路径/CAD/材料及中文局部词、CAD/PDF 别名可检索；项目、CAD、文件、材料分组和物理文件去重正确。
- [ ] Ctrl+K、IME、Esc、焦点恢复、上下/Home/End/Enter、加载/错误/无结果、ARIA 和 1024×800 正常。
- [ ] 项目进入详情；文件/CAD/材料进入正确项目上下文并精确定位；打开/显示只经安全 `file_id` 接口。
- [ ] `/search` 的 q/type/project_id/page 可复制、刷新恢复，筛选/分页不虚构总数或结果字段。
- [ ] 正式数据保持 `3/444/125/273/848`、`project.json=3`、`integrity_check=ok`；仅允许真实 watcher 使 `scan_history` 增加。

### 阶段 9.1：Search API Contract & Unified Result Model（2026-07-17）

状态：complete。阶段 9 总状态仍为 `in_progress`；下一步仅可进入阶段 9.2 Command Palette UI，不进入阶段 10。

- [x] 扩展只读 `GET /api/v1/search` 为 `q/type/project_id/limit/offset`，兼容 `category` 映射且拒绝冲突过滤器。
- [x] 返回统一项目、文件、图纸、材料模型，批量补齐项目、路径、分类、`file_id` 和可用状态。
- [x] 仅按 `file_id` 合并同一物理文件；`labels` 保留 file/drawing/material 业务身份，未按名称或路径猜测。
- [x] 使用真实 `total/offset/has_more` 后端分页与固定排序；不向前端发送完整索引。
- [x] 增加 XSS 安全、只读、去重、过滤、分页、别名、缺失文件与正式只读副本回归；完成全量验证。

范围门禁：未改 SQLite Schema/migration、正式 FTS、`project.json`、真实项目文件、CAD/材料分类、Dashboard、项目库布局或 Command Palette 大型 UI；未提交、未打标签。

### 阶段 9.2：Command Palette Interaction & Search Navigation（2026-07-17）

状态：complete。阶段 9 总状态继续为 `in_progress`；下一步仅为阶段 9.3。

- [x] 实现全局 Ctrl/Meta+K、焦点恢复、滚动锁定、IME、150ms 防抖、AbortController 与可访问 Palette。
- [x] 只按后端当前页与 `labels` 分组；每项仅显示一次，复用 9.1 排序/去重结果。
- [x] 实现项目 Overview、文件/CAD/材料 Files `path+focus` 定位与安全次级文件操作。
- [x] 添加非空 `/search` 开发期占位，供“查看全部结果”跳转；完整结果页留给 9.3。
- [x] 完成隔离 UI、主题/1024、截图、专项/全量回归、构建和正式数据只读复核。

范围门禁：不改搜索 Schema、9.1 排序/去重、正式 FTS、`project.json`、真实项目文件、Dashboard、Project Library 布局、CAD/材料分类；不向正式数据库写入测试数据，不进入阶段 10，不提交、不打标签。

### 阶段 9.2A：Command Palette Verification Closure（2026-07-17）

状态：complete。阶段 9.2 已完成验收收口；阶段 9 总状态仍为 in_progress，不开始 9.3 或阶段 10。

- [x] 完整后端、前端、构建、Rust 与 diff 门禁。
- [x] 补齐 Ctrl/Meta、焦点、Abort、旧响应、空输入、最近搜索和 ARIA 测试矩阵。
- [x] 生成七张指定尺寸、无开发工具残留的验收截图。
- [x] 复核正式库与阶段报告状态；9.2 complete，阶段 9 保持 in_progress。

### 阶段 9.3：Full Search Results Page & Phase 9 Closure（2026-07-17）

状态：complete（自动化、材料与用户人工截图验收均已完成）。正式化 `/search`；不进入阶段 10。

- [x] 固化 URL `q/type/project_id/page`、真实项目筛选、服务端分页与状态恢复。
- [x] 复用 9.1 API 和 9.2 Files `path+focus` / 安全 `file_id` 操作；不改变搜索语义。
- [x] 补充 URL、IME、防抖、取消、分页、状态、ARIA 与 Palette 衔接的最小测试。
- [x] 以隔离 fixture、正式库只读副本和最新构建完成真实查询、浏览器材料、11 张截图及全量门禁。
- [x] 同步报告、任务计划、进度与发现。
- [x] 用户人工验收 11 张截图；阶段 9.3 与阶段 9 complete。

### 阶段 9.3A：Search Page Visual & Documentation Closure（2026-07-17）

状态：complete。已处理 CAD 分类中文展示、分页上下文、指定截图与报告冲突；不改搜索业务逻辑，不进入阶段 10。

- [x] 复用统一 CAD 分类映射，移除搜索结果中的内部枚举。
- [x] 显示真实 `total` 和 URL 页码的紧凑分页上下文，并补最小回归测试。
- [x] 重拍 CAD 第 2 页与授权项目筛选截图，复核其余正常截图。
- [x] 完整回归、正式数据只读复核与报告状态收口。
- [x] 用户最终验收截图；阶段 9.3 = complete，阶段 9 = complete。

## 阶段 10.0：AI Provider 与项目知识工作流边界审查（2026-07-17）

状态：complete（只读审查完成；阶段 10 保持 in_progress）。

- [x] 核验阶段 9 冻结基线 `1e378d4` / `phase-9-complete`，创建 `feat/phase-10-ai-provider`。
- [x] 读取 Provider、密钥、连接测试与 Knowledge 实现、测试和架构文档，建立端到端链路与数据模型矩阵。
- [x] 用正式数据库 `mode=ro` 做脱敏聚合复核；未写 Provider、Knowledge、`project.json`、真实文件或索引。
- [x] 运行既有专项/全量/构建门禁，记录缺口与风险分级。
- [x] 输出阶段 10.0 审查报告及 10.1～10.4 建议；阶段 10 保持 `in_progress`，不开始 10.1、不提交、不打标签。

已记录错误：隔离 Mock 的大响应场景因当前连接测试不读取响应体而使临时服务出现一次 `ConnectionAbortedError`；未重试，不影响测试结论或正式数据。

### 阶段 10.1：Provider Contract & Secret Safety（2026-07-17）

状态：complete（阶段 10 保持 in_progress）。

- [x] 收口 Base URL、同源重定向、`/models` 响应验证和稳定错误码。
- [x] 将公开密钥请求契约改为 `api_key`/`clear_api_key`，禁止明文降级并标明凭据状态。
- [x] 移除多启用 Provider 的名称排序选择；Knowledge 支持受控 `provider_id`。
- [x] 增加临时 SQLite、临时 Credential Backend 与双端口 Mock 覆盖，回归 Knowledge 门禁。
- [x] 运行全量门禁、正式数据只读复核和更新阶段报告；停止，不进入 10.2，不提交、不打标签。

范围：只处理 Provider 契约、密钥安全、连接测试、最小前端错误映射及 Knowledge Provider 选择契约；不改 Schema、真实数据库、真实 `project.json`、项目文件、扫描、聊天、Agent 或 RAG。

冻结范围：不新增聊天、Agent、RAG、向量库、OCR/正文解析、网络搜索、自动文件或 `project.json` 修改、计费、云同步或多用户能力。

### 阶段 10.2：AI Services UI Productization & Model Selector（2026-07-17）

状态：complete（阶段 10 保持 in_progress；停止，不进入 10.3）。

- [x] Git 前置门禁与现有 AI Center / 主题 / 组件审查。
- [x] 复用 10.1 安全客户端实现已保存 Provider 与 Preview 模型列表接口及专项测试。
- [x] 将 `/ai-center` 产品化为真实统计、高密度列表、按需 Drawer、凭据/启停/测试/删除状态。
- [x] 实现可搜索模型 Combobox、手动模型 ID、键盘/ARIA、配置变化失效和稳定中文错误。
- [x] 完成前后端专项/全量、Next、Rust、diff 门禁与正式数据只读复核。
- [x] 以隔离临时数据生成 15 张指定截图，更新正式报告；完成后停止，不进入 10.3，不提交、不打标签。

范围：只处理 AI Provider 管理 UI、真实 `/models` 获取与默认模型选择；不改 Schema、正式数据库、`project.json`、真实文件、Knowledge 运行时选择，不实现聊天、Agent、RAG 或监控。

### 阶段 10.3：Project Knowledge Entry, Runtime Provider Selection & History（2026-07-17）

状态：complete（用户已确认进入阶段 10.4；阶段 10 保持 in_progress）。

- [x] 读取正式任务书、Git 前置门禁、V2 架构文档与阶段 10 连续性证据。
- [x] 复用现有 Project Detail 与 Knowledge API，补齐项目入口、Provider/运行时模型选择和来源状态。
- [x] 扩展 Draft `model_id` 契约及只读 History API，不改 Schema 或既有原子写入/回滚语义。
- [x] 产品化已确认知识、活动草稿、结构化审阅、确认/放弃门禁与 History UI。
- [x] 完成前后端专项/全量、Next、Rust、diff 与正式数据只读复核。
- [x] 以隔离临时项目、临时 SQLite、内存凭据和 Mock Provider 生成 13 张指定截图并更新报告。

结果：阶段 10.3 实现、自动化、来源选择收口与用户验收均已完成；阶段 10 继续 in_progress，进入阶段 10.4。

范围：只产品化单项目项目知识入口与现有 `source → draft → confirm → apply → history` 强制门禁；不扩展提取格式，不新增聊天、Agent、RAG、向量、OCR、网络搜索、监控、费用、云同步、多用户、Schema 或正式数据写入。

### 阶段 10.3A：Knowledge Source Selection Closure（2026-07-17）

状态：complete（阶段 10.3 已通过用户最终验收；阶段 10 保持 in_progress；阶段 10.4 后续由用户明确授权）。

- [x] 统一 `ready/unextracted/failed/unavailable/unsupported` 的选择、提取与 Draft 行为。
- [x] 全选只包含可处理来源；显示“已选 N 份 · 已就绪 N 份”和实际 Draft 来源数量。
- [x] Draft 请求严格提交 `selectedSourceIds ∩ readySourceIds`，后端拒绝任何不存在或非 ready 的来源。
- [x] 提取请求排除 ready、unavailable 与 unsupported，并由后端防御性拒绝非法文件。
- [x] 补齐前后端来源选择专项测试与 1024 响应式断言。
- [x] 重拍来源 1280×900 截图并复核 1024×800 无横向溢出。
- [x] 运行阶段 10.1/10.2/10.3 专项、全量、Next、Rust、diff 和正式数据只读复核。
- [x] 更新正式报告、findings 与 progress；阶段 10.3 转为待用户最终验收，停止且不提交/打标签。

结果：前端来源专项 15/15、相关联合 44/44、全量 95/95；后端 Knowledge/来源 23/23、Provider 安全 17/17、模型 7/7、全量 146/146；Next build、cargo check、cargo test 2/2、diff check 全部通过。两张证据为精确 1280×900/1024×800，1024 无横向溢出；正式库只读保持 3/444/125/273/848、project.json 3、scan_history 4、Provider/Knowledge 0、integrity ok。

范围：只修复来源选择与 Draft 请求语义；不改 Schema、Provider 契约、解析格式、原子写入/回滚、正式数据或其他产品功能。

### 阶段 10.4：Desktop Validation, Release Candidate & Phase 10 Closure（2026-07-17）

状态：complete（工程、真实 Tauri、Sandbox、安全门禁及用户最终验收均已完成；不进入阶段 11）。

- [x] 读取正式任务书、连续性文件并完成 Git 前置门禁；确认当前修改均为已知阶段 10 范围。
- [x] 记录正式库阶段前只读计数、SHA-256、大小与修改时间；全程禁止正式数据写入。
- [x] 审查版本、Tauri 配置、既有打包/本机验收/Sandbox 脚本与产物链，不新增第二套流程。
- [x] 运行阶段 10.1～10.3A 专项、后端/前端全量、Next、Rust 与 diff 门禁。
- [x] 清理仅限旧生成目录并通过现有 `desktop` prebuild/release 流程生成最新 sidecar、Tauri 主程序与 NSIS 候选包。
- [x] 记录前端、sidecar、主程序和安装包的时间、大小、SHA-256、版本与当前 Git commit，并证明阶段 10 独有实现进入运行包。
- [x] 使用隔离临时数据、临时项目、本机 Mock 和假凭据完成宿主机真实 Tauri 冒烟、AI 服务、Knowledge、回滚、退出与 1024×800 验收。
- [x] 在全新 Windows Sandbox 完成干净安装、首次/二次启动、卸载、重新安装、Credential Manager、Provider/Knowledge 端到端及进程/端口清理。
- [x] 生成 10 张实际 Tauri 桌面截图并逐张复核敏感信息、主题、状态与准确尺寸。
- [x] 检查日志、SQLite、Storage、URL、进程参数、环境与临时目录，确认无假密钥/Authorization 泄露。
- [x] 再次只读复核正式库与文件指纹，清理隔离环境，更新报告、findings、progress；阶段 10.4 保持待用户最终验收，不提交、不打标签。

结果：真实 Tauri、本机隔离全链、Windows Sandbox 干净安装/卸载/重装、10 张桌面证据、Provider/Knowledge 安全门禁、候选 NSIS 和正式数据前后指纹均已收口。用户最终验收 passed；阶段 10.4 与阶段 10 均为 complete。

范围：只做桌面、候选安装包、安全回归和阶段 10 报告收口；只有明确桌面回归 Bug 才做最小修复。禁止功能扩展、Schema/migration、真实 Provider、正式 Knowledge/project.json/FTS 写入、提交、标签和阶段 11。


## 阶段 8.1：Project Detail Data Consistency & Evidence Closure（2026-07-16）

状态：complete（用户已完成人工视觉验收及 1024×800 响应式确认；停止，不进入阶段 9）。

- [x] 以隔离正式库只读副本验证三个授权项目的 Materials 链路与 SQLite/service/API JSON 计数一致。
- [x] 将 Materials 查询改为 `LEFT JOIN files` 并返回 `available`，避免历史缺失 file 行被 INNER JOIN 静默删除；隔离回归通过。
- [x] 修复前端 Materials 请求失败态、Materials 契约和项目次级信息；既有前端源码写权限已恢复，本轮未修改 ACL。
- [x] 用户已验收最终“左侧目录树 + 右侧当前目录文件表”、空目录内部、History 和 1024×800 响应式；人工附件按真实 1920×1040 尺寸归档，旧的重复画布截图不作为通过证据。
- [x] 完成专项/全量回归、Next build、Rust 门禁和正式库只读复核；阶段 8 在最终截图验收前保持 in_progress，不提交、不打标签、不进入阶段 9。

严格禁止：修改 Schema、真实 `project.json`、正式索引/历史/项目文件、CAD 或材料分类口径、Dashboard、Settings、Onboarding、AI、Tauri；不得初始化候选项目或进入阶段 9。

### 阶段 8.1A：仓库 ACL 审查（2026-07-16）

- 当前会话 SID 为 `S-1-5-21-401690335-3667124043-4210005704-1003`，中完整性、非管理员。`frontend` 及抽查的受阻文件均非只读、未禁用继承、没有显式或继承 Deny；目录和文件 Owner、父目录 ACE 与可写后端对照无可归因差异。
- Restart Manager 未返回 `api.ts`、`project-detail` 或 `projects/page.tsx` 的已注册文件持有者。临时子文件权限探针的创建、写入、原子重命名、恢复与删除均成功；但既有受阻源码仍不能打开写入。
- 已在 `recovery/2026-07-16_phase8_acl/frontend_acl_before.txt` 保存可由 `icacls /restore` 恢复的前端 ACL 备份，SHA-256 为 `70005B311277571DAC8188469326BFA18A56DF5BB86563C081CAED99B18ACBFF`。
- 曾按最小范围向三个受阻目录尝试授予当前 SID Modify；目录命令成功但所有既有子文件均被拒绝，未改变任何文件 ACL，随后已移除三个目录的临时 ACE。结论为 G（证据不足的环境级既有文件访问异常），不再猜测式修改 ACL。阶段 8 保持 in_progress。

- 8.1A 收口复核：正式库只读仍为 `projects/files/drawings/materials/fts_global/scan_history=3/444/125/273/848/4`、`integrity_check=ok`，真实根 `project.json=3`；`backend.tests.test_phase8_project_library` 4/4 通过。前端、打包和 Rust 验证未重跑，原因是既有前端源码仍拒绝写入，阶段 8 继续 in_progress。

### 阶段 8.1B：前端权限恢复后的收口尝试（2026-07-16）

- SID 复核为 `S-1-5-21-401690335-3667124043-4210005704-1003`。`frontend/lib/api.ts`、`frontend/app/projects/page.tsx`、`frontend/app/project-detail/tabs/MaterialsTab.tsx` 均可对原字节回写；临时文件 Create/Write/Rename/Delete 全部通过。没有修改 ACL。
- 前端已修复 Materials 请求失败态：失败显示“材料数据暂时无法加载”及“重新加载”，成功空数组才显示“暂无材料文件”。Materials 同时显示后端 `available=false` 的不可用状态。项目列表隐藏“项目名称与路径末级目录相同”的重复第二行；Files 根面包屑改用真实项目名。
- 隔离 UI 数据库实测：授权项目的 Materials、嵌套路径直接子文件与 History 计数一致；空目录 fixture 显示“此目录下暂无文件”。1024 验证无页面横向溢出。
- 自动化通过：后端全量 121/121；前端全量 35/35；`cargo check` 通过；`cargo test` 2/2；`git diff --check` 通过。正式库只读仍为 `3/444/125/273/848/4`、`integrity_check=ok`，真实根 `project.json=3`。
- 阻塞：`npm run build` 尝试使用临时 Next 构建目录仍写入 `frontend/.next/trace` 并返回 `EPERM`。另外，内置浏览器在 Files/History/空目录的 900px 高截图画布重复，不能作为验收证据。临时 Next 配置和 tsconfig/next-env 自动改动已恢复；不改 ACL 前，阶段 8 保持 in_progress。
