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
