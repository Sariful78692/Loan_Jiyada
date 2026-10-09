document.addEventListener("DOMContentLoaded", async function () {
  populateLoanDropdownFromSidebar();
  const standaloneReportType = window.location.pathname.toLowerCase().endsWith("collectionreport.html")
    ? "collections"
    : (window.location.pathname.toLowerCase().endsWith("goldloanreport.html") ? "goldEmiPayments" : "");
  const reportType = new URLSearchParams(window.location.search).get("type") || standaloneReportType;
  if (reportType && Array.from(document.getElementById("reportFilter").options).some(option => option.value === reportType)) {
    document.getElementById("reportFilter").value = reportType;
    currentReportType = reportType;
  } else {
    currentReportType = "All";
    document.getElementById("reportFilter").value = currentReportType;
  }
  buildReportTypeMenu(currentReportType);
  if (window.location.pathname.toLowerCase().endsWith("collectionreport.html")) {
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    document.getElementById("startDate").value = todayValue;
    document.getElementById("endDate").value = todayValue;
  }
  await fetchReportData();
  if (currentReportType === "goldEmiPayments") changeReportType();
});

function buildReportTypeMenu(selectedType) {
  const menu = document.getElementById("report-type-menu");
  const select = document.getElementById("reportFilter");
  if (!menu || !select) return;

  menu.replaceChildren();
  Array.from(select.options).forEach(option => {
    const value = option.value;
    if (value === "collections" || value === "goldEmiPayments") return;
    const label = ["collections", "emiPayments", "goldEmiPayments", "All"].includes(value)
      ? option.textContent.trim()
      : `${option.textContent.trim()} Report`;
    const isActive = value === selectedType;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `Report.html?type=${encodeURIComponent(value)}`;
    link.textContent = label;
    if (isActive) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    item.appendChild(link);
    menu.appendChild(item);
  });

  const reportItem = menu.closest(".nav-item");
  const toggle = reportItem?.querySelector(":scope > .nav-link");
  reportItem?.classList.add("open");
  toggle?.setAttribute("aria-expanded", "true");
}

let allCollectionsData = [];
let allClosedCollectionsData = []; 
let allCustomersData = [];
let allGoldLoansData = [];
let allGoldEmiPaymentsData = [];
let currentReportType = "collections";
let currentReportPage = 1;

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
    const reportPath = window.location.pathname.toLowerCase();
    const requestedType = new URLSearchParams(window.location.search).get("type") || "";
    const reportView = reportPath.endsWith("collectionreport.html") || requestedType === "collections" || requestedType === "emiPayments"
      ? "collection_report"
      : (reportPath.endsWith("goldloanreport.html") || requestedType === "goldEmiPayments"
        ? "gold_emi_report"
        : "customer_report");
    const data = await fetchAppData(reportView);
    
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
    allGoldEmiPaymentsData = normalizeGoldEmiReportPayments(data.gold_emi_payments || [], data.collections || []);
    
    populateDynamicYears(); // 🟢 ডেটা ফেচ হওয়ার পর ইয়ার ড্রপডাউন আপডেট করা হচ্ছে
    renderCurrentReport();
  } catch (err) {
    console.error("Failed to load report data", err);
    tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; color: red; padding: 20px;">Failed to load report data.</td></tr>`;
  }
}

function normalizeGoldEmiReportPayments(savedPayments, collections) {
  const payments = new Map();
  savedPayments.forEach(payment => {
    const loanId = String(payment["Loan ID"] || "");
    const date = String(payment["Payment Date"] || payment["Paid Date"] || payment["Due Date"] || "").slice(0, 10);
    payments.set(`${loanId}|${date}`, payment);
  });
  collections.filter(item => String(item["Loan Type"] || "").trim().toLowerCase() === "gold loan").forEach(item => {
    const loanId = String(item["Customer ID"] || "");
    const date = String(item["Collection Date"] || "").slice(0, 10);
    const key = `${loanId}|${date}`;
    if (!payments.has(key)) payments.set(key, {
      "Loan ID": loanId, "Receipt ID": item["Collection ID"] || "", "Application No": "",
      "Customer Name": item["Customer Name"] || "", "Mobile No": "", "Installment Number": "",
      "Payment Date": date, "EMI Amount": item.Amount || 0, "Fine Amount": 0, "Total Paid": item.Amount || 0
    });
  });
  return Array.from(payments.values());
}

