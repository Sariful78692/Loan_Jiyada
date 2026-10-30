function doGet(e) {
  // A manual spreadsheet edit/delete can leave script cache entries stale.
  // Pages that explicitly request fresh data clear those entries before reading.
  if (e && e.parameter && e.parameter.refresh === "1") clearDashboardCache();
  if (e && e.parameter && e.parameter.view === "rd_customer_details") {
    return doGetRdCustomerDetails();
  }
  if (e && e.parameter && e.parameter.view === "collection_report") {
    return doGetCollectionReportData();
  }
  if (e && e.parameter && e.parameter.view === "gold_emi_report") {
    return doGetGoldEmiReportData();
  }
  if (e && e.parameter && e.parameter.view === "indusind_accounts") {
    var accountsSheet = getOrCreateIndusindAccountsSheet(SpreadsheetApp.getActiveSpreadsheet());
    return jsonResponse({ indusind_accounts: readIndusindAccountsForClient_(accountsSheet, Session.getScriptTimeZone()) });
  }
  if (e && e.parameter && e.parameter.view === "app_settings") {
    return jsonResponse(readAppLogoSettings_(SpreadsheetApp.getActiveSpreadsheet()));
  }
  if (e && e.parameter && e.parameter.view === "customer_report") {
    return doGetCustomerReportData();
  }
  // 🟢 CACHE: প্রথমে ক্যাশে ডেটা আছে কিনা চেক করুন
  var cache = CacheService.getScriptCache();
  var cached = cache.get("dashboard_data_v2");
  if (cached != null) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var custSheet = ss.getSheets()[0]; 
  var goldSheet = getOrCreateGoldSheet(ss);
  var groupSheet = ss.getSheetByName("Group_Customers");
  var tz = Session.getScriptTimeZone(); 

  // 1. Customer Data
  var custData = custSheet.getDataRange().getValues();
  var custResult = [];
  if (custData.length > 1) {
    var custHeaders = custData[0];
    for (var i = 1; i < custData.length; i++) {
      var obj = {};
      for (var j = 0; j < custHeaders.length; j++) {
        var val = custData[i][j];
        if (val instanceof Date) val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
        obj[String(custHeaders[j]).trim()] = val;
      }
      custResult.push(obj);
    }
  }

  // Include archived customers in the response so closed RD loans remain
  // visible with a Re-open action on the customer details page.
  var archivedCustomersSheet = ss.getSheetByName("Archived_Customers");
  if (archivedCustomersSheet && archivedCustomersSheet.getLastRow() > 1) {
    var archivedData = archivedCustomersSheet.getDataRange().getValues();
    var archivedHeaders = archivedData[0].map(function(header) { return String(header).trim(); });
    for (var ai = 1; ai < archivedData.length; ai++) {
      var archivedCustomer = {};
      for (var aj = 0; aj < archivedHeaders.length; aj++) {
        var archivedValue = archivedData[ai][aj];
        if (archivedValue instanceof Date) archivedValue = Utilities.formatDate(archivedValue, tz, "yyyy-MM-dd");
        archivedCustomer[archivedHeaders[aj]] = archivedValue;
      }
      custResult.push(archivedCustomer);
    }
  }

  // Group Entry records live in their own sheet and are exposed separately to Group Details.
  var groupCustomerResult = [];
  if (groupSheet && groupSheet.getLastRow() > 1) {
    var groupData = groupSheet.getDataRange().getValues();
    var groupHeaders = groupData[0].map(function(header) { return String(header).trim(); });
    for (var gi = 1; gi < groupData.length; gi++) {
      var groupCustomer = {};
      for (var gj = 0; gj < groupHeaders.length; gj++) {
        var groupValue = groupData[gi][gj];
        if (groupValue instanceof Date) groupValue = Utilities.formatDate(groupValue, tz, "yyyy-MM-dd");
        groupCustomer[groupHeaders[gj]] = groupValue;
      }
      groupCustomerResult.push(groupCustomer);
    }
  }

  // 2. Active Collection Data (Running Loans)
  var collResult = [];
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sheetName = sheets[s].getName();
    if (sheetName === "Collections" || sheetName.indexOf("Collections_") === 0) {
      var collData = sheets[s].getDataRange().getValues();
      if (collData.length > 1) {
        var collHeaders = collData[0];
        for (var i = 1; i < collData.length; i++) {
          var obj = {};
          for (var j = 0; j < collHeaders.length; j++) {
            var val = collData[i][j];
            if (val instanceof Date) val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
            obj[String(collHeaders[j]).trim()] = val;
          }
          collResult.push(obj);
        }
      }
    }
  }

  // 🟢 3. Closed Collection Data (Archive Loans)
  var closedResult = [];
  var closedSheet = ss.getSheetByName("Closed_Collections");
  if (closedSheet) {
    var cData = closedSheet.getDataRange().getValues();
    if (cData.length > 1) {
      var cHeaders = cData[0];
      for (var i = 1; i < cData.length; i++) {
        var obj = {};
        for (var j = 0; j < cHeaders.length; j++) {
          var val = cData[i][j];
          if (val instanceof Date) val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
          obj[String(cHeaders[j]).trim()] = val;
        }
        closedResult.push(obj);
      }
    }
  }

  // 4. Gold Loan Data
  var goldData = goldSheet.getDataRange().getValues();
  var goldResult = [];
  if (goldData.length > 1) {
    var goldHeaders = goldData[0];
    for (var i = 1; i < goldData.length; i++) {
      var obj = {};
      for (var j = 0; j < goldHeaders.length; j++) {
        var val = goldData[i][j];
        if (val instanceof Date) val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
        obj[String(goldHeaders[j]).trim()] = val;
      }
      goldResult.push(obj);
    }
  }

  var goldEmiSheet = getOrCreateGoldEmiPaymentsSheet(ss);
  var goldEmiData = goldEmiSheet.getDataRange().getValues();
  var goldEmiResult = [];
  if (goldEmiData.length > 1) {
    var goldEmiHeaders = goldEmiData[0];
    for (var i = 1; i < goldEmiData.length; i++) {
      var obj = {};
      for (var j = 0; j < goldEmiHeaders.length; j++) {
        var val = goldEmiData[i][j];
        if (val instanceof Date) val = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss");
        obj[String(goldEmiHeaders[j]).trim()] = val;
      }
      goldEmiResult.push(obj);
    }
  }

  var finalOutput = JSON.stringify({ 
    customers: custResult, 
    group_customers: groupCustomerResult,
    collections: collResult,
    closed_collections: closedResult, 
    gold_loans: goldResult,
    gold_emi_payments: goldEmiResult
  });

  try {
    cache.put("dashboard_data_v2", finalOutput, 180);
  } catch (cacheErr) {
    // ক্যাশ ফেইল করলেও সমস্যা নেই
  }

  return ContentService.createTextOutput(finalOutput).setMimeType(ContentService.MimeType.JSON);
}

function clearDashboardCache() {
  try {
    CacheService.getScriptCache().removeAll(["dashboard_data_v2", "rd_customer_details_v1", "collection_report_v1", "gold_emi_report_v1", "customer_report_v1"]);
  } catch (e) {
    // ইগনোর করা নিরাপদ
  }
}

// Small report responses avoid sending unrelated dashboard datasets to report pages.
function doGetCollectionReportData() {
  return getCachedReportData_("collection_report_v1", function(ss, timezone) {
    return {
      customers: readReportCustomers_(ss, timezone),
      collections: readReportCollections_(ss, timezone, false),
      closed_collections: readReportSheet_(ss.getSheetByName("Closed_Collections"), timezone)
    };
  });
}

function doGetCustomerReportData() {
  return getCachedReportData_("customer_report_v1", function(ss, timezone) {
    return { customers: readReportCustomers_(ss, timezone) };
  });
}

function readReportCustomers_(ss, timezone) {
  return readReportSheet_(ss.getSheets()[0], timezone).concat(
    readReportSheet_(ss.getSheetByName("Archived_Customers"), timezone)
  );
}

function doGetGoldEmiReportData() {
  return getCachedReportData_("gold_emi_report_v1", function(ss, timezone) {
    return {
      gold_loans: readReportSheet_(ss.getSheetByName("Gold_Loans"), timezone),
      gold_emi_payments: readReportSheet_(ss.getSheetByName("Gold_Loan_EMI_Payments"), timezone),
      collections: readReportCollections_(ss, timezone, true)
    };
  });
}

function getCachedReportData_(cacheKey, buildData) {
  var cache = CacheService.getScriptCache();
  var manifest = null;
  try { manifest = JSON.parse(cache.get(cacheKey) || "null"); } catch (manifestError) {}
  if (manifest && manifest.chunkCount > 0 && manifest.chunkCount <= 900) {
    var chunkKeys = [];
    for (var chunkIndex = 0; chunkIndex < manifest.chunkCount; chunkIndex++) {
      chunkKeys.push(cacheKey + "_part_" + chunkIndex);
    }
    var cachedParts = cache.getAll(chunkKeys);
    var complete = chunkKeys.every(function(key) { return Object.prototype.hasOwnProperty.call(cachedParts, key); });
    if (complete) {
      var cachedOutput = chunkKeys.map(function(key) { return cachedParts[key]; }).join("");
      return ContentService.createTextOutput(cachedOutput).setMimeType(ContentService.MimeType.JSON);
    }
  }

  var output = JSON.stringify(buildData(SpreadsheetApp.getActiveSpreadsheet(), Session.getScriptTimeZone()));
  // Apps Script limits each cache value to about 100 KB; chunk the JSON so
  // large reports can still be cached instead of silently rebuilding every visit.
  var chunkSize = 20000;
  var chunkCount = Math.ceil(output.length / chunkSize);
  if (chunkCount > 0 && chunkCount <= 900) {
    try {
      var cacheValues = {};
      for (var partIndex = 0; partIndex < chunkCount; partIndex++) {
        cacheValues[cacheKey + "_part_" + partIndex] = output.slice(partIndex * chunkSize, (partIndex + 1) * chunkSize);
      }
      cache.putAll(cacheValues, 180);
      cache.put(cacheKey, JSON.stringify({ chunkCount: chunkCount }), 180);
    } catch (cacheError) {}
  }
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

function readReportSheet_(sheet, timezone) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(header) { return String(header).trim(); });
  return values.slice(1).map(function(row) {
    var item = {};
    headers.forEach(function(header, index) {
      var value = row[index];
      if (value instanceof Date) value = Utilities.formatDate(value, timezone, "yyyy-MM-dd");
      item[header] = value;
    });
    return item;
  });
}

