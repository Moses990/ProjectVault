# 04_Wireframe.md
**项目名称**：Project Vault V1.0

**文档状态**：V1.1 Frozen **审查状态**：Approved with Minor Revisions **设计原则**：Professional, Minimal, High Density, Fast

## 0. First Run Setup

**页面目标**：优化首次使用体验，引导用户完成系统初始化 。
**用户主要操作**：选择本地项目目录、构建索引、配置 AI 模型 。
**页面结构**：

```plaintext
+-----------------------------------------------------------------------------+
|  First Run Setup                                                            |
|  -------------------------------------------------------------------------  |
|                                                                             |
|  [ Step 1: Welcome ]                                                        |
|  Welcome to Project Vault.                                                  |
|  Select Project Root Directory:                                             |
|  [ D:\Projects                                            ]        [Next]   |
|                                                                             |
|  [ Step 2: Build Search Index ]                                             |
|  Estimated Files: 15,000                                                    |
|                                                              [Start Scan]   |
|                                                                             |
|  [ Step 3: Configure AI Provider ]                                          |
|                                                      [Skip]  [Configure]    |
|                                                                             |
|  [ Step 4: Setup Complete ]                                                 |
|                                                      [Go To Dashboard]      |
+-----------------------------------------------------------------------------+

```
**数据字段**：

- 目录路径、预估文件数 。
**交互说明**：

- 按步骤执行，完成后点击 `Go To Dashboard` 进入主界面 。

## 1. Dashboard

**页面目标**：提供系统概览、统计数据，并作为用户高频访问的枢纽。让用户第一时间确认扫描、索引状态及是否存在异常 。
**用户主要操作**：查看数据大盘、确认扫描健康度、快速点击进入近期更新或高频访问的项目。
**页面结构**：

```plaintext
+-----------------------------------------------------------------------------+
|  Search [ Ctrl + K ]                                             [Settings] |
+-----------------------------------------------------------------------------+
| [Sidebar]    |  Dashboard                                                   |
|              |                                                              |
| Dashboard    |  [ Metric Card: Projects ]  [ Metric Card: CAD Drawings ]    |
| Projects     |  [ Total: 124            ]  [ Total: 1,024              ]    |
| Search       |                                                              |
| CAD Center   |  [ Scan Status Card ]                                        |
| AI Center    |  Last Scan: 2026-06-24 09:30 | Duration: 2m 14s              |
| Settings     |  Indexed Files: 15,342       | Status: Healthy               |
|              |  ----------------------------------------------------------  |
|              |  Recent Activity                                             |
|              |  - [Project Scanned] 2026-01-Retail                          |
|              |  - [AI Updated] Project Summary Updated                      |
|              |  - [CAD Added] 01_Floor_Plan_v3.dwg                          |
|              |  - [Material Added] PVC_Membrane_Spec.pdf                    |
|              |  ----------------------------------------------------------  |
|              |  Recently Updated Projects                                   |
|              |  +--------------------------------------------------------+  |
|              |  | Project Name       | Phase    | Updated    | Files     |  |
|              |  |--------------------+----------+------------+-----------|  |
|              |  | P-2026-01-Retail   | Concept  | 10 min ago | 142       |  |
|              |  +--------------------------------------------------------+  |
+-----------------------------------------------------------------------------+

```
**数据字段**：

- 项目总数、CAD 总数。
- Scan Status：Last Scan, Duration, Indexed Files, Status 。
- Recent Activity：系统活动时间线（扫描、AI更新、CAD新增、材料新增） 。
- 最近更新项目列表。

## 2. Projects
**页面目标**：跨项目的高密度列表呈现，用于检索与管理。
**用户主要操作**：使用条件过滤项目、切换视图、直接定位目标项目并打开。
**页面结构**：

```plaintext
+-----------------------------------------------------------------------------+
|  Search [ Ctrl + K ]                                                        |
+-----------------------------------------------------------------------------+
| [Sidebar]    |  Projects                                                    |
|              |                                                              |
| Dashboard    |  [ Filter: Phase ] [ Filter: Type ] [ Sort: Updated v ]      |
| Projects (*) |  ----------------------------------------------------------  |
| Search       |  +--------------------------------------------------------+  |
| CAD Center   |  | Name             | Type     | Phase   | Updated | File |  |
| AI Center    |  |------------------+----------+---------+---------+------|  |
| Settings     |  | 2026-01-Retail   | Retail   | Concept | 12:00   | 142  |  |
|              |  | 2026-02-Office   | SI       | Constr. | 09:30   | 89   |  |
|              |  +--------------------------------------------------------+  |
|              |                                                              |
|              |  < Page 1 of 12 >                                            |
+-----------------------------------------------------------------------------+

```

**新增交互：未纳管项目发现区 (Unmanaged Projects Discovery)**：

