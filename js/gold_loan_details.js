let goldLoans = [];
let goldEmiPayments = [];
let selectedGoldLoan = null;

const goldMoney = value => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const goldHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const goldPhotoUrls = value => {
  const url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return [];
  const match = url.match(/[?&]id=([^&]+)/i) || url.match(/\/d\/([^/?]+)/i);
  if (!match) return [url];
  let fileId = match[1];
  try { fileId = decodeURIComponent(fileId); } catch (_) {}
  const id = encodeURIComponent(fileId);
  return [`https://drive.google.com/thumbnail?id=${id}&sz=w600`, `https://drive.google.com/uc?export=view&id=${id}`, `https://lh3.googleusercontent.com/d/${id}=w600`, url];
};

document.addEventListener("DOMContentLoaded", () => {
  loadGoldLoanCustomers();
  document.getElementById("gold-filter-apply").addEventListener("click", renderGoldLoanCustomers);
  document.getElementById("gold-filter-clear").addEventListener("click", () => {
    document.getElementById("gold-filter-start").value = "";
    document.getElementById("gold-filter-end").value = "";
    renderGoldLoanCustomers();
  });
  document.getElementById("gold-loan-details-body").addEventListener("click", handleGoldTableAction);
  document.getElementById("gold-loan-details-body").addEventListener("pointerover", showGoldPhotoPreview);
  document.getElementById("gold-loan-details-body").addEventListener("pointermove", moveGoldPhotoPreview);
  document.getElementById("gold-loan-details-body").addEventListener("pointerout", hideGoldPhotoPreview);
  document.getElementById("gold-loan-details-body").addEventListener("load", finishGoldPhotoLoad, true);
  document.getElementById("gold-loan-details-body").addEventListener("error", finishGoldPhotoLoad, true);
  document.getElementById("gold-emi-form").addEventListener("submit", submitGoldEmiPayment);
  ["gold-emi-close", "gold-emi-cancel"].forEach(id => document.getElementById(id).addEventListener("click", closeGoldEmiModal));
  ["gold-emi-start", "gold-emi-end"].forEach(id => document.getElementById(id).addEventListener("change", updateGoldEmiPreview));
});

async function loadGoldLoanCustomers() {
  const body = document.getElementById("gold-loan-details-body");
  renderGoldLoanLoadingState(body);
  try {
    const data = await fetchAppData();
    goldLoans = data.gold_loans || [];
    goldEmiPayments = normalizeGoldLoanPayments(data.gold_emi_payments || [], data.collections || []);
    renderGoldLoanCustomers();
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="13" style="padding:30px;text-align:center;color:#c43b2d">Could not load Gold Loan customers.</td></tr>';
  }
}

function renderGoldLoanLoadingState(body) {
  const columns = 13;
  const skeletons = Array.from({ length: columns }, () => '<span class="customer-skeleton"></span>').join("");
  const row = `<div class="customer-loading-row" style="grid-template-columns:repeat(${columns},minmax(50px,1fr))">${skeletons}</div>`;
  body.innerHTML = `<tr><td colspan="${columns}" class="customer-loading-cell"><div class="customer-loading-card" role="status" aria-live="polite"><div class="customer-loading-heading"><span class="customer-loading-icon"><i class="fa-solid fa-coins"></i></span><div><strong>Loading Gold Loan customers</strong><span>Fetching customer and loan details…</span></div><i class="fa-solid fa-circle-notch fa-spin customer-loading-spinner" aria-hidden="true"></i></div><div class="customer-skeleton-table" aria-hidden="true"><div class="customer-skeleton-header" style="grid-template-columns:repeat(${columns},minmax(50px,1fr))">${skeletons}</div>${row}${row}${row}</div></div><span class="sr-only">Loading Gold Loan details</span></td></tr>`;
}

function normalizeGoldLoanPayments(savedPayments, collections) {
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
    if (!payments.has(key)) payments.set(key, { "Loan ID": loanId, "Payment Date": date, Amount: item.Amount || 0 });
  });
  return Array.from(payments.values());
}

