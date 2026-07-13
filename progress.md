# Project Vault 进度记录

## 2026-06-24

- 已准备 D 桌开发工具链：Python 3.12、Node.js、SQLite、Rust/Cargo、VS Code、VS Build Tools、WebView2。
- 已清理安装包。
- 已创建正式工作区：D:\Workflows\ProjectVault。
- 已从旧目录迁移工作流程源文件：0~13 架构文档、PRD 和静默原型。
- 已排除环境配置和运行文件：.venv、
ode_modules、.next、运行数据库、local_settings.json。
- 已重新在新工作区安装后端和前端依赖。
- 已验证后端健康检查：GET /api/v1/health 返回 status=ok。
- 已验证 SQLite 生成表：projects / files / drawings / materials / ai_metadata / ai_providers / scan_history / system_settings。
- 已验证前端页面：http://127.0.0.1:3000 返回 200，显示 Backend online。
- 已创建 Project Vault 项目主计划文件：	ask_plan.md。
- 已创建架构依赖记录：indings.md。
- 已创建进度记录：progress.md。
- 已创建 AGENTS.md，用于新对话继承项目规则。
- 已补全阶段门禁、安全配置、测试数据、Git 检查点、D 桌环境和端口冲突等推进注意事项。

## 当前阶段

Phase 0：工具准备与可运行骨架，状态：complete。

## 下一阶段

Phase 1：桌面壳链路验证。

下一步任务：

1. 在 desktop/ 初始化 Tauri 应用。
2. 验证 Tauri 窗口能加载前端。
3. 验证 Tauri 能启动 Python 后端。
4. 改造为动态端口。
5. 验证关闭窗口后 Python 进程退出。

## 2026-06-24 Phase 1 桌面壳链路验证

- 已创建 Tauri 骨架：desktop/package.json、desktop/src-tauri/Cargo.toml、	auri.conf.json、src/main.rs 和图标资源。
- 已新增后端启动入口：ackend/app/run_server.py，支持 --host、--port、--parent-pid。
- 已新增前端健康检查补接：rontend/app/api/health/route.ts 和 rontend/app/HealthStatus.tsx；桌面环境优先读取 window.__BACKEND_PORT__。
- 已验证后端编译：.venv\Scripts\python.exe -m compileall app 通过。
- 已验证前端构建：
pm run build 通过。
- 已验证 Tauri/Rust 主进程：cargo check 通过。
- 已验证桌面开发运行：
pm run dev 可启动 Tauri 窗口并加载 http://127.0.0.1:3000。
- 已验证动态端口：测试中后端端口为 64674，GET /api/v1/health 返回 status=ok 且数据库存在。
- 已验证异常退后清理：强制结束 project-vault.exe 后，后端父进程守护自动退出，检查结果为
o backend process remains。
- 遗留风险：生产安装包打包不能直接使用 Next .next 目录作为 Tauri 静态资源，后续进入 Release/Packaging 阶段时需要确认生产前端导出策略。

## 当前阶段

Phase 1：桌面壳链路验证，状态：complete。

## 下一阶段

Phase 2：数据库 Schema 与迁移机制。

## 2026-06-24 Phase 2 数据库 Schema 与迁移机制

- 已补全 V1 SQLite Schema：projects / files / drawings / materials / ai_metadata / project_tags / ai_providers / scan_history / system_settings / app_metadata / favorites / schema_migrations / fts_global。
- 已实现幂等迁移机制：PRAGMA user_version = 1，并在 schema_migrations 记录版本 1。
- 已实现可重复初始化：重复运行 initialize_database() 不重复破坏已有库。
- 已实现旧库补齐：旧库会自动补齐新增表、索引、FTS 和迁移记录。
- 已实现旧库 uto_vacuum 转换：当旧库中 uto_vacuum=0 时，会设置 INCREMENTAL 并执行一次 VACUUM。
- 已保持关键路径整洁：iles 表使用 UNIQUE(project_id, relative_path)，没有引入 ile_path 唯一索引。
- 已新增测试：ackend/tests/test_database_migrations.py。
- 已新增基础 Repository：ackend/app/db/repositories.py。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_database_migrations -v，5 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m compileall app tests。
- 验证通过：真实库初始化后 user_version=1、journal_mode=wal、uto_vacuum=2、migrations=1。
- 验证通过：后端启动在 127.0.0.1:8001，GET /api/v1/health 返回 status=ok。
- 验证通过：rontend npm run build 与 desktop/src-tauri cargo check。

## 当前阶段

Phase 2：数据库 Schema 与迁移机制，状态：complete。

## 下一阶段

Phase 3：项目发现与初始化。

## 2026-06-24 Phase 3 项目发现与初始化

- 已新增 ackend/app/projects/discovery.py：实现根据根目录第一层候选选项项目发现。
- 已新增 ackend/app/projects/initializer.py：实现默认 project.json 写入、项目 ID 生成、projects 和 project_tags 基础记录写入。
- 已新增 ackend/app/api/projects.py：提供 GET /api/v1/projects/candidates 和 POST /api/v1/projects/initialize。
- 已更新 ackend/app/main.py 注册 projects 路由。
- 已新增测试：ackend/tests/test_project_discovery.py 和 ackend/tests/test_projects_api.py。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api -v，12 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m compileall app tests。
- HTTP 验证通过：临时根目录下候选选项都通过 /api/v1/projects/candidates 返回；初始化接口会写入默认 project.json 并返回 initialized_count=1。
- 验证清理：临时样例目录已删除；HTTP 验证写入的测试 project_id 已从 SQLite 索引缓存清理。
- 验证通过：rontend npm run build 与 desktop/src-tauri cargo check。

## 当前阶段

Phase 3：项目发现与初始化，状态：complete。

## 下一阶段

Phase 4：Full Scanner。

## 2026-06-24 Phase 4 Full Scanner

- 已新增 ackend/app/scanner/__init__.py、ackend/app/scanner/classifiers.py、ackend/app/scanner/full_scanner.py。
- 已实现 Full Scanner Engine：读取 project.json，以 project_id 作为项目唯一标识，更新 projects 基础信息与统计字段。
- 已实现项目文件递归扫描：写入 iles.relative_path、
elative_dir、ile_name、extension、size_bytes、last_modified 和内容 ile_hash。
- 已实现基础分类：.dwg 写入 drawings，.pdf/.xls/.xlsx/.csv/.jpg/.jpeg/.png/.webp/.doc/.docx 写入 materials。
- 已实现重复扫描避免：每次全量扫描会重建该项目的 iles/drawings/materials 子索引，不制造重复记录。
- 已实现 project_tags 与 i_metadata 从 project.json 同步到 SQLite 缓存。
- 已实现 scan_history：成功扫描写入 success，失败或损坏 project.json 等错误写入 error。
- 已新增测试：ackend/tests/test_full_scanner.py。
- TDD 记录：新增测试后先运行失败，失败原因为 ModuleNotFoundError: No module named 'app.scanner'；随后实现 Scanner Engine 并转绿。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_full_scanner -v，6 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner -v，15 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m compileall app tests。
- 验证通过：rontend npm run build。
- 验证通过：desktop/src-tauri cargo check。

## 当前阶段

Phase 4：Full Scanner，状态：complete。

## 下一阶段

Phase 5：增量扫描与符号迁移。

## 2026-06-24 Phase 5 增量扫描与符号迁移

- 已启动 Phase 5。
- 执行清单：新增增量扫描测试；实现 Hash Diff；实现新增、修改、删除、移动的增量写入；实现同 project_id 不同 project_path 的 Relocation 处理；验证删除安全边界。
- 验收清单：新文件、修改文件、删除文件都正确更新数据库；项目路径变化只更新项目路径且不级联删除项目数据；增量扫描通过覆盖测试达到本阶段正确要求。
- 已新增 ackend/tests/test_incremental_scanner.py，覆盖新增、修改、删除、移动、项目路径迁移和丢失 project.json 的删除安全边界。
- 已新增 ackend/app/scanner/incremental_scanner.py。
- 已实现 Hash Diff：读取 SQLite 中的已有 iles 记录，与当前文件系统扫描结果按
elative_path 和文件指针对比。
- 已实现新增文件处理：插入 iles，并按扩展名刷新 drawings/materials 子索引。
- 已实现修改文件处理：更新 ile_hash、大小、修改时间，并刷新子索引。
- 已实现删除文件处理：只在已成功读取当前项目 project.json 后删除对应 iles 及子索引。
- 已实现移动文件处理：相同内容指针的路径变化会保留原 iles.id，只更新
elative_path 等字段。
- 已实现 Relocation：当扫描到同一 project_id 但项目根路径变化时，视为项目迁移，只更新 projects.project_path，不删除项目和子索引。
- 已修正扫描历史：增量扫描成功和失败都写入 event_type=incremental_scan；扫描历史写入显性 created_at，避免同秒排序读到上一条记录。
- TDD 记录：新增测试后先失败，失败原因为 ModuleNotFoundError: No module named 'app.scanner.incremental_scanner'；实现后发现移动识别指针包含路径、错误日志事件类型复用 full_scan 两个问题，已修复并转绿。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_incremental_scanner -v，4 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner -v，19 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m compileall app tests。
- 验证通过：rontend npm run build。
- 验证通过：desktop/src-tauri cargo check。

## 当前阶段

Phase 5：增量扫描与符号迁移，状态：complete。

## 下一阶段

Phase 6：File Watcher 与事件队列。

## 2026-06-24 Phase 6 File Watcher 与事件队列

- 已启动 Phase 6。
- Best Solution：使用成熟 watchdog 负责 OS 文件系统监听；自研事件模型、临时文件黑名单、异步事件队列与 2 秒防抖。
- Current Limitation：当前前端虚拟环境还未安装 watchdog，
equirements.txt 也未声明此依赖。
- Recommended Upgrade Path：将 watchdog 加入后端依赖并安装到 .venv，再实现 Watcher Adapter；核心过虑与队列逻辑保持无外部依赖，方便单元测试。
- Fallback Solution：如后续无法安装 watchdog，可暂时保留队列过滤核心，由手动扫描或置备触发事件替代，但这不是 Phase 6 的最优长策。
- 执行清单：新增 watcher 测试；实现事件模型；实现临时文件黑名单；实现 2 秒防抖队列；实现 watchdog 适配器；验证 Watcher 不直接写数据库。
- 验收清单：Create/Modify/Delete/Move 事件能进队列；临时文件被跳过；常规变化可在 2 秒窗口后触发同步；Watcher 不执行数据库写入。
- 已新增 ackend/tests/test_watcher_engine.py，覆盖事件入队、临时文件过滤、2 秒防抖合并、跳过事件不入队和等待 ready 事件。
- 已新增 ackend/tests/test_watchdog_adapter.py，覆盖 watchdog 事件到内部 WatchEvent 的转换，并验证目录和临时文件被跳过。
- 已新增 ackend/tests/test_watcher_service.py，覆盖 Watcher 服务对临时目录的启动、停止、非法目录和重复启动保护。
- 已新增 ackend/app/watcher/events.py、ackend/app/watcher/queue.py、ackend/app/watcher/adapter.py、ackend/app/watcher/service.py。
- 已更新 ackend/requirements.txt，新增 watchdog==6.0.0。
- 已安装 watchdog==6.0.0 到后端 .venv。
- TDD 记录：新增 watcher engine 测试后先失败，失败原因为 ModuleNotFoundError: No module named 'app.watcher'；实现核心后转绿。新增 watchdog adapter 测试后先失败，失败原因为 ModuleNotFoundError: No module named 'app.watcher.adapter'；实现适配器后转绿。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service -v，10 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service -v，29 个测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m compileall app tests。
- 验证通过：rontend npm run build。
- 验证通过：desktop/src-tauri cargo check。
- 发现：pip show watchdog 在 Windows GBK 控制台输出作者名时触发 UnicodeEncodeError 时截错误，但包已成功安装，导入和测试均通过；后续命令行展示 Python 包元数据时可优先用 UTF-8 环境变量或 pip list。

## 当前阶段

Phase 6：File Watcher 与事件队列，状态：complete。

## 下一阶段

Phase 7：FTS5 全局搜索。

## 2026-06-24 Phase 7 FTS5 全局搜索

- 已启动 Phase 7。
- Best Solution：统一用 SQLite FTS5 虚拟表 ts_global，由应用层索引器负责重建和按项目刷新；扫描器成功写入业务索引后同步更新对应项目 FTS，并提供 GET /api/v1/search 作为前端全局搜索入口。
- Current Limitation：当前已有 FTS5 表结构，但还缺少 FTS Builder、Search Service、搜索 API 路由和扫描后的 FTS 同步。
- Recommended Upgrade Path：新增 ackend/app/search/ 模块，先用可重复 rebuild 保证索引可重建，再把全量/增量扫描成功后的项目级刷新接入；Recent Search 先保留接口结构扩展点，不在本阶段大范围铺开。
- Fallback Solution：如果当前 SQLite 环境缺少 FTS5，则只能退回到 LIKE 查询；但这不满足 10,000 文件内容小于 100ms 的目标，需优先验证并使用 FTS5。
- 执行清单：新增搜索索引与 API 测试；实现 FTS 索引器；实现分类搜索服务；注册 /api/v1/search；接入 Scanner 成功后的项目 FTS 刷新；补全性能验收测试；完成更新计划与发现。
- 验收清单：可搜索项目名、项目 ID、文件名、CAD 名称、材料名、标签、备注；结果按 Projects / Files / CAD / Materials 分类；空查询返回 400；10,000 文件内容查询小于 100ms；完整后端/前端/界面验证通过。
- 已新增 ackend/tests/test_search_index.py，覆盖 FTS 重建、项目/项目 ID/文件/CAD/材料/标签/备注搜索、分类过滤和 10,000 文件性能验收。
- 已新增 ackend/tests/test_search_api.py，覆盖搜索 API envelope、结果字段和空查 400。
- TDD 记录：新增测试后先失败，失败原因为 ModuleNotFoundError: No module named 'app.search' 和 ModuleNotFoundError: No module named 'app.api.search'；实现搜索模块和 API 后转绿。
- 已新增 ackend/app/search/indexer.py 和 ackend/app/search/service.py；已新增 ackend/app/api/search.py；已更新 ackend/app/main.py 注册搜索路由。
- 已更新 ackend/app/scanner/full_scanner.py 和 ackend/app/scanner/incremental_scanner.py，扫描成功后按项目更新 FTS5 索引。
- 修复记录：项目 ID project-search 这类带连字符查询会被 FTS5 当成表达式解析并抛
o such column: search；已通过短语译义处理用户查询，搜索项目 ID 和文件名更稳定。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_search_index tests.test_search_api -v，2 个搜索专项测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api -v，34 个后端测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m compileall app tests。
- 验证通过：rontend npm run build。
- 验证通过：desktop/src-tauri cargo check。

## 当前阶段

Phase 7：FTS5 全局搜索，状态：complete。

## 下一阶段

Phase 8：核心 API 完整化。

## 2026-06-24 Phase 8 核心 API 完整化

- 已启动 Phase 8。
- Best Solution：在现有 SQLite 索引缓存和 Scanner Engine 之上，补全前端 MVP 所需的只读数据 API、设置 API、扫描触发 API 和受控资产流 API；API 统一 envelope，列表接口统一分页，文件资产只通过 ile_id 解析，不暴露本地绝对路径。
- Current Limitation：当前已有健康检查、项目列表/发现、初始化和全局搜索 API，但缺少 Dashboard、Projects 列表/详情、Files、Drawings、Materials、Assets、Settings、History、Scanner 状态触发等前端稳定入口。
- Recommended Upgrade Path：新增 pp/api/response.py 统一响应；按领域新增 repository/service/router 模块；先用同步 FastAPI + sqlite3 继续当前代码风格，后续如需高并发再迁移到异步连接层。
- Fallback Solution：如某些高功能力如缩略图生成或后台任务队列尚不成熟，本阶段先提供安全边界明确的占位行为，例如缩略图生成返回 404、扫描触发同步执行并返回结果；不退回到绝对路径直传。
- 执行清单：补全核心 API 测试；实现统一响应工具；补 Dashboard/Projects/Files/Drawings/Materials/Assets/Settings/History/Scanner 路由与服务；更新 main 注册；全部验证并同步计划文件。
- 验收清单：API 返回结构统一 status / data / message / meta；Projects 列表支持筛选、排序、分页；项目详情和文件列表返回
elative_path；资产内容只允许通过 ile_id 获取；不出现 GET /api/file?path=C:/... 类接口；后端/前端/界面验证通过。
- 已新增 ackend/tests/test_phase8_core_api.py，覆盖 Dashboard、Projects 列表/收藏/详情/AI 元数据、Files、Drawings、Materials、Assets、Settings、History 和 Scanner API。
- TDD 记录：新增 Phase 8 测试后先失败，失败原因为 ModuleNotFoundError: No module named 'app.api.assets'；补全 Phase 8 路由和核心服务后转绿。
- 已新增 ackend/app/api/response.py，统一 success envelope 与分页 meta。
- 已新增 ackend/app/core_api.py，集中实现核心 API 的查询、分页、排序白名单、设置读写、历史查询、扫描触发和资产受控路径解析。
- 已新增路由：ackend/app/api/dashboard.py、iles.py、drawings.py、materials.py、ssets.py、settings.py、history.py、scanner.py。
- 已扩展 ackend/app/api/projects.py：新增项目列表、收藏切换、项目 Overview、AI Metadata。
- 已更新 ackend/app/main.py 注册 Phase 8 新路由。
- 安全边界：资产内容只通过 GET /api/v1/assets/{file_id}/content 获取；服务端用 project_path + relative_path 动态解析并验证物理路径仍在受控项目根目录内；没有新增绝对路径直传接口。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_phase8_core_api -v，11 个 Phase 8 专项测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api -v，37 个后端测试全部 OK。
- 验证通过：.venv\Scripts\python.exe -m compileall app tests。
- 验证通过：rontend npm run build。
- 验证通过：desktop/src-tauri cargo check。

## 当前阶段

Phase 8：核心 API 完整化，状态：complete。

## 下一阶段

Phase 9：前端 MVP。

## 2026-06-25 Phase 9 前端 MVP 验收记录

