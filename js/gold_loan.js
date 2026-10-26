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
  ["goldRepaymentType", "goldValuationDate", "goldAppDate", "goldLoanTenureUnit"].forEach(id => document.getElementById(id).addEventListener("change", () => { updateGoldTenureUnit(); calculateGoldLoan(); }));
  document.getElementById("goldDisbursementMode").addEventListener("change", toggleBankDetails);
  document.getElementById("gold-table-body").addEventListener("input", calculateGoldLoan);
  document.getElementById("gold-loan-form").addEventListener("submit", handleGoldLoanSubmit);
  updateGoldTenureUnit();
  calculateGoldLoan();
});

function updateGoldTenureUnit() {
  const days = document.getElementById("goldLoanTenureUnit").value === "Days";
  document.getElementById("goldInterestRateLabel").textContent = days ? "Interest Rate (% per month) *" : "Interest Rate (% p.a.) *";
  const tenure = document.getElementById("goldLoanTenure");
  document.getElementById("goldLoanTenureLabel").textContent = `Tenure (${days ? "days" : "months"}) *`;
  tenure.max = days ? "365" : "60";
  tenure.value = Math.min(Number(tenure.value) || 1, Number(tenure.max));
  const repayment = document.getElementById("goldRepaymentType");
  const dailyOption = repayment.querySelector('option[value="Daily Interest"]');
  repayment.querySelectorAll('option[value="EMI"], option[value="Interest Only"]').forEach(option => { option.disabled = days; });
  dailyOption.disabled = !days;
  if (days && ["EMI", "Interest Only"].includes(repayment.value)) repayment.value = "Daily Interest";
  if (!days && repayment.value === "Daily Interest") repayment.value = "Interest Only";
  styleGoldRequiredStars();
}

function styleGoldRequiredStars() {
  document.querySelectorAll("#gold-loan-form label").forEach(label => {
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.nodeValue.includes("*") && !node.parentElement?.classList.contains("gold-required-star") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parts = node.nodeValue.split("*");
      const fragment = document.createDocumentFragment();
      parts.forEach((part, index) => {
        if (part) fragment.append(document.createTextNode(part));
        if (index < parts.length - 1) {
          const star = document.createElement("span");
          star.className = "gold-required-star";
          star.textContent = "*";
          fragment.append(star);
        }
      });
      node.replaceWith(fragment);
    });
  });
}

function setupGoldFieldValidation() {
  ["goldMobileNo", "goldAadhaarNo", "goldNomineeAadhaar"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, id === "goldMobileNo" ? 10 : 12); });
  });
  const titleCaseIds = new Set(["goldBranchName", "goldOfficerName", "goldCspLocation", "goldCustomerName", "goldAddress", "goldGuardianName", "goldCustomerBankName", "goldCustomerBankBranch", "goldCustomerAccountHolder", "goldAcHolderName", "goldBankBranch", "goldNomineeName", "goldNomineeGuardianName", "goldPurpose", "goldScheme"]);
  document.getElementById("gold-loan-form").addEventListener("focusout", event => {
    const input = event.target;
    if (titleCaseIds.has(input.id) || input.matches(".gold-description")) {
      input.value = input.value.trim().toLocaleLowerCase().replace(/(^|\s)[\p{L}]/gu, letter => letter.toLocaleUpperCase());
    }
  });
}

function localDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatGoldDate(date) { return date ? date.toLocaleDateString("en-GB").replaceAll("/", "-") : "�"; }
function valueOf(selector) { return Number(document.querySelector(selector)?.value) || 0; }
function money(value) { return `?${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fieldValue(id) { return document.getElementById(id)?.value?.trim() || ""; }

// Same applicant and nominee fields used in Customer Entry are added to the Gold Loan application.
function addGoldCustomerFields() {
  const uploadSection = document.querySelector(".gold-upload-grid");
  if (!uploadSection) return;
  const customerDetails = document.createElement("div");
  customerDetails.innerHTML = `<h4 class="gold-section-title">CUSTOMER DETAILS</h4><div class="gold-panel form-grid"><div class="form-group"><label>Customer Name *</label><input id="goldCustomerName" type="text" placeholder="Full name" required></div><div class="form-group"><label>Mobile Number *</label><input id="goldMobileNo" type="tel" inputmode="numeric" minlength="10" maxlength="10" pattern="[0-9]{10}" placeholder="10-digit number" required></div><div class="form-group"><label>VOTER ID / PAN No.</label><input id="goldIdentityNo" type="text" placeholder="Identity reference"></div><div class="form-group"><label>Monthly Income (&#8377;)</label><input id="goldMonthlyIncome" type="text" min="0" step="0.01" placeholder="0.00"></div><div class="form-group gold-wide"><label>Residential Address</label><input id="goldAddress" type="text" placeholder="Full address"></div><div class="form-group"><label>Guardian Name *</label><input id="goldGuardianName" required></div><div class="form-group"><label>Gender *</label><select id="goldGender" required><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></div><div class="form-group"><label>Date of Birth *</label><input id="goldDob" type="date" required></div><div class="form-group"><label>Religion</label><select id="goldReligion"><option value="">Select religion</option><option>Muslim</option><option>Hinduism</option></select></div><div class="form-group"><label>Aadhaar No. *</label><input id="goldAadhaarNo" inputmode="numeric" maxlength="12" pattern="\\d{12}" required></div><div class="form-group"><label>Occupation *</label><div class="gold-option-control"><select id="goldOccupation" required><option value="">Select occupation</option><option>Labour</option><option>Service</option><option>Self Employed</option><option>Hand Embrodary</option></select><div class="gold-option-buttons"><button type="button" aria-label="Add occupation" title="Add occupation" onclick="manageGoldOccupation('goldOccupation','Occupation','add')"><i class="fa-solid fa-plus"></i></button><button type="button" aria-label="Edit occupation" title="Edit occupation" onclick="manageGoldOccupation('goldOccupation','Occupation','edit')"><i class="fa-solid fa-pen"></i></button><button type="button" aria-label="Delete occupation" title="Delete occupation" onclick="manageGoldOccupation('goldOccupation','Occupation','delete')"><i class="fa-solid fa-trash"></i></button></div></div></div><div class="form-group"><label>Customer Bank Name</label><input id="goldCustomerBankName" placeholder="Bank name"></div><div class="form-group"><label>Customer Bank Branch</label><input id="goldCustomerBankBranch"></div><div class="form-group"><label>Customer IFSC Code</label><input id="goldCustomerIfscCode" style="text-transform:uppercase"></div><div class="form-group"><label>Customer Account Holder</label><input id="goldCustomerAccountHolder"></div><div class="form-group"><label>Customer Account Number</label><input id="goldCustomerAccountNumber" inputmode="numeric"></div></div><h4 class="gold-section-title">NOMINEE DETAILS</h4><div class="gold-panel form-grid"><div class="form-group"><label>Nominee Name *</label><input id="goldNomineeName" required></div><div class="form-group"><label>Nominee Guardian Name</label><input id="goldNomineeGuardianName"></div><div class="form-group"><label>Nominee Gender</label><select id="goldNomineeGender"><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></div><div class="form-group"><label>Nominee Occupation</label><div class="gold-option-control"><select id="goldNomineeOccupation"><option value="">Select occupation</option></select><div class="gold-option-buttons"><button type="button" aria-label="Add nominee occupation" title="Add nominee occupation" onclick="manageGoldOccupation('goldNomineeOccupation','Nominee Occupation','add')"><i class="fa-solid fa-plus"></i></button><button type="button" aria-label="Edit nominee occupation" title="Edit nominee occupation" onclick="manageGoldOccupation('goldNomineeOccupation','Nominee Occupation','edit')"><i class="fa-solid fa-pen"></i></button><button type="button" aria-label="Delete nominee occupation" title="Delete nominee occupation" onclick="manageGoldOccupation('goldNomineeOccupation','Nominee Occupation','delete')"><i class="fa-solid fa-trash"></i></button></div></div></div><div class="form-group"><label>Nominee DOB</label><input id="goldNomineeDob" type="date"></div><div class="form-group"><label>Nominee Aadhaar</label><input id="goldNomineeAadhaar" inputmode="numeric" maxlength="12"></div><div class="form-group"><label>Relation with Applicant *</label><select id="goldRelationWithApplicant" required><option value="">Select relation</option><option>Father's</option><option>Husband's</option><option>Wife</option><option>Daughter</option><option>Son</option></select></div></div>`;
  customerDetails.querySelector("#goldAadhaarNo").setAttribute("minlength", "12");
  customerDetails.querySelector("#goldAadhaarNo").setAttribute("pattern", "[0-9]{12}");
  const nomineeAadhaar = customerDetails.querySelector("#goldNomineeAadhaar");
  nomineeAadhaar.setAttribute("minlength", "12");
  nomineeAadhaar.setAttribute("pattern", "[0-9]{12}");
  uploadSection.before(customerDetails);
  loadGoldOccupationOptions("goldOccupation", ["Labour", "Service", "Self Employed", "Hand Embrodary"]);
  loadGoldOccupationOptions("goldNomineeOccupation", []);
}

function loadGoldOccupationOptions(selectId, defaults) {
  const select = document.getElementById(selectId);
  const storageKey = `goldOccupationOptions:${selectId}`;
  let values = defaults;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) values = parsed;
    }
  } catch (_) {}
  select.replaceChildren(new Option("Select occupation", ""));
  [...new Set(values.filter(value => typeof value === "string" && value.trim()))].forEach(value => select.add(new Option(value, value)));
}

