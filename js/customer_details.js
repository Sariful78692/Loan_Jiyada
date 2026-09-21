let customersData = []; 
let allCollectionsData = []; 
let currentLoanFilter = "";
let selectedCustomerId = null;
let selectedCustomerName = null;
let selectedLoanType = null;
let selectedAmount = null;
let lastCollectionReceipt = null;
let selectedCustomerDuration = 0;

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  currentLoanFilter = urlParams.get("loan");

  const pageTitle = document.getElementById("page-title");
  if (currentLoanFilter && pageTitle) {
    pageTitle.innerHTML = `<i class="fa-solid fa-users"></i> ${currentLoanFilter} Customers`;
  } else if (pageTitle) {
    pageTitle.innerHTML = `<i class="fa-solid fa-users"></i> All Customers`;
  }

  // 🟢 সার্চ এবং ইয়ার ফিল্টারকে অটোমেটিক কানেক্ট করার লজিক
  const searchInputEl = document.getElementById("searchInput");
  if (searchInputEl) {
    searchInputEl.addEventListener("input", searchCustomers);
    searchInputEl.addEventListener("keyup", searchCustomers);
  }
  
  const yearFilterEl = document.getElementById("yearFilter");
  if (yearFilterEl) {
    yearFilterEl.addEventListener("change", searchCustomers);
  }

  await fetchCustomers();
});

async function fetchCustomers() {
  const tbody = document.getElementById("customer-table-body");
  if(tbody) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; font-size:18px; color:#0284c7;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?t=" + new Date().getTime());
    const data = await res.json();
    
    allCollectionsData = data.collections || [];

    let activeCustomers = data.customers.filter(c => (c["Status"] || "").trim() !== "Disabled");
    
    if (currentLoanFilter) {
      activeCustomers = activeCustomers.filter(c => (c["Loan Type"] || "").trim() === currentLoanFilter.trim());
    }

    customersData = activeCustomers;
    renderTable(customersData);
  } catch (err) {
    console.error("Failed to fetch", err);
  }
}

