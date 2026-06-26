# 07_Backend_Architecture.md
**项目名称**：Project Vault V1.0
**文档状态**：V1.1 Frozen
**审查状态**：Approved with Minor Revisions
**架构基调**：Local-First, High Performance, Asynchronous, Stateless, Event-Driven
**核心约束**：无代码实现，纯架构级说明

## 1. Architecture Principles
Project Vault 的后端架构秉持“本地优先、极速响应”的核心理念，所有技术决策均围绕极简与高效展开。

- **Source of Truth 隔离**：后端绝不将 SQLite 作为业务主数据库，所有关键变更必须优先写入本地磁盘的 `project.json`，随后再同步至 SQLite。
- **Asynchronous First**：全面采用异步 I/O 设计。无论是本地文件系统遍历、数据库读写还是 AI 接口请求，均不得阻塞主线程。
- **Disposable Database**：遵循“抛弃即重建”理念，后端不引入复杂的 ORM 和迁移脚本工具链，维持底层的绝对轻量化。
- **Decoupled Components**：扫描器、监控器、接口服务与后台任务相互解耦，通过内部事件总线或队列进行通信。

## 2. Backend Directory Structure
后端采用基于领域驱动的模块化目录划分，确保各组件职责单一，方便未来扩展。

| 目录/模块 | 核心职责与说明 |
| --- | --- |
| app/api/ | FastAPI 路由网关层，按业务领域（Projects, Files, Search 等）划分路由控制器。 |
| app/core/ | 核心全局配置，包含依赖注入、生命周期管理、中间件与安全配置。 |
| app/db/ | SQLite 数据库连接池、轻量级查询构造器与 FTS5 虚拟表管理机制。 |
| app/repositories/ | 数据访问抽象层，封装所有面向 SQLite 的 SQL 读写操作。 |
| app/services/ | 业务逻辑处理层，处理前端发来的 CRUD 与状态变更请求。 |
| app/engine/ | 核心引擎区，包含 Scanner、File Watcher、CAD Analyzer。 |
| app/ai/ | AI 管道区，包含 Provider 抽象层与 Metadata Extractor。 |
| app/workers/ | 异步后台任务调度与队列管理。 |

## 3. FastAPI Architecture
FastAPI 充当了本地系统与前端展示层之间的桥梁。

- **Dependency Injection**：全面利用 FastAPI 的 `Depends` 机制，将数据库会话、配置实例和鉴权服务注入到路由中，保证服务层的无状态性。
- **Lifespan Management**：利用 FastAPI 的 lifespan context manager 在应用启动时执行数据库 Schema 检查、启动 File Watcher 守护线程，并在关闭时优雅释放 SQLite 连接池。
- **Middleware Strategy**：挂载跨域资源共享（CORS）中间件以支持本地前端端口调用；挂载耗时统计中间件（Timing Middleware）用于拦截并记录慢查询。

## 4. Scanner Engine & Scan Lifecycle (重点：增量扫描与状态机)
扫描引擎是系统的“心脏”，负责将本地物理文件系统映射为高速缓存。

- **Scan Lifecycle (扫描状态机)**：为避免重复扫描、同时扫描或中断导致的数据混乱，引入严格的生命周期管理 。全量扫描状态被严密划分为 `IDLE`, `PENDING`, `SCANNING`, `PAUSED`, `FAILED`, `COMPLETED`。系统同一时间仅允许执行一个 Full Scan 。
- **Project Health Status**：在扫描和解析过程中，为每个项目评估健康度。`projects` 表增加 `health_status` 字段，提供 `healthy`, `warning`, `error`（如 project.json 解析失败）的枚举，以供 Dashboard 和 Project Detail 统一展示 。
- **Incremental Scan**：日常运行的核心。利用轻量级 Hash 比对，仅针对发生变化的节点触发解析与入库。
- **Concurrency Limits**：设定严格的并发信号量（Semaphore），防止在万级文件吞吐时耗尽系统文件句柄（File Descriptors）。

## 5. File Watcher
提供毫秒级的本地文件变更感知能力。

- **OS-Level Event Polling**：通过跨平台的文件系统事件监控库（如 Python watchdog），监听本地目录增删改移事件。
- **Debouncing (防抖机制)**：当用户执行批量复制或解压时，Watcher 会在内存中维持缓冲窗口（如 2000ms），合并同一文件的连续修改。

