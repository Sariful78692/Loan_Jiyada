let loanChartInstance = null;
let groupChartInstance = null;

document.addEventListener("DOMContentLoaded", async function () {
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    const res = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    const activeCustomers = data.customers.filter((c) => (c["Status"] || "").trim() !== "Disabled");
    updateDashboardCharts(activeCustomers);
  } catch (err) {
    console.error("Failed to load data", err);
  }
}

function updateDashboardCharts(activeCustomers) {
  let rdCount = 0, goldCount = 0, groupLoanCount = 0;
  let anondodharaCount = 0, ashaCount = 0, janoniCount = 0;
  const loanCounts = {};
  const groupCounts = {};

  activeCustomers.forEach((cust) => {
    const loan = (cust["Loan Type"] || "").trim();
    const group = (cust["Group Name"] || "").trim();

    if (loan === "RD Loan") rdCount++;
    if (loan === "Gold Loan") goldCount++;
    if (loan === "Group Loan") groupLoanCount++;
    
    if (group === "Anondodhara Group") anondodharaCount++;
    if (group === "Asha Group") ashaCount++;
    if (group === "Janoni Group") janoniCount++;

    const loanKey = loan || "Not Assigned";
    const groupKey = group || "Not Assigned";
    loanCounts[loanKey] = (loanCounts[loanKey] || 0) + 1;
    groupCounts[groupKey] = (groupCounts[groupKey] || 0) + 1;
  });

  // নিরাপদে ডেটা বসানোর লজিক (HTML এ কার্ড থাকলে তবেই ডেটা বসাবে)
  const ids = {
    "count-total": activeCustomers.length,
    "count-rd": rdCount,
    "count-gold": goldCount,
    "count-group-loan": groupLoanCount,
    "count-anondodhara": anondodharaCount,
    "count-asha": ashaCount,
    "count-janoni": janoniCount
  };

  for (const [id, count] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.innerText = count;
  }

  // চার্ট লোড করার লজিক
  const loanCanvas = document.getElementById("loanTypeChart");
  if (loanCanvas) {
    const loanCtx = loanCanvas.getContext("2d");
    if (loanChartInstance) loanChartInstance.destroy();
    loanChartInstance = new Chart(loanCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(loanCounts),
        datasets: [{ data: Object.values(loanCounts), backgroundColor: ["#2563eb", "#38bdf8", "#eab308", "#10b981", "#f97316", "#8b5cf6"] }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }

  const groupCanvas = document.getElementById("groupNameChart");
  if (groupCanvas) {
    const groupCtx = groupCanvas.getContext("2d");
    if (groupChartInstance) groupChartInstance.destroy();
    groupChartInstance = new Chart(groupCtx, {
      type: "bar",
      data: {
        labels: Object.keys(groupCounts),
        datasets: [{ label: "Total Customers", data: Object.values(groupCounts), backgroundColor: "#38bdf8" }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }
}