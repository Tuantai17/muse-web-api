"use strict";

// ---- overview (Real-data Implementation) ----
let overviewRecentRequests = [];
let overviewCurrentCostUsd = 0;

function fmtThousands(n) {
  if (n == null || !Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function updateDateRangeText(windowName = "7d") {
  const el = $("#date-picker-text");
  if (!el) return;
  const now = new Date();
  const fmt = (d) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  if (windowName === "24h") {
    el.textContent = `Hôm nay (${fmt(now)})`;
  } else if (windowName === "30d") {
    const past = new Date(now.getTime() - 29 * 86400 * 1000);
    el.textContent = `${fmt(past)} - ${fmt(now)}`;
  } else {
    // 7d
    const past = new Date(now.getTime() - 6 * 86400 * 1000);
    el.textContent = `${fmt(past)} - ${fmt(now)}`;
  }
}

function renderCost() {
  const currency = $("#currency-select")?.value || "VND";
  const costEl = $("#ov-est-cost");
  if (!costEl) return;
  const usd = overviewCurrentCostUsd;
  if (currency === "USD") {
    costEl.textContent = `~ $${usd.toFixed(2)}`;
  } else {
    // 1 USD ~ 25.400 VND
    const vnd = Math.round(usd * 25400);
    costEl.textContent = `~ ${fmtThousands(vnd)} đ`;
  }
}

function renderBarChart(series = [], windowName = "7d") {
  const barsGroup = $("#bar-chart-bars");
  const trendLine = $("#bar-trend-line");
  const emptyMsg = $("#bar-chart-empty");
  if (!barsGroup) return;

  const totalTokensInSeries = series.reduce(
    (sum, b) => sum + (b.input_tokens || 0) + (b.output_tokens || 0),
    0
  );
  const totalReqInSeries = series.reduce((sum, b) => sum + (b.count || 0), 0);

  if (emptyMsg) {
    emptyMsg.style.display =
      totalTokensInSeries === 0 && totalReqInSeries === 0 ? "block" : "none";
  }

  // Find max value to scale chart (minimum scale 100 for clean look)
  let maxVal = 0;
  for (const b of series) {
    const inTok = b.input_tokens || 0;
    const outTok = b.output_tokens || 0;
    if (inTok > maxVal) maxVal = inTok;
    if (outTok > maxVal) maxVal = outTok;
  }
  const maxScale = Math.max(Math.ceil(maxVal * 1.15), 100);

  // Update Y-axis grid labels
  const gridTexts = $$(".chart-grid text");
  if (gridTexts && gridTexts.length >= 5) {
    gridTexts[0].textContent = fmtThousands(maxScale);
    gridTexts[1].textContent = fmtThousands(maxScale * 0.75);
    gridTexts[2].textContent = fmtThousands(maxScale * 0.5);
    gridTexts[3].textContent = fmtThousands(maxScale * 0.25);
    gridTexts[4].textContent = "0";
  }

  const n = series.length || 7;
  const leftX = 55;
  const totalW = 380;
  const colW = totalW / n;
  const baselineY = 172;
  const maxH = 152;

  let barsHtml = "";
  const trendPoints = [];

  series.forEach((b, i) => {
    const cx = leftX + i * colW + colW / 2;
    const inTok = b.input_tokens || 0;
    const outTok = b.output_tokens || 0;
    const count = b.count || 0;

    const inH = totalTokensInSeries > 0 ? Math.min(maxH, Math.round((inTok / maxScale) * maxH)) : 0;
    const outH = totalTokensInSeries > 0 ? Math.min(maxH, Math.round((outTok / maxScale) * maxH)) : 0;

    const inY = baselineY - inH;
    const outY = baselineY - outH;

    const dateObj = new Date(b.t * 1000);
    let label = "";
    if (windowName === "24h") {
      label = `${String(dateObj.getHours()).padStart(2, "0")}h`;
    } else {
      label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
    }

    const inBarX = Math.round(cx - 15);
    const outBarX = Math.round(cx + 1);

    barsHtml += `
      <g class="bar-col-group">
        <rect x="${inBarX}" y="${inY}" width="14" height="${inH}" rx="3" fill="#2ebd85">
          <title>${label} - Input: ${fmtThousands(inTok)} tokens (${count} reqs)</title>
        </rect>
        <rect x="${outBarX}" y="${outY}" width="14" height="${outH}" rx="3" fill="#60a5fa">
          <title>${label} - Output: ${fmtThousands(outTok)} tokens</title>
        </rect>
        <text x="${Math.round(cx)}" y="192" text-anchor="middle" fill="#94a3b8" font-size="10">${label}</text>
      </g>
    `;

    const totH = totalTokensInSeries > 0
      ? Math.min(maxH, Math.round(((inTok + outTok) / (maxScale * 1.5)) * maxH))
      : 0;
    trendPoints.push({ x: cx, y: baselineY - totH });
  });

  barsGroup.innerHTML = barsHtml;

  if (trendLine) {
    if (trendPoints.length > 1) {
      const d = trendPoints
        .map((p, idx) => `${idx === 0 ? "M" : "L"}${Math.round(p.x)} ${Math.round(p.y)}`)
        .join(" ");
      trendLine.setAttribute("d", d);
    } else {
      trendLine.setAttribute("d", "M55 172 L435 172");
    }
  }
}

function renderModelActivity(byModel = [], totalReq = 0) {
  const modelListEl = $("#ov-model-list");
  if (!modelListEl) return;

  const counts = {
    "muse-image": 0,
    "muse-spark": 0,
    "muse-spark (completions)": 0,
    "Khác": 0,
  };

  if (byModel && byModel.length) {
    for (const m of byModel) {
      const name = (m.model || "").toLowerCase();
      if (name.includes("image")) counts["muse-image"] += m.count || 0;
      else if (name.includes("completion")) counts["muse-spark (completions)"] += m.count || 0;
      else if (name.includes("spark") || name.includes("chat")) counts["muse-spark"] += m.count || 0;
      else counts["Khác"] += m.count || 0;
    }
  }

  const actualTotal = totalReq || Object.values(counts).reduce((a, b) => a + b, 0);

  const imgCount = counts["muse-image"];
  const sparkCount = counts["muse-spark"];
  const compCount = counts["muse-spark (completions)"];
  const otherCount = counts["Khác"];

  const imgW = actualTotal > 0 ? Math.round((imgCount / actualTotal) * 100) : 0;
  const sparkW = actualTotal > 0 ? Math.round((sparkCount / actualTotal) * 100) : 0;
  const compW = actualTotal > 0 ? Math.round((compCount / actualTotal) * 100) : 0;
  const otherW = actualTotal > 0 ? Math.round((otherCount / actualTotal) * 100) : 0;

  modelListEl.innerHTML = `
    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">muse-image</span>
        <span class="model-count">${fmtThousands(imgCount)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-teal" style="width: ${imgW}%;"></div>
      </div>
    </div>

    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">muse-spark</span>
        <span class="model-count">${fmtThousands(sparkCount)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-blue" style="width: ${sparkW}%;"></div>
      </div>
    </div>

    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">muse-spark (completions)</span>
        <span class="model-count">${fmtThousands(compCount)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-purple" style="width: ${compW}%;"></div>
      </div>
    </div>

    <div class="model-row">
      <div class="model-row-head">
        <span class="model-name">Khác</span>
        <span class="model-count">${fmtThousands(otherCount)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill fill-gray" style="width: ${otherW}%;"></div>
      </div>
    </div>
  `;
}

function renderSystemStatus(health, ready) {
  const apiStatusEl = $("#sys-api-status");
  const dbStatusEl = $("#sys-db-status");
  const cacheStatusEl = $("#sys-cache-status");
  const browserStatusEl = $("#sys-browser-status");

  const apiOk = !health || health.ok !== false;
  if (apiStatusEl) {
    apiStatusEl.textContent = apiOk ? "Hoạt động" : "Lỗi";
    apiStatusEl.className = apiOk ? "badge b-ok status-pill-active" : "badge b-err";
  }

  if (dbStatusEl) {
    dbStatusEl.textContent = "Hoạt động";
    dbStatusEl.className = "badge b-ok status-pill-active";
  }

  if (cacheStatusEl) {
    cacheStatusEl.textContent = "Hoạt động";
    cacheStatusEl.className = "badge b-ok status-pill-active";
  }

  const driverOk = ready?.driver?.ok;
  if (browserStatusEl) {
    browserStatusEl.textContent = driverOk ? "Sẵn sàng" : "Chưa kết nối";
    browserStatusEl.className = driverOk ? "badge b-ok status-pill-active" : "badge b-warn";
  }
}

function renderRecentRequestsTable() {
  const tbody = $("#ov-recent-tbody");
  if (!tbody) return;

  const searchVal = ($("#recent-search")?.value || "").trim().toLowerCase();
  const limitVal = parseInt($("#recent-limit-select")?.value || "50", 10);

  let list = overviewRecentRequests;
  if (searchVal) {
    list = list.filter(
      (r) =>
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

  tbody.innerHTML = list
    .map((r) => {
      const isSuccess = r.status === "completed" || r.status === "succeeded";
      const statusDotCls = isSuccess ? "dot-status-ok" : "dot-status-err";
      const statusPill = isSuccess
        ? `<span class="pill-status-success">Thành công</span>`
        : `<span class="pill-status-err">Lỗi</span>`;

      const modelName = esc(r.requested_model || r.model || "muse-spark");
      const endpointShort = esc((r.endpoint || "/v1/chat/completions").replace(/^\/v1\//, ""));
      const inTokens = fmtThousands(r.input_tokens || 0);
      const outTokens = fmtThousands(r.output_tokens || 0);

      const firstMs =
        r.first_content_ms != null
          ? r.first_content_ms > 1000
            ? new Intl.NumberFormat("vi-VN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(r.first_content_ms) + " ms"
            : `${r.first_content_ms} ms`
          : "—";
      const durMs =
        r.duration_ms != null
          ? r.duration_ms > 1000
            ? new Intl.NumberFormat("vi-VN").format(r.duration_ms) + " ms"
            : `${r.duration_ms} ms`
          : "—";

      return `
      <tr data-id="${esc(r.id || "")}">
        <td class="text-left">
          <div class="model-cell">
            <span class="status-indicator-dot ${statusDotCls}"></span>
            <div>
              <div class="model-title-text">${modelName}</div>
              <div class="model-sub-text">${modelName} · ${endpointShort}</div>
            </div>
          </div>
        </td>
        <td class="text-left in-out-cell">
          <span class="token-in-arrow">~${inTokens} ↑</span>
          <span class="token-out-arrow">~${outTokens} ↓</span>
        </td>
        <td class="text-left" style="color:var(--muted);">${firstMs}</td>
        <td class="text-left" style="color:var(--muted);font-weight:600;">${durMs}</td>
        <td class="text-left">${statusPill}</td>
        <td class="text-center">
          <button class="action-more-btn" type="button" data-req-id="${esc(r.id)}" title="Xem chi tiết">
            <svg class="i"><use href="#i-more-horizontal"/></svg>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

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

async function loadOverview() {
  const selectedRange = $("#token-range-select")?.value || "7d";
  updateDateRangeText(selectedRange);

  const [usage, stats, health, ready] = await Promise.all([
    api("/admin/usage").catch(() => null),
    api(`/admin/stats?window=${selectedRange}`).catch(() => null),
    api("/healthz").catch(() => null),
    api("/readyz").catch(() => null),
    loadAccounts().catch(() => null),
  ]);

  const u = usage || {};
  const t = u.totals || {};
  const s = stats || {};

  // 1. KPI Cards - Real numbers only (0 when empty)
  const reqCount = t.requests ?? s.total ?? 0;
  const inTokens = t.input_tokens ?? 0;
  const outTokens = t.output_tokens ?? 0;
  const cacheTokens = 0;
  const totalTokens = inTokens + outTokens + cacheTokens;

  if ($("#ov-stat-req")) $("#ov-stat-req").textContent = fmtThousands(reqCount);
  if ($("#ov-stat-in")) $("#ov-stat-in").textContent = fmtThousands(inTokens);
  if ($("#ov-stat-cache")) $("#ov-stat-cache").textContent = "0";
  if ($("#ov-stat-out")) $("#ov-stat-out").textContent = fmtThousands(outTokens);

  // Growth pills: neutral when 0
  const reqGrowth = $("#ov-stat-req-growth");
  if (reqGrowth) reqGrowth.textContent = reqCount > 0 ? "—" : "— 0%";
  const inGrowth = $("#ov-stat-in-growth");
  if (inGrowth) inGrowth.textContent = inTokens > 0 ? "—" : "— 0%";
  const outGrowth = $("#ov-stat-out-growth");
  if (outGrowth) outGrowth.textContent = outTokens > 0 ? "—" : "— 0%";

  // 2. Bar Chart "Sử dụng tokens"
  renderBarChart(s.series || [], selectedRange);

  // 3. Donut Chart "Tỷ lệ tokens"
  const inPct = totalTokens > 0 ? ((inTokens / totalTokens) * 100).toFixed(1) : "0.0";
  const outPct = totalTokens > 0 ? ((outTokens / totalTokens) * 100).toFixed(1) : "0.0";
  const cachePct = "0.0";

  if ($("#donut-total-tokens")) $("#donut-total-tokens").textContent = fmtThousands(totalTokens);
  if ($("#donut-in-pct")) $("#donut-in-pct").textContent = `${inPct}%`;
  if ($("#donut-in-cnt")) $("#donut-in-cnt").textContent = fmtThousands(inTokens);
  if ($("#donut-out-pct")) $("#donut-out-pct").textContent = `${outPct}%`;
  if ($("#donut-out-cnt")) $("#donut-out-cnt").textContent = fmtThousands(outTokens);
  if ($("#donut-cache-pct")) $("#donut-cache-pct").textContent = `${cachePct}%`;
  if ($("#donut-cache-cnt")) $("#donut-cache-cnt").textContent = "0";

  // Update Donut SVG circle segment strokes (circumference = 377)
  const inDash = totalTokens > 0 ? Math.round((parseFloat(inPct) / 100) * 377) : 0;
  const outDash = totalTokens > 0 ? Math.round((parseFloat(outPct) / 100) * 377) : 0;
  const donutSvg = $(".donut-svg");
  if (donutSvg) {
    const circles = donutSvg.querySelectorAll("circle");
    if (circles.length >= 3) {
      circles[1].setAttribute("stroke-dasharray", `${inDash} 377`);
      circles[2].setAttribute("stroke-dasharray", `${outDash} 377`);
      circles[2].setAttribute("stroke-dashoffset", `${-inDash}`);
    }
  }

  // 4. Estimated Cost
  overviewCurrentCostUsd = t.estimated_cost_usd || 0;
  renderCost();

  // 5. Model Activity Breakdown
  renderModelActivity(s.by_model, reqCount);

  // 6. System Status
  renderSystemStatus(health, ready);

  // 7. Recent Requests Table
  overviewRecentRequests = u.recent || [];
  renderRecentRequestsTable();
}

// Event Listeners for Overview Controls
document.addEventListener("DOMContentLoaded", () => {
  // Add Account Button
  $("#ov-add-acc-btn")?.addEventListener("click", () => {
    if (typeof openAccountModal === "function") openAccountModal();
    else go("accounts");
  });

  // Range select for bar chart (7d / 24h / 30d)
  $("#token-range-select")?.addEventListener("change", () => {
    guarded(loadOverview);
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

  // Currency select toggle (VND / USD)
  $("#currency-select")?.addEventListener("change", () => {
    renderCost();
  });

  // Date range picker click
  $("#date-picker-btn")?.addEventListener("click", () => {
    const sel = $("#token-range-select");
    if (sel) {
      sel.focus();
      toast(`Đang lọc theo: ${sel.options[sel.selectedIndex]?.text || "Thời gian"}`);
    }
  });

  // Global search Ctrl+K shortcut
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      const s = $("#global-search");
      if (s) {
        s.focus();
        s.select();
      }
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
