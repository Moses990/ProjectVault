"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Provider } from "@/lib/api";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";

type EditingState = {
  id: string | null;
  name: string;
  baseUrl: string;
  defaultModel: string;
  keyReference: string;
  isEnabled: boolean;
};

const EMPTY_FORM: EditingState = {
  id: null,
  name: "",
  baseUrl: "",
  defaultModel: "",
  keyReference: "",
  isEnabled: true,
};

export default function AICenterPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ready: boolean; message: string }>>({});
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.providers();
      setProviders(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载 AI 提供商失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startCreate() {
    setEditing(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(p: Provider) {
    setEditing({
      id: p.id,
      name: p.name,
      baseUrl: p.base_url,
      defaultModel: p.default_model,
      keyReference: "",
      isEnabled: p.is_enabled,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing.id) {
        await api.updateProvider(editing.id, {
          name: editing.name,
          base_url: editing.baseUrl,
          default_model: editing.defaultModel,
          is_enabled: editing.isEnabled,
          ...(editing.keyReference ? { key_reference: editing.keyReference } : {}),
        });
      } else {
        await api.createProvider({
          name: editing.name,
          base_url: editing.baseUrl,
          default_model: editing.defaultModel,
          ...(editing.keyReference ? { key_reference: editing.keyReference } : {}),
        });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存提供商失败");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(p: Provider) {
    setDeleteTarget(p);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteProvider(deleteTarget.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除提供商失败");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleTest(p: Provider) {
    setTestingId(p.id);
    try {
      const result = await api.testProvider(p.id);
      setTestResults((prev) => ({ ...prev, [p.id]: { ready: result.ready, message: result.message } }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [p.id]: { ready: false, message: e instanceof Error ? e.message : "测试失败" } }));
    } finally {
      setTestingId(null);
    }
  }

  async function toggleEnabled(p: Provider) {
    try {
      await api.updateProvider(p.id, { is_enabled: !p.is_enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "切换提供商状态失败");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI 中心</h1>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={startCreate}>+ 添加提供商</button>
          <Link href="/" className="btn btn-sm">返回工作台</Link>
        </div>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><span className="spinner" /> 加载提供商列表...</div>
      ) : providers.length === 0 && !showForm ? (
        <div className="card empty-state">
          <p>尚未配置 AI 提供商。</p>
          <p className="text-sm mt-2">添加提供商以启用 AI 驱动的元数据提取。</p>
          <button className="btn btn-primary btn-sm mt-4" onClick={startCreate}>+ 添加提供商</button>
        </div>
      ) : (
        <>
          {providers.length > 0 && (
            <div style={{ display: "grid", gap: "10px", marginBottom: 16 }}>
              {providers.map((p) => {
                const testResult = testResults[p.id];
                return (
                  <div key={p.id} className="provider-card">
                    <div className="provider-info">
                      <div className="flex items-center gap-2">
                        <span className="provider-name">{p.name}</span>
                        {p.is_enabled
                          ? <span className="badge badge-success">已启用</span>
                          : <span className="badge">已禁用</span>}
                        {p.has_key
                          ? <span className="badge badge-accent">已设置密钥</span>
                          : <span className="badge badge-warn">未设置密钥</span>}
                      </div>
                      <div className="provider-url">{p.base_url}</div>
                      {p.default_model && (
                        <div className="text-sm text-dim">模型：{p.default_model}</div>
                      )}
                      {testResult && (
                        <div className="text-sm mt-2" style={{ color: testResult.ready ? "var(--success)" : "var(--danger)" }}>
                          {testResult.ready ? "\u2713" : "\u2717"} {testResult.message}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="btn btn-sm"
                        onClick={() => handleTest(p)}
                        disabled={testingId === p.id}
                      >
                        {testingId === p.id ? <><span className="spinner" /> 测试中...</> : "测试"}
                      </button>
                      <button className="btn btn-sm" onClick={() => startEdit(p)}>编辑</button>
                      <button className="btn btn-sm" onClick={() => toggleEnabled(p)}>
                        {p.is_enabled ? "禁用" : "启用"}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>删除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
              <div className="card">
                <h2 className="page-title mb-4" style={{ fontSize: 16 }}>
                  {editing.id ? "编辑提供商" : "添加提供商"}
                </h2>

                <div className="form-group">
                  <label className="form-label">名称</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="OpenAI / DeepSeek / Ollama"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">基础 URL</label>
                  <input
                    className="form-input"
                    type="url"
                    required
                    value={editing.baseUrl}
                    onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">默认模型</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editing.defaultModel}
                    onChange={(e) => setEditing({ ...editing, defaultModel: e.target.value })}
                    placeholder="gpt-4o / deepseek-chat / llama3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    API 密钥 {editing.id && <span className="text-dim">（留空则保持不变）</span>}
                  </label>
                  <input
                    className="form-input"
                    type="password"
                    value={editing.keyReference}
                    onChange={(e) => setEditing({ ...editing, keyReference: e.target.value })}
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                  <div className="text-sm text-dim mt-2">
                    密钥安全存储，不会在 API 响应中暴露。
                  </div>
                </div>

                {editing.id && (
                  <div className="form-group">
                    <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={editing.isEnabled}
                        onChange={(e) => setEditing({ ...editing, isEnabled: e.target.checked })}
                      />
                      <span>启用</span>
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><span className="spinner" /> 保存中...</> : (editing.id ? "更新提供商" : "创建提供商")}
                  </button>
                  <button type="button" className="btn" onClick={() => { setShowForm(false); setEditing(EMPTY_FORM); }}>
                    取消
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除提供商"
        message={`即将删除提供商 "${deleteTarget?.name ?? ""}"，此操作不可撤销。`}
        confirmLabel="确认删除"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}