function readReportCollections_(ss, timezone, goldOnly) {
  var result = [];
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name !== "Collections" && name.indexOf("Collections_") !== 0) return;
    if (sheet.getLastRow() < 2) return;
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function(header) { return String(header).trim(); });
    var typeColumn = headers.indexOf("Loan Type");
    values.slice(1).forEach(function(row) {
      if (goldOnly && (typeColumn < 0 || String(row[typeColumn] || "").trim().toLowerCase() !== "gold loan")) return;
      var item = {};
      headers.forEach(function(header, index) {
        var value = row[index];
        if (value instanceof Date) value = Utilities.formatDate(value, timezone, "yyyy-MM-dd");
        item[header] = value;
      });
      result.push(item);
    });
  });
  return result;
}

// Lightweight response used by the RD customer details page. It avoids
// reading and transmitting unrelated Gold Loan, EMI, and group records.
function doGetRdCustomerDetails() {
  var cache = CacheService.getScriptCache();
  var cacheKey = "rd_customer_details_v1";
  var cached = cache.get(cacheKey);
  if (cached !== null) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var customerSheet = ss.getSheets()[0];
  var timezone = Session.getScriptTimeZone();
  var customerRows = customerSheet.getDataRange().getValues();
  var customers = [];
  var customerIds = {};

  function appendRdCustomers(rows, headers) {
    var normalizedHeaders = headers.map(function(header) { return String(header).trim(); });
    var loanIndex = normalizedHeaders.indexOf("Loan Type");
    var idIndex = normalizedHeaders.indexOf("ID");
    if (loanIndex < 0 || idIndex < 0) return;
    for (var rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      var row = rows[rowIndex];
      if (String(row[loanIndex] || "").trim().toLowerCase() !== "rd loan") continue;
      var customer = {};
      for (var col = 0; col < normalizedHeaders.length; col++) {
        var value = row[col];
        if (value instanceof Date) value = Utilities.formatDate(value, timezone, "yyyy-MM-dd");
        customer[normalizedHeaders[col]] = value;
      }
      customers.push(customer);
      customerIds[String(row[idIndex]).trim()] = true;
    }
  }

  if (customerRows.length > 1) appendRdCustomers(customerRows, customerRows[0]);
  var archivedSheet = ss.getSheetByName("Archived_Customers");
  if (archivedSheet && archivedSheet.getLastRow() > 1) {
    var archivedRows = archivedSheet.getDataRange().getValues();
    appendRdCustomers(archivedRows, archivedRows[0]);
  }

  var collections = [];
  var sheets = ss.getSheets();
  for (var sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
    var sheet = sheets[sheetIndex];
    var sheetName = sheet.getName();
    if (sheetName !== "Collections" && sheetName.indexOf("Collections_") !== 0) continue;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    var headers = values[0].map(function(header) { return String(header).trim(); });
    var customerIdColumn = headers.indexOf("Customer ID");
    if (customerIdColumn < 0) continue;
    for (var dataRow = 1; dataRow < values.length; dataRow++) {
      var sourceRow = values[dataRow];
      if (!customerIds[String(sourceRow[customerIdColumn]).trim()]) continue;
      var collection = {};
      for (var headerIndex = 0; headerIndex < headers.length; headerIndex++) {
        var cell = sourceRow[headerIndex];
        if (cell instanceof Date) cell = Utilities.formatDate(cell, timezone, "yyyy-MM-dd");
        collection[headers[headerIndex]] = cell;
      }
      collections.push(collection);
    }
  }

  var output = JSON.stringify({ customers: customers, collections: collections });
  try { cache.put(cacheKey, output, 180); } catch (cacheError) {}
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

// Run this function once from the Apps Script editor to install a cache warmer.
// It primes the cache immediately and keeps it warm between normal page visits.
function installDashboardCacheWarmer() {
  warmDashboardCache();

  var alreadyInstalled = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === "warmDashboardCache";
  });
  if (!alreadyInstalled) {
    ScriptApp.newTrigger("warmDashboardCache").timeBased().everyMinutes(1).create();
  }
}

function warmDashboardCache() {
  var cache = CacheService.getScriptCache();
  if (cache.get("dashboard_data_v2") === null) {
    doGet({ parameter: {} });
  }
  if (cache.get("rd_customer_details_v1") === null) {
    doGet({ parameter: { view: "rd_customer_details" } });
  }
  if (cache.get("collection_report_v1") === null) doGet({ parameter: { view: "collection_report" } });
  if (cache.get("gold_emi_report_v1") === null) doGet({ parameter: { view: "gold_emi_report" } });
  if (cache.get("customer_report_v1") === null) doGet({ parameter: { view: "customer_report" } });
}

// Adds the Bank Details columns to existing customer sheets only once.
// The columns are appended so current customer data and Status remain unchanged.
function ensureCustomerBankColumns(custSheet) {
  var bankHeaders = ["Bank Name", "Bank Branch", "IFSC Code", "Account Holder Name", "Account Number"];
  var headers = custSheet.getRange(1, 1, 1, custSheet.getLastColumn()).getValues()[0];
  var missingHeaders = bankHeaders.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    custSheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    custSheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setFontWeight("bold");
    headers = custSheet.getRange(1, 1, 1, custSheet.getLastColumn()).getValues()[0];
  }

  var columns = {};
  bankHeaders.forEach(function(header) {
    columns[header] = headers.indexOf(header) + 1;
  });
  return columns;
}

function ensureCustomerHeaders(sheet, requiredHeaders) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
  var missing = requiredHeaders.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, headers.length + 1, 1, missing.length).setFontWeight("bold");
  }
}

