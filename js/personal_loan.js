(() => {
  const form = document.getElementById("personal-loan-form");
  if (!form) return;
  const LIST_KEY = "personalLoanOccupationLists_v1";
  const fields = [...form.querySelectorAll("input:not([type=hidden]), select")];
  const byId = id => document.getElementById(id);
  function toProperCase(value) {
    return value.toLocaleLowerCase().replace(/(^|[\s'-])([\p{L}])/gu, (_, separator, letter) => separator + letter.toLocaleUpperCase());
  }
  function updateTotalPayment() {
    const amountValue = byId("disbursement-amount").value;
    const rateValue = byId("rate-interest").value;
    const principal = Number(amountValue) || 0;
    const rate = Number(rateValue) || 0;
    const interest = principal * rate / 100;
    byId("interest-amount").value = amountValue !== "" && rateValue !== "" ? interest.toFixed(2) : "";
    byId("total-payment").value = amountValue !== "" && rateValue !== "" ? (principal + interest).toFixed(2) : "";
    updateProcessingAmount();
  }
  function updateProcessingAmount() {
    const amountValue = byId("disbursement-amount").value;
    const percentageValue = byId("processing-percentage").value;
    const amount = Number(amountValue) || 0;
    const percentage = Number(percentageValue) || 0;
    byId("processing-amount").value = amountValue !== "" && percentageValue !== "" ? (amount * percentage).toFixed(2) : "";
    updateCashInHand();
  }
  function updateCashInHand() {
    const amountValue = byId("disbursement-amount").value;
    if (amountValue === "") { byId("cash-in-hand").value = ""; return; }
    const amount = Number(amountValue) || 0;
    const processing = Number(byId("processing-amount").value) || 0;
    const documents = Number(byId("document-charges").value) || 0;
    byId("cash-in-hand").value = (amount - processing - documents).toFixed(2);
  }
  function updateInstallments() {
    const counts = { Days: 365, Months: 12, Weeks: 52 };
    const period = byId("installment-period").value;
    const count = counts[period] || "";
    byId("installments").value = String(count);
    const startValue = byId("starting-date").value;
    if (!startValue || !count) { byId("end-date").value = ""; return; }
    const start = new Date(`${startValue}T00:00:00Z`);
    let end = new Date(start);
    if (period === "Days") end.setUTCDate(end.getUTCDate() + count - 1);
    else if (period === "Weeks") end.setUTCDate(end.getUTCDate() + (count - 1) * 7);
    else {
      const originalDay = start.getUTCDate();
      end.setUTCDate(1);
      end.setUTCMonth(end.getUTCMonth() + count - 1);
      const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
      end.setUTCDate(Math.min(originalDay, lastDay));
    }
    byId("end-date").value = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
  }
  const setMessage = text => { byId("form-message").textContent = text; };
  const readLists = () => { try { return JSON.parse(localStorage.getItem(LIST_KEY) || "{}"); } catch (_) { return {}; } };
  function refreshLists() {
    const lists = readLists();
    document.querySelectorAll(".pl-select-tools select").forEach(select => {
      const values = lists[select.id];
      if (!values) return;
      const selected = select.value;
      const first = select.options[0].cloneNode(true);
      select.replaceChildren(first, ...values.map(value => new Option(value, value)));
      select.value = values.includes(selected) ? selected : "";
    });
  }
  async function saveEntry() {
    if (!form.reportValidity()) return;
    form.querySelectorAll("[data-proper-case]").forEach(input => { input.value = toProperCase(input.value); });
    const record = Object.fromEntries(fields.map(field => [field.id, field.value]));
    const id = byId("entry-id").value || new URLSearchParams(location.search).get("edit") || "";
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    setMessage("Saving entry to database…");
    try {
      const response = await postAppData({ action: "save_personal_loan", id, entry: record });
      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(result.message || "Database did not save the entry.");
      const message = result.updated ? "Entry updated in the database." : "Entry saved to the database.";
      form.reset();
      byId("entry-id").value = "";
      history.replaceState(null, "", location.pathname);
      setMessage(message);
    } catch (error) {
      setMessage(`Could not save entry: ${error.message || "Database connection failed."}`);
    } finally {
      submitButton.disabled = false;
    }
  }
  form.addEventListener("submit", event => { event.preventDefault(); saveEntry(); });
  form.addEventListener("reset", () => setTimeout(() => { byId("entry-id").value = ""; updateTotalPayment(); updateProcessingAmount(); updateInstallments(); setMessage(""); }, 0));
  ["disbursement-amount", "rate-interest"].forEach(id => byId(id).addEventListener("input", updateTotalPayment));
  byId("processing-percentage").addEventListener("input", updateProcessingAmount);
  byId("document-charges").addEventListener("input", updateCashInHand);
  byId("installment-period").addEventListener("change", updateInstallments);
  byId("starting-date").addEventListener("input", updateInstallments);
  updateInstallments();
  form.querySelectorAll("#aadhaar-number, #mobile-number").forEach(input => input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, ""); }));
  form.querySelectorAll("[data-proper-case]").forEach(input => input.addEventListener("input", () => {
    const cursor = input.selectionStart;
    const formatted = toProperCase(input.value);
    if (input.value !== formatted) {
      input.value = formatted;
      input.setSelectionRange(cursor, cursor);
    }
  }));
  async function loadEditEntry(editId) {
    setMessage("Loading entry from database…");
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?view=personal_loan_entries&t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      const saved = (data.personal_loan_entries || []).find(entry => String(entry.ID) === editId);
      if (!saved) throw new Error("Entry not found in database.");
      const mapped = {
        "branch-id": saved["Branch ID"], "branch-name": saved["Branch Name"], "branch-code": saved["Branch Code"], "customer-name": saved["Customer Name"], "guardian-name": saved["Guardian Name"], "aadhaar-number": saved["Aadhaar Number"], "mobile-number": saved["Mobile Number"], "customer-occupation": saved["Customer Occupation"], "loan-account": saved["Loan Account"], "rate-interest": saved["Rate of Interest"], "loan-type": saved["Loan Type"], "disbursement-date": saved["Disbursement Date"], "disbursement-amount": saved["Disbursement Amount"], "interest-amount": saved["Interest Amount"], "processing-percentage": saved["Processing Percentage"], "installments": saved["No. of Instalments"], "installment-period": saved["Instalment Period"] || "Days", "processing-amount": saved["Processing Amount"], "document-charges": saved["Document Charges"], "loan-purpose": saved.Purpose, "nominee-name": saved["Nominee Name"], "nominee-father": saved["Nominee Father's Name"], "nominee-occupation": saved["Nominee Occupation"], "nominee-relation": saved["Relation with Applicant"], "starting-date": saved["Starting Date"], "end-date": saved["End Date"], "cash-in-hand": saved["Cash in Hand"]
      };
      fields.forEach(field => { if (mapped[field.id] !== undefined && mapped[field.id] !== null) field.value = field.hasAttribute("data-proper-case") ? toProperCase(String(mapped[field.id])) : mapped[field.id]; });
      updateTotalPayment();
      updateProcessingAmount();
      updateCashInHand();
      updateInstallments();
      byId("entry-id").value = editId;
      setMessage("Editing database entry. Save to apply your changes.");
    } catch (error) { setMessage(`Could not load entry: ${error.message || "Database connection failed."}`); }
  }
  const editId = new URLSearchParams(location.search).get("edit");
  if (editId) loadEditEntry(editId);
  document.querySelectorAll("[data-list-action]").forEach(button => button.addEventListener("click", () => {
    const select = byId(button.dataset.list), action = button.dataset.listAction, lists = readLists();
    const values = lists[select.id] || [...select.options].slice(1).map(option => option.value);
    const current = select.value;
    if (action === "add") {
      const value = prompt("Enter a new occupation:"); if (!value?.trim()) return;
      const clean = value.trim(); if (!values.some(item => item.toLowerCase() === clean.toLowerCase())) values.push(clean);
      lists[select.id] = values; localStorage.setItem(LIST_KEY, JSON.stringify(lists)); refreshLists(); select.value = clean;
    } else if (action === "edit") {
      if (!current) { setMessage("Select an occupation to edit."); return; }
      const value = prompt("Edit occupation:", current); if (!value?.trim()) return;
      const clean = value.trim(); lists[select.id] = values.map(item => item === current ? clean : item).filter((item, index, all) => all.findIndex(other => other.toLowerCase() === item.toLowerCase()) === index);
      localStorage.setItem(LIST_KEY, JSON.stringify(lists)); refreshLists(); select.value = clean;
    } else {
      if (!current) { setMessage("Select an occupation to delete."); return; }
      if (!confirm(`Delete “${current}” from this occupation list?`)) return;
      lists[select.id] = values.filter(item => item !== current); localStorage.setItem(LIST_KEY, JSON.stringify(lists)); refreshLists();
    }
  }));
  refreshLists();
})();
