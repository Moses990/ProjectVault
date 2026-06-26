# 00_Project_Vault_V1_Baseline.md

**Project Name:** Project Vault

**Version:** V1.0.0

**Status:** Architecture Freeze

**Last Updated:** 2026-06

**Architecture Principle:** Local-First / High Performance / Disposable Database / AI Ready

------

# 1. Project Definition

## 1.1 Project Vision

Project Vault 是面向室内设计、SI设计及工程项目管理场景的本地化项目资产管理系统。

系统目标：

- 项目自动建档
- 文件归档管理
- CAD版本追踪
- AI知识沉淀
- 历史经验积累
- 极速检索

------

## 1.2 Core Philosophy

### Source of Truth

唯一权威数据源：

```text
project.json
```

数据库不是权威数据源。

------

### Local First

所有数据默认存储于本地：

```text
Project Folder
project.json
SQLite
```

V1不依赖云端服务。

------

### Disposable Database

SQLite仅作为：

```text
Index Cache
Search Engine
Relationship Mapping
```

任何时候均可重建。

------

### AI Ready

V1完成AI基础设施。

V2实现：

- AI摘要
- AI标签
- AI需求提取
- Agent Workflow

------

# 2. Product Scope

## Included In V1

### Dashboard

系统总览

### Projects

项目管理

### Project Detail

项目详情

Tabs：

- Overview
- Files
- Drawings
- Materials
- AI
- History

### CAD Center

跨项目图纸中心

### AI Center

Provider管理

### Settings

系统配置

### Global Search

Ctrl + K

------

## Excluded From V1

不进入V1开发范围：

### 多人协作

### 在线审批

### 云同步

### Agent Workflow

### RAG

### 向量数据库

### BIM解析

------

# 3. Information Architecture

一级导航：

```text
Dashboard

Projects

CAD Center

AI Center

Settings
```

------

项目详情：

```text
Overview

Files

Drawings

Materials

AI

History
```

------

全局能力：

```text
Command Palette
(Ctrl + K)
```

------

# 4. Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- SWR
- Zustand

------

## Backend

- Python
- FastAPI
- AsyncIO

------

## Database

- SQLite
- FTS5

------

## AI

Provider Abstraction Layer

支持：

- OpenAI
- Anthropic
- Gemini
- OpenAI Compatible
- LM Studio
- Ollama

------

# 5. System Architecture

```text
Local File System
        │
        ▼
 project.json
        │
        ▼
Scanner Engine
        │
        ▼
SQLite Index
        │
        ▼
FastAPI
        │
        ▼
Next.js UI
```

------

# 6. Core Modules

## Scanner Engine

职责：

- Full Scan
- Incremental Scan
- Hash Diff

------

## File Watcher

职责：

- Create
- Delete
- Modify
- Move

监听

------

## Metadata Extractor

职责：

- project.json解析
- project.json写回

------

## CAD Analyzer

职责：

- CAD分类
- Version Chain识别

------

## Search Engine

职责：

- FTS5全文检索
- Ctrl+K搜索

------

## AI Pipeline

职责：

- Provider调用
- Prompt组装
- Metadata生成

------

# 7. Database Baseline

核心表：

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

SQLite原则：

```text
Not Source of Truth
```

仅做索引。

------

# 8. API Baseline

统一前缀：

```text
/api/v1
```

统一响应：

```json
{
  "status": "success",
  "data": {},
  "message": "",
  "meta": {}
}
```

------

# 9. UI Baseline

设计原则：

```text
Professional

Minimal

High Density

Fast
```

------

强制：

```text
Dark Mode
```

------

禁止：

- 花哨动画
- 大面积渐变
- 卡片堆叠
- 大量图表

------

# 10. Performance Targets

Dashboard：

```text
< 500ms
```

------

Projects：

```text
< 1s
```

------

Search：

```text
< 100ms
```

------

10,000+ 文件：

```text
流畅滚动
```

------

# 11. Security Baseline

禁止：

```text
API Key明文存储
```

------

必须：

```text
Credential Manager
或
AES加密
```

------

FastAPI：

```text
127.0.0.1 Only
```

------

# 12. V1 Freeze Decisions

以下内容正式冻结：

## Architecture

01 ~ 08全部文档

------

## Database

05_Database.md

------

## Frontend

06_Frontend_Architecture.md

------

## Backend

07_Backend_Architecture.md

------

## API

08_API_Specification.md

------

除重大缺陷外：

```text
禁止修改架构
禁止增加模块
禁止扩展范围
```

统一进入V2 Backlog。

------

# 13. V2 Reserved

预留但不开发：

## AI Agent

```text
/agent/run
```

------

## Semantic Search

```text
/search/semantic
```

------

## Vector Database

- FAISS
- Chroma

------

## Collaboration

多人协同

------

## Approval Workflow

在线审批

------

# 14. Success Criteria

满足以下条件即视为V1成功：

✓ 自动发现项目

✓ 自动维护索引

✓ 项目详情浏览

✓ CAD版本追踪

✓ Ctrl+K极速搜索

✓ AI Provider管理

✓ SQLite可完全重建

✓ 10,000+文件稳定运行

✓ 支持未来V2扩展

------

# Architecture Freeze Declaration

Project Vault V1.0 Architecture Freeze Effective.

Current Freeze Version:

```text
V1.0.0
```

Reference Documents:

```text
01_PRD.md

02_Information_Architecture.md

03_Design_System.md

04_Wireframe.md

05_Database.md

06_Frontend_Architecture.md

07_Backend_Architecture.md

08_API_Specification.md
```

All implementation work after this point must follow this baseline.