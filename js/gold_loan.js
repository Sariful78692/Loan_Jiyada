let goldLoanCalculation = {};
let goldEditId = new URLSearchParams(window.location.search).get("edit");

document.addEventListener("DOMContentLoaded", () => {
  addGoldCustomerFields();
  setupGoldFieldValidation();
  const closeDateCard = document.getElementById("goldMaturityDate").parentElement;
  closeDateCard.querySelector("span").textContent = "EMI Close Date";
  const firstEmiCard = closeDateCard.cloneNode(true);
  firstEmiCard.querySelector("span").textContent = "First EMI Date";
  firstEmiCard.querySelector("strong").id = "goldFirstEmiDate";
  closeDateCard.parentElement.insertBefore(firstEmiCard, closeDateCard);
  if (goldEditId) loadGoldLoanForEdit(goldEditId);
  const today = localDate(new Date());
  document.getElementById("goldAppDate").value = today;
  document.getElementById("goldValuationDate").value = today;
  toggleBankDetails();
  ["goldLtvPercent", "goldLoanAmount", "goldProcessingCharge", "goldDocumentCharge", "goldLoanTenure", "goldInterestRate", "goldRepaymentType", "goldValuationDate", "goldAppDate"].forEach(id => document.getElementById(id).addEventListener("input", calculateGoldLoan));
  ["goldRepaymentType", "goldValuationDate", "goldAppDate"].forEach(id => document.getElementById(id).addEventListener("change", calculateGoldLoan));
  document.getElementById("goldDisbursementMode").addEventListener("change", toggleBankDetails);
  document.getElementById("gold-table-body").addEventListener("input", calculateGoldLoan);
  document.getElementById("gold-loan-form").addEventListener("submit", handleGoldLoanSubmit);
  calculateGoldLoan();
});

function setupGoldFieldValidation() {
  ["goldMobileNo", "goldAadhaarNo", "goldNomineeAadhaar"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, id === "goldMobileNo" ? 10 : 12); });
  });
  const titleCaseIds = new Set(["goldBranchName", "goldOfficerName", "goldCspLocation", "goldCustomerName", "goldAddress", "goldGuardianName", "goldCustomerBankName", "goldCustomerBankBranch", "goldCustomerAccountHolder", "goldAcHolderName", "goldBankBranch", "goldNomineeName", "goldNomineeGuardianName", "goldNomineeOccupation", "goldPurpose", "goldScheme"]);
  document.getElementById("gold-loan-form").addEventListener("focusout", event => {
    const input = event.target;
    if (titleCaseIds.has(input.id) || input.matches(".gold-description")) {
      input.value = input.value.trim().toLocaleLowerCase().replace(/(^|\s)[\p{L}]/gu, letter => letter.toLocaleUpperCase());
    }
  });
}

function localDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatGoldDate(date) { return date ? date.toLocaleDateString("en-GB").replaceAll("/", "-") : "—"; }
function valueOf(selector) { return Number(document.querySelector(selector)?.value) || 0; }
function money(value) { return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fieldValue(id) { return document.getElementById(id)?.value?.trim() || ""; }

// Same applicant and nominee fields used in Customer Entry are added to the Gold Loan application.
function addGoldCustomerFields() {
  const uploadSection = document.querySelector(".gold-upload-grid");
  if (!uploadSection) return;
  const customerDetails = document.createElement("div");
  customerDetails.innerHTML = `<h4 class="gold-section-title">CUSTOMER DETAILS</h4><div class="gold-panel form-grid"><div class="form-group"><label>Guardian Name *</label><input id="goldGuardianName" required></div><div class="form-group"><label>Gender *</label><select id="goldGender" required><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></div><div class="form-group"><label>Date of Birth *</label><input id="goldDob" type="date" required></div><div class="form-group"><label>Religion</label><select id="goldReligion"><option value="">Select religion</option><option>Muslim</option><option>Hinduism</option></select></div><div class="form-group"><label>Aadhaar No. *</label><input id="goldAadhaarNo" inputmode="numeric" maxlength="12" pattern="\\d{12}" required></div><div class="form-group"><label>Occupation *</label><select id="goldOccupation" required><option value="">Select occupation</option><option>Labour</option><option>Service</option><option>Self Employed</option><option>Hand Embrodary</option></select></div><div class="form-group"><label>Customer Bank Name</label><input id="goldCustomerBankName" placeholder="Bank name"></div><div class="form-group"><label>Customer Bank Branch</label><input id="goldCustomerBankBranch"></div><div class="form-group"><label>Customer IFSC Code</label><input id="goldCustomerIfscCode" style="text-transform:uppercase"></div><div class="form-group"><label>Customer Account Holder</label><input id="goldCustomerAccountHolder"></div><div class="form-group"><label>Customer Account Number</label><input id="goldCustomerAccountNumber" inputmode="numeric"></div></div><h4 class="gold-section-title">NOMINEE DETAILS</h4><div class="gold-panel form-grid"><div class="form-group"><label>Nominee Name *</label><input id="goldNomineeName" required></div><div class="form-group"><label>Nominee Guardian Name</label><input id="goldNomineeGuardianName"></div><div class="form-group"><label>Nominee Gender</label><select id="goldNomineeGender"><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></div><div class="form-group"><label>Nominee Occupation</label><input id="goldNomineeOccupation"></div><div class="form-group"><label>Nominee DOB</label><input id="goldNomineeDob" type="date"></div><div class="form-group"><label>Nominee Aadhaar</label><input id="goldNomineeAadhaar" inputmode="numeric" maxlength="12"></div><div class="form-group"><label>Relation with Applicant *</label><select id="goldRelationWithApplicant" required><option value="">Select relation</option><option>Father's</option><option>Husband's</option><option>Wife</option><option>Daughter</option><option>Son</option></select></div></div>`;
  customerDetails.querySelector("#goldAadhaarNo").setAttribute("minlength", "12");
  customerDetails.querySelector("#goldAadhaarNo").setAttribute("pattern", "[0-9]{12}");
  const nomineeAadhaar = customerDetails.querySelector("#goldNomineeAadhaar");
  nomineeAadhaar.setAttribute("minlength", "12");
  nomineeAadhaar.setAttribute("pattern", "[0-9]{12}");
  uploadSection.before(customerDetails);
}

function toggleBankDetails() {
  const bank = document.getElementById("goldDisbursementMode").value === "Bank";
  document.getElementById("bank-details-section").classList.toggle("hidden", !bank);
  ["goldBankName", "goldAcHolderName", "goldAcNumber", "goldIfscCode"].forEach(id => document.getElementById(id).required = bank);
}

function addGoldRow() {
  const tbody = document.getElementById("gold-table-body");
  const row = document.createElement("tr");
  row.innerHTML = `<td class="row-sl"></td><td><input type="text" class="gold-input gold-description" placeholder="e.g. Chain"></td><td><select class="gold-input gold-purity"><option value="22K">22K</option><option value="24K">24K</option><option value="21K">21K</option><option value="18K">18K</option></select></td><td><input type="number" class="gold-input gold-gross" min="0" step="0.001" placeholder="0.000"></td><td><input type="number" class="gold-input gold-stone" min="0" step="0.001" value="0"></td><td><input type="number" class="gold-input gold-net" readonly placeholder="0.000"></td><td><input type="number" class="gold-input gold-rate" min="0" step="0.01" placeholder="0.00"></td><td><output class="gold-assessed-value">₹0.00</output></td><td><button type="button" class="btn-delete" onclick="deleteRow(this)" aria-label="Remove article"><i class="fa-solid fa-trash"></i></button></td>`;
  tbody.appendChild(row); updateSerialNumbers(); calculateGoldLoan();
}

function deleteRow(button) {
  const rows = document.querySelectorAll("#gold-table-body tr");
  if (rows.length === 1) return alert("At least one pledged article is required.");
  button.closest("tr").remove(); updateSerialNumbers(); calculateGoldLoan();
}
function updateSerialNumbers() { document.querySelectorAll(".row-sl").forEach((cell, index) => cell.textContent = index + 1); }

function getGoldArticles() {
  return Array.from(document.querySelectorAll("#gold-table-body tr")).map(row => ({
    description: row.querySelector(".gold-description").value.trim(), purity: row.querySelector(".gold-purity").value,
    grossWeight: Number(row.querySelector(".gold-gross").value) || 0, stoneWeight: Number(row.querySelector(".gold-stone").value) || 0,
    netWeight: Number(row.querySelector(".gold-net").value) || 0, ratePerGram: Number(row.querySelector(".gold-rate").value) || 0,
    assessedValue: Number(row.querySelector(".gold-assessed-value").dataset.value) || 0
  }));
}

function calculateGoldLoan() {
  let grossTotal = 0, netTotal = 0, assessedTotal = 0;
  document.querySelectorAll("#gold-table-body tr").forEach(row => {
    const gross = Number(row.querySelector(".gold-gross").value) || 0;
    const stone = Number(row.querySelector(".gold-stone").value) || 0;
    const net = Math.max(0, gross - stone);
    const assessed = net * (Number(row.querySelector(".gold-rate").value) || 0);
    row.querySelector(".gold-net").value = net ? net.toFixed(3) : "";
    const output = row.querySelector(".gold-assessed-value"); output.value = money(assessed); output.textContent = money(assessed); output.dataset.value = assessed.toFixed(2);
    grossTotal += gross; netTotal += net; assessedTotal += assessed;
  });
  const ltv = Math.min(100, Math.max(0, valueOf("#goldLtvPercent")));
  const eligible = assessedTotal * ltv / 100;
  const principal = valueOf("#goldLoanAmount"), months = Math.max(0, Math.floor(valueOf("#goldLoanTenure"))), annualRate = Math.max(0, valueOf("#goldInterestRate"));
  const processingCharge = valueOf("#goldProcessingCharge"), documentCharge = valueOf("#goldDocumentCharge");
  const repaymentType = document.getElementById("goldRepaymentType").value;
  const monthlyRate = annualRate / 1200;
  let payment = 0, totalPayable = 0, paymentLabel = "Estimated EMI / month";
  if (principal && months) {
    if (repaymentType === "EMI") { payment = monthlyRate ? principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1) : principal / months; totalPayable = payment * months; }
    else if (repaymentType === "Interest Only") { payment = principal * monthlyRate; totalPayable = principal + (payment * months); paymentLabel = "Monthly interest"; }
    else { totalPayable = principal * (1 + annualRate / 100 * months / 12); payment = totalPayable; paymentLabel = "Payable at maturity"; }
  }
  const valuation = document.getElementById("goldValuationDate").value;
  let maturity = "—";
  if (valuation && months) { const date = new Date(`${valuation}T00:00:00`); date.setMonth(date.getMonth() + months); maturity = date.toLocaleDateString("en-GB").replaceAll("/", "-"); }
  const applicationDate = document.getElementById("goldAppDate").value;
  const firstEmi = applicationDate ? new Date(`${applicationDate}T00:00:00`) : null;
  if (firstEmi) firstEmi.setDate(firstEmi.getDate() + 30);
  const emiClose = firstEmi && months ? new Date(firstEmi.getTime()) : null;
  if (emiClose) emiClose.setDate(emiClose.getDate() + (months - 1) * 30);
  const firstEmiDate = formatGoldDate(firstEmi);
  maturity = formatGoldDate(emiClose);
  document.getElementById("goldTotalGross").textContent = `${grossTotal.toFixed(3)} g`;
  document.getElementById("goldTotalNet").textContent = `${netTotal.toFixed(3)} g`;
  document.getElementById("goldTotalValue").textContent = money(assessedTotal);
  document.getElementById("goldEligibleAmount").textContent = money(eligible);
  document.getElementById("goldEligibleAmountInput").value = money(eligible);
  document.getElementById("goldPaymentLabel").textContent = paymentLabel;
  document.getElementById("goldEmiAmount").textContent = money(payment);
  document.getElementById("goldTotalInterest").textContent = money(Math.max(0, totalPayable - principal));
  document.getElementById("goldTotalPayable").textContent = money(totalPayable);
  document.getElementById("goldFirstEmiDate").textContent = firstEmiDate;
  document.getElementById("goldMaturityDate").textContent = maturity;
  document.getElementById("goldNetDisbursement").value = money(Math.max(0, principal - processingCharge - documentCharge));
  goldLoanCalculation = { grossTotal, netTotal, assessedTotal, ltv, eligible, payment, totalInterest: Math.max(0, totalPayable - principal), totalPayable, firstEmiDate, emiCloseDate: maturity, maturity, processingCharge, documentCharge, netDisbursement: Math.max(0, principal - processingCharge - documentCharge) };
}

