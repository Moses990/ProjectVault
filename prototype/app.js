const state = {
  projects: [],
  selected: null,
  activeFilter: "all",
  activeTab: "overview",
  selectedMeetingId: "",
  searchResults: [],
  aiStatus: null,
  assistantLastAnswer: null,
  todoFilter: "open",
};

const $ = (id) => document.getElementById(id);

function text(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function escapeHtml(value) {
  return text(value, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "请求失败");
  return body;
}

async function loadAiStatus() {
  try {
    state.aiStatus = await api("/api/ai/status");
  } catch (error) {
    state.aiStatus = { enabled: false, configured: false, error: error.message };
  }
}

function projectRiskCount(project) {
  return project?.health?.riskCount ?? project?.needs?.risks?.length ?? 0;
}

function projectTodoCount(project) {
  return project?.health?.todoCount ?? (project?.notes || []).reduce((sum, note) => sum + (note.counts?.todos || 0), 0);
}

function passesFilter(project) {
  if (state.activeFilter === "risk") return projectRiskCount(project) > 0;
  if (state.activeFilter === "ai") return project.ai?.status === "success";
  if (state.activeFilter === "attention") return project.health?.level === "warning" || project.health?.level === "danger";
  if (state.activeFilter === "recent") return Boolean(project.updatedAt);
  return true;
}

function aiStatusLabel(status) {
  if (status === "success") return "已更新";
  if (status === "failed") return "失败";
  if (status === "running") return "处理中";
  return "未更新";
}

function healthLabel(project) {
  return project?.health?.label || "未体检";
}

function healthClass(project) {
  const level = project?.health?.level || "neutral";
  if (level === "danger") return "danger";
  if (level === "warning") return "warning";
  if (level === "ok") return "ok";
  return "neutral";
}

function severityLabel(severity) {
  if (severity === "danger") return "高";
  if (severity === "warning") return "中";
  return "低";
}

function todoStatusLabel(status) {
  if (status === "done") return "已处理";
  if (status === "paused") return "暂缓";
  if (status === "confirm") return "需确认";
  return "待处理";
}

function todoStatusClass(status) {
  if (status === "done") return "ok";
  if (status === "paused") return "neutral";
  if (status === "confirm") return "warning";
  return "danger";
}

function renderProjects() {
  const keyword = $("projectFilter").value.trim().toLowerCase();
  const projects = state.projects.filter((project) => {
    const haystack = `${project.name} ${project.stage} ${project.ai?.status}`.toLowerCase();
    return passesFilter(project) && haystack.includes(keyword);
  });
  $("projectCount").textContent = projects.length;
  $("projectList").innerHTML = projects.map((project) => {
    const active = state.selected?.folderName === project.folderName ? "active" : "";
    const aiStatus = project.ai?.status || "never";
    const riskCount = projectRiskCount(project);
    return `
      <button class="project-item ${active}" data-project="${escapeHtml(project.folderName)}">
        <span class="project-item-top">
          <strong>${escapeHtml(project.name)}</strong>
          <span class="status-pill ${healthClass(project)}">${escapeHtml(healthLabel(project))}</span>
        </span>
        <span class="project-item-meta">${escapeHtml(project.stage || "未设置阶段")} / ${project.ai?.noteCount || 0} 份会议 / ${riskCount} 条风险 / AI ${escapeHtml(aiStatusLabel(aiStatus))}</span>
      </button>
    `;
  }).join("");

  $("projectList").querySelectorAll(".project-item").forEach((button) => {
    button.addEventListener("click", () => selectProject(button.dataset.project));
  });
}

function renderProjectHeader(project) {
  $("emptyState").classList.add("hidden");
  $("workspaceContent").classList.remove("hidden");
  $("projectTitle").textContent = project.name;
  $("projectMeta").innerHTML = `
    <span>${escapeHtml(project.stage || "未设置阶段")}</span>
    <span>体检 ${escapeHtml(healthLabel(project))}</span>
    <span>待办进度 ${escapeHtml(project.todoProgress?.progress ?? 0)}%</span>
    <span>AI ${escapeHtml(aiStatusLabel(project.ai?.status || "never"))}</span>
    <span>${project.ai?.noteCount || 0} 份会议</span>
    <span>${projectRiskCount(project)} 条风险</span>
    <span>更新 ${escapeHtml(project.updatedAt || "未知")}</span>
  `;
}

function renderSidePanel(project) {
  const healthLevel = project.health?.level || "neutral";
  $("sideStatus").className = `status-dot ${healthLevel === "ok" ? "ok-dot" : healthLevel === "danger" ? "danger-dot" : healthLevel === "warning" ? "warn-dot" : "muted-dot"}`;
  $("sideSummary").innerHTML = `
    <dl class="compact-list">
      <div><dt>项目阶段</dt><dd>${escapeHtml(project.stage || "未设置")}</dd></div>
      <div><dt>体检状态</dt><dd>${escapeHtml(healthLabel(project))}</dd></div>
      <div><dt>待办进度</dt><dd>${escapeHtml(project.todoProgress?.progress ?? 0)}%</dd></div>
      <div><dt>未闭环</dt><dd>${escapeHtml(project.todoProgress?.open ?? projectTodoCount(project))}</dd></div>
      <div><dt>AI 状态</dt><dd>${escapeHtml(aiStatusLabel(project.ai?.status || "never"))}</dd></div>
      <div><dt>会议记录</dt><dd>${project.ai?.noteCount || 0}</dd></div>
      <div><dt>风险事项</dt><dd>${projectRiskCount(project)}</dd></div>
      <div><dt>最后更新</dt><dd>${escapeHtml(project.updatedAt || "未知")}</dd></div>
    </dl>
  `;
}

function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".page-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  renderTab();
}

