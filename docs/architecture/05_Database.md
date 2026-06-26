# 05_Database.md
**项目名称**：Project Vault V1.0

**文档状态**：V1.1 Frozen **审查状态**：Approved with Minor Revisions **设计基调**：Professional, Minimal, High Density, Fast **架构核心**：Local File System + project.json (Source of Truth) -> SQLite (Index Cache) 

## 1. Database Philosophy (数据库哲学)
Project Vault 的数据库设计遵循“抛弃即重建 (Disposable & Rebuildable)”的核心理念 。

- **非权威性**：SQLite 绝不作为业务数据的主体，所有具有业务价值的元数据必须落地为项目根目录下的 project.json 文件 。
- **纯索引定位**：SQLite 仅用于解决本地文件系统遍历慢、关系查询弱、无法全文检索的痛点，它充当的是一个带有关联关系的高速缓存层 。
- **高密度查询优先**：数据库表结构设计向读取速度倾斜，冗余部分字段以减少多表 Join 带来的性能损耗，确保 Dashboard 和 Projects 列表的秒级加载 。

## 2. Data Flow (数据流向)

- **上游 (Source)**：本地操作系统目录、文件修改时间、project.json 内容 。
- **中游 (Scanner/Indexer)**：后台 Python/FastAPI 扫描引擎监听或定时遍历本地变更，提取摘要与路径 。
- **下游 (Database)**：将提取的信息写入 SQLite 形成关系映射与 FTS5 全文检索引擎 。
- **终端 (Frontend)**：Next.js 前端直接向 SQLite 查询视图数据，实现极速的过滤、排序和全局检索 。

## 3. SQLite Schema (结构总览)
数据库采用扁平化的雪花模型设计 。核心表 `projects` 作为锚点，衍生出 `files`、`drawings`、`materials` 等核心资产表，并新增 `project_tags`、`favorites`、`app_metadata` 等辅助关联与元数据表，以支撑复杂的查询与扩展 。

**底层 PRAGMA 配置**：

- `PRAGMA journal_mode = WAL;`：提升本地高频读写下的并发能力。
- `PRAGMA auto_vacuum = INCREMENTAL;`：允许后台维护任务渐进式回收空闲页，避免全量 `VACUUM` 长时间锁库。

## 4. projects 表

**定位**：项目列表的高频索引，数据映射自文件夹结构与 `project.json`。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| id | TEXT | Primary Key，通常使用项目目录的 Hash 或 UUID |
| project_hash | TEXT | 用于扫描器快速判断是否需要重建项目索引，推荐使用 SHA256 (基于文件数量、更新时间及JSON组合计算) DOCX+ 3 |
| project_path | TEXT | 本地绝对路径，仅作为当前物理位置记录，不作为项目唯一性锚点 |
| name | TEXT | Index，项目名称 |
| type | TEXT | 项目类型 (如室内设计、SI) |
| phase | TEXT | 当前阶段 (如 Concept, Completed) |
| status | TEXT | 项目统一健康状态展示 (healthy / warning / error) DOCX+ 3 |
| manager | TEXT | 负责人 |
| file_count | INTEGER | 冗余字段，用于卡片极速展示文件总数 |
| cad_count | INTEGER | 冗余字段，CAD 总数 |
| material_count | INTEGER | 冗余字段，材料总数 |
| last_updated_at | DATETIME | 目录或文件最后变更时间 |
| created_at | DATETIME | 项目入库时间 |

**唯一性规则**：项目唯一身份以 `id` 为准，`id` 必须来自 `project.json` 内固化的 `project_id`。当外接硬盘盘符变化或项目根目录移动时，只更新 `project_path`，不得按旧路径触发级联删除。

## 5. files 表

**定位**：全局文件字典，用于 Files Tab 的快速展示与路径寻址 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| id | TEXT | Primary Key |
| project_id | TEXT | Foreign Key，关联 projects.id |
| file_hash | TEXT | 用于重复文件、版本及 CAD 演进识别，为兼顾性能推荐优先使用 SHA1 算法 DOCX+ 2 |
| relative_path | TEXT | 相对于项目根目录的完整相对路径，项目内唯一 |
| relative_dir | TEXT | 相对于项目根目录的目录部分 |
| file_name | TEXT | Index，包含扩展名的文件名 |
| extension | TEXT | Index，扩展名 |
| size_bytes | INTEGER | 文件大小 |
| last_modified | DATETIME | 文件最后修改时间 |

