const SHEET_USER_KEY = "loanManagerUser";
const SHEET_SESSION_KEY = "loanManagerSession";

function account() { return JSON.parse(localStorage.getItem(SHEET_USER_KEY) || "null"); }
function saveAccount(user) { localStorage.setItem(SHEET_USER_KEY, JSON.stringify(user)); }
function showMessage(id, message, success) { const element = document.getElementById(id); if (!element) return; element.textContent = message; element.classList.toggle("success", Boolean(success)); }
async function authRequest(payload) {
  const response = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
  const result = await response.json();
  if (!result || result.status !== "success") throw new Error((result && result.message) || "Request failed. Please try again.");
  return result;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-password-toggle]").forEach(button => button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    input.type = input.type === "password" ? "text" : "password";
    button.querySelector("i").className = input.type === "password" ? "fa-regular fa-eye" : "fa-regular fa-eye-slash";
  }));
  document.querySelectorAll("[data-modal]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.modal).classList.add("visible")));
  document.querySelectorAll(".close-modal").forEach(button => button.addEventListener("click", () => button.closest(".modal").classList.remove("visible")));
  document.querySelectorAll(".modal").forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) modal.classList.remove("visible"); }));

  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", async event => {
    event.preventDefault(); showMessage("login-message", "Signing in…", true);
    try {
      const result = await authRequest({ action: "login", username: document.getElementById("login-username").value.trim(), password: document.getElementById("login-password").value });
      saveAccount({ username: result.username, recoveryEmail: result.recoveryEmail || "" });
      sessionStorage.setItem(SHEET_SESSION_KEY, "active"); window.location.replace("Dashboard.html");
    } catch (error) { showMessage("login-message", error.message); }
  });

  const usernameRecovery = document.getElementById("username-recovery-form");
  if (usernameRecovery) usernameRecovery.addEventListener("submit", async event => {
    event.preventDefault(); showMessage("username-recovery-message", "Sending…", true);
    try { await authRequest({ action: "forgot_username", recoveryEmail: document.getElementById("username-email").value.trim() }); showMessage("username-recovery-message", "If the email exists, your username has been sent.", true); }
    catch (error) { showMessage("username-recovery-message", error.message); }
  });

  const sendCode = document.getElementById("send-reset-code");
  if (sendCode) sendCode.addEventListener("click", async () => {
    showMessage("password-recovery-message", "Sending verification code…", true);
    try { await authRequest({ action: "request_password_reset", username: document.getElementById("reset-username").value.trim(), recoveryEmail: document.getElementById("reset-email").value.trim() }); showMessage("password-recovery-message", "A 6-digit code was sent to your email.", true); }
    catch (error) { showMessage("password-recovery-message", error.message); }
  });
  const passwordRecovery = document.getElementById("password-recovery-form");
  if (passwordRecovery) passwordRecovery.addEventListener("submit", async event => {
    event.preventDefault(); showMessage("password-recovery-message", "Resetting password…", true);
    try { await authRequest({ action: "reset_password", username: document.getElementById("reset-username").value.trim(), recoveryEmail: document.getElementById("reset-email").value.trim(), code: document.getElementById("reset-code").value.trim(), newPassword: document.getElementById("reset-password").value }); showMessage("password-recovery-message", "Password reset. You can now sign in.", true); passwordRecovery.reset(); }
    catch (error) { showMessage("password-recovery-message", error.message); }
  });

  const currentName = document.getElementById("current-username"); if (currentName && account()) currentName.textContent = account().username;
  const changeUsername = document.getElementById("change-username-form");
  if (changeUsername) changeUsername.addEventListener("submit", async event => {
    event.preventDefault(); const user = account(); if (!user) return;
    try { const result = await authRequest({ action: "change_username", username: user.username, currentPassword: document.getElementById("username-current-password").value, newUsername: document.getElementById("new-username").value.trim() }); saveAccount({ username: result.username, recoveryEmail: user.recoveryEmail }); currentName.textContent = result.username; showMessage("username-change-message", "Username updated successfully.", true); changeUsername.reset(); }
    catch (error) { showMessage("username-change-message", error.message); }
  });
  const changePassword = document.getElementById("change-password-form");
  if (changePassword) changePassword.addEventListener("submit", async event => {
    event.preventDefault(); const user = account(); if (!user) return;
    const newPassword = document.getElementById("new-password").value;
    if (newPassword !== document.getElementById("confirm-password").value) return showMessage("password-change-message", "New passwords do not match.");
    try { await authRequest({ action: "change_password", username: user.username, currentPassword: document.getElementById("current-password").value, newPassword }); showMessage("password-change-message", "Password updated successfully.", true); changePassword.reset(); }
    catch (error) { showMessage("password-change-message", error.message); }
  });
});
