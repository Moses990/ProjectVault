# Project Vault 当前发现与约束

> 最后更新：2026-07-20
> 保存仍影响交付和后续决策的事实；一次性过程由 GitHub PR、CI 与本地 Git 历史承载。

## 仓库事实

- 远端公开仓库：`Moses990/ProjectVault`；本轮集成记录为 [GitHub PR #9](https://github.com/Moses990/ProjectVault/pull/9)。
- 本地冻结分支：`feat/phase-10-ai-provider` @ `564ec26`，标签 `phase-10-complete`。
- `origin/main=95862182a03ad5f46eee859fd15800c36d61637e`；PR #9 已 squash 合并阶段 7～10 的公开安全差异。
- 远端 `main` 受 ruleset `18599350` 保护：禁止删除/非快进，严格要求检查 `ci`。
- 公开集成分支最终 head 为 `7b5f7f5dd4f263ae2c4a1c9fe3a52e1ce56585ca`；必需检查 `ci` 成功，PR 无评论或未解决审查线程。
- 原始阶段分支与本地标签未推送；公开主线不包含本地验收材料。
- 阶段 11 未定义、未启动；本轮不扩展产品范围。

## 代码审查发现

审查相对 `origin/main` 的完整差异后，确认并修复：

1. Provider 密钥替换使用相同 `wincred:<provider_id>` 引用，旧逻辑会在保存新密钥后删除该引用对应的新密钥。
2. `fts_global` 已索引 Knowledge，但统一搜索的类型映射、元数据和前端入口遗漏它。
3. 统一搜索一次把所有命中 ID 放进 `IN (...)`；约 33,000 条命中可复现 `too many SQL variables`。
4. UI 需要显式区分“无需认证”和“应有 Key 但缺失”；现以 `auth_mode="none"` 标记前者，普通 `missing` 仍阻断。
5. 首版显式认证模式曾用 `key_reference="noauth"` 作哨兵，可能与历史明文凭据冲突；现由 SQLite v3 独立 `auth_mode` 字段表达，迁移默认保留旧记录的 `api_key` 语义。
6. 连通性/模型列表曾把缺失 Key 当空 Key 请求；现请求前拒绝缺失凭据，只有 `auth_mode="none"` 可匿名请求。编辑表单切换认证模式后也不再复用已保存 Key。
7. 认证模式切换曾先提交 SQLite、再删除旧凭据；删除失败会出现失败响应与已变更配置。现清理在事务提交前完成，失败会回滚整次更新。
8. 新建或切回 `api_key` 模式时，空 Key 预览曾按匿名请求并可能误报成功；现仅已保存且认证配置未变时复用托管 Key，其余 `api_key` 预览必须输入 Key。
9. `task_plan.md` 的旧过程需要清理，但其阶段顺序、交付物和验收标准又是 `AGENTS.md` 强制门禁；现保留完整阶段条目、标记为历史检查点，只在文件顶部维护当前摘要，并脱敏真实库路径与项目名。
10. Onboarding 先批量初始化、再逐项扫描；中途失败后重试会跳过已初始化项目，导致剩余扫描丢失。
11. Provider 合同测试的 POST handler 未读取请求体，在 Windows 全量套件中可间歇触发 TCP reset；现完整消费 `Content-Length` 后再响应。
12. 旧 `analyze_project_with_ai` 在无条件异常之后保留整段不可达直写实现，已删除以维持唯一 Draft 写入边界。
13. GitHub Windows runner 的临时目录可能同时出现 8.3 短路径和展开后的长路径；路径合同测试改用同一文件语义比较，路径搜索测试使用解析后的规范路径，避免把等价路径误判为失败。

所有问题均有定向回归测试；当前全量结果为后端 154/154、前端 100/100、Rust 2/2。

## 公开仓库隐私边界

- 原始本地阶段差异中的新增 `docs/reviews/` 包含本机绝对路径、真实项目名称、真实文件名、清单及截图。
- 仓库为公开仓库；即使后续提交删除，先推送原始阶段历史仍会使敏感 blob 可从 Git 历史访问。
- 因此没有直接推送原始分支或阶段标签；本轮从旧 `origin/main` 生成独立 squash 分支，并在提交前完全排除新增 `docs/reviews/`。
- 原始分支和标签留在本机，保留验收追溯；公开分支只含产品代码、测试、通用规范和脱敏连续性文档。
- 已对本地暂存区和 PR changed files 复扫，未发现 API Key、GitHub token、长 Bearer 字面量、私钥、二进制截图或 `docs/reviews/`。

## 当前架构结论

- `project.json` 是业务真源；SQLite/FTS 是可重建派生层。
- 文件唯一性使用 `(project_id, relative_path)`；移动保留稳定 `file_id`。
- Watcher 只进入事件队列；处理器传递聚合 `changed_paths`。
- 资产由 `file_id` 解析；拒绝路径逃逸、符号链接和 junction。
- Knowledge 唯一写路径：Draft → 人工确认 → 备份 → 原子写入 → SQLite/FTS 同步。
- Provider 可使用托管凭据，也可通过 SQLite v3 的独立 `auth_mode="none"` 连接无需认证的本地服务；不能仅凭缺失 Key 或历史凭据内容推断无认证，且不得发送空 Bearer Header。
- FTS5 满足当前边界；无真实 miss-query 证据时不引入向量依赖。

## 仍有效的风险

| 优先级 | 事项 | 当前判断 |
| --- | --- | --- |
| P1 发布 | Tauri `csp=null` | 既有策略，下一次发布安全阶段评估最小 CSP |
| P1 数据 | 卸载保留 `%LOCALAPPDATA%` | 需要明确产品策略 |
| P2 性能 | 更大真实项目 UI 性能 | 当前自动化不覆盖所有真实规模 |
| P3 构建 | static export 提示 rewrites 不生效 | 当前 Tauri localhost 链路已验证；部署模式变化时复核 |

## 判断规则

- 事实冲突时：当前 Git/GitHub → 当前连续性文件 → 本地阶段报告 → 旧过程日志。
- 涉及真实库：只读审查 → 隔离 fixture → 自动测试；真实写入需单独确认。
- 新功能先定义范围、非目标、验收和数据边界；不从旧日志自行启动阶段 11。
- 证据不足时明确 TODO，不把候选方向写成已完成事实。