**路径寻址规则**：`files` 表不存储文件绝对路径。运行时物理路径由 `projects.project_path + files.relative_path` 动态解析，子表如 `drawings`、`materials` 只通过 `file_id` 关联文件记录。

## 6. drawings 表

**定位**：CAD Center 与 Drawings Tab 的专项索引，重构后强化了版本链条追踪能力 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| id | TEXT | Primary Key |
| project_id | TEXT | Foreign Key，关联 projects.id |
| file_id | TEXT | Foreign Key，Unique 关联 files.id |
| dwg_category | TEXT | CAD 分类 |
| version_group | TEXT | 用于串联 CAD Version Chain 的同名分组标识 |
| version_number | INTEGER | CAD 演进的版本数字 DOCX+ 1 |
| is_current | BOOLEAN | 标识是否为当前最新可用图纸 DOCX+ 1 |
| parent_drawing_id | TEXT | 记录父级图纸 ID，支持基于 CAD Timeline 的版本回溯查询 DOCX+ 1 |
| last_modified | DATETIME | 冗余字段，图纸修改时间 |

## 7. materials 表

**定位**：Materials Tab 的专项索引 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| id | TEXT | Primary Key |
| project_id | TEXT | Foreign Key，关联 projects.id |
| file_id | TEXT | Foreign Key，Unique 关联 files.id |
| material_type | TEXT | 图片、PDF、Excel 等分类 |

## 8. ai_metadata 表

**定位**：将 `project.json` 中嵌套的 AI 结构化数据扁平化，提供细粒度的模型追踪展示与检索支持 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| project_id | TEXT | Primary Key / Foreign Key 关联 projects.id |
| summary | TEXT | AI 摘要段落 |
| core_needs | TEXT | JSON String 格式存储的核心需求 |
| special_reqs | TEXT | JSON String 格式存储的特殊要求 |
| risks | TEXT | JSON String 格式存储的风险提示 |
| lessons | TEXT | JSON String 格式存储的经验总结 |
| provider_name | TEXT | 生成内容的模型提供商名称 DOCX |
| model_name | TEXT | 执行任务的具体模型名称 DOCX |
| generated_at | DATETIME | 数据在系统中的生成时间 DOCX |
| metadata_version | TEXT | AI 数据的迭代版本号，用于重新生成各类标签及摘要时保留历史追溯能力 DOCX+ 1 |

## 9. project_tags 表

**定位**：替代原先采用 JSON 存储导致统计困难的问题，提供对标签的高效管理和拓展能力 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| project_id | TEXT | Foreign Key，关联至项目主键 DOCX+ 1 |
| tag_name | TEXT | 标签名称内容，支持基于此项实现标签统计云或快速分析 DOCX+ 1 |

## 10. ai_providers 表

**定位**：AI Center 模型管理，绝不存储明文 API Key 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| id | TEXT | Primary Key |
| name | TEXT | Provider 名称 |
| base_url | TEXT | 接口地址 |
| default_model | TEXT | 默认模型版本号 |
| is_enabled | BOOLEAN | 启用状态 |
| key_reference | TEXT | 凭据存储标识，用于调用本地安全机制获取密钥 |

## 11. scan_history 表

**定位**：提供 Dashboard 活动展示，增加关键扫描日志辅助后期排查问题 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| id | TEXT | Primary Key |
| project_id | TEXT | Index，可为空标识全局活动 |
| event_type | TEXT | Index，记录详细的事件类型 |
| duration_ms | INTEGER | 本次扫描动作的耗时 |
| status | TEXT | Success, Warning, Error |
| created_at | DATETIME | 事件发生时间 |
| scanner_version | TEXT | 执行此次任务的扫描引擎版本 DOCX |
| affected_files | INTEGER | 记录扫描过程中涉及影响的具体文件数 DOCX |
| message | TEXT | 日志内容或问题抛出信息 DOCX |

**Retention Policy (日志数据保留策略)**：

