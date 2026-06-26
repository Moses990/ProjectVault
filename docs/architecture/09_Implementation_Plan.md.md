# 09_Implementation_Plan.md

**项目名称**：Project Vault V1.0
**文档状态**：Implementation Plan Freeze
**版本号**：V1.0.0
**前置基线**：00_Project_Vault_V1_Baseline.md
**目标**：将已冻结的 V1 架构（01~08）转化为可执行开发路线图。

------

# 1. Development Principles

## 1.1 Core Strategy

Project Vault V1.0 必须遵循：

```text
Backend First
Scanner First
Database First
Frontend Later
```

原因：

系统核心价值来源于：

- 项目扫描
- 元数据提取
- SQLite索引
- 全文检索

而非UI界面本身。

------

## 1.2 Development Order

严格按照以下顺序开发：

```text
Foundation
    ↓
Database
    ↓
Scanner Engine
    ↓
File Watcher
    ↓
Backend API
    ↓
Frontend Shell
    ↓
Project Detail
    ↓
Search Engine
    ↓
AI Center
    ↓
Stabilization
    ↓
Packaging
```

禁止跳跃开发。

------

# 2. Milestone 1 — Foundation

## Goal

建立系统基础骨架。

------

## Deliverables

项目结构：

```text
project-vault/

frontend/
backend/

storage/
logs/
config/

docs/
```

------

后端：

```text
FastAPI
Configuration System
Logging System
```

------

前端：

```text
Next.js

TailwindCSS

shadcn/ui

Zustand

SWR
```

------

## Acceptance Criteria

Backend：

```bash
uvicorn app.main:app
```

成功启动。

------

Frontend：

```bash
npm run dev
```

成功启动。

------

预计工期：

```text
1~2 Days
```

------

# 3. Milestone 2 — Database Layer

## Goal

完成 SQLite 基础设施。

------

## Deliverables

创建：

```text
projects
files
drawings
materials
ai_metadata
ai_providers
scan_history
system_settings
```

------

创建：

```text
FTS5
```

全文检索表。

------

创建：

```text
Database Initialization
Schema Version Control
```

------

## Acceptance Criteria

生成：

```text
db.sqlite
```

------

执行：

```text
Database Bootstrap
```

后自动建表。

------

FTS5正常运行。

------

预计工期：

```text
1 Day
```

------

# 4. Milestone 3 — Scanner Engine

## Goal

实现系统核心扫描引擎。

------

## Deliverables

实现：

### Full Scan

```text
Root Directory Traversal
```

------

### Incremental Scan

```text
mtime Detection
Hash Diff
```

------

### Metadata Extractor

```text
project.json Parser
```

------

### Statistics Generator

```text
file_count

cad_count

material_count
```

------

## Acceptance Criteria

输入：

```text
D:\Projects
```

执行：

```text
Full Scan
```

输出：

```text
SQLite Index
```

------

数据库内容正确。

------

预计工期：

```text
3~5 Days
```

------

# 5. Milestone 4 — File Watcher

## Goal

实现实时同步能力。

------

## Deliverables

基于：

```text
watchdog
```

监听：

```text
Create
Delete
Modify
Move
```

------

实现：

```text
Debounce
```

机制。

------

## Acceptance Criteria

新增：

```text
test.dwg
```

------

10秒内同步进入数据库。

------

预计工期：

```text
1 Day
```

------

# 6. Milestone 5 — Backend API

## Goal

实现全部 V1 API。

------

## Deliverables

模块：

```text
Dashboard

Projects

Files

Drawings

Search

AI

Settings

Scanner

History
```

------

实现：

```text
/api/v1/*
```

全部接口。

------

## Acceptance Criteria

Swagger：

```text
/docs
```

可正常访问。

------

全部接口通过测试。

------

预计工期：

```text
2 Days
```

------

# 7. Milestone 6 — Frontend Shell

## Goal

完成系统主框架。

------

## Deliverables

布局：

```text
Sidebar

Header

Main Layout
```

------

页面：

```text
Dashboard

Projects

CAD Center

AI Center

Settings
```

------

实现：

```text
Dark Mode
```

------

## Acceptance Criteria

04_Wireframe 中一级页面全部落地。

------

预计工期：

```text
2~3 Days
```

------

# 8. Milestone 7 — Project Detail

## Goal

完成项目详情页。

------

## Deliverables

Tabs：

```text
Overview

Files

Drawings

Materials

AI

History
```

------

实现：

```text
Breadcrumb

Folder Cards

Virtual Table
```

------

## Acceptance Criteria

完整浏览项目全部内容。

------

预计工期：

```text
2 Days
```

------

# 9. Milestone 8 — Search Engine

## Goal

完成 Ctrl + K 全局搜索。

------

## Deliverables

实现：

```text
FTS5 Search

Ranking

Highlight

Categorized Results
```

------

实现：

```text
Command Palette
```

------

## Acceptance Criteria

输入：

```text
plan
```

------

返回：

```text
Projects

Files

Drawings

Materials
```

------

搜索响应：

```text
<100ms
```

------

预计工期：

```text
1~2 Days
```

------

# 10. Milestone 9 — AI Center

## Goal

完成 Provider 管理中心。

------

## Deliverables

支持：

```text
OpenAI

Anthropic

Gemini

LM Studio

Ollama

OpenAI Compatible
```

------

实现：

```text
Provider CRUD

Connection Test

Credential Storage
```

------

## Acceptance Criteria

成功：

```text
Test Connection
```

返回：

```text
Connected
```

------

预计工期：

```text
1 Day
```

------

# 11. Milestone 10 — Stabilization

## Goal

稳定化与压力测试。

------

## Deliverables

实现：

```text
Error Handling

Logging

Performance Tuning
```

------

验证：

```text
Large Project
```

场景。

------

## Test Dataset

```text
100 Projects

10000 Files

1000 Drawings
```

------

## Acceptance Criteria

系统持续运行：

```text
24 Hours
```

无崩溃。

------

预计工期：

```text
2 Days
```

------

# 12. Milestone 11 — Packaging

## Goal

形成可交付版本。

------

## Deliverables

生成：

```text
Installer

Release Package
```

------

预留：

```text
Electron

Tauri
```

兼容层。

------

## Acceptance Criteria

新机器：

```text
Install
Configure
Run
```

全流程成功。

------

预计工期：

```text
1 Day
```

------

# 13. Development Freeze Rules

开发期间禁止：

```text
新增模块

修改数据库结构

新增一级导航

修改核心架构
```

------

所有新增需求：

```text
Move To V2 Backlog
```

------

# 14. Release Target

## Alpha

完成：

```text
M1 ~ M6
```

------

## Beta

完成：

```text
M1 ~ M9
```

------

## RC

完成：

```text
M1 ~ M10
```

------

## Release

完成：

```text
M1 ~ M11
```

------

# Implementation Freeze Declaration

Project Vault V1.0 开发阶段正式启动。

所有开发任务必须遵循：

```text
00_Project_Vault_V1_Baseline.md
09_Implementation_Plan.md
```

作为最高执行标准。