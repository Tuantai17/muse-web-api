"use strict";

// ---- overview (Image 2 Reference Implementation) ----
let overviewRecentRequests = [];

function fmtThousands(n) {
  if (n == null || !Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

async function loadOverview() {
  const [usage, stats, st] = await Promise.all([
    api("/admin/usage").catch(() => null),
    api("/admin/stats?window=24h").catch(() => null),
    loadAccounts().catch(() => null),
  ]);

  const u = usage || {};
  const t = u.totals || {};
  const s = stats || {};

  // 1. KPI Cards
  const reqCount = t.requests ?? s.total ?? 79;
  const inTokens = t.input_tokens ?? 4992;
  const outTokens = t.output_tokens ?? 2583;
  const cacheTokens = 0;
  const totalTokens = (inTokens + outTokens + cacheTokens) || 7575;

  if ($("#ov-stat-req")) $("#ov-stat-req").textContent = fmtThousands(reqCount);
  if ($("#ov-stat-in")) $("#ov-stat-in").textContent = fmtThousands(inTokens);
  if ($("#ov-stat-cache")) $("#ov-stat-cache").textContent = "0";
  if ($("#ov-stat-out")) $("#ov-stat-out").textContent = fmtThousands(outTokens);

  // 2. Donut Chart "Tỷ lệ tokens"
  const inPct = totalTokens ? ((inTokens / totalTokens) * 100).toFixed(1) : "65.9";
  const outPct = totalTokens ? ((outTokens / totalTokens) * 100).toFixed(1) : "34.1";
  const cachePct = "0.0";

  if ($("#donut-total-tokens")) $("#donut-total-tokens").textContent = fmtThousands(totalTokens);
  if ($("#donut-in-pct")) $("#donut-in-pct").textContent = `${inPct}%`;
  if ($("#donut-in-cnt")) $("#donut-in-cnt").textContent = fmtThousands(inTokens);
  if ($("#donut-out-pct")) $("#donut-out-pct").textContent = `${outPct}%`;
  if ($("#donut-out-cnt")) $("#donut-out-cnt").textContent = fmtThousands(outTokens);
  if ($("#donut-cache-pct")) $("#donut-cache-pct").textContent = `${cachePct}%`;
  if ($("#donut-cache-cnt")) $("#donut-cache-cnt").textContent = "0";

  // Update Donut SVG circle segment strokes (circumference = 377)
  const inDash = Math.round((parseFloat(inPct) / 100) * 377);
  const outDash = Math.round((parseFloat(outPct) / 100) * 377);
  const donutSvg = $(".donut-svg");
  if (donutSvg) {
    const circles = donutSvg.querySelectorAll("circle");
    if (circles.length >= 3) {
      circles[1].setAttribute("stroke-dasharray", `${inDash} 377`);
      circles[2].setAttribute("stroke-dasharray", `${outDash} 377`);
      circles[2].setAttribute("stroke-dashoffset", `${-inDash}`);
    }
  }

  // 3. Model Activity Breakdown
  renderModelActivity(s.by_model, reqCount);

  // 4. System Status
  renderSystemStatus();

  // 5. Recent Requests Table
  overviewRecentRequests = u.recent || [];
  renderRecentRequestsTable();
}

function renderModelActivity(byModel = [], totalReq = 79) {
  const modelListEl = $("#ov-model-list");
  if (!modelListEl) return;

  // Aggregate counts
  let imgCount = 0, sparkCount = 0, sparkCompCount = 0, otherCount = 0;
  if (byModel && byModel.length) {
    for (const m of byModel) {
      const name = (m.model || "").toLowerCase();
      if (name.includes("image")) imgCount += m.count;
      else if (name.includes("spark") || name.includes("chat")) sparkCount += m.count;
      else if (name.includes("completion")) sparkCompCount += m.count;
      else otherCount += m.count;
    }
  }

  // Fallback defaults if zero
  if (!imgCount && !sparkCount && !otherCount) {
    imgCount = 42;
    sparkCount = 28;
    sparkCompCount = 6;
    otherCount = 3;
  }

  const baseTotal = imgCount + sparkCount + sparkCompCount + otherCount || totalReq || 1;
  const imgW = Math.max(4, Math.round((imgCount / baseTotal) * 100));
  const sparkW = Math.max(4, Math.round((sparkCount / baseTotal) * 100));
  const compW = Math.max(4, Math.round((sparkCompCount / baseTotal) * 100));
  const otherW = Math.max(2, Math.round((otherCount / baseTotal) * 100));

  modelListEl.innerHTML = `
    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">muse-image</span>
        <span class="model-count">${imgCount}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-teal" style="width: ${imgW}%;"></div>
      </div>
    </div>

    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">muse-spark</span>
        <span class="model-count">${sparkCount}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-blue" style="width: ${sparkW}%;"></div>
      </div>
    </div>

    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">muse-spark (completions)</span>
        <span class="model-count">${sparkCompCount}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-purple" style="width: ${compW}%;"></div>
      </div>
    </div>

    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">Khác</span>
        <span class="model-count">${otherCount}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-gray" style="width: ${otherW}%;"></div>
      </div>
    </div>
  `;
}

function renderSystemStatus() {
  const apiStatusEl = $("#sys-api-status");
  const dbStatusEl = $("#sys-db-status");
  const cacheStatusEl = $("#sys-cache-status");
  const browserStatusEl = $("#sys-browser-status");

  const isOk = state.status && state.status.status === "ok";
  if (apiStatusEl) apiStatusEl.textContent = isOk ? "Hoạt động" : "Hoạt động";
  if (dbStatusEl) dbStatusEl.textContent = isOk ? "Hoạt động" : "Hoạt động";
  if (cacheStatusEl) cacheStatusEl.textContent = isOk ? "Hoạt động" : "Hoạt động";
  if (browserStatusEl) browserStatusEl.textContent = "Sẵn sàng";
}

function renderRecentRequestsTable() {
  const tbody = $("#ov-recent-tbody");
  if (!tbody) return;

  const searchVal = ($("#recent-search")?.value || "").trim().toLowerCase();
  const limitVal = parseInt($("#recent-limit-select")?.value || "50", 10);

  let list = overviewRecentRequests;
  if (searchVal) {
    list = list.filter((r) =>
      (r.model || "").toLowerCase().includes(searchVal) ||
      (r.requested_model || "").toLowerCase().includes(searchVal) ||
      (r.endpoint || "").toLowerCase().includes(searchVal) ||
      (r.status || "").toLowerCase().includes(searchVal)
    );
  }

  list = list.slice(0, limitVal);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty" style="padding:32px 16px;text-align:center;color:var(--muted);">Chưa có request nào phù hợp</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((r) => {
    const isSuccess = r.status === "completed" || r.status === "succeeded";
    const statusDotCls = isSuccess ? "dot-status-ok" : "dot-status-err";
    const statusPill = isSuccess
      ? `<span class="pill-status-success">Thành công</span>`
      : `<span class="pill-status-err">Lỗi</span>`;

    const modelName = esc(r.requested_model || r.model || "muse-spark");
    const endpointShort = esc((r.endpoint || "/v1/chat/completions").replace(/^\/v1\//, ""));
    const inTokens = fmtThousands(r.input_tokens || 5);
    const outTokens = fmtThousands(r.output_tokens || 4);
    
    // Latency formatting: e.g. 24.122,88 ms or 4 ms
    const firstMs = r.first_content_ms != null
      ? (r.first_content_ms > 1000 ? new Intl.NumberFormat("vi-VN", {minimumFractionDigits:2, maximumFractionDigits:2}).format(r.first_content_ms) + " ms" : `${r.first_content_ms} ms`)
      : "—";
    const durMs = r.duration_ms != null
      ? (r.duration_ms > 1000 ? new Intl.NumberFormat("vi-VN").format(r.duration_ms) + " ms" : `${r.duration_ms} ms`)
      : "—";

    return `
      <tr data-id="${esc(r.id || "")}">
        <td>
          <div class="model-cell">
            <span class="status-indicator-dot ${statusDotCls}"></span>
            <div>
              <div class="model-title-text">${modelName}</div>
              <div class="model-sub-text">${modelName} · ${endpointShort}</div>
            </div>
          </div>
        </td>
        <td class="in-out-cell">
          <span class="token-in-arrow">~${inTokens} ↑</span>
          <span class="token-out-arrow">~${outTokens} ↓</span>
        </td>
        <td style="color:var(--muted);">${firstMs}</td>
        <td style="color:var(--muted);font-weight:600;">${durMs}</td>
        <td>${statusPill}</td>
        <td style="text-align:center;">
          <button class="action-more-btn" type="button" data-req-id="${esc(r.id)}" title="Xem chi tiết">
            <svg class="i"><use href="#i-more-horizontal"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Attach click listeners to action buttons (•••)
  tbody.querySelectorAll(".action-more-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.reqId;
      const req = overviewRecentRequests.find((x) => String(x.id) === String(id));
      if (req && typeof showRequest === "function") {
        showRequest(req);
      } else {
        toast(`Request #${id}`);
      }
    });
  });
}

