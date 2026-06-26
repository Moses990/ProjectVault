# 12_Release_Deployment_Plan

项目名称：Project Vault V1.0
文档状态：V1.0 Frozen Draft
阶段定位：Release & Deployment Planning

------

# 1. Objective

本阶段定义：

Project Vault V1.0

从开发环境

进入正式可交付产品

所需的：

- 构建
- 打包
- 部署
- 升级
- 备份
- 恢复

标准流程。

------

# 2. Release Philosophy

核心原则：

Local First

Zero Dependency

Easy Recovery

------

用户不需要：

Python环境

Node环境

SQLite环境

------

最终交付：

一个桌面应用。

------

# 3. Release Targets

V1支持：

Windows 10

Windows 11

------

最低要求：

```text
CPU:
4 Core

RAM:
8 GB

Storage:
10 GB Free Space
```

------

推荐：

```text
CPU:
8 Core+

RAM:
16 GB+

SSD
```

------

# 4. Deployment Modes

支持两种模式：

------

Development

```text
Frontend

Next.js

Backend

FastAPI

Database

SQLite
```

------

Production

```text
Desktop App

(Tauri Preferred)

↓

FastAPI

↓

SQLite
```

------

# 5. Packaging Strategy

V1推荐：

Tauri

------

原因：

```text
安装包小

内存占用低

启动快

原生文件系统支持好
```

------

不推荐：

Electron

原因：

资源占用过大。

------

# 5.1 Python Backend Sidecar Strategy

Tauri 只作为桌面容器与系统能力桥接层，FastAPI 后端必须以 Sidecar 方式随应用启动与退出。

------

后端打包：

```text
FastAPI
↓
PyInstaller / Nuitka
↓
backend-x86_64-pc-windows-msvc.exe
```

要求：

- 使用独立虚拟环境打包，避免将开发依赖带入发布包。
- Windows 与 macOS 分别产出平台匹配的可执行文件。
- Sidecar 可执行文件纳入 Tauri `externalBin` 配置。

------

动态端口：

```text
Tauri Main Process
↓
Ask OS for free port
↓
Start Python Sidecar with --port
↓
Inject window.__BACKEND_PORT__
↓
Frontend calls http://127.0.0.1:{port}
```

约束：

- 禁止硬编码固定端口 `8000` 作为发布环境唯一端口。
- 前端 API 层必须从运行时注入值读取端口。

------

生命周期守护：

- Tauri 启动时拉起 Python Sidecar。
- 应用退出或主窗口关闭时必须终止 Sidecar 进程。
- 崩溃恢复流程需要检测并清理孤儿 Python 进程。

------

# 6. Runtime Directory Structure

部署后：

```text
ProjectVault/

├─ ProjectVault.exe

├─ database/

│   project_vault.db

├─ logs/

├─ backups/

├─ config/

└─ runtime/
```

------

禁止：

数据库写入Program Files。

------

# 7. First Run Setup

首次启动：

检测：

```text
Database

Config

Root Path
```

------

若不存在：

进入：

/setup

------

用户必须配置：

项目根目录

------

完成后：

自动初始化数据库。

------

# 8. Database Initialization

首次运行：

执行：

```text
Create DB

↓

Create Schema

↓

Create Indexes

↓

Create FTS

↓

Save Settings
```

------

完成后进入Dashboard。

------

# 9. Upgrade Strategy

版本升级：

保留：

```text
project_vault.db

settings

providers
```

------

升级流程：

```text
Check Version

↓

Backup DB

↓

Migration

↓

Validate

↓

Start
```

------

# 10. Rollback Strategy

升级失败：

自动：

```text
Restore Backup

↓

Rollback Version

↓

Restart
```

------

保证：

零数据丢失。

------

# 11. Configuration Management

配置文件：

```text
config/settings.json
```

------

仅保存：

应用配置。

------

禁止：

保存业务数据。

------

业务数据：

必须：

project.json

------

# 12. Backup Strategy

自动备份：

数据库

配置

------

频率：

每日一次

------

保留：

最近10份

------

格式：

```text
backup_2026_06_24.zip
```

------

# 13. Restore Strategy

用户可执行：

Restore Backup

------

流程：

```text
选择备份

↓

关闭服务

↓

恢复数据库

↓

恢复配置

↓

启动服务
```

------

# 14. Rebuild Index Strategy

系统核心恢复能力。

------

触发：

Settings

↓

Rebuild Index

------

流程：

```text
暂停Watcher

↓

清空业务索引

↓

全量扫描

↓

重建FTS

↓

恢复Watcher
```

------

保留：

settings

providers

------

# 15. Logging Deployment

日志目录：

```text
logs/
```

------

文件：

```text
app.log

scanner.log

watcher.log

ai.log

tasks.log
```

------

自动轮转。

------

# 16. Monitoring Strategy

V1不引入：

Prometheus

Grafana

ELK

------

采用：

本地日志

- 

Health Check API

------

即可满足需求。

------

# 17. Security Deployment

服务监听：

```text
127.0.0.1
```

------

禁止：

0.0.0.0

------

默认：

不允许局域网访问。

------

# 18. Secrets Management

Provider API Key

必须：

Windows Credential Manager

------

禁止：

SQLite明文

JSON明文

日志明文

------

# 19. Crash Recovery

异常退出：

下次启动：

检测：

```text
Unfinished Tasks

DB State

Watcher State
```

------

自动恢复。

------

# 20. Installer Strategy

最终交付：

```text
ProjectVault_Setup.exe
```

------

安装内容：

```text
Frontend

Backend

SQLite

Runtime
```

------

用户无需安装任何依赖。

------

# 21. Uninstall Strategy

卸载：

保留：

```text
用户项目文件

project.json
```

------

询问用户：

是否删除：

```text
Database

Logs

Backups
```

------

# 22. Release Versioning

格式：

```text
Major.Minor.Patch
```

示例：

```text
1.0.0

1.0.1

1.1.0

2.0.0
```

------

规则：

Patch

Bug Fix

------

Minor

Feature

------

Major

Architecture Change

------

# 23. Acceptance Criteria

V1发布标准：

------

项目：

1000+

------

文件：

100000+

------

搜索：

<100ms

------

项目打开：

<200ms

------

增量扫描：

<5s

------

启动：

<3s

------

无致命崩溃。

------

桌面打包链路：

- [ ] Tauri 能成功启动 Python Sidecar。
- [ ] Sidecar 使用动态端口提供 `/api/health`。
- [ ] 前端能从 `window.__BACKEND_PORT__` 拼接 API Base URL。
- [ ] 关闭桌面应用后，Python 进程被正确终止。
- [ ] Windows 打包产物在无 Python 环境的机器上可启动。

------

# 24. Release Checklist

发布前必须验证：

[ ] Schema正确

[ ] Migration正确

[ ] FTS正确

[ ] Rebuild正确

[ ] Backup正确

[ ] Restore正确

[ ] Watcher正确

[ ] AI Provider正确

[ ] API文档正确

[ ] Installer正确

------

全部通过后：

允许发布。

------

# 25. V1 Freeze

完成本文件后：

以下文档全部冻结：

```text
00_Project_Vault_V1_Baseline

01_PRD
02_Information_Architecture
03_Design_System
04_Wireframe

05_Database
06_Frontend_Architecture
07_Backend_Architecture
08_API_Specification

09_Backend_API_Implementation_Plan
10_Database_Implementation_Plan
11_Core_Engine_Implementation_Plan
12_Release_Deployment_Plan
```

------

Project Vault V1

Architecture Status:

FROZEN

Ready For Development

```

```
