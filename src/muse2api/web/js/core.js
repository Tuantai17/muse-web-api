"use strict";
const STORE = "muse2api.adminKey";
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const PAGES = {overview: "Tổng quan", accounts: "Accounts", keys: "API Keys", requests: "Requests"};
const state = {
  page: "overview", window: "24h", offset: 0, limit: 50,
  accounts: [], keys: [], builtin: [], capabilities: {}, timer: null, modalOpen: false,
};

// ---- helpers ----
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const store = {
  get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};
const getKey = () => store.get(STORE);
const setKey = (k) => store.set(STORE, k);
const now = () => Date.now() / 1000;
const fmtNum = (n) => n == null ? "–" : Number(n).toLocaleString("en-US");
const fmtMs = (ms) => ms == null ? "–" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
const fmtPct = (r) => `${(r * 100).toFixed(r && r < 0.1 ? 2 : 1)}%`;
const usageNumber = (v) => new Intl.NumberFormat("vi-VN").format(Number(v) || 0);
const icon = (name) => `<svg class="i"><use href="#i-${name}"/></svg>`;
function usageAgo(value) {
  const seconds = Math.max(0, Math.floor(now() - Number(value)));
  return seconds < 60 ? 'Vừa xong' : seconds < 3600 ? Math.floor(seconds / 60) + ' phút trước' : seconds < 86400 ? Math.floor(seconds / 3600) + ' giờ trước' : Math.floor(seconds / 86400) + ' ngày trước';
}
function ago(ts) {
  if (!ts) return "chưa dùng";
  const s = Math.max(0, now() - ts);
  if (s < 10) return "vừa xong";
  if (s < 60) return `${Math.floor(s)} giây trước`;
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}
function countdown(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function clock(ts) {
  const d = new Date(ts * 1000);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], {hour12: false})
    : d.toLocaleString([], {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false});
}
const fullTime = (ts) => ts ? new Date(ts * 1000).toLocaleString() : "–";
function statusBadge(code) {
  const cls = code >= 500 ? "b-err" : code >= 400 ? "b-warn" : "b-ok";
  return `<span class="badge plain ${cls} mono">${esc(code)}</span>`;
}
// Async submits answer 200 at once; the task's own outcome is what the client got.
const TASK_BADGE = { succeeded: ["b-ok", "ok"], failed: ["b-err", "failed"],
                     cancelled: ["b-mute", "cancelled"] };
function taskBadge(r) {
  if (r.poll || !r.task_id) return "";
  const [cls, txt] = TASK_BADGE[r.task_status] || ["b-info", "running"];
  return ` <span class="badge plain ${cls}">${esc(txt)}</span>`;
}
function accountLabel(id) {
  if (!id) return "";
  const a = state.accounts.find((x) => x.id === id);
  return a && a.label ? a.label : id;
}
function keyLabel(id, fallback) {
  if (!id) return fallback || "(không xác thực)";
  const k = state.keys.find((x) => x.id === id);
  return k ? k.name : (fallback || id);
}
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

class AuthError extends Error {}
async function api(path, opts = {}) {
  const headers = {Authorization: `Bearer ${getKey()}`};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {method: opts.method || "GET", headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined});
  if (res.status === 401) throw new AuthError("unauthorized");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || `HTTP ${res.status}`);
  return data;
}
async function guarded(fn) {
  try { return await fn(); }
  catch (e) {
    if (e instanceof AuthError) { setKey(""); stop(); showLogin("Admin key không hợp lệ hoặc đã bị đổi."); }
    else toast(e.message || String(e));
  }
}

// ---- theme ----
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  store.set("muse2api.theme", t === "auto" ? "" : t);
  for (const b of $$(".themes button")) b.setAttribute("aria-pressed", String(b.dataset.theme === (t || "auto")));
}
for (const b of $$(".themes button")) b.addEventListener("click", () => applyTheme(b.dataset.theme));
applyTheme(store.get("muse2api.theme") || "auto");

