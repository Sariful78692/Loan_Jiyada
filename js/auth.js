const USER_KEY = "loanManagerUser";
const SESSION_KEY = "loanManagerSession";

function account() {
  const saved = localStorage.getItem(USER_KEY);
  if (saved) return JSON.parse(saved);
  const defaultAccount = { username: "admin", password: "admin123", recoveryEmail: "admin@loanmanager.local" };
  localStorage.setItem(USER_KEY, JSON.stringify(defaultAccount));
  return defaultAccount;
}
function saveAccount(data) { localStorage.setItem(USER_KEY, JSON.stringify(data)); }
function showMessage(id, message, success = false) { const el = document.getElementById(id); if (el) { el.textContent = message; el.classList.toggle("success", success); } }

document.addEventListener("DOMContentLoaded", () => {
  account();
  document.querySelectorAll("[data-password-toggle]").forEach(button => button.addEventListener("click", () => { const input = document.getElementById(button.dataset.passwordToggle); input.type = input.type === "password" ? "text" : "password"; button.querySelector("i").className = input.type === "password" ? "fa-regular fa-eye" : "fa-regular fa-eye-slash"; }));
  document.querySelectorAll("[data-modal]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.modal).classList.add("visible")));
  document.querySelectorAll(".close-modal").forEach(button => button.addEventListener("click", () => button.closest(".modal").classList.remove("visible")));
  document.querySelectorAll(".modal").forEach(modal => modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("visible"); }));

  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", e => { e.preventDefault(); const user = account(); if (document.getElementById("login-username").value.trim() === user.username && document.getElementById("login-password").value === user.password) { sessionStorage.setItem(SESSION_KEY, "active"); window.location.replace("Dashboard.html"); } else showMessage("login-message", "Incorrect username or password."); });
  const usernameRecovery = document.getElementById("username-recovery-form");
  if (usernameRecovery) usernameRecovery.addEventListener("submit", e => { e.preventDefault(); const user = account(); const email = document.getElementById("username-email").value.trim().toLowerCase(); showMessage("username-recovery-message", email === user.recoveryEmail.toLowerCase() ? `Your username is: ${user.username}` : "That recovery email does not match our records.", email === user.recoveryEmail.toLowerCase()); });
  const passwordRecovery = document.getElementById("password-recovery-form");
  if (passwordRecovery) passwordRecovery.addEventListener("submit", e => { e.preventDefault(); const user = account(); const username = document.getElementById("reset-username").value.trim(); const email = document.getElementById("reset-email").value.trim().toLowerCase(); const password = document.getElementById("reset-password").value; if (username !== user.username || email !== user.recoveryEmail.toLowerCase()) return showMessage("password-recovery-message", "Username or recovery email is incorrect."); user.password = password; saveAccount(user); showMessage("password-recovery-message", "Password reset successfully. You can now sign in.", true); passwordRecovery.reset(); });

  const currentName = document.getElementById("current-username"); if (currentName) currentName.textContent = account().username;
  const changeUsername = document.getElementById("change-username-form");
  if (changeUsername) changeUsername.addEventListener("submit", e => { e.preventDefault(); const user = account(); const next = document.getElementById("new-username").value.trim(); if (document.getElementById("username-current-password").value !== user.password) return showMessage("username-change-message", "Current password is incorrect."); user.username = next; saveAccount(user); currentName.textContent = next; showMessage("username-change-message", "Username updated successfully.", true); changeUsername.reset(); });
  const changePassword = document.getElementById("change-password-form");
  if (changePassword) changePassword.addEventListener("submit", e => { e.preventDefault(); const user = account(); const oldPassword = document.getElementById("current-password").value; const next = document.getElementById("new-password").value; if (oldPassword !== user.password) return showMessage("password-change-message", "Current password is incorrect."); if (next !== document.getElementById("confirm-password").value) return showMessage("password-change-message", "New passwords do not match."); user.password = next; saveAccount(user); showMessage("password-change-message", "Password updated successfully.", true); changePassword.reset(); });
});
