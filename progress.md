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