- **入口位置**：在 Projects 标题右侧放置 `导入现有项目` 操作；当项目列表为空时，在空状态区域展示同一入口。
- **弹窗结构**：点击后打开 `Candidate Projects Modal`，展示系统在根目录第一层扫描到的未纳管文件夹。
- **列表控件**：候选列表使用 Checkbox 多选，字段包含文件夹名、绝对路径、创建时间、预计文件数。
- **确认动作**：用户点击 `一键转为标准项目` 后，前端调用批量初始化接口，为所选文件夹写入默认 `project.json`。
- **反馈状态**：初始化过程中展示进度条与当前处理文件夹；完成后刷新 Projects 列表并关闭弹窗。
- **安全边界**：候选项目发现只读扫描文件夹，不主动写入数据库，也不根据目录名直接创建正式项目。

## 3. Project Detail
**页面目标**：单项目核心数据的展示中枢。

**用户主要操作**：浏览项目属性、定位深层文件、查看 CAD 演进、查阅提取信息。高频操作前置 。

### 3.1 Overview Tab

```plaintext
+-----------------------------------------------------------------------------+
|  < Back   [ Project: 2026-01-Retail ]  [Open Folder][Rescan][Favorite][More]|
+-----------------------------------------------------------------------------+
|  Overview(*)  Files  Drawings  Materials  AI  History                       |
|  -------------------------------------------------------------------------  |
|  [ Info Card: Project Basics ]       [ Info Card: Statistics ]              |
|  ID: PROJ-2026-001                   Files: 142                             |
|  Type: Retail                        CAD Drawings: 15                       |
|  Phase: Concept                      Materials: 24                          |
|                                                                             |
|  [ Info Card: Description ]                                                 |
|  A flagship retail store project located in downtown Tokyo...               |
+-----------------------------------------------------------------------------+

```

交互注：Header 增加 `[Open Folder][Rescan][Favorite][More]` 快捷操作 。

### 3.2 Files Tab

```plaintext
+-----------------------------------------------------------------------------+
|  Overview  Files(*)  Drawings  Materials  AI  History                       |
|  -------------------------------------------------------------------------  |
|  [ Breadcrumb: Root / 01_Project_Brief / 02_Requirements ]                  |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | File Name                | Size   | Type | Modified | Actions         |  |
|  |--------------------------+--------+------+----------+-----------------|  |
|  | requirements_v1.pdf      | 2.4 MB | PDF  | 06-20    | [Open][Reveal]  |  |
|  | site_survey_data.xlsx    | 1.1 MB | Excel| 06-19    | [Copy Path]     |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+

```

交互注：减少右键菜单依赖，新增 Actions 列提供 Open, Reveal, Copy Path 操作 。

### 3.3 Drawings Tab

```plaintext
+-----------------------------------------------------------------------------+
|  Overview  Files  Drawings(*)  Materials  AI  History                       |
|  -------------------------------------------------------------------------  |
|  [ Filter: Plan / Elevation / Ceiling / Detail / Construction ]             |
|                                                                             |
|  +--------------------------------------------------+ +-------------------+ |
|  | Drawing Name         | Class | Updated  | Status | | Drawing Detail  | |
|  |----------------------+-------+----------+--------| |                   | |
|  | 01_Floor_Plan_v4.dwg | Plan  | 10:00    | Current| | Name: Floor_Plan| |
|  | 01_Floor_Plan_v3.dwg | Plan  | 09:00    | Archive| | Version Chain:  | |
|  | 02_Ceiling_RCP.dwg   | Ceil. | Yester.  | Current| | v4 ↓ v3 ↓ v2 ↓v1| |
|  +--------------------------------------------------+ |                   | |
|                                                       | Related Files   | |
|                                                       | History         | |
|                                                       +-------------------+ |
+-----------------------------------------------------------------------------+

```

交互注：强化 Drawings 与 Files 的差异，新增右侧 Drawer 展示 Version Chain, Related Files 及 History 。

### 3.4 Materials Tab (同 V1.0 基础结构)

### 3.5 AI Tab

```plaintext
+-----------------------------------------------------------------------------+
|  Overview  Files  Drawings  Materials  AI(*)  History                       |
|  -------------------------------------------------------------------------  |
|  [ Metadata Source ]                                                        |
|  Generated By: OpenAI GPT-5.5 | Generated At: 2026-06-24 10:00              |
|  -------------------------------------------------------------------------  |
|  [ Info Card: AI Summary ]                                                  |
|  This project involves a 500sqm retail space renovation...                  |
|                                                                             |
|  [ Info Card: Core Requirements ]          [ Info Card: Special Rules ]     |
+-----------------------------------------------------------------------------+

```

交互注：新增 Metadata Source 字段以支持未来多模型管理 。

### 3.6 History Tab

```plaintext
+-----------------------------------------------------------------------------+
|  Overview  Files  Drawings  Materials  AI  History(*)                       |
|  -------------------------------------------------------------------------  |
|  [ Filters: All | Files | CAD | AI | System ]                               |
|  -------------------------------------------------------------------------  |
|  Timeline:                                                                  |
|  |-- [2026-06-24 10:00] [File Updated] 01_Floor_Plan_v2.dwg modified        |
|  |-- [2026-06-23 15:30] [AI Metadata] Summary updated by GPT-4              |
+-----------------------------------------------------------------------------+

```