function changeReportType() {
  currentReportType = document.getElementById("reportFilter").value;
  const heading = document.getElementById("report-heading");
  
  if (currentReportType === "collections") {
    heading.innerText = "Collections Report";
  } else if (currentReportType === "emiPayments") {
    heading.innerText = "EMI Payment Report";
  } else if (currentReportType === "goldEmiPayments") {
    heading.innerText = "Gold Loan EMI Report";
  } else if (currentReportType === "All") {
    heading.innerText = "All Customers Report";
  } else {
    heading.innerText = `${currentReportType} Report`;
  }

  renderCurrentReport();
}

function renderCurrentReport() {
  const loanTypeFilter = document.getElementById("emiLoanTypeFilter");
  if (loanTypeFilter) loanTypeFilter.style.display = currentReportType === "goldEmiPayments" ? "none" : "";
  if (currentReportType === "goldEmiPayments") {
    renderGoldEmiPaymentsTable();
    return;
  }
  const statusFilterEl = document.getElementById("reportStatusFilter");
  const currentStatus = statusFilterEl ? statusFilterEl.value : "Active";

  if (currentReportType === "collections" || currentReportType === "emiPayments") {
    if (currentReportType === "collections" && currentStatus === "Closed" && window.location.pathname.toLowerCase().endsWith("collectionreport.html")) {
      renderClosedCustomersTable();
      return;
    }
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

function renderClosedCustomersTable() {
  const header = document.getElementById("table-header-row");
  const body = document.getElementById("report-table-body");
  const search = (document.getElementById("reportSearchInput")?.value || "").trim().toLowerCase();
  const customers = allCustomersData.filter(customer => {
    if (String(customer["Status"] || "").trim().toLowerCase() !== "closed") return false;
    return !search || [customer.ID, customer["Customer Name"], customer["Mobile No"], customer["Loan Type"]]
      .some(value => String(value || "").toLowerCase().includes(search));
  });
  const pageSizeSelect = document.getElementById("reportPageSize");
  const pageSize = pageSizeSelect?.value === "all" ? Math.max(customers.length, 1) : Number(pageSizeSelect?.value || 20);
  const pageCount = Math.max(1, Math.ceil(customers.length / pageSize));
  currentReportPage = Math.min(Math.max(currentReportPage, 1), pageCount);
  const firstIndex = (currentReportPage - 1) * pageSize;
  const pageCustomers = customers.slice(firstIndex, firstIndex + pageSize);

  header.innerHTML = "<th>Customer ID</th><th>Customer Name</th><th>Mobile No</th><th>Loan Type</th><th>Start Date</th><th>Closed Date</th><th class=\"no-print\">Action</th>";
  body.innerHTML = "";
  if (!customers.length) {
    body.innerHTML = '<tr><td colspan="7" style="padding:20px;text-align:center;color:#64748b">No closed customers found.</td></tr>';
  } else {
    pageCustomers.forEach(customer => {
      const id = String(customer.ID || customer["Customer ID"] || "").trim();
      const row = document.createElement("tr");
      [id || "N/A", customer["Customer Name"] || "N/A", customer["Mobile No"] || "N/A", customer["Loan Type"] || "N/A", formatDate(customer["Start Date"]), formatDate(customer["Archive Date"] || customer["Closed Date"])].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        cell.style.padding = "10px 12px";
        if (value === id) {
          cell.style.whiteSpace = "normal";
          cell.style.overflowWrap = "anywhere";
          cell.style.maxWidth = "150px";
          cell.style.fontFamily = "monospace";
        }
        row.appendChild(cell);
      });
      const actionCell = document.createElement("td");
      actionCell.className = "no-print";
      actionCell.style.textAlign = "center";
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.innerHTML = '<i class="fa-solid fa-eye"></i> View';
      Object.assign(viewButton.style, { background: "#0284c7", color: "#fff", border: "0", borderRadius: "5px", padding: "7px 12px", cursor: "pointer" });
      viewButton.addEventListener("click", () => viewClosedCustomerDetails(id));
      actionCell.appendChild(viewButton);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
  }

  const info = document.getElementById("reportPageInfo");
  if (info) info.textContent = `Showing ${customers.length ? firstIndex + 1 : 0}–${Math.min(firstIndex + pageCustomers.length, customers.length)} of ${customers.length}`;
  const prev = document.getElementById("reportPrevPage");
  const next = document.getElementById("reportNextPage");
  if (prev) prev.disabled = pageSizeSelect?.value === "all" || currentReportPage <= 1;
  if (next) next.disabled = pageSizeSelect?.value === "all" || currentReportPage >= pageCount;
  const totalLabel = document.getElementById("totalLabelDisplay");
  const totalDisplay = document.getElementById("totalAmountDisplay");
  if (totalLabel) totalLabel.textContent = "Closed Customers";
  if (totalDisplay) totalDisplay.textContent = String(customers.length);
}

function getCustomerPhotoDisplayUrls(photoUrl) {
  const url = String(photoUrl || "").trim();
  const fileIdMatch = url.match(/[?&]id=([^&]+)/i) || url.match(/\/d\/([^/?]+)/i);
  if (!fileIdMatch) return [url];
  let fileId = fileIdMatch[1];
  try { fileId = decodeURIComponent(fileId); } catch (_) {}
  const encodedId = encodeURIComponent(fileId);
  return [
    `https://drive.google.com/uc?export=view&id=${encodedId}`,
    `https://drive.google.com/thumbnail?id=${encodedId}&sz=w600`,
    `https://lh3.googleusercontent.com/d/${encodedId}=w600`,
    url
  ].filter((candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index);
}

function viewClosedCustomerDetails(customerId) {
  const customer = allCustomersData.find(item => String(item.ID || item["Customer ID"] || "").trim() === String(customerId).trim());
  if (!customer) return;

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `Customer details for ${customer["Customer Name"] || customerId}`);
  overlay.dataset.closedCustomerDialog = "true";
  Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "10000", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(15,23,42,.65)" });

  const panel = document.createElement("section");
  Object.assign(panel.style, { width: "min(900px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: "12px", padding: "22px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" });
  const heading = document.createElement("div");
  Object.assign(heading.style, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px" });
  const title = document.createElement("h2");
  title.textContent = customer["Customer Name"] || "Customer Details";
  title.style.margin = "0";
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", gap: "8px" });
  const printButton = document.createElement("button");
  printButton.type = "button";
  printButton.textContent = "Print";
  Object.assign(printButton.style, { border: "0", borderRadius: "5px", padding: "8px 13px", background: "#0284c7", color: "#fff", cursor: "pointer" });
  printButton.addEventListener("click", () => printClosedCustomerDetails(overlay));
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  Object.assign(close.style, { border: "0", borderRadius: "5px", padding: "8px 13px", background: "#64748b", color: "#fff", cursor: "pointer" });
  close.addEventListener("click", () => overlay.remove());
  actions.append(printButton, close);
  heading.append(title, actions);
  panel.appendChild(heading);

  const history = allClosedCollectionsData.filter(item => String(item["Customer ID"] || "").trim() === String(customerId).trim());
  const totalCollected = history.reduce((sum, item) => sum + (Number(String(item.Amount || 0).replace(/[^0-9.-]/g, "")) || 0), 0);
  const totalBox = document.createElement("div");
  totalBox.textContent = `Total Amount Collected: INR ${totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  Object.assign(totalBox.style, { marginBottom: "14px", padding: "12px 14px", borderRadius: "7px", background: "#ecfdf5", color: "#047857", fontWeight: "700" });
  panel.appendChild(totalBox);

  const details = document.createElement("div");
  Object.assign(details.style, { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px" });
  Object.entries(customer).forEach(([label, rawValue]) => {
    if (rawValue === "" || rawValue == null) return;
    const item = document.createElement("div");
    Object.assign(item.style, { padding: "10px", border: "1px solid #e2e8f0", borderRadius: "6px", overflowWrap: "anywhere" });
    const name = document.createElement("strong");
    name.textContent = `${label}: `;
    const rawText = rawValue instanceof Date ? formatDate(rawValue) : String(rawValue);
    if (/(photo|image)/i.test(label) && /^https?:\/\//i.test(rawText)) {
      const photo = document.createElement("img");
      const photoUrls = getCustomerPhotoDisplayUrls(rawText);
      let photoUrlIndex = 0;
      photo.src = photoUrls[photoUrlIndex];
      photo.alt = `${customer["Customer Name"] || "Customer"} photo`;
      Object.assign(photo.style, { display: "block", maxWidth: "180px", maxHeight: "180px", marginTop: "8px", borderRadius: "8px", objectFit: "cover" });
      photo.onerror = () => {
        if (photoUrlIndex + 1 < photoUrls.length) {
          photoUrlIndex += 1;
          photo.src = photoUrls[photoUrlIndex];
          return;
        }
        const link = document.createElement("a");
        link.href = rawText;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Open customer photo";
        photo.replaceWith(link);
      };
      name.textContent = "Photo: ";
      item.append(name, photo);
    } else {
      const value = document.createElement("span");
      value.textContent = formatDate(rawText);
      item.append(name, value);
    }
    details.appendChild(item);
  });
  panel.appendChild(details);

  const historyTitle = document.createElement("h3");
  historyTitle.textContent = "Closed Collection History";
  historyTitle.style.margin = "22px 0 8px";
  panel.appendChild(historyTitle);
  if (history.length) {
    const historyTable = document.createElement("table");
    Object.assign(historyTable.style, { width: "100%", borderCollapse: "collapse", marginTop: "8px" });
    const historyHead = document.createElement("thead");
    historyHead.innerHTML = "<tr><th style=\"padding:9px;border:1px solid #cbd5e1;text-align:left\">Collection ID</th><th style=\"padding:9px;border:1px solid #cbd5e1;text-align:left\">Collection Date</th><th style=\"padding:9px;border:1px solid #cbd5e1;text-align:right\">Amount</th></tr>";
    const historyBody = document.createElement("tbody");
    history.forEach(item => {
      const row = document.createElement("tr");
      const amount = Number(String(item.Amount || 0).replace(/[^0-9.-]/g, "")) || 0;
      [item["Collection ID"] || "—", formatDate(item["Collection Date"]), `INR ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`].forEach((text, index) => {
        const cell = document.createElement("td");
        cell.textContent = text;
        Object.assign(cell.style, { padding: "9px", border: "1px solid #cbd5e1", textAlign: index === 2 ? "right" : "left" });
        row.appendChild(cell);
      });
      historyBody.appendChild(row);
    });
    historyTable.append(historyHead, historyBody);
    panel.appendChild(historyTable);
  } else {
    const historyText = document.createElement("p");
    historyText.textContent = "No closed collection history found.";
    panel.appendChild(historyText);
  }

  overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
  overlay.addEventListener("keydown", event => { if (event.key === "Escape") overlay.remove(); });
  overlay.tabIndex = -1;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  close.focus();
}

function printClosedCustomerDetails(overlay) {
  const printStyle = document.createElement("style");
  printStyle.dataset.closedCustomerPrint = "true";
  printStyle.textContent = `@media print {
    @page { margin: 12mm; }
    body * { visibility: hidden !important; }
    [data-closed-customer-dialog], [data-closed-customer-dialog] * { visibility: visible !important; }
    [data-closed-customer-dialog] { position: absolute !important; inset: 0 !important; display: block !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
    [data-closed-customer-dialog] section { width: 100% !important; max-width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; }
    [data-closed-customer-dialog] button { display: none !important; }
    [data-closed-customer-dialog] img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }`;
  document.head.appendChild(printStyle);
  const cleanup = () => printStyle.remove();
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
}

function renderGoldEmiPaymentsTable() {
  const header = document.getElementById("table-header-row");
  const body = document.getElementById("report-table-body");
  const selectedStatus = String(document.getElementById("reportStatusFilter")?.value || "Active").trim().toLowerCase();
  const loanStatusById = new Map((allGoldLoansData || []).map(loan => [
    String(loan.ID || loan["Loan ID"] || "").trim(),
    String(loan.Status || "Active").trim().toLowerCase() === "closed" ? "closed" : "active"
  ]));
  const visiblePayments = allGoldEmiPaymentsData.filter(payment => {
    const loanId = String(payment["Loan ID"] || "").trim();
    return (loanStatusById.get(loanId) || "active") === selectedStatus;
  });
  header.innerHTML = `<th>Receipt ID</th><th>Application No</th><th>Customer Name</th><th>Mobile No</th><th>Installment No.</th><th>Due Date</th><th>Payment Date</th><th>EMI Amount</th><th>Fine Amount</th><th>Total Paid</th>`;
  if (!visiblePayments.length) {
    body.innerHTML = `<tr><td colspan="10" style="padding:20px;text-align:center;color:#64748b">No ${selectedStatus} Gold Loan EMI payments found.</td></tr>`;
    filterTableAndCalculateTotal();
    return;
  }
  body.innerHTML = visiblePayments.map(payment => `<tr><td>${payment["Receipt ID"] || payment["Payment ID"] || "—"}</td><td>${payment["Application No"] || "—"}</td><td>${payment["Customer Name"] || "—"}</td><td>${payment["Mobile No"] || "—"}</td><td>${payment["Installment Number"] || "—"}</td><td>${formatDate(payment["Due Date"])}</td><td>${formatDate(payment["Payment Date"] || payment["Paid Date"])}</td><td>₹ ${Number(payment["EMI Amount"] || payment.Amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>₹ ${Number(payment["Fine Amount"] || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>₹ ${Number(payment["Total Paid"] || payment.Amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join("");
  filterTableAndCalculateTotal();
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

function getLoanSchedule(startValue, durationDays) {
  if (!startValue || !durationDays) {
    return { startDate: "N/A", endDate: "N/A", dueDay: "N/A", dueDays: null };
  }

  const rawDate = String(startValue).split("T")[0];
  const parts = rawDate.split("-");
  const start = parts.length === 3 && parts[0].length === 4
    ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    : parts.length === 3 && parts[2].length === 4
      ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
      : new Date(rawDate);

  if (Number.isNaN(start.getTime())) {
    return { startDate: formatDate(startValue), endDate: "N/A", dueDay: "N/A", dueDays: null };
  }

  const end = new Date(start);
  // Start date counts as the first installment day.
  end.setDate(end.getDate() + durationDays - 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startAtMidnight = new Date(start);
  startAtMidnight.setHours(0, 0, 0, 0);
  const elapsedDays = Math.floor((today - startAtMidnight) / 86400000) + 1;
  const dueDay = Math.max(0, durationDays - Math.max(0, elapsedDays));

  return {
    startDate: formatDate(startValue),
    endDate: end.toLocaleDateString("en-GB").replaceAll("/", "-"),
    dueDay: `${dueDay} Days`,
    dueDays: dueDay
  };
}

// ========================================================
// 🟢 টেবিল রেন্ডারিং সেকশন 
// ========================================================

function renderCollectionsTable(data, status) {
  const headerRow = document.getElementById("table-header-row");
  const tbody = document.getElementById("report-table-body");
  const loanTypeFilter = document.getElementById("emiLoanTypeFilter")?.value || "All";
  const isEmiPaymentReport = currentReportType === "emiPayments";
  const searchText = (document.getElementById("reportSearchInput")?.value || "").trim().toLowerCase();
  const filterYear = document.getElementById("reportYearFilter")?.value || "All";
  const startValue = document.getElementById("startDate")?.value || "";
  const endValue = document.getElementById("endDate")?.value || "";
  const startDate = startValue ? new Date(`${startValue}T00:00:00`) : null;
  const endDate = endValue ? new Date(`${endValue}T23:59:59`) : null;
  const filteredCollections = data.filter(item => {
    const loanType = String(item["Loan Type"] || "").trim();
    if (isEmiPaymentReport && loanType.toLowerCase() === "rd loan") return false;
    if (!isEmiPaymentReport && loanTypeFilter !== "All" && loanType !== loanTypeFilter) return false;
    const collectionDate = String(item["Collection Date"] || "").split("T")[0];
    const dateParts = collectionDate.split("-");
    const date = dateParts.length === 3
      ? (dateParts[0].length === 4 ? new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])) : new Date(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0])))
      : null;
    if (filterYear !== "All" && (!date || String(date.getFullYear()) !== filterYear)) return false;
    if (startDate && (!date || date < startDate)) return false;
    if (endDate && (!date || date > endDate)) return false;
    return !searchText || [item["Collection ID"], item["Customer ID"], item["Customer Name"], item["Loan Type"], item["Amount"], formatDate(item["Collection Date"])].some(value => String(value || "").toLowerCase().includes(searchText));
  });
  const pageSizeSelect = document.getElementById("reportPageSize");
  const pageSize = pageSizeSelect?.value === "all" ? Math.max(filteredCollections.length, 1) : Number(pageSizeSelect?.value || 50);
  const pageCount = Math.max(1, Math.ceil(filteredCollections.length / pageSize));
  currentReportPage = Math.min(Math.max(1, currentReportPage), pageCount);
  const firstIndex = (currentReportPage - 1) * pageSize;
  const pageCollections = filteredCollections.slice(firstIndex, firstIndex + pageSize);
  const customersById = new Map(allCustomersData.map(customer => [String(customer["ID"] || "").trim(), customer]));
  
  headerRow.innerHTML = `
    <th style="padding: 12px; white-space: nowrap;">SL No</th>
    <th style="padding: 12px;">Collection ID</th>
    <th style="padding: 12px; white-space: nowrap;">Customer ID</th>
    <th style="padding: 12px;">Customer Name</th>
    <th style="padding: 12px;">Loan Type</th>
    <th style="padding: 12px; white-space: nowrap;">Start Date</th>
    <th style="padding: 12px; white-space: nowrap;">End Date</th>
    <th style="padding: 12px;">Collection Date</th>
    <th style="padding: 12px;">Amount</th>
    ${status === "Closed" ? '<th style="padding: 12px;">Archive Date</th>' : ''}
    <th class="no-print" style="padding: 12px; text-align: center;">Actions</th>
  `;

  tbody.innerHTML = "";
  if (filteredCollections.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${status === "Closed" ? 11 : 10}" style="text-align: center; padding: 20px; color: #64748b;">No ${status.toLowerCase()} collection records found.</td></tr>`;
  }

  const fragment = document.createDocumentFragment();
  pageCollections.forEach((item, index) => {
    const customerId = String(item["Customer ID"] || "").trim();
    const customer = customersById.get(customerId);
    const duration = Number(customer && (customer["Duration (Days)"] || customer["Duration Days"] || customer["Duration"])) || 365;
    const loanSchedule = customer ? getLoanSchedule(customer["Start Date"], duration) : { startDate: "N/A", endDate: "N/A" };
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
      <td style="padding: 10px 15px; white-space: nowrap;">${firstIndex + index + 1}</td>
      <td style="padding: 10px 15px;">${item["Collection ID"] || "N/A"}</td>
      <td style="padding: 10px 15px; white-space: nowrap;">${customerId || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: 500;">${item["Customer Name"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #0284c7;">${String(item["Loan Type"] || "N/A").trim().toLowerCase() === "rd loan" ? "RD" : (item["Loan Type"] || "N/A")}</td>
      <td style="padding: 10px 15px; white-space: nowrap;">${loanSchedule.startDate}</td>
      <td style="padding: 10px 15px; white-space: nowrap;">${loanSchedule.endDate}</td>
      <td style="padding: 10px 15px;">${formatDate(item["Collection Date"])}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #10b981;">₹ ${item["Amount"] || "0"}</td>
      ${status === "Closed" ? `<td style="padding: 10px 15px;">${formatDate(item["Archive Date"])}</td>` : ''}
      <td class="no-print" style="padding: 10px 15px; text-align: center; white-space: nowrap;">${actionHtml}</td>
    `;
    fragment.appendChild(tr);
  });
  if (pageCollections.length) tbody.appendChild(fragment);
  const total = filteredCollections.reduce((sum, item) => sum + (Number(String(item["Amount"] || 0).replace(/[^0-9.-]/g, "")) || 0), 0);
  const totalLabel = document.getElementById("totalLabelDisplay");
  const totalDisplay = document.getElementById("totalAmountDisplay");
  if (totalLabel) totalLabel.textContent = isEmiPaymentReport ? "Total EMI Payment" : "Total Collection";
  if (totalDisplay) totalDisplay.textContent = "₹ " + total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pageInfo = document.getElementById("reportPageInfo");
  if (pageInfo) pageInfo.textContent = `Showing ${filteredCollections.length ? firstIndex + 1 : 0}–${Math.min(firstIndex + pageCollections.length, filteredCollections.length)} of ${filteredCollections.length}`;
  const prevButton = document.getElementById("reportPrevPage");
  const nextButton = document.getElementById("reportNextPage");
  if (prevButton) prevButton.disabled = pageSizeSelect?.value === "all" || currentReportPage <= 1;
  if (nextButton) nextButton.disabled = pageSizeSelect?.value === "all" || currentReportPage >= pageCount;
}

function renderCustomersTable(data, status) {
  const headerRow = document.getElementById("table-header-row");
  const tbody = document.getElementById("report-table-body");
  
  headerRow.innerHTML = `
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Customer ID</th>
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
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">End Date</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Due Day</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">Total Amount</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap;">G.Total</th>
    <th style="padding: 10px; font-size: 12px; white-space: nowrap; color: #d97706;">Maturity Amount</th>
    <th class="no-print" style="padding: 10px; font-size: 12px; text-align: center;">Action</th>
  `;

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="19" style="text-align: center; padding: 20px; color: #64748b;">No records found.</td></tr>`;
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

    const loanSchedule = getLoanSchedule(cust["Start Date"], duration);

    const maturityPrincipal = unitAmount * duration;
    const maturityInterest = (maturityPrincipal * interestPercent) / 100;
    const maturityAmount = maturityPrincipal + maturityInterest;

    const relationVal = cust["Relation With Applicant"] || cust["Relation"] || cust["Relation with Applicant"] || "N/A";
    const isRdLoan = String(cust["Loan Type"] || "").trim().toLowerCase() === "rd loan";
    const rdCloseButton = isRdLoan && loanSchedule.dueDays === 0 && status !== "Closed"
      ? `
          <button onclick="closeCustomerLoan('${custId}')" style="background: #dc2626; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;" title="Close RD">
            <i class="fa-solid fa-lock"></i> RD Close
          </button>
        `
      : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding: 8px 10px; font-size: 12px; white-space: nowrap;">${custId || "N/A"}</td>
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
      <td style="padding: 8px 10px; font-size: 12px;" class="date-column">${loanSchedule.startDate}</td>
      <td style="padding: 8px 10px; font-size: 12px; white-space: nowrap;">${loanSchedule.endDate}</td>
      <td style="padding: 8px 10px; font-size: 12px; white-space: nowrap;">${loanSchedule.dueDay}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #2563eb;">₹ ${totalAmount}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #10b981;">₹ ${gTotalAmount.toFixed(2)}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #d97706;">₹ ${maturityAmount.toFixed(2)}</td>
      <td class="no-print" style="padding: 8px 10px; text-align: center;">
        <button onclick="printCustomerProfile('${custId}')" style="background: #0284c7; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Print Customer Form">
          <i class="fa-solid fa-print"></i>
        </button>
        ${rdCloseButton}
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
  currentReportPage = 1;
  if (currentReportType === "collections" || currentReportType === "emiPayments") renderCurrentReport();
  else filterTableAndCalculateTotal();
}

function changeReportPageSize() {
  currentReportPage = 1;
  renderCurrentReport();
}

function changeReportPage(offset) {
  currentReportPage += offset;
  renderCurrentReport();
}

function filterTableAndCalculateTotal() {
  if (currentReportType === "collections" || currentReportType === "emiPayments") {
    currentReportPage = 1;
    renderCurrentReport();
    return;
  }
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
  const matchingRows = [];
  const isGoldEmiReport = currentReportType === "goldEmiPayments";
  const isCollectionReport = (currentReportType === "collections" || currentReportType === "emiPayments" || isGoldEmiReport);
  const dateColIndex = isGoldEmiReport ? 6 : isCollectionReport ? 6 : 12;
  const amountColIndex = isGoldEmiReport ? 9 : isCollectionReport ? 7 : 16;

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
      matchingRows.push(row);
      
      const amtText = cells[amountColIndex].innerText.replace(/[^0-9.-]+/g, "");
      const numericAmount = parseFloat(amtText);
      
      if (!isNaN(numericAmount)) {
        totalCollection += numericAmount;
      }
    } else {
      row.style.display = "none"; 
    }
  }

  const pageSizeSelect = document.getElementById("reportPageSize");
  const pageSize = pageSizeSelect && pageSizeSelect.value === "all" ? matchingRows.length || 1 : Number(pageSizeSelect?.value || 50);
  const pageCount = Math.max(1, Math.ceil(matchingRows.length / pageSize));
  currentReportPage = Math.min(Math.max(1, currentReportPage), pageCount);
  const firstIndex = (currentReportPage - 1) * pageSize;
  matchingRows.forEach((row, index) => {
    row.style.display = (pageSizeSelect?.value === "all" || (index >= firstIndex && index < firstIndex + pageSize)) ? "" : "none";
  });
  const pageInfo = document.getElementById("reportPageInfo");
  if (pageInfo) {
    const shownStart = matchingRows.length ? firstIndex + 1 : 0;
    const shownEnd = pageSizeSelect?.value === "all" ? matchingRows.length : Math.min(firstIndex + pageSize, matchingRows.length);
    pageInfo.textContent = `Showing ${shownStart}–${shownEnd} of ${matchingRows.length}`;
  }
  const prevButton = document.getElementById("reportPrevPage");
  const nextButton = document.getElementById("reportNextPage");
  if (prevButton) prevButton.disabled = pageSizeSelect?.value === "all" || currentReportPage <= 1;
  if (nextButton) nextButton.disabled = pageSizeSelect?.value === "all" || currentReportPage >= pageCount;

  const totalLabel = document.getElementById("totalLabelDisplay");
  if (totalLabel) {
    if (currentReportType === "collections") {
      totalLabel.innerText = "Total Collection";
    } else if (currentReportType === "emiPayments") {
      totalLabel.innerText = "Total EMI Payment";
    } else if (currentReportType === "goldEmiPayments") {
      totalLabel.innerText = "Total Gold Loan EMI Paid";
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
  if (window.location.pathname.toLowerCase().endsWith("collectionreport.html")) {
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (document.getElementById("startDate")) document.getElementById("startDate").value = todayValue;
    if (document.getElementById("endDate")) document.getElementById("endDate").value = todayValue;
  } else {
    if(document.getElementById("startDate")) document.getElementById("startDate").value = "";
    if(document.getElementById("endDate")) document.getElementById("endDate").value = "";
  }
  if(document.getElementById("reportSearchInput")) document.getElementById("reportSearchInput").value = "";
  if(document.getElementById("reportYearFilter")) document.getElementById("reportYearFilter").value = "All";
  currentReportPage = 1;
  filterTableAndCalculateTotal(); 
}

// ========================================================
// 🟢 Print & Excel Export 
// ========================================================

function printReport() {
  const heading = document.getElementById("report-heading");
  const printTitle = document.getElementById("print-report-title");
  const printDate = document.getElementById("print-date");
  if (printTitle) printTitle.innerText = heading ? heading.innerText : "Report";
  if (printDate) printDate.innerText = "Printed: " + new Date().toLocaleString("en-IN");
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
// Collection edit / delete actions
// ========================================================

function toInputDate(value) {
  const rawDate = String(value || "").trim();
  if (!rawDate) return "";
  if (rawDate.includes("T")) return rawDate.split("T")[0];
  const parts = rawDate.split("-");
  if (parts.length === 3 && parts[0].length !== 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return rawDate;
}

function findCollection(collectionId) {
  return allCollectionsData.find(item => String(item["Collection ID"] || "").trim() === String(collectionId || "").trim());
}

function openEditModal(collectionId) {
  const collection = findCollection(collectionId);
  if (!collection) {
    alert("Collection record not found. Please refresh the report and try again.");
    return;
  }

  document.getElementById("edit-coll-id").value = collection["Collection ID"];
  document.getElementById("edit-coll-date").value = toInputDate(collection["Collection Date"]);
  document.getElementById("edit-coll-amount").value = collection["Amount"] || "";
  document.getElementById("edit-collection-modal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("edit-collection-modal").classList.add("hidden");
}

async function updateCollection() {
  const collectionId = document.getElementById("edit-coll-id").value.trim();
  const collectionDate = document.getElementById("edit-coll-date").value;
  const amount = document.getElementById("edit-coll-amount").value.trim();
  if (!collectionId || !collectionDate || amount === "" || Number(amount) < 0) {
    alert("Please enter a valid collection date and amount.");
    return;
  }

  try {
    const res = await postAppData({ action: "update_collection", collectionId, id: collectionId, collectionDate, date: collectionDate, amount });
    const result = await res.json();
    if (result.status !== "success") throw new Error(result.message || "Update failed");
    closeEditModal();
    await fetchReportData();
    alert("Collection updated successfully.");
  } catch (err) {
    console.error("Collection update failed", err);
    alert("Could not update the collection: " + err.message);
  }
}

async function deleteCollection(collectionId) {
  const collection = findCollection(collectionId);
  if (!collection) {
    alert("Collection record not found. Please refresh the report and try again.");
    return;
  }
  if (!confirm(`Delete the collection for ${collection["Customer Name"] || "this customer"} on ${formatDate(collection["Collection Date"])}?`)) return;

  try {
    const res = await postAppData({ action: "delete_collection", collectionId: String(collectionId), id: String(collectionId) });
    const result = await res.json();
    if (result.status !== "success") throw new Error(result.message || "Delete failed");
    await fetchReportData();
    alert("Collection deleted successfully.");
  } catch (err) {
    console.error("Collection deletion failed", err);
    alert("Could not delete the collection: " + err.message);
  }
}

// ========================================================
// 🟢 Customer Profile Print Function (Deep Black & Bordered)
// ========================================================

async function closeCustomerLoan(customerId) {
  if (!confirm("Are you sure you want to close this RD account? Its collection records will be moved to the archive.")) {
    return;
  }

  try {
    const res = await postAppData({ action: "close_loan", customerId });
    const result = await res.json();
    if (result.status !== "success") throw new Error(result.message || "Could not close the loan.");

    // Show the records that were just moved to Closed_Collections.
    currentReportType = "collections";
    document.getElementById("reportFilter").value = "collections";
    document.getElementById("reportStatusFilter").value = "Closed";
    document.getElementById("report-heading").innerText = "Archived Collections Report";
    await fetchReportData();
    const archivedCount = Number(result.archivedCollections || 0);
    alert(archivedCount > 0
      ? `RD closed. ${archivedCount} archived collection record(s) are now shown below.`
      : "RD closed. No collection records were found to move to the archive.");
  } catch (err) {
    console.error("RD close failed", err);
    alert("Could not close the RD: " + err.message);
  }
}

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
          <div class="item"><strong>Loan Type:</strong> ${String(cust["Loan Type"] || "N/A").trim().toLowerCase() === "rd loan" ? "RD" : (cust["Loan Type"] || "N/A")}</div>
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
