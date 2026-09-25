let goldEmiLoans = [];
let goldEmiPayments = [];
let currentGoldEmiLoan = null;

const goldEmiMoney = value => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const goldEmiEscape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

document.addEventListener("DOMContentLoaded", () => {
  fetchGoldEmiData();
  document.getElementById("gold-emi-filter-apply").addEventListener("click", renderGoldEmiLoans);
  document.getElementById("gold-emi-filter-clear").addEventListener("click", () => {
    document.getElementById("gold-emi-filter-start").value = "";
    document.getElementById("gold-emi-filter-end").value = "";
    renderGoldEmiLoans();
  });
  document.getElementById("gold-emi-body").addEventListener("click", event => {
    const button = event.target.closest("[data-loan-id]");
    if (!button) return;
    currentGoldEmiLoan = goldEmiLoans.find(loan => String(loan.ID) === button.dataset.loanId);
    if (currentGoldEmiLoan) openGoldEmiPayment();
  });
  document.getElementById("gold-emi-form").addEventListener("submit", submitGoldEmiPayment);
  ["gold-emi-close", "gold-emi-cancel"].forEach(id => document.getElementById(id).addEventListener("click", closeGoldEmiPayment));
  document.getElementById("gold-emi-payment-date").addEventListener("change", updateGoldEmiFineField);
  document.getElementById("gold-emi-fine").addEventListener("input", updateGoldEmiSummary);
});

async function fetchGoldEmiData() {
  const body = document.getElementById("gold-emi-body");
  try {
    const response = await fetch(APPS_SCRIPT_URL + "?t=" + Date.now());
    const data = await response.json();
    goldEmiLoans = data.gold_loans || [];
    goldEmiPayments = normalizeGoldEmiPayments(data.gold_emi_payments || [], data.collections || []);
    renderGoldEmiLoans();
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="7" style="padding:28px;text-align:center;color:#c43b2d">Could not load Gold Loan EMI accounts.</td></tr>';
  }
}

function normalizeGoldEmiPayments(savedPayments, collections) {
  const normalized = new Map();
  savedPayments.forEach(payment => {
    const loanId = String(payment["Loan ID"] || "");
    const date = String(payment["Payment Date"] || payment["Paid Date"] || payment["Due Date"] || "");
    normalized.set(`${loanId}|${date}`, payment);
  });
  collections.filter(item => String(item["Loan Type"] || "").toLowerCase() === "gold loan").forEach(item => {
    const loanId = String(item["Customer ID"] || "");
    const date = String(item["Collection Date"] || "").slice(0, 10);
    const key = `${loanId}|${date}`;
    if (!normalized.has(key)) normalized.set(key, {
      "Loan ID": loanId, "Receipt ID": item["Collection ID"] || "", "Application No": "",
      "Customer Name": item["Customer Name"] || "", "Mobile No": "", "Payment Date": date,
      "Installment Number": "", "EMI Amount": item.Amount || 0, "Fine Amount": 0,
      "Total Paid": item.Amount || 0
    });
  });
  return Array.from(normalized.values());
}

function parseGoldEmiDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00`);
  const parts = text.split(/[-/]/).map(Number);
  if (parts.length === 3 && parts[2] > 31) return new Date(parts[2], parts[1] - 1, parts[0]);
  return null;
}

function dateToIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayGoldEmiDate(value) {
  const date = value instanceof Date ? value : parseGoldEmiDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-GB").replaceAll("/", "-") : "—";
}

function getFirstEmiDate(loan) {
  const saved = parseGoldEmiDate(loan["First EMI Date"]);
  if (saved) return saved;
  const applicationDate = parseGoldEmiDate(loan["Application Date"]);
  if (!applicationDate) return null;
  applicationDate.setDate(applicationDate.getDate() + 30);
  return applicationDate;
}

function getPaymentCount(loanId) {
  return goldEmiPayments.filter(payment => String(payment["Loan ID"] || "") === String(loanId)).length;
}

function nextGoldEmiDueDate(loan) {
  const firstDate = getFirstEmiDate(loan);
  if (!firstDate) return null;
  firstDate.setDate(firstDate.getDate() + getPaymentCount(loan.ID) * 30);
  return firstDate;
}

function renderGoldEmiLoans() {
  const body = document.getElementById("gold-emi-body");
  const start = document.getElementById("gold-emi-filter-start").value;
  const end = document.getElementById("gold-emi-filter-end").value;
  if (start && end && start > end) {
    body.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#c43b2d">Start date must be before end date.</td></tr>';
    return;
  }
  const loans = goldEmiLoans.filter(loan => {
    if (String(loan["Repayment Method"] || "").toLowerCase() !== "emi") return false;
    const date = String(loan["Application Date"] || "").slice(0, 10);
    return (!start || date >= start) && (!end || date <= end);
  });
  if (!loans.length) {
    body.innerHTML = '<tr><td colspan="7" style="padding:30px;text-align:center">No EMI Gold Loan account found.</td></tr>';
    return;
  }
  body.innerHTML = loans.map(loan => {
    const paid = getPaymentCount(loan.ID);
    const tenure = Number(loan["Loan Tenure"] || 0);
    const firstDate = getFirstEmiDate(loan);
    const nextDate = nextGoldEmiDueDate(loan);
    const firstCell = `${goldEmiEscape(displayGoldEmiDate(firstDate))}<small class="gold-emi-count">Next EMI: ${goldEmiEscape(displayGoldEmiDate(nextDate))} (${paid}/${tenure} paid)</small>`;
    const action = paid >= tenure
      ? '<span class="gold-status">Paid in full</span>'
      : `<button type="button" class="gold-action gold-pay" data-loan-id="${goldEmiEscape(loan.ID)}"><i class="fa-solid fa-money-bill-wave"></i> Pay EMI #${paid + 1}</button>`;
    return `<tr><td>${goldEmiEscape(loan["Application No"] || loan.ID)}</td><td><strong>${goldEmiEscape(loan["Borrower Name"] || "—")}</strong></td><td>${goldEmiEscape(loan["Mobile No"] || "—")}</td><td>${goldEmiMoney(loan["Loan Amount Requested"])}</td><td>${firstCell}</td><td>${goldEmiEscape(displayGoldEmiDate(loan["EMI Close Date"] || loan["Maturity Date"]))}</td><td>${action}</td></tr>`;
  }).join("");
}

function openGoldEmiPayment() {
  const dueDate = nextGoldEmiDueDate(currentGoldEmiLoan);
  if (!dueDate) return alert("The application or first EMI date is missing.");
  const today = new Date();
  const todayIso = dateToIso(today);
  document.getElementById("gold-emi-customer").textContent = `${currentGoldEmiLoan["Borrower Name"] || "Customer"} · Application ${currentGoldEmiLoan["Application No"] || currentGoldEmiLoan.ID}`;
  document.getElementById("gold-emi-due-date").value = dateToIso(dueDate);
  document.getElementById("gold-emi-payment-date").value = todayIso;
  document.getElementById("gold-emi-fine").value = "0";
  document.getElementById("gold-emi-modal").classList.remove("hidden");
  updateGoldEmiFineField();
}

function updateGoldEmiFineField() {
  const dueDate = document.getElementById("gold-emi-due-date").value;
  const paidDate = document.getElementById("gold-emi-payment-date").value;
  const isLate = Boolean(dueDate && paidDate && paidDate > dueDate);
  const fineWrap = document.getElementById("gold-fine-wrap");
  fineWrap.classList.toggle("hidden", !isLate);
  // The field is hidden for on-time payments; native required validation would
  // block the form while the control is not focusable.
  document.getElementById("gold-emi-fine").required = false;
  if (!isLate) document.getElementById("gold-emi-fine").value = "0";
  updateGoldEmiSummary();
}

function updateGoldEmiSummary() {
  if (!currentGoldEmiLoan) return;
  const emi = Number(currentGoldEmiLoan["Installment Amount"] || currentGoldEmiLoan["EMI Amount"] || 0);
  const fine = Number(document.getElementById("gold-emi-fine").value || 0);
  const paidDate = document.getElementById("gold-emi-payment-date").value;
  const dueDate = document.getElementById("gold-emi-due-date").value;
  const late = dueDate && paidDate > dueDate;
  document.getElementById("gold-emi-summary").textContent = `EMI ${goldEmiMoney(emi)}${late ? ` + fine ${goldEmiMoney(fine)}` : ""} · Total ${goldEmiMoney(emi + (late ? fine : 0))}`;
}

function closeGoldEmiPayment() {
  document.getElementById("gold-emi-modal").classList.add("hidden");
  currentGoldEmiLoan = null;
}

