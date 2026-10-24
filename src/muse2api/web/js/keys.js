"use strict";
// ---- keys ----

const BUILTIN_NOTE = {legacy: "MUSE2API_API_KEY (key đơn cũ)", admin: "MUSE2API_ADMIN_KEY"};
let activeLang = "curl";
let keysFilterQuery = "";

async function fetchKeys() {
  const res = await api("/admin/keys");
  state.keys = (res.data || []).sort((a, b) => Number(a.revoked) - Number(b.revoked));
  state.builtin = res.builtin || [];
  const active = state.keys.filter((k) => !k.revoked).length;
  $("#nav-keys").textContent = state.keys.length ? active : "";
  fillFilterOptions();
}

function formatVnDate(ts) {
  if (!ts) return "chưa có";
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function renderCodeSnippet() {
  const base = `${location.protocol}//${location.host}/v1`;
  const curlKey = state.lastCreatedKey || (state.keys.find(k => !k.revoked)?.prefix ? `${state.keys.find(k => !k.revoked).prefix}...` : "YOUR_API_KEY");
  const el = $("#curl-code-snippet");
  const titleEl = $("#terminal-tab-title");
  if (!el) return;

  if (activeLang === "python") {
    if (titleEl) titleEl.textContent = "python — openai sdk";
    el.textContent = `from openai import OpenAI

client = OpenAI(
    base_url="${base}",
    api_key="${curlKey}"
)

response = client.chat.completions.create(
    model="muse-spark",
    messages=[{"role": "user", "content": "Xin chào Muse!"}]
)
print(response.choices[0].message.content)`;
  } else if (activeLang === "node") {
    if (titleEl) titleEl.textContent = "javascript — node.js openai";
    el.textContent = `import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "${base}",
  apiKey: "${curlKey}"
});

const response = await openai.chat.completions.create({
  model: "muse-spark",
  messages: [{ role: "user", content: "Xin chào Muse!" }],
});
console.log(response.choices[0].message.content);`;
  } else if (activeLang === "cursor") {
    if (titleEl) titleEl.textContent = "settings — cursor / continue.dev";
    el.textContent = `// Cài đặt trong Cursor IDE hoặc Continue.dev:
// Vào Settings > Models > OpenAI API:
Override OpenAI Base URL: ${base}
OpenAI API Key:          ${curlKey}

// Danh sách Model hỗ trợ nhập vào Cursor:
- muse-spark            (Khuyên dùng: Chat nhanh & Reasoning)
- gpt-4o                (Alias trỏ tới Muse Spark)
- claude-3-5-sonnet     (Alias trỏ tới Muse Spark)`;
  } else {
    if (titleEl) titleEl.textContent = "bash — curl request";
    el.textContent = `curl ${base}/chat/completions \\
  -H "Authorization: Bearer ${curlKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "muse-spark",
    "messages": [{"role": "user", "content": "Xin chào!"}]
  }'`;
  }
}

async function loadKeys() {
  await fetchKeys();
  const all = [...state.keys, ...state.builtin].map((k) => k.usage || {});
  const sum = (f) => all.reduce((s, u) => s + (u[f] || 0), 0);
  const active = state.keys.filter((k) => !k.revoked).length;
  const revoked = state.keys.length - active;
  const req24 = sum("requests_24h"), err24 = sum("errors_24h");
  const errPct = req24 ? ((err24 / req24) * 100).toFixed(1) + "%" : "0%";

  // Update KPI Tiles
  const kpiAct = $("#kpi-key-active");
  if (kpiAct) kpiAct.textContent = fmtNum(active);
  const kpiSub = $("#kpi-key-sub");
  if (kpiSub) kpiSub.textContent = `${fmtNum(revoked)} đã thu hồi`;

  const kpiReq = $("#kpi-req-24");
  if (kpiReq) kpiReq.textContent = fmtNum(req24);

  const kpiErr = $("#kpi-err-24");
  if (kpiErr) kpiErr.textContent = fmtNum(err24);
  const kpiErrPct = $("#kpi-err-pct");
  if (kpiErrPct) kpiErrPct.textContent = errPct;

  // Update Base URL
  const base = `${location.protocol}//${location.host}/v1`;
  const baseEl = $("#endpoint-base-url");
  if (baseEl) baseEl.textContent = base;

  // Update Badge count
  const badge = $("#keys-count-badge");
  if (badge) badge.textContent = state.keys.length;

  // Render Code Snippet
  renderCodeSnippet();

  // Filter keys by query
  const q = keysFilterQuery.toLowerCase().trim();
  const filteredKeys = state.keys.filter(k => {
    if (!q) return true;
    return (k.name && k.name.toLowerCase().includes(q)) ||
           (k.prefix && k.prefix.toLowerCase().includes(q)) ||
           (k.id && k.id.toLowerCase().includes(q));
  });

  // Render Table
  const statusBadgeK = (k) => k.revoked
    ? `<span class="status-pill status-pill-mute"><span class="dot-indicator dot-mute"></span> Đã thu hồi</span>`
    : `<span class="status-pill status-pill-live"><span class="dot-indicator dot-live"></span> Hoạt động</span>`;

  let rows = filteredKeys.map((k) => {
    const u = k.usage || {};
    const hasErr = (u.errors_24h || 0) > 0;
    return `<tr class="click" data-id="${esc(k.id)}" tabindex="0" title="Xem requests của ${esc(k.name)}">
      <td>
        <div class="key-name-block">
          <strong class="key-name-title">${esc(k.name)}</strong>
          ${k.note ? `<div class="key-note-sub">${esc(k.note)}</div>` : ""}
        </div>
      </td>
      <td>
        <div class="key-prefix-wrap">
          <code class="key-prefix-badge">${esc(k.prefix)}••••••••</code>
          <button class="tbl-action-btn copy-prefix-btn" type="button" data-act="copy-prefix" data-prefix="${esc(k.prefix)}" title="Sao chép tiền tố key">
            <svg class="i"><use href="#i-copy"/></svg>
          </button>
        </div>
      </td>
      <td>${statusBadgeK(k)}</td>
      <td class="text-right num font-mono">${fmtNum(u.total || 0)}</td>
      <td class="text-right num font-mono font-bold">${fmtNum(u.requests_24h || 0)}</td>
      <td class="text-right num font-mono">
        ${hasErr ? `<span class="err-count-badge">${fmtNum(u.errors_24h)}</span>` : `<span class="text-muted">0</span>`}
      </td>
      <td class="text-muted small">${esc(u.last_request_at ? ago(u.last_request_at) : "chưa có")}</td>
      <td class="text-right">
        <div class="acc-action-group" style="justify-content:flex-end;">
          <button class="tbl-action-btn" type="button" data-act="edit" title="Đổi tên">
            <svg class="i"><use href="#i-keys"/></svg>
          </button>
          <button class="tbl-action-btn" type="button" data-act="${k.revoked ? "unrevoke" : "revoke"}" title="${k.revoked ? "Khôi phục key" : "Thu hồi key"}">
            <svg class="i"><use href="${k.revoked ? "#i-check-circle" : "#i-eye-off"}"/></svg>
          </button>
          <button class="tbl-action-btn is-danger" type="button" data-act="delete" title="Xoá key">
            <svg class="i"><use href="#i-trash"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join("");

  if (!filteredKeys.length) {
    rows = `<tr><td colspan="8" class="empty">Chưa có API key cá nhân nào. Hãy bấm “Cấp API key mới” để bắt đầu.</td></tr>`;
  }

  // Ẩn các key định danh mặc định hệ thống theo yêu cầu, chỉ hiển thị danh sách key cá nhân
  const body = $("#keys-body");
  if (body) body.innerHTML = rows;
}

async function keyForm(title = "Cấp API key mới", k = {}, submit = "Tạo key") {
  const isEdit = !!k.name;
  return modal({
    title,
    body: `
      <div class="modal-security-notice">
        <svg class="i"><use href="#i-shield"/></svg>
        <div>
          ${isEdit ? "Cập nhật tên định danh hoặc ghi chú cho khóa API này." : "Khóa API cá nhân dùng để kết nối an toàn các công cụ, ứng dụng (như Cursor, Next.js, Python) với <strong>muse-web-api</strong>."}
        </div>
      </div>
      <div class="modal-form-stack">
        <div class="form-group">
          <label class="form-label" for="kf-name">Tên định danh khóa <span class="required-star">*</span></label>
          <input type="text" id="kf-name" maxlength="100" value="${esc(k.name || "")}" placeholder="vd: Cursor IDE, Next.js Web App, Bot N8N..." autocomplete="off" spellcheck="false">
          <span class="form-hint">Đặt tên gợi nhớ để phân biệt mục đích sử dụng hoặc ứng dụng kết nối.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="kf-note">Ghi chú mục đích sử dụng <span class="opt-label">(không bắt buộc)</span></label>
          <input type="text" id="kf-note" maxlength="500" value="${esc(k.note || "")}" placeholder="vd: Môi trường local development..." autocomplete="off">
          <span class="form-hint">Ghi chú hỗ trợ quản lý khi bạn có nhiều ứng dụng hoặc thiết bị cùng gọi API.</span>
        </div>
      </div>
    `,
    actions: [
      {label: "Huỷ bỏ", value: null, cls: "ghost"},
      {label: submit, primary: true, cls: "primary",
       collect: () => ({name: $("#kf-name").value.trim(), note: $("#kf-note").value.trim()}),
       check: (v) => v.name ? "" : "Vui lòng nhập tên định danh cho khóa API."}
    ],
  });
}

// Language Switcher Tabs
document.addEventListener("click", (e) => {
  const tab = e.target.closest(".lang-tab");
  if (!tab) return;
  for (const t of $$(".lang-tab")) t.classList.toggle("active", t === tab);
  activeLang = tab.dataset.lang;
  renderCodeSnippet();
});

// Create Key Action
$("#key-new")?.addEventListener("click", () => guarded(async () => {
  const form = await keyForm("Cấp API key mới", {}, "Tạo key");
  if (!form) return;
  const res = await api("/admin/keys", {method: "POST", body: form});
  state.lastCreatedKey = res.api_key;
  await loadKeys();

  // Đăng ký event copy cho modal kết quả
  const bindCopy = () => {
    const copyBtn = $("#copy-key-modal");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(res.api_key);
          toast("Đã sao chép khóa API đầy đủ!");
          const txt = $("#copy-key-text");
          if (txt) {
            const orig = txt.textContent;
            txt.textContent = "Đã chép!";
            setTimeout(() => { txt.textContent = orig; }, 1800);
          }
        } catch {
          toast("Không thể tự động sao chép. Vui lòng chọn và chép thủ công.");
        }
      });
    }
  };

  setTimeout(bindCopy, 50);

  await modal({
    title: `Đã tạo khóa “${esc(res.key.name)}” thành công`,
    body: `
      <div class="modal-alert-warn">
        <svg class="i"><use href="#i-shield"/></svg>
        <div>
          <strong>Lưu ý bảo mật quan trọng:</strong> Đây là <em>lần duy nhất</em> khóa API này được hiển thị đầy đủ. Server chỉ lưu mã băm SHA-256 một chiều, vì vậy bạn sẽ không thể xem lại khóa này sau khi đóng cửa sổ.
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Khóa API đầy đủ của bạn:</label>
        <div class="new-key-display-box">
          <input type="text" id="new-key" readonly value="${esc(res.api_key)}" spellcheck="false">
          <button class="btn primary" type="button" id="copy-key-modal" title="Sao chép khóa vào bộ nhớ tạm">
            <svg class="i"><use href="#i-copy"/></svg> <span id="copy-key-text">Sao chép</span>
          </button>
        </div>
      </div>
      <div class="key-created-footer-info">
        <span>Tiêu đề Authorization:</span>
        <code>Bearer ${esc(res.api_key.slice(0, 16))}••••••••</code>
      </div>
    `,
    actions: [{label: "Tôi đã lưu khóa an toàn", value: null, primary: true, cls: "primary"}],
  });
}));

// Quick Search
$("#keys-search-input")?.addEventListener("input", (e) => {
  keysFilterQuery = e.target.value;
  loadKeys();
});

// Refresh Button
$("#keys-refresh-btn")?.addEventListener("click", () => guarded(loadKeys));

// Copy Base URL
$("#btn-copy-base-url")?.addEventListener("click", async () => {
  const base = `${location.protocol}//${location.host}/v1`;
  const textEl = $("#btn-copy-base-text");
  try {
    await navigator.clipboard.writeText(base);
    toast("Đã sao chép Base URL!");
    if (textEl) {
      const orig = textEl.textContent;
      textEl.textContent = "Đã chép!";
      setTimeout(() => { textEl.textContent = orig; }, 1800);
    }
  } catch {
    toast("Không thể tự động sao chép.");
  }
});

// Copy Code Snippet
$("#btn-copy-curl")?.addEventListener("click", async () => {
  const code = $("#curl-code-snippet")?.textContent || "";
  const btn = $("#btn-copy-curl");
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    toast("Đã sao chép đoạn mã kết nối!");
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<svg class="i"><use href="#i-check-circle"/></svg> Đã sao chép!`;
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    }
  } catch {
    toast("Không thể tự động sao chép.");
  }
});

// Table row clicks & Action buttons
$("#keys-body")?.addEventListener("click", (e) => {
  const copyBtn = e.target.closest("button[data-act='copy-prefix']");
  if (copyBtn) {
    e.stopPropagation();
    const pfx = copyBtn.dataset.prefix;
    if (pfx) {
      navigator.clipboard.writeText(pfx).then(() => toast(`Đã chép tiền tố: ${pfx}`)).catch(() => {});
    }
    return;
  }

  const actBtn = e.target.closest("button[data-act]");
  if (actBtn) {
    e.stopPropagation();
    const tr = actBtn.closest("tr[data-id]");
    if (!tr) return;
    const k = state.keys.find((x) => x.id === tr.dataset.id);
    if (!k) return;
    const act = actBtn.dataset.act;

    guarded(async () => {
      const path = `/admin/keys/${encodeURIComponent(k.id)}`;
      const ident = `<b>${esc(k.name)}</b> (<span class="mono">${esc(k.prefix)}…</span>)`;

      if (act === "edit") {
        const form = await keyForm(`Đổi tên key`, {name: k.name, note: k.note}, "Lưu");
        if (!form) return;
        await api(path, {method: "PATCH", body: form});
        toast("Đã cập nhật thông tin key.");
        await loadKeys();
      } else if (act === "revoke") {
        if (!await confirmBox("Thu hồi key?", `<p>Mọi request dùng ${ident} sẽ nhận 401 cho tới khi key được khôi phục.</p>`, "Thu hồi")) return;
        await api(path, {method: "PATCH", body: {revoked: true}});
        toast("Đã thu hồi key.");
        await loadKeys();
      } else if (act === "unrevoke") {
        await api(path, {method: "PATCH", body: {revoked: false}});
        toast("Đã khôi phục key.");
        await loadKeys();
      } else if (act === "delete") {
        if (!await confirmBox("Xoá vĩnh viễn key?", `<p>Key ${ident} sẽ bị xoá hoàn toàn khỏi hệ thống. Thao tác này không thể hoàn tác.</p>`, "Xoá vĩnh viễn")) return;
        await api(path, {method: "DELETE"});
        toast("Đã xoá vĩnh viễn key.");
        await loadKeys();
      }
    });
    return;
  }

  // Row click: view requests for this key
  const tr = e.target.closest("tr[data-id]");
  if (tr) {
    go("requests", {key: tr.dataset.id});
  }
});
