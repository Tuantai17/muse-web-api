"use strict";
// ---- keys ----
const BUILTIN_NOTE = {legacy: "MUSE2API_API_KEY (key đơn cũ)", admin: "MUSE2API_ADMIN_KEY"};
function tile(k, v, s = "", cls = "") {
  return `<div class="mini-tile ${cls}">
    <div class="mini-tile-label">${esc(k)}</div>
    <div class="mini-tile-val">${esc(v)}</div>
    <div class="mini-tile-sub" title="${esc(s)}">${esc(s)}</div>
  </div>`;
}
async function fetchKeys() {
  const res = await api("/admin/keys");
  // Active keys first; the server already orders by creation time.
  state.keys = (res.data || []).sort((a, b) => Number(a.revoked) - Number(b.revoked));
  state.builtin = res.builtin || [];
  const active = state.keys.filter((k) => !k.revoked).length;
  $("#nav-keys").textContent = state.keys.length ? active : "";
  fillFilterOptions();
}

function usageCells(u) {
  u = u || {};
  const n = (v, cls = "") => `<td class="num ${v ? cls : "zero"}"`;
  return `${n(u.total)} data-label="Total">${fmtNum(u.total || 0)}</td>
    ${n(u.requests_24h)} data-label="24h">${fmtNum(u.requests_24h || 0)}</td>
    ${n(u.errors_24h, "hot")} data-label="Errors 24h">${fmtNum(u.errors_24h || 0)}</td>
    <td data-label="Last request" title="${esc(fullTime(u.last_request_at))}">${esc(u.last_request_at ? ago(u.last_request_at) : "chưa có")}</td>`;
}

