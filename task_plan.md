# Project Vault Phase 0 到 11 产品实施计划

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
- 使用 release installer 静默安装到 `C:\Users\admin\AppData\Local\Programs\ProjectVaultLocalUsageTest`。
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
