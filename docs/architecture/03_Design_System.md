# 03_Design_System.md

**项目名称**：Project Vault V1.0



**文档状态**：V1.1 Frozen **审查状态**：Approved with Minor Revisions **设计基调**：Professional, Minimal, Dark, High Density, Fast **下一阶段目标**：完成 Dashboard、Projects、Project Detail、CAD Center、AI Center、Settings 全部页面线框设计 。  

## 1. Design Philosophy

Project Vault 的设计哲学以“内容与检索”为绝对核心，UI 仅作为隐形的内容承载容器。

- 

  **内容即 UI**：消除多余的视觉噪音（如大面积色块、复杂的投影），让项目文件、图纸名称和状态数据本身成为界面的视觉焦点 。

- 

  **高密度展示**：面向专业室内设计/SI设计人员，界面需要在单屏内展示最大化的信息量，减少滚动与跳转，提升信息获取效率 。

- 

  **键盘优先交互**：将鼠标点击降维，强化快捷键（如 Ctrl + K 全局检索）的肌肉记忆 。

- 

  **本地化的极速感**：零延迟反馈体验，所有状态切换与数据加载在视觉上需保持顺滑无缝 。

## 2. Color System

全局采用深度暗黑模式为默认主题，色彩系统极度克制，仅在需要强调状态和主操作时使用色彩 。

| **颜色变量**       | **色值**  | **应用场景说明**                                   |
| ------------------ | --------- | -------------------------------------------------- |
| **Background**     | `#0F1117` | 用于最底层的应用背景（如主内容区底色、导航栏底色） |
| **Surface**        | `#171923` | 用于承载内容的容器（如卡片、模态框、下拉菜单）     |
| **Border**         | `#252936` | 用于分割线、卡片与输入框边框，要求极度微弱的对比度 |
| **Text**           | `#F3F4F6` | 用于正文主体、标题、强调内容                       |
| **Secondary Text** | `#9CA3AF` | 用于辅助信息、时间戳、文件路径、未激活的 Tab       |
| **Primary Accent** | `#7C3AED` | 用于主要按钮、焦点边框、Tab 下划线、核心状态指示   |

## 3. Typography

采用无衬线系统字体以保证界面的现代感和极速渲染能力。为兼顾高密度显示、长时间阅读（防止疲劳）及 27 寸显示器使用场景，对字号进行了精细化调整 。  

| **字体层级**      | **字号设定** | **粗细设定** | **适用场景**             |
| ----------------- | ------------ | ------------ | ------------------------ |
| **Page Title**    | 20px         | Semi-Bold    | 页面级大标题             |
| **Section Title** | 14px         | Medium       | 卡片标题、Tab 标题       |
| **Content Text**  | 14px         | Regular      | 用于长时间阅读的正文资料 |
| **Form Text**     | 14px         | Regular      | 用于表单内输入文本       |
| **Table Data**    | 13px         | Regular      | 列表文字、表格数据       |
| **Caption**       | 12px         | Regular      | 标签、文件大小、次要说明 |

- 

  **字体家族**：`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif` 。

- 

  **行高设定**：严格控制在 1.4 到 1.5 之间，以适应高密度列表的要求 。

## 4. Layout System

整体采用固定宽度的包容性布局，确保宽屏下的视觉聚焦 。

- 

  **全局结构**：左侧导航栏 + 顶部搜索栏 + 主内容区 。

- 

  **最大宽度**：主内容区域最大宽度锁定为 `1600px`，居中对齐，两侧留白，避免视觉涣散 。

- 

  **导航栏宽度**：固定在 `240px` 。

- 

  **Files 模块专属布局**：彻底废弃与 Windows Explorer 过于接近的“Left Tree + Right Table”结构 。避免长期固定的目录树，优先强化项目浏览体验，统一采用 `Breadcrumb ↓ Folder Cards ↓ File Table` 的垂直流线布局 。（示例：项目资料 > 01_项目前期资料 > 02_需求资料） 。  

## 5. Spacing System

基于 4px 倍数的网格系统，但在卡片和列表内部采用更紧凑的间距以呼应高密度特性 。

- 

  **Micro (4px)**：图标与文字间距 。

- 

  **Small (8px)**：列表项之间、标签间距 。

- 

  **Base (12px)**：卡片内边距 。

- 

  **Medium (16px / 24px)**：区块组之间的分割间距 。

- 

  **Large (32px)**：页面外层留白 。

## 6. Navigation Design

- 

  **左侧菜单 (Sidebar)**：极简的无边框设计。菜单项背景默认透明，Hover 时变为 Surface 色 (`#171923`) 。

