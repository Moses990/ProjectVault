# 08_API_Specification.md
**项目名称**：Project Vault V1.0
**文档状态**：V1.1 Frozen
**审查状态**：Approved with Minor Revisions
**架构基调**：RESTful, Local-First, Async, High Performance
**核心约束**：无代码实现，纯接口契约设计

## 1. API Design Principles
Project Vault 的接口设计秉持以下原则：

- **RESTful 规范**：使用标准的 HTTP 动作（`GET`, `POST`, `PUT`, `DELETE`），路径设计贴合对象层次。
- **统一前缀**：所有业务路由均挂载在 `/api/v1/` 根路径下。
- **版本控制请求头**：所有 API 响应强制携带 `X-API-Version: 1.0.0` 响应头，以便未来 V2/V3 版本的兼容路由分发与前端调试。
- **无状态与幂等性**：API 层不保留用户操作状态，状态由客户端及本地 SQLite 维护。
- **环境隔离**：区分纯数据 CRUD 与底层系统交互（如打开本地资源管理器），系统级操作放入独立的域。

## 2. Response Standards
所有 API 响应（无论是成功还是错误），均被严格包裹在标准数据结构（Standardized Envelope）中，统一包含以下字段，以降低前端容错解析成本并增强日志追踪能力：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| status | String | 请求状态，枚举值：success, error, warning。 |
| data | Object / Array | 实际承载的业务数据有效载荷（Payload）。如果请求失败，通常为 null。 |
| message | String | 面向开发者或终端用户的提示信息（如 "项目扫描成功"）。 |
| meta | Object | 标准化元数据结构。严格固定包含 { page, limit, total, duration_ms }，禁止各接口随意自定义。 |
| request_id | String | 请求唯一标识。由后端网关层生成（如 UUID），用于错误定位、日志追踪与用户反馈排查。 |

## 3. Error Standards
在 FastAPI 网关层注册全局异常捕获器，将底层文件权限、数据库锁定等异常转化为前端友好的标准 HTTP 错误码。

- **400 Bad Request**：前端传参错误或格式校验失败。
- **404 Not Found**：请求的项目、文件或图纸 ID 不存在。
- **409 Conflict**：业务逻辑冲突（例如重复扫描正在进行中）。
- **500 Internal Server Error**：底层 SQLite 锁定、文件系统 I/O 错误或 Python 引擎崩溃。
- **Graceful Degradation**：非关键模块（如 AI 接口超时）出错时，不阻断核心数据返回，状态标为 `warning`。

## 4. Authentication Strategy
鉴于 Project Vault V1.0 是纯本地运行的工具软件：

- **Localhost Binding**：FastAPI 服务默认仅绑定 `127.0.0.1`，拒绝局域网访问，系统本身不设用户注册登录鉴权。
- **Provider Security**：AI 提供商的 API Key 绝对不会以明文通过 API 暴露给前端。前端提交凭据后，后端通过系统安全管道（如 Windows Credential Manager）托管，接口仅返回脱敏状态。

## 5. Dashboard APIs

### 5.1 获取系统核心统计

