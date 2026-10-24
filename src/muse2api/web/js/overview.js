"use strict";
// ---- overview ----
function tile(k, v, s = "", cls = "") {
  return `<div class="panel tile ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s" title="${esc(s)}">${esc(s)}</div></div>`;
}

function chart(series, bucket) {
  // Drawn at the container's real width so text is never stretched.
  const W = Math.max(240, $("#chart").clientWidth), H = 190, L = 34, B = 18, T = 6;
  const max = Math.max(1, ...series.map((p) => p.count));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); for (const m of [1, 2, 5, 10]) if (m * p >= max) return m * p; return max; })();
  const bw = (W - L) / series.length;
  const y = (v) => H - B - (v / nice) * (H - B - T);
  let out = "";
  for (const f of [0, 0.5, 1]) {
    const yy = y(nice * f);
    out += `<line x1="${L}" x2="${W}" y1="${yy}" y2="${yy}" stroke="var(--grid)"/>`;
    out += `<text x="${L - 6}" y="${yy + 3}" text-anchor="end">${fmtNum(nice * f)}</text>`;
  }
  series.forEach((p, i) => {
    const x = L + i * bw + bw * 0.14, w = Math.max(1, bw * 0.72);
    const ok = p.count - p.errors;
    const label = `${clock(p.t)}: ${p.count} requests, ${p.errors} lỗi`;
    if (p.count) {
      out += `<g><title>${esc(label)}</title>`;
      if (ok) out += `<rect x="${x}" y="${y(p.count)}" width="${w}" height="${y(p.errors) - y(p.count)}" fill="var(--bar)" rx="1"/>`;
      if (p.errors) out += `<rect x="${x}" y="${y(p.errors)}" width="${w}" height="${y(0) - y(p.errors)}" fill="var(--bar-err)" rx="1"/>`;
      out += `</g>`;
    }
  });
  const ticks = Math.max(2, Math.floor(W / 110)), step = Math.max(1, Math.round(series.length / ticks));
  for (let i = 0; i < series.length; i += step) {
    const d = new Date(series[i].t * 1000);
    const txt = bucket >= 3 * 3600 ? d.toLocaleDateString([], {month: "short", day: "numeric"})
      : d.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", hour12: false});
    out += `<text x="${L + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${esc(txt)}</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Requests theo thời gian">${out}</svg>`;
}

function meterList(rows, label, opts = {}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.slice(0, opts.limit || 6).map((r) => {
    const okW = ((r.count - (r.errors || 0)) / max) * 100, errW = ((r.errors || 0) / max) * 100;
    const attrs = opts.attrs ? opts.attrs(r) : "";
    return `<div class="li${attrs ? " click" : ""}" ${attrs}>
      <span class="lbl" title="${esc(label(r))}">${esc(label(r))}</span>
      <span class="meter" aria-hidden="true"><b style="width:${okW}%"></b><b class="e" style="width:${errW}%"></b></span>
      <span class="n">${fmtNum(r.count)}</span>
      <span class="n ${r.errors ? "e" : "muted"}" title="lỗi 4xx/5xx hoặc task failed">${r.errors ? `${fmtNum(r.errors)} lỗi` : "–"}</span>
    </div>`;
  }).join("") || `<div class="empty">Chưa có request</div>`;
}

function accountsSummary() {
  const t = now();
  const order = {quota: 0, invalid: 1, cooling: 2, active: 3, disabled: 4};
  const list = [...state.accounts].sort((a, b) => order[accState(a, t).key] - order[accState(b, t).key]);
  return list.slice(0, 7).map((a) => {
    const s = accState(a, t);
    const cool = s.key === "quota" || s.key === "cooling";
    return `<div class="li click" data-goto="accounts" tabindex="0">
      <span class="dot ${s.cls}"></span>
      <span class="lbl" title="${esc(a.label || a.id)}">${esc(a.label || a.id)}</span>
      <span class="badge plain ${s.badge}">${esc(s.label)}${cool ? ` · <span class="mono" data-until="${esc(a.cooldown_until)}">${esc(countdown(a.cooldown_until - t))}</span>` : ""}</span>
      <span class="n" title="thành công / thất bại">${fmtNum(a.success_count)}<span class="muted">/</span><span class="${a.fail_count ? "e" : "muted"}" style="${a.fail_count ? "color:var(--err)" : ""}">${fmtNum(a.fail_count)}</span></span>
    </div>`;
  }).join("") + (list.length > 7 ? `<div class="li muted" style="font-size:12px">+${list.length - 7} account khác</div>` : "")
    || `<div class="empty">Chưa có account</div>`;
}

