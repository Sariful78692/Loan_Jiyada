let goldEmiLoans = [];
let goldEmiPayments = [];
let currentGoldEmiLoan = null;
let goldDailyAmountManuallyEdited = false;
let goldDailyEarliestDate = "";
let lastGoldReceipt = null;
let goldEmiCurrentPage = 1;

const goldEmiMoney = value => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const goldEmiEscape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

document.addEventListener("DOMContentLoaded", () => {
  fetchGoldEmiData();
  document.getElementById("gold-emi-search").addEventListener("input", () => {
    goldEmiCurrentPage = 1;
    renderGoldEmiLoans();
  });
  document.getElementById("gold-emi-page-size").addEventListener("change", () => {
    goldEmiCurrentPage = 1;
    renderGoldEmiLoans();
  });
  document.getElementById("gold-emi-prev").addEventListener("click", () => {
    if (goldEmiCurrentPage > 1) { goldEmiCurrentPage--; renderGoldEmiLoans(); }
  });
  document.getElementById("gold-emi-next").addEventListener("click", () => {
    goldEmiCurrentPage++;
    renderGoldEmiLoans();
  });
  document.getElementById("gold-emi-body").addEventListener("click", event => {
    const button = event.target.closest("[data-loan-id]");
    if (!button) return;
    if (!window.confirm("Are you sure you want to collect this payment?")) return;
    currentGoldEmiLoan = goldEmiLoans.find(loan => String(loan.ID) === button.dataset.loanId);
    if (currentGoldEmiLoan) openGoldEmiPayment();
  });
  document.getElementById("gold-emi-form").addEventListener("submit", submitGoldEmiPayment);
  document.getElementById("gold-emi-print").addEventListener("click", printLastGoldReceipt);
  ["gold-emi-close", "gold-emi-cancel"].forEach(id => document.getElementById(id).addEventListener("click", closeGoldEmiPayment));
  document.getElementById("gold-emi-payment-date").addEventListener("change", updateGoldEmiFineField);
  document.getElementById("gold-emi-fine").addEventListener("input", updateGoldEmiSummary);
  ["gold-daily-from", "gold-daily-to"].forEach(id => document.getElementById(id).addEventListener("input", () => {
    const from = document.getElementById("gold-daily-from").value;
    document.getElementById("gold-daily-to").min = from || goldDailyEarliestDate;
    goldDailyAmountManuallyEdited = false;
    updateGoldDailyCollectionSummary();
  }));
  document.getElementById("gold-daily-amount").addEventListener("input", () => {
    goldDailyAmountManuallyEdited = true;
    updateGoldDailyCollectionSummary();
  });
  document.getElementById("gold-daily-principal").addEventListener("input", updateGoldDailyCollectionSummary);
});

async function fetchGoldEmiData() {
  const body = document.getElementById("gold-emi-body");
  body.innerHTML = '<tr><td colspan="10" role="status" style="padding:30px;text-align:center"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Loading EMI accounts…</td></tr>';
  try {
    invalidateAppDataCache();
    const data = await fetchAppData("", true);
    goldEmiLoans = data.gold_loans || [];
    goldEmiPayments = normalizeGoldEmiPayments(data.gold_emi_payments || [], data.collections || []);
    renderGoldEmiLoans();
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="10" style="padding:28px;text-align:center;color:#c43b2d">Could not load Gold Loan EMI accounts.</td></tr>';
  }
}