- 状态：complete。
- 完成内容：后端新增 AI Provider CRUD API（`core_api.py` 6 个核心函数 + `api/providers.py` 路由 + 8 个测试）；前端完成全部 MVP 页面，包括 Dashboard（指标卡片 + 最近项目表）、Projects 列表页（筛选/排序/收藏/分页）、Project Detail 六 Tab 页面（Overview/Files/Drawings/Materials/AI Metadata/History，支持 Rescan 触发）、Settings 页面（根目录/扫描间隔/主题）、AI Center 页面（Provider CRUD + 结构就绪检查 + 启停切换）；已完成前端基础设施（API 客户端层 `frontend/lib/api.ts`、暗色主题 CSS、Layout 组件、Sidebar 导航、Ctrl+K Command Palette 全局搜索）。
- 后端 AI Provider API：新增 `backend/app/core_api.py` 末尾 6 个函数（`list_ai_providers`/`create_ai_provider`/`update_ai_provider`/`delete_ai_provider`/`test_ai_provider`/`_provider_row_to_dict`）；新增 `backend/app/api/providers.py` 路由（GET/POST/PUT/DELETE + test）；在 `backend/app/main.py` 注册 `providers_router`；新增 `backend/tests/test_providers_api.py`，8 个测试全部 OK。安全边界：`key_reference` 不暴露，只返回 `has_key` 布尔值。
- 前端页面清单：`frontend/app/page.tsx`（Dashboard）、`frontend/app/projects/page.tsx`（Projects 表格列表）、`frontend/app/projects/[id]/page.tsx`（Project Detail 六 Tab）、`frontend/app/settings/page.tsx`（Settings）、`frontend/app/ai-center/page.tsx`（AI Center）、`frontend/app/layout.tsx`（布局）、`frontend/app/components/Sidebar.tsx`（侧边栏）、`frontend/app/components/CommandPalette.tsx`（全局搜索）。
- API 代理：`frontend/next.config.ts` 配置了 `rewrites`，将 `/api/v1/:path*` 转发到后端 `http://127.0.0.1:8000`（支持 `BACKEND_URL` 环境变量覆盖），解决浏览器开发模式下 API 请求无法到达后端的问题。
- 清理：旧的 `frontend/app/HealthStatus.tsx` 当前已不存在；保留 `frontend/app/api/health/route.ts` 作为开发健康检查代理。
- tsconfig.json 重新格式化为标准 JSON，修复 Turbopack 路径解析问题。
- 这次补写确认：Phase 9 已按真实代码重新核对并回写，不只是修乱码；文档内容以当前 `frontend/`、`backend/app/api/providers.py`、`backend/app/core_api.py` 和 `backend/tests/test_providers_api.py` 为准。
- 验证命令：
```powershell
cd D:\Workflows\ProjectVaultackend
.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api tests.test_providers_api -v
.venv\Scripts\python.exe -m compileall app tests

cd D:\Workflows\ProjectVaultrontend
npm run build

cd D:\Workflows\ProjectVault\desktop\src-tauri
cargo check
```
- 验证结果：后端 45 个测试全部 OK；后端编译检查通过；前端生产构建通过（7 个路由：/、/ai-center、/projects、/projects/[id]、/settings、/api/health、/_not-found）；桌面 Rust 主进程检查通过。
- 遗留边界：CAD Center 跨项目图纸汇总页面属于 Phase 10；Tauri 桌面壳 `window.__BACKEND_PORT__` 运行时注入待后续接入；Scanner 触发为同步执行，后台任务队列留待后续增强。
## 当前阶段

Phase 9：前端 MVP，状态：complete。

## 下一阶段

Phase 10：CAD Center。

## 2026-06-25 Phase 10 CAD Center 启动记录

- 状态：in_progress。
- Best Solution：复用现有 `drawings` 表、Scanner 分类器、`/api/v1/drawings/center` 与 `/api/v1/drawings/{id}/versions`，补强 CAD 分类识别、版本链归组和 CAD Center 跨项目列表能力，不新建重复索引体系。
- Current Limitation：当前已有 CAD Center 雏形，但分类规则较粗，`version_group` 仍偏向版本 token 而不是同一图纸基础组，跨项目列表筛选与版本链展示还需要补齐。
- Recommended Upgrade Path：先用后端测试锁定分类与版本链行为，再最小修改 Scanner 分类器和 Drawing API；前端沿用现有 `/cad-center` 页面并通过 API 客户端统一请求。
- Fallback Solution：如果后续真实 DWG 命名样本不足，先以中英文关键词和常见版本后缀规则覆盖 V1 验收，保留规则字典扩展点，不引入重量级 CAD 解析依赖。
- 执行清单：补 CAD 分类测试；补版本链归组测试；增强分类器；补 `/drawings/center` 分类/搜索筛选；完善 CAD Center 页面版本链入口；完成后端、前端和桌面检查。
- 验收清单：平面图、立面图、天花板图、节点图、构造图、其他可分类；V1、V2、FINAL 等命名能归入同一版本链并正确排序；跨项目 CAD 列表可按分类、搜索、排序浏览。
- 已新增 Phase 10 专项测试：`backend/tests/test_phase10_cad_center.py`，覆盖 CAD 分类、版本组归一、FINAL/V1/V2 排序和 CAD Center 分类/搜索查询。
- 已增强 `backend/app/scanner/classifiers.py`：`version_group` 现在保存去除版本后缀的稳定图纸组，`version_number` 支持 V1/V2/FINAL/REV/日期版本排序，分类补齐 `构造` 等中文关键词。
- 已增强 Drawing API：`/api/v1/drawings/center` 支持 `category` 与 `q` 查询参数，返回 `version_group` 和 `version_number`；`/api/v1/drawings/{id}/versions` 限定同项目同图纸组，避免跨项目同名串链。
- 已更新 CAD Center 前端：`frontend/app/cad-center/page.tsx` 使用统一 `frontend/lib/api.ts` 客户端，支持服务端搜索、分类筛选、版本链侧栏和项目跳转；Sidebar 已加入 CAD Center 入口。
- 已安装前端依赖 `lucide-react`，原因是 CAD Center 页面采用图标组件并且项目之前没有图标库；`npm install` 后提示 2 个 audit 问题，未执行 `npm audit fix --force`，避免破坏 Next/React 版本兼容。
- 验证通过：`.venv\Scripts\python.exe -m unittest tests.test_phase10_cad_center -v`，2 个 Phase 10 专项测试 OK。
- 验证通过：`.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api tests.test_providers_api tests.test_phase10_cad_center -v`，47 个后端测试全部 OK。
- 验证通过：`.venv\Scripts\python.exe -m compileall app tests`。
- 验证通过：`cmd /c npm run build`，前端生产构建通过，包含 `/cad-center` 路由。
- 验证通过：`cargo check`，桌面 Rust 主进程检查通过；输出 1 条 hard link fallback warning，不影响检查结果。
- 备注：PowerShell 直接运行 `npm run build` 会被执行策略阻止加载 `npm.ps1`，本轮使用 `cmd /c npm run build` 调用 `npm.cmd` 验证。
## 2026-06-25 Phase 10 CAD Center 验收记录

- 状态：complete。
- 功能验收：通过。CAD 分类已覆盖平面图、立面图、天花板图、节点图、构造图和其他；版本链可识别并归组 V1、V2、FINAL 等常见命名；CAD Center 跨项目列表支持分类筛选、搜索、排序、项目跳转和版本链侧栏。
- 架构验收：通过。继续复用 `drawings` 表、Scanner 分类器、Drawing API 和统一前端 API 客户端；未引入重复索引体系；资产访问仍不暴露本地绝对路径。
- 产品范围验收：通过。Phase 10 未加入在线 CAD 查看、在线编辑、AI 聊天、Agent、权限或云同步等 V1 明确不做内容。
- 验证通过：`.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api tests.test_providers_api tests.test_phase10_cad_center -v`，47 个后端测试全部 OK。
- 验证通过：`.venv\Scripts\python.exe -m compileall app tests`。
- 验证通过：`cmd /c npm run build`，前端生产构建通过，包含 `/cad-center` 路由。
- 验证通过：`cargo check`，桌面 Rust 主进程检查通过。
- 遗留风险：当前分类准确率目标通过规则样本测试覆盖，真实项目命名仍可能存在行业/公司私有缩写；后续可在真实样本导入后扩展分类词典。`lucide-react` 安装后 `npm audit` 仍提示 2 个漏洞，本轮未使用 `npm audit fix --force`，避免破坏 Next/React 版本兼容。

## 当前阶段

Phase 10：CAD Center，状态：complete。

## 下一阶段

Phase 11：系统功能与维护任务。
## 2026-06-25 Phase 11 系统功能与维护任务启动记录

- 状态：in_progress。
- Best Solution：复用现有 `assets/{file_id}/content` 安全路径解析、`history` API、`system_settings`、`scan_history` 和 SQLite 维护能力，新增受控 System API 与维护服务，不暴露本地绝对路径给前端，不绕过 `file_id` 安全边界。
- Current Limitation：当前已有 History Tab、Settings 基础保存和受控资产流，但缺少 Explorer Open / Reveal Folder 系统接口、独立 History 页面、日志保留策略执行、数据库维护任务、备份/恢复入口和对应前端操作面。
- Recommended Upgrade Path：先以 TDD 补后端系统与维护 API（Explorer、History 全局页、maintenance、backup/restore），再接入 Settings/History 前端入口；系统调用保持 Windows 本地能力边界，所有真实文件打开动作通过 `file_id` 解析受管路径。
- Fallback Solution：如果桌面环境或系统命令不可用，API 返回可恢复错误并保留 Reveal/Open 按钮禁用状态；数据库维护至少提供 dry-run 与手动触发，不依赖后台调度先落地。
- 执行清单：新增 Phase 11 后端测试；实现 Explorer Open / Reveal Folder 受控接口；补全 Settings 保存确认和系统维护入口；补全全局 History 页面；实现 scan_history 日志保留清理；实现 `PRAGMA incremental_vacuum` 维护任务；实现备份/恢复最小 API 与前端入口；完成后端、前端、桌面验证并记录验收。
- 验收清单：打开文件功能只对本地可访问且属于受管项目根目录的路径生效；`scan_history` 普通日志保留 30 天；Warning/Error 最长保留 180 天；数据库维护任务可执行 `incremental_vacuum`；备份/恢复入口不破坏项目业务文件；后端/前端/桌面检查通过。
- 相关架构依据：`docs/architecture/08_API_Specification.md` 的 System Explorer 与 History API；`docs/architecture/10_Database_Implementation_Plan.md` 的 Backup/Recovery/Rebuild 策略；`docs/architecture/11_Core_Engine_Implementation_Plan.md` 的 Database Maintenance Task；`docs/architecture/12_Release_Deployment_Plan.md` 的 Backup/Restore/Logging 部署约束。

## 2026-06-25 Phase 11 系统功能与维护任务验收记录

- 状态：complete。
- 完成内容：新增 `backend/app/api/system.py` 路由并注册到 `backend/app/main.py`；扩展 `backend/app/core_api.py`，实现 `file_id` 受控 Explorer Open / Reveal Folder、`scan_history` 保留清理、`PRAGMA incremental_vacuum`、SQLite 备份创建与恢复；新增 `backend/tests/test_phase11_system_maintenance.py`，覆盖路径安全、日志保留、incremental vacuum、备份/恢复不破坏业务文件。
- 前端入口：新增 `frontend/app/history/page.tsx` 全局 History 页面；Sidebar 加入 History；`frontend/app/settings/page.tsx` 增加 Run Maintenance、Create Backup、Restore Backup；`frontend/app/projects/[id]/page.tsx` 的 Files Tab 增加 Open / Reveal 操作；`frontend/lib/api.ts` 补齐系统维护与备份恢复 API 客户端。
- 文档同步：`README.md` 的 Current Milestone 已更新为 Phase 11 完成并进入 Phase 12；`task_plan.md` 已将 Phase 11 标为 complete、Phase 12 标为 in_progress；`docs/architecture/08_API_Specification.md` 已把 Explorer 请求体从 `target_path` 修正为 `file_id`，并补充维护/备份/恢复端点。
- TDD 记录：新增 Phase 11 测试后先失败，失败原因为 `ModuleNotFoundError: No module named 'app.api.system'`；实现系统 API 后 Explorer 测试先转绿；维护测试暴露测试日期未超过 180 天、备份恢复受 WAL 影响两个问题，已通过修正测试夹具日期、备份前 checkpoint、显式关闭 SQLite 连接、恢复前清理 `-wal/-shm` 后转绿。
- 功能验收：通过。打开/定位文件只接受 `file_id`，服务端解析 `project_path + relative_path` 并验证仍在受管项目根目录内；缺失文件返回 404，路径越界返回 403；前端没有传递或暴露本地绝对路径。
- 架构验收：通过。维护任务复用 SQLite 缓存边界，不修改 `project.json` 或项目业务文件；备份/恢复只操作数据库缓存文件；History 继续基于 `scan_history` 分页接口；未引入后台调度或新的重型依赖。
- 产品范围验收：通过。Phase 11 仅补齐日常使用、维护和安全边界，没有加入 V1 明确不做的云同步、权限系统、AI 聊天、Agent 或在线文件编辑。
- 验证通过：`.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api tests.test_providers_api tests.test_phase10_cad_center tests.test_phase11_system_maintenance -v`，50 个后端测试全部 OK。
- 验证通过：`.venv\Scripts\python.exe -m compileall app tests`。
- 验证通过：`cmd /c npm run build`，前端生产构建通过，包含 `/history` 路由。
- 验证通过：`cargo check`，桌面 Rust 主进程检查通过。
- 遗留风险：Explorer Open / Reveal 在无系统打开能力的环境会返回 `system_open_unavailable`，前端当前以错误提示降级；备份恢复当前是手动输入备份名的最小入口，Phase 12 可继续补备份列表、恢复确认流和真实桌面端体验验收。

## 当前阶段

Phase 11：系统功能与维护任务，状态：complete。

## 下一阶段

Phase 12：V1 Release Candidate。

## 2026-06-25 Phase 12 V1 Release Candidate 启动记录

- 状态：in_progress。
- Best Solution：以 `docs/architecture/12_Release_Deployment_Plan.md` 和 `13_Development_Roadmap.md.md` 的 RC1 清单为门禁，先冻结功能范围，再通过自动化命令和样例项目验证 Full Scan、Incremental Scan、Watcher、SQLite/FTS5、核心页面构建、Settings/History/Explorer Integration、Tauri Sidecar lifecycle、性能目标和发布文档。
- Current Limitation：当前后端/前端/桌面开发检查已通过，但发布层仍有已知风险：Tauri `frontendDist` 仍指向 `.next`，生产打包策略未完全冻结；备份恢复入口仍是最小手动输入；缺少正式发布检查清单、使用说明、回滚和重建说明文档；100,000 文件与真实启动时间尚未在本阶段重新跑证据。
- Recommended Upgrade Path：先跑 RC 基线命令定位真实失败点；优先修复不会改变 V1 功能范围的发布配置和文档缺口；新增 RC 验收脚本或测试只针对发布门禁，不引入新业务功能；若生产打包无法在当前环境完整通过，则记录具体阻塞、保留 debug/开发链路证据，并把发布打包作为 Phase 12 未完成项。
- Fallback Solution：若当前环境无法完成无 Python 环境打包验收，则至少完成开发环境 RC 验收、Tauri `cargo check`/debug build、Sidecar 生命周期验证、前后端构建、数据库备份恢复和发布文档；不把无法验证的 Installer 项伪装为通过。
- 执行清单：跑后端全量测试与 compileall；跑前端 build；跑 Tauri cargo check 与可行的 debug build；验证 Full/Incremental/Watcher/SQLite/FTS5/Backup/Restore/Explorer 的现有专项测试；补发布检查清单；补使用说明；补回滚和重建说明；检查 API 文档与 README 当前里程碑；记录性能目标证据和遗留风险。
- 验收清单：Full Scan、Incremental Scan、Watcher、SQLite/FTS5、Dashboard/Projects/Files/CAD Center、Settings/History/Explorer Integration 通过；搜索查询小于 100ms；100,000 文件目标有可复现验证或明确风险；Tauri Sidecar lifecycle 有 fresh 证据；V1 RC 文档齐全；未引入 V1 明确不做内容；所有未通过项写入 `progress.md`。
## 2026-06-25 16:41 Phase 12 RC 验收推进记录

- 状态：in_progress；开发环境 RC 验收核心链路已通过，V1 Final 发布仍被生产 Sidecar 打包阻塞。
- Best Solution：保留全项目对账式增量扫描作为手动 Rescan 兜底，同时为 Watcher/RC 这类已知文件事件新增 `changed_paths` 快路径，避免 100k 项目中单文件变更仍全目录遍历和整项目 FTS 重建。
- Current Limitation：Watcher 当前完成事件监听、过滤和防抖队列验证，但尚未实现常驻后台消费队列并自动写库的产品化闭环；手动 Rescan 仍走全项目对账路径。生产 Sidecar 打包未完成，`externalBin` 为空，桌面主进程仍依赖 `backend/.venv/Scripts/python.exe`。
- Recommended Upgrade Path：Phase 12 后续应把 Watcher ready events 接到 `scan_project_incremental(..., changed_paths=[...])`；发布层应安装并固定 PyInstaller/Nuitka，生成后端 sidecar exe，配置 Tauri `externalBin`，再在无 Python/Node 的 Windows 10/11 环境验收。
- Fallback Solution：若生产打包暂不推进，只能标记为开发环境 RC；不将 debug NSIS 或本机 venv 链路伪装为最终发布包。
- 代码变更：`backend/app/scanner/incremental_scanner.py` 新增 `changed_paths` 快路径、单文件 record 构建、局部项目统计更新；`backend/app/search/indexer.py` 新增 `refresh_search_index_entities`，支持按实体刷新 FTS；`scripts/phase12_rc_check.py` 改为用新增文件路径验证已知变更增量扫描。
- 测试变更：`backend/tests/test_incremental_scanner.py` 新增快路径测试，断言 1200+ 文件项目中 known changed-path 扫描不会调用全项目枚举，同时更新 files/materials/FTS/scan_history；`backend/tests/test_phase12_rc_check.py` 继续覆盖 RC 脚本备份恢复。
- 专项验证通过：`cd D:\Workflows\ProjectVault\backend; .venv\Scripts\python.exe -m unittest tests.test_incremental_scanner tests.test_phase12_rc_check -v`，6 tests OK。
- RC 小样本验证通过：`.venv\Scripts\python.exe ..\scripts\phase12_rc_check.py --files 1000`；Full Scan 1,004 files / 240 ms；Incremental Scan 19 ms；Search 2.222 ms；Backup/Restore 通过。
- RC 100k 验证通过：`.venv\Scripts\python.exe ..\scripts\phase12_rc_check.py --files 100000`；Full Scan 100,004 files / 25,011 ms；Incremental Scan 370 ms；FTS rows 100,008；Search 2.869 ms；Backup size 91,594,752 bytes；Restore 通过；total 77,467 ms；passed=true。
- 工具/依赖检查：Context7 查询 Tauri 文档时返回 monthly quota exceeded，未能使用该 MCP 获取最新文档；本地检查确认 `@tauri-apps/cli@2.11.3` 已安装，PyInstaller 未安装（`Package(s) not found: pyinstaller`）。
- 文档变更：新增 `docs/release/V1_RC_CHECKLIST.md`、`docs/release/USER_GUIDE.md`、`docs/release/ROLLBACK_REBUILD.md`；更新 `README.md` Current Milestone；更新 `task_plan.md` Phase 12 RC 状态记录。
- 遗留风险：启动 `<3s` 尚未在 clean packaged app 上验证；生产 installer 尚未满足“用户无需 Python/Node”的发布目标；Watcher 自动消费队列未接入产品化后台同步。

## 2026-06-25 16:45 Phase 12 最终验证记录

- 后端完整测试通过：`cd D:\Workflows\ProjectVault\backend; .venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api tests.test_providers_api tests.test_phase10_cad_center tests.test_phase11_system_maintenance tests.test_phase12_rc_check -v`，52 tests OK。
- 后端编译检查通过：`cd D:\Workflows\ProjectVault\backend; .venv\Scripts\python.exe -m compileall app tests`。
- 前端生产构建通过：`cd D:\Workflows\ProjectVault\frontend; cmd /c npm run build`，Next.js 16.1.0 编译成功，路由包含 `/`、`/ai-center`、`/cad-center`、`/history`、`/projects`、`/projects/[id]`、`/settings`。
- 桌面 debug build 通过：`cd D:\Workflows\ProjectVault\desktop; cmd /c npm run check`，生成 `D:\Workflows\ProjectVault\desktop\src-tauri\target\debug\bundle\nsis\Project Vault_0.1.0_x64-setup.exe`。
- Phase 12 判定：开发环境 V1 RC 验收通过；V1 Final 不应标记完成，直到生产 Sidecar executable、Tauri `externalBin` 和 clean Windows 无 Python/Node 启动验收完成。

## 2026-06-25 17:01 Phase 12.1 Production Sidecar Packaging 记录

