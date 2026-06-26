# 06_Frontend_Architecture.md Review Notes

文档名称：06_Frontend_Architecture.md

审查状态：Approved with Minor Revisions

目标版本：V1.1

------

# 修改项 01

## 数据请求层统一

### 当前问题

文档同时出现：

- SWR
- React Server Components
- Polling

但没有明确唯一标准。

------

### 建议

统一规定：

```text
Server State
=
TanStack Query
```

替换：

```text
SWR
```

------

### 原因

后续会涉及：

- Query Invalidation
- Mutation
- Optimistic Update
- Infinite Query
- Background Refetch

TanStack Query 能力明显强于 SWR。

------

### 最终标准

```text
Server State
=
TanStack Query

Global State
=
Zustand

Local State
=
useState
```

------

# 修改项 02

## 增加 API Domain Structure

### 当前问题

只有：

```text
services/
```

过于模糊。

------

### 建议补充

```text
services/

projects/

files/

drawings/

materials/

search/

ai/

settings/
```

------

### 示例

```text
projects.api.ts

drawings.api.ts

search.api.ts
```

------

### 原因

后续接口数量会超过 50 个。

提前拆分。

------

# 修改项 03

## 增加 Shared Types Layer

### 当前问题

只有：

```text
types/
```

------

### 建议拆分

```text
types/

api/

database/

ui/
```

------

### 原因

未来：

```text
Project

ProjectDTO

ProjectCardProps
```

不能混在一起。

------

# 修改项 04

## Table Architecture 明确技术选型

### 当前问题

提到了：

```text
Virtual List
```

但没指定实现。

------

### 建议增加

```text
TanStack Table

TanStack Virtual
```

------

### 原因

Projects

Files

Drawings

Materials

全部统一。

------

# 修改项 05

## 增加 Feature Folder Standard

### 当前问题

Feature Module 描述不足。

------

### 建议固定结构

```text
features/

projects/

components/

hooks/

api/

types/

utils/
```

------

### 目的

避免后期目录失控。

------

# 修改项 06

## 增加 Command Palette Store

### 当前问题

Command Palette 很重要。

但没有独立状态设计。

------

### 建议新增

```text
stores/

command-palette.store.ts
```

------

### 管理

```text
isOpen

query

selectedIndex

recentSearches
```

------

### 原因

Ctrl + K 是系统核心功能。

------

# 修改项 07

## 增加 Error Classification

### 当前问题

Error Boundary 设计不错。

但错误类型未分类。

------

### 建议新增

#### Recoverable

```text
网络错误

AI连接失败

索引超时
```

------

#### Non-Recoverable

```text
数据库损坏

Schema异常

启动失败
```

------

### 原因

Toast 和 Full Screen Error 逻辑不同。

------

# 修改项 08

## 增加 Scan Progress Global Store

### 当前问题

Scanner Sync Module 提到了。

但没落地。

------

### 建议新增

```text
stores/

scan-progress.store.ts
```

------

### 字段

```text
status

progress

currentProject

currentFile
```

------

### 原因

Dashboard

Top Progress Bar

Recent Activity

都依赖。

------

# 修改项 09

## 增加 Route Guard

### 当前问题

First Run Setup 已存在。

但没有路由逻辑。

------

### 建议新增

首次启动：

```text
/setup
```

完成后：

```text
/
```

------

### 条件

```text
root_path exists

database initialized
```

------

### 原因

避免用户进入空 Dashboard。

------

# 修改项 10

## Electron Compatibility 增加 Adapter Layer

### 当前问题

已经考虑 Electron。

很好。

但建议再抽象一层。

------

### 新增

```text
lib/system/

browser.adapter.ts

electron.adapter.ts
```

------

### 对外统一接口

```text
openFolder()

openFile()

copyPath()
```

------

### 原因

未来切换：

```text
Browser
↓
Electron
↓
Tauri
```

不需要改业务代码。

------

# 修改项 11

## 增加 Frontend Logging Strategy

### 当前问题

没有日志策略。

------

### 新增

```text
lib/logger/
```

------

### 分类

```text
info

warn

error

debug
```

------

### V1

浏览器 Console。

------

### V2

接入系统日志。

------

# 修改项 12

## 增加 Theme Strategy

### 当前问题

虽然 V1 强制 Dark。

但未来一定会开放。

------

### 建议

保留：

```text
ThemeProvider
```

架构。

------

### 当前

```text
Dark
```

------

### 未来

```text
Dark

Light

System
```

------

### 原因

以后不用重构 Layout。

------

# 最终状态

```text
06_Frontend_Architecture.md

Approved
```

------

# 冻结范围

以下文档可冻结：

01_PRD.md

02_IA.md

03_Design_System.md

04_Wireframe.md

05_Database.md

06_Frontend_Architecture.md

------

进入下一阶段：

07_Backend_Architecture.md

```
目标：

定义：

- FastAPI架构
- Scanner架构
- SQLite访问层
- AI Provider架构
- File Watcher
- Search Engine
- Background Tasks
- API设计规范

这是整个系统真正的核心。
```