function doGet(e) {
  // 🟢 CACHE: প্রথমে ক্যাশে ডেটা আছে কিনা চেক করুন
  var cache = CacheService.getScriptCache();
  var cached = cache.get("dashboard_data");
  if (cached != null) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var custSheet = ss.getSheets()[0]; 
  var goldSheet = getOrCreateGoldSheet(ss);
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

  var finalOutput = JSON.stringify({ 
    customers: custResult, 
    collections: collResult,
    closed_collections: closedResult, 
    gold_loans: goldResult
  });

  try {
    cache.put("dashboard_data", finalOutput, 180);
  } catch (cacheErr) {
    // ক্যাশ ফেইল করলেও সমস্যা নেই
  }

  return ContentService.createTextOutput(finalOutput).setMimeType(ContentService.MimeType.JSON);
}

function clearDashboardCache() {
  try {
    CacheService.getScriptCache().remove("dashboard_data");
  } catch (e) {
    // ইগনোর করা নিরাপদ
  }
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
      var targetCustId = String(data.customerId).trim();
      
      var cRows = custSheet.getDataRange().getValues();
      var statusColumn = cRows[0].indexOf("Status") + 1;
      for(var i = 1; i < cRows.length; i++) {
         if(String(cRows[i][0]).trim() === targetCustId) {
            if (statusColumn > 0) custSheet.getRange(i + 1, statusColumn).setValue("Closed");
            break;
         }
      }

      var closedSheet = ss.getSheetByName("Closed_Collections");
      if (!closedSheet) {
        closedSheet = ss.insertSheet("Closed_Collections");
        closedSheet.appendRow(["Collection ID", "Customer ID", "Customer Name", "Loan Type", "Collection Date", "Amount", "Original Timestamp", "Archive Date"]);
        closedSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
      }

      var movedCount = 0;
      var allSheets = ss.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        var name = allSheets[s].getName();
        if (name === "Collections" || name.indexOf("Collections_") === 0) {
          var tSheet = allSheets[s];
          var tData = tSheet.getDataRange().getValues();
          if (tData.length < 2) continue;
          var collectionHeaders = tData[0].map(function(header) { return String(header).trim(); });
          var customerIdColumn = collectionHeaders.indexOf("Customer ID");
          if (customerIdColumn === -1) continue;
          for (var r = tData.length - 1; r >= 1; r--) {
            if (String(tData[r][customerIdColumn]).trim() === targetCustId) {
              var archivedRow = [
                tData[r][collectionHeaders.indexOf("Collection ID")] || "",
                tData[r][customerIdColumn] || "",
                tData[r][collectionHeaders.indexOf("Customer Name")] || "",
                tData[r][collectionHeaders.indexOf("Loan Type")] || "",
                tData[r][collectionHeaders.indexOf("Collection Date")] || "",
                tData[r][collectionHeaders.indexOf("Amount")] || "",
                tData[r][collectionHeaders.indexOf("Timestamp")] || "",
                new Date()
              ];
              closedSheet.appendRow(archivedRow);
              tSheet.deleteRow(r + 1);
              movedCount++;
            }
          }
        }
      }
      clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", archivedCollections: movedCount })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "reopen_loan") {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Customers");
      var dataRange = sheet.getDataRange();
      var values = dataRange.getValues();
      var idIndex = values[0].indexOf("ID");
      var statusIndex = values[0].indexOf("Status");
      
      for (var i = 1; i < values.length; i++) {
        if (values[i][idIndex] == data.customerId) {
          sheet.getRange(i + 1, statusIndex + 1).setValue("Active");
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

    else if (data.action === "update_gold_loan") {
      var updatedGoldLoan = updateGoldLoanRecord(goldSheet, data);
      if (updatedGoldLoan) clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: updatedGoldLoan ? "success" : "error", message: updatedGoldLoan ? "" : "Gold loan not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (data.action === "create_gold_loan") {
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
        "Loan Tenure": data.loanTenure || "", "Purpose of Loan": data.purpose || "", "Scheme": data.scheme || "",
        "Rate of Interest (%)": data.interestRate || "", "Repayment Method": data.repaymentType || "",
        "Installment Amount": data.installmentAmount || "", "Total Interest": data.totalInterest || "",
        "Total Payable": data.totalPayable || "", "Maturity Date": data.maturityDate || "", "Disbursement Mode": data.disbursementMode || "",
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
    if (data.action === "create") {
      var id = "CUST-" + new Date().getTime();
      var timestamp = new Date(); 
      ensureCustomerBankColumns(custSheet);
      
      var newRowData = [
        id, timestamp, data.customerName, data.guardianType, data.guardianName, data.gender, data.dob, 
        data.religion || "", data.aadhaarNo, data.mobileNo, data.address || "", data.occupation, photoUrl, 
        data.loanType || "", data.groupName || "", data.loanAmount || "", data.startDate || "", 
        data.durationDays || "", data.interestRate || "", data.nomineeName, data.nomineeGuardianType, 
        data.nomineeGuardianName, data.nomineeGender, data.nomineeOccupation, data.nomineeDob, 
        data.nomineeAadhaar, data.relationWithApplicant, "Active",
        data.bankName || "", data.bankBranch || "", data.ifscCode || "",
        data.accountHolderName || "", data.accountNumber || ""
      ];

      custSheet.appendRow(newRowData);
      clearDashboardCache();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", id: id, photoUrl: photoUrl })).setMimeType(ContentService.MimeType.JSON);
    } 
    
    // 🟢 UPDATE CUSTOMER (Fixed: use data.id instead of the never-sent data.customerId,
    //     and always return a message so the frontend alert is meaningful)
    else if (data.action === "update") {
      var rows = custSheet.getDataRange().getValues();
      var updated = false;
      var timestamp = new Date(); 
      var targetId = String(data.id).trim();
      var bankColumns = ensureCustomerBankColumns(custSheet);

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === targetId) {
          var currentStatus = rows[i][27] || "Active"; // ২৮ নাম্বার কলাম (ইনডেক্স ২৭) হলো স্ট্যাটাস
          
          var updateRowData = [
            data.id, timestamp, data.customerName, data.guardianType, data.guardianName, data.gender, data.dob, 
            data.religion || "", data.aadhaarNo, data.mobileNo, data.address || "", data.occupation, photoUrl, 
            data.loanType || "", data.groupName || "", data.loanAmount || "", data.startDate || "", 
            data.durationDays || "", data.interestRate || "", data.nomineeName, data.nomineeGuardianType, 
            data.nomineeGuardianName, data.nomineeGender, data.nomineeOccupation, data.nomineeDob, data.nomineeAadhaar, 
            data.relationWithApplicant, currentStatus
          ]; // ঠিক ২৮টি ডেটা

          // 28টি কলাম আপডেট করা হচ্ছে
          custSheet.getRange(i + 1, 1, 1, 28).setValues([updateRowData]);
          custSheet.getRange(i + 1, bankColumns["Bank Name"]).setValue(data.bankName || "");
          custSheet.getRange(i + 1, bankColumns["Bank Branch"]).setValue(data.bankBranch || "");
          custSheet.getRange(i + 1, bankColumns["IFSC Code"]).setValue(data.ifscCode || "");
          custSheet.getRange(i + 1, bankColumns["Account Holder Name"]).setValue(data.accountHolderName || "");
          custSheet.getRange(i + 1, bankColumns["Account Number"]).setValue(data.accountNumber || "");
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
    else if (data.action === "delete") {
      var rows = custSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(data.id).trim()) {
          custSheet.deleteRow(i + 1);
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

function updateGoldLoanRecord(sheet, data) {
  var values = sheet.getDataRange().getValues(), headers = values[0].map(function(header) { return String(header).trim(); });
  var idColumn = headers.indexOf("ID"), rowNumber = -1;
  for (var row = 1; row < values.length; row++) if (String(values[row][idColumn]).trim() === String(data.id).trim()) { rowNumber = row + 1; break; }
  if (rowNumber === -1) return false;
  var fields = { "Borrower Name": data.borrowerName, "Mobile No": data.mobileNo, "Identity No": data.identityNo, "Address": data.address, "Monthly Income": data.monthlyIncome, "Guardian Type": data.guardianType, "Guardian Name": data.guardianName, "Gender": data.gender, "DOB": data.dob, "Religion": data.religion, "Aadhaar No": data.aadhaarNo, "Occupation": data.occupation, "Customer Bank Name": data.customerBankName, "Customer Bank Branch": data.customerBankBranch, "Customer IFSC Code": data.customerIfscCode, "Customer Account Holder": data.customerAccountHolder, "Customer Account Number": data.customerAccountNumber, "Nominee Name": data.nomineeName, "Nominee Guardian Type": data.nomineeGuardianType, "Nominee Guardian Name": data.nomineeGuardianName, "Nominee Gender": data.nomineeGender, "Nominee Occupation": data.nomineeOccupation, "Nominee DOB": data.nomineeDob, "Nominee Aadhaar": data.nomineeAadhaar, "Relation With Applicant": data.relationWithApplicant, "Gold Articles Details": data.goldArticles, "Valuation Date": data.valuationDate, "Total Gross Weight (g)": data.totalGrossWeight, "Total Net Weight (g)": data.totalNetWeight, "Total Assessed Value": data.assessedValue, "LTV (%)": data.ltvPercent, "Eligible Amount": data.eligibleAmount, "Loan Amount Requested": data.loanAmount, "Loan Tenure": data.loanTenure, "Rate of Interest (%)": data.interestRate, "Repayment Method": data.repaymentType, "Installment Amount": data.installmentAmount, "Total Interest": data.totalInterest, "Total Payable": data.totalPayable, "Maturity Date": data.maturityDate, "Purpose of Loan": data.purpose, "Scheme": data.scheme, "Disbursement Mode": data.disbursementMode, "Submitted Documents": data.submittedDocuments };
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
