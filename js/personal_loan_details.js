(() => {
  const rows = document.getElementById("personal-loan-rows");
  const empty = document.getElementById("personal-loan-empty");
  const search = document.getElementById("search-personal-loans");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let databaseEntries = [];
  async function loadEntries() {
    rows.innerHTML = '<tr><td colspan="9" class="text-center">Loading entries…</td></tr>';
    empty.hidden = true;
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?view=personal_loan_entries&t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.personal_loan_entries)) throw new Error(data.message || "Could not read database entries.");
      databaseEntries = data.personal_loan_entries;
      render();
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="9" class="text-center">${esc(error.message || "Database connection failed.")}</td></tr>`;
    }
  }
  function render() {
    const query = search.value.trim().toLowerCase();
    const filtered = databaseEntries.filter(entry => [entry["Customer Name"], entry["Mobile Number"], entry["Aadhaar Number"], entry["Loan Type"], entry["Customer Occupation"]].some(value => String(value || "").toLowerCase().includes(query)));
    rows.innerHTML = filtered.map(entry => `<tr><td><strong>${esc(entry["Customer Name"] || "—")}</strong></td><td>${esc(entry["Mobile Number"] || "—")}</td><td>${esc(entry["Aadhaar Number"] || "—")}</td><td>${esc(entry["Loan Type"] || "—")}</td><td>${esc(entry["Disbursement Date"] || "—")}</td><td>${esc(entry["Disbursement Amount"] || "—")}</td><td>${esc(entry["Total Payment"] ?? "—")}</td><td>${esc(entry["Customer Occupation"] || "—")}</td><td><div class="action-btns"><button type="button" class="btn-edit" data-edit="${esc(entry.ID)}" title="Edit entry" aria-label="Edit ${esc(entry["Customer Name"])}"><i class="fa-solid fa-pen"></i></button><button type="button" class="btn-delete" data-delete="${esc(entry.ID)}" title="Delete entry" aria-label="Delete ${esc(entry["Customer Name"])}"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join("");
    empty.hidden = filtered.length > 0;
  }
  search.addEventListener("input", render);
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