交互注：新增 Filters 以支持大型项目时间线过滤 。

## 4. Global Search (Ctrl+K)
**页面目标**：全局统一入口，提供最高效的穿梭交互。
**用户主要操作**：唤起面板、输入关键词、触发快捷动作、回车直接打开。
**页面结构**：

```plaintext
+-----------------------------------------------------------------------------+
|       +-------------------------------------------------------------+       |
|       |  > plan v2|                                                 |       |
|       |-------------------------------------------------------------|       |
|       |  RECENT SEARCHES                                            |       |
|       |    [Proj] 2026-01-Retail                                    |       |
|       |                                                             |       |
|       |  QUICK ACTIONS                                              |       |
|       |    [Action] Open Settings        [Action] Open CAD Center   |       |
|       |    [Action] Rescan Project       [Action] Rebuild Index     |       |
|       |                                                             |       |
|       |  CAD DRAWINGS (3)                                           |       |
|       |  > [CAD]  01_Floor_Plan_v2.dwg     (Project: Retail)        |       |
|       |-------------------------------------------------------------|       |
|       |  [Enter] Open  [Esc] Close  [Ctrl+O] Locate in Explorer     |       |
|       +-------------------------------------------------------------+       |
+-----------------------------------------------------------------------------+

```

交互注：在 Recent Searches 下方增加 Quick Actions 区域 。

## 5. CAD Center

**页面目标**：跨项目的 CAD 图纸全局追踪、版本审计与全局分析 。
**用户主要操作**：按图纸分类检索、查看同名图纸的版本链。
**页面结构**：

```plaintext
+-----------------------------------------------------------------------------+
| [Sidebar]    |  CAD Center                                                  |
|              |                                                              |
| Dashboard    |  [ Classification View: ALL | PLAN | ELEVATION | CEILING ]   |
| Projects     |  ----------------------------------------------------------  |
| Search       |                                                              |
| CAD Center(*)|  +-----------------------------------------------+ +-------+ |
| AI Center    |  | Drawing Name       | Project    | Updated     | | Stats | |
| Settings     |  |--------------------+------------+-------------| | Plan:38 | |
|              |  | 01_Floor_Plan.dwg  | Retail     | 10 min ago  | | Elev:26 | |
|              |  | 02_Ceiling.dwg     | Retail     | 2 hrs ago   | | Ceil:12 | |
|              |  | Entry_Detail.dwg   | Office     | 1 day ago   | | Det: 18 | |
|              |  +-----------------------------------------------+ |-------| |
|              |                                                    | Rev.  | |
|              |  Recently Updated Drawings                         | Time- | |
|              |  [ 01_Floor_Plan.dwg ] [ Retail_Facade.dwg ]       | line  | |
+-----------------------------------------------------------------------------+

```

交互注：在 Revision Timeline 上方新增 CAD Statistics 面板以形成全局分析能力 。

## 6. AI Center
**页面目标**：集中配置和测试 AI 模型 Provider，为底层摘要分析提供基座。
**用户主要操作**：录入 API Key、测试网络连通性、设定默认执行模型。
**页面结构**：

```plaintext
+-----------------------------------------------------------------------------+
| [Sidebar]    |  AI Center                                                   |
|              |                                                              |
| Dashboard    |  Provider List                          [ + Add Provider ]   |
| Projects     |  ----------------------------------------------------------  |
| Search       |  [ Provider Card ]                                           |
| CAD Center   |  Name: OpenAI                                                |
| AI Center(*) |  Default Model: gpt-4-turbo             [Badge: Connected]   |
| Settings     |  Base URL: https://api.openai.com/v1                         |
|              |  ---------------------------------------------------------   |
|              |  [ Edit ]  [ Test Connection ]  [ Set Default ]  [ Delete]   |
+-----------------------------------------------------------------------------+

```

## 7. Settings

**页面目标**：全局系统治理与参数设定。适应未来扩展 。
**用户主要操作**：在二级导航中切换配置类别，维护系统级参数 。
**页面结构**：

```plaintext
+-----------------------------------------------------------------------------+
| [Sidebar]    |  Settings                                                    |
|              |  ----------------------------------------------------------  |
| Dashboard    |  [ Menu ]          |  [ Directories ]                        |
| Projects     |  General           |                                         |
| Search       |  Directories (*)   |  Project Root Path:                     |
| CAD Center   |  Scanning          |  [ D:\Work\Projects               ]     |
| AI Center    |  Search Index      |  * System will scan this folder...      |
| Settings(*)|  AI                |                                         |
|              |  Appearance        |  [ + Add Another Directory ]            |
|              |                    |                                         |
|              |                    |  -------------------------------------  |
|              |                    |                    [ Save Changes ]     |
+-----------------------------------------------------------------------------+

```

交互注：由单页面滚动重构为二级导航结构 。

(End of Wireframe. 准备进入 `05_Database.md` 阶段 )