- **Endpoint:**`/api/v1/dashboard/metrics`
- **HTTP Method:**`GET`
- **Purpose:** 获取项目总数、CAD 总数、材料总数等看板指标。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ project_total: int, cad_total: int, material_total: int }`
- **Error Conditions:** 500 (数据库连接异常)

### 5.2 获取近期更新项目

- **Endpoint:**`/api/v1/dashboard/recent-projects`
- **HTTP Method:**`GET`
- **Purpose:** 获取最近扫描或文件内容有变更的项目列表，支撑首页高频访问区。
- **Query Parameters:**`limit` (默认 10)
- **Request Body:** 无
- **Response Schema:**`data`: `[{ id, name, phase, last_updated_at, file_count }]`
- **Error Conditions:** 无

## 6. Projects APIs

### 6.1 获取项目大盘列表

- **Endpoint:**`/api/v1/projects`
- **HTTP Method:**`GET`
- **Purpose:** 获取跨项目的高密度列表，支持多条件全局检索与细粒度筛选。
- **Query Parameters:** * `q` (可选，项目名称或关键字搜索)
  - `type` (可选，项目类型如 Retail)
  - `phase` (可选，阶段筛选)
  - `page`, `limit`
  - `sort_by` (如 last_updated_at), `order` (asc/desc)
- **Request Body:** 无
- **Response Schema:**`data`: `[{ id, name, type, phase, file_count, is_favorite, ... }]`, `meta`: `{ page, limit, total, duration_ms }`
- **Error Conditions:** 400 (无效的排序或筛选字段)

### 6.2 切换项目收藏状态

- **Endpoint:**`/api/v1/projects/{id}/favorite`
- **HTTP Method:**`POST`
- **Purpose:** 乐观更新：将目标项目加入或移出收藏夹。
- **Query Parameters:** 无
- **Request Body:**`{ is_favorite: boolean }`
- **Response Schema:**`data`: `{ id, is_favorite }`
- **Error Conditions:** 404 (项目不存在)

### 6.3 获取候选项目列表

- **Endpoint:**`/api/v1/projects/candidates`
- **HTTP Method:**`GET`
- **Purpose:** 扫描用户配置的根目录第一层子文件夹，返回尚未包含 `project.json` 的普通文件夹，供用户批量初始化。
- **Query Parameters:**`root_path` (可选，不传时使用系统设置)
- **Request Body:** 无
- **Response Schema:**`data`: `[{ folder_name, absolute_path, created_at, estimated_files }]`
- **Error Conditions:** 400 (根目录非法), 403 (无读取权限)

### 6.4 批量初始化项目

- **Endpoint:**`/api/v1/projects/initialize`
- **HTTP Method:**`POST`
- **Purpose:** 将用户选中的普通文件夹转换为标准 Vault 项目：写入默认 `project.json`，生成 `project_id`，并触发首次扫描。
- **Query Parameters:** 无
- **Request Body:**`{ paths: string[], default_tags?: string[] }`
- **Response Schema:**`data`: `{ initialized_count, project_ids: string[], skipped: [{ path, reason }] }`
- **Error Conditions:** 400 (路径非法或已存在 project.json), 403 (无写入权限)

## 7. Project Detail APIs

### 7.1 获取项目基础信息 (Overview)

- **Endpoint:**`/api/v1/projects/{id}/overview`
- **HTTP Method:**`GET`
- **Purpose:** 获取项目详情页概览 Tab 所需的基本信息与统计。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ id, name, path, phase, manager, tags, summary, status }`
- **Error Conditions:** 404 (项目不存在)

### 7.2 获取项目 AI 元数据 (AI Tab)

- **Endpoint:**`/api/v1/projects/{id}/ai-metadata`
- **HTTP Method:**`GET`
- **Purpose:** 从展平的 `ai_metadata` 表提取项目的需求、特殊要求、风险与经验总结。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ summary, core_needs: [], special_reqs: [], risks: [], lessons: [] }`
- **Error Conditions:** 404 (未找到元数据)

## 8. Files APIs

### 8.1 获取项目文件树结构

- **Endpoint:**`/api/v1/projects/{id}/files`
- **HTTP Method:**`GET`
- **Purpose:** 支撑 Files Tab 的虚拟化渲染表格，支持基于目录、扩展名的高效过滤。
- **Query Parameters:** * `directory` (可选，获取特定层级文件)
  - `extension` (可选，按扩展名如 `.pdf` 筛选)
  - `sort_by` (可选，支持 `name`, `size`, `modified`)
  - `order` (可选，`asc` / `desc`)
  - `page`, `limit`
- **Request Body:** 无
- **Response Schema:**`data`: `[{ id, file_name, relative_path, extension, size_bytes, last_modified }]`
- **Error Conditions:** 404 (项目不包含文件)

### 8.2 呼出本地资源管理器

- **Endpoint:**`/api/v1/system/explorer/open`
- **HTTP Method:**`POST`
- **Purpose:** 驱动前端的 Open / Reveal 行为。后端通过 `file_id` 解析受管项目内文件，再调用系统底层 API 打开文件或定位所在目录。
- **Query Parameters:** 无
- **Request Body:**`{ file_id: string, mode: "open_file" | "reveal_folder" }`
- **Response Schema:**`data`: `{ success: boolean, file_id: string, mode: string }`
- **Error Conditions:** 400 (mode非法), 403 (路径不在受管项目根目录内), 404 (文件记录或物理文件不存在), 500 (系统打开能力不可用)

### 8.3 获取文件缩略图

- **Endpoint:**`/api/v1/assets/{file_id}/thumbnail`
- **HTTP Method:**`GET`
- **Purpose:** 根据文件 ID 返回后端预生成的 `.webp` 或 `.jpg` 缩略图二进制流，供 Materials、Files 与搜索结果渲染。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Headers:**`Content-Type: image/webp`, `Cache-Control: public, max-age=31536000`
- **Response Body:** Binary Image Data
- **Error Conditions:** 404 (文件不存在或缩略图尚未生成)

### 8.4 获取原始文件流

- **Endpoint:**`/api/v1/assets/{file_id}/content`
- **HTTP Method:**`GET`
- **Purpose:** 返回受管文件的原始二进制流，用于图片、PDF、视频或 Office 预览。前端不得直接读取本地绝对路径。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Headers:**`Content-Type` 根据实际 MIME 动态返回
- **Response Body:** Binary File Data
- **Error Conditions:** 404 (物理文件不存在), 403 (路径不在受管根目录内)

## 9. Drawings APIs

### 9.1 获取项目内 CAD 图纸

- **Endpoint:**`/api/v1/projects/{id}/drawings`
- **HTTP Method:**`GET`
- **Purpose:** 获取项目详情内 Drawings Tab 的分类图纸列表。
- **Query Parameters:**`category` (如 平面图, 立面图)
- **Request Body:** 无
- **Response Schema:**`data`: `[{ id, file_name, dwg_category, version_group, is_current }]`
- **Error Conditions:** 无

### 9.2 获取独立图纸版本链 (Version Chain)

- **Endpoint:**`/api/v1/drawings/{id}/versions`
- **HTTP Method:**`GET`
- **Purpose:** 提供 CAD Center 右侧 Version Chain 面板的独立高效加载接口。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ drawing_id: string, version_chain: [{ id, file_name, version_number, last_modified, is_current }] }`
- **Error Conditions:** 404 (图纸不存在)