function getChecklists() { return Array.from(document.querySelectorAll(".chk-doc:checked"), item => item.value).join(", "); }
function fileAsBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); }); }

async function handleGoldLoanSubmit(event) {
  event.preventDefault(); calculateGoldLoan();
  const articles = getGoldArticles();
  if (!articles.some(article => article.description && article.netWeight > 0 && article.ratePerGram > 0)) return alert("Enter at least one article with description, weight and valuation rate.");
  if (valueOf("#goldLoanAmount") > goldLoanCalculation.eligible) return alert("Requested loan amount cannot exceed the eligible amount.");
  if (goldLoanCalculation.processingCharge + goldLoanCalculation.documentCharge > valueOf("#goldLoanAmount")) return alert("Processing and document charges cannot exceed the requested loan amount.");
  const submit = document.getElementById("submit-gold-btn"); submit.disabled = true; submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  try {
    const nominee = document.getElementById("goldNomineeImage").files[0], item = document.getElementById("goldItemImage").files[0];
    const payload = {
      action: goldEditId ? "update_gold_loan" : "create_gold_loan", id: goldEditId || "", loanType: "Gold Loan", appNo: document.getElementById("goldAppNo").value, appDate: document.getElementById("goldAppDate").value,
      branchName: document.getElementById("goldBranchName").value, branchCode: document.getElementById("goldBranchCode").value, officerName: document.getElementById("goldOfficerName").value, cspLocation: document.getElementById("goldCspLocation").value,
      borrowerName: document.getElementById("goldCustomerName").value, mobileNo: document.getElementById("goldMobileNo").value, identityNo: document.getElementById("goldIdentityNo").value, address: document.getElementById("goldAddress").value, monthlyIncome: document.getElementById("goldMonthlyIncome").value,
      guardianName: fieldValue("goldGuardianName"), gender: fieldValue("goldGender"), dob: fieldValue("goldDob"), religion: fieldValue("goldReligion"), aadhaarNo: fieldValue("goldAadhaarNo"), occupation: fieldValue("goldOccupation"), customerBankName: fieldValue("goldCustomerBankName"), customerBankBranch: fieldValue("goldCustomerBankBranch"), customerIfscCode: fieldValue("goldCustomerIfscCode").toUpperCase(), customerAccountHolder: fieldValue("goldCustomerAccountHolder"), customerAccountNumber: fieldValue("goldCustomerAccountNumber"), nomineeName: fieldValue("goldNomineeName"), nomineeGuardianName: fieldValue("goldNomineeGuardianName"), nomineeGender: fieldValue("goldNomineeGender"), nomineeOccupation: fieldValue("goldNomineeOccupation"), nomineeDob: fieldValue("goldNomineeDob"), nomineeAadhaar: fieldValue("goldNomineeAadhaar"), relationWithApplicant: fieldValue("goldRelationWithApplicant"),
      goldArticles: JSON.stringify(articles), loanAmount: document.getElementById("goldLoanAmount").value, processingCharge: goldLoanCalculation.processingCharge, documentCharge: goldLoanCalculation.documentCharge, netDisbursementAmount: goldLoanCalculation.netDisbursement, loanTenure: document.getElementById("goldLoanTenure").value, purpose: document.getElementById("goldPurpose").value, scheme: document.getElementById("goldScheme").value, interestRate: document.getElementById("goldInterestRate").value, repaymentType: document.getElementById("goldRepaymentType").value, valuationDate: document.getElementById("goldValuationDate").value,
      totalGrossWeight: goldLoanCalculation.grossTotal, totalNetWeight: goldLoanCalculation.netTotal, assessedValue: goldLoanCalculation.assessedTotal, ltvPercent: goldLoanCalculation.ltv, eligibleAmount: goldLoanCalculation.eligible, installmentAmount: goldLoanCalculation.payment, totalInterest: goldLoanCalculation.totalInterest, totalPayable: goldLoanCalculation.totalPayable, firstEmiDate: goldLoanCalculation.firstEmiDate, emiCloseDate: goldLoanCalculation.emiCloseDate, maturityDate: goldLoanCalculation.maturity,
      disbursementMode: document.getElementById("goldDisbursementMode").value, bankName: document.getElementById("goldBankName").value, acHolderName: document.getElementById("goldAcHolderName").value, acNumber: document.getElementById("goldAcNumber").value, ifscCode: document.getElementById("goldIfscCode").value, bankBranch: document.getElementById("goldBankBranch").value, submittedDocuments: getChecklists(),
      nomineeImgBase64: nominee ? await fileAsBase64(nominee) : "", nomineeImgName: nominee?.name || "", nomineeImgType: nominee?.type || "", goldItemImgBase64: item ? await fileAsBase64(item) : "", goldItemImgName: item?.name || "", goldItemImgType: item?.type || ""
    };
    const response = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) }); const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "Could not save the application.");
    alert(goldEditId ? "Gold loan customer updated successfully." : `Gold loan application ${payload.appNo} saved successfully.`);
    submit.classList.add("hidden");
    let printButton = document.getElementById("print-gold-loan-btn");
    if (!printButton) { printButton = document.createElement("button"); printButton.id = "print-gold-loan-btn"; printButton.type = "button"; printButton.className = "btn-primary"; printButton.innerHTML = '<i class="fa-solid fa-print"></i> Print Application'; submit.after(printButton); }
    printButton.onclick = () => printGoldLoanReceipt(payload);
  } catch (error) { console.error(error); alert(`Submission failed: ${error.message}`); }
  finally { submit.disabled = false; submit.innerHTML = '<i class="fa-solid fa-lock"></i> Submit Gold Loan'; }
}

