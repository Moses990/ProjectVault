# 06_Frontend_Architecture.md
**项目名称**：Project Vault V1.0
**文档状态**：V1.1 Frozen
**审查状态**：Approved with Minor Revisions
**架构基调**：Local-First, High Performance, Modular, Scalable
**核心约束**：无代码实现，纯架构级说明
**下一阶段目标**：进入 07_Backend_Architecture.md 设计阶段

### 1. Architecture Principles
Project Vault 的前端架构遵循极速与本地化优先的核心原则，所有技术选型与结构划分均为此服务。

- **URL as the Single Source of Truth**：所有列表过滤、排序、Tab 切换状态必须同步至 URL，确保用户可以随时刷新或复制链接恢复当前视图。
- **Decoupled Local File System**：前端不直接操作本地文件，所有涉及底层文件系统读取、打开目录的操作必须抽象为统一的 API 层调用。
- **Optimistic UI & Instant Feedback**：采用乐观更新策略，用户操作（如收藏、修改配置）在 UI 层瞬间完成反馈，后台异步同步至 SQLite。
- **High Density Render Priority**：面向万级节点的大型项目，DOM 结构必须保持扁平，长列表强制采用虚拟化渲染技术以保障帧率。

### 2. Technology Stack
前端技术栈严格遵循产品需求文档（PRD）定义，引入业界标准的请求与表格处理方案以应对复杂场景。

- **核心框架**：Next.js (App Router 模式)
- **视图层**：React, TypeScript
- **样式方案**：Tailwind CSS
- **基础组件库**：shadcn/ui (无头组件，支持高度定制)
- **图标系统**：Lucide Icons
- **Server State (数据请求)**：TanStack Query (负责 Query Invalidation, Mutation, Optimistic Update)
- **Global State (全局状态)**：Zustand
- **Local State (局部状态)**：React `useState`
- **Table Architecture (表格架构)**：TanStack Table (逻辑层) + TanStack Virtual (虚拟渲染层)

### 3. Project Structure
项目采用基于功能特征的切片式目录设计（Feature-Sliced Design 变体），彻底分离业务逻辑与通用 UI。

- **/app**：Next.js App Router 目录，仅负责页面路由组织与顶级布局。
- **/components**：全局通用组件库（如 Button, Modal, Card 等 Design System 定义组件）。
- **/features**：业务核心模块，按领域驱动划分。
- **/lib**：底层系统级能力抽象。包含 `/logger` (日志策略) 与 `/system` (环境适配器)。
- **/services**：统一 API 请求网关与按域划分的接口集合。
- **/stores**：Zustand 全局状态管理定义（如 Command Palette, Scan Progress）。
- **/types**：跨模块共享的 TypeScript 声明抽象层。

### 4. App Router & Guard Structure
基于 IA 信息架构，前端路由采用扁平化、RESTful 风格的 URL 设计，并引入严格的路由守卫机制。

- **Route Guard Strategy**：系统启动时检查 `root_path` 是否存在及 `database` 是否已初始化。若缺失，强制重定向至 `/setup`；若已完成，则进入 `/`。
- **/setup**：系统首次启动引导流（First Run Setup）。
- **/ (Dashboard)**：默认进入点，系统概览与活动面板。
- **/projects**：跨项目的高密度列表大盘。
- **/projects/[id]**：单项目详情入口。
- **/cad-center**：独立的一级跨项目图纸检索模块。
- **/ai-center**：AI 模型 Provider 配置中心。
- **/settings**：系统级参数配置入口。

### 5. Layout & Theme Architecture
贯彻 Design System 中的包容性视口策略，并为未来开放多主题预留底层架构。

- **Root Layout**：注入全局 Context、Toast 容器及 Command Palette 全局挂载点。
- **Theme Strategy**：保留 `ThemeProvider` 架构。V1 阶段强制锁定为 `Dark` 模式，未来无缝扩展支持 `Light` 与 `System`，避免重构 Layout。
- **Main Layout**：包含固定宽度 240px 的左侧导航栏（Sidebar），以及承载核心业务的主内容区。
- **Content Boundary**：主内容区设定最大宽度 1600px 并居中，两侧留白，避免超大宽屏下的视觉涣散。

### 6. Feature Module Architecture
业务模块遵循高内聚、低耦合原则。为避免后期目录失控，强制固定 Feature 文件夹内部结构规范。

