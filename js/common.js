// ---------------- Common Setup (সব পেজে চলবে) ---------------- //

// আপনার Google Apps Script এর আসল /exec URL — echo/temporary URL কখনো এখানে বসাবেন না
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyv9od9s33HcxlS3PzqK7BlS6jkomb7dPsjW-6SWyUgcLJEb1cbrF5VQ8ORZm8ETWD1Iw/exec";
const APPS_SCRIPT_READ_URLS = [
  APPS_SCRIPT_URL,
  "https://script.google.com/macros/s/AKfycbxIzWRQjVyjFNNkugEpHj5pgNJxIGe20QkDJXyomx8pr_6o-GzxbAkxOrpyIkuYsTs6_g/exec"
];

async function fetchAppData() {
  let lastError = null;
  for (let urlIndex = 0; urlIndex < APPS_SCRIPT_READ_URLS.length; urlIndex++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const separator = APPS_SCRIPT_READ_URLS[urlIndex].includes("?") ? "&" : "?";
        const response = await fetch(`${APPS_SCRIPT_READ_URLS[urlIndex]}${separator}t=${Date.now()}-${attempt}`, { cache: "no-store" });
        const body = await response.text();
        if (!response.ok) throw new Error(`Apps Script returned HTTP ${response.status}`);
        let data;
        try {
          data = JSON.parse(body);
        } catch (_) {
          throw new Error("Apps Script returned a non-JSON response.");
        }
        if (urlIndex > 0) console.warn("Primary Apps Script URL failed; loaded data from the backup URL.");
        return data;
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError || new Error("Could not load data from Apps Script.");
}

// App-wide floating notifications. Existing alert() calls are redirected here so
// users never get a blocking browser popup for routine save/error/delete messages.
function showToast(message, type = "auto") {
  let container = document.getElementById("app-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "app-toast-container";
    document.body.appendChild(container);

    const style = document.createElement("style");
    style.id = "app-toast-styles";
    style.textContent = `
      #app-toast-container { position: fixed; top: 22px; right: 22px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; width: min(360px, calc(100vw - 32px)); pointer-events: none; }
      .app-toast { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px; border-radius: 10px; color: #fff; font: 600 14px/1.45 'Plus Jakarta Sans', Arial, sans-serif; box-shadow: 0 12px 28px rgba(15, 23, 42, .24); transform: translateX(calc(100% + 30px)); opacity: 0; transition: transform .32s ease, opacity .32s ease; pointer-events: auto; }
      .app-toast.show { transform: translateX(0); opacity: 1; }
      .app-toast.success { background: #059669; }
      .app-toast.delete, .app-toast.error { background: #dc2626; }
      .app-toast.warning { background: #d97706; }
      .app-toast.info { background: #2563eb; }
      .app-toast button { margin-left: auto; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 18px; line-height: 1; }
    `;
    document.head.appendChild(style);
  }

  const text = String(message || "");
  const normalized = text.toLowerCase();
  if (type === "auto") {
    if (normalized.includes("deleted") || normalized.includes("delete ")) type = "delete";
    else if (/(error|failed|incorrect|wrong|invalid|must|could not|not found|network|exceed)/.test(normalized)) type = "error";
    else if (/(warning|already|duplicate|please select)/.test(normalized)) type = "warning";
    else if (/(success|saved|updated|collected|re-opened|archived|submitted)/.test(normalized)) type = "success";
    else type = "info";
  }

  const icons = { success: "fa-circle-check", delete: "fa-trash-can", error: "fa-circle-xmark", warning: "fa-triangle-exclamation", info: "fa-circle-info" };
  const toast = document.createElement("div");
  toast.className = `app-toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" aria-hidden="true"></i><span></span><button type="button" aria-label="Close notification">&times;</button>`;
  toast.querySelector("span").textContent = text;
  const removeToast = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  };
  toast.querySelector("button").addEventListener("click", removeToast);
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(removeToast, 4500);
}

