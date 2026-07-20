# Project Vault 当前进度

> 最后更新：2026-07-20
> 快速恢复当前任务状态；详细过程见 Git 日志和后续 GitHub PR。

## 当前状态

- 产品：V2 Beta `2.0.0-beta.1`；阶段 10 已验收，阶段 11 未启动。
- 当前任务：审查并把阶段 7～10 集成到远端 `main`。
- 本地源分支：`feat/phase-10-ai-provider` @ `564ec26`；`origin/main=5a85014`。
- 当前状态：代码审查和本地验证已完成；正在生成公开仓库安全的干净集成分支。
- 原始阶段分支、标签和含真实环境材料的 `docs/reviews/` 不推送。

## 2026-07-20 已完成

- 读取并重构 `task_plan.md`、`findings.md`、`progress.md`，移除过期状态和重复过程。
- 刷新远端，核对提交链、GitHub 登录、公开仓库属性、合并方式、现有 PR 和 `main` ruleset。
- 执行 ADR/规格门禁：现有架构、V2 规划、API 规范和阶段验收材料足以覆盖本轮；未引入新架构决策。
- 对 `origin/main..feat/phase-10-ai-provider` 做完整代码审查。
- 修复并回归验证：Provider 密钥替换、Knowledge 搜索遗漏、大结果集 SQLite 变量上限、显式无认证 Provider、Onboarding 扫描重试。
- 根据最终审查把 Provider 认证模式迁入 SQLite v3 独立字段；缺失 Key 的连通性请求在网络调用前拒绝，表单切换认证模式不再复用旧凭据。
- Provider 认证模式切换的旧凭据清理移入 SQLite 提交前；凭据存储故障会回滚整次配置更新。
- `api_key` 模式缺少 Key 时不再执行匿名模型预览；仅显式无认证模式可无 Key 请求。
- 恢复 `task_plan.md` 的完整阶段门禁，顶部增加唯一当前摘要，并脱敏新增的真实库路径与项目名。
- 修复 Windows 测试 HTTP handler 未消费 POST 请求体导致的间歇性 TCP reset。
- 删除不可达旧 AI 直写实现，继续保持 Draft 审阅边界。
- 识别公开仓库隐私风险，决定用从 `origin/main` 生成的单提交集成分支，提交前排除新增 `docs/reviews/`。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 后端全量 | 154/154 通过，24.899s |
| 前端全量 | 11 files、100/100 通过 |
| Next build | 通过，静态生成 11 页 |
| `cargo check` | 通过 |
| `cargo test` | 2/2 通过 |
| 33,000 条搜索结果回归 | 通过 |
| Provider / Onboarding 定向回归 | 通过 |

Next build 仅输出既有 static export / rewrites 提示；无编译或类型错误。

## 待完成

1. 收口最新认证修复的最终代码审查，确认无 P0/P1 遗留。
2. 在 `origin/main` 上 squash 本地冻结链，移除新增 `docs/reviews/`，复查差异和敏感信息。
3. 显式暂存、提交并推送干净集成分支。
4. 创建 GitHub PR，等待必需检查 `ci`，复核 PR 差异、评论和检查结果。
5. 合并到远端 `main`，记录 PR、merge SHA 和最终远端状态。
6. 更新三份连续性文件中的稳定远端证据后停止；不进入阶段 11。

## 恢复检查

1. 读取 `AGENTS.md` 和三份连续性文件。
2. 运行 `git status --short --branch`、`git log -5 --decorate --oneline`。
3. 涉及远端时先 `git fetch origin --prune`。
4. 确认公开差异不含新增 `docs/reviews/`、绝对路径、真实文件清单、截图或密钥。
5. 仅在 GitHub `ci` 通过且 PR 无阻断评论后合并。