function formatVnDate(ts) {
  if (!ts) return "chưa có";
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatVnDay(ts) {
  if (!ts) return "–";
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

async function loadKeys() {
  await fetchKeys();
  const all = [...state.keys, ...state.builtin].map((k) => k.usage || {});
  const sum = (f) => all.reduce((s, u) => s + (u[f] || 0), 0);
  const active = state.keys.filter((k) => !k.revoked).length;
  const req24 = sum("requests_24h"), err24 = sum("errors_24h");
  $("#key-tiles").innerHTML = [
    tile("Keys hoạt động", fmtNum(active), `${fmtNum(state.keys.length - active)} đã thu hồi`),
    tile("Requests 24h", fmtNum(req24), "mọi key, không tính poll"),
    tile("Lỗi 24h", fmtNum(err24), req24 ? `${fmtPct(err24 / req24)} số request` : "–", err24 && err24 / req24 >= 0.1 ? "bad" : ""),
  ].join("");

  // Update Base URL & cURL
  const base = `${location.protocol}//${location.host}/v1`;
  const baseEl = $("#endpoint-base-url");
  if (baseEl) baseEl.textContent = base;

  const curlKey = state.lastCreatedKey || (state.keys.find(k => !k.revoked)?.prefix ? `${state.keys.find(k => !k.revoked).prefix}...` : "YOUR_API_KEY");
  const curlEl = $("#curl-code-snippet");
  if (curlEl) {
    curlEl.textContent = `curl ${base}/chat/completions \\\n  -H "Authorization: Bearer ${curlKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"muse-spark","messages":[{"role":"user","content":"Xin chào!"}]}'`;
  }

  // Update Current Key Highlight Box
  const latestKey = state.keys.find((k) => !k.revoked) || state.keys[0];
  const keyValEl = $("#key-current-val");
  const keyActionEl = $("#key-current-action");
  const keyMetaEl = $("#key-current-meta");

  if (state.lastCreatedKey) {
    if (keyValEl) {
      keyValEl.textContent = state.lastCreatedKey;
      keyValEl.style.color = "var(--ok)";
    }
    if (keyActionEl) {
      keyActionEl.innerHTML = `<button class="btn sm" id="btn-copy-active-key" type="button" style="padding:2px 8px;font-size:11.5px;font-weight:600;"><svg class="i"><use href="#i-copy"/></svg> Sao chép</button>`;
    }
    if (keyMetaEl) {
      keyMetaEl.innerHTML = `<span style="color:var(--ok);font-weight:600;">Vừa tạo xong!</span> Hãy lưu ngay vì server chỉ lưu bản băm.`;
    }
  } else if (latestKey) {
    const lastUsed = latestKey.last_used_at || (latestKey.usage && latestKey.usage.last_request_at) || 0;
    if (keyValEl) {
      keyValEl.textContent = `${latestKey.prefix}••••••••••••••••••••••`;
      keyValEl.style.color = "var(--text)";
    }
    if (keyActionEl) {
      keyActionEl.innerHTML = latestKey.revoked ? `<span class="badge b-err">đã thu hồi</span>` : `<span class="badge b-ok">hoạt động</span>`;
    }
    if (keyMetaEl) {
      keyMetaEl.textContent = `Tạo ${formatVnDate(latestKey.created_at)} · Dùng gần nhất ${lastUsed ? formatVnDate(lastUsed) : 'chưa có'}`;
    }
  } else {
    if (keyValEl) {
      keyValEl.textContent = "Chưa có key nào";
      keyValEl.style.color = "var(--muted)";
    }
    if (keyActionEl) keyActionEl.innerHTML = "";
    if (keyMetaEl) keyMetaEl.textContent = 'Nhập tên bên dưới và bấm "Tạo key mới" để bắt đầu.';
  }

  // Update Active Keys List
  const rowsListEl = $("#key-rows-list");
  if (rowsListEl) {
    if (!state.keys.length) {
      rowsListEl.innerHTML = `<div class="empty" style="padding:12px;font-size:12.5px;">Chưa có key nào. Nhập tên và bấm "Tạo key mới".</div>`;
    } else {
      rowsListEl.innerHTML = state.keys.map((k) => `
        <div class="active-key-item" style="padding:8px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div style="min-width:0; flex:1;">
            <code style="font-size:13.5px; font-weight:600; font-family:var(--mono); color:var(--text); letter-spacing:0.5px;">
              ${esc(k.prefix)}••••••••••••••••••••••
            </code>
            <div class="muted small" style="margin-top:3px; font-size:11.5px;">
              ${esc(k.name || 'API key cá nhân')} · ${formatVnDay(k.created_at)}
              ${k.revoked ? ' <span class="badge b-err" style="font-size:10px;padding:0 5px;line-height:16px;">đã thu hồi</span>' : ''}
            </div>
          </div>
          <div style="flex:none; margin-left:12px;">
            ${k.revoked ?
              `<button class="btn sm" data-id="${esc(k.id)}" data-act="unrevoke" style="font-size:11.5px;">Khôi phục</button>` :
              `<button class="btn-revoke" data-id="${esc(k.id)}" data-act="revoke">Thu hồi</button>`
            }
          </div>
        </div>
      `).join("");
    }
  }

  // Detailed Table for Management & Stats
  const statusBadgeK = (k) => k.revoked ? `<span class="badge b-err">đã thu hồi</span>` : `<span class="badge b-ok">hoạt động</span>`;
  const rows = state.keys.map((k) => `<tr class="click" data-id="${esc(k.id)}" tabindex="0" title="Xem requests của ${esc(k.name)}">
      <td class="cell-name"><div><b>${esc(k.name)}</b>${k.note ? `<div class="sub" title="${esc(k.note)}">${esc(k.note)}</div>` : ""}</div><span class="m-status">${statusBadgeK(k)}</span></td>
      <td class="mono hide-sm" data-label="Key">${esc(k.prefix)}…</td>
      <td class="cell-status" data-label="Status">${statusBadgeK(k)}</td>
      ${usageCells(k.usage)}
      <td class="actions"><div class="row">
        <button class="btn sm" type="button" data-act="edit">Đổi tên</button>
        <button class="btn sm" type="button" data-act="${k.revoked ? "unrevoke" : "revoke"}">${k.revoked ? "Khôi phục" : "Thu hồi"}</button>
        <button class="btn sm danger" type="button" data-act="delete">Xoá</button>
      </div></td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty" style="grid-column:1/-1">Chưa có key nào.</td></tr>`;
  const builtin = state.builtin.map((b) => `<tr class="click builtin" data-id="${esc(b.id)}" tabindex="0" title="Xem requests của ${esc(b.name)}">
      <td class="cell-name"><div><b>${esc(b.name)}</b><div class="sub">${esc(BUILTIN_NOTE[b.id] || "")}</div></div><span class="m-status"><span class="badge b-mute">có sẵn</span></span></td>
      <td class="mono hide-sm muted" data-label="Key">env</td>
      <td class="cell-status" data-label="Status"><span class="badge b-mute">có sẵn</span></td>
      ${usageCells(b.usage)}
      <td class="actions muted" style="font-size:12px">chỉ đọc</td>
    </tr>`).join("");
  $("#keys-body").innerHTML = rows + (builtin ? `<tr class="sep"><td colspan="8">Định danh có sẵn</td></tr>${builtin}` : "");
}

async function keyForm(title, k = {}, submit = "Lưu") {
  return modal({
    title,
    body: `<label class="f">Tên<input type="text" id="kf-name" maxlength="100" value="${esc(k.name || "")}" placeholder="vd. alice-laptop, n8n-prod" autocomplete="off"></label>
      <label class="f">Ghi chú <span class="hint">không bắt buộc — ai dùng, dùng cho việc gì</span><input type="text" id="kf-note" maxlength="500" value="${esc(k.note || "")}" autocomplete="off"></label>`,
    actions: [{label: "Huỷ", value: null},
      {label: submit, primary: true, cls: "primary",
       collect: () => ({name: $("#kf-name").value.trim(), note: $("#kf-note").value.trim()}),
       check: (v) => v.name ? "" : "Cần nhập tên cho key."}],
  });
}

$("#key-new")?.addEventListener("click", () => guarded(async () => {
  const form = await keyForm("Cấp API key mới", {}, "Cấp key");
  if (!form) return;
  const res = await api("/admin/keys", {method: "POST", body: form});
  state.lastCreatedKey = res.api_key;
  await loadKeys();
  await modal({
    title: `Đã cấp key “${res.key.name}”`,
    body: `<div class="warnbox"><b>Sao chép key ngay bây giờ.</b> Đây là lần duy nhất key được hiển thị — server chỉ lưu bản băm, không thể xem lại.</div>
      <div class="secret"><input type="text" id="new-key" readonly value="${esc(res.api_key)}" aria-label="API key mới" spellcheck="false">
      <button class="btn primary" type="button" id="copy-key">${icon("copy")}Sao chép</button></div>
      <div class="usage-hint">Authorization: Bearer ${esc(res.api_key.slice(0, 12))}…</div>`,
    actions: [{label: "Tôi đã lưu key", value: null, primary: true, cls: ""}],
  });
}));

// Inline Key Creation Handler
async function handleInlineCreateKey() {
  const input = $("#inline-key-name");
  const name = (input.value || "").trim() || "API key cá nhân";
  const btn = $("#btn-inline-create");
  btn.disabled = true;
  try {
    const res = await api("/admin/keys", {method: "POST", body: {name, note: ""}});
    state.lastCreatedKey = res.api_key;
    input.value = "";
    toast(`Đã cấp key “${res.key.name}”!`);
    await loadKeys();
  } catch (err) {
    toast(err.message || "Tạo key thất bại");
  } finally {
    btn.disabled = false;
  }
}
$("#btn-inline-create")?.addEventListener("click", () => guarded(handleInlineCreateKey));
$("#inline-key-name")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    guarded(handleInlineCreateKey);
  }
});