function saveCollectionInstallments(ss, data) {
  var customerId = String(data.customerId || "").trim();
  var customerName = String(data.customerName || "").trim();
  var loanType = String(data.loanType || "RD Loan").trim();
  var amount = Number(data.amount);
  var dates = data.dates;
  if (!customerId || !Array.isArray(dates) || !dates.length || dates.length > 1000 || !isFinite(amount) || amount < 0) {
    return { status: "error", message: "Invalid bulk collection request." };
  }

  var uniqueDates = {};
  for (var i = 0; i < dates.length; i++) {
    var dateValue = String(dates[i] || "").trim();
    var parsedDate = parseGoldLoanDate(dateValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !parsedDate || goldLoanDateIso(parsedDate) !== dateValue || uniqueDates[dateValue]) {
      return { status: "error", message: "The bulk collection contains an invalid or duplicate date." };
    }
    uniqueDates[dateValue] = true;
    dates[i] = dateValue;
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    return { status: "error", message: "Another collection is being saved. Please try again." };
  }

  try {
    var existingDates = {};
    ss.getSheets().forEach(function(sheet) {
      var name = sheet.getName();
      if (name !== "Collections" && name.indexOf("Collections_") !== 0) return;
      var values = sheet.getDataRange().getValues();
      if (values.length < 2) return;
      var headers = values[0].map(function(header) { return String(header).trim(); });
      var idColumn = headers.indexOf("Customer ID");
      var typeColumn = headers.indexOf("Loan Type");
      var dateColumn = headers.indexOf("Collection Date");
      if (idColumn < 0 || dateColumn < 0) return;
      for (var row = 1; row < values.length; row++) {
        if (String(values[row][idColumn]).trim() !== customerId) continue;
        if (typeColumn >= 0) {
          var existingType = String(values[row][typeColumn] || "").trim().toLowerCase();
          if (existingType && existingType !== loanType.toLowerCase()) continue;
        }
        var existingDate = values[row][dateColumn] instanceof Date
          ? goldLoanDateIso(values[row][dateColumn])
          : String(values[row][dateColumn] || "").trim().split("T")[0];
        var parsedExistingDate = parseGoldLoanDate(existingDate);
        if (parsedExistingDate) existingDates[goldLoanDateIso(parsedExistingDate)] = true;
      }
    });

    var newDates = dates.filter(function(date) { return !existingDates[date]; });
    var duplicateCount = dates.length - newDates.length;
    if (!newDates.length) {
      return { status: "success", collectedDates: [], duplicateCount: duplicateCount };
    }

    var datesByYear = {};
    newDates.forEach(function(date) {
      var year = date.slice(0, 4);
      if (!datesByYear[year]) datesByYear[year] = [];
      datesByYear[year].push(date);
    });

    Object.keys(datesByYear).forEach(function(year) {
      var sheetName = "Collections_" + year;
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["Collection ID", "Customer ID", "Customer Name", "Loan Type", "Collection Date", "Amount", "Timestamp"]);
        sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
      }
      if (sheet.getLastColumn() === 0) {
        sheet.appendRow(["Collection ID", "Customer ID", "Customer Name", "Loan Type", "Collection Date", "Amount", "Timestamp"]);
        sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
      }
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
      var timestamp = new Date();
      var rows = datesByYear[year].map(function(date, index) {
        var record = {
          "Collection ID": "COLL-" + timestamp.getTime() + "-" + year + "-" + index,
          "Customer ID": customerId,
          "Customer Name": customerName,
          "Loan Type": loanType,
          "Collection Date": date,
          "Amount": amount,
          "Timestamp": timestamp
        };
        return headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ""; });
      });
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    });

    clearDashboardCache();
    return { status: "success", collectedDates: newDates, duplicateCount: duplicateCount };
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 🟢 Authentication actions
    if (["login", "forgot_username", "reset_password", "change_username", "change_password"].indexOf(data.action) !== -1) {
      return jsonResponse(handleAuthAction(data, ss));
    }

    var custSheet = ss.getSheets()[0];
    var goldSheet = getOrCreateGoldSheet(ss);

    
    var folderId = "1tYYWYu7dyg4NCVD_mePsmvyX0fOdYDKa";

    if (data.action === "save_app_logo" || data.action === "delete_app_logo") {
      return jsonResponse(saveAppLogoSetting_(ss, data, folderId));
    }

    if (["create_indusind_account", "update_indusind_account", "delete_indusind_account"].indexOf(data.action) !== -1) {
      var indusindResult = handleIndusindAccountAction(ss, data, folderId);
      if (indusindResult.status === "success") clearDashboardCache();
      return jsonResponse(indusindResult);
    }

    if (data.action === "collectInstallments") {
      return jsonResponse(saveCollectionInstallments(ss, data));
    }

    if (data.action === "collectInstallment") {
      var customerId = String(data.customerId).trim();
      var collectionDate = String(data.collectionDate).trim();

      var year = collectionDate.split("-")[0];
      if (!year || year.length !== 4) year = new Date().getFullYear();
      
      var sheetName = "Collections_" + year;
      var collSheet = ss.getSheetByName(sheetName);
      if (!collSheet) {
        collSheet = ss.insertSheet(sheetName);
        collSheet.appendRow(["Collection ID", "Customer ID", "Customer Name", "Loan Type", "Collection Date", "Amount", "Timestamp"]);
        collSheet.getRange(1, 1, 1, 7).setFontWeight("bold");
      }

      var rows = collSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var existingId = String(rows[i][1]).trim();
        
        var rawDate = rows[i][4];
        var existingDate = "";
        if (rawDate instanceof Date) {
          existingDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          existingDate = String(rawDate).trim();
          if (existingDate.includes("T")) existingDate = existingDate.split("T")[0];
        }
        
        if (existingId === customerId && existingDate === collectionDate) {
          return ContentService.createTextOutput(JSON.stringify({ 
            status: "error", 
            message: "DUPLICATE_COLLECTION" 
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      var collId = "COLL-" + new Date().getTime();
      collSheet.appendRow([
        collId, 
        data.customerId, 
        data.customerName || "", 
        data.loanType || "RD Loan",
        data.collectionDate, 
        data.amount, 
        new Date() 
      ]);

      clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "update_collection") {
      var updated = false;
      var sheets = ss.getSheets();
      for (var s = 0; s < sheets.length; s++) {
        var shName = sheets[s].getName();
        if (shName === "Collections" || shName.indexOf("Collections_") === 0) {
          var rows = sheets[s].getDataRange().getValues();
          for (var i = 1; i < rows.length; i++) {
            if (String(rows[i][0]).trim() === String(data.collectionId).trim()) {
              sheets[s].getRange(i + 1, 5).setValue(data.collectionDate); 
              sheets[s].getRange(i + 1, 6).setValue(data.amount);        
              updated = true;
              break;
            }
          }
          if (updated) break;
        }
      }
      if (updated) clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: updated ? "success" : "error" })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "delete_collection") {
      var deleted = false;
      var sheets = ss.getSheets();
      for (var s = 0; s < sheets.length; s++) {
        var shName = sheets[s].getName();
        if (shName === "Collections" || shName.indexOf("Collections_") === 0 || shName === "Closed_Collections") {
          var rows = sheets[s].getDataRange().getValues();
          for (var i = 1; i < rows.length; i++) {
            if (String(rows[i][0]).trim() === String(data.collectionId).trim()) {
              sheets[s].deleteRow(i + 1);
              deleted = true;
              break;
            }
          }
          if (deleted) break;
        }
      }
      if (deleted) clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: deleted ? "success" : "error" })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "close_loan") {
      var closeLock = LockService.getScriptLock();
      closeLock.waitLock(30000);
      try {
        var targetCustId = String(data.customerId || "").trim();
        if (!targetCustId) return jsonResponse({ status: "error", message: "Customer ID is required." });

        var cRows = custSheet.getDataRange().getValues();
        if (!cRows.length) return jsonResponse({ status: "error", message: "Customer sheet is empty." });
        var customerHeaders = cRows[0].map(function(header) { return String(header).trim(); });
        var customerIdColumn = customerHeaders.indexOf("ID");
        if (customerIdColumn < 0) customerIdColumn = 0;
        var statusColumn = customerHeaders.indexOf("Status");
        var customerRowNumber = -1;
        for (var i = 1; i < cRows.length; i++) {
          if (String(cRows[i][customerIdColumn]).trim() === targetCustId) {
            customerRowNumber = i + 1;
            break;
          }
        }

        // A retry after a completed close is successful but performs no writes.
        if (customerRowNumber < 0) {
          var priorArchive = ss.getSheetByName("Archived_Customers");
          if (priorArchive && priorArchive.getLastRow() > 1) {
            var priorValues = priorArchive.getDataRange().getValues();
            var priorHeaders = priorValues[0].map(function(header) { return String(header).trim(); });
            var priorIdColumn = priorHeaders.indexOf("ID");
            if (priorIdColumn < 0) priorIdColumn = 0;
            for (var priorRow = 1; priorRow < priorValues.length; priorRow++) {
              if (String(priorValues[priorRow][priorIdColumn]).trim() === targetCustId) {
                return jsonResponse({ status: "success", alreadyClosed: true, archivedCollections: 0 });
              }
            }
          }
          return jsonResponse({ status: "error", message: "Customer not found" });
        }

        var closedSheet = ss.getSheetByName("Closed_Collections");
        if (!closedSheet) {
          closedSheet = ss.insertSheet("Closed_Collections");
          closedSheet.appendRow(["Collection ID", "Customer ID", "Customer Name", "Loan Type", "Collection Date", "Amount", "Original Timestamp", "Archive Date"]);
          closedSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
        }

        var existingCollectionIds = {};
        if (closedSheet.getLastRow() > 1) {
          var closedValues = closedSheet.getDataRange().getValues();
          var closedHeaders = closedValues[0].map(function(header) { return String(header).trim(); });
          var closedIdColumn = closedHeaders.indexOf("Collection ID");
          var closedCustomerColumn = closedHeaders.indexOf("Customer ID");
          var closedDateColumn = closedHeaders.indexOf("Collection Date");
          var closedAmountColumn = closedHeaders.indexOf("Amount");
          for (var closedRow = 1; closedRow < closedValues.length; closedRow++) {
            var closedRecord = closedValues[closedRow];
            if (closedCustomerColumn >= 0 && String(closedRecord[closedCustomerColumn]).trim() !== targetCustId) continue;
            var existingCollectionId = closedIdColumn >= 0 ? String(closedRecord[closedIdColumn] || "").trim() : "";
            var existingCollectionKey = existingCollectionId || (targetCustId + "|" + String(closedDateColumn >= 0 ? closedRecord[closedDateColumn] || "" : "") + "|" + String(closedAmountColumn >= 0 ? closedRecord[closedAmountColumn] || "" : ""));
            existingCollectionIds[existingCollectionKey] = true;
          }
        }

        // Collect all matching records first, then archive them in one write.
        var archivedRows = [];
        var sourceSheets = [];
        var movedCount = 0;
        var archiveTime = new Date();
        ss.getSheets().forEach(function(sourceSheet) {
          var sourceName = sourceSheet.getName();
          if (sourceName !== "Collections" && sourceName.indexOf("Collections_") !== 0) return;
          var sourceValues = sourceSheet.getDataRange().getValues();
          if (sourceValues.length < 2) return;
          var headers = sourceValues[0].map(function(header) { return String(header).trim(); });
          var sourceCustomerIdColumn = headers.indexOf("Customer ID");
          if (sourceCustomerIdColumn < 0) return;
          var rowsToDelete = [];
          for (var sourceRow = 1; sourceRow < sourceValues.length; sourceRow++) {
            var cells = sourceValues[sourceRow];
            if (String(cells[sourceCustomerIdColumn]).trim() !== targetCustId) continue;
            var collectionIdColumn = headers.indexOf("Collection ID");
            var collectionId = collectionIdColumn >= 0 ? String(cells[collectionIdColumn] || "").trim() : "";
            var collectionKey = collectionId || (targetCustId + "|" + String(cells[headers.indexOf("Collection Date")] || "") + "|" + String(cells[headers.indexOf("Amount")] || ""));
            if (!existingCollectionIds[collectionKey]) {
              archivedRows.push([
                collectionId,
                cells[sourceCustomerIdColumn] || "",
                cells[headers.indexOf("Customer Name")] || "",
                cells[headers.indexOf("Loan Type")] || "",
                cells[headers.indexOf("Collection Date")] || "",
                cells[headers.indexOf("Amount")] || "",
                cells[headers.indexOf("Timestamp")] || "",
                archiveTime
              ]);
              existingCollectionIds[collectionKey] = true;
            }
            rowsToDelete.push(sourceRow + 1);
            movedCount++;
          }
          if (rowsToDelete.length) sourceSheets.push({ sheet: sourceSheet, rows: rowsToDelete });
        });

        if (archivedRows.length) {
          closedSheet.getRange(closedSheet.getLastRow() + 1, 1, archivedRows.length, 8).setValues(archivedRows);
        }

        // Delete matching source rows in contiguous bottom-up blocks.
        sourceSheets.forEach(function(source) {
          for (var rowIndex = source.rows.length - 1; rowIndex >= 0;) {
            var endRow = source.rows[rowIndex];
            var startRow = endRow;
            rowIndex--;
            while (rowIndex >= 0 && source.rows[rowIndex] === startRow - 1) {
              startRow = source.rows[rowIndex];
              rowIndex--;
            }
            source.sheet.deleteRows(startRow, endRow - startRow + 1);
          }
        });

        var archivedCustomersSheet = ss.getSheetByName("Archived_Customers");
        if (!archivedCustomersSheet) {
          archivedCustomersSheet = ss.insertSheet("Archived_Customers");
          archivedCustomersSheet.appendRow(customerHeaders.concat(["Archive Date"]));
          archivedCustomersSheet.getRange(1, 1, 1, customerHeaders.length + 1).setFontWeight("bold");
        }
        if (archivedCustomersSheet.getLastColumn() === 0) {
          archivedCustomersSheet.appendRow(customerHeaders.concat(["Archive Date"]));
          archivedCustomersSheet.getRange(1, 1, 1, customerHeaders.length + 1).setFontWeight("bold");
        }
        var archivedCustomerHeaders = archivedCustomersSheet.getRange(1, 1, 1, archivedCustomersSheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
        var customerRow = cRows[customerRowNumber - 1].slice();
        if (statusColumn >= 0) customerRow[statusColumn] = "Closed";
        var archivedCustomerRow = archivedCustomerHeaders.map(function(header) {
          if (header === "Archive Date") return archiveTime;
          var sourceColumn = customerHeaders.indexOf(header);
          return sourceColumn >= 0 ? customerRow[sourceColumn] : "";
        });
        archivedCustomersSheet.appendRow(archivedCustomerRow);
        custSheet.deleteRow(customerRowNumber);

        clearDashboardCache();
        return jsonResponse({ status: "success", archivedCollections: movedCount });
      } finally {
        closeLock.releaseLock();
      }
    }

    else if (data.action === "reopen_loan") {
      var archivedCustomersSheet = ss.getSheetByName("Archived_Customers");
      var archivedValues = archivedCustomersSheet ? archivedCustomersSheet.getDataRange().getValues() : [];
      if (archivedValues.length > 1) {
        var archivedCustomerHeaders = archivedValues[0].map(function(header) { return String(header).trim(); });
        var archivedIdIndex = archivedCustomerHeaders.indexOf("ID");
        if (archivedIdIndex < 0) return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Archive sheet is missing the ID column"})).setMimeType(ContentService.MimeType.JSON);
        for (var i = archivedValues.length - 1; i >= 1; i--) {
          if (String(archivedValues[i][archivedIdIndex]).trim() !== String(data.customerId).trim()) continue;
          var activeHeaders = custSheet.getRange(1, 1, 1, custSheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
          var activeValues = custSheet.getDataRange().getValues();
          var activeIdIndex = activeHeaders.indexOf("ID");
          var activeRowNumber = -1;
          for (var activeIndex = 1; activeIndex < activeValues.length; activeIndex++) {
            if (String(activeValues[activeIndex][activeIdIndex]).trim() === String(data.customerId).trim()) {
              activeRowNumber = activeIndex + 1;
              break;
            }
          }
          var archivedRow = archivedValues[i];
          var sourceActiveRow = activeRowNumber > 0 ? activeValues[activeRowNumber - 1] : null;
          var activeRow = activeHeaders.map(function(header, column) {
            if (header === "Status") return "Active";
            if (sourceActiveRow) return sourceActiveRow[column];
            var archivedColumn = archivedCustomerHeaders.indexOf(header);
            return archivedColumn >= 0 ? archivedRow[archivedColumn] : "";
          });
          var editedFields = {
            "Timestamp": new Date(), "Customer Name": data.customerName, "Guardian Type": data.guardianType,
            "Guardian Name": data.guardianName, "Gender": data.gender, "DOB": data.dob, "Religion": data.religion,
            "Aadhaar No": data.aadhaarNo, "Mobile No": data.mobileNo, "Address": data.address,
            "Occupation": data.occupation, "Loan Type": data.loanType, "Group Name": data.groupName,
            "Loan Amount": data.loanAmount, "Start Date": data.startDate, "Duration (Days)": data.durationDays,
            "Duration (Month)": data.groupDurationMonths, "Interest %": data.interestRate,
            "Interest Rate (%)": data.interestRate, "Monthly Interest (%)": data.monthlyInterest,
            "Nominee Name": data.nomineeName, "Nominee Guardian Type": data.nomineeGuardianType,
            "Nominee Guardian Name": data.nomineeGuardianName, "Nominee Gender": data.nomineeGender,
            "Nominee Occupation": data.nomineeOccupation, "Nominee DOB": data.nomineeDob,
            "Nominee Aadhaar": data.nomineeAadhaar, "Relation with Applicant": data.relationWithApplicant,
            "Relation With Applicant": data.relationWithApplicant, "Bank Name": data.bankName,
            "Bank Branch": data.bankBranch, "IFSC Code": data.ifscCode,
            "Account Holder Name": data.accountHolderName, "Account Number": data.accountNumber
          };
          var photoColumn = activeHeaders.indexOf("Photo URL");
          var reopenedPhotoUrl = data.existingPhotoUrl || (photoColumn >= 0 ? activeRow[photoColumn] : "");
          if (data.photoBase64 && data.photoName) {
            reopenedPhotoUrl = uploadImageToDrive(data.photoBase64, data.photoMimeType, data.photoName, folderId) || reopenedPhotoUrl;
          }
          editedFields["Photo URL"] = reopenedPhotoUrl;
          Object.keys(editedFields).forEach(function(header) {
            var column = activeHeaders.indexOf(header);
            if (column >= 0 && editedFields[header] !== undefined) activeRow[column] = editedFields[header] || "";
          });
          if (activeRowNumber > 0) {
            custSheet.getRange(activeRowNumber, 1, 1, activeHeaders.length).setValues([activeRow]);
          } else {
            custSheet.appendRow(activeRow);
          }
          // Keep the archived row as the original closed-loan snapshot.
          clearDashboardCache();
          return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Loan reopened"})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      // Backward compatibility for closed customers that were not moved to the archive sheet.
      var values = custSheet.getDataRange().getValues();
      var idIndex = values[0].map(function(header) { return String(header).trim(); }).indexOf("ID");
      var statusIndex = values[0].map(function(header) { return String(header).trim(); }).indexOf("Status");
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][idIndex]).trim() === String(data.customerId).trim()) {
          if (statusIndex >= 0) custSheet.getRange(i + 1, statusIndex + 1).setValue("Active");
          clearDashboardCache();
          return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Loan reopened"})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Customer not found"})).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "delete_gold_loan") {
      var deletedGoldLoan = deleteGoldLoanRecord(goldSheet, data.id);
      if (deletedGoldLoan) clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: deletedGoldLoan ? "success" : "error", message: deletedGoldLoan ? "" : "Gold loan not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "record_gold_emi_payment") {
      var emiResult = recordGoldEmiPayment(ss, goldSheet, data);
      if (emiResult.status === "success") clearDashboardCache();
      return jsonResponse(emiResult);
    }

    else if (data.action === "record_gold_emi_installment") {
      var installmentResult = recordGoldEmiInstallment(ss, goldSheet, data);
      if (installmentResult.status === "success") clearDashboardCache();
      return jsonResponse(installmentResult);
    }

    else if (data.action === "record_gold_daily_interest_payment") {
      var dailyInterestResult = recordGoldDailyInterestPayment(ss, goldSheet, data);
      if (dailyInterestResult.status === "success") clearDashboardCache();
      return jsonResponse(dailyInterestResult);
    }

    else if (data.action === "update_gold_loan") {
      if (!/^\d{10}$/.test(String(data.mobileNo || "")) || !/^\d{12}$/.test(String(data.aadhaarNo || "")) || (data.nomineeAadhaar && !/^\d{12}$/.test(String(data.nomineeAadhaar)))) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Mobile must be 10 digits and Aadhaar numbers must be 12 digits." })).setMimeType(ContentService.MimeType.JSON);
      }
      var updatedGoldLoan = updateGoldLoanRecord(goldSheet, data, folderId);
      if (updatedGoldLoan) clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: updatedGoldLoan ? "success" : "error", message: updatedGoldLoan ? "" : "Gold loan not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "create_gold_loan") {
      if (!/^\d{10}$/.test(String(data.mobileNo || "")) || !/^\d{12}$/.test(String(data.aadhaarNo || "")) || (data.nomineeAadhaar && !/^\d{12}$/.test(String(data.nomineeAadhaar)))) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Mobile must be 10 digits and Aadhaar numbers must be 12 digits." })).setMimeType(ContentService.MimeType.JSON);
      }
      var goldId = "GL-" + new Date().getTime();
      var timestamp = new Date();
      
      var nomineePhotoUrl = uploadImageToDrive(data.nomineeImgBase64, data.nomineeImgType, data.nomineeImgName, folderId);
      var goldItemPhotoUrl = uploadImageToDrive(data.goldItemImgBase64, data.goldItemImgType, data.goldItemImgName, folderId);
      
      appendGoldLoanRecord(goldSheet, {
        "ID": goldId, "Timestamp": timestamp, "Application No": data.appNo || "", "Application Date": data.appDate || "",
        "Branch Name": data.branchName || "", "Branch Code": data.branchCode || "", "Loan Officer Name": data.officerName || "",
        "CSP Location": data.cspLocation || "", "Borrower Name": data.borrowerName || "", "Mobile No": data.mobileNo || "",
        "Identity No": data.identityNo || "", "Address": data.address || "", "Monthly Income": data.monthlyIncome || "",
        "Guardian Type": data.guardianType || "", "Guardian Name": data.guardianName || "", "Gender": data.gender || "",
        "DOB": data.dob || "", "Religion": data.religion || "", "Aadhaar No": data.aadhaarNo || "", "Occupation": data.occupation || "",
        "Customer Bank Name": data.customerBankName || "", "Customer Bank Branch": data.customerBankBranch || "",
        "Customer IFSC Code": data.customerIfscCode || "", "Customer Account Holder": data.customerAccountHolder || "",
        "Customer Account Number": data.customerAccountNumber || "", "Nominee Name": data.nomineeName || "",
        "Nominee Guardian Type": data.nomineeGuardianType || "", "Nominee Guardian Name": data.nomineeGuardianName || "",
        "Nominee Gender": data.nomineeGender || "", "Nominee Occupation": data.nomineeOccupation || "",
        "Nominee DOB": data.nomineeDob || "", "Nominee Aadhaar": data.nomineeAadhaar || "",
        "Relation With Applicant": data.relationWithApplicant || "",
        "Nominee Photo URL": nomineePhotoUrl, "Gold Item Photo URL": goldItemPhotoUrl, "Gold Articles Details": data.goldArticles || "",
        "Valuation Date": data.valuationDate || "", "Total Gross Weight (g)": data.totalGrossWeight || "",
        "Total Net Weight (g)": data.totalNetWeight || "", "Total Assessed Value": data.assessedValue || "",
        "LTV (%)": data.ltvPercent || "", "Eligible Amount": data.eligibleAmount || "", "Loan Amount Requested": data.loanAmount || "",
        "Processing Charge": data.processingCharge || 0, "Document Charge": data.documentCharge || 0,
        "Net Disbursement Amount": data.netDisbursementAmount || 0,
        "Loan Tenure": data.loanTenure || "", "Loan Tenure Unit": data.loanTenureUnit || "Months", "Outstanding Principal": data.loanAmount || 0, "Accrued Interest Balance": 0, "Purpose of Loan": data.purpose || "", "Scheme": data.scheme || "",
        "Rate of Interest (%)": data.interestRate || "", "Repayment Method": data.repaymentType || "",
        "Installment Amount": data.installmentAmount || "", "Total Interest": data.totalInterest || "",
        "Total Payable": data.totalPayable || "", "First EMI Date": data.firstEmiDate || "", "EMI Close Date": data.emiCloseDate || data.maturityDate || "", "Maturity Date": data.maturityDate || data.emiCloseDate || "", "Disbursement Mode": data.disbursementMode || "",
        "Bank Name": data.bankName || "", "A/C Holder Name": data.acHolderName || "", "A/C Number": data.acNumber || "",
        "IFSC Code": data.ifscCode || "", "Branch": data.bankBranch || "", "Submitted Documents": data.submittedDocuments || "", "Status": "Active"
      });
      
      clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", id: goldId })).setMimeType(ContentService.MimeType.JSON);
    }

    var photoUrl = data.existingPhotoUrl || "";
    
    if (data.photoBase64 && data.photoName) {
      var folder = DriveApp.getFolderById(folderId);
      var existingFiles = folder.getFilesByName(data.photoName);
      
      if (existingFiles.hasNext()) {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "error", 
          message: "IMAGE_EXISTS" 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      photoUrl = uploadImageToDrive(data.photoBase64, data.photoMimeType, data.photoName, folderId);
    }

    // 🟢 CREATE CUSTOMER
    if (data.action === "create" || data.action === "create_group") {
      var isGroupCustomer = data.action === "create_group";
      var id = (isGroupCustomer ? "GROUP-" : "CUST-") + new Date().getTime();
      var timestamp = new Date(); 
      ensureCustomerBankColumns(custSheet);
      ensureCustomerHeaders(custSheet, ["Duration (Month)", "Monthly Interest (%)"]);

      var destinationSheet = custSheet;
      if (isGroupCustomer) {
        destinationSheet = ss.getSheetByName("Group_Customers");
        if (!destinationSheet) {
          destinationSheet = ss.insertSheet("Group_Customers");
          var customerHeaders = custSheet.getRange(1, 1, 1, custSheet.getLastColumn()).getValues()[0];
          destinationSheet.getRange(1, 1, 1, customerHeaders.length).setValues([customerHeaders]);
          destinationSheet.getRange(1, 1, 1, customerHeaders.length).setFontWeight("bold");
        }
      }
      
      var newRowData = [
        id, timestamp, data.customerName, data.guardianType, data.guardianName, data.gender, data.dob, 
        data.religion || "", data.aadhaarNo, data.mobileNo, data.address || "", data.occupation, photoUrl, 
        isGroupCustomer ? "Group Loan" : (data.loanType || ""), data.groupName || "", data.loanAmount || "", data.startDate || "",
        data.durationDays || "", data.interestRate || "", data.nomineeName, data.nomineeGuardianType, 
        data.nomineeGuardianName, data.nomineeGender, data.nomineeOccupation, data.nomineeDob, 
        data.nomineeAadhaar, data.relationWithApplicant, "Active",
        data.bankName || "", data.bankBranch || "", data.ifscCode || "",
        data.accountHolderName || "", data.accountNumber || ""
      ];

      destinationSheet.appendRow(newRowData);
      if (!isGroupCustomer && data.loanType === "Group RD") {
        var newCustomerHeaders = custSheet.getRange(1, 1, 1, custSheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
        var newCustomerRow = custSheet.getLastRow();
        custSheet.getRange(newCustomerRow, newCustomerHeaders.indexOf("Duration (Month)") + 1).setValue(data.groupDurationMonths || "");
        custSheet.getRange(newCustomerRow, newCustomerHeaders.indexOf("Monthly Interest (%)") + 1).setValue(data.monthlyInterest || "");
      }
      clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", id: id, photoUrl: photoUrl })).setMimeType(ContentService.MimeType.JSON);
    } 
    
    // 🟢 UPDATE CUSTOMER (Fixed: use data.id instead of the never-sent data.customerId,
    //     and always return a message so the frontend alert is meaningful)
    else if (data.action === "update") {
      var targetCustomerSheet = data.targetSheet === "Group_Customers" || String(data.id || "").indexOf("GROUP-") === 0
        ? ss.getSheetByName("Group_Customers")
        : custSheet;
      if (!targetCustomerSheet) targetCustomerSheet = custSheet;
      var rows = targetCustomerSheet.getDataRange().getValues();
      var updated = false;
      var timestamp = new Date(); 
      var targetId = String(data.id).trim();
      var bankColumns = ensureCustomerBankColumns(targetCustomerSheet);
      ensureCustomerHeaders(targetCustomerSheet, ["Duration (Month)", "Monthly Interest (%)"]);

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === targetId) {
          var currentStatus = rows[i][27] || "Active"; // ২৮ নাম্বার কলাম (ইনডেক্স ২৭) হলো স্ট্যাটাস
          
          var updateRowData = [
            data.id, timestamp, data.customerName, data.guardianType, data.guardianName, data.gender, data.dob, 
            data.religion || "", data.aadhaarNo, data.mobileNo, data.address || "", data.occupation, photoUrl, 
            data.loanType || rows[i][13] || "", data.groupName || rows[i][14] || "", data.loanAmount || rows[i][15] || "", data.startDate || rows[i][16] || "",
            data.durationDays || rows[i][17] || "", data.interestRate || rows[i][18] || "", data.nomineeName, data.nomineeGuardianType,
            data.nomineeGuardianName, data.nomineeGender, data.nomineeOccupation, data.nomineeDob, data.nomineeAadhaar, 
            data.relationWithApplicant, currentStatus
          ]; // ঠিক ২৮টি ডেটা

          // 28টি কলাম আপডেট করা হচ্ছে
          targetCustomerSheet.getRange(i + 1, 1, 1, 28).setValues([updateRowData]);
          targetCustomerSheet.getRange(i + 1, bankColumns["Bank Name"]).setValue(data.bankName || "");
          targetCustomerSheet.getRange(i + 1, bankColumns["Bank Branch"]).setValue(data.bankBranch || "");
          targetCustomerSheet.getRange(i + 1, bankColumns["IFSC Code"]).setValue(data.ifscCode || "");
          targetCustomerSheet.getRange(i + 1, bankColumns["Account Holder Name"]).setValue(data.accountHolderName || "");
          targetCustomerSheet.getRange(i + 1, bankColumns["Account Number"]).setValue(data.accountNumber || "");
          var extraHeaders = targetCustomerSheet.getRange(1, 1, 1, targetCustomerSheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
          var durationMonthColumn = extraHeaders.indexOf("Duration (Month)");
          var monthlyInterestColumn = extraHeaders.indexOf("Monthly Interest (%)");
          if (durationMonthColumn >= 0) targetCustomerSheet.getRange(i + 1, durationMonthColumn + 1).setValue(data.groupDurationMonths || rows[i][durationMonthColumn] || "");
          if (monthlyInterestColumn >= 0) targetCustomerSheet.getRange(i + 1, monthlyInterestColumn + 1).setValue(data.monthlyInterest || rows[i][monthlyInterestColumn] || "");
          updated = true; 
          break;
        }
      }
      if (updated) clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ 
        status: updated ? "success" : "error", 
        message: updated ? "" : "Customer ID not found: " + targetId,
        photoUrl: photoUrl 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    else if (data.action === "disable") {
      var rows = custSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(data.id).trim()) {
          custSheet.getRange(i + 1, 28).setValue("Disabled"); // 28th column is Status
          clearDashboardCache();
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Customer ID not found: " + data.id })).setMimeType(ContentService.MimeType.JSON);
    }
    else if (data.action === "enable") {
      var enableRows = custSheet.getDataRange().getValues();
      for (var ei = 1; ei < enableRows.length; ei++) {
        if (String(enableRows[ei][0]).trim() === String(data.id).trim()) {
          custSheet.getRange(ei + 1, 28).setValue("Active");
          clearDashboardCache();
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Customer ID not found: " + data.id })).setMimeType(ContentService.MimeType.JSON);
    }
    else if (data.action === "delete") {
      var targetDeleteSheet = data.sheet === "Group_Customers" || String(data.id || "").indexOf("GROUP-") === 0
        ? ss.getSheetByName("Group_Customers")
        : custSheet;
      if (!targetDeleteSheet) targetDeleteSheet = custSheet;
      var rows = targetDeleteSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(data.id).trim()) {
          targetDeleteSheet.deleteRow(i + 1);
          clearDashboardCache();
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Customer ID not found: " + data.id })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Action not matched" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================
// Helper Functions
// =====================================

function getOrCreateIndusindAccountsSheet(ss) {
  var sheet = ss.getSheetByName("Indusind_Accounts");
  var headers = ["ID", "Timestamp", "Branch Name", "Branch IFSC Code", "Branch Address", "Account Type", "A/C Holder Name", "Date of Birth", "Guardian Name", "Account Number", "Customer ID", "Opened On", "Issue Date", "Aadhaar Number", "PAN Number", "Mobile Number", "E-mail ID", "Operated By", "Vill", "PO", "PS", "Dist", "State", "PIN Code", "Photo URL"];
  if (!sheet) {
    sheet = ss.insertSheet("Indusind_Accounts");
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function getOrCreateAppSettingsSheet_(ss) {
  var sheet = ss.getSheetByName("App_Settings");
  if (!sheet) {
    sheet = ss.insertSheet("App_Settings");
    sheet.appendRow(["Setting Key", "Setting Value", "Updated At"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }
  return sheet;
}

function readAppLogoSettings_(ss) {
  var logos = { indusind: "", gold: "", rd: "" };
  var sheet = ss.getSheetByName("App_Settings");
  if (sheet && sheet.getLastRow() > 1) {
    var rows = sheet.getDataRange().getValues();
    for (var row = 1; row < rows.length; row++) {
      var key = String(rows[row][0] || "").trim();
      if (Object.prototype.hasOwnProperty.call(logos, key)) logos[key] = String(rows[row][1] || "");
    }
  }
  return { storage: "database", logos: logos };
}

function saveAppLogoSetting_(ss, data, folderId) {
  var key = String(data.logoKey || "").trim();
  if (["indusind", "gold", "rd"].indexOf(key) === -1) return { status: "error", message: "Unknown logo setting." };
  var sheet = getOrCreateAppSettingsSheet_(ss);
  var values = sheet.getDataRange().getValues();
  var settingRow = -1;

  if (data.action === "delete_app_logo") {
    for (var clearIndex = 1; clearIndex < values.length; clearIndex++) {
      if (String(values[clearIndex][0]).trim() === key) {
        settingRow = clearIndex + 1;
        break;
      }
    }
    if (settingRow > 0) sheet.getRange(settingRow, 2, 1, 2).setValues([["", new Date()]]);
    return { status: "success", logoKey: key, logoUrl: "" };
  }

  if (!data.logoBase64 || !String(data.logoMimeType || "").match(/^image\//i)) return { status: "error", message: "Choose a valid image logo." };
  var fileName = "App-Logo-" + key + "-" + new Date().getTime() + "." + (String(data.logoMimeType).split("/")[1] || "img").replace(/[^a-z0-9]/gi, "");
  var logoUrl = uploadImageToDrive(data.logoBase64, data.logoMimeType, fileName, folderId);
  if (!logoUrl) return { status: "error", message: "Could not upload the logo to Drive." };

  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][0]).trim() === key) {
      settingRow = rowIndex + 1;
      break;
    }
  }
  if (settingRow > 0) sheet.getRange(settingRow, 2, 1, 2).setValues([[logoUrl, new Date()]]);
  else sheet.appendRow([key, logoUrl, new Date()]);
  return { status: "success", logoKey: key, logoUrl: logoUrl };
}

function readIndusindAccountsForClient_(sheet, timezone) {
  return readReportSheet_(sheet, timezone).map(function(record) {
    return {
      ID: record.ID,
      branchName: record["Branch Name"],
      branchIfsc: record["Branch IFSC Code"],
      branchAddress: record["Branch Address"],
      accountType: record["Account Type"],
      holderName: record["A/C Holder Name"],
      dateOfBirth: record["Date of Birth"],
      guardianName: record["Guardian Name"],
      accountNumber: record["Account Number"],
      customerId: record["Customer ID"],
      openedOn: record["Opened On"],
      issueDate: record["Issue Date"],
      aadhaarNumber: record["Aadhaar Number"],
      panNumber: record["PAN Number"],
      mobileNumber: record["Mobile Number"],
      emailId: record["E-mail ID"],
      operatedBy: record["Operated By"],
      village: record["Vill"],
      postOffice: record["PO"],
      policeStation: record["PS"],
      district: record["Dist"],
      state: record["State"],
      pinCode: record["PIN Code"],
      "Photo URL": record["Photo URL"]
    };
  });
}

function handleIndusindAccountAction(ss, data, folderId) {
  var sheet = getOrCreateIndusindAccountsSheet(ss);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(header) { return String(header).trim(); });
  var idColumn = headers.indexOf("ID");

  if (data.action === "delete_indusind_account") {
    for (var row = 1; row < values.length; row++) {
      if (String(values[row][idColumn]) === String(data.id)) {
        sheet.deleteRow(row + 1);
        return { status: "success" };
      }
    }
    return { status: "error", message: "Account entry not found." };
  }

  var account = data.account || {};
  if (!String(account.holderName || "").trim()) return { status: "error", message: "A/C Holder Name is required." };
  if (account.aadhaarNumber && !/^\d{12}$/.test(String(account.aadhaarNumber))) return { status: "error", message: "Aadhaar Number must contain 12 digits." };
  if (account.mobileNumber && !/^\d{10}$/.test(String(account.mobileNumber))) return { status: "error", message: "Mobile Number must contain 10 digits." };
  if (account.pinCode && !/^\d{6}$/.test(String(account.pinCode))) return { status: "error", message: "PIN Code must contain 6 digits." };

  var accountId = data.action === "update_indusind_account" ? String(data.id || "") : "IA-" + new Date().getTime();
  if (!accountId) return { status: "error", message: "Account entry ID is missing." };
  var photoUrl = data.existingPhotoUrl || "";
  if (data.photoBase64 && data.photoName) {
    photoUrl = uploadImageToDrive(data.photoBase64, data.photoMimeType || "image/jpeg", "Indusind-" + accountId + "-" + data.photoName, folderId) || photoUrl;
  }
  var valuesByHeader = {
    "ID": accountId,
    "Timestamp": new Date(),
    "Branch Name": account.branchName || "Amtala -0298",
    "Branch IFSC Code": account.branchIfsc || "INDB0000298",
    "Branch Address": account.branchAddress || "Amtala, South 24 Parganas, WB, 743398",
    "Account Type": account.accountType || "Saving",
    "A/C Holder Name": account.holderName || "",
    "Date of Birth": account.dateOfBirth || "",
    "Guardian Name": account.guardianName || "",
    "Account Number": account.accountNumber || "",
    "Customer ID": account.customerId || "",
    "Opened On": account.openedOn || "",
    "Issue Date": account.issueDate || "",
    "Aadhaar Number": account.aadhaarNumber || "",
    "PAN Number": String(account.panNumber || "").toUpperCase(),
    "Mobile Number": account.mobileNumber || "",
    "E-mail ID": account.emailId || "",
    "Operated By": account.operatedBy || "Self",
    "Vill": account.village || "",
    "PO": account.postOffice || "",
    "PS": account.policeStation || "",
    "Dist": account.district || "",
    "State": account.state || "",
    "PIN Code": account.pinCode || "",
    "Photo URL": photoUrl
  };
  var rowValues = headers.map(function(header) { return valuesByHeader[header] === undefined ? "" : valuesByHeader[header]; });

  if (data.action === "update_indusind_account") {
    for (var updateRow = 1; updateRow < values.length; updateRow++) {
      if (String(values[updateRow][idColumn]) === accountId) {
        sheet.getRange(updateRow + 1, 1, 1, headers.length).setValues([rowValues]);
        return { status: "success", id: accountId, photoUrl: photoUrl };
      }
    }
    return { status: "error", message: "Account entry not found." };
  }

  sheet.appendRow(rowValues);
  return { status: "success", id: accountId, photoUrl: photoUrl };
}

function uploadImageToDrive(base64Data, mimeType, fileName, folderId) {
  if (!base64Data || !fileName) return "";
  try {
    var folder = DriveApp.getFolderById(folderId);
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType || "image/png", fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch(e) {
    return "";
  }
}

function getOrCreateGoldEmiPaymentsSheet(ss) {
  var sheet = ss.getSheetByName("Gold_Loan_EMI_Payments");
  if (!sheet) {
    sheet = ss.insertSheet("Gold_Loan_EMI_Payments");
    sheet.appendRow(["Payment ID", "Receipt ID", "Loan ID", "Application No", "Customer Name", "Installment Month", "Paid Date", "Amount", "Timestamp"]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
  }
  return sheet;
}

function parseGoldLoanDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  var text = String(value || "").trim();
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  var dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  return null;
}

function goldLoanDateIso(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getLegacyGoldEmiCollectionDates(ss, loanId) {
  var dates = [];
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name !== "Collections" && name.indexOf("Collections_") !== 0) return;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    var headers = values[0].map(function(header) { return String(header).trim(); });
    var idColumn = headers.indexOf("Customer ID");
    var typeColumn = headers.indexOf("Loan Type");
    var dateColumn = headers.indexOf("Collection Date");
    if (idColumn < 0 || typeColumn < 0 || dateColumn < 0) return;
    for (var row = 1; row < values.length; row++) {
      if (String(values[row][idColumn]).trim() !== loanId || String(values[row][typeColumn] || "").trim().toLowerCase() !== "gold loan") continue;
      var date = parseGoldLoanDate(values[row][dateColumn]);
      if (date) dates.push(goldLoanDateIso(date));
    }
  });
  return dates;
}

function recordGoldDailyInterestPayment(ss, goldSheet, data) {
  var loanId = String(data.loanId || "").trim();
  var startDateText = String(data.startDate || "").trim();
  var endDateText = String(data.endDate || "").trim();
  var startDate = parseGoldLoanDate(startDateText), endDate = parseGoldLoanDate(endDateText);
  if (!startDate || !endDate || goldLoanDateIso(startDate) !== startDateText || goldLoanDateIso(endDate) !== endDateText || endDate < startDate) {
    return { status: "error", message: "Select a valid collection date range." };
  }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  if (endDate > today) return { status: "error", message: "Collection date range cannot end in the future." };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (lockError) { return { status: "error", message: "Another payment is being saved. Please try again." }; }
  try {
    var values = goldSheet.getDataRange().getValues();
    var headers = values[0].map(function(header) { return String(header).trim(); });
    var idColumn = headers.indexOf("ID"), rowNumber = -1, loan = {};
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idColumn]).trim() === loanId) {
        rowNumber = i + 1;
        headers.forEach(function(header, index) { loan[header] = values[i][index]; });
        break;
      }
    }
    if (rowNumber < 0) return { status: "error", message: "Gold loan was not found." };
    if (String(loan["Repayment Method"] || "").trim().toLowerCase() !== "daily interest") return { status: "error", message: "Daily collection is only available for Daily Interest loans." };
    var rateAnnual = Number(loan["Rate of Interest (%)"] || 0);
    var originalPrincipal = Number(loan["Loan Amount Requested"] || 0);
    var accruedBalance = Number(loan["Accrued Interest Balance"] || 0);
    var amount = Number(data.amount || 0);
    var principalPayment = Number(data.principalAmount || 0);
    if (!(originalPrincipal > 0) || !(amount > 0) || !isFinite(rateAnnual) || rateAnnual < 0 || !isFinite(principalPayment) || principalPayment < 0) return { status: "error", message: "Loan balance, interest rate, or payment amount is invalid." };
    var paymentSheet = getOrCreateGoldEmiPaymentsSheet(ss);
    var paymentValues = paymentSheet.getDataRange().getValues();
    var paymentHeaders = paymentValues[0].map(function(header) { return String(header).trim(); });
    var loanCol = paymentHeaders.indexOf("Loan ID"), endCol = paymentHeaders.indexOf("Period End"), priorEnd = null;
    var principalPaidColumn = paymentHeaders.indexOf("Principal Paid"), totalPrincipalPaid = 0;
    for (var p = 1; p < paymentValues.length; p++) {
      if (String(paymentValues[p][loanCol]).trim() !== loanId) continue;
      if (principalPaidColumn >= 0) totalPrincipalPaid += Math.max(0, Number(paymentValues[p][principalPaidColumn]) || 0);
      if (endCol >= 0) {
        var recordedEnd = parseGoldLoanDate(paymentValues[p][endCol]);
        if (recordedEnd && (!priorEnd || recordedEnd > priorEnd)) priorEnd = recordedEnd;
      }
    }
    // Rebuild principal from the original loan amount and recorded principal payments.
    // This repairs stale Outstanding Principal values left by older interest-only logic.
    var principal = Math.max(0, Math.round((originalPrincipal - totalPrincipalPaid) * 100) / 100);
    if (principalPayment > principal) return { status: "error", message: "Principal repayment cannot exceed the outstanding principal." };
    var legacyCollectionDates = getLegacyGoldEmiCollectionDates(ss, loanId);
    if (legacyCollectionDates.some(function(date) { return date >= startDateText && date <= endDateText; })) {
      return { status: "error", message: "A payment is already recorded for one or more dates in this range." };
    }
    if (priorEnd && startDate <= priorEnd) return { status: "error", message: "This date range overlaps an earlier collection. Start after " + goldLoanDateIso(priorEnd) + "." };
    var days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    var interestDue = Math.round((principal * rateAnnual / 100 * days / 30 + accruedBalance) * 100) / 100;
    if (amount > interestDue) return { status: "error", message: "Daily interest payment cannot exceed the interest due. Principal is not changed by an interest payment." };
    var interestPaid = amount;
    var principalPaid = Math.round(principalPayment * 100) / 100;
    var remainingPrincipal = Math.max(0, Math.round((principal - principalPaid) * 100) / 100);
    var remainingInterest = Math.round((interestDue - interestPaid) * 100) / 100;
    var dailyInterest = Math.round((remainingPrincipal * rateAnnual / 100 / 30) * 100) / 100;
    var extraHeaders = ["Period Start", "Period End", "Payment Type", "Interest Amount", "Principal Paid", "Outstanding Principal", "Daily Interest"];
    var missing = extraHeaders.filter(function(header) { return paymentHeaders.indexOf(header) < 0; });
    if (missing.length) {
      paymentSheet.getRange(1, paymentHeaders.length + 1, 1, missing.length).setValues([missing]);
      paymentSheet.getRange(1, paymentHeaders.length + 1, 1, missing.length).setFontWeight("bold");
      paymentHeaders = paymentHeaders.concat(missing);
    }
    var receiptId = "GDI-" + new Date().getTime(), paymentDate = goldLoanDateIso(new Date());
    var record = {
      "Payment ID": receiptId, "Receipt ID": receiptId, "Loan ID": loanId,
      "Application No": loan["Application No"] || "", "Customer Name": loan["Borrower Name"] || "", "Mobile No": loan["Mobile No"] || "",
      "Installment Month": endDateText.slice(0, 7), "Installment Number": "", "Due Date": endDateText,
      "Paid Date": paymentDate, "Payment Date": paymentDate, "Amount": amount + principalPaid, "EMI Amount": amount,
      "Fine Amount": 0, "Total Paid": amount + principalPaid, "Period Start": startDateText, "Period End": endDateText,
      "Payment Type": principalPaid > 0 ? "Daily Interest + Principal" : "Daily Interest", "Interest Amount": interestPaid, "Principal Paid": principalPaid,
      "Outstanding Principal": remainingPrincipal, "Daily Interest": dailyInterest, "Timestamp": new Date()
    };
    paymentSheet.appendRow(paymentHeaders.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ""; }));
    var currentHeaders = goldSheet.getRange(1, 1, 1, goldSheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
    ["Outstanding Principal", "Accrued Interest Balance"].forEach(function(header) {
      if (currentHeaders.indexOf(header) < 0) {
        goldSheet.getRange(1, currentHeaders.length + 1).setValue(header).setFontWeight("bold");
        currentHeaders.push(header);
      }
    });
    goldSheet.getRange(rowNumber, currentHeaders.indexOf("Outstanding Principal") + 1).setValue(remainingPrincipal);
    goldSheet.getRange(rowNumber, currentHeaders.indexOf("Accrued Interest Balance") + 1).setValue(remainingInterest);
    return {
      status: "success", receiptId: receiptId, loanId: loanId, applicationNo: loan["Application No"] || "",
      customerName: loan["Borrower Name"] || "", mobileNo: loan["Mobile No"] || "", startDate: startDateText,
      endDate: endDateText, paymentDate: paymentDate, days: days, interestPaid: interestPaid,
      principalPaid: principalPaid, outstandingPrincipal: remainingPrincipal, accruedInterest: remainingInterest,
      dailyInterest: dailyInterest, totalPaid: amount + principalPaid
    };
  } finally {
    lock.releaseLock();
  }
}

