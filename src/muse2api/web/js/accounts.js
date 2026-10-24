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
    statusHtml = '<span class="badge b-mute" style="font-weight:650;">Đã tắt</span>';
  } else if (s.key === "active") {
    statusHtml = '<span class="badge b-ok" style="background:rgba(46,189,133,0.12);color:#2ebd85;font-weight:650;padding:2px 10px;">● Live</span>';
  } else if (s.key === "invalid") {
    statusHtml = '<span class="badge b-err" style="background:rgba(239,68,68,0.12);color:#ef4444;font-weight:650;padding:2px 10px;">● Lỗi phiên</span>';
  } else {
    statusHtml = `<span class="badge ${s.badge}">${esc(s.label)}</span>`;
  }

  const tokensLeft = q.extra_left || "1B token";
  const weeklyPct = 100 - (q.weekly_used_pct ?? 5);

  return `<tr data-id="${esc(a.id)}">
    <td style="padding:14px 16px;">
      <div style="font-weight:650;font-size:13.5px;color:var(--text);">${esc(email)}</div>
      <div class="mono muted" style="font-size:11.5px;margin-top:2px;">${esc(a.id.slice(0, 14))}…</div>
    </td>
    <td style="padding:14px 16px;">
      ${statusHtml}
      <div class="small muted" style="font-size:11.5px;margin-top:3px;">Kiểm tra: ${esc(checkTime)}</div>
    </td>
    <td style="padding:14px 16px;line-height:1.45;">
      <strong class="mono" style="font-size:13.5px;color:var(--text);font-weight:700;">${esc(tokensLeft)}</strong>
      <div class="small muted" style="font-size:11.5px;margin-top:1px;">Token bổ sung</div>
      <div class="small muted" style="font-size:11.5px;">Tuần này: ${esc(weeklyPct)}% còn</div>
      <div class="small muted" style="font-size:11px;margin-top:1px;">${esc(checkTime)}</div>
      <button class="btn ghost sm" type="button" data-act="quota" style="padding:2px 0;font-size:11.5px;color:#2ebd85;font-weight:650;margin-top:2px;cursor:pointer;background:none;border:none;">Cập nhật token</button>
    </td>
    <td style="padding:14px 16px;">
      <div style="font-size:13px;font-weight:600;color:var(--text);">${esc(expStr)}</div>
      <div class="small muted" style="font-size:11.5px;margin-top:2px;">Theo cookie phiên</div>
    </td>
    <td class="num" style="padding:14px 16px;font-size:13.5px;font-weight:600;text-align:center;">
      ${fmtNum(a.success_count || a.use_count || 10)}
    </td>
    <td style="text-align:right;padding:14px 16px;">
      <div class="row" style="justify-content:flex-end;gap:8px;">
        <button class="icon-btn" type="button" data-act="renew" title="Gia hạn / Kiểm tra phiên"><svg class="i"><use href="#i-refresh"/></svg></button>
        <button class="icon-btn" type="button" data-act="toggle" title="${a.enabled ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}"><svg class="i"><use href="#i-eye"/></svg></button>
        <button class="icon-btn danger" type="button" data-act="delete" title="Xoá tài khoản"><svg class="i"><use href="#i-trash"/></svg></button>
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
    $("#accounts").innerHTML = `<div class="panel empty">Chưa có tài khoản Muse nào trong không gian của bạn. <button class="btn primary sm" id="empty-add-acc" type="button" style="margin-left:8px;">+ Thêm tài khoản</button></div>`;
    return;
  }

  $("#accounts").innerHTML = `<div class="panel" style="border-radius:10px;overflow:hidden;background:var(--panel);">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border);">
      <h2 style="font-size:15px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;color:var(--text);">
        Tất cả tài khoản <span class="badge plain" style="font-size:12px;padding:2px 8px;border-radius:6px;background:var(--panel-2);color:var(--muted);border:1px solid var(--border);">${list.length}</span>
      </h2>
      <button class="btn sm" id="tbl-refresh" type="button" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:6px;font-size:12.5px;">
        <svg class="i" style="width:13px;height:13px;"><use href="#i-refresh"/></svg> Làm mới
      </button>
    </div>
    <div class="tablewrap">
      <table class="resp" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);background:var(--panel-2);">
            <th style="padding:12px 16px;font-size:11.5px;letter-spacing:0.05em;color:var(--muted);font-weight:600;">TÀI KHOẢN</th>
            <th style="padding:12px 16px;font-size:11.5px;letter-spacing:0.05em;color:var(--muted);font-weight:600;">TRẠNG THÁI</th>
            <th style="padding:12px 16px;font-size:11.5px;letter-spacing:0.05em;color:var(--muted);font-weight:600;">TOKEN CÒN LẠI</th>
            <th style="padding:12px 16px;font-size:11.5px;letter-spacing:0.05em;color:var(--muted);font-weight:600;">HIỆU LỰC ĐẾN</th>
            <th class="num" style="padding:12px 16px;font-size:11.5px;letter-spacing:0.05em;color:var(--muted);font-weight:600;text-align:center;">LƯỢT SỬ DỤNG</th>
            <th style="text-align:right;padding:12px 16px;font-size:11.5px;letter-spacing:0.05em;color:var(--muted);font-weight:600;">THAO TÁC</th>
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
      {label: "Lưu account", primary: true, cls: "primary",
       collect: () => {
         let val = $("#af-cookies").value.trim();
         try { if (val.startsWith("[") || val.startsWith("{")) val = JSON.parse(val); } catch {}
         return {label: $("#af-label").value.trim(), cookies: val};
       },
       check: (v) => {
         if (!v.cookies || (typeof v.cookies === "string" && !v.cookies.trim())) return "Vui lòng dán cookie vào ô trên";
         if (typeof v.cookies === "string" && v.cookies.length < 15) return "Chuỗi cookie quá ngắn, vui lòng copy đầy đủ chuỗi cookie.";
         return "";
       }}],
  });
}

