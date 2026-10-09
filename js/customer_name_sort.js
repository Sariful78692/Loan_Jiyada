// Add-on: keep customer rows in A–Z order without changing customer_details.js.
(function () {
  const installNameSort = () => {
    if (typeof window.renderTable !== "function" || window.renderTable.__nameSortInstalled) return;

    const originalRenderTable = window.renderTable;
    const sortedRenderTable = function (data) {
      const sortedData = Array.isArray(data)
        ? data.slice().sort((a, b) =>
            String(a["Customer Name"] || "").localeCompare(
              String(b["Customer Name"] || ""),
              undefined,
              { sensitivity: "base" }
            )
          )
        : data;
      return originalRenderTable.call(this, sortedData);
    };

    sortedRenderTable.__nameSortInstalled = true;
    window.renderTable = sortedRenderTable;
    clearInterval(installTimer);
  };

  const installTimer = setInterval(installNameSort, 0);
  installNameSort();
})();
