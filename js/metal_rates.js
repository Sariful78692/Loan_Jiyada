(() => {
  const CACHE_KEY = "preciousMetalSpotRates_v1";
  const WB_CACHE_KEY = "south24ParganasGoldRates_v1";
  const WB_CACHE_MS = 15 * 60_000;
  const CACHE_MS = 30_000;
  const OUNCE_GRAMS = 31.1035;
  const metals = [
    { key: "gold", symbol: "XAU", label: "Gold 24K", per: 1, unit: "/ g", icon: "fa-coins", color: "gold" },
    { key: "silver", symbol: "XAG", label: "Silver", per: 1000, unit: "/ kg", icon: "fa-circle", color: "silver" },
    { key: "platinum", symbol: "XPT", label: "Platinum", per: 1, unit: "/ g", icon: "fa-gem", color: "platinum" }
  ];

  const money = value => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(value);

  function renderLoading(root) {
    root.innerHTML = `<div class="metal-rates-panel metal-today-panel"><h2>Today's Gold Rate</h2><p class="metal-rates-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading live rates…</p></div><div class="metal-rates-panel"><h2>Metal Rates</h2><p class="metal-rates-loading">Fetching current prices…</p></div>`;
  }

  function readCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return cache && cache.savedAt && cache.rates ? cache : null;
    } catch (_) { return null; }
  }

  async function fetchRate(metal) {
    const response = await fetch(`https://api.gold-api.com/price/${metal.symbol}/INR`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${metal.label} rate request failed (${response.status})`);
    const data = await response.json();
    const price = Number(data.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid ${metal.label} rate`);
    return { price, updatedAt: data.updatedAt || "" };
  }

  async function getRates() {
    const cached = readCache();
    if (cached && Date.now() - cached.savedAt < CACHE_MS) return { ...cached, cached: true };
    const results = await Promise.all(metals.map(fetchRate));
    const rates = Object.fromEntries(metals.map((metal, index) => [metal.key, results[index]]));
    const value = { savedAt: Date.now(), rates };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (_) {}
    return { ...value, cached: false };
  }

  function formatUpdatedAt(rates, cached) {
    const latest = [rates.gold.updatedAt, rates.silver.updatedAt, rates.platinum.updatedAt]
      .filter(Boolean).sort().at(-1);
    const date = latest ? new Date(latest) : new Date();
    const label = Number.isNaN(date.getTime())
      ? "Recently updated"
      : `Updated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
    return `${label}${cached ? " · cached" : ""}`;
  }

  function renderGoldChart(history) {
    if (!history || history.length < 2) return `<p class="metal-chart-empty">10-day chart is unavailable.</p>`;
    const width = 220;
    const height = 76;
    const values = history.flatMap(point => [point.gold24 / 10, point.gold22 / 10]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const toPoints = key => history.map((point, index) => {
      const x = index * width / (history.length - 1);
      const y = height - 7 - (((point[key] / 10) - min) / range) * (height - 14);
      return `${x},${y}`;
    }).join(" ");
    return `<svg class="metal-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="India Today 10-day South 24 Parganas 24 and 22 karat gold price trend"><polyline points="${toPoints("gold24")}" fill="none" stroke="#c58b16" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${toPoints("gold22")}" fill="none" stroke="#e87942" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function parseIndiaToday(text) {
    const cleanAmount = value => Number(String(value).replace(/[^\d]/g, ""));
    const current24 = text.match(/24\s*carat\s*\/\s*10\s*grams[\s\S]{0,100}?₹\s*([\d,]+)/i);
    const current22 = text.match(/22\s*carat\s*\/\s*10\s*grams[\s\S]{0,100}?₹\s*([\d,]+)/i);
    if (!current24 || !current22) throw new Error("India Today gold prices could not be parsed");

    const rows = [];
    const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i;
    for (const line of text.split(/\r?\n/)) {
      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;
      const amounts = [...line.matchAll(/₹\s*([\d,]+)/g)].map(match => cleanAmount(match[1]));
      if (amounts.length >= 2) rows.push({ date: dateMatch[0].replace(/,(?=\s*\d{4})/, ""), gold24: amounts[0], gold22: amounts[1] });
    }
    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    const updated = text.match(/Last Updated:\s*([\d/]+)/i);
    return {
      savedAt: Date.now(),
      updated: updated ? updated[1] : "",
      gold24: cleanAmount(current24[1]) / 10,
      gold22: cleanAmount(current22[1]) / 10,
      history: rows.slice(-10)
    };
  }

  async function getIndiaTodayRates() {
    try {
      const cached = JSON.parse(localStorage.getItem(WB_CACHE_KEY) || "null");
      if (cached && cached.savedAt && Date.now() - cached.savedAt < WB_CACHE_MS) return { ...cached, cached: true };
    } catch (_) {}
    try {
      const response = await fetch("https://r.jina.ai/https://www.indiatoday.in/commodity/gold-rate-in-south-24-parganas-today", { cache: "no-store" });
      if (!response.ok) throw new Error(`India Today request failed (${response.status})`);
      const rates = parseIndiaToday(await response.text());
      try { localStorage.setItem(WB_CACHE_KEY, JSON.stringify(rates)); } catch (_) {}
      return rates;
    } catch (error) {
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(WB_CACHE_KEY) || "null"); } catch (_) {}
      if (cached && cached.gold24 && cached.gold22) return { ...cached, cached: true };
      throw error;
    }
  }

  function renderRates(root, payload, wbRates) {
    const rates = payload.rates;
    const rows = metals.map(metal => {
      const amount = metal.key === "gold" ? wbRates.gold24 : rates[metal.key].price * metal.per / OUNCE_GRAMS;
      return `<div class="metal-rate-row"><span class="metal-rate-icon ${metal.color}"><i class="fa-solid ${metal.icon}"></i></span><span class="metal-rate-name">${metal.label}<small>${metal.unit}</small></span><strong>${money(amount)}</strong></div>`;
    }).join("");
    const goldUpdated = wbRates.updated ? `India Today · ${wbRates.updated}${wbRates.cached ? " · cached" : ""}` : `India Today${wbRates.cached ? " · cached" : ""}`;
    root.innerHTML = `<div class="metal-rates-panel metal-today-panel"><div class="metal-rates-heading"><span class="metal-heading-icon"><i class="fa-solid fa-coins"></i></span><div><h2>Today's Gold Rate</h2><small><a href="https://www.indiatoday.in/commodity/gold-rate-in-south-24-parganas-today" target="_blank" rel="noopener noreferrer">South 24 Parganas · India Today</a></small></div></div><div class="metal-today-values"><div><span>Gold 24K <small>/ 1 g</small></span><strong>${money(wbRates.gold24)}</strong></div><div><span>Gold 22K <small>/ 1 g</small></span><strong>${money(wbRates.gold22)}</strong></div></div><p class="metal-rates-updated">${goldUpdated}</p></div><div class="metal-rates-panel metal-list-panel"><div class="metal-rates-heading"><span class="metal-heading-icon metals"><i class="fa-solid fa-chart-line"></i></span><div><h2>Metal Rates</h2><small>Indicative spot rates in INR</small></div></div><div class="metal-rate-list">${rows}</div><p class="metal-rates-updated">${formatUpdatedAt(rates, payload.cached)}</p></div><div class="metal-rates-panel metal-chart-panel"><div class="metal-rates-heading"><span class="metal-heading-icon chart"><i class="fa-solid fa-chart-line"></i></span><div><h2>Gold Trend</h2><small>Last 10 days · per gram</small></div></div>${renderGoldChart(wbRates.history)}<div class="metal-chart-legend"><span><i class="gold-line"></i>24K</span><span><i class="gold22-line"></i>22K</span></div></div><p class="metal-rates-note">Gold rate is per gram, converted from India Today’s price per 10 grams. Local jeweller premiums and taxes may differ.</p>`;
  }

  async function updateMetalRates() {
    const root = document.getElementById("gold-metal-rates");
    if (!root) return;
    try {
      const [payload, wbRates] = await Promise.all([getRates(), getIndiaTodayRates()]);
      renderRates(root, payload, wbRates);
    } catch (error) {
      console.warn("Could not load current metal rates.", error);
      const cached = readCache();
      let wbCached = null;
      try { wbCached = JSON.parse(localStorage.getItem(WB_CACHE_KEY) || "null"); } catch (_) {}
      if (cached && wbCached) renderRates(root, { ...cached, cached: true }, { ...wbCached, cached: true });
      else root.innerHTML = `<div class="metal-rates-panel metal-rates-error"><strong>Rates could not load from India Today and the metal price service.</strong><button type="button" class="metal-rates-retry">Retry</button></div>`;
    }
  }

  function init() {
    const root = document.getElementById("gold-metal-rates");
    if (!root) return;
    renderLoading(root);
    updateMetalRates();
    root.addEventListener("click", event => {
      if (event.target.closest(".metal-rates-retry")) updateMetalRates();
    });
    window.setInterval(updateMetalRates, 60_000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
