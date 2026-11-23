(() => {
  const form = document.getElementById("personal-loan-form");
  if (!form) return;
  const LIST_KEY = "personalLoanOccupationLists_v1";
  const fields = [...form.querySelectorAll("input:not([type=hidden]):not([type=file]), select")];
  const photoFields = [
    { input: "personal-customer-photo", image: "personal-customer-photo-preview", placeholder: "personal-customer-photo-placeholder", caption: "personal-customer-photo-caption", urlKey: "Customer Photo URL", prefix: "customerPhoto" },
    { input: "personal-nominee-photo", image: "personal-nominee-photo-preview", placeholder: "personal-nominee-photo-placeholder", caption: "personal-nominee-photo-caption", urlKey: "Nominee Photo URL", prefix: "nomineePhoto" }
  ];
  const savedPhotoUrls = {};
  let lastPrintData = null;
  const printButton = document.getElementById("print-personal-loan");
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
    updateInstallmentAmount();
    updateProcessingAmount();
  }
  function updateInstallmentAmount() {
    const total = Number(byId("total-payment").value) || 0;
    const count = Number(byId("installments").value) || 0;
    byId("installment-amount").value = total > 0 && count > 0 ? String(Math.round(total / count)) : "";
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
  function applyAmountDefaults() {
    const amount = Number(byId("disbursement-amount").value);
    if (amount === 25000) {
      byId("rate-interest").value = "21.18";
      byId("processing-percentage").value = "0.0348";
      updateProcessingAmount();
    } else if (amount === 50000) {
      byId("rate-interest").value = "20.45";
      byId("processing-percentage").value = "0.0274";
      updateProcessingAmount();
    }
  }
  function updateInstallments() {
    const counts = { Days: 365, Months: 12, Weeks: 52 };
    const period = byId("installment-period").value;
    const count = counts[period] || "";
    byId("installments").value = String(count);
    byId("installment-unit-label").textContent = period || "";
    updateInstallmentAmount();
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
  function previewPhoto(photo, url, caption) {
    const image = byId(photo.image);
    if (/^https?:\/\//i.test(url) && typeof setImageSourceWithFallback === "function") setImageSourceWithFallback(image, url);
    else image.src = url;
    image.classList.remove("hidden");
    byId(photo.placeholder).classList.add("hidden");
    byId(photo.caption).textContent = caption;
  }
  function clearPhotoPreview(photo) {
    const image = byId(photo.image);
    if (image.src.startsWith("blob:")) URL.revokeObjectURL(image.src);
    image.removeAttribute("src");
    image.classList.add("hidden");
    byId(photo.placeholder).classList.remove("hidden");
    byId(photo.caption).textContent = "No photo selected";
  }
  function photoAsPayload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("Could not read the selected photo."));
      reader.readAsDataURL(file);
    });
  }
  function escapePrint(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }
  function printPhotoUrls(source) {
    const url = String(source || "").trim();
    if (!/^https?:\/\//i.test(url)) return url ? [url] : [];
    const match = url.match(/[?&]id=([^&]+)/i) || url.match(/\/d\/([^/?]+)/i);
    if (!match) return [url];
    let id = match[1];
    try { id = decodeURIComponent(id); } catch (_) {}
    id = encodeURIComponent(id);
    return [`https://drive.google.com/thumbnail?id=${id}&sz=w600`, `https://lh3.googleusercontent.com/d/${id}=w600`, `https://drive.google.com/uc?export=view&id=${id}`, url];
  }
  function printPersonalLoanForm(record, photoSources, printWindow) {
    const cards = [...form.querySelectorAll(".form-card")].map(card => {
      const title = card.querySelector("h3")?.innerText || "Personal Loan Details";
      const rows = [...card.querySelectorAll(".form-group")].map(group => {
        const field = group.querySelector('input:not([type="file"]), select, textarea');
        if (!field) return null;
        const label = group.querySelector("label")?.innerText || field.id;
        const value = record[field.id] || "—";
        return { label, value: escapePrint(value) };
      }).filter(Boolean);
      const sectionNo = card.querySelector("h3 span")?.textContent.trim();
      const relevantPhotos = sectionNo === "02" ? [photoFields[0]] : sectionNo === "04" ? [photoFields[1]] : [];
      relevantPhotos.forEach(photo => {
        const urls = printPhotoUrls(photoSources[photo.input]);
        if (urls.length) rows.push({ label: photo.input === "personal-customer-photo" ? "Customer Photo" : "Nominee Photo", value: `<img class="print-photo" src="${escapePrint(urls[0])}" data-photo-candidates="${escapePrint(urls.join("|"))}" alt="${photo.input === "personal-customer-photo" ? "Customer" : "Nominee"} photo">` });
      });
      const tableRows = [];
      for (let i = 0; i < rows.length; i += 2) {
        const pair = rows.slice(i, i + 2);
        const cells = pair.flatMap(item => [`<th>${escapePrint(item.label)}</th><td>${item.value}</td>`]);
        if (pair.length === 1) cells.push("<th></th><td></td>");
        tableRows.push(`<tr>${cells.join("")}</tr>`);
      }
      return `<section><h2>${escapePrint(title.replace(/^\s*\d+\s*/, ""))}</h2><table><tbody>${tableRows.join("")}</tbody></table></section>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Personal Loan Form</title><style>*{box-sizing:border-box}body{font:9px Arial,sans-serif;color:#172033;padding:18px;margin:0}h1{font-size:20px;color:#123e68;margin:0 0 4px}.sub{color:#64748b;margin:0 0 12px}.print-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}section{min-width:0;margin:0;padding:7px;border:1px solid #dbe3eb;border-radius:5px;break-inside:avoid}h2{font-size:12px;color:#123e68;border-bottom:1px solid #dce8ef;padding:0 0 4px;margin:0 0 5px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:4px 5px;border:1px solid #dbe3eb;text-align:left;vertical-align:top;overflow-wrap:anywhere}th,td{width:25%}th{background:#f4f8fb;font-weight:700}.print-photo{width:55px;height:55px;object-fit:cover;border:1px solid #dbe3eb;border-radius:5px}@page{size:A4 portrait;margin:9mm}@media print{body{padding:0}.print-grid{gap:6px}}</style></head><body><h1>Personal Loan Form</h1><p class="sub">Printed: ${escapePrint(new Date().toLocaleString())}</p><main class="print-grid">${cards}</main><script>const waitForImage=image=>new Promise(resolve=>{const urls=(image.dataset.photoCandidates||image.src).split("|").filter(Boolean);let index=1,done=false;const finish=()=>{if(done)return;done=true;resolve()};const retry=()=>{if(index<urls.length){image.src=urls[index++]}else{image.alt="Photo unavailable";finish()}};image.onload=()=>image.naturalWidth?finish():retry();image.onerror=retry;if(image.complete){if(image.naturalWidth)finish();else retry()}});Promise.all([...document.images].map(waitForImage)).then(()=>setTimeout(()=>window.print(),300));</script></body></html>`;
    if (printWindow && !printWindow.closed) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
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
    const isUpdateRequest = Boolean(id);
    const printWindow = isUpdateRequest ? null : window.open("", "_blank");
    const submitButton = form.querySelector('button[type="submit"]');
    const submitIcon = submitButton.querySelector("i");
    submitButton.disabled = true;
    if (isUpdateRequest) {
      byId("submit-label").textContent = "Updating…";
      submitIcon.className = "fa-solid fa-spinner fa-spin";
    }
    setMessage("Saving entry to database…");
    try {
      const payload = { action: "save_personal_loan", id, entry: record };
      const photoSources = { ...savedPhotoUrls };
      for (const photo of photoFields) {
        const file = byId(photo.input).files?.[0];
        if (!file) continue;
        if (!file.type.startsWith("image/") || file.size > 1024 * 1024) throw new Error("Photos must be images smaller than 1 MB.");
        payload[`${photo.prefix}Base64`] = await photoAsPayload(file);
        payload[`${photo.prefix}MimeType`] = file.type;
        payload[`${photo.prefix}Name`] = file.name;
        photoSources[photo.input] = `data:${file.type};base64,${payload[`${photo.prefix}Base64`]}`;
      }
      const response = await postAppData(payload);
      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(result.message || "Database did not save the entry.");
      const message = result.updated ? "Entry updated in the database." : "Entry saved to the database.";
      if (result.updated) {
        byId("entry-id").value = result.id;
        lastPrintData = { record, photoSources };
        printButton.hidden = false;
        setMessage("Update complete. Click Print to print this form.");
      } else {
        printPersonalLoanForm(record, photoSources, printWindow);
        form.reset();
        byId("entry-id").value = "";
        byId("submit-label").textContent = "Save";
        printButton.hidden = true;
        lastPrintData = null;
        history.replaceState(null, "", location.pathname);
        setMessage(message);
      }
    } catch (error) {
      if (printWindow && !printWindow.closed) printWindow.close();
      setMessage(`Could not save entry: ${error.message || "Database connection failed."}`);
    } finally {
      submitButton.disabled = false;
      if (isUpdateRequest) {
        byId("submit-label").textContent = "Update";
        submitIcon.className = "fa-solid fa-floppy-disk";
      }
    }
  }
  form.addEventListener("submit", event => { event.preventDefault(); saveEntry(); });
  form.addEventListener("reset", () => setTimeout(() => { byId("entry-id").value = ""; byId("submit-label").textContent = "Save"; printButton.hidden = true; lastPrintData = null; updateTotalPayment(); updateProcessingAmount(); updateInstallments(); photoFields.forEach(photo => { clearPhotoPreview(photo); delete savedPhotoUrls[photo.input]; }); setMessage(""); }, 0));
  printButton.addEventListener("click", () => {
    if (lastPrintData) {
      const printWindow = window.open("", "_blank");
      if (printWindow) printPersonalLoanForm(lastPrintData.record, lastPrintData.photoSources, printWindow);
      else showToast("Allow pop-ups for this site to print the form.", "warning");
    }
  });
  byId("disbursement-amount").addEventListener("input", () => {
    applyAmountDefaults();
    updateTotalPayment();
  });
  byId("rate-interest").addEventListener("input", updateTotalPayment);
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
  photoFields.forEach(photo => byId(photo.input).addEventListener("change", () => {
    const file = byId(photo.input).files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) {
      byId(photo.input).value = "";
      showToast("Choose an image smaller than 1 MB.", "error");
      return;
    }
    const image = byId(photo.image);
    if (image.src.startsWith("blob:")) URL.revokeObjectURL(image.src);
    previewPhoto(photo, URL.createObjectURL(file), file.name);
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
      applyAmountDefaults();
      photoFields.forEach(photo => {
        const photoUrl = saved[photo.urlKey];
        if (photoUrl) {
          savedPhotoUrls[photo.input] = String(photoUrl);
          previewPhoto(photo, String(photoUrl), "Saved photo");
        }
      });
      updateTotalPayment();
      updateProcessingAmount();
      updateCashInHand();
      updateInstallments();
      lastPrintData = {
        record: Object.fromEntries(fields.map(field => [field.id, field.value])),
        photoSources: Object.fromEntries(photoFields.map(photo => [photo.input, savedPhotoUrls[photo.input] || ""]))
      };
      printButton.hidden = false;
      byId("entry-id").value = editId;
      byId("submit-label").textContent = "Update";
      setMessage("Editing database entry. Select Update to save your changes.");
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
