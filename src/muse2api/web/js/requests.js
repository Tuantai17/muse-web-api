"use strict";
// ---- requests ----

function methodBadge(m) {
  const method = (m || "").toUpperCase();
  const cls = method === "POST" ? "m-post" : method === "GET" ? "m-get" : method === "DELETE" ? "m-del" : "m-other";
  return `<span class="method-tag ${cls}">${esc(method)}</span>`;
}

function fillFilterOptions() {
  const keySel = $("#f-key"), accSel = $("#f-account");
  const keyVal = keySel.value || state.pendingKey || "", accVal = accSel.value || state.pendingAccount || "";
  keySel.innerHTML = `<option value="">Mọi key</option><option value="legacy">legacy</option><option value="admin">admin</option>`
    + state.keys.map((k) => `<option value="${esc(k.id)}">${esc(k.name)}${k.revoked ? " (đã thu hồi)" : ""}</option>`).join("");
  accSel.innerHTML = `<option value="">Mọi account</option>`
    + state.accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.label || a.id)}</option>`).join("");
  for (const [sel, val] of [[keySel, keyVal], [accSel, accVal]]) {
    sel.value = val;
    if (val && sel.value !== val) {
      // Deleted key or account that is still in the log: keep it selectable.
      const o = document.createElement("option");
      o.value = val; o.textContent = val;
      sel.appendChild(o);
      sel.value = val;
    }
  }
  state.pendingKey = state.pendingAccount = "";
  renderChips();
}

function renderChips() {
  const chips = [];
  const k = $("#f-key").value, a = $("#f-account").value;
  if (k) chips.push(`<span class="chip">Key: ${esc(keyLabel(k, k))}<button type="button" data-clear="f-key" aria-label="Bỏ lọc key"><svg class="i"><use href="#i-x"/></svg></button></span>`);
  if (a) chips.push(`<span class="chip">Account: ${esc(accountLabel(a))}<button type="button" data-clear="f-account" aria-label="Bỏ lọc account"><svg class="i"><use href="#i-x"/></svg></button></span>`);
  $("#f-chips").innerHTML = chips.join("");
}

$("#f-chips").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-clear]");
  if (!b) return;
  $(`#${b.dataset.clear}`).value = "";
  state.offset = 0;
  renderChips();
  syncHash();
  guarded(loadRequests);
});

let lastRows = [];
async function loadRequests() {
  const p = new URLSearchParams({limit: state.limit, offset: state.offset});
  if ($("#f-key").value) p.set("key_id", $("#f-key").value);
  if ($("#f-account").value) p.set("account_id", $("#f-account").value);
  if ($("#f-status").value) p.set("status", $("#f-status").value);
  if ($("#f-path").value.trim()) p.set("path", $("#f-path").value.trim());
  if ($("#f-polls").checked) p.set("hide_polls", "true");
  const res = await api(`/admin/requests?${p}`);
  lastRows = res.data;
  $("#req-body").innerHTML = res.data.map((r, i) => `<tr class="click" data-i="${i}" tabindex="0">
      <td class="text-left mono-time" title="${esc(fullTime(r.ts))}">${esc(clock(r.ts))}</td>
      <td class="text-center">${methodBadge(r.method)}</td>
      <td class="text-left path-cell">
        <span class="path-code" title="${esc(r.path)}">${esc(r.path)}</span>
        ${r.stream ? ` <span class="badge plain b-mute">stream</span>` : ""}
        ${r.poll ? ` <span class="badge plain b-mute">poll</span>` : ""}
      </td>
      <td class="text-left hide-sm">${r.model ? `<span class="model-tag">${esc(r.model)}</span>` : '<span class="text-muted">–</span>'}</td>
      <td class="text-left"><span class="key-name-tag">${esc(r.key_name || (r.key_id ? r.key_id.slice(0, 8) + '…' : "–"))}</span></td>
      <td class="text-left hide-sm"><span class="acc-tag">${esc(accountLabel(r.account_id))}</span></td>
      <td class="text-center" title="${esc(r.error || "")}">${statusBadge(r.status_code)}${taskBadge(r)}</td>
      <td class="text-right num-latency">${esc(fmtMs(r.latency_ms))}</td>
      <td class="text-left hide-sm mono-client">${esc(r.client_ip || "–")}</td>
    </tr>`).join("") || `<tr><td colspan="9" class="empty">Không có request nào khớp bộ lọc.</td></tr>`;
  const end = state.offset + res.data.length;
  $("#req-range").textContent = res.total ? `Hiển thị ${state.offset + 1}–${end} / ${fmtNum(res.total)} request` : "";
  $("#req-prev").disabled = state.offset === 0;
  $("#req-next").disabled = end >= res.total;
}

function showRequest(r) {
  const fields = [
    ["ID", r.id], ["Time", fullTime(r.ts)], ["Method", r.method], ["Path", r.path],
    ["Status", r.status_code], ["Latency", fmtMs(r.latency_ms)], ["Stream", r.stream ? "yes" : "no"],
    ["Poll", r.poll ? "yes" : "no"], ["Model", r.model], ["Key", r.key_name ? `${r.key_name} (${r.key_id})` : ""],
    ["Account", r.account_id ? `${accountLabel(r.account_id)} (${r.account_id})` : ""],
    ["Task", r.task_id ? `${r.task_id} · ${r.task_status || "running"}${r.task_ms != null ? ` · ${fmtMs(r.task_ms)}` : ""}` : ""], ["Client IP", r.client_ip], ["User agent", r.user_agent],
  ];
  modal({
    title: `${r.method} ${r.path}`, wide: true,
    body: `${r.error ? `<div class="errbox">${esc(r.error)}</div>` : ""}
      <dl class="kv">${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v == null || v === "" ? "–" : v)}</dd>`).join("")}</dl>`,
    actions: [{label: "Đóng", value: null, primary: true, cls: "primary"}],
  });
}

$("#req-body").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr) showRequest(lastRows[Number(tr.dataset.i)]);
});

$("#req-body").addEventListener("keydown", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr && e.key === "Enter") showRequest(lastRows[Number(tr.dataset.i)]);
});

for (const id of ["#f-key", "#f-account", "#f-status", "#f-polls"]) {
  $(id).addEventListener("change", () => { state.offset = 0; renderChips(); syncHash(); guarded(loadRequests); });
}

let pathTimer;
$("#f-path").addEventListener("input", () => {
  clearTimeout(pathTimer);
  pathTimer = setTimeout(() => { state.offset = 0; guarded(loadRequests); }, 300);
});

$("#f-live").addEventListener("change", () => {
  $("#live-dot").classList.toggle("on", $("#f-live").checked);
});

$("#req-prev").addEventListener("click", () => {
  state.offset = Math.max(0, state.offset - state.limit);
  guarded(loadRequests);
});

$("#req-next").addEventListener("click", () => {
  state.offset += state.limit;
  guarded(loadRequests);
});