window.showToast = showToast;
window.alert = function (message) { showToast(message); };

document.addEventListener("DOMContentLoaded", function () {
  requireLogin(); // সবার আগে লগইন চেক
  addAccountMenu();
  addMobileMenuToggle();
  loadCustomLoanTypes();

  // সাইডবার সাবমেনু খোলা/বন্ধ
  const submenuToggles = document.querySelectorAll(".submenu-toggle");
  submenuToggles.forEach((toggle) => {
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      const parent = this.parentElement;
      document.querySelectorAll(".nav-item.has-submenu.open").forEach((item) => {
        if (item !== parent) item.classList.remove("open");
      });
      parent.classList.toggle("open");
    });
  });

  // লেবেলের (*) লাল করা
  document.querySelectorAll("label").forEach(label => {
    if (label.innerHTML.includes("*")) {
      label.innerHTML = label.innerHTML.replace(/\*/g, "<span style='color: #ef4444;'>*</span>");
    }
  });
});

function requireLogin() {
  const isLoginPage = window.location.pathname.toLowerCase().includes("login.html");
  if (localStorage.getItem("loanLoggedIn") !== "true" && !isLoginPage) {
    window.location.replace("Login.html");
  }
}

function addAccountMenu() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || sidebar.querySelector(".sidebar-account")) return;

  if (!document.querySelector('link[href="css/account-menu.css"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "css/account-menu.css";
    document.head.appendChild(stylesheet);
  }

  const authData = JSON.parse(localStorage.getItem("loanAuth") || '{"username":"Admin"}');

  const accountMenu = document.createElement("div");
  accountMenu.className = "sidebar-account";
  accountMenu.innerHTML = `
    <div class="account-user"><i class="fa-solid fa-circle-user"></i><div>${authData.username}<span>Signed in</span></div></div>
    <div class="account-actions">
      <button class="account-action" type="button" title="Settings" aria-label="Settings" onclick="window.location.href='Settings.html'"><i class="fa-solid fa-gear"></i><span>Settings</span></button>
      <button class="account-action logout" type="button" title="Logout" aria-label="Logout" id="logout-button"><i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></button>
    </div>`;
  sidebar.appendChild(accountMenu);

  document.getElementById("logout-button").addEventListener("click", function () {
    localStorage.removeItem("loanLoggedIn");
    window.location.replace("Login.html");
  });
}

function addMobileMenuToggle() {
  const sidebar = document.querySelector(".sidebar");
  const brand = sidebar?.querySelector(".brand");
  if (!sidebar || !brand || brand.querySelector(".mobile-menu-toggle")) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-menu-toggle";
  toggle.setAttribute("aria-label", "Open navigation menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
  toggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("mobile-menu-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    toggle.innerHTML = `<i class="fa-solid fa-${isOpen ? "xmark" : "bars"}" aria-hidden="true"></i>`;
  });
  brand.appendChild(toggle);
}

function loadCustomLoanTypes() {
  let customLoans = JSON.parse(localStorage.getItem('customLoans')) || [];
  const sidebarList = document.getElementById('sidebar-loan-list');
  const selectList = document.getElementById('loanTypeSelect');

  customLoans.forEach(loan => {
    if (sidebarList) {
      const existsInSidebar = Array.from(sidebarList.querySelectorAll('a')).some(a => a.textContent === loan);
      if (!existsInSidebar) {
        sidebarList.innerHTML += `<li><a href="CustomerDetails.html?loan=${encodeURIComponent(loan)}">${loan}</a></li>`;
      }
    }
    if (selectList) {
      const existsInSelect = Array.from(selectList.options).some(opt => opt.value === loan);
      if (!existsInSelect) {
        let option = document.createElement("option");
        option.value = loan;
        option.textContent = loan;
        selectList.appendChild(option);
      }
    }
  });
}