function renderTable(data) {
  const tbody = document.getElementById("customer-table-body");
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr style="background-color: #f8fafc; text-align: left; color: #0284c7; font-size: 13px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
      <th style="padding: 15px; font-weight: bold;">Photo</th>
      <th style="padding: 15px; font-weight: bold;">ID</th>
      <th style="padding: 15px; font-weight: bold;">Name</th>
      <th style="padding: 15px; font-weight: bold;">Mobile No</th>
      <th style="padding: 15px; font-weight: bold;">Address</th>
      <th style="padding: 15px; font-weight: bold;">Loan Type</th>
      <th style="padding: 15px; font-weight: bold;">Occupation</th>
      <th style="padding: 15px; font-weight: bold;">Start Date</th>
      <th style="padding: 15px; font-weight: bold;">End Date</th>
      <th style="padding: 15px; font-weight: bold;">Due Day</th>
      <th style="padding: 15px; font-weight: bold; text-align: center;">Actions</th>
    </tr>
  `;

  if (data.length === 0) {
    tbody.innerHTML += `
      <tr>
        <td colspan="11" style="text-align: center; padding: 40px; color: #ef4444; font-size: 18px; font-weight: bold; background: #fef2f2;">
          <i class="fa-solid fa-folder-open" style="font-size: 40px; margin-bottom: 15px; display: block; color: #f87171;"></i>
          No Data Available Here
        </td>
      </tr>
    `;
    return;
  }

  data.forEach((cust) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #e2e8f0";

    let imgHtml = '<div style="width:40px; height:40px; background:#e2e8f0; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-user" style="color:#64748b;"></i></div>';
    if (cust["Photo URL"] && cust["Photo URL"].includes("id=")) {
      const fileIdMatch = cust["Photo URL"].match(/id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        const newUrl = `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w150-h150`;
        imgHtml = `<img src="${newUrl}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png';" alt="Profile" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 1px solid #cbd5e1;">`;
      }
    }

    const custId = String(cust["ID"]).trim();
    const durationDays = parseInt(cust["Duration (Days)"]) || 0;
    
    let loanStatus = String(cust["Status"] || "").trim().toLowerCase();
    if (loanStatus !== "closed") {
      loanStatus = "active";
    }

    const customerCollections = allCollectionsData.filter(col => String(col["Customer ID"]).trim() === custId);
    const collectionCount = customerCollections.length;
    const dates = getCustomerDates(cust, durationDays);

    let actionButtonsHtml = ""; 
    
    if (loanStatus === "closed") {
      actionButtonsHtml = `
        <span style="color: #64748b; font-weight: bold; font-size: 12px; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; margin-right: 5px; display: inline-block;">
          <i class="fa-solid fa-lock"></i> Closed
        </span>
        <button onclick="deleteCustomer('${custId}')" style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Delete Customer">
          <i class="fa-solid fa-trash"></i>
        </button>
        <button onclick="reopenCustomerLoan('${custId}')" style="background: #3b82f6; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Re-activate Loan">
          <i class="fa-solid fa-unlock"></i> Re-open
        </button>
      `;
    } else if (currentLoanFilter === "RD Loan") {
      let collectBtn = "";
      if (currentLoanFilter === "RD Loan" && durationDays > 0 && collectionCount >= durationDays) {
        collectBtn = `
          <span style="color: #10b981; font-weight: bold; font-size: 13px; background: #d1fae5; padding: 5px 10px; border-radius: 4px; margin-right: 5px; display: inline-block;">
            <i class="fa-solid fa-circle-check"></i> Completed
          </span>
        `;
      } else {
        collectBtn = `
          <button onclick="openCollectionModal('${custId}')" style="background: #10b981; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Collect Payment">
            <i class="fa-solid fa-indian-rupee-sign"></i> Collect
          </button>
        `;
      }

      actionButtonsHtml = `
        ${collectBtn}
        <button onclick="editCustomer('${custId}')" style="background: #eab308; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Edit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="deleteCustomer('${custId}')" style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    } else {
      actionButtonsHtml = `
        <button onclick="editCustomer('${custId}')" style="background: #eab308; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Edit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="deleteCustomer('${custId}')" style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    }

    tr.innerHTML = `
      <td style="padding: 10px 15px;">${imgHtml}</td>
      <td style="padding: 10px 15px; white-space: nowrap;">${custId || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: 500; color: #0f172a;">${cust["Customer Name"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${cust["Mobile No"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${cust["Address"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #0284c7;">${cust["Loan Type"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${cust["Occupation"] || "N/A"}</td>
      <td style="padding: 10px 15px; white-space: nowrap;">${dates.startDate}</td>
      <td style="padding: 10px 15px; white-space: nowrap;">${dates.endDate}</td>
      <td style="padding: 10px 15px; white-space: nowrap;">${dates.dueDate}</td>
      <td style="padding: 10px 15px; text-align: center; white-space: nowrap;">
        ${actionButtonsHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 🟢 ইয়ার ফিল্টার এবং সার্চ লজিক (আপডেট করা হয়েছে)
function searchCustomers() {
  const inputEl = document.getElementById("searchInput");
  const yearFilterEl = document.getElementById("yearFilter");
  
  const input = inputEl ? inputEl.value.toLowerCase().trim() : "";
  const yearFilter = yearFilterEl ? yearFilterEl.value : "All";

  const filteredData = customersData.filter(cust => {
    const name = String(cust["Customer Name"] || "").toLowerCase();
    const mobile = String(cust["Mobile No"] || "").toLowerCase();
    
    // Start Date অথবা Timestamp থেকে সাল মেলানো
    const startDate = String(cust["Start Date"] || cust["Timestamp"] || ""); 

    const matchSearch = name.includes(input) || mobile.includes(input);
    const matchYear = yearFilter === "All" || startDate.includes(yearFilter);

    return matchSearch && matchYear;
  });
  
  renderTable(filteredData);
}

function openCollectionModal(id) {
  const cust = customersData.find(c => c["ID"] === id);
  if (!cust) return;

  selectedCustomerId = cust["ID"];
  selectedCustomerName = cust["Customer Name"];
  selectedLoanType = cust["Loan Type"];
  selectedAmount = cust["Loan Amount"] ? cust["Loan Amount"] : "0.00";

  const today = new Date().toISOString().substring(0, 10);
  document.getElementById("manual-collection-date").value = today;

  document.getElementById("collect-cust-name").innerText = selectedCustomerName;
  document.getElementById("collect-cust-id").innerText = "ID: " + selectedCustomerId;
  document.getElementById("collect-amount").innerText = "₹ " + selectedAmount;
  
  document.getElementById("collection-modal").classList.remove("hidden");
}

function closeCollectionModal() {
  document.getElementById("collection-modal").classList.add("hidden");
}

async function submitCollection() {
  const collectionDate = document.getElementById("manual-collection-date").value;
  if (!collectionDate) {
    alert("Please select a collection date!");
    return;
  }

  const isDuplicate = allCollectionsData.some(col => {
    let existDate = col["Collection Date"] ? String(col["Collection Date"]).trim() : "";
    
    if (existDate.includes("T")) {
      existDate = existDate.split("T")[0];
    } else if (existDate.includes("-")) {
      const parts = existDate.split("-");
      if (parts[0].length !== 4) { 
        existDate = `${parts[2]}-${parts[1]}-${parts[0]}`; 
      }
    }

    return String(col["Customer ID"]).trim() === String(selectedCustomerId).trim() && existDate === collectionDate;
  });

  if (isDuplicate) {
    alert("⚠️ Warning: এই কাস্টমারের নামে এই তারিখে ইতিপূর্বেই একটি কালেকশন এন্ট্রি হয়ে গেছে! একই দিনে দ্বিতীয়বার কালেকশন নেওয়া যাবে না।");
    return;
  }

  const payBtn = document.getElementById("confirm-pay-btn");
  payBtn.disabled = true;
  payBtn.innerText = "Processing...";

  const payload = {
    action: "collectInstallment",
    customerId: selectedCustomerId,
    customerName: selectedCustomerName,
    loanType: selectedLoanType,
    collectionDate: collectionDate,
    amount: selectedAmount
  };

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.status === "success") {
      alert("✅ Installment collected successfully for " + collectionDate + "!");
      closeCollectionModal();
      window.location.reload(); 
    } else if (result.message === "DUPLICATE_COLLECTION") {
      alert("⚠️ Warning: এই কাস্টমারের নামে এই তারিখে ইতিপূর্বেই একটি কালেকশন এন্ট্রি হয়ে গেছে!");
    } else {
      alert("❌ Failed to save collection.");
    }
  } catch (err) {
    alert("Network error. Please try again.");
    console.error(err);
  } finally {
    payBtn.disabled = false;
    payBtn.innerText = "Confirm Payment";
  }
}

async function deleteCustomer(id) {
  if (!confirm("Are you sure you want to delete this customer?")) return;
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "delete", id: id }) });
    const result = await res.json();
    if (result.status === "success") { alert("Customer deleted!"); location.reload(); }
  } catch (err) { alert("Error deleting."); }
}

function editCustomer(id) {
  const customerToEdit = customersData.find(c => c["ID"] === id); 
  if(customerToEdit) {
    sessionStorage.setItem("editCustomerData", JSON.stringify(customerToEdit));
    window.location.href = "CustomerEdit.html";
  }
}

async function closeCustomerLoan(customerId) {
  if (!confirm("Are you sure you want to CLOSE this loan? \n\nThis will mark the customer as 'Closed' and move all their collections to the Archive sheet.")) {
    return;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "close_loan", customerId: customerId })
    });
    const result = await res.json();
    if (result.status === "success") {
      alert("Loan closed and data archived successfully!");
      window.location.reload(); 
    } else {
      alert("Failed to close loan: " + (result.message || "Unknown error"));
    }
  } catch (err) {
    alert("Failed to connect to the server.");
  }
}

async function reopenCustomerLoan(customerId) {
  if (!confirm("Are you sure you want to RE-OPEN this closed loan? \n\nThis will mark the customer as 'Active' again.")) {
    return;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "reopen_loan", customerId: customerId })
    });
    const result = await res.json();
    if (result.status === "success") {
      alert("Loan re-opened and marked as Active successfully!");
      window.location.reload(); 
    } else {
      alert("Failed to re-open loan. Server message: " + (result.message || "Unknown error"));
    }
  } catch (err) {
    alert("Failed to connect to the server.");
  }
}

function getCustomerDates(customer, durationDays) {
  const start = parseStoredDate(customer["Start Date"]);
  const startDate = start ? formatDisplayDate(start) : "—";
  // The start date is Day 1, so a 365-day RD ends 364 calendar days later.
  const endDate = start && durationDays > 0 ? formatDisplayDate(addDays(start, durationDays - 1)) : "—";
  const dueDate = start && durationDays > 0
    ? `${getRemainingDays(start, durationDays)} Days`
    : "—";

  return { startDate, endDate, dueDate };
}

function getRemainingDays(startDate, durationDays) {
  const today = new Date();
  // Count both the start date and today: start date is Day 1.
  const elapsedDays = getCalendarDayDifference(startDate, today) + 1;
  const completedDays = Math.min(durationDays, Math.max(0, elapsedDays));
  return durationDays - completedDays;
}

function getCalendarDayDifference(fromDate, toDate) {
  const fromUtc = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const toUtc = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((toUtc - fromUtc) / 86400000);
}

function parseStoredDate(value) {
  if (!value) return null;
  const rawValue = String(value).trim();
  const normalized = normalizeCollectionDate(rawValue);
  let date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    date = new Date(rawValue);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDisplayDate(date) {
  return formatDateInput(date).split("-").reverse().join("-");
}

// RD collection: accept a date range, save one installment for each selected day,
// then keep the modal open so the saved payment can be printed as a receipt.
function openCollectionModal(id) {
  const cust = customersData.find(c => String(c["ID"]) === String(id));
  if (!cust) return;

  selectedCustomerId = cust["ID"];
  selectedCustomerName = cust["Customer Name"];
  selectedLoanType = cust["Loan Type"];
  selectedAmount = cust["Loan Amount"] || "0.00";
  selectedCustomerDuration = parseInt(cust["Duration (Days)"], 10) || 0;

  const today = formatDateInput(new Date());
  document.getElementById("collection-start-date").value = today;
  document.getElementById("collection-end-date").value = today;
  document.getElementById("collect-cust-name").innerText = selectedCustomerName;
  document.getElementById("collect-cust-id").innerText = "ID: " + selectedCustomerId;
  document.getElementById("print-receipt-btn").classList.add("hidden");
  document.getElementById("confirm-pay-btn").classList.remove("hidden");
  document.getElementById("close-collection-btn").innerText = "Cancel";
  updateCollectionRangeSummary();
  document.getElementById("collection-modal").classList.remove("hidden");
}

function getDateRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (cursor <= end) {
    dates.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(amount) {
  return "₹ " + Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeCollectionDate(value) {
  const date = String(value || "").trim();
  if (date.includes("T")) return date.split("T")[0];
  const parts = date.split("-");
  return parts.length === 3 && parts[0].length !== 4 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date;
}

function updateCollectionRangeSummary() {
  const startDate = document.getElementById("collection-start-date").value;
  const endDate = document.getElementById("collection-end-date").value;
  const daysEl = document.getElementById("collection-days");
  const amountEl = document.getElementById("collect-amount");
  if (!startDate || !endDate) {
    daysEl.innerText = "Select a date range";
    amountEl.innerText = "";
  } else if (startDate > endDate) {
    daysEl.innerText = "End date must be on or after the start date";
    amountEl.innerText = "";
  } else {
    const days = getDateRange(startDate, endDate).length;
    daysEl.innerText = `${days} day${days === 1 ? "" : "s"} payment (${startDate} to ${endDate})`;
    amountEl.innerText = formatMoney(Number(selectedAmount) * days);
  }
}

async function submitCollection() {
  const startDate = document.getElementById("collection-start-date").value;
  const endDate = document.getElementById("collection-end-date").value;
  if (!startDate || !endDate || startDate > endDate) {
    alert("Please select a valid date range.");
    return;
  }

  const requestedDates = getDateRange(startDate, endDate);
  const customerEntries = allCollectionsData.filter(col => String(col["Customer ID"]).trim() === String(selectedCustomerId).trim());
  const existingDates = new Set(customerEntries.map(col => normalizeCollectionDate(col["Collection Date"])));
  const datesToCollect = requestedDates.filter(date => !existingDates.has(date));
  if (!datesToCollect.length) {
    alert("All selected dates have already been collected.");
    return;
  }
  if (selectedCustomerDuration && customerEntries.length + datesToCollect.length > selectedCustomerDuration) {
    alert("Selected dates exceed this customer's loan duration.");
    return;
  }

  const payBtn = document.getElementById("confirm-pay-btn");
  payBtn.disabled = true;
  payBtn.innerText = "Processing...";
  try {
    const collectedDates = [];
    for (const collectionDate of datesToCollect) {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "collectInstallment", customerId: selectedCustomerId, customerName: selectedCustomerName, loanType: selectedLoanType, collectionDate, amount: selectedAmount })
      });
      const result = await res.json();
      if (result.status === "success") {
        collectedDates.push(collectionDate);
        allCollectionsData.push({ "Customer ID": selectedCustomerId, "Collection Date": collectionDate, "Amount": selectedAmount });
      } else if (result.message !== "DUPLICATE_COLLECTION") {
        throw new Error(result.message || "Unable to save payment");
      }
    }
    if (!collectedDates.length) throw new Error("The selected payments were already collected.");

    lastCollectionReceipt = { customerId: selectedCustomerId, customerName: selectedCustomerName, loanType: selectedLoanType, dates: collectedDates, dailyAmount: Number(selectedAmount), totalAmount: Number(selectedAmount) * collectedDates.length, paidAt: new Date() };
    document.getElementById("print-receipt-btn").classList.remove("hidden");
    payBtn.classList.add("hidden");
    document.getElementById("close-collection-btn").innerText = "Close";
    alert(`Payment confirmed for ${collectedDates.length} day(s). You can now print the receipt.`);
  } catch (err) {
    alert("Payment could not be completed: " + err.message);
    console.error(err);
  } finally {
    payBtn.disabled = false;
    payBtn.innerText = "Confirm Payment";
  }
}

function escapeReceiptHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function printCollectionReceipt() {
  if (!lastCollectionReceipt) return;
  const receipt = lastCollectionReceipt;
  const printWindow = window.open("", "_blank", "width=800,height=700");
  if (!printWindow) { alert("Please allow pop-ups to print the receipt."); return; }
  const dateList = receipt.dates.map(date => `<li>${escapeReceiptHtml(date)}</li>`).join("");
  printWindow.document.write(`<!doctype html><html><head><title>Payment Receipt</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px;max-width:650px;margin:auto}.head{border-bottom:3px solid #10b981;padding-bottom:16px;display:flex;justify-content:space-between}h1{margin:0;color:#047857;font-size:27px}.muted{color:#64748b}table{border-collapse:collapse;width:100%;margin:22px 0}td{padding:10px;border-bottom:1px solid #dbe3ed}.total{font-size:20px;font-weight:bold;color:#047857}ul{columns:2;padding-left:20px}@media print{body{padding:0}}</style></head><body><div class="head"><div><h1>Payment Receipt</h1><div class="muted">Loan Management</div></div><div class="muted">Issued: ${escapeReceiptHtml(receipt.paidAt.toLocaleString())}</div></div><table><tr><td>Customer Name</td><td><strong>${escapeReceiptHtml(receipt.customerName)}</strong></td></tr><tr><td>Customer ID</td><td>${escapeReceiptHtml(receipt.customerId)}</td></tr><tr><td>Loan Type</td><td>${escapeReceiptHtml(receipt.loanType)}</td></tr><tr><td>Daily Installment</td><td>${formatMoney(receipt.dailyAmount)}</td></tr><tr><td>Payment Dates (${receipt.dates.length})</td><td><ul>${dateList}</ul></td></tr><tr><td class="total">Total Paid</td><td class="total">${formatMoney(receipt.totalAmount)}</td></tr></table><p class="muted">This is a computer-generated payment receipt.</p><script>window.onload=()=>window.print();</script></body></html>`);
  printWindow.document.close();
}
