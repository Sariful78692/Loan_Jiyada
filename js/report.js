document.addEventListener("DOMContentLoaded", async function () {
  await loadReportData();
});

async function loadReportData() {
  const tbody = document.getElementById("report-table-body");
  try {
    const res = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    const reportList = data.customers.filter(c => (c["Status"] || "").trim() !== "Disabled" && (c["Loan Type"] || "").trim() !== "");
    renderReportTable(reportList);
  } catch (err) {
    tbody.innerHTML = `<tr><td class="text-center" style="color:red;">Failed to load report.</td></tr>`;
  }
}

function renderReportTable(list) {
  const tbody = document.getElementById("report-table-body");
  tbody.innerHTML = "";
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td class="text-center">No loan records found.</td></tr>`;
    return;
  }

  list.forEach((cust) => {
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cust["Customer Name"]}</td>
      <td>${cust["Mobile No"]}</td>
      <td>${cust["Loan Type"]}</td>
      <td>₹${cust["Loan Amount"] || cust["RD Amount"] || "0"}</td>
      <td>${cust["Interest %"] || "0"}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportToExcel() {
  const wb = XLSX.utils.table_to_book(document.getElementById("report-table"), { sheet: "Report" });
  XLSX.writeFile(wb, "Loan_Report.xlsx");
}
function printReport() { window.print(); }