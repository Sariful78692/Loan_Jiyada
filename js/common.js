// ---------------- Common Setup (সব পেজে চলবে) ---------------- //

// আপনার Google Apps Script এর আসল /exec URL — echo/temporary URL কখনো এখানে বসাবেন না
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzqnwSEhe1TmzVkUWxEl7B1Q1GrEzMsqKZNhsUdoagkG24I5KBzw5aExhJcXe_662nNWw/exec";
const APPS_SCRIPT_READ_URLS = [
  APPS_SCRIPT_URL,
  "https://script.google.com/macros/s/AKfycbxIzWRQjVyjFNNkugEpHj5pgNJxIGe20QkDJXyomx8pr_6o-GzxbAkxOrpyIkuYsTs6_g/exec"
];

const APP_DATA_CACHE_KEY = "loanAppDataCache_v1";
const APP_DATA_CACHE_MAX_AGE_MS = 60000;
const appDataRequests = new Map();

async function fetchAppData(view = "") {
  const cacheKey = view ? `${APP_DATA_CACHE_KEY}_${view}` : APP_DATA_CACHE_KEY;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && cached.savedAt && Date.now() - cached.savedAt < APP_DATA_CACHE_MAX_AGE_MS && cached.data) {
      return cached.data;
    }
  } catch (_) {
    invalidateAppDataCache();
  }

  if (appDataRequests.has(view)) return appDataRequests.get(view);
  const request = fetchFreshAppData(view, cacheKey);
  appDataRequests.set(view, request);
  try {
    return await request;
  } finally {
    appDataRequests.delete(view);
  }
}

async function fetchFreshAppData(view = "", cacheKey = APP_DATA_CACHE_KEY) {
  let lastError = null;
  for (let urlIndex = 0; urlIndex < APPS_SCRIPT_READ_URLS.length; urlIndex++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const query = view ? `view=${encodeURIComponent(view)}&` : "";
        const separator = APPS_SCRIPT_READ_URLS[urlIndex].includes("?") ? "&" : "?";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        let response;
        let body;
        try {
          response = await fetch(`${APPS_SCRIPT_READ_URLS[urlIndex]}${separator}${query}t=${Date.now()}-${attempt}`, {
            cache: "no-store",
            signal: controller.signal
          });
          body = await response.text();
        } finally {
          clearTimeout(timeoutId);
        }
        if (!response.ok) throw new Error(`Apps Script returned HTTP ${response.status}`);
        let data;
        try {
          data = JSON.parse(body);
        } catch (_) {
          throw new Error("Apps Script returned a non-JSON response.");
        }
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
        } catch (cacheError) {
          console.warn("Could not cache app data in this browser tab.", cacheError);
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

function invalidateAppDataCache() {
  try {
    sessionStorage.removeItem(APP_DATA_CACHE_KEY);
    sessionStorage.removeItem(`${APP_DATA_CACHE_KEY}_rd_customer_details`);
    sessionStorage.removeItem(`${APP_DATA_CACHE_KEY}_collection_report`);
    sessionStorage.removeItem(`${APP_DATA_CACHE_KEY}_gold_emi_report`);
  } catch (_) {
    // Continue with the API write even when browser storage is unavailable.
  }
}

async function postAppData(payload) {
  invalidateAppDataCache();
  return fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
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

function enforceLightMode() {
  document.documentElement.dataset.theme = "light";
  document.getElementById("app-theme-toggle")?.remove();
  document.querySelector('link[data-app-theme="true"]')?.remove();
  try {
    localStorage.removeItem("loanAppTheme");
  } catch (_) {
    // The light theme still applies for this page if storage is unavailable.
  }
}

// Shared animated loading screen for every page that includes common.js.
function addPageLoader() {
  if (document.getElementById("app-page-loader")) return;

  const style = document.createElement("style");
  style.id = "app-page-loader-styles";
  style.textContent = `
    #app-page-loader { position: fixed; inset: 0; z-index: 20000; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 42%, #163c68 0%, #0b1930 48%, #07111f 100%); color: #fff; opacity: 1; visibility: visible; transition: opacity .35s ease, visibility .35s ease; }
    #app-page-loader.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
    #app-page-loader .loader-card { display: grid; justify-items: center; gap: 18px; padding: 28px 38px; text-align: center; }
    #app-page-loader .loader-mark { position: relative; display: grid; place-items: center; width: 76px; height: 76px; border: 1px solid rgba(255,255,255,.16); border-radius: 24px; background: linear-gradient(145deg, rgba(255,255,255,.16), rgba(255,255,255,.04)); box-shadow: 0 18px 55px rgba(0,0,0,.28); }
    #app-page-loader .loader-mark::before { content: ""; position: absolute; inset: -6px; border: 2px solid transparent; border-top-color: #73e0c0; border-right-color: rgba(115,224,192,.35); border-radius: 29px; animation: app-loader-spin .9s linear infinite; }
    #app-page-loader .loader-mark i { color: #a9f3de; font-size: 29px; }
    #app-page-loader .loader-title { margin: 0; font: 800 16px/1.3 'Plus Jakarta Sans', Arial, sans-serif; letter-spacing: .13em; }
    #app-page-loader .loader-caption { margin: 7px 0 0; color: #a9b9ce; font: 500 13px/1.4 'Plus Jakarta Sans', Arial, sans-serif; }
    #app-page-loader .loader-dots { display: flex; gap: 6px; margin-top: 2px; }
    #app-page-loader .loader-dots span { width: 6px; height: 6px; border-radius: 50%; background: #73e0c0; animation: app-loader-pulse 1s ease-in-out infinite; }
    #app-page-loader .loader-dots span:nth-child(2) { animation-delay: .15s; }
    #app-page-loader .loader-dots span:nth-child(3) { animation-delay: .3s; }
    @keyframes app-loader-spin { to { transform: rotate(360deg); } }
    @keyframes app-loader-pulse { 0%, 60%, 100% { opacity: .35; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { #app-page-loader *, #app-page-loader::before { animation-duration: 2s !important; } }
  `;
  document.head.appendChild(style);

  const loader = document.createElement("div");
  loader.id = "app-page-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-live", "polite");
  loader.innerHTML = `<div class="loader-card"><div class="loader-mark"><i class="fa-solid fa-hand-holding-dollar" aria-hidden="true"></i></div><div><p class="loader-title">LOAN MANAGEMENT</p><p class="loader-caption">Preparing your workspace</p></div><div class="loader-dots" aria-hidden="true"><span></span><span></span><span></span></div></div>`;
  document.body.appendChild(loader);

  const startedAt = Date.now();
  let hideScheduled = false;
  const hideLoader = () => {
    if (hideScheduled) return;
    hideScheduled = true;
    setTimeout(() => loader.classList.add("is-hidden"), Math.max(0, 650 - (Date.now() - startedAt)));
  };
  if (document.readyState === "complete") hideLoader();
  else window.addEventListener("load", hideLoader, { once: true });
  // Avoid a stuck overlay when a third-party asset never finishes loading.
  setTimeout(hideLoader, 5000);
}

document.addEventListener("DOMContentLoaded", function () {
  enforceLightMode();
  addPageLoader();
  const flashToastMessage = sessionStorage.getItem("appFlashToast");
  if (flashToastMessage) {
    sessionStorage.removeItem("appFlashToast");
    showToast(flashToastMessage, "success");
  }
  requireLogin(); // সবার আগে লগইন চেক
  addAccountMenu();
  addMobileMenuToggle();
  addGroupLoanMenu();
  setGroupPageContext();
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
      const isOpen = parent.classList.toggle("open");
      this.setAttribute("aria-expanded", String(isOpen));
    });
  });

  // লেবেলের (*) লাল করা
  document.querySelectorAll("label").forEach(label => {
    if (label.innerHTML.includes("*")) {
      label.innerHTML = label.innerHTML.replace(/\*/g, "<span style='color: #ef4444;'>*</span>");
    }
  });
});