async function submitGoldEmiPayment(event) {
  event.preventDefault();
  if (!currentGoldEmiLoan) return;
  const dueDate = document.getElementById("gold-emi-due-date").value;
  const paymentDate = document.getElementById("gold-emi-payment-date").value;
  if (!dueDate || !paymentDate) return alert("Due date and payment date are required.");
  const isLate = paymentDate > dueDate;
  const fineAmount = Number(document.getElementById("gold-emi-fine").value || 0);
  if (isLate && !(fineAmount > 0)) return alert("Enter the fine amount for this missed EMI.");
  const receiptWindow = window.open("", "_blank", "width=700,height=750");
  if (!receiptWindow) return alert("Please allow pop-ups to print the EMI receipt.");
  const submit = document.getElementById("gold-emi-submit");
  submit.disabled = true;
  submit.textContent = "Saving payment…";
  try {
    let response = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "record_gold_emi_installment", loanId: currentGoldEmiLoan.ID, dueDate, paymentDate, fineAmount }) });
    let result = await response.json();
    if (result.status !== "success" && /action not matched|unknown action/i.test(String(result.message || ""))) {
      response = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({
        action: "collectInstallment", customerId: currentGoldEmiLoan.ID,
        customerName: currentGoldEmiLoan["Borrower Name"] || "", loanType: "Gold Loan",
        collectionDate: paymentDate,
        amount: Number(currentGoldEmiLoan["Installment Amount"] || currentGoldEmiLoan["EMI Amount"] || 0) + fineAmount
      }) });
      const legacyResult = await response.json();
      if (legacyResult.status === "success") {
        result = {
          status: "success", receiptId: `GEMI-${Date.now()}`, loanId: currentGoldEmiLoan.ID,
          applicationNo: currentGoldEmiLoan["Application No"] || "",
          customerName: currentGoldEmiLoan["Borrower Name"] || "",
          mobileNo: currentGoldEmiLoan["Mobile No"] || "", installmentNumber: getPaymentCount(currentGoldEmiLoan.ID) + 1,
          dueDate, paymentDate,
          emiAmount: Number(currentGoldEmiLoan["Installment Amount"] || currentGoldEmiLoan["EMI Amount"] || 0),
          fineAmount, totalPaid: Number(currentGoldEmiLoan["Installment Amount"] || currentGoldEmiLoan["EMI Amount"] || 0) + fineAmount
        };
      } else {
        result = legacyResult;
      }
    }
    if (result.status !== "success") throw new Error(result.message || "Could not save EMI payment.");
    printGoldEmiPaymentReceipt(receiptWindow, result);
    window.location.href = "Report.html?type=goldEmiPayments";
  } catch (error) {
    receiptWindow.close();
    alert(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Pay EMI & Print Receipt";
  }
}

function printGoldEmiPaymentReceipt(popup, receipt) {
  popup.document.write(`<!doctype html><html><head><title>Gold Loan EMI Receipt</title><style>body{font:15px Arial,sans-serif;color:#172033;padding:30px;max-width:650px;margin:auto}.head{border-bottom:3px solid #b8860b;padding-bottom:14px;display:flex;justify-content:space-between}h1{margin:0;color:#805b08;font-size:25px}.muted{color:#64748b;font-size:13px}table{border-collapse:collapse;width:100%;margin:22px 0}td{padding:10px;border-bottom:1px solid #dbe3ed}.total{font-size:20px;font-weight:bold;color:#805b08}@media print{body{padding:0}}</style></head><body><div class="head"><div><h1>Gold Loan EMI Receipt</h1><div class="muted">Loan Management</div></div><div class="muted">Receipt: ${goldEmiEscape(receipt.receiptId)}<br>Paid: ${goldEmiEscape(displayGoldEmiDate(receipt.paymentDate))}</div></div><table><tr><td>Customer Name</td><td><strong>${goldEmiEscape(receipt.customerName)}</strong></td></tr><tr><td>Application No.</td><td>${goldEmiEscape(receipt.applicationNo)}</td></tr><tr><td>Mobile Number</td><td>${goldEmiEscape(receipt.mobileNo)}</td></tr><tr><td>Installment No.</td><td>${receipt.installmentNumber}</td></tr><tr><td>Due Date</td><td>${goldEmiEscape(displayGoldEmiDate(receipt.dueDate))}</td></tr><tr><td>EMI Amount</td><td>${goldEmiMoney(receipt.emiAmount)}</td></tr><tr><td>Fine Amount</td><td>${goldEmiMoney(receipt.fineAmount)}</td></tr><tr><td class="total">Total Paid</td><td class="total">${goldEmiMoney(receipt.totalPaid)}</td></tr></table><p class="muted">This is a computer-generated payment receipt.</p><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
}