- **标准 Feature 目录结构**：以 `features/projects/` 为例，必须且仅可包含以下子目录：
  - `/components`：当前特征独享的 UI 组件。
  - `/hooks`：特征相关的自定义逻辑封装。
  - `/api`：特征级的数据获取钩子 (结合 TanStack Query)。
  - `/types`：特征独享的接口类型。
  - `/utils`：特征内部使用的工具函数。

### 7. State Management Strategy
明确三层状态管理界限，彻底杜绝状态滥用。

- **Server State (服务端状态)**：由 TanStack Query 接管所有 API 轮询、无限滚动查询（Infinite Query）与后台数据重新获取（Background Refetch）。
- **Global State (全局应用状态)**：由 Zustand 管理。核心设立两个独立 Store：
  - `command-palette.store.ts`：管理 `isOpen`, `query`, `selectedIndex`, `recentSearches`，支撑最高优先级功能。
  - `scan-progress.store.ts`：管理 `status`, `progress`, `currentProject`, `currentFile`，支撑全局扫描反馈。
- **Local State (局部组件状态)**：由 React `useState` 负责，如组件的展开/收起控制。

### 8. API Domain Structure
前端通过统一网关层与本地 FastAPI/SQLite 通信，接口层级必须按业务领域横向拆分，以应对未来超过 50+ 的接口规模。

- **services/projects.api.ts**：项目 CRUD 及概览统计。
- **services/files.api.ts**：文件层级遍历与读取，响应字段使用 `relative_path`，禁止向 UI 暴露裸绝对路径。
- **services/assets.api.ts**：缩略图、原始文件流与预览 URL 拼接。
- **services/drawings.api.ts**：CAD 版本链及解析相关。
- **services/materials.api.ts**：材料库专用接口。
- **services/search.api.ts**：对接 FTS5 全文检索引擎。
- **services/ai.api.ts**：大模型 Provider 与调用接口。
- **services/settings.api.ts**：系统全局配置接口。

### 9. Shared Types Layer
为保证全局类型的一致性与可维护性，`/types` 目录需按领域严格拆分，禁止混合存放。