function statCard(label, value, detail = "") {
  return `
    <div class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|\s+(?=[\u4e00-\u9fa5])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listPanel(title, items, empty = "暂无记录") {
  const list = normalizeList(items);
  return `
    <section class="content-section">
      <div class="section-header">
        <h3>${escapeHtml(title)}</h3>
        <span>${list.length}</span>
      </div>
      ${list.length ? `<ul class="signal-list">${list.slice(0, 12).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="muted">${escapeHtml(empty)}</p>`}
    </section>
  `;
}

function renderOverview(project) {
  const progress = project.todoProgress || {};
  $("tabContent").innerHTML = `
    <div class="stat-row">
      ${statCard("待办进度", `${progress.progress ?? 0}%`, `${progress.done || 0}/${progress.total || 0} 已处理`)}
      ${statCard("会议记录", project.ai?.noteCount || 0, "AI 会议档案")}
      ${statCard("风险事项", projectRiskCount(project), "项目摘要")}
      ${statCard("未闭环待办", progress.open ?? projectTodoCount(project), "来自会议证据")}
    </div>
    <section class="content-card hero-card">
      <div class="content-card-header">
        <h3>项目摘要</h3>
        <span>${escapeHtml(project.path)}</span>
      </div>
      <p class="lead-text">${escapeHtml(project.summary || "暂无项目简介。")}</p>
    </section>
    <div class="two-column">
      ${listPanel("核心需求", project.needs?.core)}
      ${listPanel("特殊要求", project.needs?.special)}
      ${listPanel("材料工艺", project.needs?.materials)}
      ${listPanel("风险摘要", project.needs?.risks)}
    </div>
  `;
}

function issueCard(item) {
  return `
    <article class="issue-item ${escapeHtml(item.severity || "info")}">
      <div class="issue-main">
        <span class="issue-severity">${escapeHtml(severityLabel(item.severity))}</span>
        <div>
          <h4>${escapeHtml(item.title || "待处理事项")}</h4>
          <p>${escapeHtml(item.detail || "")}</p>
        </div>
      </div>
      <p class="issue-action">${escapeHtml(item.action || "请确认后处理。")}</p>
    </article>
  `;
}

function renderHealth(project) {
  const health = project.health || {};
  const progress = project.todoProgress || {};
  const issues = Array.isArray(health.issues) ? health.issues : [];
  const missingDirs = Array.isArray(health.missingDirectories) ? health.missingDirectories : [];
  $("tabContent").innerHTML = `
    <section class="health-hero ${healthClass(project)}">
      <div>
        <span class="section-kicker">项目体检</span>
        <h3>${escapeHtml(health.label || "未体检")}</h3>
        <p>${issues.length ? `当前有 ${issues.length} 个建议处理项，待办闭环进度 ${progress.progress ?? 0}%。` : "当前没有明显阻塞项，可以按正常节奏维护资料。"}</p>
      </div>
      <div class="health-score">
        <strong>${escapeHtml(`${progress.progress ?? 0}%`)}</strong>
        <span>待办进度</span>
      </div>
    </section>
    <div class="stat-row">
      ${statCard("风险", health.riskCount ?? 0, "摘要识别")}
      ${statCard("未闭环", progress.open ?? 0, `${progress.done || 0}/${progress.total || 0} 已处理`)}
      ${statCard("缺资料目录", health.missingDirectoryCount ?? 0, "标准结构")}
      ${statCard("问题项", health.issueCount ?? 0, "建议处理")}
    </div>
    <section class="content-section">
      <div class="section-header">
        <h3>建议处理项</h3>
        <span>${issues.length} 项</span>
      </div>
      ${issues.length ? `<div class="issue-list">${issues.map(issueCard).join("")}</div>` : `<p class="muted">暂无建议处理项。</p>`}
    </section>
    <section class="content-section">
      <div class="section-header">
        <h3>资料目录检查</h3>
        <span>${missingDirs.length ? "需要补齐" : "结构正常"}</span>
      </div>
      ${missingDirs.length ? `<ul class="signal-list">${missingDirs.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>` : `<p class="muted">标准资料目录都有内容记录。</p>`}
    </section>
  `;
}

function todoProgressBar(progress) {
  const value = Math.max(0, Math.min(100, Number(progress?.progress || 0)));
  return `
    <div class="todo-progress">
      <div class="todo-progress-head">
        <strong>${value}%</strong>
        <span>${progress?.done || 0}/${progress?.total || 0} 已处理</span>
      </div>
      <div class="todo-track"><span style="width: ${value}%"></span></div>
    </div>
  `;
}

function renderTodoItem(item) {
  const statuses = [
    ["pending", "待处理"],
    ["done", "已处理"],
    ["confirm", "需确认"],
    ["paused", "暂缓"],
  ];
  return `
    <article class="todo-item ${todoStatusClass(item.status)}">
      <div class="todo-item-head">
        <div>
          <span class="todo-date">${escapeHtml(item.meetingDate || "未知日期")}</span>
          <h4>${escapeHtml(item.text)}</h4>
        </div>
        <span class="status-pill ${todoStatusClass(item.status)}">${escapeHtml(todoStatusLabel(item.status))}</span>
      </div>
      <div class="todo-source">
        <strong>${escapeHtml(item.meetingTitle || "会议记录")}</strong>
        <span>${escapeHtml(item.sourceName || "来源文件")}</span>
      </div>
      ${item.sourceExcerpt ? `<blockquote>${escapeHtml(item.sourceExcerpt)}</blockquote>` : ""}
      <div class="todo-actions" data-todo="${escapeHtml(item.id)}">
        ${statuses.map(([status, label]) => `<button class="todo-status-button ${item.status === status ? "active" : ""}" data-status="${status}">${label}</button>`).join("")}
      </div>
    </article>
  `;
}

function filterTodos(todos) {
  if (state.todoFilter === "all") return todos;
  if (state.todoFilter === "open") return todos.filter((item) => item.status !== "done");
  return todos.filter((item) => item.status === state.todoFilter);
}

async function renderTodos(project) {
  $("tabContent").innerHTML = `
    <section class="content-section">
      <div class="section-header">
        <h3>待办闭环</h3>
        <span>正在读取</span>
      </div>
      <p class="muted">正在读取会议待办...</p>
    </section>
  `;
  try {
    const data = await api(`/api/projects/${encodeURIComponent(project.folderName)}/todos`);
    const progress = data.progress || {};
    const todos = Array.isArray(data.todos) ? data.todos : [];
    const visibleTodos = filterTodos(todos);
    $("tabContent").innerHTML = `
      <section class="todo-hero">
        <div>
          <span class="section-kicker">待办闭环</span>
          <h3>${progress.open ? `${progress.open} 条未闭环` : "全部已处理"}</h3>
          <p>状态会保存到项目档案目录，不修改 project.json。</p>
        </div>
        ${todoProgressBar(progress)}
      </section>
      <div class="stat-row">
        ${statCard("全部", progress.total || 0, "会议待办")}
        ${statCard("已处理", progress.done || 0, "闭环完成")}
        ${statCard("需确认", progress.confirm || 0, "等待判断")}
        ${statCard("暂缓", progress.paused || 0, "暂不处理")}
      </div>
      <section class="content-section">
        <div class="section-header">
          <h3>待办列表</h3>
          <span>${visibleTodos.length}/${todos.length} 条</span>
        </div>
        <div class="todo-filter-tabs">
          ${[
            ["open", "未闭环"],
            ["pending", "待处理"],
            ["confirm", "需确认"],
            ["paused", "暂缓"],
            ["done", "已处理"],
            ["all", "全部"],
          ].map(([filter, label]) => `<button class="todo-filter ${state.todoFilter === filter ? "active" : ""}" data-filter="${filter}">${label}</button>`).join("")}
        </div>
        ${visibleTodos.length ? `<div class="todo-list">${visibleTodos.map(renderTodoItem).join("")}</div>` : `<p class="muted">当前筛选下没有待办。</p>`}
      </section>
    `;
    $("tabContent").querySelectorAll(".todo-filter").forEach((button) => {
      button.addEventListener("click", () => {
        state.todoFilter = button.dataset.filter;
        renderTodos(project);
      });
    });
    $("tabContent").querySelectorAll(".todo-status-button").forEach((button) => {
      button.addEventListener("click", () => updateTodoStatus(project, button.parentElement.dataset.todo, button.dataset.status));
    });
  } catch (error) {
    $("tabContent").innerHTML = `<section class="content-section"><p class="error-text">${escapeHtml(error.message)}</p></section>`;
  }
}

async function updateTodoStatus(project, id, status) {
  await api(`/api/projects/${encodeURIComponent(project.folderName)}/todos/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  await selectProject(project.folderName);
}