function recordGoldEmiInstallment(ss, goldSheet, data) {
  var loanId = String(data.loanId || "").trim();
  var goldValues = goldSheet.getDataRange().getValues();
  var goldHeaders = goldValues[0].map(function(header) { return String(header).trim(); });
  var idColumn = goldHeaders.indexOf("ID"), loanRow = null;
  for (var i = 1; i < goldValues.length; i++) {
    if (String(goldValues[i][idColumn]).trim() === loanId) { loanRow = goldValues[i]; break; }
  }
  if (!loanRow) return { status: "error", message: "Gold loan was not found." };
  var loan = {};
  goldHeaders.forEach(function(header, index) { loan[header] = loanRow[index]; });
  if (String(loan["Repayment Method"] || "").toLowerCase() !== "emi") return { status: "error", message: "This loan does not use monthly EMI repayment." };

  var tenure = Math.max(0, parseInt(loan["Loan Tenure"], 10) || 0);
  var emiAmount = Number(loan["Installment Amount"] || loan["EMI Amount"] || 0);
  if (!tenure || !(emiAmount > 0)) return { status: "error", message: "The EMI amount or loan tenure is missing." };
  var firstDue = parseGoldLoanDate(loan["First EMI Date"]);
  if (!firstDue) {
    firstDue = parseGoldLoanDate(loan["Application Date"]);
    if (firstDue) firstDue.setDate(firstDue.getDate() + 30);
  }
  if (!firstDue) return { status: "error", message: "The first EMI date is missing." };

  var paymentLock = LockService.getScriptLock();
  try {
    paymentLock.waitLock(10000);
  } catch (lockError) {
    return { status: "error", message: "Another EMI payment is being saved. Please try again." };
  }
  try {
  var paymentSheet = getOrCreateGoldEmiPaymentsSheet(ss);
  var requiredHeaders = ["Mobile No", "Installment Number", "Due Date", "Payment Date", "EMI Amount", "Fine Amount", "Total Paid"];
  var headers = paymentSheet.getRange(1, 1, 1, paymentSheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
  var missing = requiredHeaders.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missing.length) {
    paymentSheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    paymentSheet.getRange(1, headers.length + 1, 1, missing.length).setFontWeight("bold");
    headers = headers.concat(missing);
  }
  var rows = paymentSheet.getDataRange().getValues();
  var loanColumn = headers.indexOf("Loan ID"), paidCount = 0, paidDateColumns = [headers.indexOf("Payment Date"), headers.indexOf("Paid Date"), headers.indexOf("Due Date"), headers.indexOf("Installment Month")].filter(function(index) { return index >= 0; });
  var recordedDates = {}, paidThisMonth = false;
  var currentMonth = goldLoanDateIso(new Date()).slice(0, 7);
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][loanColumn]).trim() !== loanId) continue;
    paidCount++;
    var paymentIso = "";
    for (var d = 0; d < paidDateColumns.length && !paymentIso; d++) {
      var parsedPaymentDate = parseGoldLoanDate(rows[r][paidDateColumns[d]]);
      if (parsedPaymentDate) paymentIso = goldLoanDateIso(parsedPaymentDate);
      else {
        var rawMonth = String(rows[r][paidDateColumns[d]] || "").trim().match(/^(\d{4}-\d{2})/);
        if (rawMonth) paymentIso = rawMonth[1] + "-01";
      }
    }
    if (paymentIso) {
      recordedDates[loanId + "|" + paymentIso] = true;
      if (paymentIso.slice(0, 7) === currentMonth) paidThisMonth = true;
    }
  }
  getLegacyGoldEmiCollectionDates(ss, loanId).forEach(function(collectionDate) {
    var key = loanId + "|" + collectionDate;
    if (!recordedDates[key]) paidCount++;
    recordedDates[key] = true;
    if (collectionDate.slice(0, 7) === currentMonth) paidThisMonth = true;
  });
  if (paidThisMonth) return { status: "error", message: "This month's EMI has already been paid for this loan." };
  if (paidCount >= tenure) return { status: "error", message: "All installments for this loan have already been paid." };

  var installmentNumber = paidCount + 1;
  var dueDate = new Date(firstDue.getTime());
  dueDate.setDate(dueDate.getDate() + paidCount * 30);
  var dueDateIso = goldLoanDateIso(dueDate);
  if (String(data.dueDate || "") !== dueDateIso) return { status: "error", message: "The EMI due date has changed. Refresh the page and try again." };

  var paymentDate = parseGoldLoanDate(data.paymentDate);
  if (!paymentDate) return { status: "error", message: "Select a valid payment date." };
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  if (paymentDate > now) return { status: "error", message: "Payment date cannot be in the future." };
  var fineAmount = Number(data.fineAmount || 0);
  if (!isFinite(fineAmount) || fineAmount < 0) return { status: "error", message: "Fine amount must be zero or more." };
  var paymentDateIso = goldLoanDateIso(paymentDate);
  if (paymentDateIso !== goldLoanDateIso(now)) return { status: "error", message: "EMI payment date must be today." };
  var isLate = paymentDateIso > dueDateIso;
  if (isLate && !(fineAmount > 0)) return { status: "error", message: "A fine amount is required for a missed EMI." };
  if (!isLate) fineAmount = 0;

  var receiptId = "GEMI-" + new Date().getTime();
  var record = {
    "Payment ID": receiptId, "Receipt ID": receiptId, "Loan ID": loanId,
    "Application No": loan["Application No"] || "", "Customer Name": loan["Borrower Name"] || "", "Mobile No": loan["Mobile No"] || "",
    "Installment Month": dueDateIso.slice(0, 7), "Installment Number": installmentNumber,
    "Due Date": dueDateIso, "Paid Date": paymentDateIso, "Payment Date": paymentDateIso,
    "Amount": emiAmount + fineAmount, "EMI Amount": emiAmount, "Fine Amount": fineAmount,
    "Total Paid": emiAmount + fineAmount, "Timestamp": new Date()
  };
  paymentSheet.appendRow(headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ""; }));
  return {
    status: "success", receiptId: receiptId, loanId: loanId,
    applicationNo: loan["Application No"] || "", customerName: loan["Borrower Name"] || "",
    mobileNo: loan["Mobile No"] || "", installmentNumber: installmentNumber,
    dueDate: dueDateIso, paymentDate: paymentDateIso, emiAmount: emiAmount,
    fineAmount: fineAmount, totalPaid: emiAmount + fineAmount,
    nextEmiDate: installmentNumber < tenure ? goldLoanDateIso(new Date(dueDate.getTime() + 30 * 86400000)) : ""
  };
  } finally {
    paymentLock.releaseLock();
  }
}