- **/types/api/**：存放如 `ProjectDTO`, `ApiResponse` 等与后端交互的网络层数据传输对象。
- **/types/database/**：存放如 `Project`, `File`, `Drawing` 等与 SQLite Schema 一一映射的核心数据模型。
- **/types/ui/**：存放如 `ProjectCardProps`, `TableColumnConfig` 等纯前端组件消费的属性类型。

### 10. Table Architecture
针对 Projects、Files、Drawings、Materials 的高密度浏览核心场景，统一实施高性能表格技术栈。

- **TanStack Table**：作为 Headless UI 核心，将表头逻辑、排序算法、Show/Hide Column 等状态逻辑与视觉彻底剥离。
- **TanStack Virtual**：负责长列表的虚拟化渲染，确保单屏加载过万条文件记录时，仅渲染视口节点，保持 60FPS 顺滑滚动。
- **Stateful Columns**：表头显隐与排序配置序列化后存储于浏览器 `localStorage` 或数据库 `system_settings` 表，实现个性化视图记忆。

### 11. Command Palette Architecture
作为全局检索的高速公路，由专用的 `command-palette.store.ts` 驱动。

- **Global Event Listener**：在 Root Layout 挂载底层键盘事件钩子，全局监听 `Ctrl + K`。
- **Debounced Query**：针对用户的连续输入实施防抖（Debounce）处理，缓解本地 FTS5 引擎查询并发压力。
- **High Priority Rendering**：系统分配固定且极高的 Z-Index，确保面板能打断并覆盖任何当前路由或 Modal 弹窗操作。

### 12. Error Handling & Classification
实施以优雅降级为核心的错误隔离与分级响应机制。

- **Recoverable Errors (可恢复错误)**：如网络错误、AI 连接超时、索引响应缓慢。采用 Toast 通知提示用户重试，页面不崩溃。
- **Non-Recoverable Errors (不可恢复错误)**：如数据库损坏、Schema 异常、启动验证失败。触发 Error Boundary 并引导至全屏 Error UI 界面，提供重建系统或查阅日志入口。
- **React Error Boundaries**：在 Layout 层和特征模块外层实施隔离，保证局部崩溃不会蔓延至全局。

### 13. Loading Strategy
响应 Fast 设计原则，摒弃阻塞视线的全屏 Spinner 动画加载机制。

- **Skeleton Screens**：项目级或列表初次挂载时，使用极暗色骨架屏代替传统 Loading。
- **Top Progress Bar**：由 `scan-progress.store.ts` 驱动。在系统后台执行庞大遍历扫描时，于系统顶部挂载 2px 宽度的进度指示线条。
- **Micro-Interactions**：按钮执行 Mutation 时，内部文本转化为微型旋转图标，外部处于防抖禁用状态。

### 14. Frontend Logging Strategy
前端独立构建标准化日志系统，为本地无网络运行环境提供诊断依据。

- **Log Levels**：严格划分为 `info`, `warn`, `error`, `debug` 四个日志级别。
- **V1 阶段落地**：将日志规范化输出至浏览器 Console 控制台，供开发及基础查错使用。
- **V2 阶段预留**：通过 IPC 或 API 将关键级 Frontend Error 同步持久化写入系统底层日志文件，形成完整追踪链路。

### 15. Frontend Performance Strategy

- **Asset Optimization**：杜绝引入大型图表库。UI 仅依赖 CSS 绘制与极简 SVG（Lucide）。
- **Component Memoization**：针对复杂的 CAD 版本链渲染树、庞大的面包屑导航，使用 `React.memo` 隔离渲染。
- **Lazy Loading**：AI Center 配置面板、Settings 深层设置等低频路由实施代码分割（Code Splitting）与按需加载。

### 16. Electron Compatibility & Adapter Layer
为未来打包部署为纯桌面客户端（Electron/Tauri）构建绝对隔离的安全调用边界。

- **System Adapter Layer**：在 `/lib/system/` 下新增适配器模式抽象。业务代码只能调用如 `openFolder()`, `openFile()`, `copyPath()` 等标准接口。
- **Environment Implementations**：底层分别实现 `browser.adapter.ts` (基于浏览器原生或模拟) 与 `electron.adapter.ts` (基于 IPC Bridge)。
- **无缝迁移**：未来由 Browser 切换至 Electron 或 Tauri 时，业务层代码零修改，仅需替换底层 Adapter 注入实例。

### 16.1 本地资产渲染规范
前端在任何场景下都禁止拼接 `file:///` 或本地绝对路径，包括 `<img>`、CSS Background、PDF Viewer 与下载链接。所有本地图片、PDF、Office 缩略图都必须通过 FastAPI 文件流接口获取。

```typescript
const backendPort = window.__BACKEND_PORT__ ?? 8000;
const baseUrl = `http://127.0.0.1:${backendPort}`;

export function assetThumbnailUrl(fileId: string) {
  return `${baseUrl}/api/v1/assets/${fileId}/thumbnail`;
}

export function assetContentUrl(fileId: string) {
  return `${baseUrl}/api/v1/assets/${fileId}/content`;
}
```

- **缓存策略**：缩略图接口依赖 HTTP `Cache-Control`，列表滚动时由浏览器/WebView 自动复用缓存。
- **安全策略**：UI 只能传递 `file_id`，不能将用户磁盘路径透传给 API。
- **Tauri 端口注入**：桌面端由 Tauri 主进程启动 Python Sidecar 后，将动态端口写入 `window.__BACKEND_PORT__`。

### 17. Future Expansion Strategy
为了承载 V2 及其后版本的迭代（如任务管理、在线审批、多人协同），架构需具备前瞻性。

- **Component Slots**：在 Project Detail 的 Header 区域以插槽（Slots）形式预留扩展口，未来可注入 Online Viewer。
- **Feature Flags**：预留特性开关机制。V2 的 AI 生成、Agent 对话流功能可在 V1 期间通过环境变量（`NEXT_PUBLIC_ENABLE_AI_AGENT=false`）隐藏代码入口。
- **Provider Extensibility**：AI Provider 的列表渲染基于配置动态生成，保证未来无缝接入私有化或国产大模型。

### 冻结说明与下一阶段指示
至此，前端及界面相关的核心文档已全部冻结：
`01_PRD.md` | `02_IA.md` | `03_Design_System.md` | `04_Wireframe.md` | `05_Database.md` | `06_Frontend_Architecture.md`
下一步，我们将正式进入真正的系统底层核心引擎设计：**07_Backend_Architecture.md**。请随时下达启动指令！
