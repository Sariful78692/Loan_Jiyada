document.addEventListener("DOMContentLoaded", async function () {
  populateLoanDropdownFromSidebar();
  await fetchReportData();
});

let allCollectionsData = [];
let allClosedCollectionsData = []; 
let allCustomersData = [];
let allGoldLoansData = [];
let currentReportType = "collections";

// 🟢 সাইডবার থেকে লোন টাইপগুলো রিড করে ড্রপডাউনে বসানো
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

// 🟢 ডাইনামিক ইয়ার (Year) ফিল্টার অপশন তৈরি করা
function populateDynamicYears() {
  const yearSelect = document.getElementById("reportYearFilter");
  if (!yearSelect) return;

  // বর্তমান অপশন ক্লিয়ার করে শুধু 'All Years' রাখা হচ্ছে
  yearSelect.innerHTML = '<option value="All">All Years</option>';
  
  let yearsSet = new Set();

  allCustomersData.forEach(cust => {
    let dateStr = cust["Start Date"];
    if (dateStr) {
      if (typeof dateStr === "string" && dateStr.includes("T")) dateStr = dateStr.split("T")[0];
      let year = null;
      if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        year = parts[0].length === 4 ? parts[0] : parts[2]; // yyyy-mm-dd or dd-mm-yyyy চেক
      }
      if (year && year.length === 4) {
        yearsSet.add(year);
      }
    }
  });

  // সালগুলো ছোট থেকে বড় সাজিয়ে ড্রপডাউনে বসানো
  let sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
  sortedYears.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.innerText = year;
    yearSelect.appendChild(option);
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
    
    populateDynamicYears(); // 🟢 ডেটা ফেচ হওয়ার পর ইয়ার ড্রপডাউন আপডেট করা হচ্ছে
    renderCurrentReport();
  } catch (err) {
    console.error("Failed to load report data", err);
    tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; color: red; padding: 20px;">Failed to load report data.</td></tr>`;
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

function renderCollectionsTable(data, status) {
  const headerRow = document.getElementById("table-header-row");
  const tbody = document.getElementById("report-table-body");
  
  headerRow.innerHTML = `
    <th style="padding: 12px;">Collection ID</th>
    <th style="padding: 12px;">Customer Name</th>
    <th style="padding: 12px;">Loan Type</th>
    <th style="padding: 12px;">Collection Date</th>
    <th style="padding: 12px;">Amount</th>
    <th class="no-print" style="padding: 12px; text-align: center;">Actions</th>
  `;

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">No ${status.toLowerCase()} collection records found.</td></tr>`;
    filterTableAndCalculateTotal(); 
    return;
  }

  data.forEach((item) => {
    let actionHtml = '';
    
    if (status === "Closed") {
      actionHtml = `
        <span style="background: #f1f5f9; color: #64748b; padding: 6px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 5px;">
          <i class="fa-solid fa-lock"></i> Archived
        </span>
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
      <td class="no-print" style="padding: 10px 15px; text-align: center; white-space: nowrap;">${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  filterTableAndCalculateTotal(); 
}

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
    <th style="padding: 10px; font-size: 12px; white-space: nowrap; color: #d97706;">Maturity Amount</th>
    <th class="no-print" style="padding: 10px; font-size: 12px; text-align: center;">Action</th>
  `;

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 20px; color: #64748b;">No records found.</td></tr>`;
    filterTableAndCalculateTotal();
    return;
  }

  const relevantCollections = status === "Closed" ? allClosedCollectionsData : allCollectionsData;

  data.forEach((cust) => {
    const custId = String(cust["ID"] || "").trim();
    const unitAmount = parseFloat(cust["Loan Amount"] || cust["RD Amount"] || cust["Amount"]) || 0;
    const rawInterest = String(cust["Interest %"] || cust["Interest Rate"] || "0").replace("%", "").trim();
    const interestPercent = parseFloat(rawInterest) || 0;

    const collectionCount = relevantCollections.filter(col => String(col["Customer ID"]).trim() === custId).length;
    const totalAmount = unitAmount * collectionCount;
    const interestAmount = (totalAmount * interestPercent) / 100;
    const gTotalAmount = totalAmount + interestAmount;

    let duration = parseFloat(cust["Duration (Days)"] || cust["Duration Days"] || cust["Duration"]) || 0;
    if (duration === 0) duration = 365; 

    const maturityPrincipal = unitAmount * duration;
    const maturityInterest = (maturityPrincipal * interestPercent) / 100;
    const maturityAmount = maturityPrincipal + maturityInterest;

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
      <td style="padding: 8px 10px; font-size: 12px;" class="date-column">${formatDate(cust["Start Date"])}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #2563eb;">₹ ${totalAmount}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #10b981;">₹ ${gTotalAmount.toFixed(2)}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #d97706;">₹ ${maturityAmount.toFixed(2)}</td>
      <td class="no-print" style="padding: 8px 10px; text-align: center;">
        <button onclick="printCustomerProfile('${custId}')" style="background: #0284c7; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Print Customer Form">
          <i class="fa-solid fa-print"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  filterTableAndCalculateTotal();
}

// ========================================================
// 🟢 ফিল্টার এবং টোটাল হিসাব
// ========================================================

function filterReport() {
  filterTableAndCalculateTotal();
}

function filterTableAndCalculateTotal() {
  const searchInputEl = document.getElementById("reportSearchInput");
  const yearFilterEl = document.getElementById("reportYearFilter");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");

  const searchText = searchInputEl ? searchInputEl.value.toLowerCase() : "";
  const filterYear = yearFilterEl ? yearFilterEl.value : "All";
  
  const start = (startDateEl && startDateEl.value) ? new Date(startDateEl.value) : null;
  const end = (endDateEl && endDateEl.value) ? new Date(endDateEl.value) : null;

  const tbody = document.getElementById("report-table-body");
  if (!tbody) return;
  const rows = tbody.getElementsByTagName("tr");

  let totalCollection = 0;
  const isCollectionReport = (currentReportType === "collections");
  const dateColIndex = isCollectionReport ? 3 : 11; 
  const amountColIndex = isCollectionReport ? 4 : 13; 

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    if (row.getElementsByTagName("th").length > 0 || row.textContent.includes("No records found") || row.textContent.includes("No active collection")) {
      continue;
    }

    const cells = row.getElementsByTagName("td");
    if (cells.length <= amountColIndex) continue;

    const rowText = row.textContent.toLowerCase();
    const dateText = cells[dateColIndex].innerText.trim();
    
    const matchSearch = rowText.includes(searchText);
    const matchYear = (filterYear === "All" || dateText.includes(filterYear));

    let matchDateRange = true;
    if (start || end) {
      const dateParts = dateText.split('-'); 
      if (dateParts.length === 3) {
        const rowDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        if (start && rowDate < start) matchDateRange = false;
        if (end && rowDate > end) matchDateRange = false;
      } else {
        matchDateRange = false; 
      }
    }

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

  const totalLabel = document.getElementById("totalLabelDisplay");
  if (totalLabel) {
    if (currentReportType === "collections") {
      totalLabel.innerText = "Total Collection";
    } else if (currentReportType === "All") {
      totalLabel.innerText = "All Customers Total Amount";
    } else {
      totalLabel.innerText = `${currentReportType} Total Amount`;
    }
  }

  const totalDisplay = document.getElementById("totalAmountDisplay");
  if (totalDisplay) {
    totalDisplay.innerText = "₹ " + totalCollection.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

function clearFilters() {
  if(document.getElementById("startDate")) document.getElementById("startDate").value = "";
  if(document.getElementById("endDate")) document.getElementById("endDate").value = "";
  if(document.getElementById("reportSearchInput")) document.getElementById("reportSearchInput").value = "";
  if(document.getElementById("reportYearFilter")) document.getElementById("reportYearFilter").value = "All";
  
  filterTableAndCalculateTotal(); 
}

// ========================================================
// 🟢 Print & Excel Export 
// ========================================================

function printReport() {
  window.print();
}

function exportToExcel() {
  const tbody = document.getElementById("report-table-body");
  const rows = tbody.querySelectorAll("tr");
  let exportData = [];

  const headers = Array.from(document.querySelectorAll("#table-header-row th"))
                       .map(th => th.innerText.trim())
                       .filter(text => text.toLowerCase() !== "action" && text.toLowerCase() !== "actions");

  rows.forEach(row => {
      if (row.style.display !== "none" && !row.innerText.includes("No records found") && !row.innerText.includes("No active collection")) {
          const cells = row.querySelectorAll("td");
          let rowData = {};
          
          cells.forEach((cell, index) => {
              if (index < headers.length) {
                  let text = cell.innerText.trim();
                  if (text.startsWith("₹")) {
                      text = parseFloat(text.replace(/[^0-9.-]+/g, ""));
                  }
                  rowData[headers[index]] = text;
              }
          });
          exportData.push(rowData);
      }
  });

  if (exportData.length === 0) {
      alert("No data available to export! Please check your filters.");
      return;
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  const sheetName = currentReportType === "All" ? "All_Data" : currentReportType.replace(/[^a-zA-Z0-9]/g, "_");
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${sheetName}_Report.xlsx`);
}

// ========================================================
// 🟢 Customer Profile Print Function (Deep Black & Bordered)
// ========================================================

function printCustomerProfile(custId) {
  const cust = allCustomersData.find(c => String(c["ID"]).trim() === custId);
  if (!cust) {
      alert("Customer data not found!");
      return;
  }

  const statusFilterEl = document.getElementById("reportStatusFilter");
  const relevantCollections = statusFilterEl && statusFilterEl.value === "Closed" ? allClosedCollectionsData : allCollectionsData;

  const unitAmount = parseFloat(cust["Loan Amount"] || cust["RD Amount"] || cust["Amount"]) || 0;
  const rawInterest = String(cust["Interest %"] || cust["Interest Rate"] || "0").replace("%", "").trim();
  const interestPercent = parseFloat(rawInterest) || 0;

  const customerCollections = relevantCollections.filter(col => String(col["Customer ID"]).trim() === custId);
  
  const collectionCount = customerCollections.length;
  const totalAmount = unitAmount * collectionCount;
  const interestAmount = (totalAmount * interestPercent) / 100;
  const gTotalAmount = totalAmount + interestAmount;

  // Maturity Amount Calculation
  let duration = parseFloat(cust["Duration (Days)"] || cust["Duration Days"] || cust["Duration"]) || 0;
  if (duration === 0) duration = 365; 
  const maturityPrincipal = unitAmount * duration;
  const maturityInterest = (maturityPrincipal * interestPercent) / 100;
  const maturityAmount = maturityPrincipal + maturityInterest;

  let historyRows = "";
  if (customerCollections.length === 0) {
    historyRows = `<tr><td colspan="3" style="border: 1px solid #000; text-align: center; padding: 12px; color: #000;">No collection history found.</td></tr>`;
  } else {
    customerCollections.forEach((col, index) => {
      historyRows += `
        <tr>
          <td style="border: 1px solid #000; padding: 8px; text-align: center; color: #000;">${index + 1}</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center; color: #000;">${formatDate(col["Collection Date"])}</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; color: #000;">₹ ${col["Amount"] || unitAmount}</td>
        </tr>
      `;
    });
  }

  // 🟢 প্রিন্ট পেজের HTML (Deep Black Colors & Borders)
  const printHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Customer Profile - ${cust["Customer Name"]}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #000000; margin: 0; background: #ffffff; }
        .header { text-align: center; padding-bottom: 10px; border-bottom: 2px solid #000000; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; color: #000000; font-weight: bold; }
        .header p { margin: 5px 0 0; font-size: 14px; color: #000000; font-weight: bold; }
        
        .section { margin-bottom: 20px; }
        .section h3 { 
            background: #e2e8f0; 
            padding: 8px 12px; 
            margin: 0 0 0 0; 
            border: 1px solid #000000; 
            border-bottom: none; 
            font-size: 15px; 
            color: #000000; 
            font-weight: bold;
        }
        
        /* Grid with Deep Black Borders */
        .grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            border-top: 1px solid #000000; 
            border-left: 1px solid #000000; 
        }
        .item { 
            font-size: 13px; 
            border-bottom: 1px solid #000000; 
            border-right: 1px solid #000000; 
            padding: 8px 12px; 
            color: #000000;
        }
        .item.full-width { grid-column: span 2; }
        .item strong { display: inline-block; width: 120px; color: #000000; font-weight: bold; }
        
        /* Table Styles */
        table { width: 100%; border-collapse: collapse; margin-top: 0; font-size: 13px; }
        th { background: #e2e8f0; border: 1px solid #000000; padding: 8px; text-align: center; color: #000000; font-weight: bold; }
        td { border: 1px solid #000000; padding: 8px; color: #000000; }
        
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>LOAN MANAGEMENT SYSTEM</h1>
        <p>Customer Detailed Profile & Collection Report</p>
      </div>
      
      <div class="section">
        <h3>Customer Details</h3>
        <div class="grid">
          <div class="item"><strong>Name:</strong> ${cust["Customer Name"] || "N/A"}</div>
          <div class="item"><strong>Mobile No:</strong> ${cust["Mobile No"] || "N/A"}</div>
          <div class="item"><strong>DOB:</strong> ${formatDate(cust["DOB"])}</div>
          <div class="item"><strong>Guardian:</strong> ${cust["Guardian Name"] || "N/A"}</div>
          <div class="item"><strong>Aadhaar No:</strong> ${cust["Aadhaar No"] || "N/A"}</div>
          <div class="item"><strong>Occupation:</strong> ${cust["Occupation"] || "N/A"}</div>
          <div class="item full-width"><strong>Address:</strong> ${cust["Address"] || "N/A"}</div>
        </div>
      </div>

      <div class="section">
        <h3>Loan Details</h3>
        <div class="grid">
          <div class="item"><strong>Loan Type:</strong> ${cust["Loan Type"] || "N/A"}</div>
          <div class="item"><strong>Start Date:</strong> ${formatDate(cust["Start Date"])}</div>
          <div class="item"><strong>RD Amount:</strong> ₹ ${unitAmount}</div>
          <div class="item"><strong>Interest Rate:</strong> ${interestPercent}%</div>
          <div class="item"><strong>Total Collected:</strong> ₹ ${totalAmount}</div>
          <div class="item"><strong>G.Total:</strong> ₹ ${gTotalAmount.toFixed(2)}</div>
          <div class="item full-width"><strong>Maturity Amount:</strong> ₹ ${maturityAmount.toFixed(2)}</div>
        </div>
      </div>

      <div class="section">
        <h3>Nominee Details</h3>
        <div class="grid">
          <div class="item"><strong>Nominee Name:</strong> ${cust["Nominee Name"] || "N/A"}</div>
          <div class="item"><strong>Relation:</strong> ${cust["Relation with Applicant"] || cust["Relation With Applicant"] || cust["Relation"] || "N/A"}</div>
          <div class="item full-width"><strong>Gender:</strong> ${cust["Nominee Gender"] || "N/A"}</div>
        </div>
      </div>

      <div class="section">
        <h3>Collection History</h3>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Collection Date</th>
              <th>Amount Collected</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  let printFrame = document.getElementById('hidden-print-frame');
  if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'hidden-print-frame';
      printFrame.style.position = 'absolute';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(printHTML);
  frameDoc.close();

  setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
  }, 500);
}