# 本地项目驾驶舱实施计划

## 目标

为项目自动建档系统新增一个本地网页驾驶舱，供个人在浏览器中统一查看和管理项目资料。

## 已确认需求

- 使用者：仅本人使用。
- 核心目标：统一管理项目资料。
- 界面形态：左侧项目列表 + 右侧项目详情。
- 第一版原则：先稳定，优先只读和安全操作。
- 本地能力：允许打开项目文件夹。

## 阶段

### Phase 0: 界面重设计

状态：complete

- 已将页面改为三栏工作台：左侧项目导航、中间项目工作区、右侧上下文面板。
- 已新增 `概览 / 资料 / 会议 / 风险待办 / 搜索` 标签页。
- 已通过桌面和窄屏浏览器验证。

### Phase 1: 读取现有结构

状态：complete

- 确认项目根目录、系统目录、现有命令入口。
- 确认 `project.json` 与 `ai_notes` 数据结构。
- 决定本地 Web 文件组织方式。

### Phase 2: 后端服务

状态：complete

- 新增轻量 FastAPI 服务。
- 提供项目列表、项目详情、会议列表、搜索接口。
- 提供打开项目文件夹和执行稳定命令的接口。

### Phase 3: 前端界面

状态：complete

- 新增左侧项目列表 + 右侧详情界面。
- 展示项目摘要、需求、风险、材料、会议记录。
- 提供搜索、刷新、打开文件夹按钮。

### Phase 4: 启动与验证

状态：complete

## 验证记录

- `python -m py_compile code\web_dashboard.py` 通过。
- `python -m compileall code` 通过。
- `node --check web\app.js` 通过。
- 本地服务 `http://127.0.0.1:8765/` 首页返回 200。
- `/api/projects` 返回 1 个项目：`追觅`，AI 状态 `success`，会议记录 3 份。
- `/api/projects/追觅/search?q=水磨石 分缝` 返回 2 条证据结果。
- `/api/actions/run` 执行 `index` 成功，并重新生成 `output\project_index.xlsx`。

- 新增一键启动脚本。
- 本地启动服务并检查接口和页面。
- 记录使用方式。

## 风险

- 不能破坏现有命令行系统。
- 打开文件夹仅适合本地使用，上公网前需要禁用或加权限。
- 执行命令接口第一版只开放固定白名单。

### Phase 5: AI 只读助手

状态：complete

- 支持环境变量或本地私有配置读取外部 API Key。
- 新增 OpenAI 兼容接口调用模块。
- 新增当前项目问答接口。
- 网页新增 AI 助理标签页。
- 第一版只读 `project.json`、会议 note JSON 和资料统计，不自动写入项目档案。

验证记录：

- `python -m py_compile code\ai_assistant.py code\web_dashboard.py` 通过。
- `node --check web\app.js` 通过。
- `/api/ai/status` 未配置时返回 `enabled=false`。
- 未配置 API Key 时，AI 标签页显示配置提示，不产生浏览器控制台错误。
- 已配置 Agnes AI：`base_url=https://apihub.agnes-ai.com/v1`，`model=agnes-2.0-flash`。
- 已完成 Agnes 最小真实调用，返回 `OK`。
- 已通过网页助手接口对 `追觅` 项目提问，成功返回项目总结。

### Phase 6: AI 回答沉淀

状态：complete

- 新增 AI 回答保存接口，固定写入 `00_项目档案\ai_assistant\`。
- 前端在 AI 回答后显示“保存到项目档案”按钮。
- 保存文件为 Markdown，不修改 `project.json`。
- 已用模拟回答验证保存流程，并清理测试文件。

### Phase 7: 项目体检中心

状态：complete

- 新增项目健康规则：综合 AI 状态、会议记录、风险数量、待办数量、资料目录完整度和项目摘要。
- 项目接口新增 `health` 字段，项目列表新增总体健康统计。
- 前端新增“体检”页签，显示待办进度、状态、问题项和建议处理动作。
- 左侧筛选新增“需处理”，用于快速过滤高风险或需关注项目。

验证记录：

- `python -m py_compile code\web_dashboard.py code\ai_assistant.py` 通过。
- `node --check web\app.js` 通过。
- `/api/projects` 返回健康统计和项目 `health` 字段。
- 浏览器检查“体检”页无控制台错误，桌面和窄屏均无横向溢出。

### Phase 8: 待办闭环中心

状态：complete

- 从会议证据中提取全部待办事项，统一生成纯 ASCII 待办 ID。
- 新增 `/api/projects/{project}/todos` 接口，返回待办列表和闭环进度。
- 新增 `/api/projects/{project}/todos/status` 接口，支持 `待处理 / 已处理 / 需确认 / 暂缓` 状态保存。
- 状态保存到项目目录 `00_项目档案\todo_status.json`，不修改 `project.json`。
- 前端新增“待办闭环”页签，支持按状态筛选和快速切换状态。
- 将“健康分”改为“待办进度”，体检页和概览页都展示已处理比例。

验证记录：

- `python -m py_compile code\web_dashboard.py code\ai_assistant.py` 通过。
- `node --check web\app.js` 通过。
- `/api/projects/追觅/todos` 返回 31 条待办。
- 已验证待办状态可保存为 `done` 并恢复为原状态。
- 浏览器检查“待办闭环”页无控制台错误，桌面和窄屏均无横向溢出。