function manageGoldOccupation(selectId, label, action) {
  const select = document.getElementById(selectId);
  if (!select) return;
  if (action === "add") {
    const entered = prompt(`Add ${label}:`);
    if (!entered || !entered.trim()) return;
    const value = entered.trim();
    if ([...select.options].some(option => option.value.toLowerCase() === value.toLowerCase())) return alert(`This ${label.toLowerCase()} already exists.`);
    select.add(new Option(value, value));
    select.value = value;
  } else {
    if (!select.value) return alert(`Please select a ${label.toLowerCase()} first.`);
    const selected = select.options[select.selectedIndex];
    if (action === "edit") {
      const entered = prompt(`Edit ${label}:`, selected.value);
      if (!entered || !entered.trim()) return;
      const value = entered.trim();
      if ([...select.options].some(option => option !== selected && option.value.toLowerCase() === value.toLowerCase())) return alert(`This ${label.toLowerCase()} already exists.`);
      selected.value = selected.textContent = value;
      select.value = value;
    } else {
      if (!confirm(`Delete �${selected.value}� from the ${label} list?`)) return;
      selected.remove();
      select.value = "";
    }
  }
  const values = [...select.options].map(option => option.value).filter(Boolean);
  localStorage.setItem(`goldOccupationOptions:${selectId}`, JSON.stringify(values));
}

function toggleBankDetails() {
  const bank = document.getElementById("goldDisbursementMode").value === "Bank";
  document.getElementById("bank-details-section").classList.toggle("hidden", !bank);
  ["goldBankName", "goldAcHolderName", "goldAcNumber", "goldIfscCode"].forEach(id => document.getElementById(id).required = bank);
}