async function loadGoldLoanForEdit(id) {
  try {
    const response = await fetch(APPS_SCRIPT_URL + "?t=" + Date.now()), data = await response.json();
    const loan = (data.gold_loans || []).find(item => String(item.ID) === String(id));
    if (!loan) return alert("Gold loan customer was not found.");
    const fields = { goldAppNo: "Application No", goldAppDate: "Application Date", goldBranchName: "Branch Name", goldBranchCode: "Branch Code", goldOfficerName: "Loan Officer Name", goldCspLocation: "CSP Location", goldCustomerName: "Borrower Name", goldMobileNo: "Mobile No", goldIdentityNo: "Identity No", goldAddress: "Address", goldMonthlyIncome: "Monthly Income", goldGuardianName: "Guardian Name", goldGender: "Gender", goldDob: "DOB", goldReligion: "Religion", goldAadhaarNo: "Aadhaar No", goldOccupation: "Occupation", goldCustomerBankName: "Customer Bank Name", goldCustomerBankBranch: "Customer Bank Branch", goldCustomerIfscCode: "Customer IFSC Code", goldCustomerAccountHolder: "Customer Account Holder", goldCustomerAccountNumber: "Customer Account Number", goldNomineeName: "Nominee Name", goldNomineeGuardianName: "Nominee Guardian Name", goldNomineeGender: "Nominee Gender", goldNomineeOccupation: "Nominee Occupation", goldNomineeDob: "Nominee DOB", goldNomineeAadhaar: "Nominee Aadhaar", goldRelationWithApplicant: "Relation With Applicant", goldValuationDate: "Valuation Date", goldLtvPercent: "LTV (%)", goldLoanAmount: "Loan Amount Requested", goldProcessingCharge: "Processing Charge", goldDocumentCharge: "Document Charge", goldLoanTenure: "Loan Tenure", goldInterestRate: "Rate of Interest (%)", goldRepaymentType: "Repayment Method", goldPurpose: "Purpose of Loan", goldScheme: "Scheme", goldDisbursementMode: "Disbursement Mode" };
    Object.entries(fields).forEach(([id, header]) => { const element = document.getElementById(id); if (element && loan[header] != null) element.value = loan[header]; });
    const articles = JSON.parse(loan["Gold Articles Details"] || "[]");
    if (articles.length) { document.getElementById("gold-table-body").innerHTML = ""; articles.forEach((article, index) => { if (index) addGoldRow(); else addGoldRow(); const row = document.querySelector("#gold-table-body tr:last-child"); row.querySelector(".gold-description").value = article.description || ""; row.querySelector(".gold-purity").value = article.purity || "22K"; row.querySelector(".gold-gross").value = article.grossWeight || ""; row.querySelector(".gold-stone").value = article.stoneWeight || 0; row.querySelector(".gold-rate").value = article.ratePerGram || ""; }); }
    document.querySelector(".gold-page-header h1").innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Gold Loan Customer';
    document.getElementById("submit-gold-btn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Gold Loan'; calculateGoldLoan();
  } catch (error) { console.error(error); alert("Could not load the Gold Loan customer for editing."); }
}

function printGoldLoanReceipt(data) {
  const articles = JSON.parse(data.goldArticles || "[]").map(item => `<tr><td>${item.description || "—"}</td><td>${item.purity || "—"}</td><td>${Number(item.netWeight || 0).toFixed(3)} g</td><td>${money(item.assessedValue)}</td></tr>`).join("");
  const printPhoto = (label, base64, mime) => base64 ? `<figure style="display:inline-block;text-align:center;margin:12px"><figcaption>${label}</figcaption><img src="data:${mime || "image/jpeg"};base64,${base64}" alt="${label}" style="display:block;width:150px;height:150px;object-fit:contain;border:1px solid #d8d1c0;margin-top:6px"></figure>` : "";
  const photos = printPhoto("Customer Photo", data.nomineeImgBase64, data.nomineeImgType) + printPhoto("Pledged Gold Photo", data.goldItemImgBase64, data.goldItemImgType);
  const loanDetails = `<table><tr><th>Branch Code</th><td>${data.branchCode}</td><th>Loan Officer</th><td>${data.officerName}</td></tr><tr><th>CSP Location</th><td>${data.cspLocation}</td><th>Loan Principal</th><td>${money(data.loanAmount)}</td></tr><tr><th>Processing Charge</th><td>${money(data.processingCharge)}</td><th>Document Charge</th><td>${money(data.documentCharge)}</td></tr><tr><th>Net Disbursement Amount</th><td colspan="3">${money(data.netDisbursementAmount)}</td></tr><tr><th>First EMI Date</th><td colspan="3">${data.firstEmiDate}</td></tr></table>`;
  const popup = window.open("", "_blank", "width=850,height=750");
  if (!popup) return alert("Please allow pop-ups to print the application.");
  popup.document.write(`<!doctype html><html><head><title>Gold Loan Application</title><style>body{font-family:Arial;color:#1f2937;max-width:760px;margin:30px auto}h1{color:#805b08;border-bottom:3px solid #b8860b;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:9px;border:1px solid #d8d1c0;text-align:left}th{background:#fff4d2}.summary{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.summary div{padding:16px;min-height:54px;border:1px solid #d8d1c0;border-radius:6px;background:#fff}.summary div:nth-child(2),.summary div:nth-child(4){display:none}.muted{color:#6b7280;font-size:12px} @media print{body{margin:10mm auto}}</style></head><body><h1>Gold Loan Application</h1><p class="muted">Application No: ${data.appNo} &nbsp; | &nbsp; Date: ${data.appDate}</p><table><tr><th>Borrower</th><td>${data.borrowerName}</td><th>Mobile</th><td>${data.mobileNo}</td></tr><tr><th>Loan Amount</th><td>${money(data.loanAmount)}</td><th>Repayment</th><td>${data.repaymentType}</td></tr></table>${loanDetails}${photos ? `<h3>Photographs</h3>${photos}` : ""}<h3>Pledged Articles</h3><table><tr><th>Article</th><th>Purity</th><th>Net Weight</th><th>Value</th></tr>${articles}</table><div class="summary"><div>Eligible Amount<br><strong>${money(data.eligibleAmount)}</strong></div><div>Total Payable<br><strong>${money(data.totalPayable)}</strong></div><div>Interest<br><strong>${money(data.totalInterest)}</strong></div><div>EMI Close Date<br><strong>${data.emiCloseDate || data.maturityDate}</strong></div></div><p class="muted">This is a computer-generated application estimate.</p><script>window.onload=()=>window.print();window.onafterprint=()=>{if(window.opener&&!window.opener.closed)window.opener.location.reload();window.close();};</script></body></html>`); popup.document.close();
}
