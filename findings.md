# Project Vault 产品与架构依据记录

## 文档来源

- `docs/product/Project Vault V1.0 产品需求文档（PRD）.md`
- `docs/architecture/05_Database.md`
- `docs/architecture/08_API_Specification.md`
- `docs/architecture/11_Core_Engine_Implementation_Plan.md`
- `docs/architecture/12_Release_Deployment_Plan.md`
- `docs/architecture/13_Development_Roadmap.md.md`

## 产品定位

Project Vault 是面向室内设计 / SI 设计行业的本地项目资产管理系统。核心目标是让用户快速找到任何项目、任何文件、任何历史版本。它不替代资源管理器、网盘或 OA，而是负责项目归档、检索、浏览、统计和资产沉淀。

## V1 范围

必须实现：

- Dashboard
- Projects
- Project Detail
- Search
- CAD Center
- AI Center Provider 管理
- Settings

明确不实现：

- OA、审批、任务管理、甘特图
- 在线 CAD 查看、在线编辑
- AI 聊天、Agent、RAG
- 多人协同、权限系统、云同步

## 架构关键约束

- `project.json` 是业务数据源头。
- SQLite 是索引缓存，不是业务主库。
- 项目必须通过 `project.json` 识别，不能靠目录名猜测。
- 存量项目需要候选发现和批量初始化流程。
- 文件索引必须使用 `relative_path`，唯一约束是 `UNIQUE(project_id, relative_path)`。
- 后端文件流必须通过 `file_id` 映射，不能直接暴露本地绝对路径。
- Watcher 不直接写数据库，只进入事件队列。
- Tauri 需要通过 Sidecar 启动 Python 后端，并处理动态端口和进程退出。

## 当前已完成事实

- 新主工作区已迁移到 `D:\Workflows\ProjectVault`。
- 已建立 `backend / frontend / desktop / database / docs / scripts / prototype` 结构。
- 已创建 FastAPI 健康检查接口。
- 已创建 SQLite 初始表。
- 已创建 Next.js 前端壳。
- 已验证迁移后的后端、前端和数据库可运行。

## 风险清单

- 如果先做 UI 再做扫描器，会导致数据结构反复变动。
- 如果跳过 Tauri Sidecar 验证，后期发布可能返工。
- 如果用绝对路径作为文件唯一性，移动硬盘盘符变化会造成误删除。
- 如果 Watcher 直接写库，临时文件和高频事件会造成数据库膨胀。
- 如果 AI Center 过早扩展到聊天/Agent，会偏离 V1 范围。

## 当前产品推进判断

Phase 0 已完成。下一步最合理的是 Phase 1：桌面侧载链路验证。它是发布架构风险最高的点，必须在扫描器和 UI 深入开发前排除。
## 2026-06-24 Phase 1 发现

- Tauri 开发模式可以作为当前桌面承载链路：`beforeDevCommand` 启动 Next.js，Tauri 窗口加载 `http://127.0.0.1:3000`。
- 后端必须支持动态端口启动；当前通过 `backend/app/run_server.py --port <port>` 实现。
- Windows 下通过 venv `python.exe` 启动 Python 模块时，可能出现包装进程与真实解释器子进程；只杀父进程不足以保证端口释放。
- 解决方式：Tauri 退出时使用 `taskkill /T /F` 清理进程树，同时后端通过 `--parent-pid` 监控桌面父进程，父进程消失后后端自行退出。
- 前端服务端代理 `/api/health` 可支持普通浏览器开发模式；桌面窗口中优先通过 `window.__BACKEND_PORT__` 直接访问动态后端端口。
- `tauri build --debug` 曾成功生成 debug NSIS 安装包；后续新增 Next 构建输出后，直接打包 `.next` 目录会遇到临时/运行文件问题。生产打包不应依赖原始 `.next` 目录，需要后续单独设计静态导出或内置前端服务方案。
## 2026-06-24 Phase 2 发现

