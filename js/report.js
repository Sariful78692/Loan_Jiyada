document.addEventListener("DOMContentLoaded", async function () {
  populateLoanDropdownFromSidebar();
  await fetchReportData();
});

let allCollectionsData = [];
let allClosedCollectionsData = []; // 🟢 ক্লোজড কালেকশনের জন্য
let allCustomersData = [];
let allGoldLoansData = [];
let currentReportType = "collections";

// সাইডবার থেকে লোন টাইপগুলো রিড করে ড্রপডাউনে বসানো
function populateLoanDropdownFromSidebar() {
  const select = document.getElementById("reportFilter");
  if (!select) return;

  const sidebarLoanLinks = document.querySelectorAll("#sidebar-loan-list a");
  
  sidebarLoanLinks.forEach(link => {
    const urlParams = new URLSearchParams(link.href.split("?")[1]);
    const loanType = urlParams.get("loan");
    
    if (loanType) {
      let exists = false;
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === loanType) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        const option = document.createElement("option");
        option.value = loanType;
        option.innerText = `${loanType} Report`;
        select.appendChild(option);
      }
    }
  });
}

async function fetchReportData() {
  const tbody = document.getElementById("report-table-body");
  if (!tbody) return;

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?t=" + new Date().getTime());
    const data = await res.json();
    
    allCollectionsData = data.collections || [];
    allClosedCollectionsData = data.closed_collections || [];
    
    allCustomersData = (data.customers || []).map(c => {
      if (c["Loan Type"]) {
        c["Loan Type"] = String(c["Loan Type"]).trim();
      }
      return c;
    }).filter(c => {
      const status = (c["Status"] || "").trim().toLowerCase();
      return status !== "disabled";
    });

    allGoldLoansData = data.gold_loans || [];
    
    renderCurrentReport();
  } catch (err) {
    console.error("Failed to load report data", err);
    tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; color: red; padding: 20px;">Failed to load report data.</td></tr>`;
  }
}

function changeReportType() {
  currentReportType = document.getElementById("reportFilter").value;
  const heading = document.getElementById("report-heading");
  
  if (currentReportType === "collections") {
    heading.innerText = "Collections Report";
  } else if (currentReportType === "All") {
    heading.innerText = "All Customers Report";
  } else {
    heading.innerText = `${currentReportType} Report`;
  }

  renderCurrentReport();
}

