# 11_Core_Engine_Implementation_Plan

项目名称：Project Vault V1.0
文档状态：V1.0 Frozen Draft
阶段定位：Core Runtime Engine Planning

------

# 1. Objective

本阶段定义：

Project Vault运行时核心引擎。

负责：

- 文件发现
- 项目识别
- 增量同步
- 元数据提取
- CAD分析
- AI处理
- 索引维护

------

核心原则：

业务数据来源：

project.json

数据库：

SQLite Cache

引擎：

唯一的数据流控制中心

------

# 2. Runtime Architecture

整体结构：

```text
File System
      ↓

File Watcher
      ↓

Event Queue
      ↓

Scanner Engine
      ↓

Metadata Extractor
      ↓

CAD Analyzer
      ↓

SQLite

      ↓

FTS Builder

      ↓

Frontend API
```

------

# 3. Engine Modules

系统划分为：

```text
Scanner Engine

Watcher Engine

Metadata Extractor

CAD Analyzer

AI Pipeline

Task Manager

FTS Builder
```

------

每个模块独立。

禁止直接互相调用。

统一通过：

Task Queue

通信。

------

# 4. Scanner Engine

系统核心。

职责：

发现项目

扫描文件

更新索引

触发分析

------

输入：

项目根目录

------

输出：

SQLite记录

------

支持：

Full Scan

Incremental Scan

Single Project Scan

Candidate Discovery Scan

Relocation Scan

------

项目位移与盘符漂移处理：

```text
发现 project.json
↓
读取 project_id
↓
查询 projects.id
↓
命中但 project_path 不同
↓
UPDATE projects SET project_path = current_path WHERE id = project_id
```

约束：

- 该场景视为 Relocate Event，不允许触发删除。
- files、drawings、materials 只依赖 `relative_path` 与 `file_id`，因此项目迁移时不批量改写子记录。
- 路径拼接统一交给 Repository 层，禁止 Scanner 直接硬编码绝对文件路径。

# 5. Full Scan Workflow

触发条件：

首次启动

重建索引

数据库损坏

------

流程：

```text
Load Root Path

↓

Find Projects

↓

Parse project.json

↓

Scan Files

↓

Build Metadata

↓

Build Drawings

↓

Build FTS

↓

Finish
```

------

# 6. Incremental Scan Workflow

默认工作模式。

------

输入：

Project Path

------

步骤：

```text
读取SQLite记录

↓

读取文件系统状态

↓

Hash Diff

↓

发现变化

↓

仅更新变化项

↓

更新FTS
```

------

目标：

避免全盘扫描。

------

# 7. Project Discovery

项目识别规则：

必须存在：

project.json

------

发现：

```text
root/

  ProjectA/

      project.json

  ProjectB/

      project.json
```

即视为项目。

------

禁止：

根据目录名猜测项目。

------

候选项目发现模式：

触发：

用户点击导入现有项目

或数据库为空的首次启动流程

------

流程：

```text
Load Root Path
↓
List Depth=1 Directories
↓
Filter folders without project.json
↓
Return candidates to API
```

约束：

- 只扫描第一层目录，避免深层遍历造成界面长时间等待。
- 发现候选目录时不写数据库，不创建 `project.json`。
- 只有用户确认初始化后，才进入写入与首次扫描流程。

# 7.1 Project Initialization

将普通文件夹转换为 Vault 项目。

------

输入：

```text
paths[]
default_tags[]
```

------

动作：

1. 校验目录存在且可写。
2. 校验目录内不存在 `project.json`。
3. 生成稳定 `project_id` 与默认元数据。
4. 原子写入 `project.json`。
5. 触发 Single Project Scan。

------

# 8. Hash Diff Engine

增量扫描核心。

------

生成：

project_hash

file_hash

------

推荐组成：

```text
path

mtime

size
```

------

用途：

快速发现变化。

------

# 9. Watcher Engine

毫秒级监听。

------

监听：

Create

Modify

Delete

Move

------

作用：

发现变化

不做分析

------

发现变化后：

提交：

Event Queue

------

禁止：

Watcher直接写数据库。

------

文件监听黑名单：

事件进入 Event Queue 前必须先过滤无价值临时文件。

内置规则：

```text
*.bak
*.sv$
*.ac$
~$*.docx
~$*.xlsx
.DS_Store
Thumbs.db
desktop.ini
.tmp/
.cache/
```

目的：

- 减少 CAD 和 Office 自动保存产生的无效事件。
- 降低 SQLite 写锁冲突。
- 防止 scan_history 被临时文件日志撑爆。

# 9.1 Watcher Safety Boundary

Watcher 只负责产生事件，不负责判断业务删除。

当路径消失时，必须交由 Scanner 读取 `project_id` 与当前根目录状态后再决定是删除、迁移还是暂时离线。

------

# 10. Event Queue

