"use strict";
// ---- login ----
function showLogin(message) {
  $("#app").hidden = true;
  $("#login").hidden = false;
  const errBox = $("#login-err");
  if (message) {
    errBox.hidden = false;
    errBox.innerHTML = `<svg class="i" style="width:16px;height:16px;flex:none;"><use href="#i-shield"/></svg> <span>${esc(message)}</span>`;
  } else {
    errBox.hidden = true;
    errBox.textContent = "";
  }
  $("#login-key").value = "";
  $("#login-key").focus();

  // Check environment: only display local default key card in local/dev
  const isLocalDev = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(window.location.hostname) ||
                     window.location.hostname.endsWith(".local") ||
                     window.location.port === "18610" ||
                     window.location.hostname.includes("trycloudflare.com");
  const localBox = $("#local-default-key-card");
  if (localBox) {
    localBox.hidden = !isLocalDev;
  }
}

// Toggle show/hide password on the main input
const toggleEyeBtn = $("#toggle-password");
if (toggleEyeBtn) {
  toggleEyeBtn.addEventListener("click", () => {
    const input = $("#login-key");
    const useEl = $("#eye-icon use");
    if (input.type === "password") {
      input.type = "text";
      useEl.setAttribute("href", "#i-eye-off");
      toggleEyeBtn.title = "Ẩn mật khẩu";
      toggleEyeBtn.setAttribute("aria-label", "Ẩn mật khẩu");
    } else {
      input.type = "password";
      useEl.setAttribute("href", "#i-eye");
      toggleEyeBtn.title = "Hiện mật khẩu";
      toggleEyeBtn.setAttribute("aria-label", "Hiện mật khẩu");
    }
  });
}

// Toggle default key masked vs revealed in local card
let defaultKeyRevealed = false;
const btnToggleDefKey = $("#btn-toggle-default-key");
if (btnToggleDefKey) {
  btnToggleDefKey.addEventListener("click", () => {
    defaultKeyRevealed = !defaultKeyRevealed;
    const valEl = $("#default-key-val");
    const textEl = $("#default-key-toggle-text");
    const eyeIconUse = $("#default-key-eye-icon use");
    const secret = valEl.dataset.key || "muse123456";

    if (defaultKeyRevealed) {
      valEl.textContent = secret;
      valEl.className = "key-revealed";
      textEl.textContent = "Ẩn mã";
      eyeIconUse.setAttribute("href", "#i-eye-off");
    } else {
      valEl.textContent = "••••";
      valEl.className = "key-masked";
      textEl.textContent = "Hiện mã";
      eyeIconUse.setAttribute("href", "#i-eye");
    }
  });
}

// Copy and auto-fill default key
const btnCopyDefKey = $("#btn-copy-default-key");
if (btnCopyDefKey) {
  btnCopyDefKey.addEventListener("click", async () => {
    const secret = $("#default-key-val").dataset.key || "muse123456";
    const input = $("#login-key");
    input.value = secret;
    input.focus();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(secret);
      }
    } catch {}
    toast("Đã sao chép và tự động điền mã quản trị!");
  });
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = $("#login-key").value.trim();
  if (!key) return;
  const btn = $("#login-btn");
  const btnText = $("#login-btn-text");
  const btnIcon = $("#login-btn-icon");
  const errBox = $("#login-err");

  errBox.hidden = true;
  btn.disabled = true;
  btnText.textContent = "Đang xác thực…";
  btnIcon.classList.add("spin");
  btnIcon.querySelector("use").setAttribute("href", "#i-spinner");

  setKey(key);
  try {
    await api("/admin/status");
    start();
  } catch (err) {
    setKey("");
    showLogin(err instanceof AuthError ? "Khóa Admin key không chính xác. Vui lòng thử lại." : err.message);
  } finally {
    btn.disabled = false;
    btnText.textContent = "Đăng nhập";
    btnIcon.classList.remove("spin");
    btnIcon.querySelector("use").setAttribute("href", "#i-arrow-right");
  }
});