- 状态：本机 sidecar 打包链路已完成；V1 Final 仍等待 clean Windows 10/11 无 Python/Node 安装启动验收。
- Best Solution：采用 Tauri `externalBin` + PyInstaller onefile 后端 sidecar。最终用户不需要安装 Python/Node，桌面主进程只负责分配动态端口、启动 sidecar、注入 `window.__BACKEND_PORT__` 并在退出时清理进程树。
- Current Limitation：当前机器已能构建 sidecar exe 和 debug NSIS installer，但还没有独立 clean Windows 环境验证安装、首次启动、退出清理和无 Python/Node 依赖。
- Recommended Upgrade Path：在 clean Windows 10/11 测试机或 VM 上安装 `D:\Workflows\ProjectVault\desktop\src-tauri\target\debug\bundle\nsis\Project Vault_0.1.0_x64-setup.exe`，确认应用能启动、后端 health 正常、数据库落在 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`，并确认关闭应用后无残留 `project-vault-backend` 进程。
- 代码/配置变更：新增 `backend/requirements-build.txt`、`scripts/build_backend_sidecar.ps1`、`backend/tests/test_phase12_sidecar_packaging.py`；更新 `desktop/src-tauri/tauri.conf.json` 的 `bundle.externalBin`；更新 `desktop/src-tauri/src/main.rs` 使用 `tauri_plugin_shell::ShellExt` 启动 `project-vault-backend` sidecar；更新 `backend/app/core/config.py`，PyInstaller frozen 环境默认数据库路径改为 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`；`.gitignore` 排除 sidecar exe 构建产物。
- TDD 记录：新增 sidecar packaging 测试后先失败，失败原因分别为缺少构建脚本、`externalBin` 为空、Rust 仍依赖 `.venv`/`python.exe`；实现脚本、配置和 Rust sidecar 启动后转绿。随后新增 frozen sidecar 数据库路径测试，先因缺少 `default_database_path` 失败，修正配置后转绿。
- Sidecar 构建通过：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build_backend_sidecar.ps1 -SkipInstall -Clean` 生成 `D:\Workflows\ProjectVault\desktop\src-tauri\binaries\project-vault-backend-x86_64-pc-windows-msvc.exe`，大小 17,021,612 bytes。
- Sidecar 独立 health 验证通过：启动生成的 exe 后请求 `http://127.0.0.1:8765/api/v1/health` 返回 `{"status":"ok","service":"project-vault-backend","database":{"path":"C:\\Users\\admin\\AppData\\Local\\ProjectVault\\database\\project_vault.db","exists":true}}`。
- Tauri bundle 验证通过：`cd D:\Workflows\ProjectVault\desktop; cmd /c npm run check` 成功生成 `D:\Workflows\ProjectVault\desktop\src-tauri\target\debug\bundle\nsis\Project Vault_0.1.0_x64-setup.exe`，大小 21,794,961 bytes；构建输出包含运行时 sidecar `desktop\src-tauri\target\debug\project-vault-backend.exe`。
- 回归验证通过：`cd D:\Workflows\ProjectVault\backend; .venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_project_discovery tests.test_projects_api tests.test_full_scanner tests.test_incremental_scanner tests.test_watcher_engine tests.test_watchdog_adapter tests.test_watcher_service tests.test_search_index tests.test_search_api tests.test_phase8_core_api tests.test_providers_api tests.test_phase10_cad_center tests.test_phase11_system_maintenance tests.test_phase12_rc_check tests.test_phase12_sidecar_packaging -v`，56 tests OK。
- 回归验证通过：`cd D:\Workflows\ProjectVault\backend; .venv\Scripts\python.exe -m compileall app tests`。
- 回归验证通过：`cd D:\Workflows\ProjectVault\frontend; cmd /c npm run build`，Next.js 16.1.0 build 成功，路由包含 `/`、`/ai-center`、`/cad-center`、`/history`、`/projects`、`/projects/[id]`、`/settings`。
- 回归验证通过：`cd D:\Workflows\ProjectVault\desktop\src-tauri; cargo check`。

## 2026-06-25 17:20 Clean Windows 验收准备记录

- 状态：最终 clean Windows 验收尚未执行；自动化验收入口已准备。
- Best Solution：在真正 clean 的 Windows 10/11 环境中，只复制 installer 与验收脚本，验证 Python/Node 不可执行、NSIS 安装成功、桌面应用启动、sidecar health 正常、SQLite 写入 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`、关闭应用后无残留 `project-vault-backend` 进程。
- Current Limitation：当前 Codex 会话不能直接执行最终 clean Windows 验收。检查结果：`C:\Windows\System32\WindowsSandbox.exe` 不存在；Hyper-V cmdlet 存在但 `Get-VM` 返回无权限；当前管理员组 token 为 deny-only；Docker 是 `desktop-linux` 上下文，不能代表 clean Windows 桌面环境；WSL 没有可用发行版且也不是 Windows 验收目标。
- 新增文件：`scripts/verify_clean_windows_release.ps1`、`scripts/ProjectVaultCleanWindows.wsb`、`docs/release/CLEAN_WINDOWS_VALIDATION.md`。
- 验收脚本静态检查通过：`[System.Management.Automation.PSParser]::Tokenize(...)` 未发现 PowerShell 语法错误。
- Sandbox 配置静态检查通过：`[xml](Get-Content -Raw scripts\ProjectVaultCleanWindows.wsb)` 可解析。
- V1 Final 判定：仍不能标记 complete；必须拿到 clean Windows 环境中 `clean-windows-validation.json` 的 `passed: true` 报告后才能完成。

## 2026-06-25 17:35 Clean Windows 最终门禁复查

- 状态：blocked by environment；本轮已继续检查宿主机和 Computer Use 可见窗口，但仍未获得可执行的 clean Windows 10/11 验收载体。
- Best Solution：继续以独立 clean Windows 10/11 VM、Windows Sandbox 或真实测试机运行 `scripts/verify_clean_windows_release.ps1`，只接受该环境生成的 `clean-windows-validation.json` 中 `passed: true` 作为 V1 Final 完成证据。
- Current Limitation：当前宿主机不是 clean 环境，且已有 Python/Node 与项目源码；`C:\Windows\System32\WindowsSandbox.exe` 不存在；`Get-VM` 因权限不足失败；Hyper-V 服务存在但当前进程不能管理 VM；Docker 当前为 `desktop-linux` 上下文且 Docker daemon 信息不可用，不能代表 Windows 桌面安装验收；WSL 无发行版且不是 Windows installer 目标。
- Computer Use 复查：当前可见 Project Vault 窗口来自 `D:\Workflows\ProjectVault\desktop\src-tauri\target\debug\project-vault.exe`，明确是宿主机 debug build，不是 clean 环境安装后的应用。
- 宿主机进程复查：发现 `project-vault.exe` 与 `project-vault-backend.exe` 调试进程；`http://127.0.0.1:8000/api/v1/health` 返回的数据库路径为 `D:\Workflows\ProjectVault\database\project_vault.db`，说明这不是 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db` 的 clean packaged app 验收。
- 替代载体复查：未发现 `VBoxManage`、`vmrun`、`vmware`、`qemu-system-x86_64`、`multipass`、`packer`、`vagrant`、`az` 或 `gcloud` 可用于即时创建 clean Windows 桌面环境。
- Recommended Upgrade Path：启用 Windows Sandbox 后直接打开 `scripts/ProjectVaultCleanWindows.wsb`，或提供一台 clean Windows 10/11 VM/测试机，并在其中运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\verify_clean_windows_release.ps1 -InstallerPath ".\Project Vault_0.1.0_x64-setup.exe" -ReportDir ".\validation-report"`。
- Fallback Solution：在没有 clean Windows 载体前，维持 Phase 12.1 为 in_progress/blocked，不把本机 debug build、宿主机 sidecar smoke test 或当前安装包构建成功记录标记为 V1 Final complete。
- V1 Final 判定：仍不能标记 complete。最后缺口不是代码链路，而是缺少真实 clean Windows 10/11 无 Python/Node 环境的安装启动报告。

## 2026-06-25 17:52 Clean Windows Validation 通过记录

- 状态：complete。Windows Sandbox 中已完成 clean Windows 10/11 无 Python/Node 安装启动验收，V1 Final 发布门禁通过。
- 脚本修复：第一次运行 `scripts/verify_clean_windows_release.ps1` 时，`where python` 在 clean 环境中找不到命令会输出“信息: 用提供的模式无法找到文件。”并被 `$ErrorActionPreference = "Stop"` 当作异常中断。已修复 `Test-ExecutableUnavailable`，让 `python/node` 找不到时记录为 expected pass，而不是脚本失败。
- 验收报告：`D:\Workflows\ProjectVault\release-validation\clean-windows-validation.json`。
- 报告结论：`passed: true`。
- installer：`C:\Users\WDAGUtilityAccount\Desktop\nsis\Project Vault_0.1.0_x64-setup.exe`，大小 21,794,961 bytes。
- clean 前置条件：`python_unavailable=pass`，`node_unavailable=pass`；二者均不是可执行命令。
- 安装验收：`installer_silent_run=pass`，参数 `/S /D=C:\Users\WDAGUtilityAccount\AppData\Local\Programs\ProjectVaultCleanTest`，退出码 0。
- 启动验收：`app_executable_found=pass`，安装后的 `project-vault.exe` 大小 18,726,912 bytes；`app_started=pass`。
- Sidecar 验收：`backend_health=pass`，`project-vault-backend` 监听动态端口 `49829`，`http://127.0.0.1:49829/api/v1/health` 返回 `status=ok`。
- 数据库路径验收：`database_path=pass`，实际路径 `C:\Users\WDAGUtilityAccount\AppData\Local\ProjectVault\database\project_vault.db`，符合 `%LOCALAPPDATA%\ProjectVault\database` 约束且文件存在。
- 退出清理验收：`backend_exit_cleanup=pass`，关闭桌面应用后 sidecar 清理通过。
- V1 Final 判定：可以标记 complete。生产 sidecar 打包、Tauri externalBin、无 Python/Node clean Windows 安装启动和退出清理均已通过。

## 当前阶段

Phase 12.2：Packaged UI Render Validation，状态：in_progress。

## 2026-06-25 18:05 Packaged UI smoke 失败记录

- 状态：reopened。clean Windows 自动验收证明 installer、进程启动、bundled sidecar health、数据库路径和退出清理通过，但用户在 Windows Sandbox 中双击桌面 `Project Vault` 后未出现主页面。
- 根因判断：当前 `desktop/src-tauri/tauri.conf.json` 的 `build.frontendDist` 指向 `../../frontend/.next`。`.next` 是 Next.js 构建内部目录，不是可直接由 Tauri WebView 加载的静态站点目录；因此后端 sidecar 可以启动并通过 health，但桌面窗口没有正确渲染前端主界面。
- 修复方向：将 Next 前端改为静态导出到 `frontend/out`，Tauri `frontendDist` 改为加载该目录；移除或改造不能静态导出的动态路由和 API route；重新生成 installer 后再次执行 clean Windows 安装启动 + 人工 UI smoke。
- V1 Final 判定：暂时撤回 complete 判定。必须在 clean Windows 中确认安装后主页面可见且核心导航可用后，才重新标记 V1 Final complete。

## 2026-06-25 18:40 Phase 12.2 Packaged UI Render 修复记录

- 状态：in_progress，已完成本机修复和打包，等待 clean Windows Sandbox 用最新 installer 复验。
- 根因复核：Sandbox 黑屏不是 backend/sidecar 失败；脚本已能证明 `project-vault-backend` health 和数据库路径正常。黑屏发生在 WebView 前端加载层，之前 `app_main_window=pass` 只证明窗口存在，不能证明 Dashboard HTML 已渲染。
- 架构修复：`desktop/src-tauri/src/main.rs` 新增内置静态前端 HTTP server，只监听 `127.0.0.1:<frontend_port>`，从 Tauri asset resolver 服务 `frontend/out` 打包资源；主窗口启动后导航到 `http://127.0.0.1:<frontend_port>/`，不再依赖 Tauri 本地协议直接加载 Next 静态页。
- 端口注入修复：静态 server 返回 HTML 时注入 `window.__BACKEND_PORT__ = <backend_port>`，避免 `window.eval` 在 WebView 导航时序中丢失。
- 路由资源修复：静态 server 支持 `/`、`/<route>/index.html`、SPA fallback，并把 `/projects/_next/static/...` 这类子路由资源请求归一化为 `/_next/static/...`。
- 验收脚本加固：`scripts/verify_clean_windows_release.ps1` 新增 `frontend_render`，会抓取桌面主进程监听的前端 HTML，并要求包含 `Project Vault V1` 和 `__BACKEND_PORT__`，防止窗口黑屏仍误报通过。
- 回归测试：`backend/tests/test_phase12_sidecar_packaging.py` 新增静态前端 server、localhost WebView 导航、HTML 端口注入、clean Windows frontend render 检查的门禁。
- 本机验证通过：专项测试 7 tests OK；`cargo check` 通过；PowerShell 验收脚本语法检查通过；`cmd /c npm run build` 通过；`.venv\Scripts\python.exe -m compileall app tests` 通过；`cmd /c npm run check` 重新生成 NSIS installer。
- 本机 packaged smoke：frontend `http://127.0.0.1:50151/` 返回 200，包含 Project Vault shell 和后端端口注入；嵌套路由资源 `http://127.0.0.1:50151/projects/_next/static/chunks/0acb211be0a29b2f.js` 返回 200；backend health `http://127.0.0.1:50150/api/v1/health` 返回 `status=ok`，数据库路径为 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`。
- 最新 installer：`desktop/src-tauri/target/debug/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`。
- V1 Final 判定：暂不能标记 complete。必须在 clean Windows Sandbox 重新运行最新 installer 和更新后的 `verify_clean_windows_release.ps1`，拿到 `passed=true` 且 `frontend_render=pass`，并人工确认 Dashboard 主页面可见后才能完成。

## 2026-06-25 18:55 Phase 12.2 WebView 空白窗口二次修复记录

- 状态：in_progress，已完成第二轮修复和本机 smoke，等待 clean Windows Sandbox 重新打开后复验。
- 新证据：clean Windows 报告已出现 `frontend_render=pass`，说明脚本启动的 `project-vault.exe` 能提供前端 HTML，桌面快捷方式也指向同一安装目录；但手动观察的 WebView 仍是黑屏。
- 新根因判断：问题不再是 installer、sidecar、前端 HTML server 或快捷方式错误，而是 Tauri 默认窗口先创建并加载空白/默认页面后再 `window.navigate(...)` 的时序在 Windows Sandbox WebView2 中仍可能留下黑屏窗口。
- 修复：`tauri.conf.json` 将 `app.windows` 改为空数组，避免 Tauri 自动创建默认窗口；`desktop/src-tauri/src/main.rs` 在 backend/frontend 端口准备完成后，使用 `WebviewWindowBuilder::new(app, "main", WebviewUrl::External(frontend_url))` 直接创建主窗口，窗口创建时就是前端 `http://127.0.0.1:<frontend_port>/`。
- 测试更新：`backend/tests/test_phase12_sidecar_packaging.py` 新增门禁，要求 Tauri 不自动创建空白窗口，并要求 Rust 使用 `WebviewWindowBuilder` + `WebviewUrl::External(frontend_url)`。
- 本机验证通过：`tests.test_phase12_sidecar_packaging` 8 tests OK；`cargo check` 通过；`cmd /c npm run build` 通过；`compileall` 通过；PowerShell 验收脚本语法检查通过；`cmd /c npm run check` 重新生成 installer。
- 本机 smoke：窗口标题为 `Project Vault`；frontend `http://127.0.0.1:51444/` 返回 200，包含 Project Vault shell 和后端端口注入；backend health `http://127.0.0.1:51443/api/v1/health` 返回 `status=ok`。
- 复验要求：必须关闭当前 Windows Sandbox 并重新打开，让映射目录读取新生成的 installer，然后重新运行 clean Windows validation 并人工确认 Dashboard 是否可见。

## 2026-06-25 19:05 Phase 12.2 Release GUI Installer 复查记录

- 状态：in_progress。已确认此前 Sandbox 反复出现的黑色窗口来自 debug NSIS build，不是 release GUI 安装包。
- 根因证据：debug `project-vault.exe` 的 PE subsystem 为 Console，release `project-vault.exe` 的 PE subsystem 为 Windows GUI。debug 窗口标题显示完整 exe 路径且带控制台滚动条，不能作为最终 Dashboard UI 验收对象。
- release 打包：`cd D:\Workflows\ProjectVault\desktop; cmd /c npm run build` 已完成，输出 `desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`，大小 19,077,057 bytes。
- 配置修正：`scripts/ProjectVaultCleanWindows.wsb` 已从 `target/debug/bundle/nsis` 改为映射 `target/release/bundle/nsis`，下一次 Sandbox 自动验证将安装 release GUI installer。
- V1 Final 判定：仍暂不能标记 complete。必须重新打开 Windows Sandbox，运行 release installer 的 clean validation，取得 `passed=true`、`app_main_webview_window=pass`、`frontend_render=pass`，并人工确认 Dashboard 主页面可见后才能完成。

## 2026-06-25 19:15 Phase 12.2 WebView2 Runtime Packaging 记录

- 状态：in_progress。release GUI installer 已在 Sandbox 中进入正确窗口链路，但 clean Windows 当前用户没有 WebView2 Runtime，Tauri 报错 `Could not find the WebView2 Runtime`。
- Best Solution：由 NSIS 安装包负责安装 WebView2 Runtime，不要求用户手动安装，也不依赖 clean 机器预装或联网下载。
- 修复：`desktop/src-tauri/tauri.conf.json` 已配置 `bundle.windows.webviewInstallMode` 为 `offlineInstaller` 且 `silent=true`。
- 重新打包：`cd D:\Workflows\ProjectVault\desktop; cmd /c npm run build` 成功，Tauri 下载 WebView2 离线安装器并生成 `desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`，大小 223,434,661 bytes。
- 验收脚本加固：`scripts/verify_clean_windows_release.ps1` 新增 `webview2_runtime_available`，安装后必须检测到 WebView2 Runtime 注册表项，否则 clean validation 失败。
- V1 Final 判定：仍暂不能标记 complete。必须重新打开 Windows Sandbox，用最新 release installer 复验并取得 `passed=true`、`webview2_runtime_available=pass`、`frontend_render=pass`，再人工确认 Dashboard 主页面可见。

## 2026-06-26 09:21 Phase 12.2 WebView2 Fixed Runtime 修复记录

