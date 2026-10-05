// ---------------- Dashboard Only Logic ---------------- //

let loanChartInstance = null;
let groupChartInstance = null;
let financialPieChartInstance = null;

document.addEventListener("DOMContentLoaded", async function () {
  applyChartDefaults();
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    const data = await fetchAppData();

    console.log("Dashboard Data Loaded Successfully:", data);

    const isActiveCustomer = (c) => {
      const status = String(c["Status"] || "").trim().toLowerCase();
      return status !== "disabled" && status !== "closed";
    };
    const customerRecords = (data.customers || []).filter(isActiveCustomer);
    const separateGroupCustomers = (data.group_customers || []).filter(isActiveCustomer);
    const allCustomerIds = new Set(customerRecords.map(customer => String(customer.ID || customer["Customer ID"] || "").trim()).filter(Boolean));
    const groupCustomers = separateGroupCustomers.filter(customer => {
      const id = String(customer.ID || customer["Customer ID"] || "").trim();
      return !id || !allCustomerIds.has(id);
    });
    const activeCustomers = customerRecords.concat(groupCustomers);
    const activeGroupLoanCustomers = activeCustomers.filter(customer =>
      String(customer["Loan Type"] || "").trim().toLowerCase() === "group loan"
    );

    const allCollections = data.collections || [];
    const activeGoldLoans = (data.gold_loans || []).filter((loan) => {
      const status = String(loan["Status"] || "").trim().toLowerCase();
      return status !== "disabled" && status !== "closed";
    });

    updateDashboardCharts(activeCustomers, activeGoldLoans.length, activeGroupLoanCustomers);
    updateRDLoanMetrics(activeCustomers, allCollections);

  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  }
}

// ============================================================
// 🟢 Chart.js গ্লোবাল স্টাইল (নতুন)
// ============================================================
function applyChartDefaults() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
  Chart.defaults.color = "#64748b";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = "#0f172a";
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
}

function makeGradient(ctx, colorStart, colorEnd, height = 300) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