function renderCurrentReport() {
  const statusFilterEl = document.getElementById("reportStatusFilter");
  const currentStatus = statusFilterEl ? statusFilterEl.value : "Active";

  if (currentReportType === "collections") {
    renderCollectionsTable(currentStatus === "Closed" ? allClosedCollectionsData : allCollectionsData, currentStatus);
  } else {
    let filteredCustomers = allCustomersData.filter(c => {
      
      let dbStatus = String(c["Status"] || "").trim().toLowerCase();
      if (dbStatus !== "closed") {
        dbStatus = "active"; 
      }
      let selectedStatus = currentStatus.toLowerCase();
      let statusMatch = (dbStatus === selectedStatus);

      let loanMatch = true;
      if (currentReportType !== "All") {
        let dbLoan = String(c["Loan Type"] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        let selectedLoan = String(currentReportType).toLowerCase().replace("report", "").replace(/[^a-z0-9]/g, "");
        loanMatch = dbLoan.includes(selectedLoan) || selectedLoan.includes(dbLoan);
      }
      
      return statusMatch && loanMatch;
    });
    
    renderCustomersTable(filteredCustomers, currentStatus);
  }
}

// পার্মানেন্ট ডেট ফিক্স
function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  if (typeof dateStr === "string" && dateStr.includes("T")) {
    dateStr = dateStr.split("T")[0]; 
  }
  if (typeof dateStr === "string" && dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dateStr;
}


// ========================================================
// 🟢 টেবিল রেন্ডারিং সেকশন 
// ========================================================

// কালেকশন টেবিল রেন্ডার
function renderCollectionsTable(data, status) {
  const headerRow = document.getElementById("table-header-row");
  const tbody = document.getElementById("report-table-body");
  
  headerRow.innerHTML = `
    <th style="padding: 12px;">Collection ID</th>
    <th style="padding: 12px;">Customer Name</th>
    <th style="padding: 12px;">Loan Type</th>
    <th style="padding: 12px;">Collection Date</th>
    <th style="padding: 12px;">Amount</th>
    <th style="padding: 12px; text-align: center;">Actions</th>
  `;

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">No ${status.toLowerCase()} collection records found.</td></tr>`;
    filterTableAndCalculateTotal(); // ডেটা না থাকলেও টোটাল ০ করার জন্য কল করা হলো
    return;
  }

  data.forEach((item) => {
    let actionHtml = '';
    
    if (status === "Closed") {
      actionHtml = `
        <span style="background: #f1f5f9; color: #64748b; padding: 6px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 5px;">
          <i class="fa-solid fa-lock"></i> Archived
        </span>
        <button onclick="deleteCollection('${item["Collection ID"]}')" style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    } else {
      actionHtml = `
        <button onclick="openEditModal('${item["Collection ID"]}')" style="background: #eab308; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Edit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="deleteCollection('${item["Collection ID"]}')" style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding: 10px 15px;">${item["Collection ID"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: 500;">${item["Customer Name"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #0284c7;">${item["Loan Type"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${formatDate(item["Collection Date"])}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #10b981;">₹ ${item["Amount"] || "0"}</td>
      <td style="padding: 10px 15px; text-align: center; white-space: nowrap;">${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // 🟢 টেবিল রেন্ডার হওয়ার পর টোটাল হিসাব করার ফাংশন কল করা হলো
  filterTableAndCalculateTotal(); 
}

// কাস্টমার টেবিল রেন্ডার
function renderCustomersTable(data, status) {
  const headerRow = document.getElementById("table-header-row");
  const tbody = document.getElementById("report-table-body");
  
  headerRow.innerHTML = `
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Customer Name</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">DOB</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Guardian Name</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Mobile No</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Aadhar Number</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Occupation</th>
    <th style="padding: 10px; font-size: 12px; min-width: 120px;">Address</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Nominee Name</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Nominee Gender</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Relation</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">RD Amount</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Start Date</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Total Amount</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">G.Total</th>
    <th class="no-print" style="padding: 10px; font-size: 12px; text-align: center;">Action</th>
  `;

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 20px; color: #64748b;">No records found.</td></tr>`;
    filterTableAndCalculateTotal();
    return;
  }

  const relevantCollections = status === "Closed" ? allClosedCollectionsData : allCollectionsData;

  data.forEach((cust) => {
    const custId = String(cust["ID"] || "").trim();
    const unitAmount = parseFloat(cust["Loan Amount"]) || 0;
    const rawInterest = String(cust["Interest %"] || cust["Interest Rate"] || "0").replace("%", "").trim();
    const interestPercent = parseFloat(rawInterest) || 0;

    const collectionCount = relevantCollections.filter(col => String(col["Customer ID"]).trim() === custId).length;
    const totalAmount = unitAmount * collectionCount;
    const interestAmount = (totalAmount * interestPercent) / 100;
    const gTotalAmount = totalAmount + interestAmount;

    const relationVal = cust["Relation With Applicant"] || cust["Relation"] || cust["Relation with Applicant"] || "N/A";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding: 8px 10px; font-size: 12px; font-weight: 500;">${cust["Customer Name"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${formatDate(cust["DOB"])}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${cust["Guardian Name"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${cust["Mobile No"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${cust["Aadhaar No"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${cust["Occupation"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${cust["Address"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${cust["Nominee Name"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${cust["Nominee Gender"] || "N/A"}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${relationVal}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold;">₹ ${unitAmount}</td>
      <td style="padding: 8px 10px; font-size: 12px;">${formatDate(cust["Start Date"])}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #2563eb;">₹ ${totalAmount}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #10b981;">₹ ${gTotalAmount.toFixed(2)}</td>
      <td class="no-print" style="padding: 8px 10px; text-align: center;">
        <button onclick="printCustomerProfile('${custId}')" style="background: #0284c7; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Print Customer Form">
          <i class="fa-solid fa-print"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 🟢 টেবিল রেন্ডার হওয়ার পর টোটাল হিসাব করার ফাংশন কল করা হলো
  filterTableAndCalculateTotal();
}


// ========================================================
// 🟢 ফিল্টার এবং টোটাল হিসাব করার ম্যাজিক সেকশন (নিয়মিত আপডেট)
// ========================================================

function filterReport() {
  filterTableAndCalculateTotal();
}

function filterTableAndCalculateTotal() {
  // ১. ইনপুট ফিল্ড থেকে ভ্যালুগুলো নেওয়া
  const searchInputEl = document.getElementById("reportSearchInput");
  const yearFilterEl = document.getElementById("reportYearFilter");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");

  const searchText = searchInputEl ? searchInputEl.value.toLowerCase() : "";
  const filterYear = yearFilterEl ? yearFilterEl.value : "All";
  
  // Date Object এ কনভার্ট করা
  const start = (startDateEl && startDateEl.value) ? new Date(startDateEl.value) : null;
  const end = (endDateEl && endDateEl.value) ? new Date(endDateEl.value) : null;

  const tbody = document.getElementById("report-table-body");
  if (!tbody) return;
  const rows = tbody.getElementsByTagName("tr");

  let totalCollection = 0;

  // ২. কোন কলাম থেকে ডেট এবং অ্যামাউন্ট নেবে তা নির্ধারণ করা
  const isCollectionReport = (currentReportType === "collections");
  const dateColIndex = isCollectionReport ? 3 : 11; 
  const amountColIndex = isCollectionReport ? 4 : 13;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // হেডার বা 'No records found' রো বাদ দেওয়া
    if (row.getElementsByTagName("th").length > 0 || row.textContent.includes("No records found") || row.textContent.includes("No active collection")) {
      continue;
    }

    const cells = row.getElementsByTagName("td");
    if (cells.length <= amountColIndex) continue;

    const rowText = row.textContent.toLowerCase();
    const rowOriginalText = row.textContent;

    // ৩. সার্চ এবং ইয়ার ম্যাচ করানো
    const matchSearch = rowText.includes(searchText);
    const matchYear = (filterYear === "All" || rowOriginalText.includes(filterYear));

    // ৪. ডেট রেঞ্জ (Date Range) ম্যাচ করানো
    let matchDateRange = true;
    if (start || end) {
      const dateText = cells[dateColIndex].innerText.trim(); 
      const dateParts = dateText.split('-'); 
      
      if (dateParts.length === 3) {
        const rowDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        if (start && rowDate < start) matchDateRange = false;
        if (end && rowDate > end) matchDateRange = false;
      } else {
        matchDateRange = false; 
      }
    }

    // ৫. সবকিছু ম্যাচ করলে রো দেখাবে এবং টোটাল যোগ করবে
    if (matchSearch && matchYear && matchDateRange) {
      row.style.display = ""; 
      
      const amtText = cells[amountColIndex].innerText.replace(/[^0-9.-]+/g, "");
      const numericAmount = parseFloat(amtText);
      
      if (!isNaN(numericAmount)) {
        totalCollection += numericAmount;
      }
    } else {
      row.style.display = "none"; 
    }
  }

 // 🟢 ৬. UI তে ফিল্টার অনুযায়ী ডাইনামিক নাম আপডেট করা
  const totalLabel = document.getElementById("totalLabelDisplay");
  if (totalLabel) {
    if (currentReportType === "collections") {
      totalLabel.innerText = "Total Collection";
    } else if (currentReportType === "All") {
      totalLabel.innerText = "All Customers Total Amount";
    } else {
      // যেমন: RD Loan Total Amount, Group Loan Total Amount
      totalLabel.innerText = `${currentReportType} Total Amount`;
    }
  }

  // ৭. UI তে টোটাল আপডেট করা (ভারতীয় টাকার ফরম্যাটে)
  const totalDisplay = document.getElementById("totalAmountDisplay");
  if (totalDisplay) {
    totalDisplay.innerText = "₹ " + totalCollection.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

// ক্লিয়ার ফিল্টার বাটন ফাংশন
function clearFilters() {
  if(document.getElementById("startDate")) document.getElementById("startDate").value = "";
  if(document.getElementById("endDate")) document.getElementById("endDate").value = "";
  if(document.getElementById("reportSearchInput")) document.getElementById("reportSearchInput").value = "";
  if(document.getElementById("reportYearFilter")) document.getElementById("reportYearFilter").value = "All";
  
  // সব ফিল্টার ফাঁকা করার পর টেবিল আবার আপডেট করা
  filterTableAndCalculateTotal(); 
}


// ========================================================
// 🟢 অন্যান্য ফাংশন (Print, Export, Edit, Delete)
// ========================================================

function printCustomerProfile(custId) {
  const cust = allCustomersData.find(c => String(c["ID"]).trim() === custId);
  if (!cust) return;

  const statusFilterEl = document.getElementById("reportStatusFilter");
  const currentStatus = statusFilterEl ? statusFilterEl.value : "Active";
  const relevantCollections = statusFilterEl && statusFilterEl.value === "Closed" ? allClosedCollectionsData : allCollectionsData;

  const unitAmount = parseFloat(cust["Loan Loan"] || cust["Loan Amount"]) || 0;
  const rawInterest = String(cust["Interest %"] || cust["Interest Rate"] || "0").replace("%", "").trim();
  const interestPercent = parseFloat(rawInterest) || 0;

  const customerCollections = relevantCollections.filter(col => String(col["Customer ID"]).trim() === custId);
  
  const collectionCount = customerCollections.length;
  const totalAmount = unitAmount * collectionCount;
  const interestAmount = (totalAmount * interestPercent) / 100;
  const gTotalAmount = totalAmount + interestAmount;

  document.getElementById("print-p-name").innerText = cust["Customer Name"] || "N/A";
  document.getElementById("print-p-mobile").innerText = cust["Mobile No"] || "N/A";
  document.getElementById("print-p-dob").innerText = formatDate(cust["DOB"]);
  document.getElementById("print-p-guardian").innerText = cust["Guardian Name"] || "N/A";
  document.getElementById("print-p-aadhar").innerText = cust["Aadhaar No"] || "N/A";
  document.getElementById("print-p-occupation").innerText = cust["Occupation"] || "N/A";
  document.getElementById("print-p-address").innerText = cust["Address"] || "N/A";

  document.getElementById("print-l-type").innerText = cust["Loan Type"] || "N/A";
  document.getElementById("print-l-date").innerText = formatDate(cust["Start Date"]);
  document.getElementById("print-l-amount").innerText = "₹ " + unitAmount;
  document.getElementById("print-l-interest").innerText = interestPercent + "% (₹ " + interestAmount.toFixed(2) + ")";
  document.getElementById("print-l-total").innerText = "₹ " + totalAmount;
  document.getElementById("print-l-gtotal").innerText = "₹ " + gTotalAmount.toFixed(2);

  document.getElementById("print-n-name").innerText = cust["Nominee Name"] || "N/A";
  document.getElementById("print-n-relation").innerText = cust["Relation With Applicant"] || "N/A";
  document.getElementById("print-n-gender").innerText = cust["Nominee Gender"] || "N/A";

  const historyBody = document.getElementById("print-collection-history-body");
  historyBody.innerHTML = "";

  if (customerCollections.length === 0) {
    historyBody.innerHTML = `<tr><td colspan="3" style="border: 1px solid #000; text-align: center; padding: 8px; color: #64748b;">No collection history found.</td></tr>`;
  } else {
    customerCollections.forEach((col, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 12px;">${index + 1}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 12px;">${formatDate(col["Collection Date"])}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 12px; font-weight: bold;">₹ ${col["Amount"] || unitAmount}</td>
      `;
      historyBody.appendChild(tr);
    });
  }

  window.print();
}

function openEditModal(collId) {
  const item = allCollectionsData.find(c => c["Collection ID"] === collId);
  if (!item) return;

  document.getElementById("edit-coll-id").value = item["Collection ID"];
  let rawDate = item["Collection Date"] || "";
  if (rawDate.includes("T")) rawDate = rawDate.split("T")[0];
  document.getElementById("edit-coll-date").value = rawDate;
  document.getElementById("edit-coll-amount").value = item["Amount"];
  document.getElementById("edit-collection-modal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("edit-collection-modal").classList.add("hidden");
}

async function updateCollection() {
  const collId = document.getElementById("edit-coll-id").value;
  const date = document.getElementById("edit-coll-date").value;
  const amount = document.getElementById("edit-coll-amount").value;

  if (!date || !amount) {
    alert("Please fill in all fields!");
    return;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "update_collection", collectionId: collId, collectionDate: date, amount: amount })
    });
    const result = await res.json();
    if (result.status === "success") {
      alert("Collection updated successfully!");
      closeEditModal();
      fetchReportData();
    } else {
      alert("Failed to update collection.");
    }
  } catch (err) {
    console.error(err);
    alert("Error updating collection.");
  }
}

async function deleteCollection(collId) {
  if (!confirm("Are you sure you want to delete this collection record?")) return;

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete_collection", collectionId: collId })
    });
    const result = await res.json();
    if (result.status === "success") {
      alert("Collection deleted successfully!");
      fetchReportData();
    } else {
      alert("Failed to delete collection.");
    }
  } catch (err) {
    console.error(err);
    alert("Error deleting collection.");
  }
}

function exportToExcel() {
  const statusFilterEl = document.getElementById("reportStatusFilter");
  const currentStatus = statusFilterEl ? statusFilterEl.value : "Active";
  const relevantCollections = currentStatus === "Closed" ? allClosedCollectionsData : allCollectionsData;
  
  let exportData = [];
  let sheetName = currentStatus === "Closed" ? "Closed_Report" : "Report";

  if (currentReportType === "collections") {
    exportData = relevantCollections.map(item => ({
      "Customer Name": item["Customer Name"] || "N/A",
      "Loan Type": item["Loan Type"] || "N/A",
      "Collection Date": formatDate(item["Collection Date"]),
      "Amount": item["Amount"] || 0
    }));
    sheetName = currentStatus === "Closed" ? "Closed_Collections" : "Active_Collections";
  } else {
    let dataToExport = allCustomersData.filter(c => (c["Status"] || "Active").trim() === currentStatus);
    if (currentReportType !== "All") {
      dataToExport = dataToExport.filter(c => (c["Loan Type"] || "").trim() === currentReportType.trim());
    }

    exportData = dataToExport.map(cust => {
      const custId = String(cust["ID"] || "").trim();
      const unitAmount = parseFloat(cust["Loan Amount"]) || 0;
      const rawInterest = String(cust["Interest %"] || cust["Interest Rate"] || "0").replace("%", "").trim();
      const interestPercent = parseFloat(rawInterest) || 0;
      
      const collectionCount = relevantCollections.filter(col => String(col["Customer ID"]).trim() === custId).length;
      const totalAmount = unitAmount * collectionCount;
      const interestAmount = (totalAmount * interestPercent) / 100;
      const gTotalAmount = totalAmount + interestAmount;

      return {
        "Customer Name": cust["Customer Name"] || "N/A",
        "DOB": formatDate(cust["DOB"]),
        "Guardian Name": cust["Guardian Name"] || "N/A",
        "Mobile No": cust["Mobile No"] || "N/A",
        "Aadhar Number": cust["Aadhaar No"] || "N/A",
        "Occupation": cust["Occupation"] || "N/A",
        "Address": cust["Address"] || "N/A",
        "Nominee Name": cust["Nominee Name"] || "N/A",
        "Nominee Gender": cust["Nominee Gender"] || "N/A",
        "Relation With Applicant": cust["Relation With Applicant"] || "N/A",
        "RD Amount": unitAmount,
        "Start Date": formatDate(cust["Start Date"]),
        "Total Amount": totalAmount,
        "G.Total Amount": parseFloat(gTotalAmount.toFixed(2)) 
      };
    });
    
    if (currentReportType !== "All") sheetName = `${currentReportType}_${currentStatus}`;
  }

  if (exportData.length === 0) {
    alert("No data available to export!");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  XLSX.writeFile(workbook, `${sheetName}.xlsx`);
}

function printReport() {
  const statusEl = document.getElementById("reportStatusFilter");
  const currentStatus = statusEl ? statusFilterEl.value : "Active";
  
  let reportName = currentReportType === "All" ? "All Customers" : currentReportType;
  if (currentReportType === "collections") {
    reportName = "Collections";
  }

  document.getElementById("print-report-title").innerText = `${reportName} Report (${currentStatus} Loans)`;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  document.getElementById("print-date").innerText = `Print Date: ${dateStr}`;

  window.print();
}