- 现有数据库层原本只有一次性 `CREATE TABLE IF NOT EXISTS`，缺少 `schema_migrations`、`PRAGMA user_version`、FTS5 和完整索引。
- SQLite 作为索引缓存的边界继续成立：业务源头仍应是 `project.json`，数据库可删除重建。
- `auto_vacuum=INCREMENTAL` 对新库直接生效；对已有旧库，仅执行 PRAGMA 不够，必须执行一次 `VACUUM` 才会从 `0` 转换为 `2`。
- Windows 测试中，`sqlite3.connect()` 的上下文管理会提交/回滚但不自动关闭连接；测试使用临时目录时需要显式 `close()`，否则临时 `.db` 文件会被占用。
- FTS5 在 `sqlite_master` 中会产生 `fts_global_*` 辅助表，验收时应关注主虚拟表 `fts_global` 存在即可。

## 2026-06-25 文档一致性发现

- `task_plan.md` 的 Phase 0-9 当前状态已与 `progress.md` 的实际阶段记录对齐。
- `task_plan.md` 的 Phase 8 现已补上 `Scanner APIs`，与 `progress.md` 中 Phase 8 的实际交付一致。
- `progress.md` 的 Phase 9 验收记录本身已是正常中文，且其交付内容包括 AI Provider CRUD API、Dashboard、Projects 列表、Project Detail 六 Tab、Settings、AI Center、API 客户端层、暗色主题、Layout/Sidebar/Command Palette、`next.config.ts` rewrites，以及测试和构建验证。
- `task_plan.md` 与 `progress.md` 现已把 Phase 9 的实际交付回写完整，不再只停留在乱码修复层面。
- 本次对照真实代码后，已把 Phase 9 文档描述收敛到现状实现：API 客户端文件实际为 `frontend/lib/api.ts`；Projects 当前为表格列表；AI Center 的 `Test` 目前是结构就绪检查，不是外部网络连通性测试。
- `task_plan.md` 的当前状态需要列出已完成的 Phase 1-6；这次已补齐，当前推进进入 Phase 10。
- Phase 10 开始前，继续沿用最新备份 `task_plan.md.bak.20260625-124827` 和 `progress.md.bak.20260625-124827` 作为回退点。
## 2026-06-24 Phase 3 发现

- 候选发现必须保持轻量，只扫描根目录第一层；否则导入入口会因为深层遍历拖慢界面。
- 候选发现阶段不应写 SQLite，也不应创建 `project.json`；写入动作只能发生在用户确认初始化后。
- 默认 `project.json` 当前包含 `project_id`、`name`、`type`、`phase`、`status`、`manager`、`tags`、`ai`、`schema_version`，足够支撑后续 Scanner 读取。
- Phase 3 初始化只写项目基础记录，不做完整文件索引；文件数量、CAD 数量、材料数量和 scan_history 应由 Phase 4 Full Scanner 负责。
- HTTP 验证会写入当前运行库，因此即使使用临时目录，也需要在验证后清理测试 project_id，避免污染索引缓存。
## 2026-06-24 Phase 4 发现

- Full Scan 更适合作为“可重建索引”流程：以 `project.json` 为源头更新 `projects`，再重建该项目的 `files/drawings/materials` 子索引，能自然保证重复扫描不产生重复记录。
- `files.relative_path` 应统一使用 `/` 分隔的相对路径；这样 Windows 盘符变化不会影响文件唯一性，也方便后续前端和 API 层保持平台无关。
- `project.json` 本身也应作为项目文件进入 `files` 索引；它是项目资料的一部分，并能让全量文件数量与真实目录内容一致。
- 当前 Phase 4 分类只做基础规则：DWG 进入图纸，PDF/Excel/图片/Word 进入材料；更细的 CAD 分类、版本链和准确率目标应留到 CAD Center 阶段继续增强。
- 错误扫描也要写 `scan_history`，即使无法解析 project_id，也可以用空 project_id 记录全局扫描错误，方便 Dashboard/History 后续展示。
## 2026-06-24 Phase 5 发现

