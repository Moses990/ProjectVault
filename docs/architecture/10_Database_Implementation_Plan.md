# 10_Database_Implementation_Plan

项目名称：Project Vault V1.0
文档状态：V1.0 Frozen Draft
阶段定位：Database Implementation Planning

------

# 1. Objective

本阶段目标：

将《05_Database.md》定义的逻辑模型转换为实际可运行的 SQLite 数据库实现方案。

本文件定义：

- Schema初始化
- Index创建
- FTS5实现
- Repository映射
- Migration机制
- Backup策略
- Rebuild策略

不涉及业务代码实现。

------

# 2. Database Lifecycle

数据库生命周期：

```text
Application Start
        ↓
Database Check
        ↓
Schema Create / Upgrade
        ↓
Index Create
        ↓
FTS Initialize
        ↓
Application Running
        ↓
Incremental Update
        ↓
Shutdown
```

------

# 3. Database Location Strategy

默认位置：

```text
.project_vault/
    database/
        project_vault.db
```

禁止：

```text
项目目录内部

用户业务文件夹内部
```

数据库必须与项目数据分离。

------

# 4. SQLite Initialization

应用启动执行：

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;
PRAGMA cache_size=-64000;
```

目标：

- 提升读取性能
- 保证事务安全
- 支持高频查询

------

# 5. Schema Deployment Order

建表顺序严格固定：

```text
projects

files

drawings

materials

ai_metadata

ai_providers

scan_history

system_settings

fts_global
```

禁止乱序创建。

------

# 6. Projects Table Implementation

核心主表。

Primary Key：

id

Unique：

project_path

Required Index：

idx_projects_name

idx_projects_phase

idx_projects_type

idx_projects_updated

Composite Index：

idx_projects_phase_updated

(
phase,
last_updated_at
)

------

# 7. Files Table Implementation

唯一文件字典。

Primary Key：

id

Unique：

file_path

Required Index：

idx_files_extension

idx_files_modified

idx_files_project

Composite：

idx_files_project_modified

(
project_id,
last_modified
)

------

# 8. Drawings Table Implementation

CAD专项索引。

Required Index：

idx_drawings_category

idx_drawings_project

idx_drawings_version_group

Composite：

idx_drawings_group_modified

(
version_group,
last_modified
)

------

# 9. Materials Table Implementation

材料文件索引。

Required Index：

idx_materials_type

idx_materials_project

------

# 10. AI Metadata Table Implementation

一项目一记录。

Primary Key：

project_id

禁止额外主键。

原因：

严格对应 project.json

------

# 11. AI Providers Table Implementation

Provider配置存储。

Required Index：

idx_provider_enabled

禁止：

存储明文API Key

仅保存：

key_reference

------

# 12. Scan History Table Implementation

高频写入表。

Required Index：

idx_history_project

idx_history_type

idx_history_created

Composite：

idx_history_project_created

(
project_id,
created_at
)

------

# 13. System Settings Table

Key Value结构。

Primary Key：

key

不允许重复记录。

------

# 14. FTS5 Implementation

建立：

fts_global

字段：

entity_id

entity_type

title

content

project_id

------

支持：

Projects

Files

Drawings

Materials

AI Metadata

------

# 15. FTS Population Strategy

V1采用：

Application Managed Sync

即：

Scanner负责更新FTS

不采用：

SQLite Trigger

原因：

逻辑更清晰

便于未来迁移向量数据库。

------

# 16. Search Weight Strategy

权重：

# Title

10

# Filename

8

# Tags

5

# Summary

3

# Content

1

确保：

文件名优先级高于摘要内容。

------

# 17. Repository Mapping

ProjectsRepository

对应：

projects

------

FilesRepository

对应：

files

------

DrawingsRepository

对应：

drawings

------

MaterialsRepository

对应：

materials

------

MetadataRepository

对应：

ai_metadata

------

ProviderRepository

对应：

ai_providers

------

HistoryRepository

对应：

scan_history

------

SettingsRepository

对应：

system_settings

------

SearchRepository

对应：

fts_global

------

# 18. Pagination Standard

所有列表查询：

必须分页

默认：

page = 1

limit = 50

最大：

limit = 500

禁止：

SELECT * 全表返回

------

# 19. Transaction Rules

必须使用事务：

项目新增

项目删除

AI Metadata更新

FTS重建

全量扫描

------

原则：

业务更新成功后提交

失败立即Rollback

------

# 20. Hash Diff Storage

新增字段：

files.file_hash

类型：

TEXT

用途：

增量扫描比对

Hash组成：

file_path
+
size
+
mtime

用于快速发现变更。

------

# 21. Backup Strategy

数据库备份目录：

```text
.project_vault/
    backups/
```

格式：

```text
project_vault_20260624.db
```

保留：

最近10份

自动清理旧备份。

------

# 22. Database Recovery

恢复流程：

```text
停止扫描器

关闭数据库

替换DB文件

重新启动

校验Schema

恢复完成
```

------

# 23. Rebuild Index Strategy

执行：

POST /scanner/rebuild

流程：

```text
暂停Watcher

清空业务表

重新扫描

重建FTS

校验数据

恢复Watcher
```

Settings

AI Providers

必须保留。

------

# 24. Schema Versioning

利用：

PRAGMA user_version

记录版本。

V1：

```sql
PRAGMA user_version = 1;
```

------

升级流程：

```text
检查版本

执行DDL

更新user_version

完成
```

------

# 25. Migration Structure

目录：

```text
db/
 ├─ schema_v1.sql
 ├─ upgrade_v1_to_v2.sql
 ├─ upgrade_v2_to_v3.sql
```

原则：

永远增量升级。

禁止直接修改旧Schema文件。

------

# 26. Database Health Check

启动时检查：

数据库存在

Schema完整

FTS完整

索引完整

user_version正确

------

失败：

进入Recovery Mode

提示用户执行：

Rebuild Index

------

# 27. Performance Targets

项目数量：

1000+

文件数量：

100000+

CAD数量：

30000+

------

性能目标：

Dashboard

< 100ms

Projects List

< 200ms

Search

< 100ms

Project Detail

< 150ms

------

# 28. Freeze Scope

本阶段完成后：

数据库结构正式冻结。

允许：

新增字段

新增索引

新增FTS列

------

禁止：

修改主键策略

修改表关系

修改Source of Truth原则

------

作为：

11_Core_Engine_Implementation_Plan

的唯一数据库实施依据。