function addGoldRow() {
  const tbody = document.getElementById("gold-table-body");
  const row = document.createElement("tr");
  row.innerHTML = `<td class="row-sl"></td><td><input type="text" class="gold-input gold-description" placeholder="e.g. Chain"></td><td><select class="gold-input gold-purity"><option value="22K">22K</option><option value="24K">24K</option><option value="21K">21K</option><option value="18K">18K</option></select></td><td><input type="number" class="gold-input gold-gross" min="0" step="0.001" placeholder="0.000"></td><td><input type="number" class="gold-input gold-stone" min="0" step="0.001" value="0"></td><td><input type="number" class="gold-input gold-net" readonly placeholder="0.000"></td><td><input type="number" class="gold-input gold-rate" min="0" step="0.01" placeholder="0.00"></td><td><output class="gold-assessed-value">?0.00</output></td><td><button type="button" class="btn-delete" onclick="deleteRow(this)" aria-label="Remove article"><i class="fa-solid fa-trash"></i></button></td>`;
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
  const principal = valueOf("#goldLoanAmount"), tenure = Math.max(0, Math.floor(valueOf("#goldLoanTenure"))), tenureUnit = document.getElementById("goldLoanTenureUnit").value, isDays = tenureUnit === "Days", months = isDays ? 0 : tenure, annualRate = Math.max(0, valueOf("#goldInterestRate"));
  const processingCharge = valueOf("#goldProcessingCharge"), documentCharge = valueOf("#goldDocumentCharge");
  const repaymentType = document.getElementById("goldRepaymentType").value;
  const monthlyRate = annualRate / 1200;
  let payment = 0, totalPayable = 0, paymentLabel = "Estimated EMI / month";
  let totalInterest = 0;
  if (principal && tenure) {
    if (isDays) {
      const dailyInterest = principal * (annualRate / 100) / 30;
      totalInterest = dailyInterest * tenure;
      totalPayable = principal + totalInterest;
      if (repaymentType === "Daily Interest") { payment = dailyInterest; paymentLabel = "Estimated interest / day"; }
      else { payment = totalPayable; paymentLabel = "Payable at maturity"; }
    } else if (repaymentType === "EMI") { payment = monthlyRate ? principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1) : principal / months; totalPayable = payment * months; }
    else if (repaymentType === "Interest Only") { payment = principal * monthlyRate; totalPayable = principal + (payment * months); paymentLabel = "Monthly interest"; }
    else { totalPayable = principal * (1 + annualRate / 100 * months / 12); payment = totalPayable; paymentLabel = "Payable at maturity"; }
  }
  const valuation = document.getElementById("goldValuationDate").value;
  let maturity = "�";
  if (valuation && tenure) { const date = new Date(`${valuation}T00:00:00`); if (isDays) date.setDate(date.getDate() + tenure); else date.setMonth(date.getMonth() + months); maturity = date.toLocaleDateString("en-GB").replaceAll("/", "-"); }
  const applicationDate = document.getElementById("goldAppDate").value;
  const firstPaymentDate = isDays ? valuation : applicationDate;
  const firstEmi = firstPaymentDate ? new Date(`${firstPaymentDate}T00:00:00`) : null;
  if (firstEmi) firstEmi.setDate(firstEmi.getDate() + (isDays ? 1 : 30));
  const emiClose = firstEmi && tenure ? new Date(firstEmi.getTime()) : null;
  if (emiClose) emiClose.setDate(emiClose.getDate() + (isDays ? tenure - 1 : (months - 1) * 30));
  const firstEmiDate = formatGoldDate(firstEmi);
  maturity = formatGoldDate(emiClose);
  document.getElementById("goldFirstEmiDate").previousElementSibling.textContent = isDays ? "First Payment Date" : "First EMI Date";
  document.getElementById("goldTotalGross").textContent = `${grossTotal.toFixed(3)} g`;
  document.getElementById("goldTotalNet").textContent = `${netTotal.toFixed(3)} g`;
  document.getElementById("goldTotalValue").textContent = money(assessedTotal);
  document.getElementById("goldEligibleAmount").textContent = money(eligible);
  document.getElementById("goldEligibleAmountInput").value = money(eligible);
  document.getElementById("goldPaymentLabel").textContent = paymentLabel;
  document.getElementById("goldEmiAmount").textContent = money(payment);
  if (!isDays) totalInterest = Math.max(0, totalPayable - principal);
  document.getElementById("goldTotalInterest").textContent = money(totalInterest);
  document.getElementById("goldTotalPayable").textContent = money(totalPayable);
  document.getElementById("goldFirstEmiDate").textContent = firstEmiDate;
  document.getElementById("goldMaturityDate").textContent = maturity;
  document.getElementById("goldNetDisbursement").value = money(Math.max(0, principal - processingCharge - documentCharge));
  goldLoanCalculation = { grossTotal, netTotal, assessedTotal, ltv, eligible, payment, totalInterest, totalPayable, firstEmiDate, emiCloseDate: maturity, maturity, processingCharge, documentCharge, netDisbursement: Math.max(0, principal - processingCharge - documentCharge) };
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
      goldArticles: JSON.stringify(articles), loanAmount: document.getElementById("goldLoanAmount").value, processingCharge: goldLoanCalculation.processingCharge, documentCharge: goldLoanCalculation.documentCharge, netDisbursementAmount: goldLoanCalculation.netDisbursement, loanTenure: document.getElementById("goldLoanTenure").value, loanTenureUnit: document.getElementById("goldLoanTenureUnit").value, purpose: document.getElementById("goldPurpose").value, scheme: document.getElementById("goldScheme").value, interestRate: document.getElementById("goldInterestRate").value, repaymentType: document.getElementById("goldRepaymentType").value, valuationDate: document.getElementById("goldValuationDate").value,
      totalGrossWeight: goldLoanCalculation.grossTotal, totalNetWeight: goldLoanCalculation.netTotal, assessedValue: goldLoanCalculation.assessedTotal, ltvPercent: goldLoanCalculation.ltv, eligibleAmount: goldLoanCalculation.eligible, installmentAmount: goldLoanCalculation.payment, totalInterest: goldLoanCalculation.totalInterest, totalPayable: goldLoanCalculation.totalPayable, firstEmiDate: goldLoanCalculation.firstEmiDate, emiCloseDate: goldLoanCalculation.emiCloseDate, maturityDate: goldLoanCalculation.maturity,
      disbursementMode: document.getElementById("goldDisbursementMode").value, bankName: document.getElementById("goldBankName").value, acHolderName: document.getElementById("goldAcHolderName").value, acNumber: document.getElementById("goldAcNumber").value, ifscCode: document.getElementById("goldIfscCode").value, bankBranch: document.getElementById("goldBankBranch").value, submittedDocuments: getChecklists(),
      nomineeImgBase64: nominee ? await fileAsBase64(nominee) : "", nomineeImgName: nominee?.name || "", nomineeImgType: nominee?.type || "", goldItemImgBase64: item ? await fileAsBase64(item) : "", goldItemImgName: item?.name || "", goldItemImgType: item?.type || ""
    };
    const response = await postAppData(payload); const result = await response.json();
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
    const data = await fetchAppData();
    const loan = (data.gold_loans || []).find(item => String(item.ID) === String(id));
    if (!loan) return alert("Gold loan customer was not found.");
    const fields = { goldAppNo: "Application No", goldAppDate: "Application Date", goldBranchName: "Branch Name", goldBranchCode: "Branch Code", goldOfficerName: "Loan Officer Name", goldCspLocation: "CSP Location", goldCustomerName: "Borrower Name", goldMobileNo: "Mobile No", goldIdentityNo: "Identity No", goldAddress: "Address", goldMonthlyIncome: "Monthly Income", goldGuardianName: "Guardian Name", goldGender: "Gender", goldDob: "DOB", goldReligion: "Religion", goldAadhaarNo: "Aadhaar No", goldOccupation: "Occupation", goldCustomerBankName: "Customer Bank Name", goldCustomerBankBranch: "Customer Bank Branch", goldCustomerIfscCode: "Customer IFSC Code", goldCustomerAccountHolder: "Customer Account Holder", goldCustomerAccountNumber: "Customer Account Number", goldNomineeName: "Nominee Name", goldNomineeGuardianName: "Nominee Guardian Name", goldNomineeGender: "Nominee Gender", goldNomineeOccupation: "Nominee Occupation", goldNomineeDob: "Nominee DOB", goldNomineeAadhaar: "Nominee Aadhaar", goldRelationWithApplicant: "Relation With Applicant", goldValuationDate: "Valuation Date", goldLtvPercent: "LTV (%)", goldLoanAmount: "Loan Amount Requested", goldProcessingCharge: "Processing Charge", goldDocumentCharge: "Document Charge", goldLoanTenure: "Loan Tenure", goldInterestRate: "Rate of Interest (%)", goldRepaymentType: "Repayment Method", goldPurpose: "Purpose of Loan", goldScheme: "Scheme", goldDisbursementMode: "Disbursement Mode" };
    Object.entries(fields).forEach(([id, header]) => { const element = document.getElementById(id); if (!element || loan[header] == null) return; const savedValue = String(loan[header]); if (element.tagName === "SELECT" && savedValue && ![...element.options].some(option => option.value === savedValue)) element.add(new Option(savedValue, savedValue)); element.value = savedValue; });
    document.getElementById("goldLoanTenureUnit").value = loan["Loan Tenure Unit"] || "Months";
    updateGoldTenureUnit();
    const articles = JSON.parse(loan["Gold Articles Details"] || "[]");
    if (articles.length) { document.getElementById("gold-table-body").innerHTML = ""; articles.forEach((article, index) => { if (index) addGoldRow(); else addGoldRow(); const row = document.querySelector("#gold-table-body tr:last-child"); row.querySelector(".gold-description").value = article.description || ""; row.querySelector(".gold-purity").value = article.purity || "22K"; row.querySelector(".gold-gross").value = article.grossWeight || ""; row.querySelector(".gold-stone").value = article.stoneWeight || 0; row.querySelector(".gold-rate").value = article.ratePerGram || ""; }); }
    document.querySelector(".gold-page-header h1").innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Gold Loan Customer';
    document.getElementById("submit-gold-btn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Gold Loan'; calculateGoldLoan();
  } catch (error) { console.error(error); alert("Could not load the Gold Loan customer for editing."); }
}

