(() => {
  const PAYMENT_KEY = "personalLoanPayments_v1";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = value => `₹${(Number(value) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const wholeMoney = value => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const readPayments = () => { try { return JSON.parse(localStorage.getItem(PAYMENT_KEY) || "[]"); } catch (_) { return []; } };
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
    let currentPage = 1;
    let eligible = [];
    loadEntries().then(entries => {
      eligible = entries.filter(entry => Number(entry["No. of Instalments"]) > 0);
      renderPayments();
      paymentPage.addEventListener("click", event => {
        const button = event.target.closest("[data-pay]");
        if (!button) return;
        openPaymentDetails(button.dataset.pay);
      });
    }).catch(error => { paymentPage.innerHTML = `<tr><td colspan="8" style="color:#b91c1c;padding:24px">${esc(error.message)}</td></tr>`; });

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
        const total = Number(entry["Total Payment"]) || Number(entry["Disbursement Amount"]) || 0;
        return `<tr><td>${esc(entry["Customer Name"])}</td><td>${esc(entry["Mobile Number"])}</td><td>${esc(entry["Loan Type"])}</td><td>${count}</td><td>${wholeMoney(total / count)}</td><td>${paid.length} / ${count}</td><td>${paid.length < count ? paid.length + 1 : "Complete"}</td><td><button type="button" class="btn-primary" data-pay="${esc(entry.ID)}" ${paid.length >= count ? "disabled" : ""}>Pay installment</button></td></tr>`;
      }).join("") : '<tr><td colspan="8" style="padding:24px;text-align:center">No matching Personal Loan accounts found.</td></tr>';
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

    function openPaymentDetails(loanId) {
      selectedEntry = eligible.find(item => String(item.ID) === loanId);
      if (!selectedEntry) return;
      const paidCount = readPayments().filter(payment => payment.loanId === String(selectedEntry.ID)).length;
      const installmentCount = Number(selectedEntry["No. of Instalments"]) || 0;
      const amount = Math.round((Number(selectedEntry["Total Payment"]) || Number(selectedEntry["Disbursement Amount"]) || 0) / installmentCount);
      document.getElementById("payment-customer-name").textContent = selectedEntry["Customer Name"] || "—";
      document.getElementById("payment-customer-mobile").textContent = selectedEntry["Mobile Number"] || "—";
      document.getElementById("payment-customer-loan-type").textContent = selectedEntry["Loan Type"] || "—";
      document.getElementById("payment-installment-number").textContent = `${paidCount + 1} of ${installmentCount}`;
      document.getElementById("payment-installment-amount").textContent = wholeMoney(amount);
      document.getElementById("payment-installment-date").textContent = new Date().toLocaleDateString("en-IN");
      document.getElementById("personal-payment-modal-error").textContent = "";
      paymentModal.hidden = false;
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
    document.getElementById("personal-payment-collect").addEventListener("click", () => {
      if (!selectedEntry) return;
      const loanId = String(selectedEntry.ID);
      const all = readPayments();
      const existing = all.filter(payment => payment.loanId === loanId);
      const count = Number(selectedEntry["No. of Instalments"]) || 0;
      if (existing.length >= count) {
        document.getElementById("personal-payment-modal-error").textContent = "All installments for this loan have already been collected.";
        return;
      }
      const amount = Math.round((Number(selectedEntry["Total Payment"]) || Number(selectedEntry["Disbursement Amount"]) || 0) / count);
      all.push({ loanId, customerName: selectedEntry["Customer Name"] || "", mobile: selectedEntry["Mobile Number"] || "", installment: existing.length + 1, amount, paymentDate: new Date().toISOString().slice(0, 10) });
      localStorage.setItem(PAYMENT_KEY, JSON.stringify(all));
      message.textContent = `Installment ${existing.length + 1} collected for ${selectedEntry["Customer Name"] || "the customer"}.`;
      closePaymentDetails();
      renderPayments();
    });
  }

  const reportBody = document.getElementById("personal-report-body");
  if (reportBody) {
    const search = document.getElementById("personal-report-search");
    const total = document.getElementById("personal-report-total");
    const payments = readPayments().sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));
    const render = () => {
      const q = search.value.trim().toLowerCase();
      const filtered = payments.filter(p => `${p.customerName} ${p.mobile}`.toLowerCase().includes(q));
      reportBody.innerHTML = filtered.length ? filtered.map(p => `<tr><td>${esc(p.customerName)}</td><td>${esc(p.mobile)}</td><td>${esc(p.paymentDate)}</td><td>${esc(p.installment)}</td><td>${money(p.amount)}</td></tr>`).join("") : '<tr><td colspan="5" style="padding:24px;text-align:center">No Personal Loan payments recorded.</td></tr>';
      total.textContent = `Total collected: ${money(filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0))}`;
    };
    search.addEventListener("input", render);
    document.getElementById("personal-report-print").addEventListener("click", () => window.print());
    render();
  }
})();