- 状态：in_progress。用户在 Sandbox 复验中确认 `webview2_runtime_available=pass`、`frontend_render=pass`、`passed=true`，但手动打开仍显示 `Could not find the WebView2 Runtime`。因此上一轮 `offlineInstaller` 只能证明注册表层面存在 Evergreen Runtime，不能证明 Tauri/Wry 可实际创建 WebView。
- Best Solution：改为 Tauri `fixedRuntime`，把 Microsoft WebView2 Fixed Version Runtime 随应用安装，运行时由 Tauri 设置 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER`，绕开目标机 WebView2 注册表状态。
- 修复：`desktop/src-tauri/tauri.conf.json` 已从 `offlineInstaller` 改为 `webviewInstallMode.type = fixedRuntime`，路径为 `binaries/webview2-fixed-runtime/Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64`。
- 新增：`scripts/prepare_webview2_fixed_runtime.ps1`，固定下载官方 `Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64.cab`，校验 SHA256 `C4B3F527B5C6D29BAFFB6EC6B4E1EC7404F9417AC4153DAA57634B389203FDF4`，并解压到 Tauri binaries 目录。
- 新增 `.gitignore`：排除 `desktop/src-tauri/binaries/webview2-fixed-runtime/`，避免提交大体积运行时；需要重建时运行准备脚本。
- 验收脚本加固：`scripts/verify_clean_windows_release.ps1` 新增 `fixed_webview2_runtime_bundled` 与 `webview2_runtime_error_dialog_absent`，若安装目录缺少 fixed runtime 或出现 WebView2 错误弹窗，则 clean validation 失败。`webview2_runtime_available` 现在仅记录系统注册表可用性，不再作为 fixed runtime 的唯一发布门槛。
- 重新打包：`cd D:\Workflows\ProjectVault\desktop; cmd /c npm run build` 成功生成 release NSIS installer：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`，大小 `240,129,228` bytes。
- 本机产物检查：`desktop/src-tauri/target/release/binaries/webview2-fixed-runtime/Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64/msedgewebview2.exe` 存在，大小 `4,763,464` bytes。
- 验证通过：`backend/.venv/Scripts/python.exe -m unittest tests.test_phase12_sidecar_packaging -v`，12 tests OK。
- 验证通过：`[System.Management.Automation.PSParser]::Tokenize(...)` 检查 `verify_clean_windows_release.ps1` 与 `prepare_webview2_fixed_runtime.ps1` 语法通过。
- 验证通过：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\prepare_webview2_fixed_runtime.ps1` 返回 fixed runtime already prepared。
- 验证通过：`cmd /c npm run build` frontend build；`backend/.venv/Scripts/python.exe -m compileall app tests`；`cargo check`。
- V1 Final 判定：仍暂不能标记 complete。必须关闭并重新打开 Windows Sandbox，用最新 release installer 运行 clean validation，确认 `passed=true`、`fixed_webview2_runtime_bundled=pass`、`webview2_runtime_error_dialog_absent=pass`、`frontend_render=pass`，并人工确认 Dashboard 主页面可见后才能完成。

## 2026-06-26 09:41 Phase 12.2 / V1 Final Clean Windows 验收完成记录

- 状态：complete。Windows Sandbox 中已完成最新 release installer 的 clean Windows 验收，用户已人工确认点击沙盒桌面 `Project Vault` 图标会直接打开软件主页面。
- 报告文件：`release-validation/clean-windows-validation.json`。
- 报告结论：`passed=true`。
- installer：`C:\Users\WDAGUtilityAccount\Desktop\nsis\Project Vault_0.1.0_x64-setup.exe`，大小 `240,129,228` bytes。
- clean 前置条件：`python_unavailable=pass`、`node_unavailable=pass`。
- 安装：`installer_silent_run=pass`，退出码 0。
- Fixed WebView2：`fixed_webview2_runtime_bundled=pass`，安装目录包含 `binaries\webview2-fixed-runtime\Microsoft.WebView2.FixedVersionRuntime.149.0.4022.96.x64\msedgewebview2.exe`。
- WebView2 错误弹窗：`webview2_runtime_error_dialog_absent=pass`。
- 主窗口：`app_main_webview_window=pass`，窗口标题 `Project Vault`。
- 后端：`backend_health=pass`，`status=ok`，端口 `49823`。
- 前端：`frontend_render=pass`，`http://127.0.0.1:49824/` 返回 200，包含 Project Vault shell 与 backend port injection。
- 数据库：`database_path=pass`，路径位于 `C:\Users\WDAGUtilityAccount\AppData\Local\ProjectVault\database\project_vault.db`。
- 退出清理：`backend_exit_cleanup=pass`，检查的后端 PID 为 `3792`。
- V1 Final 判定：可以标记 complete。生产 sidecar、fixed WebView2 runtime、无 Python/Node clean Windows 安装启动、UI 渲染、数据库路径和退出清理均已通过。

## 2026-06-26 Phase 13.1 发布状态与产物固化记录

- 状态：in_progress。V1 Final clean Windows release gate 已通过，当前进入 Phase 13：V1 发布收口与实机使用验证。
- 新增发布 manifest：`docs/release/V1_RELEASE_MANIFEST.md`。
- release installer：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`。
- installer 大小：`240,129,228` bytes。
- installer last write UTC：`2026-06-26T01:21:32.8380995Z`。
- installer SHA256：`0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`。
- clean Windows validation report：`release-validation/clean-windows-validation.json`。
- report last write UTC：`2026-06-26T01:41:55.2897461Z`。
- report SHA256：`1A128EA00BFF4C25648B09AF2D3F95904FCDAF2B129E5EF4EBA02F32D86D5E2D`。
- 文档同步：`README.md` 新增 V1 release manifest 入口；`task_plan.md` 当前状态已从 Phase 12.2 待复验更新为 V1 Final complete / Phase 13.1 in_progress，并追加 Phase 13 计划。
- 下一步：Phase 13.2 本机正式安装包真实使用路径验收，重点覆盖打开应用、设置项目根目录、扫描测试项目、Dashboard/Projects/Project Detail/CAD Center/Search/Settings、备份/恢复入口。

## 2026-06-26 Phase 13.2 本机正式安装包真实使用路径验收记录

- 状态：complete。已使用固定 release installer 完成本机正式安装后的主流程验收。
- 新增脚本：`scripts/verify_local_installed_usage.ps1`。
- 新增文档：`docs/release/LOCAL_INSTALLED_USAGE_VALIDATION.md`。
- 验收报告：`release-validation/local-installed-usage-validation.json`。
- 报告结论：`passed=true`。
- 报告 SHA256：`1B31EC6AC8B87563094072DE496D64DB465783580A0030D06DB48C3DAE6157AE`。
- installer：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`。
- installer SHA256：`0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`。
- 安装目录：`C:\Users\admin\AppData\Local\Programs\ProjectVaultLocalUsageTest`。
- 专用测试项目根目录：`release-validation/local-usage-fixture`，未使用真实生产资料。
- 数据保护：脚本验收前备份本机 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`，验收后恢复；最终步骤 `previous_local_database_restored=pass`。
- 通过步骤：`installer_silent_run=pass`、`app_main_webview_window=pass`、`backend_health=pass`、`frontend_render=pass`、`settings_root_path_saved=pass`、`project_candidate_discovered=pass`、`project_initialized=pass`、`scanner_scan_fixture=pass`、`dashboard_metrics=pass`、`project_detail_overview=pass`、`project_detail_files=pass`、`project_detail_drawings=pass`、`project_detail_materials=pass`、`cad_center=pass`、`search_ctrl_k_backend_path=pass`、`history_records=pass`、`backup_entry_point=pass`、`restore_entry_point=pass`、`database_path=pass`、`backend_exit_cleanup=pass`。
- 中途失败与修正：第一轮脚本错误假设已有 `project.json` 的项目会自动进入 Projects 列表；已改为真实产品流程：候选发现 -> 初始化 -> 扫描。第二轮脚本错误使用 `path` 字段匹配候选；已修正为 `absolute_path`。第三轮搜索词未命中已索引内容；已改为搜索 fixture 项目名 `PV-V1-Local-Acceptance`。
- 文档同步：`task_plan.md` 已将 Phase 13.1 与 Phase 13.2 标记完成，并新增 Phase 13.3 发布质量清单与 V1.0 检查点准备；`docs/release/V1_RELEASE_MANIFEST.md` 已加入本机使用验收报告；`README.md` 已加入本机验收摘要。
- 下一步：Phase 13.3 发布质量清单与 V1.0 checkpoint/tag 准备。

## 2026-06-26 Phase 13.3 发布质量清单与 V1.0 检查点准备记录

- 状态：complete。已完成最终发布质量清单验收，并形成 V1.0 checkpoint/tag 准备说明。
- 新增脚本：`scripts/verify_phase13_release_quality.ps1`。
- 新增文档：`docs/release/V1_RELEASE_QUALITY_CHECKLIST.md`。
- 验收报告：`release-validation/phase13-release-quality-validation.json`。
- 报告结论：`passed=true`。
- 报告 SHA256：`BB183E9F90481CE3D65395E8EF2D3E8DFF2ED01BD68EF25569909B93DC3CB3A9`。
- installer SHA256：`0478EFE6C0E81D8F9B39F102E66642B129E30E06FE244D6757482AF0851772D8`。
- 覆盖范围：安装、卸载、重装、启动、loopback-only 前后端渲染、无效 `root_path`、损坏 `project.json`、不可访问目录、退出清理、发布文档存在性、本机数据库备份与恢复。
- 说明：断网启动未直接禁用宿主机网络适配器；验收以 packaged app 仅使用 `127.0.0.1` 动态端口作为不依赖外部网络的证据，避免影响当前宿主机网络状态。
- 中途失败与修正：第一轮脚本对 400 响应体判断过严，PowerShell 读到空响应时误标 `invalid_root_path_rejected=fail`；已改为以 HTTP 400 作为受控拒绝证据。第一轮卸载后安装目录已被删除，脚本再次枚举 exe 时未先判断路径存在；已修正 `Find-AppExecutable` 与 `Find-Uninstaller`。
- 最终验证通过：`backend\.venv\Scripts\python.exe -m unittest discover -s tests -v` 在 `backend` 目录下实际执行为 `.venv\Scripts\python.exe -m unittest discover -s tests -v`，64 tests OK。
- 最终验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js production static build 通过。
- 最终验证通过：`desktop` 目录 `cmd /c npm run check`，Tauri debug build 与 NSIS bundle 通过。
- V1.0 checkpoint/tag 判定：已具备准备条件。打 tag 前仍需做常规仓库卫生检查，确保不提交 `.venv`、`node_modules`、运行数据库、fixture 输出或 fixed WebView2 runtime 下载目录。

## 2026-06-26 Phase 13.4 V1.0 checkpoint 仓库卫生检查记录

- 状态：complete。已完成 V1.0 tag 前的 Git 索引卫生检查。
- 发现：`desktop/node_modules` 已经进入 Git 索引，不应作为源码检查点内容。
- 发现：`task_plan.md.bak.*` 与 `progress.md.bak.*` 已经进入 Git 索引，属于本地阶段回退快照，不应作为源码检查点内容。
- 发现：`release-validation/local-usage-fixture/` 与 `release-validation/phase13-quality-fixture/` 是验收样例输出，不应进入源码检查点。
- 修正：`.gitignore` 新增 `desktop/node_modules/`、`*.bak.*`、`release-validation/*fixture*/`。
- 修正：使用 `git rm -r --cached -- desktop/node_modules progress.md.bak.* task_plan.md.bak.*` 从索引移除生成依赖和备份快照；本地文件未删除。
- 复查：`git ls-files | rg "(node_modules|\.venv|target|frontend/out|release-validation/.+fixture|\.bak\.|\.db$|webview2-fixed-runtime)"` 无命中。
- 保留：`release-validation/clean-windows-validation.*`、`release-validation/local-installed-usage-validation.*`、`release-validation/phase13-release-quality-validation.*` 作为发布证据报告。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m compileall app tests`。
- 验证通过：`frontend` 目录 `cmd /c npm run build`。
- 验证通过：`desktop/src-tauri` 目录 `cargo check`。
- V1.0 checkpoint/tag 判定：仓库卫生检查通过，可以进入提交/tag 步骤；提交前仍需人工复核 staged 文件清单。

## 2026-06-26 Phase 13.5 三项优先修复与开发模式 API 修复记录

- 状态：complete。已完成代码/产品审查后的三项优先修复：CSP 安全头 + Host 验证、React Error Boundaries、UI 语言统一，以及开发模式 API 连通性修复。
- CSP 安全头 + Host 验证：`desktop/src-tauri/src/main.rs` 的 `response_headers()` 新增 `Content-Security-Policy`（default-src 'self' 'unsafe-inline' 'unsafe-eval'、connect-src http://127.0.0.1:*、img-src 'self' data: blob:、font-src 'self' data:）、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`；`serve_frontend_request()` 新增 Host 头解析与校验，仅允许 `127.0.0.1:{port}` 和 `localhost:{port}`，拒绝其他 Host 防止 DNS rebinding。
- React Error Boundaries：新建 `frontend/app/error.tsx`（路由级错误边界，"页面出错了" + 重试/返回首页）、`frontend/app/global-error.tsx`（根级错误边界，独立 html/body，"应用加载失败" + 重试）、`frontend/app/not-found.tsx`（404 页面，"页面未找到" + 返回首页）；全部使用中文界面，样式复用 globals.css 的 card/btn 类。
- UI 语言统一：10 个前端文件约 211 处用户可见英文替换为中文，品牌名 "Project Vault" 和技术术语（CAD、API、URL 等）保留英文；覆盖 `page.tsx`、`Sidebar.tsx`、`CommandPalette.tsx`、`projects/page.tsx`、`project-detail/page.tsx`、`cad-center/page.tsx`、`history/page.tsx`、`ai-center/page.tsx`、`settings/page.tsx`；未引入 i18n 框架，V1 直接硬编码。
- 开发模式 API 连通性修复：`frontend/lib/api.ts` 的 `baseUrl()` 新增 `NEXT_PUBLIC_BACKEND_PORT` 环境变量支持，在 `window.__BACKEND_PORT__` 不可用时（`next dev` 模式）回退到环境变量指定端口；同时增加 `.trim()` 修复 CMD `set VAR=val && cmd` 尾随空格导致 URL 包含空格的问题。
- 浏览器验证：工作台 Dashboard 指标卡片、Projects 列表、Project Detail 六 Tab、CAD Center、History、AI Center、Settings、Command Palette、404 页面均显示正确中文文本，API 数据正常加载。
- 验证通过：`cmd /c npm run build`，Next.js 16.1.0 编译成功（826ms），9 个路由（/、/_not-found、/ai-center、/cad-center、/history、/project-detail、/projects、/settings）全部静态生成。
- 验证通过：`cargo check`，project-vault v0.1.0 编译成功（7.01s），无错误无警告。
- 已知开发模式限制（不影响生产构建）：`next dev` 下 `process.env.NEXT_PUBLIC_BACKEND_PORT` 可能因 CMD 环境变量设置时序未被 webpack 内联；`output: "export"` + `trailingSlash: true` 在 dev 模式导致 ChunkLoadError，生产静态导出不受影响。
- 下一步：可选择运行 `cargo tauri dev` 做完整桌面端到端验证，或继续处理审查报告中剩余的约 41 项改进建议。

## 2026-06-26 Phase 13.6 Phase 2 Quick-Win 改进记录

- 状态：complete。已完成审查报告中 Phase 2 全部 7 项 quick-win 改进。
- F8/F9 共享组件与 hook：新建 `frontend/lib/useApi.ts`（通用 `useApi<T>` hook，含 data/loading/error/refetch）；新建 `frontend/app/components/ConfirmDialog.tsx`（确认弹窗，复用 cmdk-overlay 样式）、`ErrorBanner.tsx`（错误提示条）、`EmptyState.tsx`（空状态占位）、`Pagination.tsx`（分页组件）；`settings/page.tsx` 和 `ai-center/page.tsx` 已替换原生 `confirm()` 为 ConfirmDialog。
- B1 核心 API 拆分：`backend/app/core_api.py`（856 行）拆为 `app/services/` 下 7 个领域模块（`__init__.py` 共享工具、`projects.py`、`files.py`、`drawings.py`、`settings.py`、`system.py`、`ai_providers.py`）；`core_api.py` 改为兼容重导出层，所有 API 路由无需改动；新增 `app/watcher/processor.py`（事件消费者，消费 DebouncedEventQueue 并触发增量扫描，带项目级 cooldown）。
- P5 AI Provider 真实连通性测试：`test_ai_provider` 从仅检查字段存在改为实际 HTTP GET `{base_url}/models` + Bearer auth，10s 超时；区分 401/403（密钥无效）、网络错误、未知错误。
- P6 Watcher 队列接入增量扫描：`app/main.py` lifespan 中读取 system_settings 的 root_path，若有效则创建 DebouncedEventQueue + FileWatcherService + asyncio.create_task(run_watcher_loop)；shutdown 时 cancel task + stop watcher。
- P8 项目卡片视图：`projects/page.tsx` 新增 viewMode 状态和切换按钮（列表/卡片），卡片视图使用 CSS Grid `repeat(auto-fill, minmax(280px, 1fr))`，显示项目名、类型/阶段徽章、文件/CAD/材料计数、负责人、更新时间。
- P4 搜索结果跳转：`CommandPalette.tsx` 的 `selectResult` 根据 entity_type 拼接 tab 参数（file→files、cad→drawings、material→materials）；`project-detail/page.tsx` 新增读取 URL `tab` 参数作为初始 tab。
- 验证通过：`python3 -m compileall app` 后端全量编译通过。
- 验证通过：`npm run build` 前端 9 路由静态生成通过（828.5ms）。
- 验证通过：`cargo check` 桌面 Rust 主进程编译通过（1.10s）。
- Git 提交：`5884567 Phase 2: 7 quick-win improvements`，20 files changed, 1320 insertions(+), 877 deletions(-)；tag v1.1.0 已推送远程。

## 2026-06-26 V1.2.0 发布记录

- 状态：complete。审查报告 Phase 3 全部战略功能已完成，V1.2.0 标签已推送。
- 完成内容：文件预览与缩略图（Pillow，多格式）、目录树导航（递归、可展开）、AI 项目分析（OpenAI 兼容提供商）、CSV 导出（文件/图纸）、真实 scanner_status 追踪、自动扫描开关、可配置备份保留数、首页收藏项目、页面 meta 标签、查询长度校验、速率限制、路径遍历防护、Rust 结构化日志（tracing）、WebView2 运行时检测、前端测试套件（vitest + testing-library）。
- 新增文件：`frontend/app/components/FilePreview.tsx`、`frontend/app/components/DirectoryTree.tsx`、`frontend/__tests__/`（3 个测试文件）、`frontend/vitest.config.ts`、`docs/release/V1.2.0_RELEASE_NOTES.md`。
- 修改文件：45 files changed, 5303 insertions(+), 964 deletions(-)。
- 后端新增端点：`GET /assets/{file_id}/thumbnail`、`GET /assets/{file_id}/text`、`GET /projects/{project_id}/file-tree`、`GET /projects/{project_id}/files/export`、`GET /projects/{project_id}/drawings/export`、`POST /projects/{project_id}/ai-analyze`、`GET /projects/favorites`。
- 验证通过：`npm run build` 前端 9 路由静态生成通过（818ms）。
- 验证通过：`npx vitest run` 前端测试 7 passed（2 files）。
- 验证通过：`cargo check` 桌面 Rust 主进程编译通过（30.92s）。
- Git 提交：`6f00151 feat: Phase 3 strategic features`，45 files changed, 5303 insertions(+), 964 deletions(-)；tag v1.2.0 已推送远程（`git push origin v1.2.0`）。
- 审查报告 44 项发现全部处理完毕（Phase 1/2/3）。
- task_plan.md Phase 0-13 全部标记 complete。

## 2026-06-29 Installer Hotfix 记录

- 状态：complete。NSIS installer 三项缺陷修复，重新打包并实机安装验证通过。

### 修复 1：WebView2 Fixed Runtime 检测

- 问题：`desktop/src-tauri/src/main.rs` 的 `check_webview2_runtime()` 只检查 `%LOCALAPPDATA%\Microsoft\EdgeWebView\Application` 和注册表两个 Evergreen 路径。使用 Fixed Runtime 模式（`tauri.conf.json` 配置 `webviewInstallMode.type: "fixedRuntime"`）时，两个检查点都不命中，程序启动后立即退出并报 "WebView2 runtime not found"。
- 修复：按优先级依次检查 (1) exe 同目录 `binaries/webview2-fixed-runtime/`（Fixed Runtime）、(2) `%LOCALAPPDATA%` Evergreen、(3) `%ProgramFiles(x86)%` Evergreen、(4) `%ProgramFiles%` Evergreen、(5) 注册表。每步增加 `tracing::info!` 日志。
- 修改文件：`desktop/src-tauri/src/main.rs`。

### 修复 2：Dashboard 前端重试机制

