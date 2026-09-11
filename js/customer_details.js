let customersData = []; 
let allCollectionsData = []; 
let currentLoanFilter = "";
let selectedCustomerId = null;
let selectedCustomerName = null;
let selectedLoanType = null;
let selectedAmount = null;

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
      <th style="padding: 15px; font-weight: bold;">Name</th>
      <th style="padding: 15px; font-weight: bold;">Mobile No</th>
      <th style="padding: 15px; font-weight: bold;">Address</th>
      <th style="padding: 15px; font-weight: bold;">Loan Type</th>
      <th style="padding: 15px; font-weight: bold;">Occupation</th>
      <th style="padding: 15px; font-weight: bold; text-align: center;">Actions</th>
    </tr>
  `;

  if (data.length === 0) {
    tbody.innerHTML += `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444; font-size: 18px; font-weight: bold; background: #fef2f2;">
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
    } else {
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
        <button onclick="closeCustomerLoan('${custId}')" style="background: #64748b; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer;" title="Close Loan & Archive">
          <i class="fa-solid fa-box-archive"></i> Close
        </button>
      `;
    }

    tr.innerHTML = `
      <td style="padding: 10px 15px;">${imgHtml}</td>
      <td style="padding: 10px 15px; font-weight: 500; color: #0f172a;">${cust["Customer Name"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${cust["Mobile No"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${cust["Address"] || "N/A"}</td>
      <td style="padding: 10px 15px; font-weight: bold; color: #0284c7;">${cust["Loan Type"] || "N/A"}</td>
      <td style="padding: 10px 15px;">${cust["Occupation"] || "N/A"}</td>
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