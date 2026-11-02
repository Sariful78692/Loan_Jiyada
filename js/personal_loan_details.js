(() => {
  const rows = document.getElementById("personal-loan-rows");
  const empty = document.getElementById("personal-loan-empty");
  const search = document.getElementById("search-personal-loans");
  const pageSizeSelect = document.getElementById("personal-loan-page-size");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let databaseEntries = [];
  let currentPage = 1;
  async function loadEntries() {
    rows.innerHTML = '<tr><td colspan="12" class="text-center">Loading entries…</td></tr>';
    empty.hidden = true;
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?view=personal_loan_entries&t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.personal_loan_entries)) throw new Error(data.message || "Could not read database entries.");
      databaseEntries = data.personal_loan_entries;
      render();
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="12" class="text-center">${esc(error.message || "Database connection failed.")}</td></tr>`;
    }
  }
  function render() {
    const query = search.value.trim().toLowerCase();
    const filtered = databaseEntries.filter(entry => [entry["Customer Name"], entry["Mobile Number"]].some(value => String(value || "").toLowerCase().includes(query)));
    const selectedSize = pageSizeSelect.value;
    const pageSize = selectedSize === "all" ? Math.max(filtered.length, 1) : Number(selectedSize || 10);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const startIndex = (currentPage - 1) * pageSize;
    const visibleEntries = filtered.slice(startIndex, startIndex + pageSize);
    rows.innerHTML = visibleEntries.map(entry => `<tr><td><strong>${esc(entry["Customer Name"] || "—")}</strong></td><td>${esc(entry["Mobile Number"] || "—")}</td><td>${esc(entry["Aadhaar Number"] || "—")}</td><td>${esc(entry["Starting Date"] || "—")}</td><td>${esc(entry["End Date"] || "—")}</td><td>${esc(entry["Disbursement Date"] || "—")}</td><td>${esc(entry["Disbursement Amount"] || "—")}</td><td>${esc(entry["Total Payment"] ?? "—")}</td><td>${esc(entry["Cash in Hand"] ?? "—")}</td><td>${esc(entry["No. of Instalments"] ?? "—")} ${esc(entry["Instalment Period"] || "Days")}</td><td>${esc(entry["Customer Occupation"] || "—")}</td><td><div class="action-btns"><button type="button" class="btn-edit" data-edit="${esc(entry.ID)}" title="Edit entry" aria-label="Edit ${esc(entry["Customer Name"])}"><i class="fa-solid fa-pen"></i></button><button type="button" class="btn-delete" data-delete="${esc(entry.ID)}" title="Delete entry" aria-label="Delete ${esc(entry["Customer Name"])}"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join("");
    empty.hidden = filtered.length > 0;
    empty.textContent = databaseEntries.length === 0 ? "No saved Personal Loan entries found." : "No customers match that name or mobile number.";
    updatePagination(filtered.length, pageSize, pageCount, selectedSize === "all");
  }
  function updatePagination(total, pageSize, pageCount, allSelected) {
    const start = total ? (allSelected ? 1 : (currentPage - 1) * pageSize + 1) : 0;
    const end = total ? (allSelected ? total : Math.min(currentPage * pageSize, total)) : 0;
    document.getElementById("personal-loan-page-info").textContent = `Showing ${start}–${end} of ${total}`;
    document.getElementById("personal-loan-page-label").textContent = `Page ${currentPage} of ${pageCount}`;
    document.getElementById("personal-loan-prev").disabled = allSelected || currentPage <= 1;
    document.getElementById("personal-loan-next").disabled = allSelected || currentPage >= pageCount;
  }
  search.addEventListener("input", () => { currentPage = 1; render(); });
  pageSizeSelect.addEventListener("change", () => { currentPage = 1; render(); });
  document.getElementById("personal-loan-prev").addEventListener("click", () => { if (currentPage > 1) { currentPage--; render(); } });
  document.getElementById("personal-loan-next").addEventListener("click", () => { currentPage++; render(); });
  rows.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit]");
    if (edit) { location.href = `PersonalLoanEntry.html?edit=${encodeURIComponent(edit.dataset.edit)}`; return; }
    const remove = event.target.closest("[data-delete]");
    if (!remove) return;
    const target = databaseEntries.find(entry => String(entry.ID) === remove.dataset.delete);
    if (!target || !confirm(`Delete the Personal Loan entry for ${target["Customer Name"] || "this customer"}?`)) return;
    remove.disabled = true;
    try {
      const response = await postAppData({ action: "delete_personal_loan", id: remove.dataset.delete });
      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(result.message || "Database did not delete the entry.");
      databaseEntries = databaseEntries.filter(entry => String(entry.ID) !== remove.dataset.delete);
      render();
    } catch (error) { remove.disabled = false; alert(`Could not delete entry: ${error.message || "Database connection failed."}`); }
  });
  render();
  loadEntries();
})();