function renderMaterials(project) {
  const stats = project.stats || {};
  const rows = Object.entries(stats).map(([key, value]) => `
    <tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>
  `).join("");
  const standardDirs = [
    "00_项目档案",
    "01_项目前期资料",
    "02_需求资料",
    "03_CAD图纸",
    "04_效果图",
    "05_汇报文件",
    "06_材料资料",
    "07_现场资料",
  ];
  $("tabContent").innerHTML = `
    <section class="content-section">
      <div class="section-header">
        <h3>标准目录</h3>
        <span>本地资料结构</span>
      </div>
      <div class="directory-grid">
        ${standardDirs.map((name) => `<div class="directory-item"><strong>${escapeHtml(name)}</strong><span>项目资料目录</span></div>`).join("")}
      </div>
    </section>
    <section class="content-section">
      <div class="section-header">
        <h3>资料统计</h3>
        <span>${Object.keys(stats).length} 项</span>
      </div>
      ${rows ? `<table class="data-table"><tbody>${rows}</tbody></table>` : `<p class="muted">暂无资料统计。扫描项目后会更新这里。</p>`}
    </section>
  `;
}

function renderMeetings(project) {
  const notes = project.notes || [];
  if (!state.selectedMeetingId && notes.length) state.selectedMeetingId = notes[notes.length - 1].id;
  $("tabContent").innerHTML = `
    <div class="meeting-layout">
      <section class="content-section meeting-timeline">
        <div class="section-header">
          <h3>会议时间线</h3>
          <span>${notes.length} 份</span>
        </div>
        <div class="timeline-list">
          ${notes.map((note) => `
            <button class="timeline-item ${state.selectedMeetingId === note.id ? "active" : ""}" data-note="${escapeHtml(note.id)}">
              <span>${escapeHtml(note.date || "未识别日期")}</span>
              <strong>${escapeHtml(note.title)}</strong>
              <small>讨论 ${note.counts?.discussions || 0} / 变更 ${note.counts?.changes || 0} / 风险 ${note.counts?.risks || 0}</small>
            </button>
          `).join("") || `<p class="muted">暂无会议档案。</p>`}
        </div>
      </section>
      <section id="meetingDetail" class="content-section meeting-detail">
        <p class="muted">选择会议查看详情。</p>
      </section>
    </div>
  `;
  $("tabContent").querySelectorAll(".timeline-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMeetingId = button.dataset.note;
      renderMeetings(project);
      loadMeeting(button.dataset.note);
    });
  });
  if (state.selectedMeetingId) loadMeeting(state.selectedMeetingId);
}