- 

  **激活状态 (Active)**：选中项文字变为 Text 主色，左侧边缘可带一条 `2px` 宽的 Primary Accent (`#7C3AED`) 指示条 。

- 

  **交互行为**：保持平铺直观展示 Dashboard、Projects、CAD Center 等一级入口，V1 不做复杂的深层级风琴折叠 。

## 7. Card Design

为避免后期风格漂移并统一组件规范，禁止宽泛定义，卡片严格分类为以下三种标准形态 ：  

- 

  **Metric Card (指标卡片)**：专用于 Dashboard 展示核心统计数据（示例：项目总数、CAD总数、材料总数） 。  

- 

  **Project Card (项目卡片)**：专用于 Projects 页面的高密度项目呈现（示例：项目名称、阶段、更新时间、文件数量） 。  

- 

  **Info Card (信息卡片)**：专用于 Overview 页面展示只读属性（示例：项目简介、项目标签、AI摘要） 。  

- **通用视觉规范**：

  - 容器背景：Surface (`#171923`) 。
  - 边框样式：1px Solid Border (`#252936`)，圆角 `12px` 。
  - 悬浮动态：边框颜色轻微提亮，或产生极其微弱的 `0 4px 12px rgba(0,0,0,0.2)` 环境光阴影，无位移 。

## 8. Table Design

适应未来项目规模的增长并提升专业用户效率的高密度数据表格 。  

- 

  **列自定义 (Column Customization)**：全面支持针对表格字段进行 `Show Column`, `Hide Column`, `Reorder Column` 操作 。该功能强制应用于 Projects、CAD Center、Search Results 以及 Materials 的表格中 。  

- 

  **表头设计**：吸顶 (Sticky Header)，背景色为 `#0F1117`，下边缘带 1px 边框，Secondary Text 颜色字号 12px 。

- 

  **行间分割与交互**：无纵向分割线，行悬浮时背景微弱高亮 (`rgba(255,255,255, 0.04)`) 。上下 Padding 约为 `6px` 。

## 9. Search Design

全局搜索基于 Command Palette 模式设计，以 Linear 和 Raycast 为最高参照标准 。  

- 

  **触发与形态**：全局快捷键 `Ctrl + K` 唤出屏幕正中覆盖式的全局命令面板 (Global Modal)，巨大的无边框输入框始终处于 Focus 状态 。

- 

  **近期搜索 (Recent Search)**：默认唤出时提供搜索历史（示例：“追觅PVC软膜”、“用户中心”） 。  

- 

  **快捷指令 (Quick Actions)**：融入系统级快捷操作指令（示例：`Open Project`, `Open Folder`, `Rescan Project`, `Open CAD Center`, `Open Settings`） 。  

- 

  **结果展示**：按 Projects、Files、CAD、Materials 高密度展示分类搜索结果 。

## 10. Modal Design

模态框用于 Settings 配置、系统指引或局部确认操作 。

- 

  **全局遮罩**：深色半透明遮罩，带有微弱的高斯模糊 (`backdrop-blur-sm`) 。

- 

  **面板容器**：Surface 背景色，1px Border 描边，圆角 `12px` 。

- 

  **极简头部**：仅包含必要标题和右上角的无感关闭图标 (X) 。

- 

  **快捷响应**：严格支持 `Esc` 键关闭面板，`Enter` 键提交表单 。

## 11. Tabs Design

- 

  **视觉形态**：抛弃繁杂的卡片式 Tab，采用极简的文字列表横排对齐 。

- 

  **激活样式**：文字为 `#F3F4F6`，底部带有 `2px` 粗细的主强调色 (`#7C3AED`) 高亮指示线 。

- 

  **未激活样式**：文字为 `#9CA3AF`，Hover 时变为浅灰色，底部无线条 。

## 12. Form Design

- 

  **基础输入框**：背景为底层深色 `#0F1117`，边框为 `#252936`，圆角 8px 。

- 

  **字段标签**：文字标签位于输入框正上方，字号 12px，Secondary Text，距输入框 4px 。

- 

  **焦点高亮**：Focus 状态下边框变为主强调色 (`#7C3AED`)，明确当前录入焦点 。

## 13. Button Design

不使用任何重投影和高拟物感的按钮，强化扁平与专业 。

- 

  **Primary Button**：纯色背景 `#7C3AED`，文字白色，圆角 6-8px 。

- 

  **Secondary Button**：浮层背景色 `#171923`，边框 `#252936`，文字 `#F3F4F6` 。

