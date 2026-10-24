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
    <td class="text-left">
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
    <td class="text-left">
      ${statusHtml}
      <div class="acc-meta-time">Kiểm tra: ${esc(checkTime)}</div>
    </td>
    <td class="text-left">
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
    <td class="text-left">
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
            <th style="min-width:180px;" class="text-left">TÀI KHOẢN</th>
            <th style="min-width:140px;" class="text-left">TRẠNG THÁI</th>
            <th style="min-width:200px;" class="text-left">TOKEN CÒN LẠI</th>
            <th style="min-width:150px;" class="text-left">HIỆU LỰC ĐẾN</th>
            <th style="min-width:110px;" class="text-center">LƯỢT SỬ DỤNG</th>
            <th style="min-width:120px;" class="text-right">THAO TÁC</th>
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
  let isVerified = false;
  let lastVerifiedCookie = "";

  const bodyHtml = `
    <label class="f">Tên gợi nhớ (Label)
      <input type="text" id="af-label" placeholder="vd. Tài khoản chính, Account #1" autocomplete="off">
    </label>
    
    <label class="f">Cookie muse.ai 
      <span class="hint">⚠️ Copy từ tab Network trong F12 (Headers → cookie:). Chỉ cần có cookie <code>hatch_sess</code> là hệ thống sẽ tự động liên kết phiên!</span>
      <textarea id="af-cookies" rows="5" placeholder="hatch_sess=...; hatch_gw=...; hatch_vml=...; hatch_native_auth_device=..." style="font-family:var(--mono);font-size:12px;"></textarea>
    </label>

    <div style="margin-top:12px;display:flex;align-items:center;gap:10px;">
      <button class="btn secondary" id="af-verify-btn" type="button" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:7px 14px;border-radius:6px;cursor:pointer;">
        <svg class="i" style="width:15px;height:15px;"><use href="#i-shield-check"/></svg>
        <span id="af-verify-btn-text">Kiểm tra kết nối Cookie</span>
      </button>
      <span id="af-verify-spinner" style="display:none;font-size:12px;color:var(--muted);align-items:center;gap:5px;">
        <svg class="i spin" style="width:14px;height:14px;"><use href="#i-refresh"/></svg> Đang kiểm tra kết nối muse.ai...
      </span>
    </div>

    <div id="af-status-banner" style="display:none;margin-top:12px;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.5;"></div>
  `;

  async function runVerification() {
    const cookies = ($("#af-cookies")?.value || "").trim();
    const label = ($("#af-label")?.value || "").trim();
    const banner = $("#af-status-banner");
    const vBtn = $("#af-verify-btn");
    const spinner = $("#af-verify-spinner");

    if (!cookies) {
      if (banner) {
        banner.style.display = "block";
        banner.style.background = "#fef2f2";
        banner.style.border = "1px solid #fca5a5";
        banner.style.color = "#991b1b";
        banner.innerHTML = "<b>✕ Vui lòng dán Cookie</b> trước khi kiểm tra hoặc lưu.";
      }
      return false;
    }

    if (vBtn) vBtn.disabled = true;
    if (spinner) spinner.style.display = "inline-flex";
    if (banner) banner.style.display = "none";

    try {
      const res = await api("/admin/accounts/verify", {
        method: "POST",
        body: { label, cookies }
      });

      if (res && res.ok) {
        isVerified = true;
        lastVerifiedCookie = cookies;

        const labelInput = $("#af-label");
        if (labelInput && !labelInput.value.trim() && res.email && res.email !== "muse.ai member") {
          labelInput.value = res.email;
        }

        if (banner) {
          banner.style.display = "block";
          banner.style.background = "#f0fdf4";
          banner.style.border = "1px solid #86efac";
          banner.style.color = "#166534";
          banner.innerHTML = `
            <div style="font-weight:600;display:flex;align-items:center;gap:6px;">
              <span style="display:inline-grid;place-items:center;width:18px;height:18px;background:#22c55e;color:#fff;border-radius:50%;font-size:11px;">✓</span>
              Xác nhận kết nối thành công tới muse.ai!
            </div>
            <div style="margin-top:6px;font-size:12px;color:#15803d;">
              Tài khoản: <b>${esc(res.email || "muse.ai member")}</b> · Trạng thái phiên: <b>Sẵn sàng (Live)</b>
            </div>
          `;
        }
        return true;
      } else {
        isVerified = false;
        if (banner) {
          banner.style.display = "block";
          banner.style.background = "#fef2f2";
          banner.style.border = "1px solid #fca5a5";
          banner.style.color = "#991b1b";
          banner.innerHTML = `
            <div style="font-weight:600;display:flex;align-items:center;gap:6px;">
              <span style="display:inline-grid;place-items:center;width:18px;height:18px;background:#ef4444;color:#fff;border-radius:50%;font-size:11px;">✕</span>
              Kết nối thất bại: ${esc(res?.error || "Cookie không hợp lệ hoặc đã hết hạn")}
            </div>
            <div style="margin-top:6px;font-size:12px;color:#b91c1c;">
              Vui lòng copy lại từ tab <b>Network</b> trong F12 (Headers → cookie:) trên trang muse.ai.
            </div>
          `;
        }
        return false;
      }
    } catch (err) {
      isVerified = false;
      if (banner) {
        banner.style.display = "block";
        banner.style.background = "#fef2f2";
        banner.style.border = "1px solid #fca5a5";
        banner.style.color = "#991b1b";
        banner.innerHTML = `<b>✕ Lỗi kiểm tra:</b> ${esc(err.message)}`;
      }
      return false;
    } finally {
      if (vBtn) vBtn.disabled = false;
      if (spinner) spinner.style.display = "none";
    }
  }

  const p = modal({
    title,
    body: bodyHtml,
    actions: [
      { label: "Huỷ", value: null },
      {
        label: "Lưu tài khoản",
        value: true,
        primary: true,
        cls: "primary",
        check: async () => {
          const cookies = ($("#af-cookies")?.value || "").trim();
          if (!cookies) return "Cookie không được để trống";

          // If not verified or modified after verification, verify first before saving
          if (!isVerified || cookies !== lastVerifiedCookie) {
            toast("Đang kiểm tra kết nối Cookie tới muse.ai trước khi lưu...");
            const ok = await runVerification();
            if (!ok) {
              return "Chưa thể lưu: Kết nối Cookie tới muse.ai chưa thành công. Vui lòng kiểm tra lại.";
            }
          }
          return null;
        }
      }
    ]
  });

  setTimeout(() => {
    $("#af-verify-btn")?.addEventListener("click", () => runVerification());
    $("#af-cookies")?.addEventListener("input", () => {
      isVerified = false;
      const banner = $("#af-status-banner");
      if (banner) banner.style.display = "none";
    });
  }, 20);

  return p.then(async (ok) => {
    if (!ok) return null;
    const label = ($("#af-label")?.value || "").trim();
    const cookies = ($("#af-cookies")?.value || "").trim();
    const saved = await api("/admin/accounts", { method: "POST", body: { label, cookies } });
    toast("✓ Đã kết nối và lưu tài khoản Muse thành công!");
    return saved;
  });
}

window.openAccountModal = () => accountForm().then((x) => x && guarded(loadAccountsPage));

$("#acc-new").addEventListener("click", () => window.openAccountModal());

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