// 🟢 RD Loan ক্যালকুলেশন লজিক (Interest% ছাড়া) — অপরিবর্তিত
function updateRDLoanMetrics(activeCustomers, allCollections) {
  let totalRDAmount = 0;
  let totalRDCollection = 0;

  activeCustomers.forEach(cust => {
    const loanType = String(cust["Loan Type"] || "").trim().toLowerCase();

    if (loanType === "rd loan") {
      let unitAmount = 0;
      for (let key in cust) {
        if (key.trim().toLowerCase().includes("loan amount") || key.trim().toLowerCase().includes("rd amount")) {
            unitAmount = parseFloat(cust[key]) || 0;
            break;
        }
      }

      let duration = 0;
      for (let key in cust) {
        if (key.trim().toLowerCase().includes("duration")) {
            duration = parseFloat(cust[key]);
            break;
        }
      }
      
      // যদি ডিউরেশন পাওয়া না যায় বা ০ হয়, তবে ডিফল্ট ৩৬৫ দিন
      if (isNaN(duration) || duration === 0) duration = 365;

      // শুধুমাত্র আসল টাকা (Interest ছাড়া)
      let principalAmount = unitAmount * duration;
      totalRDAmount += principalAmount;
    }
  });

  allCollections.forEach(col => {
    // শুধুমাত্র RD Loan-এর কালেকশন যোগ করা হচ্ছে
    const colLoanType = String(col["Loan Type"] || "").trim().toLowerCase();
    if (colLoanType === "rd loan" || colLoanType.includes("rd")) {
      totalRDCollection += parseFloat(col["Amount"] || 0);
    }
  });

  // কালেকশন টেবিলে লোন টাইপ না থাকলে সেফটি হিসেবে টোটাল কালেকশন নেওয়া
  if (totalRDCollection === 0 && allCollections.length > 0) {
      allCollections.forEach(col => {
          totalRDCollection += parseFloat(col["Amount"] || 0);
      });
  }

  let rdDueAmount = totalRDAmount - totalRDCollection;
  if (rdDueAmount < 0) rdDueAmount = 0;

  const rdAmtEl = document.getElementById("total-rd-amount");
  const rdColEl = document.getElementById("total-rd-collection");
  const rdDueEl = document.getElementById("rd-due-amount");

  if (rdAmtEl) rdAmtEl.innerText = "₹ " + totalRDAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (rdColEl) rdColEl.innerText = "₹ " + totalRDCollection.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (rdDueEl) rdDueEl.innerText = "₹ " + rdDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---- চার্ট: Financial Overview (নতুন স্টাইল — Doughnut + Gradient) ----
  const pieCanvas = document.getElementById("financialPieChart");
  if (pieCanvas) {
    const pieCtx = pieCanvas.getContext("2d");
    if (financialPieChartInstance) financialPieChartInstance.destroy();

    let chartData = [totalRDCollection, rdDueAmount];
    if (totalRDCollection === 0 && rdDueAmount === 0) chartData = [0.1, 0.1];

    financialPieChartInstance = new Chart(pieCtx, {
      type: "doughnut",
      data: {
        labels: ["RD Collection", "RD Due"],
        datasets: [{
          data: chartData,
          backgroundColor: [
            makeGradient(pieCtx, "#10b981", "#059669"),
            makeGradient(pieCtx, "#f43f5e", "#e11d48")
          ],
          borderWidth: 0,
          hoverOffset: 10,
          spacing: 3
        }]
      },
      options: {
        responsive: true,
        cutout: "68%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctxItem) => ` ${ctxItem.label}: ₹ ${ctxItem.raw.toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
  }
}

// 🟢 ড্যাশবোর্ড চার্ট এবং কাউন্টার আপডেট — অপরিবর্তিত লজিক
function updateDashboardCharts(activeCustomers, goldLoanCount = 0, groupCustomers = []) {
  let rdCount = 0, goldCount = goldLoanCount, groupLoanCount = 0;
  let anondodharaCount = 0, ashaCount = 0, janoniCount = 0;
  const loanCounts = {};
  const groupCounts = {};

  activeCustomers.forEach((cust) => {
    const loan = (cust["Loan Type"] || "").trim();

    if (loan.toLowerCase() === "rd loan") rdCount++;
    if (loan.toLowerCase() === "group loan") groupLoanCount++;

    const loanKey = loan || "Not Assigned";
    loanCounts[loanKey] = (loanCounts[loanKey] || 0) + 1;
  });

  groupCustomers.forEach((cust) => {
    const group = String(cust["Group Name"] || "").trim();
    const groupKey = group || "Not Assigned";
    groupCounts[groupKey] = (groupCounts[groupKey] || 0) + 1;
  });
  groupLoanCount = groupCustomers.length;
  anondodharaCount = groupCounts["Anondodhara Group"] || 0;
  ashaCount = groupCounts["Asha Group"] || 0;
  janoniCount = groupCounts["Janoni Group"] || 0;

  renderGroupLoanBreakdown(groupCounts);

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

  // ---- চার্ট: Loan Type Overview (নতুন স্টাইল — Gradient + বড় cutout) ----
  const loanCanvas = document.getElementById("loanTypeChart");
  if (loanCanvas) {
    const loanCtx = loanCanvas.getContext("2d");
    if (loanChartInstance) loanChartInstance.destroy();

    const loanColors = [
      makeGradient(loanCtx, "#38bdf8", "#0284c7"),
      makeGradient(loanCtx, "#a78bfa", "#7c3aed"),
      makeGradient(loanCtx, "#fbbf24", "#d97706"),
      makeGradient(loanCtx, "#10b981", "#059669"),
      makeGradient(loanCtx, "#f97316", "#ea580c"),
      makeGradient(loanCtx, "#f43f5e", "#e11d48")
    ];

    loanChartInstance = new Chart(loanCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(loanCounts).map(label => label.trim().toLowerCase() === "rd loan" ? "RD" : label),
        datasets: [{
          data: Object.values(loanCounts),
          backgroundColor: loanColors,
          borderWidth: 0,
          hoverOffset: 10,
          spacing: 3
        }]
      },
      options: {
        responsive: true,
        cutout: "60%",
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  // ---- চার্ট: Group Wise Customers (নতুন স্টাইল — Gradient + Rounded Bar) ----
  const groupCanvas = document.getElementById("groupNameChart");
  if (groupCanvas) {
    const groupCtx = groupCanvas.getContext("2d");
    if (groupChartInstance) groupChartInstance.destroy();

    groupChartInstance = new Chart(groupCtx, {
      type: "bar",
      data: {
        labels: Object.keys(groupCounts),
        datasets: [{
          label: "Total Customers",
          data: Object.values(groupCounts),
          backgroundColor: makeGradient(groupCtx, "#38bdf8", "#0ea5e9"),
          borderRadius: 8,
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "#f1f5f9" } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

function renderGroupLoanBreakdown(groupCounts) {
  const totalElement = document.getElementById("group-customer-total");
  const breakdown = document.getElementById("group-loan-breakdown");
  const total = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);

  if (totalElement) totalElement.textContent = total.toLocaleString("en-IN");
  if (!breakdown) return;

  breakdown.replaceChildren();
  const groups = Object.entries(groupCounts).sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
  if (!groups.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "group-loan-empty";
    emptyMessage.textContent = "No Group Loan customers yet.";
    breakdown.appendChild(emptyMessage);
    return;
  }

  groups.forEach(([name, count]) => {
    const card = document.createElement("article");
    card.className = "group-breakdown-card";
    const groupName = document.createElement("span");
    groupName.textContent = name;
    const customerCount = document.createElement("strong");
    customerCount.textContent = count.toLocaleString("en-IN");
    const caption = document.createElement("small");
    caption.textContent = count === 1 ? "customer" : "customers";
    card.append(groupName, customerCount, caption);
    breakdown.appendChild(card);
  });
}