// Copy Buttons
$("#btn-copy-base-url")?.addEventListener("click", async () => {
  const base = `${location.protocol}//${location.host}/v1`;
  try { await navigator.clipboard.writeText(base); toast("Đã sao chép Base URL"); }
  catch { toast("Không thể tự động sao chép"); }
});

$("#btn-copy-curl")?.addEventListener("click", async () => {
  const base = `${location.protocol}//${location.host}/v1`;
  const curlKey = state.lastCreatedKey || (state.keys.find(k => !k.revoked)?.prefix ? `${state.keys.find(k => !k.revoked).prefix}...` : "YOUR_API_KEY");
  const cmd = `curl ${base}/chat/completions \\\n  -H "Authorization: Bearer ${curlKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"muse-spark","messages":[{"role":"user","content":"Xin chào!"}]}'`;
  try { await navigator.clipboard.writeText(cmd); toast("Đã sao chép cURL"); }
  catch { toast("Không thể tự động sao chép"); }
});

$("#key-current-display")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("#btn-copy-active-key");
  if (!btn || !state.lastCreatedKey) return;
  try { await navigator.clipboard.writeText(state.lastCreatedKey); toast("Đã sao chép API key"); }
  catch { toast("Không thể tự động sao chép"); }
});

// Active Keys List Actions (Revoke / Unrevoke)
$("#key-rows-list")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const k = state.keys.find((x) => x.id === btn.dataset.id);
  if (!k) return;
  guarded(async () => {
    const path = `/admin/keys/${encodeURIComponent(k.id)}`;
    const ident = `<b>${esc(k.name)}</b> (<span class="mono">${esc(k.prefix)}…</span>)`;
    if (btn.dataset.act === "revoke") {
      if (!await confirmBox("Thu hồi key?", `<p>Mọi request dùng ${ident} sẽ nhận 401 cho tới khi key được khôi phục.</p>`, "Thu hồi")) return;
      await api(path, {method: "PATCH", body: {revoked: true}});
      toast("Đã thu hồi key");
    } else if (btn.dataset.act === "unrevoke") {
      await api(path, {method: "PATCH", body: {revoked: false}});
      toast("Đã khôi phục key");
    }
    await loadKeys();
  });
});

