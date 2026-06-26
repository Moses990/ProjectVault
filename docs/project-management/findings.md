# 本地项目驾驶舱调研记录

## 已确认

- 系统目录：`D:\Users\admin\Desktop\ProjectLibrary\项目自动建档系统`
- 项目库根目录：`D:\Users\admin\Desktop\ProjectLibrary`
- 现有代码目录：`code`
- 现有入口：`code\project_system.py`
- 常用命令：`refresh`、`scan`、`index`、`monitor`、`ai-update`、`ai-search`、`ai-meetings`、`ai-meeting`
- 当前真实样例项目：`追觅`
- 样例项目档案：`追觅\00_项目档案\project.json`
- 样例会议记录目录：`追觅\00_项目档案\ai_notes`

## 数据结构

- `project.json` 使用 Schema 2.0。
- `项目信息` 包含项目名称、项目阶段、项目路径、创建时间、最后更新时间。
- `需求信息` 包含项目简介、核心需求、特殊要求、材料工艺、风险事项。
- `ai_extraction` 包含 AI 状态、会议记录索引、更新时间和源文件信息。
- 会议记录 `.json` 中包含 evidence，可用于来源追溯。

## 产品判断

- 第一版应做本地项目资料驾驶舱，不做普通官网。
- 更适合左侧项目列表 + 右侧详情布局。
- 应保留命令行系统作为核心能力，网页只做可视化入口和固定操作按钮。