// ---- modal (in-page; never window.confirm/alert) ----
// Each action: {label, value, cls, primary, collect(), check(value) -> error string}.
function modal({title, body, actions, wide}) {
  const opener = document.activeElement;
  return new Promise((resolve) => {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = body;
    $("#modal").classList.toggle("wide", !!wide);
    const box = $("#modal-actions");
    box.innerHTML = "";
    const cancellable = actions.some((a) => a.value === null && !a.collect);
    const close = (v) => {
      $("#overlay").hidden = true;
      state.modalOpen = false;
      document.removeEventListener("keydown", onKey, true);
      $("#overlay").removeEventListener("mousedown", onBackdrop);
      if (opener && opener.focus && document.contains(opener)) opener.focus();
      resolve(v);
    };
    const fire = (a) => {
      const v = a.collect ? a.collect() : a.value;
      const err = a.check && a.check(v);
      if (err) {
        let el = $("#modal-err");
        if (!el) { el = document.createElement("div"); el.id = "modal-err"; el.className = "ferr"; el.setAttribute("role", "alert"); $("#modal-body").appendChild(el); }
        el.textContent = err;
        return;
      }
      close(v);
    };
    const onKey = (e) => {
      if (e.key === "Escape" && cancellable) { e.preventDefault(); close(null); }
      else if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
        const primary = actions.find((a) => a.primary);
        if (primary) { e.preventDefault(); fire(primary); }
      } else if (e.key === "Tab") {
        // Keep focus inside the dialog.
        const f = $$("#modal input:not([type=hidden]), #modal button, #modal textarea, #modal select").filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const onBackdrop = (e) => { if (e.target === $("#overlay") && cancellable) close(null); };
    for (const a of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${a.cls || ""}`;
      b.textContent = a.label;
      b.addEventListener("click", () => fire(a));
      box.appendChild(b);
    }
    document.addEventListener("keydown", onKey, true);
    $("#overlay").addEventListener("mousedown", onBackdrop);
    $("#overlay").hidden = false;
    state.modalOpen = true;
    const focus = $("#modal-body input:not([readonly])") || box.lastElementChild;
    if (focus) focus.focus();
  });
}
const confirmBox = (title, html, label = "Xác nhận", danger = true) => modal({
  title, body: html,
  actions: [{label: "Huỷ", value: null}, {label, value: true, primary: true, cls: danger ? "danger solid" : "primary"}],
});


// ---- shared status / health ----
function updateHealth(st, failed) {
  let cls = "ok", text = "Hoạt động", sub = "";
  if (failed) { cls = "err"; text = "Mất kết nối"; sub = "Không gọi được /admin/status"; }
  else {
    const pool = st.accounts || {}, drv = st.driver || {};
    sub = `${fmtNum(pool.available)}/${fmtNum(pool.total)} accounts sẵn sàng`;
    if (drv.ok === false) { cls = "err"; text = "Driver lỗi"; sub = `driver ${drv.driver || ""}`; }
    else if (!pool.total) { cls = "warn"; text = "Chưa có account"; }
    else if (!pool.available) { cls = "warn"; text = "Không account nào sẵn sàng"; }
    else if (pool.available < pool.total) { text = "Hoạt động"; }
  }
  for (const d of [$("#health-dot"), $("#top-dot")]) {
    if (d) d.className = `pulse ${cls}`;
  }
  if ($("#health-text")) $("#health-text").textContent = text;
  if ($("#health-sub")) $("#health-sub").textContent = sub;
  if ($("#top-dot")) $("#top-dot").title = `${text} · ${sub}`;
}

async function loadAccounts() {
  let st, acc;
  try { [st, acc] = await Promise.all([api("/admin/status"), api("/admin/accounts")]); }
  catch (e) { if (!(e instanceof AuthError)) updateHealth(null, true); throw e; }
  state.capabilities = st.capabilities || {};
  state.accounts = acc.data || [];
  state.pool = st.accounts || {};
  $("#version").textContent = `v${st.version} · ${(st.driver && st.driver.driver) || ""}`;
  updateHealth(st);
  const t = now();
  const ready = state.accounts.filter((a) => accState(a, t).cls === "ok").length, total = state.accounts.length;
  const nav = $("#nav-accounts");
  nav.textContent = total ? (ready < total ? `${ready}/${total}` : total) : "";
  nav.classList.toggle("warn", ready < total);
  nav.title = ready < total ? `${ready}/${total} account đang hoạt động` : "";
  return st;
}