function recordGoldEmiPayment(ss, goldSheet, data) {
  var loanId = String(data.loanId || "").trim();
  var startDate = String(data.startDate || "").trim();
  var endDate = String(data.endDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    return { status: "error", message: "Select a valid EMI date range." };
  }
  var startValue = new Date(startDate + "T00:00:00"), endValue = new Date(endDate + "T00:00:00");
  if (isNaN(startValue.getTime()) || isNaN(endValue.getTime()) || Utilities.formatDate(startValue, Session.getScriptTimeZone(), "yyyy-MM-dd") !== startDate || Utilities.formatDate(endValue, Session.getScriptTimeZone(), "yyyy-MM-dd") !== endDate) {
    return { status: "error", message: "Select valid calendar dates for EMI payment." };
  }
  var goldValues = goldSheet.getDataRange().getValues();
  var goldHeaders = goldValues[0].map(function(header) { return String(header).trim(); });
  var idCol = goldHeaders.indexOf("ID"), loanRow = null;
  for (var i = 1; i < goldValues.length; i++) {
    if (String(goldValues[i][idCol]).trim() === loanId) { loanRow = goldValues[i]; break; }
  }
  if (!loanRow) return { status: "error", message: "Gold loan was not found." };
  var loan = {};
  goldHeaders.forEach(function(header, index) { loan[header] = loanRow[index]; });
  if (String(loan["Repayment Method"]).toLowerCase() !== "emi") return { status: "error", message: "EMI collection is only available for Monthly EMI loans." };
  var installmentAmount = Number(loan["Installment Amount"] || loan["EMI Amount"] || 0);
  var tenure = Math.max(0, parseInt(loan["Loan Tenure"], 10) || 0);
  if (!(installmentAmount > 0) || !tenure) return { status: "error", message: "The saved EMI amount or loan tenure is missing." };
  var requestedMonths = (endValue.getFullYear() - startValue.getFullYear()) * 12 + endValue.getMonth() - startValue.getMonth() + 1;
  if (requestedMonths < 1 || requestedMonths > tenure) return { status: "error", message: "The date range must include between one month and the loan tenure." };

  var months = [], cursor = new Date(startDate + "T00:00:00"), last = new Date(endDate + "T00:00:00");
  cursor.setDate(1); last.setDate(1);
  while (cursor <= last) {
    months.push(Utilities.formatDate(cursor, Session.getScriptTimeZone(), "yyyy-MM"));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  var paymentSheet = getOrCreateGoldEmiPaymentsSheet(ss);
  var paymentValues = paymentSheet.getDataRange().getValues();
  var paymentHeaders = paymentValues[0].map(function(header) { return String(header).trim(); });
  var loanCol = paymentHeaders.indexOf("Loan ID"), monthCol = paymentHeaders.indexOf("Installment Month");
  var existingMonths = {}, paidCount = 0;
  for (var p = 1; p < paymentValues.length; p++) {
    if (String(paymentValues[p][loanCol]).trim() === loanId) {
      existingMonths[String(paymentValues[p][monthCol]).trim()] = true;
      paidCount++;
    }
  }
  if (months.some(function(month) { return existingMonths[month]; })) return { status: "error", message: "An EMI has already been recorded for at least one month in this date range." };
  if (paidCount + months.length > tenure) return { status: "error", message: "The payment range exceeds the remaining loan installments." };

  var receiptId = "GEMI-" + new Date().getTime(), paidDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  months.forEach(function(month, index) {
    paymentSheet.appendRow([receiptId + "-" + (index + 1), receiptId, loanId, loan["Application No"] || "", loan["Borrower Name"] || "", month, paidDate, installmentAmount, new Date()]);
  });
  return {
    status: "success", receiptId: receiptId, loanId: loanId,
    applicationNo: loan["Application No"] || "", customerName: loan["Borrower Name"] || "",
    mobileNo: loan["Mobile No"] || "", installmentAmount: installmentAmount,
    installmentCount: months.length, totalAmount: installmentAmount * months.length,
    installmentMonths: months, paidDate: paidDate
  };
}

function getOrCreateGoldSheet(ss) {
  var sheet = ss.getSheetByName("Gold_Loans");
  if (!sheet) {
    sheet = ss.insertSheet("Gold_Loans");
    sheet.appendRow([
      "ID", "Timestamp", "Application No", "Application Date", "Branch Name", 
      "Branch Code", "Loan Officer Name", "CSP Location", "Monthly Income", 
      "Nominee Photo URL", "Gold Item Photo URL", "Gold Articles Details", 
      "Loan Amount Requested", "Loan Tenure", "Purpose of Loan", "Scheme", 
      "Rate of Interest (%)", "EMI Amount", "Disbursement Mode", "Bank Name", 
      "A/C Holder Name", "A/C Number", "IFSC Code", "Branch", "Submitted Documents", "Status"
    ]);
    sheet.getRange(1, 1, 1, 26).setFontWeight("bold");
  }
  return sheet;
}

// Keeps existing Gold_Loans data intact and adds any fields introduced by the application form.
function appendGoldLoanRecord(sheet, record) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(header) { return String(header).trim(); });
  var missingHeaders = Object.keys(record).filter(function(header) { return headers.indexOf(header) === -1; });
  if (missingHeaders.length) {
    sheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    sheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setFontWeight("bold");
    headers = headers.concat(missingHeaders);
  }
  sheet.appendRow(headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ""; }));
}