- 问题：`frontend/app/page.tsx` 的 `useEffect` 在组件挂载时并行调用三个 API（`dashboardMetrics`、`recentProjects`、`favoriteProjects`），失败后直接显示错误横幅且无重试。首次加载时如果 React 水合比后端初始化更快，会产生永久性错误显示。
- 修复：增加自动重试（最多 3 次，间隔 2 秒）和手动"重试"按钮。`useEffect` 依赖 `loadAttempt` 状态实现重新触发。
- 修改文件：`frontend/app/page.tsx`。

### 修复 3：FastAPI CORS origin 不匹配

- 问题：`backend/app/main.py` 的 `CORSMiddleware` 使用硬编码 `allow_origins=["http://127.0.0.1:3000", "http://localhost:3000", "http://127.0.0.1:3001", "http://localhost:3001"]`。Tauri 桌面应用的前端 HTTP server 每次启动分配随机端口（`TcpListener::bind("127.0.0.1:0")`），浏览器从 `http://127.0.0.1:{随机端口}` 发起跨域请求时，后端不返回 `Access-Control-Allow-Origin`，浏览器直接拒绝响应，`fetch()` 抛出 `TypeError: Failed to fetch`。
- 修复：将 `allow_origins` 替换为 `allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$"`，匹配任意 loopback 端口。
- 修改文件：`backend/app/main.py`。

### 验证结果

- NSIS installer 重新打包：246,769,064 bytes（含新 sidecar 23,468,733 bytes）。
- 安装后实机验证：窗口标题 "Project Vault"、后端 health OK、前端 `__BACKEND_PORT__` 注入正确、CORS preflight 200 并返回正确 `Access-Control-Allow-Origin`。
- `/projects/favorites` 端点返回 200，未被 `/{project_id}` 参数路由遮蔽。
- Git 提交：`1ad3353 fix: WebView2 Fixed Runtime detection and dashboard retry logic`、`c64bfde chore: normalize task_plan.md line endings`。
- 代码已推送远程 `main` 分支。

## 2026-07-06 V1.3 视觉基线 Step 2/3 记录

- 状态：in_progress。已完成 `archive-essence-design` 对齐后的第一轮最小 UI shell 接入。
- 新增文档：`docs/planning/V1_3_UI_INVENTORY.md`，记录当前 UI 与参考原型的差距、迁移顺序和禁止迁移的 mock 行为。
- 新增组件：`frontend/app/components/TopBar.tsx`，提供全局页面标题/分组、Command Palette 搜索入口和本地服务状态。
- 修改文件：`frontend/app/layout.tsx` 接入 `TopBar` 与 skip link；`frontend/app/globals.css` 新增 topbar、workspace shell、skip link 和移动端响应样式。
- 范围控制：未引入新依赖，未改后端、数据库、API、Tauri 打包逻辑，未复制参考项目 mock 数据。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js 16.1.0 生产构建通过，9 个路由全部静态生成。
- 验证通过：生产预览 `http://127.0.0.1:3002/` 返回 `200`，页面 HTML 包含 `Project Vault` 与 `工作台`。
- 说明：3000 端口已有 Next 进程占用且首页请求超时；本次未强杀旧进程，改用 3002 生产预览验证。
- 下一步：Sidebar real data sections，先接已有 favorites API；tags 只有在现有项目数据足够时再做，不新增后端能力。

## 2026-07-06 V1.3 视觉基线可见化修正记录

- 状态：in_progress。针对“UI 仍像 V1”的反馈，已将 V1.3 从浅层 TopBar 接入推进到第一屏可见对齐。
- 原因确认：上一轮只完成 TopBar 与少量 shell 样式，Dashboard、Sidebar 数据区和加载态仍保留 V1 观感；同时 3000 端口存在旧 Next 进程，可能展示旧运行态。
- Dashboard：`frontend/app/page.tsx` 已重做为 archive 风格工作台结构，包含 hero、三项指标卡、收藏项目、最近项目表、快速操作、最近活动、系统状态条。
- Sidebar：`frontend/app/components/Sidebar.tsx` 已改为 archive 风格 workspace switcher、紧凑 nav、收藏项目区、阶段区和本地索引状态；收藏与阶段来自现有 API，不写 mock 项目。
- Loading：新增 archive 风格 dashboard skeleton，后端未连接或响应慢时也能显示新 UI 框架，不再是黑屏加转圈。
- 样式：`frontend/app/globals.css` 加强深色分层、24px grid 背景、archive panel、dense table、quick action、activity list、skeleton shimmer 等样式。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js 16.1.0 生产构建通过，9 个路由全部静态生成。
- 验证通过：新预览 `http://127.0.0.1:3003/` 已启动；Edge headless 截图生成 `release-validation/v1_3_dashboard_latest.png`，画面显示新的 Sidebar、TopBar、Dashboard skeleton 和 archive 风格面板。
- 下一步：连接真实后端后复查 populated dashboard 数据态；继续处理 Projects/CAD/History 等二级页面的视觉对齐。

## 2026-07-06 V1.3 页面间距审查与容器修正记录

- 状态：in_progress。针对 Projects、CAD Center、Settings 截图中主内容边距不统一的问题，已完成横向审查和第一轮全局修正。
- 根因：Dashboard 使用独立 `.vault-dashboard` 容器；Projects、CAD Center、History、AI Center、Settings、Project Detail 仍使用旧页面根容器，导致左距、顶距、最大宽度和卡片宽度不一致。
- 修正：`frontend/app/globals.css` 新增 `.main > :not(.vault-dashboard)` 页面容器规则，统一非 Dashboard 页面为 `max-width: 1240px; margin: 0 auto; padding: 24px 28px 32px;`。
- 修正：统一旧页面下的 `card/table-panel/toolbar-row` 宽度和 toolbar surface，避免卡片贴边或与 Dashboard 容器不对齐。
- 截图审查覆盖：Dashboard、Projects、CAD Center、History、AI Center、Settings。
- 验证截图目录：`release-validation/ui-audit/`。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js 16.1.0 生产构建通过，9 个路由全部静态生成。
- 仍需后续处理：Projects 分页/空态、Settings 表单、AI Center 空态、History 空态仍有较多旧式 `card` 与 inline style，视觉能用但还未完全 archive 化；Project Detail 及各 tab 还需要单独复查。

## 2026-07-06 V1.3 二级页面 polish Step 2 记录

- 状态：in_progress。已完成 Projects、CAD Center、History、AI Center、Settings 的第二轮全局视觉 polish。
- 修正：统一 `.empty-state` 为 archive 风格 grid 背景、中心图标、固定最小高度和紧凑文字层级。
- 修正：统一 `.pagination` 与 `.pager-row` 间距、字号、tabular number 和换行行为。
- 修正：统一 `.form-input`、`.form-select`、`.topbar-search`、`.filter-select`、CAD `.search-input/.select-field` 为更接近 archive 的深色输入面。
- 修正：调整 Settings 双栏宽度和卡片内距，降低旧 V1 表单割裂感。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js 16.1.0 生产构建通过，9 个路由全部静态生成。
- 验证截图目录：`release-validation/ui-audit-step2/`，覆盖 Projects、CAD Center、History、AI Center、Settings。
- 仍需后续处理：Project Detail 和各 tab 的 inline style 仍多，特别是 Files/Drawings/Materials/AI tab；这一块需要单独做，不建议和全局 polish 混在同一批。

## 2026-07-06 V1.3 Project Detail polish 记录

- 状态：in_progress。已完成 Project Detail 壳层和主要 tabs 的最小视觉对齐。
- 修正：`project-detail/page.tsx` 增加 `project-detail-page`、`project-detail-header`、`project-title-row`、`project-tabs`、`tab-count` 等 class，减少 tabs 计数器内联样式。
- 修正：`FilesTab` 增加 `tab-split-card`、`file-tree-pane`、`file-list-pane`，用全局 CSS 统一文件树/文件列表 split pane 的边框、背景和移动端堆叠。
- 修正：`OverviewTab` 增加 `project-overview-card`、`project-overview-grid`、`project-info-field`，概览字段改为密集信息块。
- 修正：`DrawingsTab`、`MaterialsTab`、`HistoryTab` 使用统一 `tab-card`，让表格卡片和二级页面 surface 一致。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js 16.1.0 生产构建通过，9 个路由全部静态生成。
- 验证截图目录：`release-validation/ui-audit-project-detail/`，覆盖 Project Detail 无 id / 缺失 id 错误态。
- 限制：当前 3003 预览无法连到真实项目 API，未能截图验证 populated tabs 数据态；需要后端有项目数据后再补 Files/Drawings/Materials/AI/History tab 实图复查。

## 2026-07-06 V1.3 Project Detail 数据态复查记录

- 状态：in_progress。已补齐带样例项目数据的 Project Detail 复查，不使用真实项目资料。
- 验证环境：临时后端 `127.0.0.1:8004`，临时数据库 `release-validation/ui-audit-project-detail-data/project_vault_ui_audit.db`，前端预览 `127.0.0.1:3004`。
- 样例数据：`release-validation/ui-audit-project-detail-data/fixture-root/PV-V13-Detail-Visual-Fixture`，扫描结果为 6 个文件、2 个 CAD、2 个材料。
- 修正：`FilesTab` 的文件时间显示压缩为短格式，并给文件表格增加 `file-table-scroll/file-data-table/file-name-cell/file-time-cell` class。
- 修正：移动端 Files 表格改为两列卡片行，避免 390px 宽度下时间列和文件名挤出屏幕。
- 修正：移动端 Sidebar 改为单行图标轨道，隐藏收藏、阶段和底部状态区，避免导航竖排挤占首屏。
- 修正：`OverviewTab` 的最后更新时间压缩为短格式，空值保持弱色层级。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js 16.1.0 生产构建通过，9 个路由全部静态生成。
- 验证通过：API 复查 `overview=PV-V13-Detail-Visual-Fixture`、`files=6`、`drawings=2`、`materials=2`。
- 验证截图目录：`release-validation/ui-audit-project-detail-data/`，包含 `detail-files-desktop-final.png`、`detail-overview-desktop-final.png`、`detail-files-mobile-final2.png`。
- 限制：内置 Browser 插件在读取页面时返回 `incrementalAriaSnapshot is not a function`，本轮改用 Edge headless 截图验证。

## 2026-07-06 V1.3 Project Detail 收尾 polish 记录

- 状态：in_progress。已完成 Project Detail 剩余视觉债的最小收口，范围限定在 AI tab、文件预览弹窗和目录树。
- 修正：`AiTab` 从 render 阶段发起 API 请求改为 `useEffect`，避免重复请求；同时把空态、加载态、结果列表和错误提示改为 class 驱动样式。
- 修正：`FilePreview` 去掉主要内联布局样式，新增统一的 preview header/content/footer、媒体、文本、空态样式；弹窗仍复用现有 `confirm-overlay/confirm-box`。
- 修正：`DirectoryTree` 去掉 hover 内联样式，改用 `tree-node/tree-root/tree-count/tree-chevron` 等 class；仅保留动态层级缩进变量。
- 修正：移动端 Files 操作链接左对齐，避免小屏下链接被推到边缘不可见。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，Next.js 16.1.0 生产构建通过，9 个路由全部静态生成。
- 浏览器验证：内置 Browser 插件可打开 `127.0.0.1:3004` 并点击文件预览，`detail-preview-modal-browser-final.png` 已生成；控制台 error/warn 数量为 0。
- 截图验证：`release-validation/ui-audit-project-detail-data/detail-ai-final.png`、`detail-files-mobile-finish2.png`。
- 范围控制：未引入新依赖，未改后端、API、数据库或 Tauri。

## 2026-07-06 V1.3 Project Detail 最终收尾核查记录

- 状态：in_progress。已完成 Project Detail 当前范围内的最终轻量收尾，未扩大到 Settings、AI Center、Projects 的剩余全局内联样式清理。
- 修正：`ProjectDetailPage` 的错误/成功/警告提示条、标题和扫描按钮 spinner 改为统一 class；移除该页剩余提示类内联样式。
- 修正：`FilesTab` 的目录加载、面包屑、导出工具条、文件操作提示和分页内距改为 class 驱动；文件分页请求改为使用当前 `filesPage`。
- 修正：`DrawingsTab`、`MaterialsTab`、`HistoryTab` 从 render 阶段请求数据改为 `useEffect`；加载态改为明确 spinner 空态，避免切换 tab 时误显示空数据。
- 修正：`OverviewTab` 摘要和标签区改为统一 section/tag list 样式。
- 验证通过：`frontend` 目录默认 `cmd /c npm run build` 通过，Next.js 16.1.0 生产构建 9 个路由全部静态生成。
- 验证通过：使用 fixture 数据库和临时端口 `127.0.0.1:8004 / 127.0.0.1:3004` 完成浏览器复查；Project Detail 文件 tab 显示 `PV-V13-Detail-Visual-Fixture`、6 个文件和导出入口。
- 交互验证：内置 Browser 依次切换 `文件 / 图纸 / 材料 / 历史` tab，均显示 fixture 数据，无 Next.js 错误覆盖层，控制台 error/warn 数量为 0。
- 范围控制：未引入新依赖，未改后端、API、数据库或 Tauri；临时验证服务已停止。
- 剩余风险：全局残余内联样式仍存在于 Settings、AI Center、Projects、History 页面和全局 error/not-found 兜底页；这些属于下一轮全局残余样式清理，不阻塞本次 Project Detail 收口。

## 2026-07-06 V1.3 全局残余样式清理收尾记录

- 状态：in_progress。已完成 Settings、AI Center、Projects、History 和 error/not-found/global-error 兜底页的残余内联样式清理。
- 修正：新增 `page-description`、`form-hint`、`checkbox-row`、`form-actions`、`notice success/error`、Provider、History、Projects 表格单元格和兜底页 class，统一交给 `globals.css` 管理。
- 修正：`ErrorBanner`、`EmptyState` 改为 class 驱动样式；页面提示条、空态标题、表单说明、Provider 空态、测试结果、History 状态点、Projects 表格对齐不再依赖内联样式。
- 扫描结果：`rg -n 'style=\{\{|style="' frontend/app` 仅剩 `DirectoryTree.tsx` 的 `--tree-depth` 动态 CSS 变量；该变量用于目录树层级缩进，属于有意保留。
- 验证通过：`frontend` 目录默认 `cmd /c npm run build` 通过，Next.js 16.1.0 生产构建 9 个路由全部静态生成；仅保留既有 `output: export` 与 rewrites 警告。
- 浏览器验证：使用 `frontend/out` 临时静态预览 `127.0.0.1:3005` 并注入后端端口 `8000`，内置 Browser 验证 Settings、Projects、History、AI Center 均能渲染目标页面，无 Next.js 错误覆盖层，控制台 error/warn 数量为 0。
- 交互验证：Projects 页面列表/卡片切换成功，激活状态变为“卡片”。
- 范围控制：未引入新依赖，未改后端、API、数据库或 Tauri；3005 临时静态预览已停止。

## 2026-07-06 V1.4 Onboarding Step 1 记录

- 状态：in_progress。已开始 V1.4 初始化工作流，完成第一块真实 onboarding 入口。
- 修正：新增 `frontend/app/components/OnboardingFlow.tsx`，在 Settings 右侧接入“保存并发现 / 全选清空 / 初始化选中项目”流程。
- 修正：`frontend/lib/api.ts` 增加候选项目、初始化结果、扫描结果类型，并封装既有 `/projects/candidates`、`/projects/initialize`、`/scanner/scan` 调用。
- 修正：`frontend/app/settings/page.tsx` 将维护区改为右侧 stack，接入 OnboardingFlow；`frontend/app/globals.css` 增加候选列表、onboarding 卡片和次级按钮样式。
- 测试修正：`frontend/__tests__/DirectoryTree.test.tsx` 的选中态断言从旧内联 style 改为当前 `selected` class。
- API 验证：使用 fixture 根目录 `release-validation/v1_4_onboarding-fixture-20260706-143934/root` 和临时数据库 `project_vault.db`，发现 2 个候选、初始化 2 个、扫描 2 个，项目列表返回 2 个项目；浏览器交互追加验证 1 个候选并成功初始化扫描。
- 浏览器验证：临时后端 `127.0.0.1:8004`，静态预览 `127.0.0.1:3006`，Settings 页面显示 onboarding 区，按钮流程完成，控制台 error/warn 数量为 0。
- 验证通过：`frontend` 目录 `cmd /c npm run build` 通过；`cmd /c npm run test` 通过，2 个测试文件 7 个测试；`backend` 目录 `.venv\Scripts\python.exe -m unittest tests.test_projects_api -v` 通过，2 个测试。
- 扫描结果：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `DirectoryTree.tsx` 的 `--tree-depth` 动态 CSS 变量。
- 范围控制：未改后端逻辑、数据库 schema、Tauri 或依赖；本轮只使用既有后端 API 串联 V1.4 首步工作流。
- 剩余风险：当前入口在 Settings 页，不是完整 first-run wizard；下一步需要把 Dashboard 空状态/ready 状态也接入同一真实流程。

## 2026-07-06 V1.4 Dashboard readiness 记录

- 状态：in_progress。已把 Dashboard 空状态接入真实 onboarding 状态，不再只显示泛化“无项目”提示。
- 修正：`frontend/app/page.tsx` 读取 `settings`，在项目数为 0 且根路径存在时调用既有 `/projects/candidates` 做只读候选检查。
- 修正：Dashboard 空态按三种状态显示：未配置根路径、已发现候选项目、根路径已配置但暂无候选；系统状态条显示 `待配置 / 待初始化 / Ready`。
- 范围控制：未新增后端接口，未改数据库、Tauri 或依赖；候选检查只读，不写 `project.json`。
- 验证通过：`frontend` 目录 `cmd /c npm run build` 通过；`cmd /c npm run test` 通过，2 个测试文件 7 个测试。
- 浏览器验证：临时后端 `127.0.0.1:8004`，静态预览 `127.0.0.1:3006`，fixture 根目录 `release-validation/v1_4_dashboard-readiness-20260706-150930/root`。
- 浏览器验证结果：无根路径时显示“还没有项目根路径 / 待配置”；设置 fixture 根路径后显示“发现 1 个候选项目 / 待初始化”；初始化并扫描后显示 `Delta Studio` 和 `Ready`；控制台 error/warn 数量为 0。
- 剩余风险：Dashboard 目前只给出跳转到 Settings 的入口，没有把完整初始化表单嵌入首页；如后续要做真正 first-run wizard，再复用 `OnboardingFlow` 或抽出共享表单。

## 2026-07-06 V1.4 Sidebar 状态接入记录

- 状态：in_progress。已完成 V1.4 Sidebar Integration 的最小真实状态接入。
- 修正：`frontend/app/components/Sidebar.tsx` 复用现有 `settings`、`dashboardMetrics`、`projects`、`favorites` API，底部状态从硬编码“运行中/实时监听”改为真实 `根路径 / 项目数 / 待配置|待初始化|Ready`。
- 修正：`frontend/app/globals.css` 增加 `storage-bar` 和 `status-dot` 的 `ready/pending/empty` 状态样式；未新增依赖。
- 范围控制：未新增后端接口，未读取或展示绝对根路径，未改数据库、Tauri 或 API 契约。
- 验证通过：`frontend` 目录 `cmd /c npm run build` 通过；`cmd /c npm run test` 通过，2 个测试文件 7 个测试。
- 浏览器验证：临时后端 `127.0.0.1:8004`，静态预览 `127.0.0.1:3006`，fixture 根目录 `release-validation/v1_4_sidebar-status-20260706-151940/root`。
- 浏览器验证结果：无根路径时 Sidebar 显示 `未配置 / 项目 0 / 待配置`；设置根路径后显示 `已配置 / 项目 0 / 待初始化`；初始化并扫描后显示 `已配置 / 项目 1 / Ready`，且项目 `Echo Showroom` 可见；控制台 error/warn 数量为 0。
- 剩余风险：阶段筛选仍只来自当前项目列表第一页的 phase 字段；后续如果需要全局标签/阶段聚合，再加只读 summary API。