系统总线。

------

采用：

Asyncio Queue

------

事件：

```text
PROJECT_CREATED

PROJECT_UPDATED

FILE_CREATED

FILE_UPDATED

FILE_DELETED

PROJECT_DELETED

AI_REQUESTED
```

------

统一进入队列。

------

# 11. Event Deduplication

防抖机制。

------

场景：

CAD保存

可能产生：

20~100个事件

------

策略：

2秒窗口

合并同一路径事件

------

结果：

一次扫描

替代

几十次扫描

------

# 12. Metadata Extractor

负责：

project.json

------

读取：

项目信息

AI信息

标签

统计

------

输出：

projects

ai_metadata

------

# 13. Write Back Strategy

未来AI更新摘要时：

流程：

```text
更新project.json

↓

写盘成功

↓

更新SQLite

↓

更新FTS
```

------

禁止：

先写SQLite

再写project.json

------

# 14. CAD Analyzer

CAD专项分析器。

------

输入：

DWG文件

------

输出：

dwg_category

version_group

version_number

------

# 15. Drawing Classification

分类：

```text
PLAN

ELEVATION

CEILING

DETAIL

CONSTRUCTION

UNKNOWN
```

------

来源：

文件名规则

关键词字典

------

# 16. Version Chain Builder

识别：

```text
v1

v2

v3

rev1

rev2

final
```

------

生成：

version_group

version_number

is_current

------

用于：

CAD Center

Version Timeline

------

# 17. Material Analyzer

识别：

PDF

Excel

Image

Word

------

构建：

materials表

------

# 18. FTS Builder

负责：

维护fts_global

------

输入：

Projects

Files

Drawings

Materials

Metadata

------

输出：

FTS记录

------

# 19. FTS Rebuild

触发：

重建索引

------

流程：

```text
Delete FTS

↓

Rebuild

↓

Optimize

↓

Finish
```

------

# 20. AI Pipeline

V1保持轻量。

------

职责：

生成：

Summary

Tags

Core Needs

Special Requirements

Risks

Lessons

------

输入：

项目文件

项目结构

用户资料

------

输出：

project.json

------

# 21. Provider Selection

流程：

```text
Get Default Provider

↓

Validate

↓

Generate

↓

Write Back
```

------

支持：

OpenAI Compatible

LM Studio

Ollama

OpenRouter

Gemini

Claude

------

# 22. AI Task Execution

AI任务：

必须异步。

------

禁止：

API同步等待。

------

流程：

```text
Create Task

↓

Queue

↓

Execute

↓

Save Result

↓

Update Status
```

------

# 23. Task Manager

统一调度器。

------

负责：

Scan Task

AI Task

Rebuild Task

Database Maintenance Task

------

状态：

```text
QUEUED

RUNNING

SUCCESS

FAILED

CANCELLED
```

------

# 23.1 Database Maintenance Task

数据库空间维护任务。

------

触发：

```text
每日 03:00
或启动时发现距上次维护超过 7 天
```

------

动作：

1. 清理 `scan_history` 中超过 30 天的普通 Info / Debug 记录。
2. 保留 Warning / Error 记录最长 180 天。
3. 当记录超过 50,000 条时，按 FIFO 淘汰普通记录。
4. 执行 `PRAGMA incremental_vacuum;` 回收空闲页；必要时由用户确认后执行全量 `VACUUM;`。

------

# 24. Task Priority

优先级：

```text
HIGH

Single Project Scan

MEDIUM

AI Generation

LOW

Full Rebuild
```

------

避免：

全量扫描阻塞用户操作。

------

# 25. Scan Progress Tracking

实时记录：

```text
当前项目

当前文件

总文件数

完成数量

百分比
```

------

提供：

Scanner API

前端轮询

------

# 26. Health Monitor

持续监控：

Watcher

SQLite

Task Queue

AI Provider

------

异常：

自动记录日志。

------

# 27. Recovery Strategy

当引擎异常：

```text
停止任务

↓

保存状态

↓

释放资源

↓

重启模块
```

------

避免整个系统退出。

------

# 28. Logging Strategy

独立日志：

```text
logs/

scanner.log

watcher.log

ai.log

tasks.log
```

------

禁止：

所有日志混写。

------

# 29. Performance Targets

目标：

项目数量：

1000+

文件：

100000+

------

扫描：

增量扫描

< 5秒

------

项目打开：

< 200ms

------

FTS搜索：

< 100ms

------

# 30. Engine Freeze Scope

本阶段完成后：

运行时架构冻结。

允许：

新增Analyzer

新增AI能力

新增Provider

------

禁止：

修改核心数据流

```text
File System

↓

Watcher

↓

Queue

↓

Scanner

↓

SQLite

↓

FTS
```

------

作为：

12_Release_Deployment_Plan

以及

Project Vault V2

的核心运行时基础。