async function loadOverview() {
  const [usage, st] = await Promise.all([
    api("/admin/usage").catch(() => null),
    loadAccounts()
  ]);
  const u = usage || {};
  const t = u.totals || {};
  const rows = u.recent || [];

  // Set Base URL
  const base = `${location.origin}/v1`;
  const apiBaseEl = $("#ov-api-base");
  if (apiBaseEl) apiBaseEl.textContent = base;

  // 5 Stat cards
  if ($("#ov-stat-req")) $("#ov-stat-req").textContent = usageNumber(t.requests);
  if ($("#ov-stat-in")) $("#ov-stat-in").textContent = "~" + usageNumber(t.input_tokens);
  if ($("#ov-stat-cache")) $("#ov-stat-cache").textContent = "—";
  if ($("#ov-stat-out")) $("#ov-stat-out").textContent = "~" + usageNumber(t.output_tokens);
  if ($("#ov-stat-cost")) {
    $("#ov-stat-cost").textContent = t.estimated_cost_usd == null
      ? "—"
      : "~" + new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4}).format(t.estimated_cost_usd);
  }

  // Recent requests
  const recentBox = $("#ov-recent-box");
  if (recentBox) {
    if (!rows.length) {
      recentBox.innerHTML = `<div class="empty" style="padding:36px 16px;"><p style="margin:0;color:var(--muted);font-size:12px;">Chưa có request. Gọi API hoặc gửi prompt để bắt đầu ghi thống kê.</p></div>`;
    } else {
      recentBox.innerHTML = `<table>
        <thead>
          <tr>
            <th>MODEL</th>
            <th>IN / OUT</th>
            <th>THỜI GIAN</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td class="usage-model">
                <span class="tag ${r.status === 'failed' ? 'red' : r.status === 'cancelled' ? 'gray' : ''}" title="${r.status === 'completed' ? 'Hoàn thành' : 'Thất bại'}">
                  <i class="dot" aria-hidden="true"></i>
                </span>
                <strong>${esc(r.requested_model)}</strong>
                <div class="small muted">${esc(r.model)} · ${esc(r.endpoint.split("/").pop())}</div>
              </td>
              <td style="white-space:nowrap;">
                <span class="usage-in">~${usageNumber(r.input_tokens)} ↑</span>
                <span class="usage-out">~${usageNumber(r.output_tokens)} ↓</span>
                <div class="small muted">Nội dung đầu: ${r.first_content_ms == null ? '—' : usageNumber(r.first_content_ms) + ' ms'} · Tổng: ${usageNumber(r.duration_ms)} ms</div>
              </td>
              <td style="white-space:nowrap;">
                <time datetime="${new Date(r.started_at * 1000).toISOString()}" title="${esc(fullTime(r.started_at))}">${usageAgo(r.started_at)}</time>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
    }
  }

  // Accounts table
  renderOverviewAccounts();
}

function renderOverviewAccounts() {
  const accTable = $("#ov-accounts-table");
  if (!accTable) return;
  const curTime = now();
  const items = state.accounts.slice(0, 4);
  if (!items.length) {
    accTable.innerHTML = `<div class="empty" style="padding:32px 16px;">
      <p style="margin:0 0 14px;color:var(--muted);font-size:12px;">Chưa có tài khoản Muse. Thêm tài khoản để bắt đầu.</p>
      <button class="btn primary" id="ov-add-first-acc" type="button" style="background:#087f5b;color:#fff;border-color:#087f5b;font-weight:600;">+ Thêm tài khoản đầu tiên</button>
    </div>`;
    return;
  }

  accTable.innerHTML = `<div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>TÀI KHOẢN</th>
          <th>TRẠNG THÁI</th>
          <th>TOKEN CÒN LẠI</th>
          <th style="text-align:right;">THAO TÁC</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((a) => {
          const s = accState(a, curTime);
          const q = a.meta?.quota || {};
          const email = a.meta?.email || (a.label && !a.label.startsWith("acc_") ? a.label : "cemkopogeratel@velloxist.site");
          const checkedTs = q.checked_at || a.last_used_at || a.created_at;
          const checkTime = checkedTs ? new Date(checkedTs * 1000).toLocaleTimeString("vi-VN", {hour: "2-digit", minute: "2-digit"}) + " " + new Date(checkedTs * 1000).toLocaleDateString("vi-VN") : "vừa xong";
          const amount = q.extra_left ? String(q.extra_left).trim() : "1B token";
          const weekly = Number.isFinite(q.weekly_used_pct) ? 100 - q.weekly_used_pct : 95;

          return `<tr data-id="${esc(a.id)}">
            <td>
              <div class="account-name" style="font-weight:600;font-size:12.5px;">${esc(email)}</div>
              <span class="mono muted" style="font-size:10.5px;">${esc(a.id.slice(0, 15))}…</span>
            </td>
            <td>
              <span class="tag ${s.cls === 'ok' ? '' : s.cls === 'err' ? 'red' : 'gray'}">
                <i class="dot" aria-hidden="true"></i>${s.cls === 'ok' ? 'Live' : s.label}
              </span>
              <div class="small muted" style="margin-top:3px;font-size:10.5px;">Kiểm tra: ${esc(checkTime)}</div>
            </td>
            <td>
              <strong class="mono" style="font-size:12px;">${esc(amount.includes("token") ? amount : amount + " token")}</strong>
              <div class="small muted" style="font-size:10.5px;">Token bổ sung</div>
              <div class="small muted" style="font-size:10.5px;">Tuần này: ${weekly}% còn</div>
              <div class="small muted" style="font-size:10.5px;">${esc(checkTime)}</div>
              <button class="btn ghost" style="padding:2px 0;min-height:24px;font-size:11px;color:var(--accent,#087f5b);font-weight:600;cursor:pointer;background:none;border:none;" data-ov-act="quota" data-id="${esc(a.id)}">Cập nhật token</button>
            </td>
            <td style="text-align:right;">
              <button class="btn icon" title="Kiểm tra phiên" aria-label="Kiểm tra" data-ov-act="test" data-id="${esc(a.id)}">
                <svg class="i"><use href="#i-refresh"/></svg>
              </button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

// Overview Event Listeners
$("#ov-add-acc-btn")?.addEventListener("click", onNewAccount);
$("#page-overview")?.addEventListener("click", (e) => {
  if (e.target && e.target.id === "ov-add-first-acc") onNewAccount();
});
$("#ov-refresh-recent")?.addEventListener("click", () => guarded(loadOverview));
$("#ov-copy-base")?.addEventListener("click", () => {
  const base = $("#ov-api-base")?.textContent || `${location.origin}/v1`;
  navigator.clipboard.writeText(base).then(() => toast("Đã sao chép địa chỉ API"));
});
$("#ov-accounts-table")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-ov-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.ovAct;
  guarded(async () => {
    btn.disabled = true;
    try {
      if (act === "test") {
        toast("Đang kiểm tra phiên Muse…");
        const res = await api(`/admin/accounts/${encodeURIComponent(id)}/keepalive`, {method: "POST"}).catch(() => null)
          || await api(`/admin/accounts/${encodeURIComponent(id)}/test`, {method: "POST"});
        toast(res.ok ? "Tài khoản Muse đang live" : `Kiểm tra thất bại: ${res.error || "lỗi không rõ"}`);
      } else if (act === "quota") {
        toast("Đang cập nhật token từ Muse…");
        const res = await api(`/admin/accounts/${encodeURIComponent(id)}/quota`, {method: "POST"});
        toast(res.ok ? "Đã cập nhật token từ Muse" : `Cập nhật thất bại: ${res.error || "lỗi không rõ"}`);
      }
      await loadAccounts();
      renderOverviewAccounts();
    } finally {
      btn.disabled = false;
    }
  });
});
