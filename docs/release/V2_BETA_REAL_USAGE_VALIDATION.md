# V2 Beta Real Usage Validation

状态：自动验证通过，等待用户验收 AI 内容质量与实际体验。

检查时间：2026-07-10。

## 测试环境

- 代码：`main`，`v2.0.0-beta.1`。
- 后端：Python 3.12、FastAPI、独立 SQLite 数据库。
- 前端：Next.js 静态导出；Chrome headless 控制台检查。
- 测试根目录：`release-validation/v2_beta_real_usage-20260710-161758/`。
- 测试项目：真实室内设计项目的隔离副本 `fixture-root/追觅`。原始项目绝对路径仅记录在已忽略的 `paths.txt`，未写入此报告。

## 数据安全

- 未向真实项目原件写入或删除任何文件。
- 原件与副本建立时均为 250 个源文件、4.89 GB；副本验证后的源文件清单仍为 250 个。
- 初始化、扫描、草稿应用、备份和异常注入均只发生在副本与独立 `project_vault.db`。
- 成功的 AI 技术链路使用本地 mock Provider。未把项目文本发送给外部 Provider，避免未确认的资料外发。

## 通过项

| 验证项 | 结果 | 证据 |
| --- | --- | --- |
| 导入、初始化、全量扫描、文件索引 | 通过 | 候选 1 个；扫描 251 个文件，78 ms |
| CAD / 材料统计 | 通过 | CAD 24；材料 207 |
| 文本提取与不支持格式 | 通过 | 1 个文本来源 ready；1 个不支持格式 failed 且未中断流程 |
| AI 草稿与人工确认门禁 | 通过 | 草稿只进入 draft；`confirm=false` 返回 `400 confirm_required` |
| 写前备份与确认写入 | 通过 | 副本生成 `project.json.bak.20260710-161819-562499` |
| SQLite 同步、FTS5 知识搜索、重启持久化 | 通过 | 搜索命中 1；重新打开数据库后知识仍存在 |
| API Key 缺失、Provider 失败、网络超时 | 通过 | 返回受控错误；已确认知识保持不变 |
| 无效 `project.json`、扫描异常 | 通过 | 受控记录错误，未污染已确认数据 |
| 文件移动和删除 | 通过 | `created=1`、`moved=1`、`deleted=1`，移动文件保留原 file ID |
| API 错误契约 | 通过 | 无效来源 `400 file_not_found`；未确认应用 `400 confirm_required` |
| 页面加载与控制台 | 通过 | 项目详情正确显示 252 文件、24 CAD、207 材料；Chrome `error/warn=0` |

## 已修复问题

### 增量扫描未在 changed-path 快路径识别移动文件

- 复现：同次增量扫描传入旧路径与新路径时，结果为 `moved=0`、`deleted=1`。
- 原因：快路径逐条处理变更，未按内容指纹配对缺失记录与新路径。
- 修复：在 `backend/app/scanner/incremental_scanner.py` 复用内容指纹配对，保留 `files.id`，同步关联知识来源和 FTS 实体。
- 回归：新增 `test_changed_paths_incremental_scan_detects_move_and_preserves_file_identity`；真实副本回归结果为 `moved=1`。

### 桌面静态服务未映射 Next RSC 预取文件

- 复现：项目详情加载后，侧栏预取 `settings/__next.settings.__PAGE__.txt` 等资源 404。
- 原因：桌面静态服务只归一化了嵌套 `_next/` 脚本资源。
- 修复：`desktop/src-tauri/src/main.rs` 增加 RSC 导出路径映射，并增加 2 个路由单测。
- 回归：桌面等价静态预览下 Chrome 控制台 `error/warn=0`。

## 性能观察

- 真实副本规模：250 个源文件，4.89 GB。
- 全量扫描：78 ms。
- 文件列表：1.59 ms。
- 知识 FTS5 查询：1.39 ms；HTTP 查询为 7.45 ms。
- 页面检查完整等待窗口约 7.4 s，其中包含固定 7 s 控制台观察；不是页面首屏耗时。

该项目文件数属于中等规模、总容量较大；尚未以真实 10,000+ 文件项目做交互性能结论。既有自动化已有 10,000 文件 FTS5 性能回归。

## 未解决问题

无已知功能阻塞项。

以下不是自动通过项：

- 真实外部 Provider 的生成质量、专业术语准确性、隐私授权：等待用户验收。
- 字段选择、确认写入和搜索结果是否符合日常设计工作习惯：等待用户验收。
- 大于当前副本数量级的真实项目 UI 交互性能：待后续真实使用样本观察。
- 本机 Rust toolchain 未安装 `rustfmt`，未执行格式检查；`cargo test` 已完成编译与路由测试。

## 2026-07-13 PDF 提取补充

- 已增加本地 `pypdf` 文本提取。可复制文字的 PDF 现在可作为 AI 草稿来源；真实项目副本抽检 PDF 提取成功，文本长度 13,762 字符。
- 无可复制文字的扫描版 PDF 返回“未找到可提取文字”；损坏 PDF 返回“PDF 解析失败”。两种情况均不会生成空草稿。
- 前端只提交 `.txt/.md/.csv/.json/.pdf`，图片等不支持文件会被跳过，不再占用提取上限。
- 图片 OCR、扫描版 PDF OCR、DOCX 仍未实现，继续等待独立范围确认。

## 2026-07-13 一键知识流程补充

- 原有“提取文本 / 创建草稿 / AI 生成草稿 / 选字段 / 应用草稿”已收敛为“整理项目知识 / 确认写入 / 放弃草稿”。
- 一键整理复用现有提取和 AI 草稿接口，自动处理最多 20 个支持格式资料；无新增解析依赖或数据库 schema。
- 证据与非核心字段默认折叠；人工确认、`project.json` 备份、SQLite/FTS 同步保持不变。
- 新增草稿放弃 API。验证草稿放弃后只更新 draft 状态，不改 `project.json`。
- 用户已完成简化流程人工验收：通过。

## 用户人工判断

请在后续使用真实外部 Provider 时判断：

1. 草稿是否准确表达设计需求、风险与专业术语。
2. 是否愿意确认每次写入的字段，以及备份提示是否足够清晰。
3. 搜索结果是否能支撑实际找资料的习惯。
4. 项目文本可否发送给选定 Provider，是否满足你的隐私要求。

## 结论

- 建议继续 V2 Beta 使用：是。范围限于隔离副本或已备份项目，并继续保持人工确认写入。
- 进入 V2 正式版候选阶段：暂不建议。需要先取得上述真实 Provider 内容质量、隐私与工作流体验的用户验收；不以本次本地 mock 结果替代。

## 自动验证

```powershell
cd D:\Workflows\ProjectVault\backend
.venv\Scripts\python.exe -m unittest discover -s tests -v

cd D:\Workflows\ProjectVault\frontend
cmd /c npm run test
cmd /c npm run build

cd D:\Workflows\ProjectVault\desktop\src-tauri
cargo test
```

结果：后端 84 tests OK；前端 12 tests passed；前端默认生产构建通过；桌面路由单测 2 passed。
