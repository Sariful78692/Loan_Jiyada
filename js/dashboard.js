// ---------------- Dashboard Only Logic ---------------- //

let loanChartInstance = null;
let groupChartInstance = null;
let financialPieChartInstance = null;

document.addEventListener("DOMContentLoaded", async function () {
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    const res = await fetch(APPS_SCRIPT_URL + "?t=" + new Date().getTime());
    const data = await res.json();

    console.log("Dashboard Data Loaded Successfully:", data);

    const activeCustomers = (data.customers || []).filter((c) => {
      const status = String(c["Status"] || "").trim().toLowerCase();
      return status !== "disabled" && status !== "closed";
    });

    const allCollections = data.collections || [];

    updateDashboardCharts(activeCustomers);
    updateRDLoanMetrics(activeCustomers, allCollections);

  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  }
}

// 🟢 RD Loan ক্যালকুলেশন লজিক
function updateRDLoanMetrics(activeCustomers, allCollections) {
  let totalRDAmount = 0;
  let totalRDCollection = 0;

  activeCustomers.forEach(cust => {
    const loanType = String(cust["Loan Type"] || "").trim().toLowerCase();

    if (loanType === "rd loan") {
      let unitAmount = parseFloat(cust["Loan Amount"] || 0);
      let duration = parseFloat(cust["Duration (Days)"] || 365);
      if (duration === 0) duration = 365;

      let rawInterest = String(cust["Interest %"] || "0").replace("%", "").trim();
      let interestPercent = parseFloat(rawInterest) || 0;

      let principalAmount = unitAmount * duration;
      let interestAmount = (principalAmount * interestPercent) / 100;

      totalRDAmount += (principalAmount + interestAmount);
    }
  });

  allCollections.forEach(col => {
    totalRDCollection += parseFloat(col["Amount"] || 0);
  });

  let rdDueAmount = totalRDAmount - totalRDCollection;
  if (rdDueAmount < 0) rdDueAmount = 0;

  const rdAmtEl = document.getElementById("total-rd-amount");
  const rdColEl = document.getElementById("total-rd-collection");
  const rdDueEl = document.getElementById("rd-due-amount");

  if (rdAmtEl) rdAmtEl.innerText = "₹ " + totalRDAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (rdColEl) rdColEl.innerText = "₹ " + totalRDCollection.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (rdDueEl) rdDueEl.innerText = "₹ " + rdDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pieCanvas = document.getElementById("financialPieChart");
  if (pieCanvas) {
    const pieCtx = pieCanvas.getContext("2d");
    if (financialPieChartInstance) financialPieChartInstance.destroy();

    let chartData = [totalRDCollection, rdDueAmount];
    if (totalRDCollection === 0 && rdDueAmount === 0) chartData = [0.1, 0.1];

    financialPieChartInstance = new Chart(pieCtx, {
      type: "pie",
      data: {
        labels: ["RD Collection", "RD Due"],
        datasets: [{
          data: chartData,
          backgroundColor: ["#10b981", "#f43f5e"],
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }
}

// 🟢 ড্যাশবোর্ড চার্ট এবং কাউন্টার আপডেট
function updateDashboardCharts(activeCustomers) {
  let rdCount = 0, goldCount = 0, groupLoanCount = 0;
  let anondodharaCount = 0, ashaCount = 0, janoniCount = 0;
  const loanCounts = {};
  const groupCounts = {};

  activeCustomers.forEach((cust) => {
    const loan = (cust["Loan Type"] || "").trim();
    const group = (cust["Group Name"] || "").trim();

    if (loan.toLowerCase() === "rd loan") rdCount++;
    if (loan.toLowerCase() === "gold loan") goldCount++;
    if (loan.toLowerCase() === "group loan") groupLoanCount++;

    if (group === "Anondodhara Group") anondodharaCount++;
    if (group === "Asha Group") ashaCount++;
    if (group === "Janoni Group") janoniCount++;

    const loanKey = loan || "Not Assigned";
    const groupKey = group || "Not Assigned";
    loanCounts[loanKey] = (loanCounts[loanKey] || 0) + 1;
    groupCounts[groupKey] = (groupCounts[groupKey] || 0) + 1;
  });

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