// Modal body copy
$("#modal-body")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("#copy-key");
  if (!btn) return;
  const input = $("#new-key");
  input.select();
  let ok = false;
  try { await navigator.clipboard.writeText(input.value); ok = true; }
  catch { try { ok = document.execCommand("copy"); } catch {} }
  btn.innerHTML = ok ? `${icon("copy")}Đã sao chép` : "Hãy copy thủ công";
});

function openKeyRequests(id) { go("requests", {key: id}); }
$("#keys-body")?.addEventListener("keydown", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (tr && e.key === "Enter" && e.target === tr) openKeyRequests(tr.dataset.id);
});
$("#keys-body")?.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const btn = e.target.closest("button[data-act]");
  if (!btn) return openKeyRequests(tr.dataset.id);
  const k = state.keys.find((x) => x.id === tr.dataset.id);
  if (!k) return;
  guarded(async () => {
    const path = `/admin/keys/${encodeURIComponent(k.id)}`;
    const ident = `<b>${esc(k.name)}</b> (<span class="mono">${esc(k.prefix)}…</span>)`;
    switch (btn.dataset.act) {
      case "edit": {
        const form = await keyForm("Đổi tên key", k);
        if (!form) return;
        await api(path, {method: "PATCH", body: form});
        toast("Đã cập nhật key");
        break;
      }
      case "revoke":
        if (!await confirmBox("Thu hồi key?", `<p>Mọi request dùng ${ident} sẽ nhận 401 cho tới khi key được khôi phục.</p>`, "Thu hồi")) return;
        await api(path, {method: "PATCH", body: {revoked: true}});
        toast("Đã thu hồi key");
        break;
      case "unrevoke":
        await api(path, {method: "PATCH", body: {revoked: false}});
        toast("Đã khôi phục key");
        break;
      case "delete":
        if (!await confirmBox("Xoá key?", `<p>Xoá vĩnh viễn ${ident}? Client đang dùng key sẽ nhận 401. Lịch sử request vẫn được giữ trong log.</p>`, "Xoá key")) return;
        await api(path, {method: "DELETE"});
        toast("Đã xoá key");
        break;
    }
    await loadKeys();
  });
});
