"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { ProviderModel } from "@/lib/api";

export function ModelCombobox({
  label,
  value,
  models,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  models: ProviderModel[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const filtered = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    return query ? models.filter((model) => model.id.toLocaleLowerCase().includes(query)) : models;
  }, [models, value]);

  useEffect(() => {
    if (models.length) setOpen(true);
  }, [models]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!models.length) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!filtered.length) { setActive(-1); return; }
      setOpen(true);
      if (event.key === "Home") setActive(0);
      else if (event.key === "End") setActive(filtered.length - 1);
      else setActive((current) => Math.max(0, Math.min(filtered.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter" && open && active >= 0 && filtered[active]) {
      event.preventDefault();
      onChange(filtered[active].id);
      setOpen(false);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return <div className="form-group model-combobox-wrap">
    <label className="form-label" htmlFor={`${id}-input`}>{label}</label>
    <div className="model-combobox">
      <input
        id={`${id}-input`}
        className="form-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        value={value}
        disabled={disabled}
        onFocus={() => { if (models.length) setOpen(true); }}
        onChange={(event) => { onChange(event.target.value); setActive(-1); if (models.length) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder="选择或手动填写模型 ID"
      />
      {models.length > 0 && <button type="button" className="model-combobox-toggle" aria-label="打开模型列表" disabled={disabled} onClick={() => setOpen((current) => !current)}>⌄</button>}
      {open && <div id={`${id}-list`} className="model-listbox" role="listbox" aria-label="可用模型">
        <div className="model-list-count" aria-live="polite">{filtered.length} 个匹配模型</div>
        {filtered.length ? filtered.map((model, index) => <button
          id={`${id}-option-${index}`}
          type="button"
          role="option"
          aria-selected={value === model.id}
          className={index === active ? "active" : ""}
          key={model.id}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { onChange(model.id); setOpen(false); }}
        ><span title={model.id}>{model.id}</span>{model.owned_by && <small>{model.owned_by}</small>}</button>) : <div className="model-list-empty">未找到匹配模型，可继续手动填写。</div>}
      </div>}
    </div>
    {hint && <p className="form-hint">{hint}</p>}
  </div>;
}