function deleteGoldLoanRecord(sheet, id) {
  var values = sheet.getDataRange().getValues();
  var idColumn = values[0].indexOf("ID");
  for (var row = 1; row < values.length; row++) {
    if (String(values[row][idColumn]).trim() === String(id).trim()) { sheet.deleteRow(row + 1); return true; }
  }
  return false;
}

function updateGoldLoanRecord(sheet, data, folderId) {
  var values = sheet.getDataRange().getValues(), headers = values[0].map(function(header) { return String(header).trim(); });
  var idColumn = headers.indexOf("ID"), rowNumber = -1;
  for (var row = 1; row < values.length; row++) if (String(values[row][idColumn]).trim() === String(data.id).trim()) { rowNumber = row + 1; break; }
  if (rowNumber === -1) return false;
  var fields = { "Branch Name": data.branchName, "Branch Code": data.branchCode, "Loan Officer Name": data.officerName, "CSP Location": data.cspLocation, "Borrower Name": data.borrowerName, "Mobile No": data.mobileNo, "Identity No": data.identityNo, "Address": data.address, "Monthly Income": data.monthlyIncome, "Guardian Type": data.guardianType, "Guardian Name": data.guardianName, "Gender": data.gender, "DOB": data.dob, "Religion": data.religion, "Aadhaar No": data.aadhaarNo, "Occupation": data.occupation, "Customer Bank Name": data.customerBankName, "Customer Bank Branch": data.customerBankBranch, "Customer IFSC Code": data.customerIfscCode, "Customer Account Holder": data.customerAccountHolder, "Customer Account Number": data.customerAccountNumber, "Nominee Name": data.nomineeName, "Nominee Guardian Type": data.nomineeGuardianType, "Nominee Guardian Name": data.nomineeGuardianName, "Nominee Gender": data.nomineeGender, "Nominee Occupation": data.nomineeOccupation, "Nominee DOB": data.nomineeDob, "Nominee Aadhaar": data.nomineeAadhaar, "Relation With Applicant": data.relationWithApplicant, "Gold Articles Details": data.goldArticles, "Valuation Date": data.valuationDate, "Total Gross Weight (g)": data.totalGrossWeight, "Total Net Weight (g)": data.totalNetWeight, "Total Assessed Value": data.assessedValue, "LTV (%)": data.ltvPercent, "Eligible Amount": data.eligibleAmount, "Loan Amount Requested": data.loanAmount, "Processing Charge": data.processingCharge, "Document Charge": data.documentCharge, "Net Disbursement Amount": data.netDisbursementAmount, "Loan Tenure": data.loanTenure, "Loan Tenure Unit": data.loanTenureUnit || "Months", "Rate of Interest (%)": data.interestRate, "Repayment Method": data.repaymentType, "Installment Amount": data.installmentAmount, "Total Interest": data.totalInterest, "Total Payable": data.totalPayable, "First EMI Date": data.firstEmiDate, "EMI Close Date": data.emiCloseDate || data.maturityDate, "Maturity Date": data.maturityDate || data.emiCloseDate, "Purpose of Loan": data.purpose, "Scheme": data.scheme, "Disbursement Mode": data.disbursementMode, "Submitted Documents": data.submittedDocuments };
  fields["Application Date"] = data.appDate || "";
  var currentRow = values[rowNumber - 1];
  var nomineePhotoColumn = headers.indexOf("Nominee Photo URL"), goldPhotoColumn = headers.indexOf("Gold Item Photo URL");
  var nomineePhotoUrl = nomineePhotoColumn >= 0 ? currentRow[nomineePhotoColumn] : "";
  var goldItemPhotoUrl = goldPhotoColumn >= 0 ? currentRow[goldPhotoColumn] : "";
  if (data.nomineeImgBase64 && data.nomineeImgName) nomineePhotoUrl = uploadImageToDrive(data.nomineeImgBase64, data.nomineeImgType, data.nomineeImgName, folderId) || nomineePhotoUrl;
  if (data.goldItemImgBase64 && data.goldItemImgName) goldItemPhotoUrl = uploadImageToDrive(data.goldItemImgBase64, data.goldItemImgType, data.goldItemImgName, folderId) || goldItemPhotoUrl;
  fields["Nominee Photo URL"] = nomineePhotoUrl;
  fields["Gold Item Photo URL"] = goldItemPhotoUrl;
  var newHeaders = ["Application Date", "Processing Charge", "Document Charge", "Net Disbursement Amount", "First EMI Date", "EMI Close Date", "Loan Tenure Unit", "Nominee Photo URL", "Gold Item Photo URL"].filter(function(header) { return headers.indexOf(header) === -1; });
  if (newHeaders.length) {
    sheet.getRange(1, headers.length + 1, 1, newHeaders.length).setValues([newHeaders]);
    sheet.getRange(1, headers.length + 1, 1, newHeaders.length).setFontWeight("bold");
    headers = headers.concat(newHeaders);
  }
  Object.keys(fields).forEach(function(header) { var column = headers.indexOf(header); if (column !== -1) sheet.getRange(rowNumber, column + 1).setValue(fields[header] || ""); });
  return true;
}

