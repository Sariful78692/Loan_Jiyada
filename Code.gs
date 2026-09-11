function doGet(e) {
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

  return ContentService.createTextOutput(JSON.stringify({ 
    customers: custResult, 
    collections: collResult,
    closed_collections: closedResult, 
    gold_loans: goldResult
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Authentication actions: Users sheet, login, recovery and credential changes
    if (["login", "forgot_username", "request_password_reset", "reset_password", "change_username", "change_password"].indexOf(data.action) !== -1) {
      return jsonResponse(handleAuthAction(data, ss));
    }
    var custSheet = ss.getSheets()[0];
    var goldSheet = getOrCreateGoldSheet(ss);
    
    var folderId = "1tYYWYu7dyg4NCVD_mePsmvyX0fOdYDKa";

    // ১. RD Loan Collection Add Logic 
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

      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৪. Collection Update Logic
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
      return ContentService.createTextOutput(JSON.stringify({ status: updated ? "success" : "error" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫. Collection Delete Logic
    else if (data.action === "delete_collection") {
      var deleted = false;
      var sheets = ss.getSheets();
      for (var s = 0; s < sheets.length; s++) {
        var shName = sheets[s].getName();
        // 🟢 'Closed_Collections' শিটটিকেও ডিলিট করার পারমিশন দেওয়া হলো
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
      return ContentService.createTextOutput(JSON.stringify({ status: deleted ? "success" : "error" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৬. Archive / Close Loan Logic
    else if (data.action === "close_loan") {
      var targetCustId = String(data.customerId).trim();
      
      var cRows = custSheet.getDataRange().getValues();
      for(var i = 1; i < cRows.length; i++) {
         if(String(cRows[i][0]).trim() === targetCustId) {
            custSheet.getRange(i + 1, 29).setValue("Closed"); // Col 29 (AC) = Status
            break;
         }
      }

      var closedSheet = ss.getSheetByName("Closed_Collections");
      if (!closedSheet) {
        closedSheet = ss.insertSheet("Closed_Collections");
        closedSheet.appendRow(["Collection ID", "Customer ID", "Customer Name", "Loan Type", "Collection Date", "Amount", "Original Timestamp", "Archive Date"]);
        closedSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
      }

      var allSheets = ss.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        var name = allSheets[s].getName();
        if (name === "Collections" || name.indexOf("Collections_") === 0) {
          var tSheet = allSheets[s];
          var tData = tSheet.getDataRange().getValues();
          for (var r = tData.length - 1; r >= 1; r--) {
            if (String(tData[r][1]).trim() === targetCustId) {
              var rowData = tData[r].slice();
              rowData.push(new Date()); 
              closedSheet.appendRow(rowData);
              tSheet.deleteRow(r + 1);
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 🟢 7. Re-open Loan Logic (সঠিকভাবে আলাদা করা হলো)
    else if (data.action === "reopen_loan") {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Customers");
      var dataRange = sheet.getDataRange();
      var values = dataRange.getValues();
      var idIndex = values[0].indexOf("ID");
      var statusIndex = values[0].indexOf("Status");
      
      for (var i = 1; i < values.length; i++) {
        if (values[i][idIndex] == data.customerId) {
          sheet.getRange(i + 1, statusIndex + 1).setValue("Active");
          return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Loan reopened"})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Customer not found"})).setMimeType(ContentService.MimeType.JSON);
    }

    // ২. Gold Loan Create Logic
    else if (data.action === "create_gold_loan") {
      var goldId = "GL-" + new Date().getTime();
      var timestamp = new Date();
      
      var nomineePhotoUrl = uploadImageToDrive(data.nomineeImgBase64, data.nomineeImgType, data.nomineeImgName, folderId);
      var goldItemPhotoUrl = uploadImageToDrive(data.goldItemImgBase64, data.goldItemImgType, data.goldItemImgName, folderId);
      
      goldSheet.appendRow([
        goldId, timestamp, data.appNo || "", data.appDate || "", data.branchName || "", 
        data.branchCode || "", data.officerName || "", data.cspLocation || "", data.monthlyIncome || "", 
        nomineePhotoUrl, goldItemPhotoUrl, data.goldArticles || "", data.loanAmount || "", 
        data.loanTenure || "", data.purpose || "", data.scheme || "", data.interestRate || "", 
        data.emiAmount || "", data.disbursementMode || "", data.bankName || "", data.acHolderName || "", 
        data.acNumber || "", data.ifscCode || "", data.bankBranch || "", data.submittedDocuments || "", "Active"
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", id: goldId })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৩. Regular Customer Create & Update Logic
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

    if (data.action === "create") {
      var id = "CUST-" + new Date().getTime();
      var timestamp = new Date(); 
      
      custSheet.appendRow([
        id, timestamp, data.customerName, data.guardianType, data.guardianName, data.gender, data.dob, 
        data.religion, data.aadhaarNo, data.mobileNo, data.address || "", data.occupation, photoUrl, 
        data.loanType || "", data.groupName || "", data.loanAmount || "", data.startDate || "", 
        data.durationDays || "", data.interestRate || "", data.nomineeName, data.nomineeGuardianType, 
        data.nomineeGuardianName, data.nomineeGender, data.nomineeOccupation, data.nomineeDob, 
        data.nomineeDob, data.nomineeAadhaar, data.relationWithApplicant, "Active"
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", id: id, photoUrl: photoUrl })).setMimeType(ContentService.MimeType.JSON);
    } 
    else if (data.action === "update") {
      var rows = custSheet.getDataRange().getValues();
      var updated = false;
      var timestamp = new Date(); 

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(data.id).trim()) {
          var currentStatus = rows[i][28] || "Active"; 
          
          custSheet.getRange(i + 1, 1, 1, 29).setValues([[
            data.id, timestamp, data.customerName, data.guardianType, data.guardianName, data.gender, data.dob, 
            data.religion, data.aadhaarNo, data.mobileNo, data.address || "", data.occupation, photoUrl, 
            data.loanType || "", data.groupName || "", data.loanAmount || "", data.startDate || "", 
            data.durationDays || "", data.interestRate || "", data.nomineeName, data.nomineeGuardianType, 
            data.nomineeGuardianName, data.nomineeGender, data.nomineeOccupation, data.nomineeDob, data.nomineeAadhaar, 
            data.relationWithApplicant, currentStatus
          ]]);
          updated = true; break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: updated ? "success" : "error", photoUrl: photoUrl })).setMimeType(ContentService.MimeType.JSON);
    }
    else if (data.action === "disable") {
      var rows = custSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(data.id).trim()) {
          custSheet.getRange(i + 1, 29).setValue("Disabled");
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    else if (data.action === "delete") {
      var rows = custSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(data.id).trim()) {
          custSheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
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

// ===== Authentication module =====
/*
 * Add this file to the SAME Google Apps Script project as your existing Code.gs.
 * Then add the dispatcher shown below near the top of doPost(), after `var ss = ...`.
 */

/* Add inside doPost(e), after: var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (["login", "forgot_username", "request_password_reset", "reset_password", "change_username", "change_password"].indexOf(data.action) !== -1) {
      return jsonResponse(handleAuthAction(data, ss));
    }
*/

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
  if (action === "request_password_reset") {
    var resetUser = findUser(sheet, username);
    if (!resetUser || String(resetUser.values[3]).trim().toLowerCase() !== email || String(resetUser.values[4]).toLowerCase() !== "yes") return { status: "error", message: "Username or recovery email is incorrect." };
    var code = ("000000" + Math.floor(Math.random() * 1000000)).slice(-6);
    PropertiesService.getScriptProperties().setProperty("reset_" + String(resetUser.values[0]).toLowerCase(), JSON.stringify({ code: code, expires: Date.now() + 15 * 60 * 1000 }));
    MailApp.sendEmail(email, "Loan Manager password reset", "Your verification code is " + code + ". It expires in 15 minutes.");
    return { status: "success" };
  }
  if (action === "reset_password") {
    var resetTarget = findUser(sheet, username);
    if (!resetTarget || String(resetTarget.values[3]).trim().toLowerCase() !== email) return { status: "error", message: "Unable to reset password." };
    var stored = PropertiesService.getScriptProperties().getProperty("reset_" + String(resetTarget.values[0]).toLowerCase());
    var token = stored ? JSON.parse(stored) : null;
    if (!token || token.expires < Date.now() || String(token.code) !== String(data.code)) return { status: "error", message: "Verification code is invalid or expired." };
    if (String(data.newPassword || "").length < 6) return { status: "error", message: "Password must have at least 6 characters." };
    updatePassword(sheet, resetTarget, data.newPassword);
    PropertiesService.getScriptProperties().deleteProperty("reset_" + String(resetTarget.values[0]).toLowerCase());
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
