"use strict";
// ---- routing: #page or #requests?key=..&account=.. ----
const loaders = {overview: loadOverview, accounts: loadAccountsPage, keys: loadKeys, requests: loadRequests};
function parseHash() {
  const [page, query] = location.hash.replace(/^#/, "").split("?");
  return {page: loaders[page] ? page : "", params: new URLSearchParams(query || "")};
}
function go(page, params) {
  const q = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString() : "";
  const hash = `#${page}${q ? `?${q}` : ""}`;
  if (location.hash === hash) route(); else location.hash = hash;
}
function syncHash() {
  if (state.page !== "requests") return;
  const p = new URLSearchParams();
  if ($("#f-key").value) p.set("key", $("#f-key").value);
  if ($("#f-account").value) p.set("account", $("#f-account").value);
  const hash = `#requests${p.toString() ? `?${p}` : ""}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}
function route() {
  let {page, params} = parseHash();
  if (!page) page = store.get("muse2api.page") || "overview";
  if (!loaders[page]) page = "overview";
  state.page = page;
  if (page === "requests" && (params.has("key") || params.has("account"))) {
    state.pendingKey = params.get("key") || "";
    state.pendingAccount = params.get("account") || "";
    $("#f-key").value = ""; $("#f-account").value = "";
    state.offset = 0;
    fillFilterOptions();
  }
  for (const a of $$(".side nav a")) {
    if (a.dataset.page === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  for (const p of Object.keys(loaders)) $(`#page-${p}`).hidden = p !== page;
  $("#top-title").textContent = PAGES[page];
  document.title = `${PAGES[page]} · muse-web-api`;
  store.set("muse2api.page", page);
  setDrawer(false);
  guarded(loaders[page]);
}
window.addEventListener("hashchange", route);

// ---- drawer (narrow screens) ----
function setDrawer(open) {
  $("#app").classList.toggle("drawer", open);
  $("#burger").setAttribute("aria-expanded", String(open));
  if (open) $(".side nav a[aria-current]")?.focus();
}
$("#burger").addEventListener("click", () => setDrawer(!$("#app").classList.contains("drawer")));
$("#scrim").addEventListener("click", () => setDrawer(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !state.modalOpen && $("#app").classList.contains("drawer")) { setDrawer(false); $("#burger").focus(); }
});
$("#signout").addEventListener("click", () => { setKey(""); stop(); showLogin(); });

// ---- live countdowns, every second ----
let refetchAt = 0;
setInterval(() => {
  if (document.hidden || $("#app").hidden) return;
  const t = now();
  let expired = false;
  for (const el of $$("[data-until]")) {
    const left = Number(el.dataset.until) - t;
    el.textContent = countdown(left);
    if (left <= 0) expired = true;
  }
  for (const el of $$("[data-ago]")) {
    const ts = Number(el.dataset.ago);
    el.textContent = ago(ts);
  }
  // A cooldown just ran out: refresh so the account shows as active again.
  if (expired && t > refetchAt && !state.modalOpen) {
    refetchAt = t + 10;
    if (state.page === "accounts") guarded(loadAccountsPage);
    else if (state.page === "overview") guarded(loadOverview);
  }
}, 1000);

// ---- refresh loop ----
function tick(n) {
  if (document.hidden || state.modalOpen) return;
  const p = state.page;
  if (p === "requests" && $("#f-live").checked) guarded(loadRequests);
  else if (p === "accounts" && n % 2 === 0) guarded(loadAccountsPage);
  else if ((p === "overview" || p === "keys") && n % 6 === 0) guarded(loaders[p]);
  // Keep the sidebar health indicator fresh on pages that do not fetch status.
  if ((p === "requests" || p === "keys") && n % 3 === 0) guarded(loadAccounts);
}
function stop() { clearInterval(state.timer); state.timer = null; }
async function start() {
  stop();
  $("#login").hidden = true;
  $("#app").hidden = false;
  // Labels for filters and names come from these two lists.
  await guarded(async () => { await loadAccounts(); await fetchKeys(); });
  if (!getKey()) return;
  route();
  let n = 0;
  state.timer = setInterval(() => tick(++n), 5000);
}

if (getKey()) start(); else showLogin();
