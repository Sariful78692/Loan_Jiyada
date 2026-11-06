let goldLoans = [];
let goldEmiPayments = [];
let selectedGoldLoan = null;
let goldLoanCurrentPage = 1;

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
  document.getElementById("gold-loan-search").addEventListener("input", () => {
    goldLoanCurrentPage = 1;
    renderGoldLoanCustomers();
  });
  document.getElementById("gold-loan-page-size").addEventListener("change", () => {
    goldLoanCurrentPage = 1;
    renderGoldLoanCustomers();
  });
  document.getElementById("gold-loan-prev").addEventListener("click", () => {
    if (goldLoanCurrentPage > 1) { goldLoanCurrentPage--; renderGoldLoanCustomers(); }
  });
  document.getElementById("gold-loan-next").addEventListener("click", () => {
    goldLoanCurrentPage++;
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
    body.innerHTML = '<tr><td colspan="14" style="padding:30px;text-align:center;color:#c43b2d">Could not load Gold Loan customers.</td></tr>';
  }
}

function renderGoldLoanLoadingState(body) {
  const columns = 14;
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
  const query = document.getElementById("gold-loan-search").value.trim().toLocaleLowerCase();
  const loans = goldLoans.filter(loan => [loan.ID, loan["Borrower Name"], loan["Mobile No"]]
    .some(value => String(value || "").toLocaleLowerCase().includes(query)));
  if (!loans.length) {
    goldLoanCurrentPage = 1;
    body.innerHTML = `<tr><td colspan="14" style="padding:30px;text-align:center">${query ? "No customer found for this ID, name or mobile number." : "No Gold Loan customers found."}</td></tr>`;
    updateGoldLoanPagination(0, 1, 1);
    return;
  }
  const pageSizeValue = document.getElementById("gold-loan-page-size").value;
  const pageSize = pageSizeValue === "all" ? Math.max(loans.length, 1) : Number(pageSizeValue || 10);
  const pageCount = Math.max(1, Math.ceil(loans.length / pageSize));
  goldLoanCurrentPage = Math.min(goldLoanCurrentPage, pageCount);
  const startIndex = (goldLoanCurrentPage - 1) * pageSize;
  const visibleLoans = loans.slice(startIndex, startIndex + pageSize);
  body.innerHTML = visibleLoans.map(loan => {
    const id = goldHtml(loan.ID);
    const customerPhoto = goldPhotoUrls(loan["Nominee Photo URL"]);
    const goldPhoto = goldPhotoUrls(loan["Gold Item Photo URL"]);
    const emiCount = goldEmiPayments.filter(payment => String(payment["Loan ID"]) === String(loan.ID)).length;
    const isEmi = String(loan["Repayment Method"] || "").toLowerCase() === "emi";
    const firstDateLabel = String(loan["Loan Tenure Unit"] || "Months").trim().toLowerCase() === "days" ? "First Payment Date" : "First EMI Date";
    return `<tr>
      <td class="gold-id-cell"><strong>${goldHtml(loan.ID || "—")}</strong></td>
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
  updateGoldLoanPagination(loans.length, pageSize, pageCount);
  body.querySelectorAll(".gold-details-photo").forEach(image => {
    if (image.complete) finishGoldPhotoLoad({ target: image });
  });
}

function updateGoldLoanPagination(total, pageSize, pageCount) {
  const allSelected = document.getElementById("gold-loan-page-size").value === "all";
  const start = total ? (allSelected ? 1 : (goldLoanCurrentPage - 1) * pageSize + 1) : 0;
  const end = total ? (allSelected ? total : Math.min(goldLoanCurrentPage * pageSize, total)) : 0;
  document.getElementById("gold-loan-page-info").textContent = `Showing ${start}–${end} of ${total}`;
  document.getElementById("gold-loan-page-label").textContent = `Page ${goldLoanCurrentPage} of ${pageCount}`;
  document.getElementById("gold-loan-prev").disabled = allSelected || goldLoanCurrentPage <= 1;
  document.getElementById("gold-loan-next").disabled = allSelected || goldLoanCurrentPage >= pageCount;
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
  if (button.dataset.action === "print") {
    printGoldLoanDetails(loan);
    return;
  }
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
  const printFrame = document.createElement("iframe");
  printFrame.setAttribute("aria-hidden", "true");
  Object.assign(printFrame.style, { position: "absolute", top: "-10000px", left: "-10000px", width: "900px", height: "800px", border: "0" });
  document.body.appendChild(printFrame);
  const popup = printFrame.contentWindow;
  const show = value => value === "" || value == null ? "—" : goldHtml(value);
  const showMoney = value => value === "" || value == null ? "—" : goldMoney(value);
  const showDate = value => {
    if (!value) return "—";
    const raw = String(value);
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
    return Number.isNaN(date.getTime()) ? goldHtml(raw) : date.toLocaleDateString("en-GB").replaceAll("/", "-");
  };
  const showRate = value => value === "" || value == null ? "—" : goldHtml(value);
  const showWeight = value => value === "" || value == null ? "—" : `${goldHtml(value)} g`;
  const pairs = items => {
    let output = "";
    for (let index = 0; index < items.length; index += 2) {
      const left = items[index], right = items[index + 1];
      output += `<tr><th>${left[0]}</th><td>${left[1]}</td>${right ? `<th>${right[0]}</th><td>${right[1]}</td>` : "<th></th><td></td>"}</tr>`;
    }
    return output;
  };
  const section = (title, items) => `<h2>${title}</h2><table class="details">${pairs(items)}</table>`;
  const photo = (label, value) => {
    const urls = goldPhotoUrls(value);
    return urls.length ? `<figure><figcaption>${label}</figcaption><img src="${goldHtml(urls[0])}" data-photo-candidates="${goldHtml(urls.join("|"))}" alt="${label}"></figure>` : "";
  };
  const customerPhoto = photo("Customer Photo", loan["Nominee Photo URL"]);
  const goldPhoto = photo("Pledged Gold Photo", loan["Gold Item Photo URL"]);
  const appDetails = section("Application & Branch Details", [
    ["Application No.", show(loan["Application No"])], ["Application Date", showDate(loan["Application Date"])],
    ["Branch Name", show(loan["Branch Name"])], ["Branch Code", show(loan["Branch Code"])],
    ["Loan Officer Name", show(loan["Loan Officer Name"])], ["CSP Location", show(loan["CSP Location"])]
  ]);
  const borrower = section("Borrower Details", [
    ["Borrower Name", show(loan["Borrower Name"])], ["Mobile No.", show(loan["Mobile No"])],
    ["Identity No.", show(loan["Identity No"])], ["Address", show(loan["Address"])],
    ["Monthly Income", showMoney(loan["Monthly Income"])], ["Guardian Name", show(loan["Guardian Name"])],
    ["Gender", show(loan["Gender"])], ["Date of Birth", showDate(loan["DOB"])],
    ["Religion", show(loan["Religion"])], ["Aadhaar No.", show(loan["Aadhaar No"])], ["Occupation", show(loan["Occupation"])]
  ]);
  const photoRow = (image, details) => `<div class="photo-detail-row">${image ? `<div class="photos">${image}</div>` : "<div></div>"}<div>${details}</div></div>`;
  const customerBank = section("Customer Bank Details", [
    ["Bank Name", show(loan["Customer Bank Name"])], ["Bank Branch", show(loan["Customer Bank Branch"])],
    ["IFSC Code", show(loan["Customer IFSC Code"])], ["Account Holder", show(loan["Customer Account Holder"])], ["Account Number", show(loan["Customer Account Number"])]
  ]);
  const nominee = section("Nominee Details", [
    ["Nominee Name", show(loan["Nominee Name"])], ["Guardian Name", show(loan["Nominee Guardian Name"])],
    ["Gender", show(loan["Nominee Gender"])], ["Occupation", show(loan["Nominee Occupation"])],
    ["Date of Birth", showDate(loan["Nominee DOB"])], ["Aadhaar No.", show(loan["Nominee Aadhaar"])], ["Relation with Applicant", show(loan["Relation With Applicant"])]
  ]);
  const valuation = section("Gold Valuation", [
    ["Valuation Date", showDate(loan["Valuation Date"])], ["Total Gross Weight", showWeight(loan["Total Gross Weight (g)"])],
    ["Total Net Weight", showWeight(loan["Total Net Weight (g)"])], ["Total Assessed Value", showMoney(loan["Total Assessed Value"])],
    ["LTV", showRate(loan["LTV (%)"]) + (loan["LTV (%)"] === "" || loan["LTV (%)"] == null ? "" : "%")], ["Eligible Amount", showMoney(loan["Eligible Amount"])]
  ]);
  const tenureUnit = loan["Loan Tenure Unit"] || "Months";
  const dayTenure = String(tenureUnit).toLowerCase() === "days";
  const loanDetails = section("Loan & Repayment Details", [
    ["Loan Amount Requested", showMoney(loan["Loan Amount Requested"])], ["Processing Charge", showMoney(loan["Processing Charge"])],
    ["Document Charge", showMoney(loan["Document Charge"])], ["Net Disbursement Amount", showMoney(loan["Net Disbursement Amount"])],
    ["Tenure", show(loan["Loan Tenure"]) + " " + goldHtml(tenureUnit)], ["Interest Rate", showRate(loan["Rate of Interest (%)"]) + (loan["Rate of Interest (%)"] === "" || loan["Rate of Interest (%)"] == null ? "" : (dayTenure ? "% per month" : "% p.a."))],
    ["Repayment Method", show(loan["Repayment Method"])], ["Installment / Interest Amount", showMoney(loan["Installment Amount"] || loan["EMI Amount"])],
    ["Total Interest", showMoney(loan["Total Interest"])], ["Total Payable", showMoney(loan["Total Payable"])],
    [dayTenure ? "First Payment Date" : "First EMI Date", showDate(loan["First EMI Date"])], ["EMI Close Date", showDate(loan["EMI Close Date"])],
    ["Maturity Date", showDate(loan["Maturity Date"])], ["Purpose of Loan", show(loan["Purpose of Loan"])],
    ["Scheme", show(loan["Scheme"])], ["Disbursement Mode", show(loan["Disbursement Mode"])]
  ]);
  const cashMode = String(loan["Disbursement Mode"] || "").trim().toLowerCase() === "cash";
  const disbursementBank = cashMode ? "" : section("Disbursement Bank Details", [
    ["Bank Name", show(loan["Bank Name"])], ["Account Holder", show(loan["A/C Holder Name"])],
    ["Account Number", show(loan["A/C Number"])], ["IFSC Code", show(loan["IFSC Code"])], ["Bank Branch", show(loan["Branch"])]
  ]);
  const documents = section("Documents Checklist", [["Submitted Documents", show(loan["Submitted Documents"])]]);
  const articles = (() => { try { return JSON.parse(loan["Gold Articles Details"] || "[]"); } catch (_) { return []; } })();
  const articleRows = articles.map(article => `<tr><td>${goldHtml(article.description || "—")}</td><td>${goldHtml(article.purity || "—")}</td><td>${Number(article.grossWeight || 0).toFixed(3)} g</td><td>${Number(article.stoneWeight || 0).toFixed(3)} g</td><td>${Number(article.netWeight || 0).toFixed(3)} g</td><td>${goldMoney(article.ratePerGram)}</td><td>${goldMoney(article.assessedValue)}</td></tr>`).join("");
  const logoUrl = localStorage.getItem("goldPrintLogoDataUrl") || "";
  const logoUrls = goldPhotoUrls(logoUrl);
  const logo = logoUrl ? `<img class="print-logo" src="${goldHtml(logoUrls[0] || logoUrl)}" data-photo-candidates="${goldHtml((logoUrls.length ? logoUrls : [logoUrl]).join("|"))}" alt="Gold Loan logo">` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Gold Loan Application</title><style>*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#1f2937;max-width:100%;margin:0}.print-header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:2px solid #b8860b;margin-bottom:3px}.print-heading{min-width:0}h1{font-size:16px;color:#805b08;padding:0 0 3px;margin:0 0 2px}.application-id{font-size:15px;font-weight:700;color:#111827;margin:0 0 2px}.print-logo{display:block;max-width:105px;max-height:50px;object-fit:contain}h2{font-size:11px;color:#805b08;margin:2px 0 1px}.print-header p{color:#64748b;margin:2px 0 4px}.photo-detail-row{display:grid;grid-template-columns:3.5cm minmax(0,1fr);gap:6px;align-items:start;margin:0}.photo-detail-row+.photo-detail-row{margin-top:-5px}.details,.articles{width:100%;border-collapse:collapse;margin:0 0 2px;table-layout:fixed}.details th,.details td,.articles th,.articles td{padding:2.5px 3px;border:1px solid #d8d1c0;text-align:left;overflow-wrap:anywhere;line-height:1.12}.details th,.articles th{background:#fff4d2}.details th{width:18%}.details td{width:32%}.photos{display:flex;flex-direction:column;align-items:flex-start;gap:0;margin:0}.photos figure{margin:0;text-align:center;line-height:1}.photos img{display:block;width:3.5cm;height:4.5cm;object-fit:contain;border:1px solid #d8d1c0;margin-top:2px}.articles{font-size:9px}tr{page-break-inside:avoid}@page{size:A4 portrait;margin:7mm}@media print{body{margin:0}}</style></head><body><header class="print-header"><div class="print-heading"><h1>Gold Loan Application</h1><div class="application-id">ID: ${goldHtml(loan.ID || "—")}</div><p>Application No.: ${show(loan["Application No"])} &nbsp; | &nbsp; Application Date: ${show(loan["Application Date"])}</p></div>${logo}</header>${photoRow(customerPhoto, appDetails)}${photoRow(goldPhoto, borrower)}${customerBank}${nominee}${valuation}<h2>Pledged Gold Articles</h2><table class="articles"><thead><tr><th>Sl.</th><th>Article</th><th>Purity</th><th>Gross Wt.</th><th>Less Stone</th><th>Net Wt.</th><th>Rate / g</th><th>Assessed Value</th></tr></thead><tbody>${articleRows || '<tr><td colspan="8">No article details found.</td></tr>'}</tbody></table>${loanDetails}${disbursementBank}${documents}<p>This is a computer-generated application record.</p><script>window.onload=()=>window.print();</script></body></html>`;
  popup.document.write(html);
  popup.document.close();
  const cleanupPrintFrame = () => printFrame.remove();
  popup.addEventListener("afterprint", cleanupPrintFrame, { once: true });
  waitForGoldPrintImages(popup).then(() => {
    popup.focus();
    popup.print();
  });
  setTimeout(cleanupPrintFrame, 60000);
}

function waitForGoldPrintImages(printWindow) {
  const images = Array.from(printWindow.document.images);
  return Promise.all(images.map(image => new Promise(resolve => {
    let candidates = (image.dataset.photoCandidates || image.src || "").split("|").filter(Boolean);
    let candidateIndex = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(finish, 12000);
    image.onload = finish;
    image.onerror = () => {
      candidateIndex++;
      if (candidateIndex < candidates.length) image.src = candidates[candidateIndex];
      else finish();
    };
    if (image.complete) {
      if (image.naturalWidth) finish();
      else image.onerror();
    }
  })));
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