function evidenceList(title, entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return "";
  return `
    <section class="evidence-section">
      <h4>${escapeHtml(title)} <span>${list.length}</span></h4>
      <ul class="signal-list compact">
        ${list.slice(0, 18).map((entry) => `<li>${escapeHtml(entry.text || entry.source_excerpt || "")}</li>`).join("")}
      </ul>
    </section>
  `;
}

async function loadMeeting(noteId) {
  if (!state.selected) return;
  const detail = $("meetingDetail");
  if (!detail) return;
  const note = await api(`/api/projects/${encodeURIComponent(state.selected.folderName)}/notes/${encodeURIComponent(noteId)}`);
  const evidence = note.evidence || {};
  detail.innerHTML = `
    <div class="section-header">
      <h3>${escapeHtml(note.meeting_date || "会议详情")}</h3>
      <span>${escapeHtml(note.status || "")}</span>
    </div>
    <h4 class="detail-title">${escapeHtml(note.meeting_title || "")}</h4>
    <p class="source-line">${escapeHtml(note.source?.name || "")}</p>
    ${evidenceList("讨论事项", evidence["讨论事项"])}
    ${evidenceList("设计变更", evidence["设计变更"])}
    ${evidenceList("待办事项", evidence["待办事项"])}
    ${evidenceList("风险事项", evidence["风险事项"])}
    ${evidenceList("材料工艺", evidence["材料工艺"])}
  `;
}

