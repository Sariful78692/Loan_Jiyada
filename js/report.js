document.addEventListener("DOMContentLoaded", async function () {
  populateLoanDropdownFromSidebar();
  await fetchReportData();
});

let allCollectionsData = [];
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
    allCustomersData = (data.customers || []).filter(c => (c["Status"] || "").trim() !== "Disabled");
    allGoldLoansData = data.gold_loans || [];
    
    renderCurrentReport();
  } catch (err) {
    console.error("Failed to load report data", err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red; padding: 20px;">Failed to load report data.</td></tr>`;
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
  if (currentReportType === "collections") {
    renderCollectionsTable(allCollectionsData);
  } else if (currentReportType === "All") {
    renderCustomersTable(allCustomersData);
  } else {
    const filtered = allCustomersData.filter(c => (c["Loan Type"] || "").trim() === currentReportType.trim());
    renderCustomersTable(filtered);
  }
}

// 🟢 সঠিক ডেট ফরম্যাটিং (টাইমজোন সমস্যা ফিক্স করে হুবহু সঠিক তারিখ দেখানোর জন্য)
function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  
  if (typeof dateStr === "string") {
    if (dateStr.includes("T")) {
      dateStr = dateStr.split("T")[0];
    }
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      // যদি YYYY-MM-DD হয় তবে DD-MM-YYYY আকারে রিটার্ন করা
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    }
  }
  return dateStr;
}

// কালেকশন টেবিল রেন্ডার
function renderCollectionsTable(data) {
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">No collection records found.</td></tr>`;
    return;
  }

  data.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding: 10px 15px;">${item["Collection ID"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: 500;">${item["Customer Name"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #0284c7;">${item["Loan Type"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${formatDate(item["Collection Date"])}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #10b981;">₹ ${item["Amount"] || "0"}</td>
      <td style="padding: 10px 15px; text-align: center; white-space: nowrap;">
        <button onclick="openEditModal('${item["Collection ID"]}')" style="background: #eab308; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Edit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="deleteCollection('${item["Collection ID"]}')" style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 🟢 কাস্টমার টেবিল রেন্ডার (সঠিক Start Date, ডাটাবেসের Interest % এবং সঠিক ক্যালকুলেশন সহ)
function renderCustomersTable(data) {
  const headerRow = document.getElementById("table-header-row");
  const tbody = document.getElementById("report-table-body");
  
  headerRow.innerHTML = `
    <th style="padding: 12px;">Start Date</th>
    <th style="padding: 12px;">Name</th>
    <th style="padding: 12px;">Mobile</th>
    <th style="padding: 12px;">Loan Type</th>
    <th style="padding: 12px;">Amount</th>
    <th style="padding: 12px;">Collection Count</th>
    <th style="padding: 12px;">Total Amount</th>
    <th style="padding: 12px;">Interest</th>
    <th style="padding: 12px;">G.Total Amount</th>
  `;

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: #64748b;">No records found.</td></tr>`;
    return;
  }

  data.forEach((cust) => {
    const custId = String(cust["ID"] || "").trim();
    const unitAmount = parseFloat(cust["Loan Amount"]) || 0;
    
    // ডাটাবেসের "Interest %" কলাম থেকে ভ্যালু রিড করা
    const rawInterest = String(cust["Interest %"] || cust["Interest Rate"] || "0").replace("%", "").trim();
    const interestPercent = parseFloat(rawInterest) || 0;

    // কালেকশন কাউন্ট বের করা
    const collectionCount = allCollectionsData.filter(col => String(col["Customer ID"]).trim() === custId).length;

    // Total Amount = Amount * Collection Count
    const totalAmount = unitAmount * collectionCount;

    // Interest Amount calculation based on percentage
    const interestAmount = (totalAmount * interestPercent) / 100;
    
    // G.Total Amount = Total Amount + Interest Amount
    const gTotalAmount = totalAmount + interestAmount;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding: 10px 15px; font-weight: 500;">${formatDate(cust["Start Date"])}</td>
      <td style="padding: 10px 15px; font-weight: 500;">${cust["Customer Name"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${cust["Mobile No"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #0284c7;">${cust["Loan Type"] || "N/A"}</td>
      <td style="padding: 10px 15px;">₹ ${unitAmount}</td>
      <td style="padding: 10px 15px; text-align: center; font-weight: bold; color: #7c3aed;">${collectionCount}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #2563eb;">₹ ${totalAmount}</td>
      <td style="padding: 10px 15px;">${interestPercent}% (₹ ${interestAmount.toFixed(2)})</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #10b981;">₹ ${gTotalAmount.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// পপআপ এবং এডিট/ডিলিট হ্যান্ডলার
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

// এক্সেল এক্সপোর্ট
function exportToExcel() {
  let exportData = [];
  let sheetName = "Report";

  if (currentReportType === "collections") {
    exportData = allCollectionsData.map(item => ({
      "Collection ID": item["Collection ID"] || "",
      "Customer Name": item["Customer Name"] || "",
      "Loan Type": item["Loan Type"] || "",
      "Collection Date": formatDate(item["Collection Date"]),
      "Amount": item["Amount"] || ""
    }));
    sheetName = "Collections";
  } else {
    const dataToExport = currentReportType === "All" ? allCustomersData : allCustomersData.filter(c => (c["Loan Type"] || "").trim() === currentReportType.trim());
    exportData = dataToExport.map(cust => {
      const custId = String(cust["ID"] || "").trim();
      const unitAmount = parseFloat(cust["Loan Amount"]) || 0;
      const rawInterest = String(cust["Interest %"] || cust["Interest Rate"] || "0").replace("%", "").trim();
      const interestPercent = parseFloat(rawInterest) || 0;
      const collectionCount = allCollectionsData.filter(col => String(col["Customer ID"]).trim() === custId).length;
      const totalAmount = unitAmount * collectionCount;
      const interestAmount = (totalAmount * interestPercent) / 100;
      const gTotalAmount = totalAmount + interestAmount;

      return {
        "Start Date": formatDate(cust["Start Date"]),
        "Customer Name": cust["Customer Name"] || "",
        "Mobile No": cust["Mobile No"] || "",
        "Loan Type": cust["Loan Type"] || "",
        "Amount": unitAmount,
        "Collection Count": collectionCount,
        "Total Amount": totalAmount,
        "Interest %": interestPercent + "%",
        "Interest Amount": interestAmount,
        "G.Total Amount": gTotalAmount
      };
    });
    sheetName = currentReportType;
  }

  if (exportData.length === 0) {
    alert("No data available to export!");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  XLSX.writeFile(workbook, `${sheetName}_Report.xlsx`);
}

function printReport() {
  window.print();
}