"use strict";
// ---- accounts ----
const isQuota = (a) => /quota|credit|out of (usage|messages)|limit reached|exhaust/i.test(a.last_error || "");
function accState(a, t) {
  if (!a.enabled) return {key: "disabled", label: "đã tắt", cls: "mute", badge: "b-mute"};
  if (a.status === "invalid") return {key: "invalid", label: "lỗi phiên", cls: "err", badge: "b-err"};
  if (a.status === "cooling" && a.cooldown_until > t) {
    return isQuota(a) ? {key: "quota", label: "hết quota", cls: "warn", badge: "b-warn"}
      : {key: "cooling", label: "đang nghỉ", cls: "info", badge: "b-info"};
  }
  return {key: "active", label: "hoạt động", cls: "ok", badge: "b-ok"};
}

function accountTableRow(a) {
  const t = now(), s = accState(a, t);
  const q = a.meta?.quota || {};
  const email = a.meta?.email || (a.label && !a.label.startsWith("acc_") ? a.label : a.id);
  const checkTime = q.checked_at ? new Date(q.checked_at * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) + " " + new Date(q.checked_at * 1000).toLocaleDateString([], {day:'2-digit', month:'2-digit', year:'numeric'}) : (a.last_used_at ? ago(a.last_used_at) : (new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12: false}) + " " + new Date().toLocaleDateString([], {day:'2-digit', month:'2-digit', year:'numeric'})));
  
  let expTimestamp = 0;
  if (a.cookie_expires) {
    for (const exp of Object.values(a.cookie_expires)) {
      if (exp > expTimestamp) expTimestamp = exp;
    }
  }
  if (!expTimestamp) expTimestamp = (a.created_at || t) + 2 * 86400;
  const expDate = new Date(expTimestamp * 1000);
  const expStr = expDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) + " " + expDate.toLocaleDateString([], {day:'2-digit', month:'2-digit', year:'numeric'});

  let statusHtml = "";
  if (!a.enabled) {
    statusHtml = '<span class="status-pill status-pill-mute"><span class="dot-indicator dot-mute"></span> Đã tắt</span>';
  } else if (s.key === "active") {
    statusHtml = '<span class="status-pill status-pill-live"><span class="dot-indicator dot-live"></span> Live</span>';
  } else if (s.key === "invalid") {
    statusHtml = '<span class="status-pill status-pill-err"><span class="dot-indicator dot-err"></span> Lỗi phiên</span>';
  } else if (s.key === "quota") {
    statusHtml = '<span class="status-pill status-pill-warn"><span class="dot-indicator dot-warn"></span> Hết quota</span>';
  } else {
    statusHtml = `<span class="status-pill status-pill-info"><span class="dot-indicator dot-info"></span> ${esc(s.label)}</span>`;
  }

  const tokensLeft = q.extra_left || "1B token (Gói Muse)";
  const weeklyPct = Math.max(0, Math.min(100, 100 - (q.weekly_used_pct ?? 5)));

  return `<tr data-id="${esc(a.id)}">
    <td>
      <div class="acc-user-cell">
        <div class="acc-avatar-icon">
          <svg class="i"><use href="#i-accounts"/></svg>
        </div>
        <div>
          <div class="acc-name">${esc(email)}</div>
          <div class="acc-id-mono">${esc(a.id.slice(0, 16))}…</div>
        </div>
      </div>
    </td>
    <td>
      ${statusHtml}
      <div class="acc-meta-time">Kiểm tra: ${esc(checkTime)}</div>
    </td>
    <td>
      <div class="acc-quota-block">
        <strong class="acc-quota-title">${esc(tokensLeft)}</strong>
        <div class="acc-quota-sub">Token bổ sung · Tuần này: <b>${esc(weeklyPct)}%</b> còn</div>
        <div class="acc-quota-bar">
          <div class="acc-quota-fill" style="width: ${weeklyPct}%;"></div>
        </div>
        <button class="acc-quota-btn" type="button" data-act="quota">
          <svg class="i"><use href="#i-refresh"/></svg> Cập nhật token
        </button>
      </div>
    </td>
    <td>
      <div class="acc-exp-date">${esc(expStr)}</div>
      <div class="acc-meta-sub">Theo cookie phiên</div>
    </td>
    <td class="text-center">
      <span class="acc-use-badge">${fmtNum(a.success_count || a.use_count || 0)}</span>
    </td>
    <td class="text-right">
      <div class="acc-action-group">
        <button class="tbl-action-btn" type="button" data-act="renew" title="Gia hạn / Kiểm tra phiên">
          <svg class="i"><use href="#i-refresh"/></svg>
        </button>
        <button class="tbl-action-btn ${a.enabled ? 'is-active' : ''}" type="button" data-act="toggle" title="${a.enabled ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}">
          <svg class="i"><use href="${a.enabled ? '#i-eye' : '#i-eye-off'}"/></svg>
        </button>
        <button class="tbl-action-btn is-danger" type="button" data-act="delete" title="Xoá tài khoản">
          <svg class="i"><use href="#i-trash"/></svg>
        </button>
      </div>
    </td>
  </tr>`;
}

