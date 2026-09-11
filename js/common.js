// আপনার Google Apps Script URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyKURwDVAQzR5PQEICmSRkhFKcfx6om4EUUllDhLUjnRVpH1LptFLNDMynX2P-8YHwpmw/exec";

document.addEventListener("DOMContentLoaded", function () {
  
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