function renderGoldLoanCustomers() {
  const body = document.getElementById("gold-loan-details-body");
  const start = document.getElementById("gold-filter-start").value;
  const end = document.getElementById("gold-filter-end").value;
  if (start && end && start > end) {
    body.innerHTML = '<tr><td colspan="13" style="padding:24px;text-align:center;color:#c43b2d">Start date must be before end date.</td></tr>';
    return;
  }
  const loans = goldLoans.filter(loan => {
    const appDate = String(loan["Application Date"] || "").slice(0, 10);
    return (!start || appDate >= start) && (!end || appDate <= end);
  });
  if (!loans.length) {
    body.innerHTML = '<tr><td colspan="13" style="padding:30px;text-align:center">No Gold Loan customer found for this date range.</td></tr>';
    return;
  }
  body.innerHTML = loans.map(loan => {
    const id = goldHtml(loan.ID);
    const customerPhoto = goldPhotoUrls(loan["Nominee Photo URL"]);
    const goldPhoto = goldPhotoUrls(loan["Gold Item Photo URL"]);
    const emiCount = goldEmiPayments.filter(payment => String(payment["Loan ID"]) === String(loan.ID)).length;
    const isEmi = String(loan["Repayment Method"] || "").toLowerCase() === "emi";
    const firstDateLabel = String(loan["Loan Tenure Unit"] || "Months").trim().toLowerCase() === "days" ? "First Payment Date" : "First EMI Date";
    return `<tr>
      <td>${goldHtml(loan["Application No"] || loan.ID)}</td>
      <td><strong>${goldHtml(loan["Borrower Name"] || "—")}</strong></td>
      <td>${goldHtml(loan["Guardian Name"] || "—")}</td>
      <td>${goldHtml(loan["Mobile No"] || "—")}</td>
      <td>${customerPhoto.length ? goldPhotoMarkup(customerPhoto, "Customer photo") : "—"}</td>
      <td>${goldPhoto.length ? goldPhotoMarkup(goldPhoto, "Pledged gold photo") : "—"}</td>
      <td>${Number(loan["Total Net Weight (g)"] || 0).toFixed(3)} g</td>
      <td>${goldMoney(loan["Eligible Amount"])}</td>
      <td>${goldMoney(loan["Loan Amount Requested"])}</td>
      <td><small>${firstDateLabel}</small><br>${goldHtml(loan["First EMI Date"] || "—")}</td>
      <td>${goldHtml(loan["EMI Close Date"] || loan["Maturity Date"] || "—")}</td>
      <td>${goldHtml(loan.Status || "Active")}${isEmi ? `<small class="gold-emi-count">${emiCount}/${Number(loan["Loan Tenure"] || 0)} EMI paid</small>` : ""}</td>
      <td class="gold-row-actions">
        <button class="gold-action gold-print" type="button" data-action="print" data-id="${id}" title="Print application" aria-label="Print application"><i class="fa-solid fa-print"></i></button>
        <a class="gold-action gold-edit" href="GoldLoanEntry.html?edit=${encodeURIComponent(loan.ID)}" title="Edit"><i class="fa-solid fa-pen"></i></a>
        <button class="gold-action gold-delete" type="button" data-action="delete" data-id="${id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join("");
  body.querySelectorAll(".gold-details-photo").forEach(image => {
    if (image.complete) finishGoldPhotoLoad({ target: image });
  });
}

function goldPhotoMarkup(urls, alt) {
  const candidates = urls.map(goldHtml).join("|");
  return `<span class="gold-photo-cell is-loading"><span class="gold-photo-loader" role="status" aria-label="Loading photo"></span><img class="gold-details-photo" src="${goldHtml(urls[0])}" alt="${goldHtml(alt)}" data-preview-src="${goldHtml(urls[0])}" data-photo-candidates="${candidates}" data-photo-index="0"></span>`;
}

function finishGoldPhotoLoad(event) {
  const image = event.target;
  if (!image || !image.classList || !image.classList.contains("gold-details-photo")) return;
  const cell = image.closest(".gold-photo-cell");
  if (!cell) return;
  if (event.type === "error" || !image.naturalWidth) {
    const candidates = (image.dataset.photoCandidates || "").split("|").filter(Boolean);
    const nextIndex = Number(image.dataset.photoIndex || 0) + 1;
    if (nextIndex < candidates.length) {
      image.dataset.photoIndex = String(nextIndex);
      image.src = candidates[nextIndex];
      image.dataset.previewSrc = candidates[nextIndex];
      return;
    }
  }
  cell.classList.remove("is-loading");
  if (event.type === "error" || !image.naturalWidth) {
    cell.classList.add("has-error");
    image.alt = "Photo unavailable";
    image.removeAttribute("data-preview-src");
  }
}

async function handleGoldTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const loan = goldLoans.find(item => String(item.ID) === button.dataset.id);
  if (!loan) return;
  if (button.dataset.action === "print") printGoldLoanDetails(loan);
  if (button.dataset.action === "pay") openGoldEmiModal(loan);
  if (button.dataset.action === "delete") await deleteGoldLoan(loan.ID);
}

function showGoldPhotoPreview(event) {
  const image = event.target.closest(".gold-details-photo");
  if (!image || !image.dataset.previewSrc || !image.complete || !image.naturalWidth) return;
  const preview = document.getElementById("gold-photo-preview");
  preview.querySelector("img").src = image.dataset.previewSrc;
  preview.classList.add("visible");
  preview.setAttribute("aria-hidden", "false");
  moveGoldPhotoPreview(event);
}

function moveGoldPhotoPreview(event) {
  const preview = document.getElementById("gold-photo-preview");
  if (!preview.classList.contains("visible")) return;
  const left = Math.min(event.clientX + 18, window.innerWidth - preview.offsetWidth - 12);
  const top = Math.min(event.clientY + 18, window.innerHeight - preview.offsetHeight - 12);
  preview.style.left = `${Math.max(8, left)}px`;
  preview.style.top = `${Math.max(8, top)}px`;
}

function hideGoldPhotoPreview(event) {
  if (event.target.closest(".gold-details-photo")) {
    const preview = document.getElementById("gold-photo-preview");
    preview.classList.remove("visible");
    preview.setAttribute("aria-hidden", "true");
  }
}

function printGoldLoanDetails(loan) {
  const popup = window.open("", "_blank", "width=900,height=800");
  if (!popup) return alert("Please allow pop-ups to print the Gold Loan application.");
  const articleData = (() => { try { return JSON.parse(loan["Gold Articles Details"] || "[]"); } catch (_) { return []; } })();
  const articleRows = articleData.map(article => `<tr><td>${goldHtml(article.description || "—")}</td><td>${goldHtml(article.purity || "—")}</td><td>${Number(article.grossWeight || 0).toFixed(3)} g</td><td>${Number(article.stoneWeight || 0).toFixed(3)} g</td><td>${Number(article.netWeight || 0).toFixed(3)} g</td><td>${goldMoney(article.ratePerGram)}</td><td>${goldMoney(article.assessedValue)}</td></tr>`).join("");
  const photo = (label, url) => url ? `<figure><figcaption>${label}</figcaption><img src="${goldHtml(url)}" alt="${label}"></figure>` : "";
  const photos = photo("Customer Photo", goldPhotoUrls(loan["Nominee Photo URL"])[0]) + photo("Pledged Gold Photo", goldPhotoUrls(loan["Gold Item Photo URL"])[0]);
  const excluded = new Set(["ID", "Timestamp", "Nominee Photo URL", "Gold Item Photo URL", "Gold Articles Details"]);
  const amountFields = new Set(["Monthly Income", "Total Assessed Value", "Eligible Amount", "Loan Amount Requested", "Processing Charge", "Document Charge", "Net Disbursement Amount", "Installment Amount", "EMI Amount", "Total Interest", "Total Payable", "Outstanding Principal", "Accrued Interest Balance"]);
  const detailFields = Object.entries(loan).filter(([label]) => !excluded.has(label));
  const detailRows = Array.from({ length: Math.ceil(detailFields.length / 2) }, (_, rowIndex) => {
    const cells = detailFields.slice(rowIndex * 2, rowIndex * 2 + 2).map(([label, value]) => `<th>${goldHtml(label)}</th><td>${amountFields.has(label) && value !== "" && value != null ? goldMoney(value) : goldHtml(value || "—")}</td>`);
    while (cells.length < 2) cells.push("<th></th><td></td>");
    return `<tr>${cells.join("")}</tr>`;
  });
  const details = detailRows.join("");
  const sideDetails = detailRows.slice(0, 7).join("");
  const remainingDetails = detailRows.slice(7).join("");
  popup.document.write(`<!doctype html><html><head><title>Gold Loan Application</title><style>body{font:14px Arial,sans-serif;color:#1f2937;max-width:900px;margin:28px auto}h1{color:#805b08;border-bottom:3px solid #b8860b;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:16px 0;page-break-inside:auto}tr{page-break-inside:avoid}td,th{padding:8px;border:1px solid #d8d1c0;text-align:left}th{background:#fff4d2}@page{size:A4 landscape;margin:10mm}.print-top-grid{display:grid;grid-template-columns:235px minmax(0,1fr);gap:12px;align-items:start}.print-top-grid h3{margin:8px 0}.details{table-layout:fixed}.details th{width:22%;font-size:11px}.details td{width:28%;font-size:11px}.photos{display:flex;gap:8px;flex-wrap:wrap}.photos figure{margin:0 0 14px;text-align:center}.photos img{display:block;width:108px;height:120px;object-fit:contain;border:1px solid #d8d1c0;margin-top:6px}@media print{body{margin:10mm auto}}</style></head><body><h1>Gold Loan Application</h1><p>Application No: ${goldHtml(loan["Application No"] || loan.ID)} | Date: ${goldHtml(loan["Application Date"] || "—")}</p>${photos ? `<div class="print-top-grid"><section><h3>Photographs</h3><div class="photos">${photos}</div></section><section><h3>Application Details</h3><table class="details">${sideDetails}</table></section></div><table class="details">${remainingDetails}</table>` : `<h3>Application Details</h3><table class="details">${details}</table>`}<h3>Pledged Gold Articles</h3><table><thead><tr><th>Article</th><th>Purity</th><th>Gross Wt.</th><th>Less Stone</th><th>Net Wt.</th><th>Rate / g</th><th>Assessed Value</th></tr></thead><tbody>${articleRows || '<tr><td colspan="7">No article details found.</td></tr>'}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
}

function openGoldEmiModal(loan) {
  selectedGoldLoan = loan;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  document.getElementById("gold-emi-form").reset();
  document.getElementById("gold-emi-start").value = localToday;
  document.getElementById("gold-emi-end").value = localToday;
  document.getElementById("gold-emi-customer").textContent = `${loan["Borrower Name"] || "Customer"} · ${goldMoney(loan["Installment Amount"] || loan["EMI Amount"])} per month`;
  document.getElementById("gold-emi-modal").classList.remove("hidden");
  updateGoldEmiPreview();
}

function closeGoldEmiModal() {
  document.getElementById("gold-emi-modal").classList.add("hidden");
  selectedGoldLoan = null;
}

function countMonthsBetween(start, end) {
  if (!start || !end || start > end) return 0;
  const from = start.split("-").map(Number), to = end.split("-").map(Number);
  return (to[0] - from[0]) * 12 + to[1] - from[1] + 1;
}

function updateGoldEmiPreview() {
  const start = document.getElementById("gold-emi-start").value;
  const end = document.getElementById("gold-emi-end").value;
  const months = countMonthsBetween(start, end);
  const installment = Number(selectedGoldLoan?.["Installment Amount"] || selectedGoldLoan?.["EMI Amount"] || 0);
  document.getElementById("gold-emi-preview").textContent = months
    ? `${months} monthly installment${months === 1 ? "" : "s"} · Total ${goldMoney(months * installment)}`
    : "Choose a valid start and end date.";
}

async function submitGoldEmiPayment(event) {
  event.preventDefault();
  if (!selectedGoldLoan) return;
  const startDate = document.getElementById("gold-emi-start").value;
  const endDate = document.getElementById("gold-emi-end").value;
  if (!startDate || !endDate || startDate > endDate) return alert("Please select a valid start and end date.");
  const receiptWindow = window.open("", "_blank", "width=700,height=750");
  if (!receiptWindow) return alert("Please allow pop-ups to print the EMI receipt.");
  const button = document.getElementById("gold-emi-submit");
  button.disabled = true;
  button.textContent = "Saving payment…";
  try {
    const response = await postAppData({ action: "record_gold_emi_payment", loanId: selectedGoldLoan.ID, startDate, endDate });
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message || "EMI payment could not be saved.");
    closeGoldEmiModal();
    printGoldEmiReceipt(receiptWindow, result);
    await loadGoldLoanCustomers();
  } catch (error) {
    receiptWindow.close();
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Save EMI & Print Receipt";
  }
}

function printGoldEmiReceipt(popup, receipt) {
  const months = (receipt.installmentMonths || []).map(month => `<li>${goldHtml(month)}</li>`).join("");
  popup.document.write(`<!doctype html><html><head><title>Gold Loan EMI Receipt</title><style>body{font:15px Arial,sans-serif;color:#172033;padding:30px;max-width:650px;margin:auto}.head{border-bottom:3px solid #b8860b;padding-bottom:14px;display:flex;justify-content:space-between}h1{margin:0;color:#805b08;font-size:25px}.muted{color:#64748b;font-size:13px}table{border-collapse:collapse;width:100%;margin:22px 0}td{padding:10px;border-bottom:1px solid #dbe3ed}.total{font-size:20px;font-weight:bold;color:#805b08}ul{padding-left:22px}@media print{body{padding:0}}</style></head><body><div class="head"><div><h1>Gold Loan EMI Receipt</h1><div class="muted">Loan Management</div></div><div class="muted">Receipt: ${goldHtml(receipt.receiptId)}<br>Paid: ${goldHtml(receipt.paidDate)}</div></div><table><tr><td>Customer Name</td><td><strong>${goldHtml(receipt.customerName)}</strong></td></tr><tr><td>Application No.</td><td>${goldHtml(receipt.applicationNo)}</td></tr><tr><td>Mobile Number</td><td>${goldHtml(receipt.mobileNo)}</td></tr><tr><td>Installments paid</td><td><ul>${months}</ul></td></tr><tr><td>EMI per month</td><td>${goldMoney(receipt.installmentAmount)}</td></tr><tr><td class="total">Total paid</td><td class="total">${goldMoney(receipt.totalAmount)}</td></tr></table><p class="muted">This is a computer-generated payment receipt.</p><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
}

async function deleteGoldLoan(id) {
  if (!confirm("Delete this Gold Loan customer? This cannot be undone.")) return;
  try {
    const response = await postAppData({ action: "delete_gold_loan", id });
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message);
    await loadGoldLoanCustomers();
  } catch (error) {
    alert("Could not delete Gold Loan customer: " + error.message);
  }
}