## 6. Metadata Extractor
专门负责读写与解析 `project.json`。

- **Read-First Parser**：流式读取本地 JSON，将其结构化并展平后写入 SQLite。
- **Write-Back Mutator**：产生新标签或摘要时，先写入临时文件，再执行原子重命名（Atomic Rename）覆盖原 `project.json`，确保断电不丢失。

## 7. CAD Analyzer
针对图纸文件的专业分析管道。

- **Regex Grouping**：利用正则表达式和预设字典识别图纸 `dwg_category`（如平面图、天花图）。
- **Version Chain Recognition**：通过文件名末尾标识（如 v1, v2, _final）提取 `version_group` 与 `version_number`，自动建立版本演进树。

## 8. AI Pipeline & Job Queue
处理大语言模型调用的工作流与任务派发。

- **AI Task Status (任务队列状态)**：AI 调用由于高延迟必须后台执行 。系统新增 `ai_jobs` 表用于管理 AI 摘要、标签提取、风险识别等任务 。任务状态机包含 `queued`, `running`, `retrying`, `completed`, `failed`, `cancelled`，确保失败重试和任务可控 。
- **Prompt Formatting**：系统预设标准化 Prompt 模板，调用前自动序列化项目信息或图纸结构作为上下文注入。

## 9. AI Provider Architecture (重点：Provider抽象层)
为了应对模型演进，后端对 AI 服务商实施严格抽象。

- **Interface Segregation**：定义 `BaseAIProvider` 抽象基类，包含标准虚方法。
- **Concrete Implementations**：基于基类分别实现驱动类（如 `OpenAIProvider`, `AnthropicProvider`, `CustomOpenAIProvider`）。
- **Factory Pattern**：运行时动态实例化驱动类，业务层完全不感知底层 API 差异。

## 10. SQLite Access & Repository Layer
追求极致查询速度与高可维护性的数据访问层。

- **Repository Pattern (仓储模式)**：彻底隔离底层数据库调用。新增 `ProjectRepository`, `FileRepository`, `DrawingRepository`, `MaterialRepository`, `AIRepository`, `SettingsRepository` 模块 。所有数据库访问必须经过 Repository，严禁在 api、services、scanner 或 ai 逻辑中直接散落 `cursor.execute(...)` 形式的原生 SQL，从而降低 Schema 变更和测试难度 。
- **WAL Tuning**：启动时通过 PRAGMA 开启 WAL 模式、调整缓存池并启用外键约束。

**Dynamic Path Resolution (动态路径解析策略)**：

- Repository 对外提供文件物理路径时，必须在内存中由 `projects.project_path` 与 `files.relative_path` 动态组合。
- 拼接必须使用 `pathlib.Path` 或 `os.path.join`，禁止硬编码反斜杠或字符串拼接。
- 当扫描器发现相同 `project_id` 对应的新物理根目录时，只更新 `projects.project_path`，所有文件、图纸、材料记录保持不变。

## 11. Search Engine (重点：FTS5搜索架构与Ranking Strategy)
驱动全局搜索面板 (Command Palette) 的极速中枢。

- **Trigger-Based Sync**：挂载数据库 Trigger，实现业务表数据向 FTS5 `FTS_Global` 虚拟表的无感知同步。
- **Ranking Strategy (加权排序策略)**：基于 FTS5 的 `bm25` 评分进行专业级权重调优，以大幅提高搜索结果质量 。权重分布：`Project Name` (×10)、`File Name` (×8)、`Drawing Name` (×8)、`Tags` (×6)、`Summary` (×4)、`Path` (×2) 。

## 12. Background Task System (重点：Background Task架构)
处理非实时响应的计算密集任务。

- **In-Memory Queue**：使用 Python 异步队列（如 Asyncio Queue）在内存中低耗管理任务，规避对外部 Redis 的依赖。
- **State Broadcasting**：后台任务更新单例状态，提供轮询接口以便前端渲染全局进度与文件处理数。

## 13. System Event Bus (系统事件总线)
实现系统深层解耦的消息中枢。

