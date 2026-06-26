# 13_Development_Roadmap.md

**项目名称**：Project Vault
**文档状态**：V1.0
**文档类型**：Development Roadmap
**目标读者**：开发者 / Codex / AI Agent
**关联文档**：

- 00_Project_Vault_V1_Baseline.md
- 09_Backend_Implementation_Plan.md
- 10_Database_Implementation_Plan.md
- 11_Core_Engine_Implementation_Plan.md
- 12_Release_Deployment_Plan.md

---

# 1. Roadmap Philosophy

Project Vault 采用：

**Architecture First → Core Engine → Productization → AI Enhancement**

开发顺序。

原则：

- 先搭骨架
- 再做扫描
- 再做索引
- 再做前端
- 最后接 AI

避免出现：

> AI做完了
>
> 扫描器没做好
>
> 数据结构天天改

这种典型技术债。

---

# 2. Overall Timeline

预计：

## V1

MVP可用版

周期：

4~6周

目标：

完成：

- 项目管理
- 文件管理
- CAD管理
- SQLite索引
- 全局搜索

---

## V2

AI增强版

周期：

2~4周

目标：

完成：

- AI摘要
- AI标签
- AI项目画像
- 本地模型支持

---

## V3

智能知识库

周期：

4~8周

目标：

完成：

- 向量库
- RAG
- Agent

---

# 3. Phase 1 — Foundation

---

## Sprint 0

Tauri-Python 侧载通信验证

预计：

1天

目标：

优先打通桌面容器、Python 后端、动态端口和进程生命周期，提前排除发布阶段的系统性风险。

交付：

- [ ] 编写最小 FastAPI Demo，提供 `/api/health`
- [ ] 使用 PyInstaller 或 Nuitka 产出 Windows Sidecar 可执行文件
- [ ] 配置 Tauri `externalBin`
- [ ] Tauri 主进程申请动态端口，并通过 `--port` 启动 Python 后端
- [ ] 前端读取 `window.__BACKEND_PORT__` 并成功请求 `/api/health`
- [ ] 关闭 Tauri 窗口后验证 Python 进程被正确终止

完成标准：

- 无本机 Python 环境时仍可启动桌面应用
- 端口冲突不会导致启动失败
- 应用退出后无残留后端进程

---

## Milestone 1

项目骨架

预计：

1天

交付：

### Backend

```text
app/
├─ api/
├─ core/
├─ db/
├─ services/
├─ engine/
├─ ai/
├─ workers/
```

### Frontend

```text
app/
components/
features/
store/
services/
types/
```

### Config

```text
.env
settings.json
```

完成标准：

- 项目启动成功
- FastAPI启动
- Next.js启动

---

## Milestone 2

数据库初始化

预计：

1天

交付：

### SQLite

创建：

- projects
- files
- drawings
- materials
- ai_metadata
- ai_providers
- scan_history
- system_settings

完成标准：

- 自动建库
- 自动升级
- WAL模式开启

---

# 4. Phase 2 — Core Engine

---

## Milestone 3

Full Scanner

预计：

3天

交付：

Scanner Engine

能力：

- 扫描目录
- 识别项目
- 统计文件
- 写入SQLite

完成标准：

首次扫描成功。

---

## Milestone 4

Incremental Scanner

预计：

3天

交付：

Hash Diff机制

支持：

- 新文件
- 删除文件
- 修改文件

完成标准：

增量扫描正确率 >99%

---

## Milestone 5

File Watcher

预计：

2天

交付：

Watchdog监听器

支持：

- Create
- Modify
- Delete
- Move

完成标准：

2秒内同步数据库。

---

# 5. Phase 3 — Search System

---

## Milestone 6

FTS5

预计：

2天

交付：

FTS_Global

支持：

- Project
- File
- Drawing
- Material

完成标准：

10000文件内

查询：

<100ms

---

## Milestone 7

Command Palette API

预计：

1天

交付：

```http
GET /api/v1/search
```

完成标准：

Ctrl+K可搜索。

---

# 6. Phase 4 — Projects Module

---

## Milestone 8

