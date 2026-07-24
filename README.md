# Project Vault

面向建筑与室内设计团队的本地优先项目文件管理桌面应用。Project Vault 将项目目录中的 `project.json` 作为业务真源，以 SQLite/FTS5 提供可重建的索引与全文检索，并通过 FastAPI、Next.js 和 Tauri 2 提供本地桌面体验。

当前版本：**V2.0.0**。阶段 0～10 已完成并冻结；后续需求需独立立项，不在既有阶段上追加功能。

## 功能

- 项目发现、初始化、扫描、Watcher 增量索引与历史记录。
- Dashboard、项目库、项目详情、Files 目录树、Drawings、Materials 与 CAD Center。
- 全局搜索与命令面板，资源操作通过稳定 `file_id` 路由。
- Settings 与首次使用流程；AI Provider 使用 Windows Credential Manager 保存凭据。
- Project Knowledge：从文本和 PDF 创建草稿，经人工确认、备份和原子写入后同步 SQLite/FTS5。
- Windows 桌面打包：Tauri Sidecar、NSIS 安装包、WebView2 Fixed Runtime。

## 数据与安全边界

- `project.json` 是业务数据源头；SQLite 与 FTS5 只保存可重建的派生索引。
- 文件以项目内 `relative_path` 标识；前端不接触本地绝对路径。
- Knowledge 只能走“草稿 → 人工确认 → 备份 → 原子写入 → 索引同步”流程。
- 文件访问拒绝路径逃逸、符号链接和 junction；可打开文件受扩展名白名单约束。
- 设置 `PV_API_TOKEN` 后，除 `/health` 外的 API 必须使用 Bearer 认证。

## 技术栈

- 后端：Python 3.12、FastAPI、SQLite/FTS5、watchdog、pypdf。
- 前端：Next.js 16、React 19、TypeScript、Vitest。
- 桌面端：Tauri 2、Rust、NSIS、PyInstaller Sidecar。

## 仓库结构

```text
backend/          FastAPI 服务、索引、扫描器与 API
frontend/         Next.js 用户界面
desktop/          Tauri 2 桌面壳与打包配置
database/         本地 SQLite 运行时数据库（不提交）
docs/             架构、计划、产品与发布文档
scripts/          Sidecar、安装包与验收脚本
```

## 本地开发

前置条件：Python 3.12、Node.js 24、Rust（仅桌面端构建）。

```powershell
# 后端
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# 前端（另开终端）
cd frontend
npm ci
npm run dev
```

开发服务器默认为 `http://127.0.0.1:3000`，并将 `/api/v1/*` 代理到 `http://127.0.0.1:8000`。

```powershell
# 前端测试与静态构建
cd frontend
npm run test
npm run build

# 后端测试
cd backend
.venv\Scripts\python.exe -m unittest discover -s tests -v

# Windows 安装包
cd desktop
npm ci
npm run build
```

安装包输出到 `desktop/src-tauri/target/release/bundle/nsis/`。

## 验证状态

V2.0.0 已完成正式安装包构建与隔离本机安装验收（37/37 通过）。维护改动需按风险重新验证；历史结果不替代当前验证。

## 项目文档

- [当前计划](task_plan.md)：阶段状态、长期边界与维护门禁。
- [当前事实与风险](findings.md)：架构约束、已证实问题与风险。
- [最近进度](progress.md)：验证记录、远端状态与恢复入口。
- [用户指南](docs/release/USER_GUIDE.md)。

## 远程仓库

<https://github.com/Moses990/ProjectVault>