// ===== Authentication module =====

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateUsersSheet(ss) {
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["Username", "Password Hash", "Salt", "Recovery Email", "Active", "Updated At"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
    var salt = Utilities.getUuid();
    sheet.appendRow(["admin", hashPassword("admin123", salt), salt, "YOUR_EMAIL@example.com", "Yes", new Date()]);
  }
  return sheet;
}

function hashPassword(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(password), Utilities.Charset.UTF_8);
  return bytes.map(function(byte) { var value = byte < 0 ? byte + 256 : byte; return ("0" + value.toString(16)).slice(-2); }).join("");
}

function findUser(sheet, username) {
  var rows = sheet.getDataRange().getValues();
  var wanted = String(username || "").trim().toLowerCase();
  for (var row = 1; row < rows.length; row++) {
    if (String(rows[row][0]).trim().toLowerCase() === wanted) return { row: row + 1, values: rows[row] };
  }
  return null;
}

function findUserByEmail(sheet, email) {
  var rows = sheet.getDataRange().getValues();
  var wanted = String(email || "").trim().toLowerCase();
  for (var row = 1; row < rows.length; row++) {
    if (String(rows[row][3]).trim().toLowerCase() === wanted) return { row: row + 1, values: rows[row] };
  }
  return null;
}

function passwordIsValid(user, password) {
  return user && String(user.values[4]).toLowerCase() === "yes" && hashPassword(password, user.values[2]) === String(user.values[1]);
}