async function renderRisks(project) {
  const risks = project.needs?.risks || [];
  const materials = project.needs?.materials || [];
  const todos = (project.notes || []).map((note) => ({
    title: note.title,
    date: note.date,
    count: note.counts?.todos || 0,
  })).filter((item) => item.count > 0);
  $("tabContent").innerHTML = `
    <div class="two-column">
      ${listPanel("风险事项", risks)}
      ${listPanel("材料工艺关注", materials)}
    </div>
    <section class="content-section">
      <div class="section-header">
        <h3>待办来源</h3>
        <span>${todos.reduce((sum, item) => sum + item.count, 0)} 条</span>
      </div>
      ${todos.length ? `
        <table class="data-table">
          <thead><tr><th>会议日期</th><th>会议</th><th>待办数</th></tr></thead>
          <tbody>
            ${todos.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.title)}</td><td>${item.count}</td></tr>`).join("")}
          </tbody>
        </table>
      ` : `<p class="muted">暂无待办来源。</p>`}
    </section>
  `;
}

function renderSearch(project) {
  $("tabContent").innerHTML = `
    <section class="content-section">
      <div class="section-header">
        <h3>证据搜索</h3>
        <span>当前项目</span>
      </div>
      <div class="search-row">
        <input id="noteSearchInput" class="input" placeholder="例如：水磨石 分缝">
        <button id="noteSearchBtn" class="button primary">搜索</button>
      </div>
      <div id="searchResults" class="search-results">
        ${state.searchResults.length ? renderSearchResults(state.searchResults) : `<p class="muted">输入关键词后搜索会议证据。</p>`}
      </div>
    </section>
  `;
  $("noteSearchBtn").addEventListener("click", searchNotes);
  $("noteSearchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchNotes();
  });
}

function assistantQuickQuestions() {
  return [
    "总结这个项目当前状态",
    "找出当前最需要关注的风险",
    "整理当前待办事项",
    "检查这个项目还缺哪些资料",
    "生成一份项目周报草稿",
  ];
}

function renderAssistant(project) {
  const status = state.aiStatus || {};
  const enabled = Boolean(status.enabled);
  $("tabContent").innerHTML = `
    <div class="assistant-shell">
      <section class="assistant-control">
        <div class="section-header">
          <h3>AI 只读助手</h3>
          <span>${enabled ? "已配置" : "未配置"}</span>
        </div>
        <div class="assistant-status ${enabled ? "ready" : "empty"}">
          <strong>${enabled ? `模型：${escapeHtml(status.model || "-")}` : "AI API 尚未配置"}</strong>
          <p>${enabled ? `接口：${escapeHtml(status.base_url || "")}` : `设置 PROJECT_AI_API_KEY，或在 config/local_settings.json 填写 API Key。`}</p>
        </div>
        <div class="quick-prompts">
          ${assistantQuickQuestions().map((question) => `<button class="quick-prompt" data-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join("")}
        </div>
        <div class="assistant-input-row">
          <label class="field-label" for="assistantQuestion">提问</label>
          <textarea id="assistantQuestion" class="assistant-input" placeholder="例如：目前最大的风险是什么？"></textarea>
          <button id="assistantAskBtn" class="button primary">提问</button>
        </div>
      </section>
      <section class="assistant-document">
        <div class="section-header">
          <h3>分析结果</h3>
          <span>只读回答</span>
        </div>
        <div id="assistantAnswer" class="assistant-answer">
          <div class="assistant-placeholder">
            <p>AI 会读取当前项目的 project.json 和会议证据，回答不会自动写入项目档案。</p>
          </div>
        </div>
        <div id="assistantSaveArea" class="assistant-save-area"></div>
      </section>
    </div>
  `;

  $("tabContent").querySelectorAll(".quick-prompt").forEach((button) => {
    button.addEventListener("click", () => {
      $("assistantQuestion").value = button.dataset.question;
      askAssistant(project);
    });
  });
  $("assistantAskBtn").addEventListener("click", () => askAssistant(project));
}

async function askAssistant(project) {
  if (!state.aiStatus?.enabled) {
    $("assistantAnswer").innerHTML = `<p class="error-text">AI 未配置。请设置 PROJECT_AI_API_KEY，或创建 config/local_settings.json。</p>`;
    $("assistantSaveArea").innerHTML = "";
    return;
  }
  const question = $("assistantQuestion").value.trim();
  if (!question) {
    $("assistantAnswer").innerHTML = `<p class="muted">请输入问题。</p>`;
    $("assistantSaveArea").innerHTML = "";
    return;
  }
  state.assistantLastAnswer = null;
  $("assistantAnswer").innerHTML = `<div class="assistant-placeholder"><p>正在整理项目资料并请求 AI...</p></div>`;
  $("assistantSaveArea").innerHTML = "";
  try {
    const data = await api(`/api/projects/${encodeURIComponent(project.folderName)}/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    state.assistantLastAnswer = {
      question,
      answer: data.answer,
      model: data.model,
    };
    $("assistantAnswer").innerHTML = `
      <div class="answer-meta">项目：${escapeHtml(data.project)} / 模型：${escapeHtml(data.model)} / 会议 ${data.meeting_count}</div>
      <div class="answer-body">${escapeHtml(data.answer).replaceAll("\n", "<br>")}</div>
    `;
    $("assistantSaveArea").innerHTML = `<button id="assistantSaveBtn" class="button ghost strong">保存到项目档案</button><span id="assistantSaveStatus" class="muted"></span>`;
    $("assistantSaveBtn").addEventListener("click", () => saveAssistantAnswer(project));
  } catch (error) {
    $("assistantAnswer").innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    $("assistantSaveArea").innerHTML = "";
  }
}

async function saveAssistantAnswer(project) {
  if (!state.assistantLastAnswer) return;
  $("assistantSaveStatus").textContent = " 正在保存...";
  try {
    const data = await api(`/api/projects/${encodeURIComponent(project.folderName)}/assistant/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.assistantLastAnswer),
    });
    $("assistantSaveStatus").textContent = ` 已保存：${data.filename}`;
  } catch (error) {
    $("assistantSaveStatus").textContent = ` 保存失败：${error.message}`;
  }
}