function normalizeGoldEmiPayments(savedPayments, collections) {
  const normalized = new Map();
  savedPayments.forEach(payment => {
    const loanId = String(payment["Loan ID"] || "");
    const date = String(payment["Payment Date"] || payment["Paid Date"] || payment["Due Date"] || "");
    normalized.set(`${loanId}|${payment["Payment ID"] || payment["Receipt ID"] || date}`, payment);
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
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return new Date(`${isoDate[1]}T00:00:00`);
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

function getGoldEmiPaymentMonth(payment) {
  const value = String(payment["Payment Date"] || payment["Paid Date"] || payment["Installment Month"] || payment["Due Date"] || "").trim();
  const isoMonth = value.match(/^(\d{4}-\d{2})/);
  if (isoMonth) return isoMonth[1];
  const parsedDate = parseGoldEmiDate(value);
  return parsedDate ? dateToIso(parsedDate).slice(0, 7) : "";
}

function hasGoldEmiPaidThisMonth(loanId) {
  const thisMonth = dateToIso(new Date()).slice(0, 7);
  return goldEmiPayments.some(payment =>
    String(payment["Loan ID"] || "") === String(loanId) && getGoldEmiPaymentMonth(payment) === thisMonth
  );
}

function nextGoldEmiDueDate(loan) {
  const firstDate = getFirstEmiDate(loan);
  if (!firstDate) return null;
  firstDate.setDate(firstDate.getDate() + getPaymentCount(loan.ID) * 30);
  return firstDate;
}

function renderGoldEmiLoans() {
  const body = document.getElementById("gold-emi-body");
  const todayIso = dateToIso(new Date());
  const eligibleLoans = goldEmiLoans.filter(loan => ["emi", "daily interest"].includes(String(loan["Repayment Method"] || "").trim().toLowerCase()));
  const query = (document.getElementById("gold-emi-search")?.value || "").trim().toLocaleLowerCase();
  const loans = eligibleLoans.filter(loan => !query || [loan["Borrower Name"], loan["Mobile No"]]
    .some(value => String(value || "").toLocaleLowerCase().includes(query)));
  if (!eligibleLoans.length) {
    goldEmiCurrentPage = 1;
    body.innerHTML = '<tr><td colspan="10" style="padding:30px;text-align:center">No EMI Gold Loan account found.</td></tr>';
    updateGoldEmiPagination(0, 1, 1);
    return;
  }
  if (!loans.length) {
    goldEmiCurrentPage = 1;
    body.innerHTML = '<tr><td colspan="10" style="padding:30px;text-align:center">No customer found for this name or mobile number.</td></tr>';
    updateGoldEmiPagination(0, 1, 1);
    return;
  }
  const pageSizeValue = document.getElementById("gold-emi-page-size").value;
  const pageSize = pageSizeValue === "all" ? Math.max(loans.length, 1) : Number(pageSizeValue || 10);
  const pageCount = Math.max(1, Math.ceil(loans.length / pageSize));
  goldEmiCurrentPage = Math.min(goldEmiCurrentPage, pageCount);
  const startIndex = (goldEmiCurrentPage - 1) * pageSize;
  const pageLoans = loans.slice(startIndex, startIndex + pageSize);
  body.innerHTML = pageLoans.map(loan => {
    const paid = getPaymentCount(loan.ID);
    const tenure = Number(loan["Loan Tenure"] || 0);
    const firstDate = getFirstEmiDate(loan);
    const nextDate = nextGoldEmiDueDate(loan);
    const isDailyInterest = String(loan["Repayment Method"] || "").trim().toLowerCase() === "daily interest";
    const dailyInterestDaysDue = isDailyInterest ? getGoldDailyDueDays(loan) : 0;
    const dailyInterestDaysPaid = isDailyInterest ? getGoldDailyPaidDays(loan.ID) : 0;
    const firstCell = isDailyInterest
      ? `${goldEmiEscape(displayGoldEmiDate(firstDate))}<small class="gold-emi-count">Daily interest repayment</small>`
      : `${goldEmiEscape(displayGoldEmiDate(firstDate))}<small class="gold-emi-count">Next EMI: ${goldEmiEscape(displayGoldEmiDate(nextDate))} (${paid}/${tenure} paid)</small>`;
    const action = isDailyInterest
      ? Number(loan["Outstanding Principal"] ?? loan["Loan Amount Requested"] ?? 0) <= 0
        ? '<span class="gold-status">Paid in full</span>'
        : `<button type="button" class="gold-action gold-pay" data-loan-id="${goldEmiEscape(loan.ID)}" title="Collect interest for ${dailyInterestDaysDue} unpaid days"><i class="fa-solid fa-money-bill-wave" aria-hidden="true"></i> Collect</button>`
      : paid >= tenure
      ? '<span class="gold-status">Paid in full</span>'
      : hasGoldEmiPaidThisMonth(loan.ID)
        ? '<span class="gold-status">EMI paid this month</span>'
      : `<button type="button" class="gold-action gold-pay" data-loan-id="${goldEmiEscape(loan.ID)}"><i class="fa-solid fa-money-bill-wave"></i> Collect</button>`;
    const emiAmount = isDailyInterest
      ? getGoldDailyPrincipal(loan) * Number(loan["Rate of Interest (%)"] || 0) / 100 / 30
      : loan["Installment Amount"] || loan["EMI Amount"] || 0;
    const applicationDays = getGoldDaysFromApplicationToToday(loan["Application Date"]);
    return `<tr><td>${goldEmiEscape(loan["Application No"] || loan.ID)}</td><td>${goldEmiEscape(displayGoldEmiDate(loan["Application Date"]))}<br><small class="gold-application-days">${applicationDays} days</small></td><td><strong>${goldEmiEscape(loan["Borrower Name"] || "—")}</strong></td><td>${goldEmiEscape(loan["Guardian Name"] || "—")}</td><td>${goldEmiEscape(loan["Mobile No"] || "—")}</td><td>${goldEmiMoney(loan["Loan Amount Requested"])}</td><td>${goldEmiMoney(emiAmount)}</td><td>${firstCell}</td><td>${goldEmiEscape(displayGoldEmiDate(loan["EMI Close Date"] || loan["Maturity Date"]))}</td><td>${action}</td></tr>`;
  }).join("");
  updateGoldEmiPagination(loans.length, pageSize, pageCount);
}

function updateGoldEmiPagination(total, pageSize, pageCount) {
  const info = document.getElementById("gold-emi-page-info");
  const label = document.getElementById("gold-emi-page-label");
  const previous = document.getElementById("gold-emi-prev");
  const next = document.getElementById("gold-emi-next");
  const allSelected = document.getElementById("gold-emi-page-size").value === "all";
  const start = total ? (allSelected ? 1 : (goldEmiCurrentPage - 1) * pageSize + 1) : 0;
  const end = total ? (allSelected ? total : Math.min(goldEmiCurrentPage * pageSize, total)) : 0;
  info.textContent = `Showing ${start}–${end} of ${total}`;
  label.textContent = `Page ${goldEmiCurrentPage} of ${pageCount}`;
  previous.disabled = allSelected || goldEmiCurrentPage <= 1;
  next.disabled = allSelected || goldEmiCurrentPage >= pageCount;
}

function openGoldEmiPayment() {
  lastGoldReceipt = null;
  document.getElementById("gold-emi-print").classList.add("hidden");
  const isDailyInterest = String(currentGoldEmiLoan["Repayment Method"] || "").trim().toLowerCase() === "daily interest";
  const dailyInterestPaidToday = isDailyInterest && hasGoldDailyInterestPaymentOnDate(currentGoldEmiLoan.ID, dateToIso(new Date()));
  document.getElementById("gold-emi-form").classList.toggle("gold-compact-modal", isDailyInterest);
  document.getElementById("gold-emi-form").classList.toggle("gold-daily-modal", isDailyInterest);
  document.getElementById("gold-daily-collection-fields").classList.toggle("hidden", !isDailyInterest);
  document.getElementById("gold-daily-due-interest-wrap").classList.toggle("hidden", !isDailyInterest);
  document.getElementById("gold-daily-tenure-interest-wrap").classList.toggle("hidden", !isDailyInterest);
  document.querySelector("#gold-emi-modal-title").textContent = isDailyInterest ? (currentGoldEmiLoan["Borrower Name"] || "Customer") : "Collect EMI";
  const submitButton = document.getElementById("gold-emi-submit");
  submitButton.hidden = false;
  submitButton.disabled = false;
  if (isDailyInterest) {
    const applicationDate = currentGoldEmiLoan["Application Date"];
    const applicationDays = getGoldDaysFromApplicationToToday(applicationDate);
    document.getElementById("gold-emi-customer").innerHTML = `Application Date: ${goldEmiEscape(displayGoldEmiDate(applicationDate))} · Closing Date: <strong class="gold-closing-date">${goldEmiEscape(displayGoldEmiDate(currentGoldEmiLoan["EMI Close Date"] || currentGoldEmiLoan["Maturity Date"]))}</strong> · <strong class="gold-application-days">${applicationDays} days</strong>`;
  }
  document.getElementById("gold-emi-submit").textContent = isDailyInterest ? "Collect & Print Receipt" : "Pay EMI & Print Receipt";
  document.getElementById("gold-emi-due-date").parentElement.classList.toggle("hidden", isDailyInterest);
  document.getElementById("gold-emi-payment-date").parentElement.classList.toggle("hidden", isDailyInterest);
  document.getElementById("gold-fine-wrap").classList.add("hidden");
  if (isDailyInterest) {
    const todayIso = dateToIso(new Date());
    const previousEnd = getGoldDailyLastPaidDate(currentGoldEmiLoan.ID);
    let fromDate = previousEnd ? new Date(previousEnd.getTime()) : parseGoldEmiDate(currentGoldEmiLoan["Application Date"] || currentGoldEmiLoan["First EMI Date"]);
    if (!fromDate) fromDate = new Date();
    if (previousEnd) fromDate.setDate(fromDate.getDate() + 1);
    if (dateToIso(fromDate) > todayIso) fromDate = new Date(`${todayIso}T00:00:00`);
    goldDailyEarliestDate = dateToIso(fromDate);
    document.getElementById("gold-daily-from").value = dateToIso(fromDate);
    document.getElementById("gold-daily-to").value = todayIso;
    document.getElementById("gold-daily-from").min = goldDailyEarliestDate;
    document.getElementById("gold-daily-to").min = goldDailyEarliestDate;
    document.getElementById("gold-daily-to").max = todayIso;
    document.getElementById("gold-daily-amount").value = "";
    document.getElementById("gold-daily-principal").value = "0";
    goldDailyAmountManuallyEdited = false;
    document.getElementById("gold-emi-modal").classList.remove("hidden");
    updateGoldDailyCollectionSummary();
    if (dailyInterestPaidToday) {
      submitButton.textContent = "Collect Payment";
    }
    return;
  }
  if (hasGoldEmiPaidThisMonth(currentGoldEmiLoan.ID)) {
    return alert("This month's EMI has already been paid for this loan.");
  }
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

function isGoldDailyInterestPayment(payment) {
  const paymentType = String(getGoldDailyPaymentValue(payment, "Payment Type", "paymentType") || "").toLowerCase();
  return paymentType.includes("daily interest") || Boolean(getGoldDailyPaymentValue(payment, "Period Start", "Start Date", "startDate") || getGoldDailyPaymentValue(payment, "Period End", "End Date", "endDate"));
}

function getGoldDailyPaymentValue(payment, ...names) {
  for (const name of names) {
    if (payment[name] !== undefined && payment[name] !== null && payment[name] !== "") return payment[name];
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = Object.keys(payment).find(candidate => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedName);
    if (key && payment[key] !== undefined && payment[key] !== null && payment[key] !== "") return payment[key];
  }
  return "";
}

function getGoldDaysFromApplicationToToday(applicationDate) {
  const start = parseGoldEmiDate(applicationDate);
  const today = parseGoldEmiDate(dateToIso(new Date()));
  if (!start || !today || start > today) return 0;
  return Math.floor((today - start) / 86400000) + 1;
}

function getGoldDailyLastPaidDate(loanId) {
  return goldEmiPayments
    .filter(payment => String(getGoldDailyPaymentValue(payment, "Loan ID", "loanId") || "") === String(loanId) && isGoldDailyInterestPayment(payment))
    .map(payment => parseGoldEmiDate(getGoldDailyPaymentValue(payment, "Period End", "End Date", "endDate", "Paid Date", "Payment Date", "paymentDate")))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;
}

function getGoldDailyDueDays(loan) {
  const lastPaid = getGoldDailyLastPaidDate(loan.ID);
  const start = lastPaid
    ? new Date(lastPaid.getTime())
    : parseGoldEmiDate(loan["Application Date"] || loan["First EMI Date"]);
  if (lastPaid) start.setDate(start.getDate() + 1);
  const today = parseGoldEmiDate(dateToIso(new Date()));
  if (!start || !today || start > today) return 0;
  return Math.floor((today - start) / 86400000) + 1;
}

function getGoldDailyPaidDays(loanId) {
  const intervals = goldEmiPayments
    .filter(payment => String(getGoldDailyPaymentValue(payment, "Loan ID", "loanId") || "") === String(loanId) && isGoldDailyInterestPayment(payment))
    .map(payment => {
      const end = parseGoldEmiDate(getGoldDailyPaymentValue(payment, "Period End", "End Date", "endDate", "Payment Date", "Paid Date", "paymentDate"));
      let start = parseGoldEmiDate(getGoldDailyPaymentValue(payment, "Period Start", "Start Date", "startDate"));
      const days = Number(getGoldDailyPaymentValue(payment, "Days", "Period Days", "days") || 0);
      if (!start && end && days > 0) {
        start = new Date(end.getTime());
        start.setDate(start.getDate() - days + 1);
      }
      return start && end && end >= start ? { start, end } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  let totalDays = 0;
  let start = null;
  let end = null;
  intervals.forEach(interval => {
    if (!start) { start = interval.start; end = interval.end; return; }
    const nextDayAfterEnd = new Date(end.getTime());
    nextDayAfterEnd.setDate(nextDayAfterEnd.getDate() + 1);
    if (interval.start <= nextDayAfterEnd) {
      if (interval.end > end) end = interval.end;
      return;
    }
    totalDays += Math.floor((end - start) / 86400000) + 1;
    start = interval.start;
    end = interval.end;
  });
  if (start && end) totalDays += Math.floor((end - start) / 86400000) + 1;
  return totalDays;
}

function hasGoldDailyPaidDateInRange(loanId, startDate, endDate) {
  const selectedStart = parseGoldEmiDate(startDate);
  const selectedEnd = parseGoldEmiDate(endDate);
  if (!selectedStart || !selectedEnd) return false;
  return goldEmiPayments.some(payment => {
    if (String(getGoldDailyPaymentValue(payment, "Loan ID", "loanId") || "") !== String(loanId) || !isGoldDailyInterestPayment(payment)) return false;
    const paidStart = parseGoldEmiDate(getGoldDailyPaymentValue(payment, "Period Start", "Start Date", "startDate"));
    const paidEnd = parseGoldEmiDate(getGoldDailyPaymentValue(payment, "Period End", "End Date", "endDate", "Payment Date", "Paid Date", "paymentDate"));
    return paidStart && paidEnd && selectedStart <= paidEnd && selectedEnd >= paidStart;
  });
}

function getGoldDailyInterestPaid(loanId) {
  return goldEmiPayments
    .filter(payment => String(getGoldDailyPaymentValue(payment, "Loan ID", "loanId") || "") === String(loanId) && isGoldDailyInterestPayment(payment))
    .reduce((total, payment) => total + Math.max(0, Number(getGoldDailyPaymentValue(payment, "Interest Amount", "interestAmount") || 0)), 0);
}

function hasGoldDailyInterestPaymentOnDate(loanId, dateIso) {
  return goldEmiPayments.some(payment => {
    if (String(payment["Loan ID"] || "") !== String(loanId) || !isGoldDailyInterestPayment(payment)) return false;
    const rawDate = String(payment["Payment Date"] || payment["Paid Date"] || "").trim();
    const normalizedDate = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : rawDate;
    const paidDate = parseGoldEmiDate(normalizedDate);
    return Boolean(paidDate && dateToIso(paidDate) === dateIso);
  });
}

function getGoldDailyPrincipal(loan) {
  const originalPrincipal = Math.max(0, Number(loan["Loan Amount Requested"]) || 0);
  const principalPaid = goldEmiPayments
    .filter(payment => String(payment["Loan ID"] || "") === String(loan.ID))
    .reduce((total, payment) => total + Math.max(0, Number(payment["Principal Paid"] || 0)), 0);
  return Math.max(0, Math.round((originalPrincipal - principalPaid) * 100) / 100);
}

function updateGoldDailyCollectionSummary() {
  if (!currentGoldEmiLoan || String(currentGoldEmiLoan["Repayment Method"] || "").toLowerCase() !== "daily interest") return;
  const from = parseGoldEmiDate(document.getElementById("gold-daily-from").value);
  const to = parseGoldEmiDate(document.getElementById("gold-daily-to").value);
  const principal = getGoldDailyPrincipal(currentGoldEmiLoan);
  const monthlyRate = Number(currentGoldEmiLoan["Rate of Interest (%)"] || 0);
  if (!from || !to || to < from) {
    const daysCount = document.getElementById("gold-daily-days-count");
    daysCount.classList.remove("gold-days-selected");
    daysCount.textContent = "Select a valid date range to see the number of days.";
    document.getElementById("gold-daily-summary").textContent = "Select a valid date range.";
    return;
  }
  const days = Math.floor((to - from) / 86400000) + 1;
  const daysCount = document.getElementById("gold-daily-days-count");
  daysCount.classList.add("gold-days-selected");
  daysCount.textContent = `${days} day${days === 1 ? "" : "s"} selected`;
  const dailyInterest = Math.round((principal * monthlyRate / 100 / 30) * 100) / 100;
  const interestDue = Math.round((principal * monthlyRate / 100 * days / 30 + Number(currentGoldEmiLoan["Accrued Interest Balance"] || 0)) * 100) / 100;
  const amountInput = document.getElementById("gold-daily-amount");
  if (!goldDailyAmountManuallyEdited) amountInput.value = interestDue.toFixed(2);
  const payment = Number(amountInput.value || 0);
  document.getElementById("gold-emi-principal-total").textContent = goldEmiMoney(principal);
  document.getElementById("gold-emi-interest-label").textContent = `Paid Interest · ${getGoldDailyPaidDays(currentGoldEmiLoan.ID)} days paid`;
  const interestPayment = Math.min(payment, interestDue);
  document.getElementById("gold-emi-interest-total").textContent = goldEmiMoney(getGoldDailyInterestPaid(currentGoldEmiLoan.ID));
  document.getElementById("gold-daily-due-interest").textContent = goldEmiMoney(interestDue);
  const originalPrincipal = Math.max(0, Number(currentGoldEmiLoan["Loan Amount Requested"]) || 0);
  const tenureDays = Math.max(0, Number(currentGoldEmiLoan["Loan Tenure"]) || 0);
  const savedTenureInterest = Number(currentGoldEmiLoan["Total Interest"]);
  const totalTenureInterest = savedTenureInterest > 0 ? savedTenureInterest : originalPrincipal * monthlyRate / 100 * tenureDays / 30;
  document.getElementById("gold-daily-tenure-interest").textContent = goldEmiMoney(totalTenureInterest);
  const principalInput = Number(document.getElementById("gold-daily-principal").value || 0);
  const principalPaid = Math.min(principal, Math.max(0, principalInput));
  const newPrincipal = Math.round((principal - principalPaid) * 100) / 100;
  const newDailyInterest = Math.round((newPrincipal * monthlyRate / 100 / 30) * 100) / 100;
  document.getElementById("gold-daily-summary").textContent = `${days} days · Interest/day ${goldEmiMoney(dailyInterest)} · Due for period ${goldEmiMoney(interestDue)} · Interest payment ${goldEmiMoney(interestPayment)} · Principal repaid ${goldEmiMoney(principalPaid)} · Remaining principal ${goldEmiMoney(newPrincipal)} · New daily interest ${goldEmiMoney(newDailyInterest)} · Total payment ${goldEmiMoney(interestPayment + principalPaid)}`;
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
  const principal = Number(currentGoldEmiLoan["Outstanding Principal"] ?? currentGoldEmiLoan["Loan Amount Requested"] ?? 0);
  const totalInterest = Number(currentGoldEmiLoan["Total Interest"] || Math.max(0, Number(currentGoldEmiLoan["Total Payable"] || 0) - Number(currentGoldEmiLoan["Loan Amount Requested"] || 0)));
  const fine = Number(document.getElementById("gold-emi-fine").value || 0);
  const paidDate = document.getElementById("gold-emi-payment-date").value;
  const dueDate = document.getElementById("gold-emi-due-date").value;
  const late = dueDate && paidDate > dueDate;
  document.getElementById("gold-emi-principal-total").textContent = goldEmiMoney(principal);
  document.getElementById("gold-emi-interest-label").textContent = "Total Interest";
  document.getElementById("gold-emi-interest-total").textContent = goldEmiMoney(totalInterest);
  document.getElementById("gold-emi-summary").textContent = `EMI ${goldEmiMoney(emi)}${late ? ` + fine ${goldEmiMoney(fine)}` : ""} · Total ${goldEmiMoney(emi + (late ? fine : 0))}`;
}

function closeGoldEmiPayment() {
  document.getElementById("gold-emi-modal").classList.add("hidden");
  document.getElementById("gold-emi-print").classList.add("hidden");
  lastGoldReceipt = null;
  currentGoldEmiLoan = null;
}

async function submitGoldEmiPayment(event) {
  event.preventDefault();
  if (!currentGoldEmiLoan) return;
  if (String(currentGoldEmiLoan["Repayment Method"] || "").trim().toLowerCase() === "daily interest") {
    return submitGoldDailyPayment();
  }
  if (hasGoldEmiPaidThisMonth(currentGoldEmiLoan.ID)) {
    closeGoldEmiPayment();
    renderGoldEmiLoans();
    return alert("This month's EMI has already been paid for this loan.");
  }
  const dueDate = document.getElementById("gold-emi-due-date").value;
  const paymentDate = document.getElementById("gold-emi-payment-date").value;
  if (!dueDate || !paymentDate) return alert("Due date and payment date are required.");
  const isLate = paymentDate > dueDate;
  const fineAmount = Number(document.getElementById("gold-emi-fine").value || 0);
  if (isLate && !(fineAmount > 0)) return alert("Enter the fine amount for this missed EMI.");
  const submit = document.getElementById("gold-emi-submit");
  submit.disabled = true;
  submit.textContent = "Saving payment…";
  try {
    const response = await postAppData({ action: "record_gold_emi_installment", loanId: currentGoldEmiLoan.ID, dueDate, paymentDate, fineAmount });
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "Could not save EMI payment.");
    lastGoldReceipt = { type: "emi", data: result };
    document.getElementById("gold-emi-print").classList.remove("hidden");
    document.getElementById("gold-emi-submit").textContent = "Payment Saved";
    await fetchGoldEmiData();
  } catch (error) {
    alert(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = lastGoldReceipt ? "Payment Saved" : "Pay EMI";
  }
}

async function submitGoldDailyPayment() {
  const startDate = document.getElementById("gold-daily-from").value;
  const endDate = document.getElementById("gold-daily-to").value;
  const amount = Number(document.getElementById("gold-daily-amount").value || 0);
  const principalAmount = Number(document.getElementById("gold-daily-principal").value || 0);
  if (hasGoldDailyInterestPaymentOnDate(currentGoldEmiLoan.ID, dateToIso(new Date()))) return alert("Daily interest has already been collected for this loan today.");
  if (!startDate || !endDate || endDate < startDate) return alert("Select a valid from and to date.");
  if (goldDailyEarliestDate && startDate < goldDailyEarliestDate) return alert(`Interest collection cannot start before ${displayGoldEmiDate(goldDailyEarliestDate)}. This prevents charging for dates already paid.`);
  if (hasGoldDailyPaidDateInRange(currentGoldEmiLoan.ID, startDate, endDate)) return alert("This date range includes dates for which interest has already been paid. Select unpaid dates only.");
  if (endDate > dateToIso(new Date())) return alert("Collection date range cannot end in the future.");
  if (!(amount > 0)) return alert("Enter a payment amount greater than zero.");
  const principal = getGoldDailyPrincipal(currentGoldEmiLoan);
  if (!Number.isFinite(principalAmount) || principalAmount < 0 || principalAmount > principal) return alert(`Principal repayment must be between ₹0 and ${goldEmiMoney(principal)}.`);
  const days = Math.floor((parseGoldEmiDate(endDate) - parseGoldEmiDate(startDate)) / 86400000) + 1;
  const interestDue = Math.round((principal * Number(currentGoldEmiLoan["Rate of Interest (%)"] || 0) / 100 * days / 30 + Number(currentGoldEmiLoan["Accrued Interest Balance"] || 0)) * 100) / 100;
  if (amount > interestDue) return alert(`Daily interest payment cannot exceed the interest due (${goldEmiMoney(interestDue)}). Principal is not changed by an interest payment.`);
  const submit = document.getElementById("gold-emi-submit");
  submit.disabled = true;
  submit.textContent = "Saving payment…";
  try {
    const response = await postAppData({ action: "record_gold_daily_interest_payment", loanId: currentGoldEmiLoan.ID, startDate, endDate, amount, principalAmount });
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "Could not save the daily interest payment.");
    lastGoldReceipt = { type: "daily", data: result };
    document.getElementById("gold-emi-print").classList.remove("hidden");
    await fetchGoldEmiData();
    currentGoldEmiLoan = goldEmiLoans.find(loan => String(loan.ID) === String(result.loanId || currentGoldEmiLoan.ID)) || currentGoldEmiLoan;
    const paidThrough = getGoldDailyLastPaidDate(currentGoldEmiLoan.ID);
    if (paidThrough) {
      paidThrough.setDate(paidThrough.getDate() + 1);
      document.getElementById("gold-daily-from").value = dateToIso(paidThrough);
    }
    goldDailyEarliestDate = document.getElementById("gold-daily-from").value;
    document.getElementById("gold-daily-from").min = goldDailyEarliestDate;
    document.getElementById("gold-daily-to").min = goldDailyEarliestDate;
    document.getElementById("gold-daily-to").value = dateToIso(new Date());
    goldDailyAmountManuallyEdited = false;
    updateGoldDailyCollectionSummary();
  } catch (error) {
    alert(error.message);
  } finally {
    submit.disabled = false;
    if (lastGoldReceipt) submit.hidden = true;
    else submit.textContent = "Collect & Print Receipt";
  }
}

function printLastGoldReceipt() {
  if (!lastGoldReceipt) return;
  const popup = window.open("", "_blank", "width=700,height=750");
  if (!popup) return alert("Please allow pop-ups to print the payment receipt.");
  if (lastGoldReceipt.type === "daily") printGoldDailyReceipt(popup, lastGoldReceipt.data);
  else printGoldEmiPaymentReceipt(popup, lastGoldReceipt.data);
}

function printGoldDailyReceipt(popup, receipt) {
  popup.document.write(`<!doctype html><html><head><title>Daily Interest Collection Receipt</title><style>body{font:15px Arial,sans-serif;color:#172033;padding:30px;max-width:650px;margin:auto}h1{color:#805b08;border-bottom:3px solid #b8860b;padding-bottom:12px}table{border-collapse:collapse;width:100%;margin:22px 0}td{padding:10px;border-bottom:1px solid #dbe3ed}.total{font-size:19px;font-weight:bold;color:#805b08}.muted{color:#64748b}</style></head><body><h1>Daily Interest Collection Receipt</h1><p class="muted">Receipt: ${goldEmiEscape(receipt.receiptId)} · Date: ${goldEmiEscape(displayGoldEmiDate(receipt.paymentDate))}</p><table><tr><td>Customer</td><td>${goldEmiEscape(receipt.customerName)}</td></tr><tr><td>Application No.</td><td>${goldEmiEscape(receipt.applicationNo)}</td></tr><tr><td>Interest period</td><td>${goldEmiEscape(displayGoldEmiDate(receipt.startDate))} to ${goldEmiEscape(displayGoldEmiDate(receipt.endDate))} (${receipt.days} days)</td></tr><tr><td>Interest collected</td><td>${goldEmiMoney(receipt.interestPaid)}</td></tr><tr><td>Principal repaid</td><td>${goldEmiMoney(receipt.principalPaid)}</td></tr><tr><td>Principal balance</td><td>${goldEmiMoney(receipt.outstandingPrincipal)}</td></tr><tr><td class="total">Total paid</td><td class="total">${goldEmiMoney(receipt.totalPaid)}</td></tr></table><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
}

function printGoldEmiPaymentReceipt(popup, receipt) {
  popup.document.write(`<!doctype html><html><head><title>Gold Loan EMI Receipt</title><style>body{font:15px Arial,sans-serif;color:#172033;padding:30px;max-width:650px;margin:auto}.head{border-bottom:3px solid #b8860b;padding-bottom:14px;display:flex;justify-content:space-between}h1{margin:0;color:#805b08;font-size:25px}.muted{color:#64748b;font-size:13px}table{border-collapse:collapse;width:100%;margin:22px 0}td{padding:10px;border-bottom:1px solid #dbe3ed}.total{font-size:20px;font-weight:bold;color:#805b08}@media print{body{padding:0}}</style></head><body><div class="head"><div><h1>Gold Loan EMI Receipt</h1><div class="muted">Loan Management</div></div><div class="muted">Receipt: ${goldEmiEscape(receipt.receiptId)}<br>Paid: ${goldEmiEscape(displayGoldEmiDate(receipt.paymentDate))}</div></div><table><tr><td>Customer Name</td><td><strong>${goldEmiEscape(receipt.customerName)}</strong></td></tr><tr><td>Application No.</td><td>${goldEmiEscape(receipt.applicationNo)}</td></tr><tr><td>Mobile Number</td><td>${goldEmiEscape(receipt.mobileNo)}</td></tr><tr><td>Installment No.</td><td>${receipt.installmentNumber}</td></tr><tr><td>Due Date</td><td>${goldEmiEscape(displayGoldEmiDate(receipt.dueDate))}</td></tr><tr><td>EMI Amount</td><td>${goldEmiMoney(receipt.emiAmount)}</td></tr><tr><td>Fine Amount</td><td>${goldEmiMoney(receipt.fineAmount)}</td></tr><tr><td class="total">Total Paid</td><td class="total">${goldEmiMoney(receipt.totalPaid)}</td></tr></table><p class="muted">This is a computer-generated payment receipt.</p><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
}