### 9.3 CAD Center 跨项目汇总

- **Endpoint:**`/api/v1/drawings/center`
- **HTTP Method:**`GET`
- **Purpose:** 跨项目提取最新修改的图纸与全局追踪信息。
- **Query Parameters:**`page`, `limit`, `sort_by`
- **Request Body:** 无
- **Response Schema:**`data`: `[{ drawing_id, project_name, file_name, last_modified }]`
- **Error Conditions:** 无

## 10. Search APIs

### 10.1 Command Palette 全局检索 (Ctrl+K)

- **Endpoint:**`/api/v1/search`
- **HTTP Method:**`GET`
- **Purpose:** 对接 FTS5 提供极速全文检索，前端执行防抖查询。
- **Query Parameters:**`q` (必填), `limit`, `category` (可选，Projects/Files/CAD/Materials)
- **Request Body:** 无
- **Response Schema:**`data`: `[{ entity_id, entity_type, title, project_id, highlighted_content, score }]`
- **Error Conditions:** 400 (搜索词为空)

### 10.2 获取近期搜索记录 (Recent)

- **Endpoint:**`/api/v1/search/recent`
- **HTTP Method:**`GET`
- **Purpose:** 获取用户的近期检索历史，支撑 Ctrl+K 唤出后的 RECENT 区域渲染。
- **Query Parameters:**`limit` (默认 5)
- **Request Body:** 无
- **Response Schema:**`data`: `[{ id, query_text, searched_at }]`
- **Error Conditions:** 无

## 11. AI Provider APIs

### 11.1 获取模型服务商列表

- **Endpoint:**`/api/v1/ai/providers`
- **HTTP Method:**`GET`
- **Purpose:** 动态渲染 AI Center 列表。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `[{ id, name, base_url, default_model, is_enabled, is_configured }]` (脱敏 API Key)
- **Error Conditions:** 无

### 11.2 创建模型服务商

- **Endpoint:**`/api/v1/ai/providers`
- **HTTP Method:**`POST`
- **Purpose:** UI 层新增自定义 Provider 实例。
- **Query Parameters:** 无
- **Request Body:**`{ name: string, base_url: string, default_model: string, api_key: string (可选) }`
- **Response Schema:**`data`: `{ id, is_configured: true }`
- **Error Conditions:** 400 (必填参数缺失)

### 11.3 更新配置

- **Endpoint:**`/api/v1/ai/providers/{id}`
- **HTTP Method:**`PUT`
- **Purpose:** 更新指定 Provider 的 API Key 及基础配置，交由 OS 托管加密。
- **Query Parameters:** 无
- **Request Body:**`{ base_url: string, default_model: string, api_key: string (可选), is_enabled: boolean }`
- **Response Schema:**`data`: `{ id, is_configured: true }`
- **Error Conditions:** 400, 404

### 11.4 删除模型服务商

- **Endpoint:**`/api/v1/ai/providers/{id}`
- **HTTP Method:**`DELETE`
- **Purpose:** 移除用户自行创建的 Custom Provider 及其底层安全凭据。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ success: true }`
- **Error Conditions:** 404 (Provider 不存在)

### 11.5 测试连通性

- **Endpoint:**`/api/v1/ai/providers/{id}/test-connection`
- **HTTP Method:**`POST`
- **Purpose:** 发送极简 Prompt 确认网络与 Key 是否可用。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ status: "Connected" | "Error", latency_ms: int }`
- **Error Conditions:** 500

## 12. System Health & Settings APIs

