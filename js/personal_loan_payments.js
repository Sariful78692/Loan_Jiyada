(() => {
  const PAYMENT_KEY = "personalLoanPayments_v1";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = value => `₹${(Number(value) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const wholeMoney = value => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const readLocalPayments = () => { try { return JSON.parse(localStorage.getItem(PAYMENT_KEY) || "[]"); } catch (_) { return []; } };
  let databasePayments = null;
  const readPayments = () => databasePayments !== null ? databasePayments : readLocalPayments();
  const loadDatabasePayments = async () => {
    const response = await fetch(`${APPS_SCRIPT_URL}?view=personal_loan_payments&t=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.personal_loan_payments)) throw new Error(data.message || "Personal Loan payment storage is unavailable. Deploy the updated Apps Script.");
    return data.personal_loan_payments;
  };
  const loanTotal = entry => Number(entry["Total Payment"]) || Number(entry["Disbursement Amount"]) || 0;
  const paidTotal = (loanId, payments = readPayments()) => payments.filter(payment => payment.loanId === String(loanId)).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const nextInstallmentAmount = (entry, paidCount, paidAmount) => {
    const count = Number(entry["No. of Instalments"]) || 0;
    const due = Math.max(0, loanTotal(entry) - paidAmount);
    if (!count || !due) return 0;
    return paidCount + 1 >= count ? due : Math.min(Math.round(loanTotal(entry) / count), due);
  };
  const formatDate = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  const scheduleDates = entry => {
    const count = Number(entry["No. of Instalments"]) || 0;
    const startValue = String(entry["Starting Date"] || "").slice(0, 10);
    const start = new Date(`${startValue}T00:00:00Z`);
    if (!count || Number.isNaN(start.getTime())) return [];
    const period = String(entry["Instalment Period"] || "Days");
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      if (period === "Weeks") date.setUTCDate(date.getUTCDate() + index * 7);
      else if (period === "Months") {
        const day = start.getUTCDate();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + index);
        date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
      } else date.setUTCDate(date.getUTCDate() + index);
      return formatDate(date);
    });
  };
  const migrateLocalPayments = async (entries, existingPayments) => {
    const local = readLocalPayments();
    if (!local.length) return existingPayments;
    const remoteKeys = new Set(existingPayments.map(payment => `${payment.loanId}|${payment.installment}`));
    const entryById = new Map(entries.map(entry => [String(entry.ID), entry]));
    const batches = new Map();
    local.forEach(payment => {
      const loanId = String(payment.loanId || "");
      const installment = Number(payment.installment) || 0;
      if (!loanId || !installment || remoteKeys.has(`${loanId}|${installment}`)) return;
      const entry = entryById.get(loanId);
      const batchDate = String(payment.collectionDate || payment.paymentDate || "").slice(0, 10);
      const batchId = String(payment.batchId || `legacy-${loanId}-${batchDate}`);
      if (!batches.has(batchId)) batches.set(batchId, { batchId, loanId, collectionDate: batchDate, customerName: payment.customerName || entry?.["Customer Name"] || "", mobile: payment.mobile || entry?.["Mobile Number"] || "", installments: [] });
      const schedule = entry ? scheduleDates(entry) : [];
      batches.get(batchId).installments.push({ installment, paymentDate: String(payment.installmentDate || schedule[installment - 1] || payment.paymentDate || batchDate).slice(0, 10), amount: Number(payment.amount) || 0 });
    });
    for (const batch of batches.values()) {
      const response = await postAppData({ action: "collect_personal_loan_installments", ...batch });
      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(result.message || "Could not move saved payments into the database.");
    }
    const refreshed = await loadDatabasePayments();
    const refreshedKeys = new Set(refreshed.map(payment => `${payment.loanId}|${payment.installment}`));
    if (local.every(payment => refreshedKeys.has(`${payment.loanId}|${Number(payment.installment)}`))) localStorage.removeItem(PAYMENT_KEY);
    return refreshed;
  };
  const loadEntries = async () => {
    const response = await fetch(`${APPS_SCRIPT_URL}?view=personal_loan_entries&t=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.personal_loan_entries)) throw new Error(data.message || "Could not load Personal Loan accounts.");
    return data.personal_loan_entries;
  };
  const paymentPage = document.getElementById("personal-emi-body");
  if (paymentPage) {
    const message = document.getElementById("personal-emi-message");
    const search = document.getElementById("personal-emi-search");
    const pageSizeSelect = document.getElementById("personal-emi-page-size");
    const paymentModal = document.getElementById("personal-payment-modal");
    let selectedEntry = null;
    let selectedInstallmentDates = [];
    let currentPage = 1;
    let eligible = [];
    loadEntries().then(async entries => {
      eligible = entries.filter(entry => Number(entry["No. of Instalments"]) > 0);
      try {
        databasePayments = await migrateLocalPayments(eligible, await loadDatabasePayments());
      } catch (error) {
        databasePayments = readLocalPayments();
        if (typeof showToast === "function") showToast(error.message || "Payment database is unavailable.", "warning");
      }
      renderPayments();
      paymentPage.addEventListener("click", event => {
        const button = event.target.closest("[data-pay]");
        if (!button) return;
        openPaymentDetails(button.dataset.pay);
      });
    }).catch(error => { paymentPage.innerHTML = `<tr><td colspan="11" style="color:#b91c1c;padding:24px">${esc(error.message)}</td></tr>`; });

    function renderPayments() {
      const query = search.value.trim().toLowerCase();
      const filtered = eligible.filter(entry => [entry["Customer Name"], entry["Mobile Number"]]
        .some(value => String(value || "").toLowerCase().includes(query)));
      const selectedSize = pageSizeSelect.value;
      const pageSize = selectedSize === "all" ? Math.max(filtered.length, 1) : Number(selectedSize || 10);
      const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
      currentPage = Math.min(currentPage, pageCount);
      const startIndex = (currentPage - 1) * pageSize;
      const visibleEntries = filtered.slice(startIndex, startIndex + pageSize);
      const payments = readPayments();
      paymentPage.innerHTML = visibleEntries.length ? visibleEntries.map(entry => {
        const paid = payments.filter(p => p.loanId === String(entry.ID));
        const count = Number(entry["No. of Instalments"]) || 0;
        const period = String(entry["Instalment Period"] || "Days").trim();
        const periodLabel = period === "Months" ? (count === 1 ? "Month" : "Months")
          : period === "Weeks" ? (count === 1 ? "Week" : "Weeks")
            : (count === 1 ? "Day" : "Days");
        const total = loanTotal(entry);
        const due = Math.max(0, total - paidTotal(entry.ID, payments));
        const installmentAmount = nextInstallmentAmount(entry, paid.length, total - due);
        const photo = entry["Customer Photo URL"] ? `<img class="personal-emi-photo" data-customer-photo="${esc(entry["Customer Photo URL"])}" alt="${esc(entry["Customer Name"] || "Customer")} photo" loading="lazy">` : "—";
        const isClosed = paid.length >= count || due <= 0;
        return `<tr><td>${photo}</td><td>${esc(entry["Customer Name"])}</td><td>${esc(entry["Mobile Number"])}</td><td>${esc(entry["Loan Type"])}</td><td>${wholeMoney(total)}</td><td>${wholeMoney(due)}</td><td>${count} ${periodLabel}</td><td>${wholeMoney(installmentAmount || (count ? Math.round(total / count) : 0))}</td><td>${paid.length} / ${count}</td><td>${isClosed ? "Complete" : paid.length + 1}</td><td><button type="button" class="btn-primary${isClosed ? " is-closed" : ""}" data-pay="${esc(entry.ID)}" ${isClosed ? "disabled" : ""}>${isClosed ? "Closed" : "Pay installment"}</button></td></tr>`;
      }).join("") : '<tr><td colspan="11" style="padding:24px;text-align:center">No matching Personal Loan accounts found.</td></tr>';
      paymentPage.querySelectorAll("[data-customer-photo]").forEach(image => {
        if (typeof setImageSourceWithFallback === "function") setImageSourceWithFallback(image, image.dataset.customerPhoto);
        else image.src = image.dataset.customerPhoto;
      });
      const start = filtered.length ? (selectedSize === "all" ? 1 : startIndex + 1) : 0;
      const end = selectedSize === "all" ? filtered.length : Math.min(startIndex + pageSize, filtered.length);
      document.getElementById("personal-emi-page-info").textContent = `Showing ${start}–${end} of ${filtered.length}`;
      document.getElementById("personal-emi-page-label").textContent = `Page ${currentPage} of ${pageCount}`;
      document.getElementById("personal-emi-prev").disabled = selectedSize === "all" || currentPage <= 1;
      document.getElementById("personal-emi-next").disabled = selectedSize === "all" || currentPage >= pageCount;
    }
    search.addEventListener("input", () => { currentPage = 1; renderPayments(); });
    pageSizeSelect.addEventListener("change", () => { currentPage = 1; renderPayments(); });
    document.getElementById("personal-emi-prev").addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderPayments(); } });
    document.getElementById("personal-emi-next").addEventListener("click", () => { currentPage++; renderPayments(); });

    function availableInstallmentDates(entry, payments) {
      const dates = scheduleDates(entry);
      const paidDates = new Set(payments.filter(payment => payment.installmentDate).map(payment => payment.installmentDate));
      const paidNumbers = new Set(payments.filter(payment => !payment.installmentDate).map(payment => Number(payment.installment)));
      return dates.filter((date, index) => !paidDates.has(date) && !paidNumbers.has(index + 1));
    }

    function updatePaymentRange() {
      if (!selectedEntry) return;
      const payments = readPayments().filter(payment => payment.loanId === String(selectedEntry.ID));
      const dates = scheduleDates(selectedEntry);
      const available = availableInstallmentDates(selectedEntry, payments);
      const period = String(selectedEntry["Instalment Period"] || "Days").trim();
      if (period === "Months" || period === "Weeks") {
        selectedInstallmentDates = available.slice(0, 1);
      } else {
        const start = document.getElementById("payment-date-start").value;
        const end = document.getElementById("payment-date-end").value;
        selectedInstallmentDates = available.filter(date => date >= start && date <= end);
      }
      if (!available.length || selectedInstallmentDates[0] !== available[0]) selectedInstallmentDates = [];
      const total = loanTotal(selectedEntry);
      let remaining = Math.max(0, total - paidTotal(selectedEntry.ID, payments));
      let amount = 0;
      const count = dates.length;
      selectedInstallmentDates.forEach(date => {
        const index = dates.indexOf(date);
        const part = index === count - 1 ? remaining : Math.min(Math.round(total / count), remaining);
        amount += part;
        remaining -= part;
      });
      const firstIndex = dates.indexOf(selectedInstallmentDates[0]);
      const lastIndex = dates.indexOf(selectedInstallmentDates.at(-1));
      const installmentLabel = firstIndex === lastIndex ? `${firstIndex + 1} of ${count}` : `${firstIndex + 1}-${lastIndex + 1} of ${count}`;
      document.getElementById("payment-installment-number").textContent = selectedInstallmentDates.length ? installmentLabel : "No unpaid installments in range";
      document.getElementById("payment-installment-amount").textContent = wholeMoney(amount);
      document.getElementById("personal-payment-collect").disabled = selectedInstallmentDates.length === 0;
    }

    document.getElementById("payment-date-start").addEventListener("change", updatePaymentRange);
    document.getElementById("payment-date-end").addEventListener("change", updatePaymentRange);

    function openPaymentDetails(loanId) {
      selectedEntry = eligible.find(item => String(item.ID) === loanId);
      if (!selectedEntry) return;
      const payments = readPayments().filter(payment => payment.loanId === String(selectedEntry.ID));
      const paidCount = payments.length;
      const installmentCount = Number(selectedEntry["No. of Instalments"]) || 0;
      const paidAmount = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      const totalAmount = loanTotal(selectedEntry);
      const dueAmount = Math.max(0, totalAmount - paidAmount);
      const availableDates = availableInstallmentDates(selectedEntry, payments);
      const useSinglePaymentDate = ["Months", "Weeks"].includes(String(selectedEntry["Instalment Period"] || "Days").trim());
      document.getElementById("payment-date-label").textContent = useSinglePaymentDate ? "Payment date" : "Payment date range";
      document.getElementById("payment-date-range-fields").hidden = useSinglePaymentDate;
      document.getElementById("payment-single-date-field").hidden = !useSinglePaymentDate;
      const singleDateInput = document.getElementById("payment-single-date");
      const now = new Date();
      singleDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const startInput = document.getElementById("payment-date-start");
      const endInput = document.getElementById("payment-date-end");
      startInput.min = endInput.min = availableDates[0] || "";
      startInput.max = endInput.max = availableDates.at(-1) || "";
      startInput.value = endInput.value = availableDates[0] || "";
      startInput.disabled = endInput.disabled = availableDates.length === 0;
      document.getElementById("payment-customer-name").textContent = selectedEntry["Customer Name"] || "—";
      document.getElementById("payment-customer-mobile").textContent = selectedEntry["Mobile Number"] || "—";
      document.getElementById("payment-customer-loan-type").textContent = selectedEntry["Loan Type"] || "—";
      document.getElementById("payment-total-amount").textContent = wholeMoney(totalAmount);
      document.getElementById("payment-due-amount").textContent = wholeMoney(dueAmount);
      const progress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
      document.getElementById("payment-progress-percent").textContent = `${progress}%`;
      document.getElementById("payment-progress-bar").value = progress;
      document.getElementById("payment-progress-paid").textContent = wholeMoney(paidAmount);
      document.getElementById("payment-progress-due").textContent = wholeMoney(dueAmount);
      document.getElementById("payment-installment-number").textContent = `${paidCount + 1} of ${installmentCount}`;
      document.getElementById("payment-installment-amount").textContent = wholeMoney(0);
      document.getElementById("personal-payment-modal-error").textContent = "";
      paymentModal.hidden = false;
      updatePaymentRange();
      document.getElementById("personal-payment-collect").focus();
    }

    function closePaymentDetails() {
      paymentModal.hidden = true;
      selectedEntry = null;
    }

    document.getElementById("personal-payment-close").addEventListener("click", closePaymentDetails);
    document.getElementById("personal-payment-cancel").addEventListener("click", closePaymentDetails);
    paymentModal.addEventListener("click", event => { if (event.target === paymentModal) closePaymentDetails(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !paymentModal.hidden) closePaymentDetails(); });
    document.getElementById("personal-payment-collect").addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedEntry) return;
      const loanId = String(selectedEntry.ID);
      const all = readPayments();
      const existing = all.filter(payment => payment.loanId === loanId);
      const count = Number(selectedEntry["No. of Instalments"]) || 0;
      if (existing.length >= count) {
        document.getElementById("personal-payment-modal-error").textContent = "All installments for this loan have already been collected.";
        return;
      }
      const available = availableInstallmentDates(selectedEntry, existing);
      const dates = scheduleDates(selectedEntry);
      const selectedDates = selectedInstallmentDates.filter(date => available.includes(date));
      if (!selectedDates.length || selectedDates[0] !== available[0]) {
        document.getElementById("personal-payment-modal-error").textContent = "Choose a range beginning with the next unpaid installment date.";
        return;
      }
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const batchId = `PL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let remaining = Math.max(0, loanTotal(selectedEntry) - paidTotal(loanId, all));
      const installmentsToSave = [];
      selectedDates.forEach(date => {
        const installment = dates.indexOf(date) + 1;
        const amount = installment === count ? remaining : Math.min(Math.round(loanTotal(selectedEntry) / count), remaining);
        const paymentDate = ["Months", "Weeks"].includes(String(selectedEntry["Instalment Period"] || "Days").trim())
          ? document.getElementById("payment-single-date").value
          : date;
        installmentsToSave.push({ installment, paymentDate, amount });
        remaining -= amount;
      });
      const collectButton = event.currentTarget;
      collectButton.disabled = true;
      try {
        const response = await postAppData({
          action: "collect_personal_loan_installments", batchId, loanId,
          customerName: selectedEntry["Customer Name"] || "", mobile: selectedEntry["Mobile Number"] || "",
          collectionDate: today, installments: installmentsToSave
        });
        const result = await response.json();
        if (!response.ok || result.status !== "success") throw new Error(result.message || "Payment was not saved to the database.");
      } catch (error) {
        collectButton.disabled = false;
        document.getElementById("personal-payment-modal-error").textContent = error.message || "Payment database is unavailable.";
        return;
      }
      databasePayments = [...all, ...installmentsToSave.map(payment => ({ ...payment, batchId, loanId, customerName: selectedEntry["Customer Name"] || "", mobile: selectedEntry["Mobile Number"] || "", collectionDate: today, installmentDate: payment.paymentDate }))];
      const confirmation = `${selectedDates.length} installment${selectedDates.length === 1 ? "" : "s"} collected for ${selectedEntry["Customer Name"] || "the customer"}.`;
      message.textContent = confirmation;
      if (typeof showToast === "function") showToast(confirmation, "success");
      closePaymentDetails();
      renderPayments();
    });
  }

  const reportBody = document.getElementById("personal-report-body");
  if (reportBody) {
    const search = document.getElementById("personal-report-search");
    const total = document.getElementById("personal-report-total");
    const pageSizeSelect = document.getElementById("personal-report-page-size");
    const pageInfo = document.getElementById("personal-report-page-info");
    const pageLabel = document.getElementById("personal-report-page-label");
    const previous = document.getElementById("personal-report-prev");
    const next = document.getElementById("personal-report-next");
    let currentPage = 1;
    const formatDisplayDate = value => {
      const parts = String(value || "").slice(0, 10).split("-");
      return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : String(value || "—");
    };
    const groupPayments = source => {
      const batches = new Map();
      source.forEach(payment => {
        const collectionDate = String(payment.collectionDate || payment.paymentDate || "").slice(0, 10);
        const batchKey = `${payment.loanId || payment.customerName}|${collectionDate}`;
        if (!batches.has(batchKey)) batches.set(batchKey, { batchId: batchKey, loanId: payment.loanId || "", customerName: payment.customerName || "", mobile: payment.mobile || "", collectionDate, paymentDates: [], installmentNumbers: [], amount: 0 });
        const batch = batches.get(batchKey);
        batch.paymentDates.push(String(payment.installmentDate || payment.paymentDate || collectionDate).slice(0, 10));
        batch.installmentNumbers.push(Number(payment.installment) || 0);
        batch.amount += Number(payment.amount) || 0;
      });
      return [...batches.values()].map(batch => {
        const dates = batch.paymentDates.filter(Boolean).sort();
        const installments = batch.installmentNumbers.filter(Boolean).sort((a, b) => a - b);
        const firstDate = dates[0] || batch.collectionDate;
        const lastDate = dates[dates.length - 1] || firstDate;
        const firstInstallment = installments[0] || 0;
        const lastInstallment = installments[installments.length - 1] || firstInstallment;
        return {
          ...batch,
          paymentDateRange: firstDate === lastDate ? formatDisplayDate(firstDate) : `${formatDisplayDate(firstDate)} to ${formatDisplayDate(lastDate)}`,
          installmentRange: firstInstallment === lastInstallment ? String(firstInstallment) : `${firstInstallment} to ${lastInstallment}`
        };
      }).sort((a, b) => String(b.collectionDate).localeCompare(String(a.collectionDate)) || String(b.batchId).localeCompare(String(a.batchId)));
    };
    let payments = groupPayments(readPayments());
    const render = () => {
      const q = search.value.trim().toLowerCase();
      const filtered = payments.filter(p => `${p.customerName} ${p.mobile}`.toLowerCase().includes(q));
      const selectedSize = pageSizeSelect.value;
      const pageSize = selectedSize === "all" ? Math.max(filtered.length, 1) : Number(selectedSize || 10);
      const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
      currentPage = Math.min(currentPage, pageCount);
      const startIndex = (currentPage - 1) * pageSize;
      const visiblePayments = filtered.slice(startIndex, startIndex + pageSize);
      reportBody.innerHTML = visiblePayments.length ? visiblePayments.map(p => `<tr><td>${esc(p.customerName)}</td><td>${esc(p.mobile)}</td><td>${esc(formatDisplayDate(p.collectionDate))}</td><td>${esc(p.paymentDateRange)}</td><td>${esc(p.installmentRange)}</td><td>${money(p.amount)}</td></tr>`).join("") : '<tr><td colspan="6" style="padding:24px;text-align:center">No Personal Loan payments recorded.</td></tr>';
      total.textContent = `Total collected: ${money(filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0))}`;
      const start = filtered.length ? (selectedSize === "all" ? 1 : startIndex + 1) : 0;
      const end = selectedSize === "all" ? filtered.length : Math.min(startIndex + pageSize, filtered.length);
      pageInfo.textContent = `Showing ${start}-${end} of ${filtered.length}`;
      pageLabel.textContent = `Page ${currentPage} of ${pageCount}`;
      previous.disabled = selectedSize === "all" || currentPage <= 1;
      next.disabled = selectedSize === "all" || currentPage >= pageCount;
    };
    search.addEventListener("input", () => { currentPage = 1; render(); });
    pageSizeSelect.addEventListener("change", () => { currentPage = 1; render(); });
    previous.addEventListener("click", () => { if (currentPage > 1) { currentPage--; render(); } });
    next.addEventListener("click", () => { currentPage++; render(); });
    document.getElementById("personal-report-print").addEventListener("click", () => window.print());
    render();
    loadDatabasePayments().then(async remote => {
      if (readLocalPayments().length) remote = await migrateLocalPayments(await loadEntries(), remote);
      databasePayments = remote;
      payments = groupPayments(remote);
      render();
    }).catch(() => {});
  }
})();