- **Internal Event Bus**：破除当前 Watcher、Scanner 与 AI 模块之间的紧耦合链条 。
- **Event Flow**：设计标准事件如 `ProjectCreated`, `ProjectUpdated`, `FileCreated`, `FileDeleted`, `AISummaryGenerated`, `ScanCompleted`。形成单向流动链条：Watcher $\rightarrow$ Event Bus $\rightarrow$ Scanner $\rightarrow$ AI Pipeline $\rightarrow$ Search Index，有效降低模块耦合度 。

## 14. File Preview Architecture (文件预览架构)
为高频多媒体与办公文件打造本地预览能力。

- **Preview Service**：引入预览生成服务，弥补材料册和图片的视觉检索体验 。
- **Thumbnail Generation**：负责 PDF、图片与 Office 文件的缩略图缓存生成 。
- **Data Output**：向下游输出 `preview_url` 与 `thumbnail_url`，并为 V2 扩展 CAD 渲染预览预留通道 。

**文件分发安全策略**：

- 严禁设计 `GET /api/file?path=C:/...` 这类接收明文路径的接口。
- 前端只能传递系统生成的 `file_id`，后端通过 SQLite 映射到受管文件。
- 返回文件流前必须校验文件仍存在，且动态解析后的绝对路径仍位于当前受管项目根目录下。
- 缩略图与原始内容分别通过 `FileResponse` 或 `StreamingResponse` 输出，并按实际 MIME 设置 `Content-Type`。

## 15. API Design Standards

- **RESTful 规范**：使用标准 HTTP 动作与层次化 URL（如 `GET /api/v1/projects/{id}/drawings`）。
- **Standardized Envelope**：统一返回 `status`, `data`, `message`, `meta` 的标准封套。

## 16. Error Handling Strategy

- **Global Exception Handlers**：在网关层统一捕获底层锁定与权限异常，转化为标准 HTTP 错误。
- **Graceful Degradation**：非关键模块出错时捕获并降级，不阻断系统整体渲染。

## 17. Logging Strategy

- **Tiered Logging**：严格划分日志级别（Debug, Info, Warn, Error）。
- **Audit Logging**：配置更改与系统活动均同步写入 `scan_history` 表。

**Write Degradation (日志写入降级策略)**：

- Full Scan 与 Rebuild Index 期间暂停写入单文件级成功日志。
- 扫描开始与结束时写入聚合日志，记录文件总数、耗时、跳过数与异常数。
- 常规 Watcher 增量监听恢复单文件事件记录，但必须先经过黑名单过滤与事件去重。

## 18. Configuration Management

- **Dynamic Config**：不硬编码扫描频率与模型策略，转为持久化至 `system_settings` 表并动态加载。

## 19. Performance Strategy (重点：双层Hash Diff机制)

- **Hash Diff 机制 (升级版双层机制)**：针对 CAD、PDF 及 500MB~1GB+ 素材册等巨型文件，全量 SHA1/SHA256 计算成本过高，系统重构为极其高效的双层判定机制 。
  - **Metadata Hash (快速判定层)**：在日常扫描中，优先组合文件的 `size`, `mtime`, `relative_path` 生成轻量级 `metadata_hash`。
  - **Content Hash (深度校验层)**：仅当 Metadata Hash 发生变化、强制重建索引或执行人工校验时，系统才进行全文件的底层 Content Hash 提取，兼顾了极速性能与准确度 。

## 20. Security Strategy

- **Provider Security (安全策略升级)**：放弃自定义加密存储，全面借力操作系统级安全凭据服务 。在 Windows 平台优先调用 **Windows Credential Manager** 托管 AI Token 。SQLite 中仅保存对应的 `provider_id` 及 `credential_reference`，坚决禁止落库 `api_key` 或任何形式的 `encrypted_api_key`。
- **Localhost Binding**：服务仅绑定 `127.0.0.1` 杜绝外部窥探。

## 21. Future Expansion Strategy

- **Agent Framework (智能体架构)**：将当前的 AI Pipeline 提升为统一的 Agent Runtime 环境 。未来可在此环境上插拔并行运行 `Planner Agent`, `Metadata Agent`, `CAD Agent`, `Search Agent` 与 `QA Agent`。以便在 V2 阶段直接演进为全自动的项目建档与理解中枢 。
- **Vector Database Extensibility**：预留 FAISS、Chroma 等本地向量检索挂载点，支撑 RAG。
