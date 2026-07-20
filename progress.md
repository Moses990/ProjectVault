# Project Vault 当前进度

> 最后更新：2026-07-20
> 快速恢复当前任务状态；详细远端集成记录见 [GitHub PR #9](https://github.com/Moses990/ProjectVault/pull/9)。

## 当前状态

- 产品：V2.0 `2.0.0`，已正式冻结；实施计划止于阶段 10。
- 本轮任务：已从与远端 `main` 相同的源码树生成并验收正式 V2.0 安装包。
- 安装包：`desktop/src-tauri/target/release/bundle/nsis/Project Vault_2.0.0_x64-setup.exe`。
- SHA-256：`556AB856C35E3225E7B8317BAF835EB772CF32E7F81E629085771887E9D17F99`。
- 远端 `main`：`b110e83271a49516ef6717d291dd5de9e77de154`；阶段 7～10 功能集成 merge SHA 为 `95862182a03ad5f46eee859fd15800c36d61637e`。
- 本地源分支：`feat/phase-10-ai-provider` @ `564ec26`；公开集成分支最终 head 为 `7b5f7f5`。
- 原始阶段分支、标签和含真实环境材料的 `docs/reviews/` 不推送。

## 2026-07-20 安全加固（fix/security-hardening-20260720）

- 以攻击者视角完成全栈安全审计（后端 API、前端、Watcher、Tauri 桌面壳）。
- 分支 `fix/security-hardening-20260720`，回滚点 `backup/pre-security-fix-20260720`，提交 `ce60880`。
- 修复 10 个文件，+155/-18 行；后端全量 154/154 通过。
- 修复清单：
  - P0：Bearer token 认证中间件（`PV_API_TOKEN` 环境变量，开发模式自动跳过）。
  - P1：`os.startfile` 扩展名白名单 + `reveal_folder` 改用 `explorer /select,`。
  - P2：AI Provider URL SSRF 防护（私有/保留 IP 黑名单；`127.0.0.1`/`localhost` 默认放行给本地 Provider）。
  - P3：`/health` 和 Dashboard 响应移除绝对路径。
  - P4：`initialize_projects` 路径限制在已配置 `root_path` 子树下。
  - P5：`root_path` 设置拒绝系统目录和敏感隐藏目录。
  - P6：LIKE 通配符转义、rate limit 存储定期清理、CORS 生产端口收紧。
- 未提交：版本号 bump（`2.0.0-beta.1` → `2.0.0`）、package-lock、docs 变更属于另一组改动，未混入安全提交。
- 前端/Tauri 侧配套（token 注入、CSP 去 `unsafe-eval`）需后续桌面构建时完成。

## 2026-07-20 已完成

- 将前端、后端、Tauri、Cargo、验收脚本和对应测试的发布版本统一为 `2.0.0`。
- 后端全量 154/154、前端全量 100/100、Next 静态生成 11 页、Rust 2/2 全部通过。
- 通过现有 desktop prebuild/release 链重新生成前端导出、Python Sidecar、Tauri 主程序和 NSIS 安装包。
- 使用隔离 LOCALAPPDATA、隔离安装目录、fixture 与 Mock Provider 完成真实安装验收，37/37 通过；隔离运行库为 SQLite v3。
- 正式运行库未被验收触碰，仍为 SQLite v2 且 `integrity_check=ok`。
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
- 已生成并推送公开安全的集成提交 `7551bbb`，创建 GitHub PR #9；公开差异含 105 个文本文件，不含 `docs/reviews/`、截图、真实项目名、本机用户名或常见密钥格式。
- 脱敏后定向回归再次通过：后端 31/31、前端 44/44。
- 首轮 GitHub CI 暴露 Windows runner 的 8.3 短路径差异；两条路径合同测试已改为按规范路径/同一文件语义断言，不改变产品实现。
- 修复后 GitHub 必需检查 `ci` 在 3m02s 内通过；PR #9 无评论、无未解决线程，已 squash 合并为 `95862182`。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 后端全量 | 154/154 通过，27.916s |
| 前端全量 | 11 files、100/100 通过 |
| Next build | 通过，静态生成 11 页 |
| `cargo test` | 2/2 通过 |
| Tauri release / NSIS | 通过，生成 `Project Vault_2.0.0_x64-setup.exe` |
| 隔离本机安装验收 | 37/37 通过 |
| 33,000 条搜索结果回归 | 通过 |
| Provider / Onboarding 定向回归 | 通过 |

Next build 仅输出既有 static export / rewrites 提示；无编译或类型错误。

## 远端收口证据

1. PR #9 的必需检查 `ci`：成功，3m02s。
2. PR changed files：105 个文本文件；无 `docs/reviews/`、截图、真实文件清单或密钥。
3. PR 审查状态：无评论、无未解决线程。
4. 合并结果：squash merged；merge SHA `95862182a03ad5f46eee859fd15800c36d61637e`。

## 恢复检查

1. 读取 `AGENTS.md` 和三份连续性文件。
2. 运行 `git status --short --branch`、`git log -5 --decorate --oneline`。
3. 涉及远端时先 `git fetch origin --prune`。
4. 确认公开差异不含新增 `docs/reviews/`、绝对路径、真实文件清单、截图或密钥。
5. 仅在 GitHub `ci` 通过且 PR 无阻断评论后合并。