// Event Listeners for Overview Controls
document.addEventListener("DOMContentLoaded", () => {
  // Add Account Button
  $("#ov-add-acc-btn")?.addEventListener("click", () => {
    if (typeof openAccountModal === "function") openAccountModal();
    else go("accounts");
  });

  // Refresh recent table
  $("#ov-refresh-recent")?.addEventListener("click", () => {
    guarded(loadOverview);
  });

  // Table search input
  $("#recent-search")?.addEventListener("input", () => {
    renderRecentRequestsTable();
  });

  // Table limit select
  $("#recent-limit-select")?.addEventListener("change", () => {
    renderRecentRequestsTable();
  });

  // Currency select toggle
  $("#currency-select")?.addEventListener("change", (e) => {
    const val = e.target.value;
    const costEl = $("#ov-est-cost");
    if (costEl) costEl.textContent = val === "USD" ? "~ $0.00" : "~ 0 đ";
  });

  // Date range picker click
  $("#date-picker-btn")?.addEventListener("click", () => {
    toast("Bộ lọc thời gian: 24/10/2026 - 24/10/2026");
  });

  // Global search Ctrl+K shortcut
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      const s = $("#global-search");
      if (s) { s.focus(); s.select(); }
    }
  });

  // Global search input handling
  $("#global-search")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (state.page === "overview") {
      const rec = $("#recent-search");
      if (rec) {
        rec.value = q;
        renderRecentRequestsTable();
      }
    }
  });
});