## 2026-07-06 V1.4 可选 AI Provider 设置入口记录

- 状态：in_progress。已完成 V1.4 Optional AI Provider Setup 的最小真实入口，不阻塞项目初始化流程。
- 修正：`frontend/app/components/OnboardingFlow.tsx` 读取真实 `/providers` 列表，按 `已配置 / 需检查 / 可选 / 已跳过` 显示 AI Provider 状态。
- 修正：Onboarding 卡片新增跳转 AI 中心、刷新状态、跳过 AI 配置操作；跳过状态仅保存在当前浏览器 `localStorage`，不写业务数据、不伪造 AI 测试结果。
- 修正：`frontend/app/globals.css` 增加 `optional-setup-*` 样式，保持 Settings 右栏与 archive 风格一致，移动端改为单列布局。
- 范围控制：未新增后端接口，未改 AI Provider API、数据库 schema、Tauri、依赖或真实项目资料；AI 仍只做 Provider 管理和真实连接测试，不进入聊天、Agent、RAG。
- 验证通过：`frontend` 目录默认 `cmd /c npm run build` 通过；`cmd /c npm run test` 通过，2 个测试文件 7 个测试。
- 浏览器验证：临时后端 `127.0.0.1:8004`，临时数据库 `release-validation/v1_4_ai-provider-optional-20260706-152622/project_vault.db`，归一化静态预览 `127.0.0.1:3006`。
- 浏览器验证结果：Settings 显示 `可选 AI Provider / 可选 / 配置 AI / 刷新 / 跳过`；点击 `跳过` 后状态变为 `已跳过`；点击 `配置 AI` 跳转 AI Center；点击 `添加提供商` 显示真实 Provider 表单字段；控制台 error/warn 数量为 0。
- 扫描结果：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `DirectoryTree.tsx` 的 `--tree-depth` 动态 CSS 变量，属于有意保留。
- 验证限制：内置 Browser 的 `domSnapshot()` 在本轮仍触发 `incrementalAriaSnapshot is not a function`，因此页面验证使用 URL、页面文本、截图、控制台日志和实际点击结果完成。
- 下一步：继续 V1.4 Optional Backup Setup，把 Settings 维护区的备份/恢复入口整理为 onboarding 可选状态，仍复用现有备份 API。

## 2026-07-06 V1.4 可选备份设置入口记录

- 状态：in_progress。已完成 V1.4 Optional Backup Setup 的最小真实入口，不阻塞项目初始化流程。
- 修正：`frontend/app/components/OnboardingFlow.tsx` 新增 `可选缓存备份` 卡片，显示当前 `backup_retention`，并说明备份只复制本地 SQLite 索引缓存，不修改项目业务文件。
- 修正：`创建备份` 会先保存当前 Settings 草稿，再调用既有 `/system/backup/create`；创建成功后显示备份文件名、大小和保留数量。
- 修正：支持跳过备份配置；跳过状态仅保存在当前浏览器 `localStorage`。成功创建备份后会清除该跳过标记，避免刷新后误回到 `已跳过`。
- 范围控制：未新增后端接口，未改备份 API、数据库 schema、Tauri、依赖或真实项目资料；仍只操作 SQLite 缓存备份。
- 验证通过：`frontend` 目录默认 `cmd /c npm run build` 通过；`cmd /c npm run test` 通过，2 个测试文件 7 个测试。
- 浏览器验证：临时后端 `127.0.0.1:8004`，临时数据库 `release-validation/v1_4_backup-optional-20260706-161015/project_vault.db`，归一化静态预览 `127.0.0.1:3006`。
- 浏览器验证结果：Settings 显示 `可选缓存备份 / 可选 / 创建备份 / 跳过`；点击 `跳过` 后状态变为 `已跳过`；点击 `创建备份` 后状态变为 `已创建` 并显示 `project_vault_20260706_161159.db`、大小和保留数量；控制台 error/warn 数量为 0。
- 磁盘验证：备份文件已生成在 `release-validation/v1_4_backup-optional-20260706-161015/backups/project_vault_20260706_161159.db`，大小与临时测试库一致，为 `237568` bytes。
- 扫描结果：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `DirectoryTree.tsx` 的 `--tree-depth` 动态 CSS 变量，属于有意保留。
- 清理结果：临时后端/静态预览已停止，`8004 / 3006` 均无监听。
- 下一步：V1.4 首轮 onboarding 已覆盖 root path、候选发现、初始化扫描、Dashboard readiness、Sidebar 状态、可选 AI、可选备份；下一步应做一次端到端 onboarding 回归，并视结果更新本地安装使用验证脚本或计划状态。

## 2026-07-06 V1.4 Onboarding 端到端回归记录

- 状态：completed。已用全新 fixture 完成 V1.4 onboarding 开发态端到端回归，未触碰真实项目资料或默认数据库。
- Fixture：`release-validation/v1_4_onboarding-e2e-20260706-171509/`，临时数据库 `project_vault.db`，根目录下创建 `Aurora Showroom` 与 `Banyan Retail` 两个候选项目；每个项目包含 `.dwg`、`.pdf`、`.png`、`.csv` 和文本测试文件。
- 浏览器回归：初始 Dashboard 显示 `待配置`；Settings 保存 fixture root 后发现 2 个候选；全选初始化并扫描后显示初始化 2 个项目、完成 2 次扫描、更新 12 个文件记录。
- 浏览器回归：Dashboard 返回 `Ready`，指标为项目 2、CAD 2、材料 6；Sidebar 显示 `根路径 已配置 / 项目 2 / Ready`，并能看到初始化项目。
- 可选流程：Settings 的 AI 卡片保持 `已跳过` 状态但 `配置 AI` 入口可用；进入 AI Center 后 `添加提供商` 表单可打开，字段包含名称、基础 URL、默认模型、API 密钥和创建按钮。
- 可选流程：Settings 的 `可选缓存备份` 点击 `创建备份` 后显示 `已创建 project_vault_20260706_172348.db（240.0 KB）`。
- API 复核：`/dashboard/metrics` 返回项目 2、CAD 2、材料 6；`/projects` 返回 2 个项目且每个项目为 6 个文件、1 个 CAD、3 个材料；`/history` 返回 2 条扫描事件；`/search?q=Aurora` 返回 `Aurora Showroom`。
- 磁盘复核：两个初始化项目目录均生成 `project.json`；fixture `backups/` 下存在 `project_vault_20260706_172348.db`，大小 `245760` bytes。
- 验证通过：`NEXT_PUBLIC_BACKEND_PORT=8004 cmd /c npm run build` 通过；默认 `cmd /c npm run build` 通过；`cmd /c npm run test` 通过，2 个测试文件 7 个测试。
- 验证通过：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `frontend/app/components/DirectoryTree.tsx:31` 的动态 CSS 变量；`git diff --check` 通过，仅有既有 LF/CRLF 提示。
- Console 复核：内置 Browser 完成实际点击与截图；随后用系统 Edge + 归一化静态预览 `127.0.0.1:3007` 复核 `/`、`/settings/`、`/ai-center/`、`/projects/`、`/history/`，页面非空、无错误覆盖层，console error/warn 为 0。
- 清理结果：临时后端 `8004`、静态预览 `3006` 与 `3007` 均已停止并确认无监听。
- 范围控制：未新增后端/API/数据库 schema/Tauri/依赖；未更新 `scripts/verify_local_installed_usage.ps1`；只新增本轮 release-validation fixture 证据并更新 `progress.md`。
- 剩余风险：本轮不覆盖 packaged installer；`/history` 当前接口返回扫描事件数量和状态，但不 join 项目名，这是既有 API 形态，未在本轮扩大调整。

## 2026-07-07 V1.4 仓库卫生风险修复记录

- 状态：completed。已修复 release-validation 测试产物进入源码索引的风险。
- 修正：`.gitignore` 增加 `release-validation/**/*.db`、`**/backups/`、`**/root/`、`**/fixture-root/`、`**/paths.txt` 规则，覆盖 V1.3/V1.4 回归产生的运行库、备份和 fixture 根目录。
- 修正：已从 Git 索引移除被跟踪的 release-validation 运行数据库、备份、root/fixture-root 样例项目和 paths.txt；本地文件保留，后续提交不再污染源码。
- 验证通过：`git ls-files release-validation` 复查不再返回 `.db`、`backups/`、`root/`、`fixture-root/`、`paths.txt` 高风险路径。
- 验证通过：`git diff --check` 通过，仅有既有 LF/CRLF 提示。
- 范围控制：未删除本地验证证据，未改产品代码、后端/API、数据库 schema、Tauri 或依赖。
- 下一步风险：继续处理 packaged installer 未覆盖 V1.4 onboarding 的风险；优先复用现有本机安装包验证脚本，只有脚本无法覆盖当前 V1.4 流程时再做最小更新。

## 2026-07-07 V1.4 packaged installer 回归风险修复记录

- 状态：completed。已重建当前源码的 Windows x64 NSIS 安装包，并完成本机正式安装后主流程回归。
- 修正：`scripts/verify_local_installed_usage.ps1` 的 packaged frontend 探测从旧文案 `Project Vault V1 / Dashboard` 改为当前 UI 可稳定命中的 `Project Vault / 工作台`；根因是 V1.4 中文 UI 改动导致旧脚本误判前端未渲染。
- 构建通过：`desktop` 目录 `cmd /c npm run build` 通过，输出 `desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`。
- Installer：大小 `247,308,252` bytes，SHA256 `A4451C69D06821AAFAB6E1FFE4D43E04DFC26D423C343D13FA8839551F3E1B11`。
- 验证通过：`scripts/verify_local_installed_usage.ps1` 通过，27 个步骤全部 pass，包括窗口、后端 health、frontend render、Settings root path、候选发现、初始化、扫描、Dashboard、Project Detail、CAD Center、Search、History、备份/恢复、数据库路径、本机数据库恢复和后端退出清理。
- 报告：`release-validation/local-installed-usage-validation.json`，SHA256 `DE61122DC565B9D59AA08B2A2993B3CEF70EAF74D1B807E046D484494D1382DF`。
- 文档同步：已更新 `docs/release/LOCAL_INSTALLED_USAGE_VALIDATION.md` 和 `docs/release/V1_RELEASE_MANIFEST.md` 的 installer/report hash。
- 清理结果：验证后未残留 `project-vault*` 进程。
- 范围控制：未新增依赖，未改后端/API/数据库 schema；脚本只修正前端渲染探测文案。
- 剩余风险：本轮是本机正式安装包回归，不是 clean Windows Sandbox 复验；若要重新宣称 clean Windows 通过，需要再跑 clean Windows 验证脚本。

## 2026-07-07 V1.4 CI 与剩余风险收尾记录

- 状态：completed。已处理 V1.4 收尾后剩余的 CI/check 风险，补上远端可运行的最小 GitHub Actions 工作流。
- 修正：新增 `.github/workflows/ci.yml`，在 `windows-latest` 上运行后端 unittest、前端 build 和前端 test；不新增依赖，不改产品运行路径。
- 修正：`backend/tests/test_phase11_system_maintenance.py` 的 Explorer 打开测试 mock 目标改为当前真实调用点 `app.services.files._launch_system_path`，避免旧导出路径导致测试误失败。
- 修正：`backend/tests/test_providers_api.py` 的 AI Provider 连通性测试改为 mock `urllib.request.urlopen` 的成功路径，避免 CI 访问外网；仍保留无 key 时 `missing_base_url_or_key` 的断言。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest discover -s tests -v` 通过，64 个测试全部通过。
- 验证通过：`frontend` 目录默认 `cmd /c npm run build` 通过，Next.js 16.1.0 静态构建 9 个路由全部生成；仍只有既有 `output: export` 与 rewrites 提示。
- 验证通过：`frontend` 目录 `cmd /c npm run test` 通过，2 个测试文件 7 个测试全部通过。
- 验证通过：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `frontend/app/components/DirectoryTree.tsx:31` 的动态 CSS 变量。
- 验证通过：`git diff --check` 通过，仅有既有 LF/CRLF 提示；`git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'` 无命中。
- GitHub 复核：远端当前最新提交 `8393f3f51accf2493f405cd415babfe874a43d48` 没有 status/check context；本轮新增 workflow 后，下一次 push/PR 才会产生 `ci` 检查结果。
- 范围控制：未改后端业务逻辑、API 契约、数据库 schema、Tauri 或依赖；只补 CI 工作流、修正过期测试断言并记录验证证据。
- 剩余风险：远端 CI 运行结果和分支保护 required checks 需要 push 后才能确认；clean Windows Sandbox 仍未在本轮重跑。

## 2026-07-07 V1.4 Clean Windows Sandbox 复验收尾记录

- 状态：completed。已用当前 release installer 在 Windows Sandbox 中重新运行 clean Windows 验证，补齐 V1.4 packaged installer 的 clean 环境证据。
- 修正：`scripts/verify_clean_windows_release.ps1` 的 packaged frontend 探测从旧 `Project Vault V1 / Dashboard` 改为当前稳定 shell 文案 `Project Vault`；避免 V1.4 UI 文案变更造成误判。
- 修正：clean 验证报告输出改为 UTF-8 no BOM + LF，且空错误行不写尾随空格；同时保持 Windows PowerShell 5.1 解析通过。
- 验证通过：`release-validation/clean-windows-validation.json`，`passed=true`，14 个步骤全部 pass。
- 关键步骤：`python_unavailable`、`node_unavailable`、`installer_silent_run`、`fixed_webview2_runtime_bundled`、`app_main_webview_window`、`webview2_runtime_error_dialog_absent`、`backend_health`、`frontend_render`、`database_path`、`backend_exit_cleanup` 均为 pass。
- 运行证据：后端 health `http://127.0.0.1:49788/api/v1/health`，前端 render `http://127.0.0.1:49789/`，数据库位于 Sandbox 用户 `%LOCALAPPDATA%\ProjectVault\database\project_vault.db`。
- 报告：`release-validation/clean-windows-validation.json`，大小 `7,760` bytes，SHA256 `065A3D264F973771AF0556DBC8B3DC388601C9B48E1EF01E592F55FD14E96023`。
- 文档同步：已更新 `docs/release/CLEAN_WINDOWS_VALIDATION.md` 和 `docs/release/V1_RELEASE_MANIFEST.md` 的 clean Windows 复验证据。
- 范围控制：未改产品后端业务逻辑、API 契约、数据库 schema、Tauri 或依赖；只修正验证脚本和发布证据记录。
- 剩余风险：clean Windows 风险已关闭；远端 CI/check 状态仍需 push/PR 后由 GitHub 运行确认。

## 2026-07-08 V2 Knowledge Platform 规划启动记录

- 状态：waiting_for_user_confirmation。V1.4 发布、CI、分支保护、GitHub Release 和 V1.5 维护清单已完成后，正式启动 V2 项目规划。
- 新增文档：`docs/planning/V2_KNOWLEDGE_PLATFORM_PLAN.md`。
- 新增文档：`docs/planning/V2_SCHEMA_API_RFC.md`。
- 新增文档：`docs/planning/V2_EXECUTION_PLAN.md`。
- 新增文档：`docs/planning/V2_CONFIRMATION_CHECKLIST.md`。
- 规划结论：V2 首轮定位为 Knowledge Platform，不直接做 Agent OS，也不直接做完整 RAG。首轮顺序为结构化知识字段、文本提取、AI 草稿、人工确认、`project.json` 写回、SQLite/FTS5 同步。
- 默认建议：文本提取首轮采用 `.txt/.md/.csv/.json` + 可用时 `.docx`；证据采用短摘录 + 文件引用；每个项目只保留一个 active draft；现有 AI tab 升级为 Knowledge 视图。
- 范围控制：本轮只写规划；未改前端、后端、数据库 schema、Tauri、依赖或发布脚本。
- 同步：`task_plan.md` 已将 Phase 14 状态改为等待用户确认。
- 下一步：用户确认 V2 计划包后，进入 V2.1 Knowledge Read Model；确认前不动代码、不做 schema 迁移。

## 2026-07-08 V2.1 Knowledge Read Model 自动验收记录

- 状态：ready_for_human_acceptance。用户已确认 V2 计划包，本轮完成 V2.0 Planning Freeze，并实现 V2.1 Knowledge Read Model 的最小读视图。
- 修正：Project Detail 原 `AI 元数据` tab 改为 `项目知识`，继续复用现有 `ai_metadata` 和 `/projects/{project_id}/ai-metadata` 读接口。
- 修正：`AiTab` 空态改为“尚未整理项目知识”，并移除旧的“开始分析/重新分析”直接 AI 写入入口，避免在 V2 草稿确认机制完成前继续从主界面触发绕过草稿的写入路径。
- 测试：新增 `frontend/__tests__/AiTab.test.tsx`，覆盖空知识状态、已确认知识字段渲染，以及旧“开始分析”入口不再出现。
- 浏览器 smoke：使用 fixture DB `release-validation/v2-knowledge-readmodel-20260708-102550/project_vault.db`，临时后端 `127.0.0.1:8004`，归一化静态预览 `127.0.0.1:3007`，Edge headless 打开 `/project-detail/?id=v2-knowledge-fixture&tab=ai`；项目标题、`项目知识` tab、摘要、核心需求和风险均可见，旧 `开始分析` 入口数量为 0，console error/warn 为 0。
- 验证通过：`frontend` 目录 `cmd /c npm run test` 通过，3 个测试文件 9 个测试全部通过。
- 验证通过：`frontend` 目录默认 `cmd /c npm run build` 通过；中途也用 `NEXT_PUBLIC_BACKEND_PORT=8004` 做过一次静态导出 smoke build，最终已恢复默认 build。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest discover -s tests -v` 通过，64 个测试全部通过。
- 验证通过：`git diff --check` 通过，仅提示既有 LF/CRLF 归一化警告；`git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'` 无命中。
- 范围控制：未新增后端 API，未改数据库 schema，未写 `project.json`，未改 Tauri，未引入依赖，未触碰真实项目资料或默认数据库。
- 清理：临时后端 `8004`、临时静态预览 `3007`、失败尝试中的 `3006` 均已停止并确认无监听。
- 剩余风险：后端既有 `/projects/{project_id}/ai-analyze` 仍保留为 V1 兼容接口；本轮已从 V2.1 主界面移除直接入口，后续 V2.3 Draft Store 阶段需要把 AI 生成统一接入草稿与人工确认流程。
- 下一步：等待用户人工验收 V2.1；通过后进入 V2.2 Text Extraction Foundation。

## 2026-07-08 V2.1 人工验收通过记录

- 状态：complete。用户已通过网页方式人工验收 V2.1 Knowledge Read Model。
- 验收方式：临时后端 `127.0.0.1:8004` + 临时网页预览 `127.0.0.1:3007`，打开 `http://127.0.0.1:3007/project-detail/?id=v2-knowledge-fixture&tab=ai`。
- 用户确认：页面可访问，`V2 Knowledge Fixture`、`项目知识` tab 和知识摘要可见，旧 `开始分析` 入口不存在。
- 清理：人工验收后已停止临时网页预览和临时后端；`8004`、`3007` 均无监听。
- 恢复：人工验收前为连接 fixture 后端曾以 `NEXT_PUBLIC_BACKEND_PORT=8004` 构建前端；验收后已重新执行默认 `frontend` 构建，避免测试端口残留。
- 约定：后续需要人工验收时，必须明确写出验证方式（网页/桌面 App/安装包/沙盒）、打开地址或程序、点击路径、应看到内容、不应看到内容、以及通过回复格式。
- 下一步：进入 V2.2 Text Extraction Foundation；开始前先列出执行清单和面向用户的验收步骤。