- 增量扫描必须先读取有效 `project.json`，再允许删除 SQLite 子索引；否则盘符变化、路径传错或项目暂时离线时会造成缓存灾难。
- 项目迁移判断应以 `project_id` 为准：命中同一个项目但 `project_path` 不同时只更新项目路径，子表继续依赖 `relative_path` 和 `file_id`，无需批量改写。
- 移动文件识别不能使用包含路径的 `file_hash` 直接匹配；Phase 5 采用 size + last_modified 作为轻量内容指纹来判断“同一文件换路径”，从而保留 `files.id`。
- `scan_history` 在测试和界面读取时不能只依赖 SQLite 默认秒级 `CURRENT_TIMESTAMP` 排序；扫描器写入显式 ISO 时间戳更稳定。
- 当前增量扫描仍是 Scanner Engine 主动执行，Watcher 只会在 Phase 6 负责产生事件与防抖，不直接写数据库。
## 2026-06-24 Phase 6 发现

- Watcher 最佳实现应分成两层：`watchdog` 负责 OS 事件监听，自有 watcher 核心负责事件模型、过滤和防抖；这样既能复用成熟库，又能让业务规则稳定可测。
- Watcher 边界必须保持轻量：只把文件系统变化转换为 WatchEvent 入队，不做 project_id 判断、不做删除判定、不写 SQLite。
- 临时文件过滤必须在进入队列前完成，否则 CAD 和 Office 自动保存会让事件队列和 scan_history 被无价值事件撑爆。
- 2 秒防抖应按路径合并，并保留窗口内最后一次事件；这更贴近 CAD/Office 保存时“先 create 后 modify”的真实行为。
- Windows 控制台下 `pip show watchdog` 可能因为作者名包含非 GBK 字符触发 pip/rich 输出日志错误；这不代表包不可用，实际安装和测试导入均成功。

## 2026-06-24 Phase 7 发现

- 数据库文档明确 Phase 7 应采用 Application Managed Sync：Scanner 负责更新 `fts_global`，不采用 SQLite Trigger；这与 SQLite 作为可重建索引缓存的边界一致。
- `fts_global` 作为统一搜索表时，同一个物理 DWG/PDF 文件会同时以 `file` 和 `cad/material` 两类实体进入搜索结果；这符合“结果按 Projects / Files / CAD / Materials 分类”的产品目标，前端后续可按分类分组展示。
- 项目搜索内容不能只放项目名，还必须包含项目 ID、标签和 AI 摘要字段，否则无法满足 Phase 7 验收里的“项目 ID、标签、摘要”搜索。
- FTS5 查询不是普通字符串匹配，带连字符的项目 ID 或文件名如 `project-search` 会被解析为表达式并触发 `no such column`；用户输入需要在服务层转义为短语查询。
- 10,000 文件性能测试不应使用真实项目资料；使用临时目录生成样例项目并扫描入临时 SQLite，可以验证性能目标且不污染真实索引缓存。
- Recent Search 属于产品预留能力，但本阶段没有 `recent_searches` 表和历史 API 交付物要求；应留到 Phase 8 核心 API 或后续 Search UI 阶段统一做持久化策略。

## 2026-06-24 Phase 8 发现