function addGroupLoanMenu() {
  const navMenu = document.querySelector(".sidebar .nav-menu");
  if (!navMenu || navMenu.querySelector('[data-group-loan-menu="true"]')) return;

  // Give Group Loan its own entry workflow instead of listing it as a generic loan type.
  const loanList = document.getElementById("sidebar-loan-list");
  if (loanList) {
    Array.from(loanList.querySelectorAll("a")).forEach(link => {
      if (link.textContent.trim().toLowerCase() === "group loan") link.closest("li")?.remove();
    });
  }

  const item = document.createElement("li");
  item.className = "nav-item has-submenu";
  item.dataset.groupLoanMenu = "true";
  item.innerHTML = `
    <a href="#" class="nav-link submenu-toggle" aria-expanded="false">
      <i class="fa-solid fa-people-group"></i> Group Loan <i class="fa-solid fa-chevron-down arrow"></i>
    </a>
    <ul class="submenu"><li><a href="CustomerEntry.html?mode=group">Group Entry</a></li><li><a href="GroupDetails.html">Group Details</a></li></ul>`;
  const goldLoanItem = Array.from(navMenu.children).find(child => child.querySelector('a[href="GoldLoanEntry.html"]'));
  const reportItem = navMenu.querySelector('a[href="Report.html"]')?.closest("li");
  navMenu.insertBefore(item, goldLoanItem || reportItem || null);
}

function setGroupPageContext() {
  const params = new URLSearchParams(window.location.search);
  const isGroupEntry = params.get("mode") === "group" && window.location.pathname.toLowerCase().endsWith("customerentry.html");
  const isGroupDetails = window.location.pathname.toLowerCase().endsWith("groupdetails.html");
  if (!isGroupEntry && !isGroupDetails) return;

  if (isGroupEntry) {
    const heading = document.getElementById("form-title");
    if (heading) heading.textContent = "Group Entry Form";
    document.title = "Group Entry - Loan Management";
    const loanType = document.getElementById("loanTypeSelect");
    if (loanType) loanType.value = "Group Loan";
    const submitButton = document.getElementById("submit-btn");
    if (submitButton) submitButton.textContent = "Save Group Customer";
  }
  if (isGroupDetails) document.title = "Group Details - Loan Management";

  const groupLink = Array.from(document.querySelectorAll('[data-group-loan-menu="true"] .submenu a'))
    .find(link => isGroupEntry ? link.href.includes("mode=group") : link.href.endsWith("GroupDetails.html"));
  if (groupLink) {
    groupLink.classList.add("active");
    groupLink.closest(".nav-item")?.classList.add("open");
    groupLink.closest(".nav-item")?.querySelector(":scope > .nav-link")?.setAttribute("aria-expanded", "true");
  }
}

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