- `scan_history` 只用于近期活动展示与排障，不作为业务依赖表。
- 普通 `Info` / `Debug` 级记录最多保留 30 天。
- 单表建议硬上限为 50,000 条，超出后按 FIFO 异步淘汰普通记录。
- `Warning` / `Error` 级记录最长保留 180 天，用于问题追溯。

## 12. system_settings 表

**定位**：设置系统全局配置，通过分目录形式提升未来页面维护效率 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| key | TEXT | Primary Key |
| value | TEXT | JSON String 或纯文本 |
| category | TEXT | 设置的类别属性，如 general, search, appearance 等匹配二级导航的模块分类 DOCX+ 2 |
| updated_at | DATETIME | 最后一次的变更时间 |

## 13. app_metadata 表

**定位**：专用于隔离出系统级元数据环境，保证普通用户设置数据的纯净性 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| key | TEXT | Primary Key，存放如 schema_version, database_build_time 等底层运行信息 DOCX+ 1 |
| value | TEXT | 具体元数据值 DOCX |

## 14. favorites 表

**定位**：打通多实体的独立收藏体系，使未来的收藏扩展空间更大 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| identity_type | TEXT | 指定实体来源类型，支持 Project, File, CAD, Material 四大门类 DOCX+ 1 |
| entity_id | TEXT | 对应主键 ID 映射 DOCX |
| created_at | DATETIME | 收藏操作的激活时间 DOCX |

## 15. schema_migrations 表

**定位**：增强结构化版本控制链路能力，提供追查底层数据库升级问题的排查依据 。

| 字段名 | 数据类型 | 约束/说明 |
| --- | --- | --- |
| version | TEXT | 系统执行迁移的版本批次号 DOCX |
| applied_at | DATETIME | 执行版本迁移动作的具体日期时间 DOCX |

## 16. FTS5 Search Index (全文检索)

**定位**：驱动 Ctrl + K 全局搜索的高速公路 。依据实际使用习惯，强化搜索命中的分层权重规划 。

- **权重阶梯设置**：
  - 最高权重目标：重点匹配 Project Name 及 File Name 。
  - 中等权重目标：覆盖辅助识别如 Tags 和 CAD Name 。
  - 最低权重目标：仅作为模糊查找补充的 AI Summary 和 Description 。
- **FTS_Global 虚拟表列**：`entity_id`, `entity_type`, `title`, `content`, `project_id`。

## 17. 索引策略 (Indexing Strategy)

- **主键与外键索引**：所有 `id` 及其关联键自动建立 B-Tree 索引 。
- **高频过滤索引**：为支持列表高密度渲染建立联合索引 。
- **路径查询索引**：废弃 `file_path` 唯一索引，改为 `UNIQUE(project_id, relative_path)`；`project_path` 仅做普通索引，用于运行时定位与迁移检测。

## 18. project.json 同步策略 (Sync Strategy)
严格的单向流动控制 ：

- **读取优先**：被外部修改时触发覆盖 SQLite 数据 。
- **写入控制**：系统内修改时必须优先写入物理磁盘，再更新 SQLite 。
- **容错机制**：如 JSON 解析失败引发损坏，由系统保留历史健康数据，并在 `projects` 表的 `status` 字段统一标记成 `error` 状态同时向 Dashboard 发送警告 。

## 19. 删除策略 (Deletion Strategy)

- **硬删除映射**：只有在确认 `project_id` 已不可达且不属于盘符漂移或项目迁移时，才允许在 SQLite 触发 DELETE 。
- **级联删除**：开启外键约束，当主记录删除时抹除所有从属记录 。

## 20. 缓存策略 (Caching Strategy)

- **SQLite 即 Cache**：无需引入 Redis，开启 WAL 模式应对高频查询 。
- **内存态应用**：针对高频统计使用前端 SWR 短效缓存抵消数据库压力 。

## 21. 数据恢复策略 (Data Recovery Strategy)
零恐慌恢复机制 ：

- 只要本地资料和 `project.json` 未丢失，实质性数据即安全 。
- **恢复操作**：提供“重建索引”核心指令，抹除并重新扫描灌库 。

## 22. Schema Versioning (结构版本控制)

- 不采用复杂的 ORM 流程，而是借助原生功能 `PRAGMA user_version` 及新增的 `schema_migrations` 表实现轻量化处理，有效管理每次升级和排查潜在迁移异常 。