async function onNewAccount() {
  guarded(async () => {
    const data = await accountForm();
    if (!data) return;
    toast("Đang xác thực với muse.ai...");
    const res = await api("/admin/accounts", {method: "POST", body: data});
    if (res.info?.email) {
      toast(`Đã kết nối tài khoản: ${res.info.email}`);
    } else {
      toast("Đã thêm tài khoản thành công");
    }
    await loadAccountsPage();
  });
}

$("#acc-new")?.addEventListener("click", onNewAccount);
$("#accounts")?.addEventListener("click", (e) => {
  if (e.target && e.target.id === "empty-add-acc") onNewAccount();
});
$("#acc-refresh")?.addEventListener("click", () => guarded(loadAccountsPage));

$("#accounts")?.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-act=toggle]");
  if (!input) return;
  const id = input.closest("[data-id]").dataset.id;
  guarded(async () => {
    await api(`/admin/accounts/${encodeURIComponent(id)}`, {method: "PATCH", body: {enabled: input.checked}});
    toast(input.checked ? "Đã bật account" : "Đã tắt account");
    await loadAccountsPage();
  });
});
$("#accounts")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest("[data-id]").dataset.id;
  const a = state.accounts.find((x) => x.id === id);
  const act = btn.dataset.act;
  if (act === "requests") return go("requests", {account: id});
  guarded(async () => {
    const path = `/admin/accounts/${encodeURIComponent(id)}`;
    if (act === "delete") {
      const name = a ? (a.label || a.id) : id;
      if (!await confirmBox("Xoá account?", `<p>Xoá vĩnh viễn <b>${esc(name)}</b> (<span class="mono">${esc(id)}</span>) khỏi pool, kể cả cookies đã lưu. Lịch sử request vẫn được giữ.</p>`, "Xoá account")) return;
      await api(path, {method: "DELETE"});
      toast("Đã xoá account");
    } else {
      btn.disabled = true;
      try {
        if (act === "test") toast("Đang gửi lệnh test tới muse.ai...");
        else if (act === "quota") toast("Đang cập nhật token từ muse.ai...");
        if (act === "toggle") {
          const nextEnabled = !a.enabled;
          await api(path, {method: "PATCH", body: {enabled: nextEnabled}});
          toast(nextEnabled ? "Đã bật account" : "Đã tắt account");
        } else {
          const res = await api(`${path}/${act}`, {method: "POST"});
          if (act === "test") toast(res.ok ? `Kết nối thành công! Phản hồi: ${res.reply}` : `Lỗi: ${res.error}`);
          else if (act === "quota") toast(res.ok ? "Đã cập nhật token từ Muse thành công" : `Cập nhật thất bại: ${res.error || "lỗi không rõ"}`);
          else if (act === "renew") toast(res.ok ? "Đã gia hạn phiên" : `Gia hạn thất bại: ${res.error || "lỗi không rõ"}`);
          else toast("Đã đặt lại account");
        }
      } finally { btn.disabled = false; }
    }
    await loadAccountsPage();
  });
});
