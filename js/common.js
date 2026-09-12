// ---------------- Common Setup (সব পেজে চলবে) ---------------- //

// আপনার Google Apps Script এর আসল /exec URL — echo/temporary URL কখনো এখানে বসাবেন না
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6Rvkbo8aPiPW0J4gFzAiF0TZXybkfquoLMa5jK42TQJGguQZ0yuq5pPDUzxXA7MkNwg/exec";

document.addEventListener("DOMContentLoaded", function () {
  requireLogin(); // সবার আগে লগইন চেক
  addAccountMenu();
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