function updatePassword(sheet, user, password) {
  var salt = Utilities.getUuid();
  sheet.getRange(user.row, 2, 1, 2).setValues([[hashPassword(password, salt), salt]]);
  sheet.getRange(user.row, 6).setValue(new Date());
}

function handleAuthAction(data, ss) {
  var sheet = getOrCreateUsersSheet(ss);
  var action = data.action;
  var username = String(data.username || "").trim();
  var email = String(data.recoveryEmail || "").trim().toLowerCase();

  if (action === "login") {
    var user = findUser(sheet, username);
    if (!passwordIsValid(user, data.password)) return { status: "error", message: "Incorrect username or password." };
    return { status: "success", username: String(user.values[0]), recoveryEmail: String(user.values[3]) };
  }
  if (action === "forgot_username") {
    var emailUser = findUserByEmail(sheet, email);
    if (emailUser && String(emailUser.values[4]).toLowerCase() === "yes") MailApp.sendEmail(email, "Loan Manager username", "Your username is: " + emailUser.values[0]);
    return { status: "success" };
  }

  if (action === "reset_password") {
    var resetTarget = findUser(sheet, username);
    if (!resetTarget || String(resetTarget.values[3]).trim().toLowerCase() !== email) {
      return { status: "error", message: "Username or recovery email is incorrect." };
    }
    if (String(data.newPassword || "").length < 6) {
      return { status: "error", message: "Password must have at least 6 characters." };
    }
    updatePassword(sheet, resetTarget, data.newPassword);
    return { status: "success" };
  }

  if (action === "change_username") {
    var nameUser = findUser(sheet, username);
    var newUsername = String(data.newUsername || "").trim();
    if (!passwordIsValid(nameUser, data.currentPassword)) return { status: "error", message: "Current password is incorrect." };
    if (newUsername.length < 3) return { status: "error", message: "Username must have at least 3 characters." };
    if (findUser(sheet, newUsername)) return { status: "error", message: "This username is already in use." };
    sheet.getRange(nameUser.row, 1).setValue(newUsername); sheet.getRange(nameUser.row, 6).setValue(new Date());
    return { status: "success", username: newUsername };
  }
  if (action === "change_password") {
    var passwordUser = findUser(sheet, username);
    if (!passwordIsValid(passwordUser, data.currentPassword)) return { status: "error", message: "Current password is incorrect." };
    if (String(data.newPassword || "").length < 6) return { status: "error", message: "Password must have at least 6 characters." };
    updatePassword(sheet, passwordUser, data.newPassword);
    return { status: "success" };
  }
  return { status: "error", message: "Unsupported authentication action." };
}