function printGoldLoanReceipt(data) {
  const popup = window.open("", "_blank", "width=1000,height=800");
  if (!popup) return alert("Please allow pop-ups to print the application.");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const show = value => value === "" || value == null ? "�" : escapeHtml(value);
  const showMoney = value => value === "" || value == null ? "�" : money(value);
  const showDate = value => {
    if (!value) return "�";
    const date = new Date(String(value) + "T00:00:00");
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString("en-GB").replaceAll("/", "-");
  };
  const tenureUnit = data.loanTenureUnit || "Months";
  const firstDateLabel = String(tenureUnit).toLowerCase() === "days" ? "First Payment Date" : "First EMI Date";
  const pairs = items => {
    let output = "";
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i], right = items[i + 1];
      output += "<tr><th>" + left[0] + "</th><td>" + left[1] + "</td>" + (right ? "<th>" + right[0] + "</th><td>" + right[1] + "</td>" : "<th></th><td></td>") + "</tr>";
    }
    return output;
  };
  const section = (title, items) => "<h2>" + title + "</h2><table class='details'>" + pairs(items) + "</table>";
  const articles = (() => { try { return JSON.parse(data.goldArticles || "[]"); } catch (_) { return []; } })();
  const articleRows = articles.map((item, index) => "<tr><td>" + (index + 1) + "</td><td>" + show(item.description) + "</td><td>" + show(item.purity) + "</td><td>" + Number(item.grossWeight || 0).toFixed(3) + " g</td><td>" + Number(item.stoneWeight || 0).toFixed(3) + " g</td><td>" + Number(item.netWeight || 0).toFixed(3) + " g</td><td>" + showMoney(item.ratePerGram) + "</td><td>" + showMoney(item.assessedValue) + "</td></tr>").join("");
  const printPhoto = (label, base64, mime) => base64 ? "<figure><figcaption>" + label + "</figcaption><img src='data:" + escapeHtml(mime || "image/jpeg") + ";base64," + base64 + "' alt='" + label + "'></figure>" : "";
  const photos = printPhoto("Customer Photo", data.nomineeImgBase64, data.nomineeImgType) + printPhoto("Pledged Gold Photo", data.goldItemImgBase64, data.goldItemImgType);
  const application = section("Application & Branch Details", [
    ["Application No.", show(data.appNo)], ["Application Date", showDate(data.appDate)], ["Branch Name", show(data.branchName)], ["Branch Code", show(data.branchCode)], ["Loan Officer Name", show(data.officerName)], ["CSP Location", show(data.cspLocation)]
  ]);
  const borrower = section("Borrower Details", [
    ["Borrower Name", show(data.borrowerName)], ["Mobile No.", show(data.mobileNo)], ["Identity No.", show(data.identityNo)], ["Address", show(data.address)], ["Monthly Income", showMoney(data.monthlyIncome)], ["Guardian Name", show(data.guardianName)], ["Gender", show(data.gender)], ["Date of Birth", showDate(data.dob)], ["Religion", show(data.religion)], ["Aadhaar No.", show(data.aadhaarNo)], ["Occupation", show(data.occupation)]
  ]);
  const customerBank = section("Customer Bank Details", [
    ["Bank Name", show(data.customerBankName)], ["Bank Branch", show(data.customerBankBranch)], ["IFSC Code", show(data.customerIfscCode)], ["Account Holder", show(data.customerAccountHolder)], ["Account Number", show(data.customerAccountNumber)]
  ]);
  const nominee = section("Nominee Details", [
    ["Nominee Name", show(data.nomineeName)], ["Guardian Name", show(data.nomineeGuardianName)], ["Gender", show(data.nomineeGender)], ["Occupation", show(data.nomineeOccupation)], ["Date of Birth", showDate(data.nomineeDob)], ["Aadhaar No.", show(data.nomineeAadhaar)], ["Relation with Applicant", show(data.relationWithApplicant)]
  ]);
  const valuation = section("Gold Valuation", [
    ["Valuation Date", showDate(data.valuationDate)], ["Total Gross Weight", Number(data.totalGrossWeight || 0).toFixed(3) + " g"], ["Total Net Weight", Number(data.totalNetWeight || 0).toFixed(3) + " g"], ["Total Assessed Value", showMoney(data.assessedValue)], ["LTV", show(data.ltvPercent) + "%"], ["Eligible Amount", showMoney(data.eligibleAmount)]
  ]);
  const loan = section("Loan & Repayment Details", [
    ["Loan Amount Requested", showMoney(data.loanAmount)], ["Processing Charge", showMoney(data.processingCharge)], ["Document Charge", showMoney(data.documentCharge)], ["Net Disbursement Amount", showMoney(data.netDisbursementAmount)], ["Tenure", show(data.loanTenure) + " " + escapeHtml(tenureUnit)], ["Interest Rate", show(data.interestRate) + (String(tenureUnit).toLowerCase() === "days" ? "% per month" : "% p.a.")], ["Repayment Method", show(data.repaymentType)], ["Installment / Interest Amount", showMoney(data.installmentAmount)], ["Total Interest", showMoney(data.totalInterest)], ["Total Payable", showMoney(data.totalPayable)], [firstDateLabel, showDate(data.firstEmiDate)], ["EMI Close Date", showDate(data.emiCloseDate)], ["Maturity Date", showDate(data.maturityDate)], ["Purpose of Loan", show(data.purpose)], ["Scheme", show(data.scheme)], ["Disbursement Mode", show(data.disbursementMode)]
  ]);
  const bank = section("Disbursement Bank Details", [
    ["Bank Name", show(data.bankName)], ["Account Holder", show(data.acHolderName)], ["Account Number", show(data.acNumber)], ["IFSC Code", show(data.ifscCode)], ["Bank Branch", show(data.bankBranch)]
  ]);
  const documents = section("Documents Checklist", [["Submitted Documents", show(data.submittedDocuments)]]);
  const html = "<!doctype html><html><head><meta charset='utf-8'><title>Gold Loan Application</title><style>body{font:13px Arial,sans-serif;color:#1f2937;max-width:980px;margin:26px auto}h1{color:#805b08;border-bottom:3px solid #b8860b;padding-bottom:10px}h2{font-size:16px;color:#805b08;margin:20px 0 6px}p{color:#64748b}.details,.articles{width:100%;border-collapse:collapse;margin:0 0 14px;table-layout:fixed}.details th,.details td,.articles th,.articles td{padding:7px;border:1px solid #d8d1c0;text-align:left;overflow-wrap:anywhere}.details th,.articles th{background:#fff4d2}.details th{width:18%}.details td{width:32%}.photos{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0}.photos figure{margin:0;text-align:center}.photos img{display:block;width:145px;height:145px;object-fit:contain;border:1px solid #d8d1c0;margin-top:5px}.articles{font-size:12px}tr{page-break-inside:avoid}@page{size:A4 portrait;margin:12mm}@media print{body{margin:0;max-width:none}}</style></head><body><h1>Gold Loan Application</h1><p>Application No.: " + show(data.appNo) + " &nbsp; | &nbsp; Application Date: " + showDate(data.appDate) + "</p>" + (photos ? "<h2>Photographs</h2><div class='photos'>" + photos + "</div>" : "") + application + borrower + customerBank + nominee + valuation + "<h2>Pledged Gold Articles</h2><table class='articles'><thead><tr><th>Sl.</th><th>Article</th><th>Purity</th><th>Gross Wt.</th><th>Less Stone</th><th>Net Wt.</th><th>Rate / g</th><th>Assessed Value</th></tr></thead><tbody>" + (articleRows || "<tr><td colspan='8'>No article details found.</td></tr>") + "</tbody></table>" + loan + bank + documents + "<p>This is a computer-generated application record.</p><script>window.onload=()=>window.print();</script></body></html>";
  popup.document.write(html);
  popup.document.close();
}