Projects API

预计：

2天

交付：

```http
GET /projects
GET /projects/{id}
```

完成标准：

项目列表正常。

---

## Milestone 9

Project Detail

预计：

3天

完成：

### Overview

### Files

### Drawings

### AI Metadata

完成标准：

项目详情页可用。

---

# 7. Phase 5 — Frontend MVP

---

## Milestone 10

Dashboard

预计：

2天

实现：

- Metrics
- Recent Projects
- Activity

完成标准：

首页可用。

---

## Milestone 11

Projects Table

预计：

3天

实现：

- 排序
- 分页
- 收藏

完成标准：

支持10000项目。

---

## Milestone 12

Files Table

预计：

2天

实现：

- 虚拟滚动
- 路径过滤

完成标准：

100000文件不卡顿。

---

# 8. Phase 6 — CAD Center

---

## Milestone 13

CAD Analyzer

预计：

3天

实现：

### 分类识别

- 平面图
- 立面图
- 天花图

### Version Chain

- V1
- V2
- FINAL

完成标准：

识别准确率 >90%

---

## Milestone 14

CAD Center UI

预计：

2天

实现：

跨项目图纸管理

完成标准：

可替代资源管理器查图。

---

# 9. Phase 7 — System Features

---

## Milestone 15

Settings

预计：

1天

实现：

- Root Path
- Scan Interval
- Theme

---

## Milestone 16

History

预计：

1天

实现：

Activity Timeline

---

## Milestone 17

System API

预计：

1天

实现：

```http
Explorer Open
Reveal Folder
```

---

# 10. V1 Release Candidate

---

## RC1 Checklist

Backend

- [ ] Full Scan
- [ ] Incremental Scan
- [ ] File Watcher
- [ ] SQLite
- [ ] FTS5

Frontend

- [ ] Dashboard
- [ ] Projects
- [ ] Files
- [ ] CAD Center

System

- [ ] Settings
- [ ] History
- [ ] Explorer Integration
- [ ] Tauri Sidecar lifecycle
- [ ] Dynamic backend port injection

性能

- [ ] 10万文件
- [ ] 查询<100ms
- [ ] 启动<3s

---

# 11. Phase 8 — AI Enhancement (V2)

---

## Milestone 18

Provider Framework

预计：

2天

实现：

- OpenAI
- Gemini
- Claude
- OpenAI Compatible

---

## Milestone 19

AI Extractor

预计：

3天

能力：

读取：

```text
02_需求资料
```

输出：

```json
项目简介
核心需求
特殊要求
```

写入：

project.json

---

## Milestone 20

AI Metadata Sync

预计：

2天

实现：

project.json

↔

SQLite

双向同步控制。

---

## Milestone 21

AI Center

预计：

2天

实现：

- Provider管理
- 测试连接
- AI任务执行

---

# 12. Phase 9 — Knowledge System (V3)

---

## Milestone 22

Embedding Pipeline

实现：

- BGE
- Jina
- Nomic

---

## Milestone 23

Vector Search

实现：

- FAISS

或

- Chroma

---

## Milestone 24

Hybrid Search

实现：

```text
FTS5
+
Vector Search
```

---

## Milestone 25

Knowledge Graph

项目关系图谱

材料关系图谱

设计经验图谱

---

# 13. Phase 10 — Agent System (V4)

---

## Milestone 26

Project Agent

能力：

- 项目问答
- 项目总结
- 项目分析

---

## Milestone 27

CAD Agent

能力：

- 图纸定位
- 版本追踪
- 图纸对比

---

## Milestone 28

Design Knowledge Agent

能力：

- 历史项目学习
- 经验推荐
- 风险提醒

---

# 14. Recommended Immediate Next Step

当前阶段：

架构设计已完成。

推荐正式进入：

# Sprint 1

目标：

建立可运行的开发骨架。

优先级：

1. Database Implementation
2. Backend Skeleton
3. Scanner Engine
4. First Full Scan
5. FTS5 Search

当 Sprint 1 完成后：

Project Vault 将从“设计阶段”正式进入“可运行产品阶段”。