### 12.1 检查系统核心健康度

- **Endpoint:**`/api/v1/system/health`
- **HTTP Method:**`GET`
- **Purpose:** 提供给 Settings 诊断页及未来 Agent 调用的统一健康检查心跳。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ database: "ok", watcher: "ok", scanner: "ok", ai_provider: "ok" }`
- **Error Conditions:** 500 (某一核心服务宕机则返回对应错误状态)

### 12.2 获取/更新全局设置

- **Endpoint:**`/api/v1/settings`
- **HTTP Method:**`GET` / `PUT`
- **Purpose:** 持久化动态配置参数（如扫描间隔、项目根路径）。
- **Query Parameters:** 无
- **Request Body (PUT):**`{ root_path: string, scan_interval: int, theme: string }`
- **Response Schema:**`data`: `{ root_path, scan_interval, theme, ... }`
- **Error Conditions:** 400 (无效路径)

## 13. Scanner APIs

### 13.1 获取后台扫描状态轮询

- **Endpoint:**`/api/v1/scanner/status`
- **HTTP Method:**`GET`
- **Purpose:** 获取后台全局单例状态机的运行进度、队列详情。
- **Query Parameters:** 无
- **Request Body:** 无
- **Response Schema:**`data`: `{ status: "IDLE"|"SCANNING", progress: float, queue_length: int, pending_projects: int, current_project: string, current_file: string }`
- **Error Conditions:** 无

### 13.2 触发项目单点扫描 (增量)

- **Endpoint:**`/api/v1/scanner/scan`
- **HTTP Method:**`POST`
- **Purpose:** 针对指定项目强制触发增量扫描计算。
- **Query Parameters:** 无
- **Request Body:**`{ project_id: string }`
- **Response Schema:**`status`: `"success"`, `message`: `"已加入扫描队列"`
- **Error Conditions:** 404 (项目不存在)

### 13.3 重建全局索引 (Rebuild)

- **Endpoint:**`/api/v1/scanner/rebuild`
- **HTTP Method:**`POST`
- **Purpose:** 触发系统级核心指令：清空 SQLite 业务表，重新发起全量深度遍历。
- **Query Parameters:** 无
- **Request Body:**`{ confirm: boolean }`
- **Response Schema:**`data`: `{ task_id: string }`
- **Error Conditions:** 409 (已有任务运行)

## 14. History APIs

### 14.1 获取系统审计日志

- **Endpoint:**`/api/v1/history`
- **HTTP Method:**`GET`
- **Purpose:** 获取 `scan_history` 记录，渲染活动时间线。
- **Query Parameters:**`page`, `limit`, `project_id` (可选)
- **Request Body:** 无
- **Response Schema:**`data`: `[{ id, event_type, status, message, created_at, duration_ms }]`
- **Error Conditions:** 无

## 15. Maintenance & Backup APIs

### 15.1 手动执行数据库维护

- **Endpoint:**`/api/v1/system/maintenance/run`
- **HTTP Method:**`POST`
- **Purpose:** 清理 `scan_history` 保留期外记录并执行 `PRAGMA incremental_vacuum`。
- **Request Body:**`{ now?: string }`
- **Response Schema:**`data`: `{ deleted_count: int, incremental_vacuum: boolean, normal_retention_days: 30, problem_retention_days: 180 }`
- **Error Conditions:** 500 (SQLite维护失败)

### 15.2 创建数据库备份

- **Endpoint:**`/api/v1/system/backup/create`
- **HTTP Method:**`POST`
- **Purpose:** 将 SQLite 缓存库备份到数据库目录下的 `backups/`，保留最近 10 份。
- **Request Body:** 无
- **Response Schema:**`data`: `{ name: string, size_bytes: int, retention_count: 10 }`
- **Error Conditions:** 500 (备份失败)

### 15.3 恢复数据库备份

- **Endpoint:**`/api/v1/system/backup/restore`
- **HTTP Method:**`POST`
- **Purpose:** 用指定备份替换 SQLite 缓存库；不修改项目业务文件与 `project.json`。
- **Request Body:**`{ name: string, confirm: boolean }`
- **Response Schema:**`data`: `{ restored: boolean, name: string }`
- **Error Conditions:** 400 (未确认或备份名非法), 404 (备份不存在)

## 16. Future Reserved APIs
为 V2 扩展留下架构接口空间：

- **AI Agent Workflows**：`POST /api/v1/agent/run` (多步骤推理与任务派发)
- **Vector Database (RAG)**：`POST /api/v1/search/semantic` (对接本地 FAISS / Chroma)
- **WebSocket Bridge**：`WS /ws/v1/scanner` (预留全双工硬实时推送通道)
