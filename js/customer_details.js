let customerDataList = [];

document.addEventListener("DOMContentLoaded", async function () {
  await loadCustomers();
});

async function loadCustomers() {
  const tbody = document.getElementById("customer-table-body");
  tbody.innerHTML = `<tr><td colspan="10" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</td></tr>`;
  
  try {
    const res = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    customerDataList = data.customers.filter((c) => (c["Status"] || "").trim() !== "Disabled");
    
    // ১. URL থেকে Loan Type ফিল্টার চেক করা
    const urlParams = new URLSearchParams(window.location.search);
    const loanFilter = urlParams.get('loan');

    const titleElement = document.querySelector(".content-section h1");

    if (loanFilter) {
      // যদি লিংকে কোনো লোন টাইপ থাকে (যেমন: ?loan=RD Loan)
      const filteredList = customerDataList.filter(c => (c["Loan Type"] || "").trim() === loanFilter);
      if(titleElement) titleElement.innerText = `Customer Details - ${loanFilter}`;
      renderCustomerTable(filteredList);
    } else {
      // কোনো লোন টাইপ না থাকলে সবাইকে দেখাবে
      if(titleElement) titleElement.innerText = `Customer Details (All Active)`;
      renderCustomerTable(customerDataList);
    }

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: red;">Failed to load data.</td></tr>`;
  }
}


function getDirectDriveUrl(url) {
  if (!url) return "";
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w500";
  return url;
}

function renderCustomerTable(list) {
  const thead = document.getElementById("customer-table-head");
  const tbody = document.getElementById("customer-table-body");
  
  thead.innerHTML = `<tr><th>Photo</th><th>Name</th><th>Mobile</th><th>Loan Type</th><th>Group Name</th><th>Occupation</th><th>Actions</th></tr>`;
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No customers found.</td></tr>`;
    return;
  }

  list.forEach((cust) => {
    const tr = document.createElement("tr");
    const directPhotoUrl = getDirectDriveUrl(cust["Photo URL"]);
    const photoHtml = directPhotoUrl ? `<img src="${directPhotoUrl}" class="cust-photo-img">` : `<i class="fa-solid fa-user-circle fa-2x"></i>`;

    tr.innerHTML = `
      <td>${photoHtml}</td>
      <td><strong>${cust["Customer Name"] || ""}</strong></td>
      <td>${cust["Mobile No"] || ""}</td>
      <td><span class="badge">${cust["Loan Type"] || "N/A"}</span></td>
      <td>${cust["Group Name"] || "N/A"}</td>
      <td>${cust["Occupation"] || ""}</td>
      <td>
        <div class="action-btns">
          <button class="btn-delete" title="Delete" onclick="alert('Delete function placeholder for ${cust["ID"]}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}