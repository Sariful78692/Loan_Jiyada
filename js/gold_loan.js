document.addEventListener("DOMContentLoaded", function () {
  const goldDate = document.getElementById("goldAppDate");
  if (goldDate) {
    goldDate.value = new Date().toISOString().substring(0, 10);
  }

  // কাস্টম ব্যাংক లోড করা
  loadCustomBanks();

  // ডিফল্টভাবে ব্যাংক সেকশন হাইড/শো করা
  toggleBankDetails();

  const form = document.getElementById("gold-loan-form");
  if (form) {
    form.addEventListener("submit", handleGoldLoanSubmit);
  }
});

// ==========================================
// Bank Details & Disbursement Logic
// ==========================================

function toggleBankDetails() {
  const mode = document.getElementById("goldDisbursementMode").value;
  const bankSection = document.getElementById("bank-details-section");
  if (mode === "Bank") {
    bankSection.classList.remove("hidden");
  } else {
    bankSection.classList.add("hidden");
  }
}

function promptAddNewBank() {
  const newBank = prompt("Enter new Bank Name (e.g. ICICI Bank):");
  if (newBank && newBank.trim() !== "") {
    const cleanBank = newBank.trim();
    const select = document.getElementById("goldBankName");
    const option = document.createElement("option");
    option.value = cleanBank;
    option.textContent = cleanBank;
    select.appendChild(option);
    select.value = cleanBank;

    let customBanks = JSON.parse(localStorage.getItem('customBanks')) || [];
    if (!customBanks.includes(cleanBank)) {
      customBanks.push(cleanBank);
      localStorage.setItem('customBanks', JSON.stringify(customBanks));
    }
  }
}

function loadCustomBanks() {
  let customBanks = JSON.parse(localStorage.getItem('customBanks')) || [];
  const selectList = document.getElementById('goldBankName');
  if (selectList) {
    customBanks.forEach(bank => {
      const exists = Array.from(selectList.options).some(opt => opt.value === bank);
      if (!exists) {
        let option = document.createElement("option");
        option.value = bank;
        option.textContent = bank;
        selectList.appendChild(option);
      }
    });
  }
}

// ==========================================
// Gold Article Table Logic
// ==========================================

function addGoldRow() {
  const tbody = document.getElementById("gold-table-body");
  const rowCount = tbody.getElementsByTagName("tr").length + 1;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="row-sl">${rowCount}</td>
    <td><input type="text" class="gold-input" placeholder="e.g. Chain"></td>
    <td><input type="text" class="gold-input" placeholder="22K"></td>
    <td><input type="text" class="gold-input" value="Ana"></td>
    <td><input type="text" class="gold-input"></td>
    <td><input type="text" class="gold-input" placeholder="₹0.000"></td>
    <td><input type="text" class="gold-input" placeholder="₹0.00"></td>
    <td style="text-align: center;"><button type="button" class="btn-delete" onclick="deleteRow(this)"><i class="fa-solid fa-trash"></i></button></td>
  `;
  tbody.appendChild(tr);
  updateSerialNumbers();
}

function deleteRow(button) {
  const row = button.parentElement.parentElement;
  const tbody = document.getElementById("gold-table-body");
  if (tbody.getElementsByTagName("tr").length > 1) {
    row.remove();
    updateSerialNumbers();
  } else {
    alert("You must have at least one article in the list.");
  }
}

function updateSerialNumbers() {
  const slCells = document.querySelectorAll(".row-sl");
  slCells.forEach((cell, index) => {
    cell.innerText = index + 1;
  });
}

function getGoldArticles() {
  const articles = [];
  const rows = document.querySelectorAll("#gold-table-body tr");
  rows.forEach(row => {
    const inputs = row.querySelectorAll("input");
    articles.push({
      description: inputs[0].value,
      purity: inputs[1].value,
      category: inputs[2].value,
      gram: inputs[3].value,
      grossWt: inputs[4].value,
      netWt: inputs[5].value
    });
  });
  return JSON.stringify(articles);
}

function getChecklists() {
  const checkboxes = document.querySelectorAll(".chk-doc");
  const list = [];
  checkboxes.forEach(cb => {
    if(cb.checked) list.push(cb.value);
  });
  return list.join(", ");
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve(reader.result.split(",")[1]); };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// ==========================================
// Form Submit Logic
// ==========================================

async function handleGoldLoanSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submit-gold-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Processing...";

  // ইমেজ Base64 করা
  const nomineeImgFile = document.getElementById("goldNomineeImage").files[0];
  const goldItemImgFile = document.getElementById("goldItemImage").files[0];
  
  let nomineeImgBase64 = "", nomineeImgName = "", nomineeImgType = "";
  let goldItemImgBase64 = "", goldItemImgName = "", goldItemImgType = "";

  if (nomineeImgFile) {
    nomineeImgName = nomineeImgFile.name;
    nomineeImgType = nomineeImgFile.type;
    nomineeImgBase64 = await convertFileToBase64(nomineeImgFile);
  }
  if (goldItemImgFile) {
    goldItemImgName = goldItemImgFile.name;
    goldItemImgType = goldItemImgFile.type;
    goldItemImgBase64 = await convertFileToBase64(goldItemImgFile);
  }

  // সম্পূর্ণ ডেটা Payload তৈরি
  const payload = {
    action: "create_gold_loan", // এই অ্যাকশনটি গুগল শিটে রিসিভ করতে হবে
    loanType: "Gold Loan",
    
    // Primary Fields
    appNo: document.getElementById("goldAppNo").value,
    appDate: document.getElementById("goldAppDate").value,
    branchName: document.getElementById("goldBranchName").value,
    branchCode: document.getElementById("goldBranchCode").value,
    officerName: document.getElementById("goldOfficerName").value,
    cspLocation: document.getElementById("goldCspLocation").value,
    monthlyIncome: document.getElementById("goldMonthlyIncome").value,
    
    // Image Data
    nomineeImgBase64: nomineeImgBase64, nomineeImgName: nomineeImgName, nomineeImgType: nomineeImgType,
    goldItemImgBase64: goldItemImgBase64, goldItemImgName: goldItemImgName, goldItemImgType: goldItemImgType,
    
    // Articles (JSON String)
    goldArticles: getGoldArticles(),
    
    // Loan Details
    loanAmount: document.getElementById("goldLoanAmount").value,
    loanTenure: document.getElementById("goldLoanTenure").value,
    purpose: document.getElementById("goldPurpose").value,
    scheme: document.getElementById("goldScheme").value,
    interestRate: document.getElementById("goldInterestRate").value,
    emiAmount: document.getElementById("goldEmiAmount").value,
    
    // Bank & Disbursement
    disbursementMode: document.getElementById("goldDisbursementMode").value,
    bankName: document.getElementById("goldBankName").value,
    acHolderName: document.getElementById("goldAcHolderName").value,
    acNumber: document.getElementById("goldAcNumber").value,
    ifscCode: document.getElementById("goldIfscCode").value,
    bankBranch: document.getElementById("goldBankBranch").value,
    
    // Checklists
    submittedDocuments: getChecklists()
  };

  try {
    // API Call to Google Apps Script
    const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();

    if (result.status === "success") {
      alert("Gold Loan Application Submitted Successfully!");
      window.location.href = "CustomerEntry.html"; // আগের পেজে ফিরে যাবে
    } else {
      alert("Error saving data: " + result.message);
    }
  } catch (err) {
    alert("Submission failed. Please check network or Apps Script URL.");
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Submit Application";
  }
}