function renderAccounts() {
  const t = now(), counts = {active: 0, quota: 0, cooling: 0, invalid: 0, disabled: 0};
  for (const a of state.accounts) counts[accState(a, t).key] += 1;
  const order = {quota: 0, invalid: 1, cooling: 2, active: 3, disabled: 4};
  const list = [...state.accounts].sort((a, b) => (order[accState(a, t).key] - order[accState(b, t).key])
    || (a.meta?.email || a.label || a.id).localeCompare(b.meta?.email || b.label || b.id));
  
  if (!list.length) {
    $("#accounts").innerHTML = `<div class="card empty-card">
      <div class="empty-icon-wrap"><svg class="i"><use href="#i-accounts"/></svg></div>
      <h3>Chưa có tài khoản Muse nào</h3>
      <p>Thêm tài khoản muse.ai để bắt đầu kết nối không gian làm việc của bạn.</p>
      <button class="btn primary add-account-btn" id="empty-add-acc" type="button">
        <span class="plus-symbol">+</span> Thêm tài khoản Muse
      </button>
    </div>`;
    $("#empty-add-acc")?.addEventListener("click", () => accountForm().then((x) => x && guarded(loadAccountsPage)));
    return;
  }

  $("#accounts").innerHTML = `<div class="card table-card">
    <div class="card-header-row">
      <div class="card-header-left">
        <div class="section-icon-box kpi-mint">
          <svg class="i"><use href="#i-accounts"/></svg>
        </div>
        <div>
          <h2 class="card-heading">Tất cả tài khoản</h2>
          <p class="card-subheading">Danh sách phiên và trạng thái sẵn sàng</p>
        </div>
        <span class="card-count-badge">${list.length}</span>
      </div>
      <div class="card-header-right">
        <button class="btn ghost icon-btn" id="tbl-refresh" type="button" aria-label="Làm mới">
          <svg class="i"><use href="#i-refresh"/></svg>
        </button>
      </div>
    </div>
    <div class="tablewrap">
      <table class="recent-requests-table accounts-table">
        <thead>
          <tr>
            <th style="min-width:180px;">TÀI KHOẢN</th>
            <th style="min-width:140px;">TRẠNG THÁI</th>
            <th style="min-width:200px;">TOKEN CÒN LẠI</th>
            <th style="min-width:150px;">HIỆU LỰC ĐẾN</th>
            <th style="min-width:110px;text-align:center;">LƯỢT SỬ DỤNG</th>
            <th style="min-width:120px;text-align:right;">THAO TÁC</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(accountTableRow).join("")}
        </tbody>
      </table>
    </div>
  </div>`;

  const rBtn = $("#tbl-refresh");
  if (rBtn) rBtn.addEventListener("click", () => guarded(loadAccountsPage));
}