- 

  **Ghost Button**：默认透明无边框，仅 Hover 时背景微亮。用于列表后侧操作项 。

## 14. Empty State

- 

  **首次启动体验 (First Run Experience)**：专门用于首次安装、配置丢失或数据库初始化等系统初启阶段 。呈现文案：“欢迎使用 Project Vault，请先配置项目根目录”，并提供“开始设置”核心行为按钮 。  

- 

  **常规空状态**：使用单色、线性的 Lucide Icons（尺寸约 `48px`）。14px 主文本说明，12px 次级文本指引 。坚决放弃巨大且色彩丰富的插画 。

## 15. Loading State

为了匹配 Fast 的核心诉求，系统杜绝使用阻塞用户视线的全屏 Loading 动画 。

- 

  **局部骨架屏**：使用与真实卡片等比例的极暗色骨架色块闪烁 。

- 

  **全局进度指示**：若系统后台执行庞大任务，仅在顶部栏提供一条高度为 `2px` 的 `#7C3AED` 细进度条，或边栏提供极简旋转图标 。

## 16. Toast Notification

- 

  **位置与样式**：屏幕右下角或顶部居中。高密度的深色小黑条（Surface 背景），带微弱边框 。

- 

  **信息展示与行为**：左侧细线区分状态，中间简短文字（13px），无标题。持续 3 秒自然淡出 。

## 17. Icon System

- 

  **指定图库**：Lucide Icons 。

- 

  **视觉规范**：单线 (Monoline) 风格，线宽固定 `1.5px` 或 `2px` 。常规尺寸 16px-20px 。色彩默认 `#9CA3AF`，Hover 变白 。

## 18. Motion System

- 

  **全局时序**：`150ms ease-out`，强化速度感知，绝不拖泥带水 。

- 

  **适用与禁用**：仅限路由切换淡入、模态框弹出。严禁交错位移飞入和冗长抽屉展开 。

## 19. Dark Mode Specification

- 

  **强制单模**：V1 全系强制深色模式运行 。

- 

  **物理空间层级**：通过明度划分 Z-index 空间。越靠近用户越亮，越贴近底层越黑 。确保灰字在深背景上达到 WCAG AA 对比度 。

## 20. Accessibility Guidelines

- 

  **焦点与操作**：必须展示清晰的 `#7C3AED` Focus Ring 轮廓线 。

- 

  **导航回退**：深层本地文件目录必须提供连贯的面包屑键盘响应 。图标按钮必须包含 ARIA 支持 。

## 21. AI Center Components

新增 AI Provider 专属核心组件，用于 AI 配置页面 。  

- 

  **Provider Card**：用于展示模型供应商。包含名称（如 OpenAI）、模型版本（如 Model: gpt-5.5）、以及连接状态 。  

- 

  **Provider Actions**：集成 `Edit`, `Test Connection`, `Set Default`, `Delete` 等管理操作 。  

- 

  **Provider Status Badge**：专用的微型状态指示器，支持 `Connected`, `Disconnected`, `Error` 。  

## 22. Badge System

作为系统级组件全局调用，严禁各页面自行定义颜色以确保高度规范化 。  

- 

  **Project Phase Badge (项目阶段)**：Concept (`Blue`)、Development (`Orange`)、Construction (`Red`)、Completed (`Green`) 。  

- 

  **Tag Badge (标签组)**：用于行业分类或描述（如：零售、用户中心、科技、汽车） 。  

- 

  **AI Badge (生成标识)**：如 `AI Generated`, `AI Updated` 。  

- 

  **Provider Badge (模型品牌)**：如 `OpenAI`, `Gemini`, `Claude` 。  

## 23. Status System

统一系统反馈语言，避免状态表现样式混乱 。  

- 

  **统一状态定义**：`Success`, `Warning`, `Error`, `Info` 。  

- 

  **全局应用场景**：覆盖项目扫描、索引构建、AI Provider 诊断、系统日志及同步状态的反馈展示 。  

## 24. Component Inventory

此清单为系统全部标准组件字典。后续阶段的 Wireframe、Frontend Architecture 及 Component Development 均以此为绝对准绳，禁止新增未定义的独立组件 。  



**可用组件清单 (Component List)** ：  

- Sidebar
- Top Search
- Command Palette
- Breadcrumb
- Metric Card
- Project Card
- Info Card
- File Table
- CAD Timeline
- Provider Card
- Badge
- Status Indicator
- Tabs
- Modal
- Toast
- Empty State
- Skeleton Loader
- Pagination
- Dropdown Menu
- Context Menu
- Form Controls