function renderSearchResults(results) {
  return results.map((item) => `
    <article class="result-item">
      <div class="result-head">
        <strong>${escapeHtml(item.meetingDate)} / ${escapeHtml(item.category)}</strong>
        <span>${escapeHtml(item.sourceName || "来源文件")}</span>
      </div>
      <p>${escapeHtml(item.text)}</p>
      ${item.sourceExcerpt ? `<blockquote>${escapeHtml(item.sourceExcerpt)}</blockquote>` : ""}
    </article>
  `).join("");
}

async function searchNotes() {
  if (!state.selected) return;
  const query = $("noteSearchInput").value.trim();
  if (!query) {
    $("searchResults").innerHTML = `<p class="muted">请输入关键词。</p>`;
    return;
  }
  const data = await api(`/api/projects/${encodeURIComponent(state.selected.folderName)}/search?q=${encodeURIComponent(query)}`);
  state.searchResults = data.results || [];
  $("searchResults").innerHTML = state.searchResults.length ? renderSearchResults(state.searchResults) : `<p class="muted">没有找到匹配结果。</p>`;
}

function renderTab() {
  if (!state.selected) return;
  if (state.activeTab === "overview") renderOverview(state.selected);
  if (state.activeTab === "health") renderHealth(state.selected);
  if (state.activeTab === "todos") renderTodos(state.selected);
  if (state.activeTab === "materials") renderMaterials(state.selected);
  if (state.activeTab === "meetings") renderMeetings(state.selected);
  if (state.activeTab === "risks") renderRisks(state.selected);
  if (state.activeTab === "search") renderSearch(state.selected);
  if (state.activeTab === "assistant") renderAssistant(state.selected);
}