let lastQuotaAutoSync = 0;
async function loadAccountsPage() {
  await loadAccounts();
  renderAccounts();
  const t = now();
  if (t - lastQuotaAutoSync > 60 && state.accounts.length) {
    lastQuotaAutoSync = t;
    for (const a of state.accounts) {
      if (!a.enabled) continue;
      api(`/admin/accounts/${encodeURIComponent(a.id)}/quota`).then(() => loadAccounts().then(renderAccounts)).catch(() => {});
    }
  }
}

async function accountForm(title = "Thêm account muse.ai") {
  return modal({
    title,
    body: `<label class="f">Tên gợi nhớ (Label)<input type="text" id="af-label" placeholder="vd. Tài khoản chính, Account #1" autocomplete="off"></label>
      <label class="f">Cookie muse.ai <span class="hint">⚠️ Copy từ tab Network trong F12 (Headers → cookie:). Không dùng document.cookie vì thiếu cookie bảo mật HttpOnly!</span>
      <textarea id="af-cookies" rows="6" placeholder="hatch_sess=...; hatch_gw=...; hatch_vml=...; hatch_native_auth_device=..." style="font-family:var(--mono);font-size:12px;"></textarea></label>`,
    actions: [{label: "Huỷ", value: null},
              {label: "Lưu tài khoản", value: true, primary: true, cls: "primary"}],
  }).then(async (ok) => {
    if (!ok) return null;
    const label = $("#af-label").value.trim(), cookies = $("#af-cookies").value.trim();
    if (!cookies) throw new Error("Cookie không được để trống");
    return api("/admin/accounts", {method: "POST", body: {label, cookies}});
  });
}

$("#acc-new").addEventListener("click", () => accountForm().then((x) => x && guarded(loadAccountsPage)));

$("#accounts").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const tr = b.closest("tr[data-id]");
  if (!tr) return;
  const id = tr.dataset.id;
  const act = b.dataset.act;
  const acc = state.accounts.find((x) => x.id === id);
  if (!acc) return;

  if (act === "renew") {
    b.disabled = true;
    try {
      await api(`/admin/accounts/${encodeURIComponent(id)}/renew`, {method: "POST"});
      toast("Đã kiểm tra lại phiên tài khoản.");
      await loadAccountsPage();
    } catch (err) {
      toast("Lỗi làm mới: " + err.message);
    } finally {
      b.disabled = false;
    }
  } else if (act === "quota") {
    b.disabled = true;
    try {
      await api(`/admin/accounts/${encodeURIComponent(id)}/quota`, {method: "POST"});
      toast("Đã cập nhật số liệu token.");
      await loadAccountsPage();
    } catch (err) {
      toast("Lỗi cập nhật token: " + err.message);
    } finally {
      b.disabled = false;
    }
  } else if (act === "toggle") {
    b.disabled = true;
    try {
      await api(`/admin/accounts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: {enabled: !acc.enabled}
      });
      toast(acc.enabled ? "Đã tắt tài khoản." : "Đã bật tài khoản.");
      await loadAccountsPage();
    } catch (err) {
      toast("Lỗi: " + err.message);
    } finally {
      b.disabled = false;
    }
  } else if (act === "delete") {
    const ok = await confirmBox(
      "Xoá tài khoản Muse",
      `Bạn có chắc chắn muốn xoá tài khoản <b>${esc(acc.label || acc.id)}</b> không? Thao tác này không thể hoàn tác.`
    );
    if (!ok) return;
    b.disabled = true;
    try {
      await api(`/admin/accounts/${encodeURIComponent(id)}`, {method: "DELETE"});
      toast("Đã xoá tài khoản.");
      await loadAccountsPage();
    } catch (err) {
      toast("Lỗi xoá tài khoản: " + err.message);
    } finally {
      b.disabled = false;
    }
  }
});
