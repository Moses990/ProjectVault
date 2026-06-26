# Project Vault V1.0 产品需求文档（PRD）

版本：V1.0
状态：冻结版（Freeze）
日期：2026-06-24

------

# 1. 项目概述

## 1.1 项目名称

Project Vault

中文名称：

项目资料管理库

------

## 1.2 项目定位

面向室内设计 / SI设计行业的项目资产管理系统（Project Asset Management System）。

核心目标：

让用户能够快速找到任何项目、任何文件、任何历史版本。

------

## 1.3 核心原则

项目是系统中的第一核心对象。

所有资料围绕项目组织。

系统不替代资源管理器。

系统不替代网盘。

系统不替代OA。

系统负责：

- 项目归档
- 项目检索
- 项目浏览
- 项目统计
- 项目资产沉淀

------

# 2. V1范围

## 2.1 V1必须实现

### Dashboard

首页仪表盘

### Projects

项目管理

### Project Detail

项目详情页

### Search

全局搜索

### CAD Center

CAD中心

### AI Center

AI Provider管理

### Settings

系统设置

------

## 2.2 V1不实现

- OA
- 审批流程
- 任务管理
- 甘特图
- 在线CAD查看
- 在线编辑文件
- AI聊天
- Agent
- RAG知识库
- 多人协同
- 权限系统
- 云同步

------

# 3. UI设计规范

## 3.1 风格参考

Linear

Raycast

Arc Browser

------

## 3.2 风格关键词

Professional

Minimal

Dark

High Density

Fast

------

## 3.3 默认主题

Background

\#0F1117

Surface

\#171923

Border

\#252936

Text

\#F3F4F6

Secondary Text

\#9CA3AF

------

## 3.4 主强调色

\#7C3AED

------

## 3.5 圆角

12px

------

## 3.6 动画

150ms ease-out

------

## 3.7 布局

左侧导航栏

顶部搜索栏

主内容区

固定宽度布局

最大宽度：

1600px

------

# 4. 页面结构

Project Vault

├─ Dashboard
├─ Projects
├─ Search
├─ CAD Center
├─ AI Center
└─ Settings

------

# 5. Dashboard

## 功能

显示系统概览信息。

## 内容

项目总数

CAD图纸总数

材料资料总数

最近更新项目

最近访问项目

收藏项目

------

# 6. Projects

## 功能

项目列表展示。

## 视图模式

列表视图

卡片视图

------

## 项目卡片字段

项目名称

项目类型

项目阶段

最后更新时间

文件总数

CAD数量

材料数量

AI摘要（预留）

------

## 支持

搜索

排序

筛选

收藏

快速打开

------

# 7. Project Detail

固定六个Tab。

Overview

Files

Drawings

Materials

AI

History

------

# 7.1 Overview

数据来源：

project.json

显示：

项目名称

项目ID

项目类型

项目阶段

负责人

创建时间

更新时间

项目简介

项目标签

统计信息

------

# 7.2 Files

展示标准目录结构。

01_项目前期资料

02_需求资料

03_CAD图纸

04_效果图

05_汇报文件

06_材料资料

07_现场资料

------

支持：

打开文件

打开目录

复制路径

资源管理器定位

------

# 7.3 Drawings

CAD专项管理页面。

自动识别CAD分类。

分类：

平面图

立面图

天花图

节点图

施工图

其他

------

功能：

CAD统计

CAD版本链

CAD更新时间轴

CAD快速打开

------

# 7.4 Materials

展示项目材料资料。

支持：

PDF

图片

Excel

Word

------

V1不做跨项目材料库。

------

# 7.5 AI

V1只展示字段。

不做生成。

字段：

AI摘要

项目标签

核心需求

特殊要求

风险提示

经验总结

------

数据来源：

project.json

------

# 7.6 History

项目时间轴。

记录：

项目创建

项目扫描

文件更新

AI分析记录

------

# 8. Search

## 功能

全局统一搜索。

------

## 搜索范围

项目名称

项目ID

文件名称

CAD名称

材料名称

项目标签

AI摘要

------

## 快捷键

Ctrl + K

------

## 搜索结果分类

Projects

Files

CAD

Materials

------

# 9. CAD Center

独立模块。

------

功能：

所有项目CAD汇总

最近更新CAD

CAD分类统计

CAD版本追踪

------

支持：

快速打开项目

快速打开图纸

------

# 10. AI Center

仅负责模型配置。

------

# 10.1 Provider支持

OpenAI

OpenRouter

Anthropic

Google Gemini

Custom(OpenAI Compatible)

------

# 10.2 Provider字段

名称

Base URL

API Key

默认模型

启用状态

------

# 10.3 功能

新增Provider

编辑Provider

删除Provider

测试连接

设置默认模型

------

# 10.4 API Key存储

禁止明文存储。

推荐：

Windows Credential Manager

或

本地AES加密存储

------

# 11. Settings

## 系统设置

项目根目录

自动扫描开关

扫描周期

缓存管理

日志管理

备份管理

------

## 界面设置

深色模式

浅色模式（预留）

------

# 12. 数据源

## 项目数据

project.json

------

## 文件数据

本地目录扫描

------

## 搜索索引

SQLite

------

# 13. project.json Schema扩展

新增字段：

{
"AI摘要": "",
"项目标签": [],
"核心需求": [],
"特殊要求": [],
"风险提示": [],
"经验总结": []
}

------

# 14. 技术栈

前端：

Next.js

React

TypeScript

Tailwind CSS

shadcn/ui

Lucide Icons

------

后端：

Python FastAPI

------

数据库：

SQLite

------

索引：

SQLite FTS

------

# 15. 开发优先级

## P0

Dashboard

Projects

Project Detail

Search

Settings

AI Provider

------

## P1

CAD Center

History

------

## P2

AI摘要生成

标签生成

需求提取

风险分析

------

# 16. 成功标准

项目可自动读取现有项目目录。

项目可自动读取project.json。

用户可在3秒内定位任意项目。

用户可通过Ctrl+K搜索任意资料。

用户可管理多个AI Provider。

用户无需进入资源管理器即可完成80%的项目检索工作。

END