function renderProject(project) {
  state.selected = project;
  state.selectedMeetingId = "";
  state.searchResults = [];
  state.assistantLastAnswer = null;
  renderProjectHeader(project);
  renderSidePanel(project);
  renderProjects();
  renderTab();
}

async function selectProject(folderName) {
  const project = await api(`/api/projects/${encodeURIComponent(folderName)}`);
  renderProject(project);
}

async function loadProjects(keepSelection = true) {
  await loadAiStatus();
  const data = await api("/api/projects");
  state.projects = data.projects || [];
  $("projectRoot").textContent = data.projectRoot || "";
  renderProjects();
  if (keepSelection && state.selected) {
    await selectProject(state.selected.folderName);
  } else if (state.projects.length) {
    await selectProject(state.projects[0].folderName);
  }
}

async function runAction(command) {
  $("actionStatus").textContent = "正在执行";
  $("actionOutput").textContent = "";
  try {
    const result = await api("/api/actions/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    $("actionStatus").textContent = result.ok ? "执行完成" : "执行失败";
    $("actionOutput").textContent = [result.stdout, result.stderr].filter(Boolean).join("\n") || "没有输出。";
    await loadProjects(true);
  } catch (error) {
    $("actionStatus").textContent = "执行失败";
    $("actionOutput").textContent = error.message;
  }
}

async function openFolder() {
  if (!state.selected) return;
  await api(`/api/projects/${encodeURIComponent(state.selected.folderName)}/open`, { method: "POST" });
}

function bindEvents() {
  $("reloadBtn").addEventListener("click", () => loadProjects(true));
  $("scanBtn").addEventListener("click", () => runAction("scan"));
  $("indexBtn").addEventListener("click", () => runAction("index"));
  $("monitorBtn").addEventListener("click", () => runAction("monitor"));
  $("refreshAllBtn").addEventListener("click", () => runAction("refresh"));
  $("openFolderBtn").addEventListener("click", openFolder);
  $("projectFilter").addEventListener("input", renderProjects);
  document.querySelectorAll(".filter-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-tab").forEach((item) => item.classList.toggle("active", item === button));
      renderProjects();
    });
  });
  document.querySelectorAll(".page-tab").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });
}

bindEvents();
loadProjects(false).catch((error) => {
  $("projectList").innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
});