- Phase 8 的核心价值是冻结前端可依赖的数据契约，因此优先补稳定只读数据面和受控操作入口；AI Provider、真实缩略图生成、后台任务队列等不在本阶段交付清单内的能力不应抢跑扩大范围。
- Projects 列表、Files 列表、History、Drawings Center 都需要分页；列表接口必须有排序白名单，不能把前端传入的 `sort_by` 直接拼成任意 SQL 字段。
- 文件资产接口必须只接受 `file_id`。后端解析时应使用 `projects.project_path + files.relative_path` 动态组合物理路径，并校验解析后的路径仍在项目根目录内，避免路径穿越和绝对路径泄露。
- API 返回给前端的文件列表应包含 `relative_path`，但不应包含 `absolute_path`；真正需要读取文件内容时再通过 `/assets/{file_id}/content` 获取受控流。
- 缩略图入口可以先存在但返回 `thumbnail_not_generated` 404；这比伪造路径或返回原文件更符合后续预览服务接入，也不会破坏前端契约。
- Scanner API 在没有后台任务系统前可以先同步触发增量扫描和 FTS 重建，并返回结果；`scanner/status` 保持 IDLE 结构，后续任务队列实现后再把真实进度接入同一契约。
- Settings 写入 `system_settings` 表时要保留 key/value/category 的轻量结构；`root_path` 必须验证路径存在，避免前端保存无效扫描根目录。

## 2026-07-13 V2 知识链路审查发现

- 文本资料读取已限制为 `MAX_SOURCE_BYTES`，但 PDF 提取会把整份文档文本拼接到内存后才截断摘要；两条路径的资源边界不一致。
- AI 草稿入口已在 `generate_knowledge_payload()` 中筛选 ready 来源，并在调用 Provider 前以 `ready_sources_required` 拒绝空来源；本轮复核后无需重复实现。
- 现有确认写入具备草稿 claim、`project.json` 备份、原子写入和失败回滚；本轮不调整该路径。

## 2026-07-13 资产缩略图审查发现

- `GET /assets/{file_id}/thumbnail` 已先按 `file_id` 解析和授权资产，但缓存文件名错误地使用了 `asset_path.stem`；同名图片会共享缓存，返回错误内容。
- 最小修复是把已解析资产的稳定 `file_id` 传入缩略图生成函数作为缓存键；不改缓存位置、图片处理库或 API。
- Windows 复现还表明 `Image.open()` 需要在生成缩略图后关闭源文件；改用上下文管理后，临时图片目录可正常清理。

## 2026-07-13 AI Provider 网络边界审查发现

- `base_url` 之前只检查非空，`file://`、`ftp://` 和无主机名的值都能进入 SQLite；创建、更新、真实测试和草稿调用应共享 HTTP(S) 地址校验。
- AI 草稿调用会把远端 `HTTPError` 的响应正文原样拼入 API 错误；正文可能包含供应商内部信息或用户资料片段，客户端只需获知状态码。
- 设计文档要求密钥交由 OS 托管，但当前 SQLite 仍保存明文 `key_reference`。该项涉及依赖和桌面端打包链路，单列下一阶段处理，不能混入本次无依赖网络修复。

## 2026-07-13 AI Provider 系统凭据存储发现

- Project Vault 的发布目标是 Windows，系统原生 Credential Manager 可用标准库 `ctypes` 调用，避免引入凭据库依赖以及 PyInstaller 动态后端收集风险。
- SQLite 的 `key_reference` 现保存 `wincred:<provider_id>`，真实密钥只由 Credential Manager 持有。新建、轮换、删除、连接测试和 AI 草稿共享同一解析路径。
- 旧 SQLite 的明文值不会被盲目清空：首次实际使用时先写入系统凭据，写入成功才替换为引用；系统写入失败则保持既有请求可用。
- 本地运行库主动迁移统计为 0 个待迁移项；没有输出、复制或提交任何 Provider 密钥。

## 2026-07-13 真实 Provider 草稿验证发现

- 部分兼容 OpenAI 的推理模型会将推理内容和 JSON 正文计入同一 `max_tokens` 预算；2000 tokens 可在未产生可解析正文前以 `length` 结束。
- 将生成预算统一为 4096 后，三份真实 Markdown 来源成功生成可解析草稿；失败请求不会创建草稿或改写已确认项目知识。
- 草稿创建会替换同项目已有 active draft，因此真实验证前必须明确取得用户对替换的同意；本次确认后仅改变草稿状态，未写入 `project.json`。
