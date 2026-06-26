"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Provider } from "@/lib/api";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.providers();
      setProviders(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load providers");
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
      setError(e instanceof Error ? e.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Provider) {
    if (!confirm(`Delete provider "${p.name}"?`)) return;
    try {
      await api.deleteProvider(p.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete provider");
    }
  }

  async function handleTest(p: Provider) {
    setTestingId(p.id);
    try {
      const result = await api.testProvider(p.id);
      setTestResults((prev) => ({ ...prev, [p.id]: { ready: result.ready, message: result.message } }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [p.id]: { ready: false, message: e instanceof Error ? e.message : "Test failed" } }));
    } finally {
      setTestingId(null);
    }
  }

  async function toggleEnabled(p: Provider) {
    try {
      await api.updateProvider(p.id, { is_enabled: !p.is_enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle provider");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Center</h1>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={startCreate}>+ Add Provider</button>
          <Link href="/" className="btn btn-sm">Back to Dashboard</Link>
        </div>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><span className="spinner" /> Loading providers...</div>
      ) : providers.length === 0 && !showForm ? (
        <div className="card empty-state">
          <p>No AI providers configured.</p>
          <p className="text-sm mt-2">Add a provider to enable AI-powered metadata extraction.</p>
          <button className="btn btn-primary btn-sm mt-4" onClick={startCreate}>+ Add Provider</button>
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
                          ? <span className="badge badge-success">Enabled</span>
                          : <span className="badge">Disabled</span>}
                        {p.has_key
                          ? <span className="badge badge-accent">Key Set</span>
                          : <span className="badge badge-warn">No Key</span>}
                      </div>
                      <div className="provider-url">{p.base_url}</div>
                      {p.default_model && (
                        <div className="text-sm text-dim">Model: {p.default_model}</div>
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
                        {testingId === p.id ? <><span className="spinner" /> Testing...</> : "Test"}
                      </button>
                      <button className="btn btn-sm" onClick={() => startEdit(p)}>Edit</button>
                      <button className="btn btn-sm" onClick={() => toggleEnabled(p)}>
                        {p.is_enabled ? "Disable" : "Enable"}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>Delete</button>
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
                  {editing.id ? "Edit Provider" : "Add Provider"}
                </h2>

                <div className="form-group">
                  <label className="form-label">Name</label>
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
                  <label className="form-label">Base URL</label>
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
                  <label className="form-label">Default Model</label>
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
                    API Key {editing.id && <span className="text-dim">(leave blank to keep existing)</span>}
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
                    The key is stored securely and never exposed in the API response.
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
                      <span>Enabled</span>
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><span className="spinner" /> Saving...</> : (editing.id ? "Update Provider" : "Create Provider")}
                  </button>
                  <button type="button" className="btn" onClick={() => { setShowForm(false); setEditing(EMPTY_FORM); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}