## 2026-07-08 V2.2 / V2.3 自动验收记录

- 状态：ready_for_human_acceptance。用户已同意开始 V2.2 和 V2.3，本轮完成 Text Extraction Foundation 与 Knowledge Draft Store 的最小闭环。
- Schema：SQLite `CURRENT_SCHEMA_VERSION` 升级到 2，新增 `knowledge_sources / knowledge_drafts / knowledge_history`，迁移记录包含 `1 / 2`，旧 V1 库可幂等补齐。
- 后端：新增 `backend/app/api/knowledge.py` 与 `backend/app/knowledge/service.py`，提供 `GET /projects/{project_id}/knowledge`、`POST /projects/{project_id}/knowledge/extract-text`、`POST /projects/{project_id}/knowledge/draft`。
- 提取范围：首轮只支持 `.txt / .md / .csv / .json`，文本读取有大小和摘录长度上限；`.pdf` 等不支持格式返回 `unsupported_format`，不新增依赖、不做 OCR、不解析 CAD。
- 草稿范围：支持从 ready source 创建 manual draft；每个项目只保留一个 active draft；旧 draft 会标记为 `discarded`；approved `ai_metadata` 不被改动。
- AI 边界：`mode=ai` 在没有启用 Provider 和 key 时返回 `ai_provider_required`；即使有 Provider，真实 AI 生成仍未实现，等待首次 AI generation confirmation gate。
- 前端：`frontend/lib/api.ts` 新增 Knowledge 类型和 API 方法；`AiTab` 新增“提取文本 / 创建草稿”入口、来源摘录列表和知识草稿展示；未加入“应用草稿”或“写回 project.json”按钮。
- 测试：新增/扩展 `backend/tests/test_knowledge_api.py`、`frontend/__tests__/AiTab.test.tsx`；TDD 红灯先出现，随后转绿。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest tests.test_database_migrations tests.test_knowledge_api -v`，10 tests OK。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest discover -s tests -v`，68 tests OK。
- 验证通过：`frontend` 目录 `cmd /c npm run test`，3 个测试文件 10 tests passed。
- 验证通过：`frontend` 目录 `cmd /c npm run build` 通过；为 smoke 曾以 `NEXT_PUBLIC_BACKEND_PORT=8004` 构建，验收后已重新执行默认 build。
- 浏览器 smoke：fixture `release-validation/v2-knowledge-20260708-111015/`，临时后端 `127.0.0.1:8004`，临时静态预览 `127.0.0.1:3007`；Edge headless 打开 `/project-detail/?id=v2-knowledge-e2e&tab=ai`，提取文本和创建草稿均成功。
- 浏览器结果：页面显示 `既有已确认知识摘要`、提取状态、`02_需求资料/brief.md`、`知识草稿` 和草稿摘要；`应用草稿` 数量 0，`写回 project.json` 数量 0；console error/warn 为 0，404 资源为 0。
- API/磁盘复核：`GET /knowledge` 返回 `status=approved` 且 `draft.status=draft`；项目文件数 7；fixture `project.json` 仍只包含原 `既有已确认知识摘要`，不包含新草稿里的 `控制顾客动线`。
- 静态样式复核：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `frontend/app/components/DirectoryTree.tsx:31` 的动态 CSS 变量。
- 仓库卫生复核：`.gitignore` 补充 `release-validation/**/*.pid`，防止临时后端 pid 文件误提交；`git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'` 无命中；`git diff --check` 通过，仅有既有 LF/CRLF 提示。
- 清理：自动 smoke 后曾停止临时后端和静态预览并确认 `8004 / 3007` 无监听；为人工验收，已重新开启 `127.0.0.1:8004 / 127.0.0.1:3007`，待用户确认后再清理。
- 范围控制：未写 `project.json`，未实现 apply，未新增依赖，未改 Tauri/installer，未触碰真实项目资料或默认数据库。
- 剩余风险：V2.4 apply 尚未开始；首次 `project.json` 写入、backup、SQLite/FTS sync 需要下一阶段单独确认并用 fixture 验证。真实 AI draft 生成也未开始，需要用户另行确认。
- 人工验收方式：本阶段请验收“网页预览”，不是桌面 App 或安装包。打开临时网页 `http://127.0.0.1:3007/project-detail/?id=v2-knowledge-e2e&tab=ai`，点击 `提取文本`，再点击 `创建草稿`；应看到提取数量、`02_需求资料/brief.md` 和 `知识草稿`，不应看到 `应用草稿` 或 `写回 project.json`。通过后回复“V2.2/V2.3 通过”。

## 2026-07-08 V2.2 / V2.3 人工验收通过记录

- 状态：complete。用户已通过网页方式人工验收 V2.2 Text Extraction Foundation 与 V2.3 Knowledge Draft Store。
- 验收方式：临时后端 `127.0.0.1:8004` + 临时网页预览 `127.0.0.1:3007`，打开 `http://127.0.0.1:3007/project-detail/?id=v2-knowledge-e2e&tab=ai&v=v223`。
- 验收修复：人工验收时首页曾显示 `404: not found`，根因是人工验收前为恢复默认 build，静态导出未再带 `NEXT_PUBLIC_BACKEND_PORT=8004`，前端请求落到 `3007/api`；已用 `NEXT_PUBLIC_BACKEND_PORT=8004` 重新构建，并重启 3007 静态预览加 `Cache-Control: no-store`。
- 用户确认：页面可访问，V2.2/V2.3 验收通过。
- 清理：人工验收后已停止临时网页预览和临时后端；`8004`、`3007` 均无监听。
- 恢复：人工验收通过后已重新执行默认 `frontend` 构建，避免 `NEXT_PUBLIC_BACKEND_PORT=8004` 静态导出残留。
- 下一步：进入 V2.4 Apply Approved Knowledge；开始前必须确认首次 `project.json` 写入方案、备份策略、SQLite/FTS 同步方式和人工验收步骤。

## 2026-07-08 V2.4 / V2.5 自动验收记录

- 状态：ready_for_human_acceptance。用户同意同时推进 V2.4 Apply Approved Knowledge 与 V2.5 Knowledge Search，本轮已完成自动测试、Chrome smoke 和文档同步，等待人工验收。
- 后端：新增 `POST /projects/{project_id}/knowledge/apply`，请求必须包含 `draft_id`、`fields` 和 `confirm=true`；未确认时返回 `confirm_required`。
- 写入保护：应用草稿前会在项目目录生成 `project.json.bak.<timestamp>`；随后写入选中知识字段，再复用 Full Scanner 同步 SQLite 缓存并刷新 FTS5。
- 历史记录：应用成功后写入 `knowledge_history` 的 `apply_draft / success` 事件，并把 draft 标记为 `applied`。
- 搜索：FTS5 新增 `knowledge` 实体类型，`/search?q=handover&category=knowledge` 可返回已确认知识结果；未引入向量搜索或新依赖。
- 风险修复：自动 smoke 发现 `project.json` 会作为 `.json` 文本源进入草稿摘要，已修复为后端忽略根目录 `project.json`，前端也不再把 `project.json` 发送给提取接口；新增后端和前端回归测试覆盖。
- 前端：Project Detail 的项目知识区新增 `应用草稿` 操作；点击后浏览器确认框提示“确认应用草稿并写入 project.json？系统会先创建备份。”，确认后显示备份文件名。
- Fixture：`release-validation/v2_4_2_5_apply_search-20260708-164410/`，使用独立 `project_vault.db` 和 `fixture-root/V2 Apply Search Fixture`，未触碰真实项目资料或默认数据库。
- Chrome smoke：临时后端 `127.0.0.1:8004` + 静态预览 `127.0.0.1:3007`，打开 `/project-detail/?id=v2-apply-search-e2e&tab=ai&v=v245final`，完成提取文本、创建草稿、确认应用草稿；页面显示 `已应用草稿，备份：`。
- Chrome smoke 复核：Dashboard metrics 为项目 1、CAD 1、材料 2；Knowledge 搜索返回 `knowledge`；应用后 approved summary 不包含 `project_id`，证明 `project.json` 未再污染摘要；报告为 `release-validation/v2_4_2_5_apply_search-20260708-164410/browser-smoke-report.json`。
- 磁盘复核：fixture 项目目录已生成 `project.json.bak.20260708-*`，`project.json` 的 `schema_version` 更新为 `2.0`。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest discover -s tests -v`，71 tests OK。
- 验证通过：`frontend` 目录 `cmd /c npm run test`，3 个测试文件 10 tests passed。
- 验证通过：`frontend` 目录 `NEXT_PUBLIC_BACKEND_PORT=8004 cmd /c npm run build`，9 个静态路由生成成功；仍仅有 Next 静态导出 rewrites 既有提示。
- 验证通过：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `frontend/app/components/DirectoryTree.tsx:31` 的动态 CSS 变量。
- 验证通过：`git diff --check` 通过，仅有既有 LF/CRLF 提示；`git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'` 无命中。
- 范围控制：本轮未新增依赖，未改 Tauri/installer，未实现真实 AI 生成、Agent、RAG、向量搜索、批量 apply 或 Dashboard coverage metric。
- 当前临时验收环境：后端 `127.0.0.1:8004` 和网页预览 `127.0.0.1:3007` 已保持运行，供人工验收；通过后需要停止临时服务并重新执行默认 `frontend` 构建，避免 `NEXT_PUBLIC_BACKEND_PORT=8004` 静态导出残留。
- 人工验收方式：本阶段验收网页预览，不是桌面 App 或安装包。打开 `http://127.0.0.1:3007/project-detail/?id=v2-apply-search-e2e&tab=ai&v=v245final`，应看到 `V2 Apply Search Fixture`、`项目知识`、`已应用草稿，备份：`，并且旧摘要已被新摘要替换；通过后回复“V2.4/V2.5 通过”。

## 2026-07-08 V2.4 / V2.5 人工验收通过记录

- 状态：complete。用户已通过网页方式人工验收 V2.4 Apply Approved Knowledge 与 V2.5 Knowledge Search。
- 验收方式：内置浏览器打开临时网页 `http://127.0.0.1:3007/project-detail/?id=v2-apply-search-e2e&tab=ai&v=v245final`。
- 用户确认：V2.4/V2.5 通过。
- 清理：人工验收后已停止临时后端 `127.0.0.1:8004` 和临时网页预览 `127.0.0.1:3007`，复查均无监听。
- 恢复：人工验收前为连接 fixture 后端曾以 `NEXT_PUBLIC_BACKEND_PORT=8004` 构建前端；验收后已重新执行默认 `frontend` 构建，避免测试端口残留。
- 最终验证：默认 `frontend` 构建通过；`git diff --check` 仍只提示既有 LF/CRLF 归一化警告。
- 下一步：进入 V2.6 Local Semantic Search Spike 或 V2 beta 收口决策；真实 AI draft 生成、向量依赖和安装包发布仍需用户单独确认。

## 2026-07-08 V2 beta 收口决策记录

- 状态：ready_for_acceptance。已把 V2.1-V2.5 固化为首个 V2 beta 可验收节点。
- 新增收口文档：`docs/release/V2_BETA_ACCEPTANCE_CHECKPOINT.md`，记录 accepted behavior、明确排除项、安全门禁、验证命令、fixture 证据和下一步决策。
- 同步文档：`docs/planning/V2_KNOWLEDGE_PLATFORM_PLAN.md`、`docs/planning/V2_SCHEMA_API_RFC.md`、`docs/planning/V2_EXECUTION_PLAN.md`、`docs/planning/V2_CONFIRMATION_CHECKLIST.md`、`task_plan.md`。
- beta 范围：V2.1 Knowledge Read Model、V2.2 Text Extraction Foundation、V2.3 Knowledge Draft Store、V2.4 Apply Approved Knowledge、V2.5 Knowledge Search。
- 不包含：packaged installer release、真实 AI 生成、Agent/RAG/语义搜索、向量依赖、跨项目批量 apply、Dashboard knowledge coverage metric。
- 决策结果：V2.1-V2.5 可作为 `v2.0.0-beta.1` 的开发验收范围；这不是安装包发布声明。
- 继续门禁：真实 AI 生成、语义/向量依赖、安装包发布、跨项目批量 apply 仍需用户单独确认。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest discover -s tests -v`，71 tests OK。
- 验证通过：`frontend` 目录 `cmd /c npm run test`，3 个测试文件 10 tests passed。
- 验证通过：`frontend` 目录 `cmd /c npm run build`，9 个静态路由生成成功；仍仅有 Next 静态导出 rewrites 既有提示。
- 验证通过：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `frontend/app/components/DirectoryTree.tsx:31` 的动态 CSS 变量。
- 验证通过：`git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'` 无命中。
- 验证通过：`git diff --check` 退出正常，仅输出既有 LF/CRLF 归一化提示。
- 本轮未启动临时后端或网页预览；复查 `8004 / 3007` 无监听；未使用 Edge。

## 2026-07-08 V2 beta packaged installer 验证记录

- 状态：deferred_by_user。已按用户要求停止继续做沙盒/安装环境复验，转入 V2.6。
- 首次失败：本机安装包回归在 `v2_knowledge_extract_text` 前返回 404，根因是 `tauri build` 只打包已有 backend sidecar，未重建包含 V2 Knowledge API 的 PyInstaller sidecar。
- 修复：`desktop/package.json` 新增 `prebuild`，在 `npm run build` 前执行 `scripts/build_backend_sidecar.ps1 -SkipInstall`，避免后续 installer 打进旧 sidecar。
- 修复：`scripts/build_backend_sidecar.ps1` 增加 `--hidden-import app.api.knowledge`，并用 `backend/tests/test_phase12_sidecar_packaging.py` 锁定。
- 验证通过：PowerShell 语法检查通过，覆盖 `scripts/build_backend_sidecar.ps1` 与 `scripts/verify_local_installed_usage.ps1`。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest tests.test_phase12_sidecar_packaging -v`，12 tests OK。
- 验证通过：`desktop` 目录 `cmd /c npm run build` 通过，先重建 frontend，再重建 backend sidecar，再生成 release NSIS installer。
- 最新 Installer：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`，大小 `247,439,069` bytes，SHA256 `9099FA65EA69A0A030DADB0955339637CE7411C5E682E16B66FCCEC96FE4EB41`。
- 本机安装回归曾在前一版 installer 上通过，报告 `release-validation/local-installed-usage-validation.json`，`passed=true`，32 个步骤全部 pass，installer SHA256 `6C6BD555BD4DAD2B036AC6B6438F6AF728CA316A18BB69856600FD8F1CE4F1FF`。
- 最新 installer 复验未完成：验证脚本清理安装目录时遇到 WebView2 runtime 文件锁 `zh-CN.pak is denied`；未进入产品流程验证。
- V2 packaged 关键步骤通过：`v2_knowledge_file_indexed`、`v2_knowledge_extract_text`、`v2_knowledge_create_draft`、`v2_knowledge_apply_draft`、`v2_knowledge_search`。
- 已知待处理：后续恢复 packaged validation 时，先给 `scripts/verify_local_installed_usage.ps1` 的安装目录删除加短重试，或确保 WebView2 进程完全退出后再清理。
- 验证通过：`git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'` 无命中。
- 验证通过：`git diff --check` 退出正常，仅输出既有 LF/CRLF 归一化提示。
- 清理结果：当前未发现 `project-vault*` 进程；`8004 / 3007` 无监听。
- 剩余风险：最新 installer 的本机安装回归与 clean Windows Sandbox 验证均延后；不作为 V2.6 spike 前置门禁。

## 2026-07-08 V2.6 Local Semantic Search Spike 启动记录

- 状态：in_progress。用户要求先不测沙盒，开始 V2.6。
- 范围：只做本地语义搜索 spike，不加生产向量依赖，不接产品搜索入口，不改 schema/API。
- 执行清单：用 fixture 构造 FTS5 命中/漏召回样例；用零依赖 Python baseline 估算“语义/同义词/意图扩展”可带来的召回提升；输出 keep/drop 决策文档。
- 验收清单：有可复现脚本或命令；有 fixture 报告；有 keep/drop 建议；记录是否值得进入真正向量依赖评估。

## 2026-07-08 V2.6 Local Semantic Search Spike 完成记录

- 状态：complete。已完成本地语义搜索 spike；未新增依赖，未改 schema/API，未接前端或产品搜索入口。
- 新增脚本：`scripts/v2_6_semantic_search_spike.py`。
- 新增决策文档：`docs/planning/V2_6_SEMANTIC_SEARCH_SPIKE.md`。
- Fixture 报告：`release-validation/v2_6_semantic_search_spike-20260708-181223/semantic-search-spike-report.json`。
- 验证命令：`backend\.venv\Scripts\python.exe scripts\v2_6_semantic_search_spike.py`。
- 结果：FTS5 Knowledge search 命中 3/6，总近义查询命中 1/4；零依赖 alias proxy 命中 6/6，总近义查询命中 4/4。
- 决策：`defer_vector_dependency`。当前 V2 不引入向量依赖；保留 FTS5，只有出现真实 miss-query 样本后才考虑小型 query expansion；向量搜索需要用户单独确认。
- 剩余风险：fixture 很小，只证明近义召回问题存在，不证明生产 ranking 质量；latest installer 本机安装回归和 clean Windows Sandbox 验证仍按用户要求延后，不作为 V2.6 前置门禁。

## 2026-07-08 V2 beta packaged installer 本机复验记录

- 状态：local_packaged_validation_passed。按用户确认的下一步，恢复 beta packaged validation，不跑沙盒。
- 修复：`scripts/verify_local_installed_usage.ps1` 新增 `Remove-PathWithRetry` 和 `Stop-ProjectVaultRuntimeProcesses`，安装目录清理遇到 WebView2 runtime 文件锁时会短重试，并只停止验证安装目录下的 Project Vault/WebView2 进程。
- 测试：`backend/tests/test_phase12_sidecar_packaging.py` 新增脚本门禁，锁定本机安装验证脚本具备安装目录清理重试和 WebView2 进程处理。
- 验证通过：PowerShell 语法检查 `verify_local_installed_usage.ps1 syntax ok`。
- 验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest tests.test_phase12_sidecar_packaging -v`，14 tests OK。
- 验证通过：`scripts\verify_local_installed_usage.ps1` 本机安装包级回归通过，报告 `release-validation/local-installed-usage-validation.json`。
- 报告结果：`passed=true`，32 个步骤全部 pass，失败步骤 0。
- Installer：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_0.1.0_x64-setup.exe`，大小 `247,439,069` bytes，SHA256 `9099FA65EA69A0A030DADB0955339637CE7411C5E682E16B66FCCEC96FE4EB41`。
- 报告 SHA256：JSON `66F3FE90727FAEFF3C97E6D6D54F7E196FF24620D87EFC37AFDC684B54325AAF`；TXT `E26F9DD5DC4E3489225EE96731AA6B365BAF66DD345E999BD91B6BB73354F65A`。
- V2 packaged 步骤通过：`v2_knowledge_file_indexed`、`v2_knowledge_extract_text`、`v2_knowledge_create_draft`、`v2_knowledge_apply_draft`、`v2_knowledge_search`。
- 最终验证通过：`backend` 目录 `.venv\Scripts\python.exe -m unittest discover -s tests -v`，73 tests OK。
- 最终验证通过：`frontend` 目录 `cmd /c npm run test`，3 个测试文件 10 tests passed。
- 最终验证通过：`frontend` 目录 `cmd /c npm run build`，9 个静态路由生成成功；仅有 Next 静态导出 rewrites 既有提示。
- 最终验证通过：`rg -n 'style=\{\{|style="' frontend/app` 仍仅剩 `frontend/app/components/DirectoryTree.tsx:31` 的动态 CSS 变量。
- 最终验证通过：`git diff --check` 退出正常，仅输出既有 LF/CRLF 归一化提示；`git ls-files release-validation | rg '(\.db$|/backups/|/root/|/fixture-root/|/paths\.txt$)'` 无命中。
- 清理结果：未发现残留 `project-vault*` 进程。
- 范围控制：本轮是本机 installed packaged validation，不是 clean Windows Sandbox 验证；未新增产品依赖，未新增 API/schema，未做真实 AI generation。
- 剩余风险：latest installer 仍需 clean Windows Sandbox 或独立 clean Windows 机器复验后，才能作为 release-grade installer 声明。

