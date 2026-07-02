# Project Vault

本地优先的项目文件管理桌面应用，面向建筑与室内设计行业。基于 FastAPI + Next.js + Tauri 2 构建。

## 技术栈

- **后端**：Python FastAPI，SQLite（FTS5 全文索引），文件扫描与 Watcher。
- **前端**：Next.js（React），Linear-inspired 暗色主题设计系统。
- **桌面壳**：Tauri 2，NSIS 安装包，内嵌 Python Sidecar 与 WebView2 Fixed Runtime。

## 仓库结构

```
backend/          FastAPI 服务、SQLite 初始化、扫描器、API
frontend/         Next.js UI
database/         本地 SQLite 运行时数据库（不提交）
desktop/          Tauri 2 桌面壳
docs/             架构文档 (00–13)、产品 PRD、发布文档
prototype/        静态原型（历史遗留）
scripts/          启动脚本、WebView2 运行时准备、PyInstaller 打包
```

## 当前进度

V1 正式版发布门禁已完成，详见 `docs/release/V1_RELEASE_MANIFEST.md`。

**已完成的关键里程碑：**

- 后端：扫描器、Watcher、FTS5 搜索、核心 API、CAD Center API、AI Provider CRUD、系统维护 API。
- 前端 MVP：Dashboard、Projects、Project Detail（Files / Drawings / Materials / AI 四个 Tab）、CAD Center、History、Settings、AI Center、Sidebar、Command Palette。
- Phase 11：Explorer Open / Reveal（按 `file_id`）、扫描历史清理、SQLite 增量 Vacuum、备份/还原入口。
- Phase 12：RC 验证脚本、增量扫描快路径。10 万文件 Fixture 全量扫描、增量扫描、FTS 重建、搜索、备份、还原均通过，搜索延迟 `2.869 ms`，增量扫描 `370 ms`。
- Phase 13：安装/卸载/重装循环验证、loopback 启动、异常路径处理、发布质量检查全部通过。
- 生产打包：PyInstaller Sidecar + Tauri `externalBin` + WebView2 Fixed Runtime (`149.0.4022.96`)。
- 干净 Windows 验证：Windows Sandbox 无 Python/Node 环境下安装、运行、前端渲染、后端健康检查、数据库路径、退出清理均通过。

**最新改动 — 前端设计系统刷新（`feat: redesign frontend UI and design system`）：**

- 全面重写 `globals.css`，引入 Linear-inspired 色彩体系（`--bg-subtle`、`--bg-elev-2/3`、`--border-strong`、`--accent-glow`、语义色 `--success-bg` / `--warn-bg` / `--danger-bg` / `--info-bg` 等）。
- Dashboard：新增副标题与"配置根路径"快捷入口，优化空状态引导流程，收藏项目改为 Grid 布局。
- Projects：新增 `segmented-control` 视图切换、`SortableHeader` 组件、`project-card` 卡片组件，搜索框支持名称/负责人/标签。
- CAD Center：新增面板标题、统一按钮尺寸、图标大小微调。
- Sidebar：SVG logo 替换纯文本 "PV"，底部显示连接状态指示点。
- 全局：统一使用 `panel-header` / `panel-title` / `panel-subtitle` / `empty-state` / `vault-empty-icon` 等语义化 CSS 类；移除内联 `onMouseEnter/Leave` 样式，改用 class。
- `next.config.ts`：开发模式启用 `rewrites` 代理 `/api/v1` 到后端，生产构建再切回静态导出。

## 项目执行

根目录三份文件是执行主依据：

- `task_plan.md`：阶段顺序、交付物、验收标准。
- `findings.md`：PRD 和架构文件提炼出的产品范围、技术约束、风险。
- `progress.md`：已完成工作、验证记录、当前阶段和下一步。

## 开发启动

后端（需要 Python 3.11+ 虚拟环境）：

```bat
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

前端（需要 Node.js 18+）：

```bat
cd frontend
npm run dev
```

开发模式下 `next.config.ts` 的 `rewrites` 会将 `/api/v1/*` 代理到 `http://127.0.0.1:8000`。

生产构建（Tauri 打包）：

```bat
cd desktop
npm run build
```

安装包位于 `desktop/src-tauri/target/release/bundle/nsis/`。

## 远程仓库

<https://github.com/Moses990/ProjectVault.git>
