let indusindAccounts = [];
let indusindPage = 1;

const indusindEscape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("account-search").addEventListener("input", () => { indusindPage = 1; renderIndusindAccounts(); });
  document.getElementById("account-search-btn").addEventListener("click", () => { indusindPage = 1; renderIndusindAccounts(); });
  document.getElementById("account-page-size").addEventListener("change", () => { indusindPage = 1; renderIndusindAccounts(); });
  document.getElementById("account-prev").addEventListener("click", () => { indusindPage--; renderIndusindAccounts(); });
  document.getElementById("account-next").addEventListener("click", () => { indusindPage++; renderIndusindAccounts(); });
  document.getElementById("indusind-account-rows").addEventListener("click", handleIndusindAccountAction);
  loadIndusindAccounts();
});

async function loadIndusindAccounts() {
  const body = document.getElementById("indusind-account-rows");
  body.innerHTML = '<tr><td colspan="7" class="indusind-empty">Loading accounts...</td></tr>';
  try {
    const data = await fetchAppData("indusind_accounts", true);
    indusindAccounts = data.indusind_accounts || [];
    renderIndusindAccounts();
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="7" class="indusind-empty">Could not load accounts. Check that the Apps Script update has been deployed.</td></tr>';
  }
}

function renderIndusindAccounts() {
  const body = document.getElementById("indusind-account-rows");
  const query = document.getElementById("account-search").value.trim().toLowerCase();
  const pageSize = Number(document.getElementById("account-page-size").value) || 10;
  const matches = indusindAccounts.filter(account => {
    const holderName = String(account.holderName || "").toLowerCase();
    const mobileNumber = String(account.mobileNumber || "").toLowerCase();
    return !query || holderName.includes(query) || mobileNumber.includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  indusindPage = Math.min(Math.max(indusindPage, 1), pageCount);
  const pageItems = matches.slice((indusindPage - 1) * pageSize, indusindPage * pageSize);

  body.innerHTML = pageItems.length ? pageItems.map(account => `
    <tr>
      <td>${indusindEscape(account.holderName)}</td>
      <td>${indusindEscape(account.accountType)}</td>
      <td>${indusindEscape(account.accountNumber)}</td>
      <td>${indusindEscape(account.customerId)}</td>
      <td>${indusindEscape(account.mobileNumber)}</td>
      <td>${indusindEscape(account.openedOn)}</td>
      <td><div class="indusind-row-actions">
        <button type="button" class="indusind-icon-button" data-account-action="edit" data-id="${indusindEscape(account.ID)}" title="Edit account" aria-label="Edit account"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="indusind-icon-button delete" data-account-action="delete" data-id="${indusindEscape(account.ID)}" title="Delete account" aria-label="Delete account"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`).join("") : '<tr><td colspan="7" class="indusind-empty">No account entries found.</td></tr>';

  document.getElementById("account-count").textContent = `${matches.length} account${matches.length === 1 ? "" : "s"}`;
  document.getElementById("account-page-label").textContent = `Page ${indusindPage} of ${pageCount}`;
  document.getElementById("account-prev").disabled = indusindPage <= 1;
  document.getElementById("account-next").disabled = indusindPage >= pageCount;
}

async function handleIndusindAccountAction(event) {
  const button = event.target.closest("[data-account-action]");
  if (!button) return;
  const { accountAction, id } = button.dataset;
  if (accountAction === "edit") {
    window.location.href = `IndusindAccountEntry.html?id=${encodeURIComponent(id)}`;
    return;
  }
  const account = indusindAccounts.find(item => String(item.ID) === String(id));
  if (!account || !window.confirm(`Delete account entry for ${account.holderName || "this customer"}?`)) return;
  button.disabled = true;
  try {
    const response = await postAppData({ action: "delete_indusind_account", id });
    const result = await response.json();
    if (!response.ok || result.status !== "success") throw new Error(result.message || "Could not delete this account.");
    indusindAccounts = indusindAccounts.filter(item => String(item.ID) !== String(id));
    renderIndusindAccounts();
    showToast("Account entry deleted successfully.", "success");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not delete this account.", "error");
    button.disabled = false;
  }
}