## 2026-07-10 V2.7 Real AI Draft Generation 启动记录

- 状态：in_progress。用户确认同步推进 beta 仓库收口、提交/CI、发布级安装包验证和真实 AI generation，自动 review/test 后再人工验收。
- 分支：`feat/v2-beta-ai-generation`，从 `main` / `v1.4.0` 创建并保留当前全部 V2 工作树改动。
- 实现边界：复用现有 OpenAI-compatible Provider `/chat/completions`；输入仅使用 fixture 提取的短摘录；输出只进入 `knowledge_drafts`。
- 写入门禁：AI 草稿不得直接写 `ai_metadata` 或 `project.json`；仍需现有“应用草稿”确认、备份、SQLite/FTS 同步流程。
- 范围控制：不新增依赖、不改数据库 schema、不做向量搜索、批量 apply、PDF/DOCX 或 Agent/RAG。
- 验收清单：Provider 缺失/失败路径受控；成功草稿记录 provider/model；已确认知识不被生成动作覆盖；前端 AI 草稿入口可用；全量测试、CI、installer 本机/clean Windows 验证通过；最后人工验收。

## 2026-07-10 V2.7 Real AI Draft Generation 完成记录

- 状态：complete。用户已完成最终人工验收。
- 功能：复用 OpenAI-compatible Provider 和已提取短摘录；AI 输出只保存到 `knowledge_drafts`，记录 provider/model；旧 direct analyze 接口固定返回 `409 use_knowledge_draft_flow`。
- 安全：Provider 缺失、网络失败、无效响应和超大响应均不会创建草稿或改写已确认知识；`project.json` 仍只在现有确认 apply 流程中写入并先备份。
- 自动验证：backend unittest 83 tests OK；frontend test 12 passed；frontend production build 和 desktop `cargo check` 通过；静态样式扫描只保留 `DirectoryTree.tsx` 的动态 CSS 变量。
- 远端验证：PR #2 的 GitHub Actions CI run 3 通过，backend、frontend build、frontend test 均为 success。
- 新 installer：`Project Vault_2.0.0-beta.1_x64-setup.exe`，SHA256 `FCA20A8EBFDF08C6F2C6C5216F00355E6C55546ECD259E85D9A501E819AA668F`。
- 本机安装包验证：`release-validation/v2.0.0-beta.1/local-installed-usage-validation.json`，`passed=true`，33 steps pass；报告 SHA256 `84E1FBD6FBC7001DCFFC87ADD5871ECFCCBA0E092DBEACE780C008CC18238BDB`。
- clean Windows 验证：`release-validation/v2.0.0-beta.1/clean-windows-validation.json`，`passed=true`，15 steps pass；无 Python/Node、fixed WebView2、主窗口、knowledge route、frontend render、退出清理均通过；报告 SHA256 `C460E8C723B1B15B39CFC931E919F12980E2654677D728CEE501A30E487FE1F0`。
- 人工验收：用户已确认 Sandbox 主窗口与网页 fixture 的提取文本、AI 生成草稿、确认应用流程通过。
- 清理：临时 mock Provider、fixture backend、网页预览已停止；`8004 / 3007 / 18181` 无监听。前端将恢复默认构建。
- 后续风险：真实第三方 Provider 凭据和实际项目语料尚未作为发布门禁验证；向量依赖、批量 apply、PDF/DOCX、新的生产语义搜索、Agent/RAG 仍不在 V2 beta 范围。

## 2026-07-10 V2 Beta 真实使用验证自动阶段

- 状态：waiting_for_user_acceptance。报告：`docs/release/V2_BETA_REAL_USAGE_VALIDATION.md`。
- 数据边界：从真实室内设计项目创建独立副本 `release-validation/v2_beta_real_usage-20260710-161758/fixture-root/追觅`；原件未写入、未删除，原始绝对路径仅存在于被忽略的 `paths.txt`。
- 自动流程通过：候选导入、初始化、251 文件全量扫描、CAD 24、材料 207、文本提取、不支持格式、AI 草稿、确认门禁、写前备份、确认写入、SQLite/FTS5、重启持久化、文件移动/删除和扫描异常记录。
- 异常路径通过：API Key 缺失、Provider 失败、网络超时、无效 `project.json`、无效来源文件均返回受控错误，已确认知识未变化。
- 缺陷修复 1：changed-path 增量扫描未配对移动文件，导致 `moved=0`；已在 `backend/app/scanner/incremental_scanner.py` 按指纹配对并保留 file ID，新增回归测试。
- 缺陷修复 2：桌面静态服务遗漏 Next RSC 预取路径映射；已在 `desktop/src-tauri/src/main.rs` 映射 `__next.<route>.__PAGE__.txt`，新增 2 个路由单测。Chrome 等价静态预览 `error/warn=0`。
- 性能：真实副本 250 个源文件、4.89 GB；全量扫描 78 ms，文件列表 1.59 ms，知识 FTS5 1.39 ms。当前不对 10,000+ 真实文件 UI 性能下结论。
- 自动验证：backend 84 tests OK；frontend 12 tests passed；默认 `npm run build` 通过；desktop `cargo test` 2 passed；`8004 / 3007` 临时服务已停止。
- 验证限制：本机 Rust toolchain 未安装 `rustfmt`，因此未执行格式检查；不影响已通过的 `cargo test` 编译与路由测试。
- 人工验收待办：真实外部 Provider 草稿的专业准确性、隐私授权、字段确认体验和搜索工作流。未得到这些判断前，不建议宣称具备 V2 正式版候选条件；可继续受控 Beta 使用。

## 2026-07-13 PDF 提取与筛选修复

- 状态：ready_for_manual_validation。用户在真实副本验收中发现 PDF/图片占据提取名额，导致无法形成可审查 AI 草稿。
- 修复：新增 `pypdf==6.14.2`；文本型 PDF 使用本地 `pypdf` 提取，扫描版返回 `no_extractable_text`，损坏文件返回 `pdf_extract_failed`，均不创建空来源。
- 修复：前端仅提交 `.txt/.md/.csv/.json/.pdf`；图片等不支持格式显示为已跳过，不占 20 个提取名额。
- 实际副本复核：抽检 PDF `status=ready`、`extractor=pypdf`、`text_length=13762`；仅操作隔离副本和独立数据库。
- 自动验证：knowledge API 16 tests OK；backend 85 tests OK；frontend 12 tests passed；frontend build 通过。
- 边界：图片 OCR、扫描版 PDF OCR、DOCX 不在本次变更范围。等待用户在临时环境复核 PDF 摘录与 AI 草稿质量。

## 2026-07-13 三份会议纪要自动验证

- 数据边界：用户提供的三份 Markdown 会议纪要仅复制到隔离副本 `00_AI验收资料/`；原件未修改。
- 结果：重扫后精确选中 3/3；文本提取 3 ready、0 failed，合计 26,161 字符。
- 草稿：三份来源创建 manual draft 成功，`status=draft`，证据数量 3，摘要长度 500；未调用外部 Provider，未写 `project.json`。
- 限制：当前仅启用本地验证 Provider，不能据此判断真实模型的专业质量；真实 Provider 内容质量仍等待用户验收。

## 2026-07-13 项目知识一键流程

- 状态：ready_for_manual_validation。按用户确认方案收敛为“一键整理项目知识 → AI 建议 → 确认写入 / 放弃草稿”。
- 前端：自动选择最多 20 个 `.txt/.md/.csv/.json/.pdf` 资料，提取后直接请求 AI 草稿；不再暴露提取、手动草稿、字段复选框和索引细节。
- 安全：`确认写入` 仍弹窗确认、创建 `project.json` 备份并同步 SQLite/FTS；`放弃草稿` 新增最小 discard API，只更新 draft 状态和历史，不写项目文件。
- 可审查性：核心需求、风险默认显示；来源与其他字段默认折叠。
- 自动验证：discard 后端回归新增；backend 86 tests OK；frontend 10 tests passed；frontend build 通过；Chrome 控制台 `error/warn=0`。
- 人工验收：确认页面只见“整理项目知识 / 确认写入 / 放弃草稿”；不要在真实 Provider 内容质量、隐私授权未确认前写入项目副本以外的资料。

## 2026-07-13 临时 AI Provider 400 修复

- 根因：隔离数据库保留 `V2 Real Usage Local Provider`，地址为未启动的 `127.0.0.1:19191`，一键整理请求返回 `400 network_error`。
- 修复：禁用隔离环境的验证 Provider；前端将 `network_error` 映射为“AI 提供商无法连接。请在 AI 中心检查地址、模型和网络。”
- 结果：未再向本地 mock 或外部 Provider 发送项目资料。用户需在 AI 中心自行配置可用 Provider 后执行真实 AI 草稿验收。
- 验证：新增前端错误提示回归；frontend 11 tests passed，build 通过。

## 2026-07-13 项目知识简化流程人工验收

- 状态：accepted。用户已确认简化流程通过。
- 验收范围：一键整理入口、草稿确认写入、放弃草稿、Provider 配置提示和隔离副本保护。
- 保留边界：真实 Provider 内容质量、隐私授权、图片 OCR、扫描版 PDF OCR、DOCX 继续按后续真实使用观察，不作为本次 UI 流程通过声明。

## 2026-07-13 V2 知识链路审查与最小加固

- 状态：complete。
- 范围：以 V2 真实使用后的知识链路为优先审查对象：文本/PDF 提取、来源校验、AI 草稿、确认写入。
- ADR 门禁：本轮为既有服务层资源/输入校验缺陷修复，不引入新架构、API、schema 或依赖，未发现需要新增 ADR 的决策。
- 已确认并修复：PDF 提取原先会拼接整份文档文本；现改为逐页读取并按 `MAX_SOURCE_BYTES` 累计截断，保存的文本长度不会超过现有普通文本边界。
- 复核结论：AI 草稿已有 `ready_sources_required` 服务层门禁，在调用 Provider 前拒绝没有有效摘录的请求；不重复增加同类校验。
- 测试：第一次补丁因测试断言文本不完全匹配而未应用，未改代码；按实际片段重新定位后补丁应用成功。
- 验证通过：新增 PDF 上限回归测试通过；`backend` 全量 unittest 87 tests OK；`frontend` `npm run test` 11 tests passed；`frontend` `npm run build` 通过，9 个静态路由生成成功。
- 复查：`git diff --check` 退出正常，仅输出既有 LF/CRLF 归一化警告；本轮未运行安装包回归，原因是未改打包路径、API 或桌面端。

## 2026-07-13 资产缩略图缓存审查启动

- 状态：complete。
- 审查范围：资产 `file_id` 解析、内容/缩略图/文本端点和缓存隔离。
- 已修复：缩略图生成函数改为使用已解析资产的 `file_id` 作为缓存键；不同目录或项目的同名图片不再共享缓存。
- 补充修复：PIL 源图片读取改为上下文管理，避免 Windows 下缩略图生成后遗留文件句柄。
- 回归：新增同名 `preview.png` 的两目录测试，验证返回不同缓存文件和不同图片内容。
- 测试：首次定向测试发现直接调用 FastAPI 路由默认 `Query` 值不适用于单元测试且暴露 PIL 文件锁；保持原有 FastAPI 参数校验，测试改为传入显式尺寸，代码仅修复缓存键与文件句柄。
- 验证通过：后端 unittest 88 tests OK；前端 `npm run test` 11 tests passed。
- ADR 门禁：既有缓存键修复，不引入新架构、API、schema 或依赖，无需新增 ADR。

## 2026-07-13 AI Provider 网络边界审查

- 状态：complete。
- 审查范围：Provider 创建/更新、连通性测试和 AI 草稿真实调用的地址、超时和错误传播。
- 已修复：统一拒绝非 HTTP(S) 或无主机名地址；AI 草稿的 `HTTPError` 仅返回 `api_error: <状态码>`，不再回显远端正文。
- 验证通过：Provider/知识定向回归 26 项、后端全量 unittest 88 项均通过；`git diff --check` 正常，仅有既有 LF/CRLF 归一化提示。
- ADR 门禁：既有输入/错误边界修复，不引入新架构、API、schema 或依赖，无需新增 ADR。

## 2026-07-13 AI Provider 系统凭据存储

- 状态：complete。
- 实现：新增 `backend/app/services/provider_credentials.py`，通过 Windows Credential Manager 保存密钥；SQLite 的 `key_reference` 仅为 `wincred:<provider_id>` 引用。
- 调用链：新建/更新保存系统凭据；清空/删除清理凭据；连接测试与 AI 草稿解析引用。旧明文只会在系统写入成功后迁移，失败时仍可按旧路径使用。
- ADR 门禁：这是既有 API 规范“OS 托管密钥”的落实，未新增 API、schema、依赖或运行时架构，因此无需新增 ADR。
- 验证：定向 Provider/知识回归 27 项、后端全量 unittest 89 项通过；已用临时凭据完成真实 Windows Credential Manager 写入、读取、清理往返验证。

## 2026-07-13 Provider 凭据迁移与发布检查点

- 状态：in_progress。
- 用户确认顺序：先主动迁移旧明文 Provider 密钥，再提交/推送并核验 GitHub CI，最后仅在已有配置和数据授权明确时做真实 AI 草稿验证。
- 发布前置已确认：`gh 2.96.0` 已登录 `Moses990`，令牌具备 `repo` 与 `workflow` 权限；当前工作树的代码与计划文件变更均为本轮审查产生。
- 主动迁移：已对当前本地运行库执行迁移，结果 `migrated=0`、`retained=0`、`managed=0`、`legacy=0`；未读取或输出任何密钥。
- 自动验证：后端 unittest 90 项、前端 vitest 11 项、前端生产构建（9 路由）和桌面 `cargo check` 均通过。前端构建仍仅报告既有 `output: export` 下 rewrites 不生效提示。
- 提交前审查：已检查暂存差异、参数化 SQL、密钥格式、运行产物卫生与 Credential Manager 调用链；未发现 critical/high 问题。ADR 门禁引用 `docs/architecture/07_Backend_Architecture.md` 的 Windows Credential Manager 决策、`08_API_Specification.md` 的脱敏 API 要求和 `05_Database.md` 的 `key_reference` 定义，本轮为既有规范落实，无需新增 ADR。
- 发布：提交 `9a732b5` 已推送至 `agent/provider-security-hardening`；草稿 PR #4 已创建。GitHub Actions run #9 已成功，后端测试、前端 install/build/test 和 WebView2 准备步骤均成功。
- 下一阶段：真实 Provider 验证因本地运行库无已配置 Provider 而阻塞；需要用户配置可用服务并明确授权向其发送选定资料摘录。验证只创建 AI 草稿，不确认写入 `project.json`。
- 授权检查：用户已明确允许发送选定资料摘要；但当前运行库的 Provider 数与项目数均为 0。首次只读查询误用了不存在的 `projects.updated_at`，未写入数据；改读实际表结构后确认可用字段为 `last_updated_at`。仍需用户在 AI Center 配置可用 Provider，并导入或选择待验证项目。
- 真实验证准备：用户已配置并允许使用 `agens / agnes-2.0-flash`，三份指定纪要均精确属于桌面运行库的“02_需求资料”项目；Provider 连接复验成功。发现该项目已有一个 2026-07-10 的 active manual draft；现有创建逻辑会把它自动标记为 discarded，因此暂停在外发资料前，等待用户明确决定是否替换该草稿。
- 首次真实请求：用户确认替换后，三份纪要已提取为 ready，但 `agnes-2.0-flash` 在现有 `max_tokens=2000` 下只返回推理内容并以 `finish_reason=length` 结束，未创建新草稿、未替换旧草稿。无资料的 4096-token 探针正常返回 JSON，确认是共享输出上限不足；准备将上限调整为 4096 并补回归断言。
- 真实验证完成：默认输出预算调整为 4096，新增请求载荷回归断言；同一三份用户授权资料的真实请求成功生成 AI 草稿，Provider/模型审计信息已记录。用户确认替换后，旧 manual draft 已标记为 discarded；生成流程未调用确认写入，`project.json` 保持不变。
- 验收边界：本轮确认的是外部 Provider 连通性、资料选择、草稿生成和不写回门禁；草稿内容仍应由用户在项目 AI 页面人工复核后，才决定是否执行“确认写入”。
- 确认写入复核：用户已在桌面端确认写入。运行库显示草稿状态为 `applied`；成功历史记录对应同一草稿，`project.json` 备份存在。摘要、核心需求、特殊要求、风险、经验、标签和证据均与草稿一致，schema 版本和 SQLite 索引同步检查通过。

## 2026-07-13 项目知识布局适配修复

- 修复：应用壳的主内容列从 `1fr` 改为 `minmax(0, 1fr)`，防止长项目知识内容撑开固定侧栏后的可用宽度并触发页面横向滚动。
- 验证：前端 11 项测试、生产静态构建通过；使用真实已确认项目知识在 1280px 与 768px 视口复核，主区域、详情页和知识卡片的滚动宽度均未超过可用宽度，来源展开交互正常。

## 2026-07-13 Phase 21 启动：最新 Beta 发布与增量扫描收口

- 用户确认按顺序执行：最新安装包验收、PR #4 审查/合并、增量扫描优化。
- 当前基线：分支 `agent/provider-security-hardening` 位于 `489828d`，工作树干净；PR #4 无审查或未解决线程，历史 CI 已通过。
- 初步调用链发现：`backend/app/watcher/processor.py` 已聚合 Watcher 事件，却调用 `scan_project_incremental(project_path, db_path)` 而未传入 `changed_paths`，因此已知变更仍走全项目对账分支；下一步将先补回归再做最小参数传递修复。
- 阶段 1 验收：从 `489828d` 构建 `Project Vault_2.0.0-beta.1_x64-setup.exe`，SHA256 `8893612860AB75F6DCA533E1DCFEE695CAF7FD0670B7B68FCF6A1D60409D524B`；`scripts/verify_local_installed_usage.ps1` 在 `release-validation/v2.0.0-beta.1-20260713/` 生成报告，33/33 步通过。后端全量 90 项、前端 11 项测试通过；`git diff --check` 仅有既有 LF/CRLF 提示，高风险 release-validation 跟踪路径检查无命中。
- 阶段 2 完成：PR #4 已更新为实际验证状态并在最新 CI 通过后合并到 `main`；合并提交 `ba14023b1c5aa1c3e3188f38cfa8f4eef75b996d`。首次 CI 在 WebView2 准备步骤无进展，取消后重跑成功；重跑完整覆盖 WebView2、后端、前端安装/构建/测试。
- 阶段 3 实现：Watcher 现在按项目收集事件路径，并将新增、修改、删除以及移动的旧/新路径传给既有 `changed_paths` 快路径；冷却窗口改为延迟而非丢弃已收集事件。新增 `test_watcher_processor.py`，覆盖中文相对路径与新增、修改、删除、移动、冷却窗口内连续变更。定向 14 项、后端全量 92 项通过；提交 `2195bdc` 已推送至 `fix/watcher-changed-paths`，等待远端 CI。
