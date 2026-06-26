# 09_Backend_API_Implementation_Plan

项目名称：Project Vault V1.0
文档状态：V1.0
阶段定位：Backend Implementation Planning

---

# 1. Objective

本阶段目标：

将 08_API_Specification.md
正式映射为可实现的 FastAPI 服务架构。

注意：

本阶段仅定义：

- API Router
- Service
- Repository
- DTO
- 生命周期

不涉及具体代码实现。

---

# 2. Backend Layer Architecture

采用四层结构。

Frontend
↓

API Router

↓

Service Layer

↓

Repository Layer

↓

SQLite

---

职责划分：

API Router
=
接收请求
参数校验
返回标准响应

Service
=
业务逻辑

Repository
=
SQL操作

SQLite
=
数据存储

---

禁止：

Router直接写SQL

禁止：

Router直接操作文件系统

禁止：

Router直接调用AI

---

# 3. Standard Directory Layout

app/

├─ api/
│
├─ dashboard/
│
├─ projects/
│
├─ files/
│
├─ drawings/
│
├─ search/
│
├─ ai/
│
├─ settings/
│
├─ scanner/
│
└─ history/

├─ services/

├─ repositories/

├─ schemas/

├─ core/

├─ db/

├─ engine/

├─ ai/

└─ workers/

---

# 4. API Router Mapping

## Dashboard

dashboard_router

负责：

GET /dashboard/metrics

GET /dashboard/recent-projects

---

## Projects

projects_router

负责：

GET /projects

GET /projects/{id}/overview

POST /projects/{id}/favorite

---

## Files

files_router

负责：

GET /projects/{id}/files

POST /system/explorer/open

---

## Drawings

drawings_router

负责：

GET /projects/{id}/drawings

GET /drawings/center

---

## Search

search_router

负责：

GET /search

---

## AI

ai_router

负责：

GET /ai/providers

PUT /ai/providers/{id}

POST /ai/providers/{id}/test-connection

---

## Scanner

scanner_router

负责：

GET /scanner/status

POST /scanner/scan

POST /scanner/rebuild

---

## Settings

settings_router

负责：

GET /settings

PUT /settings

---

## History

history_router

负责：

GET /history

---

# 5. Service Layer Mapping

每个Router对应独立Service。

例如：

ProjectsRouter

↓

ProjectsService

---

ProjectsService职责：

项目列表查询

项目详情查询

收藏状态修改

项目统计

---

禁止：

Service跨模块直接访问数据库

必须通过Repository

---

# 6. Repository Layer Mapping

Repository仅负责：

SQL

SQLite事务

FTS查询

分页

排序

---

ProjectsRepository

负责：

projects表

---

FilesRepository

负责：

files表

---

DrawingsRepository

负责：

drawings表

---

MetadataRepository

负责：

ai_metadata表

---

SettingsRepository

负责：

system_settings表

---

SearchRepository

负责：

FTS5

---

HistoryRepository

负责：

scan_history

---

# 7. DTO Strategy

所有API必须拥有：

Request DTO

Response DTO

---

示例：

ProjectOverviewResponse

ProjectListResponse

FileItemResponse

DrawingItemResponse

ProviderResponse

---

禁止：

返回裸Dict

禁止：

返回Any

---

全部使用：

Pydantic

---

# 8. Standard Response Envelope

所有接口统一：

{
  "status": "success",
  "data": {},
  "message": "",
  "meta": {}
}

---

异常：

{
  "status": "error",
  "data": null,
  "message": "Project Not Found",
  "meta": {}
}

---

禁止返回非标准结构

---

# 9. Dependency Injection

统一使用：

FastAPI Depends()

注入：

Database

Settings

Services

Repositories

---

禁止：

全局Singleton数据库对象

---

# 10. SQLite Session Strategy

系统采用：

aiosqlite

异步连接

---

生命周期：

App Startup

↓

Create Connection

↓

Reuse

↓

App Shutdown

↓

Close

---

开启：

PRAGMA journal_mode=WAL

PRAGMA foreign_keys=ON

PRAGMA synchronous=NORMAL

---

# 11. Error Handling

统一异常体系：

ProjectNotFound

FileNotFound

InvalidPath

ProviderConnectionFailed

DatabaseLocked

ScannerBusy

---

FastAPI统一捕获

转换为：

HTTPException

---

# 12. Logging Integration

所有API记录：

Request

Response Time

Error

---

写入：

logs/api.log

---

重大事件：

同时写入

scan_history

---

# 13. OpenAPI Generation

启动时自动生成：

/docs

/redoc

/openapi.json

---

作为：

Frontend TypeScript

类型生成源

---

# 14. Performance Rules

所有列表接口：

必须分页

---

默认：

page=1

limit=50

---

最大：

limit=500

---

禁止：

全表返回

---

# 15. V1 Freeze Scope

本阶段完成后：

后端API骨架冻结。

允许新增：

字段

DTO

Repository方法

---

禁止修改：

API路径

HTTP Method

响应结构

路由层级

---

作为：

10_Database_Implementation

11_Core_Engine_Implementation

12_Release_Plan

的基础契约。