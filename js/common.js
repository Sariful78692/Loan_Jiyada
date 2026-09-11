// আপনার Google Apps Script URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyKURwDVAQzR5PQEICmSRkhFKcfx6om4EUUllDhLUjnRVpH1LptFLNDMynX2P-8YHwpmw/exec";

const AUTH_USER_KEY = "loanManagerUser";
const AUTH_SESSION_KEY = "loanManagerSession";

function getAccount() {
  const saved = localStorage.getItem(AUTH_USER_KEY);
  if (saved) return JSON.parse(saved);
  const account = { username: "admin", password: "admin123", recoveryEmail: "admin@loanmanager.local" };
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(account));
  return account;
}

function requireLogin() {
  getAccount();
  if (sessionStorage.getItem(AUTH_SESSION_KEY) !== "active") {
    window.location.replace("Login.html");
  }
}

function addAccountMenu() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || sidebar.querySelector(".sidebar-account")) return;
  const account = getAccount();
  const accountMenu = document.createElement("div");
  accountMenu.className = "sidebar-account";
  accountMenu.innerHTML = `
    <div class="account-user"><i class="fa-solid fa-circle-user"></i><div>${account.username}<span>Signed in</span></div></div>
    <button class="account-action" type="button" onclick="window.location.href='Settings.html'"><i class="fa-solid fa-gear"></i> Settings</button>
    <button class="account-action logout" type="button" id="logout-button"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>`;
  sidebar.appendChild(accountMenu);
  document.getElementById("logout-button").addEventListener("click", function () {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.location.replace("Login.html");
  });
}

document.addEventListener("DOMContentLoaded", function () {
  requireLogin();
  addAccountMenu();
  
  // ১. সাইডবার মেনু খোলার এবং বন্ধ করার কোড
  const submenuToggles = document.querySelectorAll(".submenu-toggle");
  
  submenuToggles.forEach((toggle) => {
    toggle.addEventListener("click", function (e) {
      e.preventDefault(); // লিংকে ক্লিক করলে যেন পেজ রিলোড না হয়
      const parent = this.parentElement; 
      parent.classList.toggle("open"); 
    });
  });

  // ২. LocalStorage থেকে কাস্টম লোনগুলো সাইডবার এবং ফর্মে লোড করা
  loadCustomLoanTypes();

  // ফর্মের লেবেলে থাকা (*) গুলোকে অটোমেটিক লাল করার ম্যাজিক কোড
  document.querySelectorAll("label").forEach(label => {
    if(label.innerHTML.includes("*")) {
      label.innerHTML = label.innerHTML.replace(/\*/g, "<span style='color: #ef4444;'>*</span>");
    }
  });
});

// কাস্টম লোন লোড করার ফাংশন
function loadCustomLoanTypes() {
  let customLoans = JSON.parse(localStorage.getItem('customLoans')) || [];
  
  const sidebarList = document.getElementById('sidebar-loan-list');
  const selectList = document.getElementById('loanTypeSelect');

  customLoans.forEach(loan => {
    // সাইডবারে যোগ
    if(sidebarList) {
      const existsInSidebar = Array.from(sidebarList.querySelectorAll('a')).some(a => a.textContent === loan);
      if(!existsInSidebar) {
        sidebarList.innerHTML += `<li><a href="CustomerDetails.html?loan=${encodeURIComponent(loan)}">${loan}</a></li>`;
      }
    }
    // ফর্মের ড্রপডাউনে যোগ (শুধু Customer Entry পেজে)
    if(selectList) {
      const existsInSelect = Array.from(selectList.options).some(opt => opt.value === loan);
      if(!existsInSelect) {
        let option = document.createElement("option");
        option.value = loan;
        option.textContent = loan;
        selectList.appendChild(option);
      }
    }
  });
}
