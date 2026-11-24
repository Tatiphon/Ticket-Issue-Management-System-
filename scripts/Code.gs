/**
 * IT Asset & Helpdesk Service System - Google Apps Script (TCC Full Self-Healing Edition)
 * พัฒนาสำหรับ: ฝ่ายเทคโนโลยีสารสนเทศ หอการค้าไทย
 * รองรับ: Items (พร้อมรูปตัวอย่างบน Google Drive), Logs, Categories, Departments, UserRoles, Tickets, KnowledgeBase และระบบแจ้งเตือนทางอีเมล (MailApp)
 * ระบบ Self-Healing: สร้างแท็บตารางที่ขาดหายให้อัตโนมัติ พร้อมตั้งค่าหัวตารางให้อัตโนมัติ
 */
/**
 * รันฟังก์ชันนี้ 1 ครั้งใน Apps Script Editor (กด Run) เพื่อกดอนุญาตสิทธิ์เข้าถึง Google Sheets, Google Drive และการส่งอีเมล (MailApp)
 */
function authorizeMailAndDrivePermissions() {
  var quota = MailApp.getRemainingDailyQuota();
  var root = DriveApp.getRootFolder().getName();
  var ssName = SpreadsheetApp.getActiveSpreadsheet().getName();
  Logger.log("Authorized! Sheet=" + ssName + ", DriveRoot=" + root + ", EmailQuota=" + quota);
  return { ok: true, sheet: ssName, remainingQuota: quota };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return jsonResponse({ status: "error", message: "ระบบกำลังทำงานอื่นอยู่ กรุณาลองใหม่อีกครั้ง (Lock timeout)" });
  }
  try {
    var data = JSON.parse(e.postData ? e.postData.contents : "{}");
    var action = data.action;
    switch (action) {
      case "getInitialData": return handleGetInitialData();
      case "borrowItem": return handleBorrowItem(data);
      case "returnItem": return handleReturnItem(data);
      case "updateHistoryLog": return handleUpdateHistoryLog(data);
      case "addItem": return handleAddItem(data);
      case "updateItem": return handleUpdateItem(data);
      case "addDepartment": return handleAddDepartment(data);
      case "updateDepartment": return handleUpdateDepartment(data);
      case "deleteDepartment": return handleDeleteDepartment(data);
      case "addTicketCategory": return handleAddTicketCategory(data);
      case "updateTicketCategory": return handleUpdateTicketCategory(data);
      case "deleteTicketCategory": return handleDeleteTicketCategory(data);
      case "saveTicketCategoriesOrder": return handleSaveTicketCategoriesOrder(data);
      case "addInternalSystem": return handleAddInternalSystem(data);
      case "updateInternalSystem": return handleUpdateInternalSystem(data);
      case "deleteInternalSystem": return handleDeleteInternalSystem(data);
      case "saveInternalSystemsOrder": return handleSaveInternalSystemsOrder(data);
      case "saveUserRole": return handleSaveUserRole(data);
      case "saveUserRolesBatch": return handleSaveUserRolesBatch(data);
      case "deleteUserRole": return handleDeleteUserRole(data);
      case "createTicket": return handleCreateTicket(data);
      case "updateTicket": return handleUpdateTicket(data);
      case "saveKbArticle": return handleSaveKbArticle(data);
      case "deleteKbArticle": return handleDeleteKbArticle(data);
      case "uploadFileToDrive": return handleUploadFileToDrive(data);
      case "sendEmailNotification": return handleSendEmailNotification(data);
      case "saveEmailSettings": return handleSaveEmailSettings(data);
      case "checkEmailSetup": return handleCheckEmailSetup();
      default: return jsonResponse({ status: "error", message: "Invalid action: " + action });
    }
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) { return handleGetInitialData(); }

function getSpreadsheet() { return SpreadsheetApp.getActiveSpreadsheet(); }

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function formatGASDate(val, pattern) {
  if (!val) return "";
  try {
    var d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return Utilities.formatDate(d, "GMT+7", pattern);
  } catch(e) { return String(val); }
}

function getOrCreateSheet(ss, sheetName, headers, defaultRows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#005ba6").setFontColor("#ffffff");
    if (defaultRows && defaultRows.length > 0) {
      defaultRows.forEach(function(row) { sheet.appendRow(row); });
    }
  }
  return sheet;
}

// ฟังก์ชันค้นหาอีเมลจากตาราง UserRoles อัตโนมัติ (จากอีเมล หรือ ชื่อ-นามสกุล)
function resolveEmailFromUserRolesGAS(ss, contactOrName, fallbackName) {
  var raw = String(contactOrName || "").trim();
  var emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) return emailMatch[0].toLowerCase();
  var sheet = ss.getSheetByName("UserRoles");
  if (!sheet) return "";
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "";
  var colMap = getUserRolesColumnMap(data[0]);
  var q1 = raw.toLowerCase();
  var q2 = String(fallbackName || "").trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var em = String(data[i][colMap.email] || "").trim().toLowerCase();
    var fn = colMap.first_name !== -1 ? String(data[i][colMap.first_name] || "").trim() : "";
    var ln = colMap.last_name !== -1 ? String(data[i][colMap.last_name] || "").trim() : "";
    var full = [fn, ln].filter(Boolean).join(" ").toLowerCase();
    if ((q1 && (em === q1 || full === q1 || (fn && fn.toLowerCase() === q1))) ||
        (q2 && (em === q2 || full === q2 || (fn && fn.toLowerCase() === q2)))) {
      return em;
    }
  }
  return "";
}

function isBlockedGasEmail(email) {
  var clean = String(email || "").trim().toLowerCase();
  return !clean || clean === "tatitop07@gmail.com";
}

function getAdminEmailsGAS(ss) {
  var sheet = ss.getSheetByName("UserRoles");
  if (!sheet) return ["itsupport@thaichamber.or.th", "tatiphon.hi@thaichamber.or.th"];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return ["itsupport@thaichamber.or.th", "tatiphon.hi@thaichamber.or.th"];
  var colMap = getUserRolesColumnMap(data[0]);
  var admins = [];
  for (var i = 1; i < data.length; i++) {
    var em = String(data[i][colMap.email] || "").trim().toLowerCase();
    var rl = colMap.role !== -1 ? String(data[i][colMap.role] || "").trim().toLowerCase() : "";
    var st = colMap.status !== -1 ? String(data[i][colMap.status] || "active").trim().toLowerCase() : "active";
    if (em && em.indexOf("@") !== -1 && !isBlockedGasEmail(em) && (rl === "admin" || rl === "superadmin") && st !== "disabled") {
      if (admins.indexOf(em) === -1) admins.push(em);
    }
  }
  return admins;
}

function sendNotificationEmailGAS(toList, subject, bodyText, senderName, replyTo, senderAlias, relayUrl) {
  var ownerEmail = "";
  try {
    ownerEmail = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase();
  } catch (_) {}

  var targetSender = String(senderAlias || "itsupport@thaichamber.or.th").trim().toLowerCase();
  if (isBlockedGasEmail(targetSender) || targetSender.indexOf("@") === -1) {
    targetSender = "itsupport@thaichamber.or.th";
  }
  var cleanReply = String(replyTo || targetSender).trim().toLowerCase();
  if (isBlockedGasEmail(cleanReply) || cleanReply.indexOf("@") === -1) {
    cleanReply = targetSender;
  }

  try {
    var valid = [];
    var fixDomainTypo = function(em) {
      return String(em || "").trim().toLowerCase()
        .replace(/@thaichamber\.ro\.th$/i, "@thaichamber.or.th")
        .replace(/@thaichamber\.ot\.th$/i, "@thaichamber.or.th")
        .replace(/@thaichamber\.or\.ht$/i, "@thaichamber.or.th");
    };
    if (Array.isArray(toList)) {
      toList.forEach(function(e) {
        var clean = fixDomainTypo(e);
        if (clean && clean.indexOf("@") !== -1 && !isBlockedGasEmail(clean) && valid.indexOf(clean) === -1) valid.push(clean);
      });
    } else if (typeof toList === "string") {
      toList.split(",").forEach(function(e) {
        var clean = fixDomainTypo(e);
        if (clean && clean.indexOf("@") !== -1 && !isBlockedGasEmail(clean) && valid.indexOf(clean) === -1) valid.push(clean);
      });
    }
    if (valid.length === 0) {
      return { ok: false, error: "ไม่พบอีเมลปลายทางที่ถูกต้อง (ระบบบล็อกการส่งหา tatitop07@gmail.com)", senderEmail: targetSender };
    }
    var dispName = senderName || "TCC IT Service & Asset System";
    var htmlBody = '<div style="font-family: Sarabun, sans-serif; width: 100%; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-sizing: border-box;">' +
      '<div style="background: linear-gradient(135deg, #003d73, #0284c7); color: #ffffff; padding: 16px 20px; word-break: break-word;">' +
      '<h2 style="margin: 0; font-size: 16px; line-height: 1.4;">หอการค้าไทย (TCC IT Asset & Helpdesk Service)</h2>' +
      '<p style="margin: 4px 0 0; font-size: 12px; line-height: 1.4; opacity: 0.9;">ระบบแจ้งเตือนอัตโนมัติ ฝ่ายเทคโนโลยีสารสนเทศ</p>' +
      '</div>' +
      '<div style="padding: 18px 20px; background: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.65; white-space: pre-line; word-break: break-word;">' +
      String(bodyText || "").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
      '</div>' +
      '<div style="padding: 12px 20px; background: #f8fafc; color: #64748b; font-size: 11px; line-height: 1.5; border-top: 1px solid #e2e8f0; word-break: break-word;">' +
      'อีเมลฉบับนี้ส่งอัตโนมัติจากระบบบริหารจัดการอุปกรณ์และแจ้งซ่อมไอที หอการค้าไทย (' + targetSender + ')' +
      '</div></div>';

    var matchedAlias = "";
    try {
      var aliases = GmailApp.getAliases() || [];
      for (var i = 0; i < aliases.length; i++) {
        if (String(aliases[i]).trim().toLowerCase() === targetSender) {
          matchedAlias = aliases[i];
          break;
        }
      }
    } catch (_) {}

    if (matchedAlias) {
      var gOpts = { htmlBody: htmlBody, name: dispName, from: matchedAlias, replyTo: cleanReply };
      GmailApp.sendEmail(valid.join(","), subject, bodyText || " ", gOpts);
      var qAlias = null;
      try { qAlias = MailApp.getRemainingDailyQuota(); } catch (_) {}
      return { ok: true, senderEmail: matchedAlias, remainingQuota: qAlias, method: "GmailApp Alias", sentTo: valid };
    }

    if (ownerEmail === targetSender && !isBlockedGasEmail(ownerEmail)) {
      var mailOpts = {
        to: valid.join(","),
        subject: subject,
        body: bodyText || " ",
        htmlBody: htmlBody,
        name: dispName,
        replyTo: cleanReply
      };
      MailApp.sendEmail(mailOpts);
      var qOwner = null;
      try { qOwner = MailApp.getRemainingDailyQuota(); } catch (_) {}
      return { ok: true, senderEmail: ownerEmail, remainingQuota: qOwner, method: "MailApp Owner", sentTo: valid };
    }

    // Fallback to Server-Side SMTP Relay if configured in ScriptProperties
    var relayFailMsg = "";
    try {
      var props = PropertiesService.getScriptProperties();
      var savedPass = props.getProperty("TCC_SMTP_PASS") || "";
      var savedHost = props.getProperty("TCC_SMTP_HOST") || "auto";
      var savedRelay = relayUrl || props.getProperty("TCC_RELAY_URL") || "";
      if (savedPass && savedRelay && savedRelay.indexOf("http") === 0) {
        var fetchRes = UrlFetchApp.fetch(savedRelay, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({
            to: valid,
            subject: subject,
            body: bodyText || " ",
            senderName: dispName,
            senderEmail: targetSender,
            replyTo: cleanReply,
            smtpHost: savedHost,
            smtpUser: targetSender,
            smtpPass: savedPass
          }),
          muteHttpExceptions: true
        });
        var relayJson = JSON.parse(fetchRes.getContentText() || "{}");
        if (relayJson && relayJson.status === "success" && relayJson.sent) {
          return { ok: true, senderEmail: targetSender, remainingQuota: null, method: "SMTP Relay", sentTo: valid };
        }
        relayFailMsg = (relayJson && (relayJson.error || relayJson.message)) || ("Relay HTTP " + fetchRes.getResponseCode());
      } else {
        relayFailMsg = !savedPass ? "ยังไม่ได้บันทึก SMTP App Password ใน Apps Script (Admin ต้องกดบันทึกการตั้งค่าอีเมลใหม่)" : "ไม่พบ Relay URL";
      }
    } catch (relayErr) {
      Logger.log("Relay error: " + relayErr);
    }

    return {
      ok: false,
      blockedSender: ownerEmail || "tatitop07@gmail.com",
      senderEmail: targetSender,
      error: (relayFailMsg ? relayFailMsg + " | " : "") + "ระบบระงับการส่งจาก " + (ownerEmail || "tatitop07@gmail.com") + " (ต้องส่งจาก " + targetSender + " เท่านั้น กรุณาตั้งค่า Send mail as หรือใช้โหมด SMTP)"
    };
  } catch (err) {
    Logger.log("Email error: " + err);
    return { ok: false, error: err.toString(), senderEmail: targetSender };
  }
}

function handleSendEmailNotification(data) {
  var bodyText = data.body || data.summary || "";
  var res = sendNotificationEmailGAS(
    data.to || data.recipients || [],
    data.subject || "[TCC IT Notification]",
    bodyText,
    data.senderName || "TCC IT Service & Asset System",
    data.replyTo || "itsupport@thaichamber.or.th",
    data.senderAlias || data.senderEmail || "itsupport@thaichamber.or.th",
    data.relayUrl || ""
  );
  return jsonResponse({
    status: res.ok ? "success" : "error",
    sent: !!res.ok,
    blockedSender: res.blockedSender || "",
    message: res.ok ? "ส่งอีเมลสำเร็จ" : (res.error || "Unknown error"),
    error: res.error || "",
    senderEmail: res.senderEmail || "itsupport@thaichamber.or.th",
    remainingQuota: res.remainingQuota !== undefined ? res.remainingQuota : null
  });
}

function handleCheckEmailSetup() {
  try {
    var senderEmail = "";
    try { senderEmail = Session.getEffectiveUser().getEmail() || ""; } catch (_) {}
    var quota = MailApp.getRemainingDailyQuota();
    var aliases = [];
    try { aliases = GmailApp.getAliases() || []; } catch (_) {}
    var smtpRelayReady = false;
    try {
      smtpRelayReady = Boolean(PropertiesService.getScriptProperties().getProperty("TCC_SMTP_PASS"));
    } catch (_) {}
    return jsonResponse({
      status: "success",
      version: "2026-11-email-v3-itsupport",
      mailAuthorized: true,
      senderEmail: senderEmail,
      requiredSender: "itsupport@thaichamber.or.th",
      smtpRelayReady: smtpRelayReady,
      remainingQuota: quota,
      aliases: aliases
    });
  } catch (err) {
    return jsonResponse({
      status: "error",
      mailAuthorized: false,
      error: err.toString(),
      message: err.toString()
    });
  }
}

function handleSaveEmailSettings(data) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, "EmailSettings", ["Setting Key", "JSON Value", "Updated At"], []);
  var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
  try {
    var props = PropertiesService.getScriptProperties();
    if (data.smtpPass && String(data.smtpPass).trim()) {
      props.setProperty("TCC_SMTP_PASS", String(data.smtpPass).trim());
    }
    if (data.smtpHost) {
      props.setProperty("TCC_SMTP_HOST", String(data.smtpHost).trim());
    }
    if (data.relayUrl) {
      props.setProperty("TCC_RELAY_URL", String(data.relayUrl).trim());
    }
  } catch (_) {}

  var updates = {};
  if (data.emailNotifyEnabled !== undefined) updates["emailNotifyEnabled"] = JSON.stringify(!!data.emailNotifyEnabled);
  if (data.emailConfig !== undefined) {
    var cleanCfg = JSON.parse(JSON.stringify(data.emailConfig));
    var passToSave = String(data.smtpPass || cleanCfg.smtpPass || "").replace(/s+/g, "").trim();
    if (passToSave) {
      cleanCfg.smtpPass = passToSave;
    }
    cleanCfg.senderEmail = "itsupport@thaichamber.or.th";
    if (!cleanCfg.senderAlias || cleanCfg.senderAlias === "tatitop07@gmail.com") cleanCfg.senderAlias = "itsupport@thaichamber.or.th";
    if (!cleanCfg.replyTo || cleanCfg.replyTo === "tatitop07@gmail.com") cleanCfg.replyTo = "itsupport@thaichamber.or.th";
    if (cleanCfg._notifyPrefsExplicit !== true) {
      cleanCfg.notifyRequester = true;
      cleanCfg.notifyAssignedAgent = true;
      cleanCfg.notifyAdminRoles = true;
    }
    updates["emailConfig"] = JSON.stringify(cleanCfg);
  }
  if (data.emailTemplates !== undefined) updates["emailTemplates"] = JSON.stringify(data.emailTemplates);

  var values = sheet.getDataRange().getValues();
  var rowMap = {};
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || "").trim();
    if (key) rowMap[key] = i + 1;
  }
  Object.keys(updates).forEach(function(key) {
    if (rowMap[key]) {
      sheet.getRange(rowMap[key], 2, 1, 2).setValues([[updates[key], nowStr]]);
    } else {
      sheet.appendRow([key, updates[key], nowStr]);
    }
  });
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "บันทึกการตั้งค่าอีเมลลง Google Sheets เรียบร้อยแล้ว" });
}

function handleGetInitialData() {
  var ss = getSpreadsheet();
  
  var itemSheet = getOrCreateSheet(ss, "Items", ["Item ID", "Item Name", "Category", "Serial Number", "Status", "Image Name", "Image URL", "Drive File ID"], [
    ["IT-001", "Dell Latitude 5430 (i7/16GB)", "Laptop", "DL-5430-891", "Available", "", "", ""],
    ["IT-002", "MacBook Air M2 (16GB/512GB)", "Laptop", "MBA-M2-044", "Borrowed", "", "", ""],
    ["IT-003", "Epson EB-X06 Projector 3600lm", "Projector", "EP-X06-203", "Available", "", "", ""],
    ["IT-004", "Dell UltraSharp 27-inch 4K", "Monitor", "DELL-U27-91", "Available", "", "", ""],
    ["IT-005", "Rode Wireless GO II Dual Mic", "Audio", "RODE-WGO-88", "Borrowed", "", "", ""],
    ["IT-006", "USB-C Multiport Hub 8-in-1", "Adapter", "HUB-8IN1-12", "Available", "", "", ""]
  ]);
  if (itemSheet.getLastColumn() < 8) {
    itemSheet.getRange(1, 6, 1, 3).setValues([["Image Name", "Image URL", "Drive File ID"]]).setFontWeight("bold").setBackground("#005ba6").setFontColor("#ffffff");
  }

  getOrCreateSheet(ss, "Logs", ["Trans ID", "Timestamp", "Item ID", "Borrower Name", "Department", "Contact", "Borrow Date", "Expected Return", "Actual Return", "Status", "Notes"], [
    ["ITB-2026-10-23-0001", "2026-10-23 09:30", "IT-002", "กิตติศักดิ์ พัฒนพงศ์", "ฝ่ายประชาสัมพันธ์และสื่อสารองค์กร", "kittisak@thaichamber.or.th", "2026-10-23", "2026-10-27", "", "Borrowed", "นำเสนอแผนงานประจำปี"],
    ["ITB-2026-10-28-0002", "2026-10-28 14:15", "IT-005", "สุวิมล แสงทอง", "ฝ่ายสมาชิกสัมพันธ์และการบริการ", "suwimon@thaichamber.or.th", "2026-10-28", "2026-11-03", "", "Borrowed", "บันทึกเสียงสัมมนาผู้ประกอบการ"],
    ["ITB-2026-10-15-0003", "2026-10-15 10:00", "IT-001", "วิชัย สมบูรณ์", "ฝ่ายเทคโนโลยีสารสนเทศ (IT)", "wichai@thaichamber.or.th", "2026-10-15", "2026-10-19", "2026-10-19 16:30", "Returned", "คืน: สภาพสมบูรณ์พร้อมสายชาร์จ"]
  ]);

  getOrCreateSheet(ss, "Categories", ["Category Name"], [
    ["Laptop"], ["Monitor"], ["Projector"], ["Adapter"], ["Audio"], ["Tablet"], ["Accessory"], ["Other"]
  ]);

  getOrCreateSheet(ss, "Departments", ["Department Name"], [
    ["ฝ่ายเทคโนโลยีสารสนเทศ (IT)"],
    ["สำนักเลขาธิการและประสานงาน"],
    ["ฝ่ายสมาชิกสัมพันธ์และการบริการ"],
    ["ฝ่ายส่งเสริมการค้าและเศรษฐกิจระหว่างประเทศ"],
    ["ฝ่ายพัฒนาธุรกิจและนวัตกรรม"],
    ["ฝ่ายประชาสัมพันธ์และสื่อสารองค์กร"],
    ["ฝ่ายการเงินและการบัญชี"],
    ["ฝ่ายทรัพยากรบุคคล (HR)"]
  ]);

  var rolesSheet = getOrCreateSheet(ss, "UserRoles", ["email", "first_name", "last_name", "dept", "role", "password", "status", "remark", "updated_at"], [
    ["itsupport@thaichamber.or.th", "IT Support", "(TCC)", "ฝ่ายเทคโนโลยีสารสนเทศ (IT)", "superadmin", "admin1234", "active", "อีเมลกลางฝ่ายไอที (ผู้ส่งระบบแจ้งเตือน)", ""],
    ["tatiphon.hi@thaichamber.or.th", "Tatiphon", "(Super Admin)", "ฝ่ายเทคโนโลยีสารสนเทศ (IT)", "superadmin", "admin1234", "active", "ผู้ดูแลระบบหลัก หอการค้าไทย", ""],
    ["wattanachai.mi@thaichamber.or.th", "Wattanachai", "(Admin)", "ฝ่ายเทคโนโลยีสารสนเทศ (IT)", "admin", "admin1234", "active", "เจ้าหน้าที่ฝ่ายไอที", ""],
    ["supakon.su@thaichamber.or.th", "Supakon", "(Admin)", "ฝ่ายเทคโนโลยีสารสนเทศ (IT)", "admin", "admin1234", "active", "เจ้าหน้าที่ฝ่ายไอที", ""],
    ["somchai.user@thaichamber.or.th", "สมชาย", "ใจดี", "ฝ่ายการเงินและการบัญชี", "user", "user1234", "active", "พนักงานทั่วไป", ""]
  ]);
  ensureUserRolesSchema(rolesSheet);

  getOrCreateSheet(ss, "TicketCategories", ["Category Name"], [
    ["ฮาร์ดแวร์ / เครื่องคอมพิวเตอร์ / จอภาพ"],
    ["ซอฟต์แวร์ / MS Office / โปรแกรมทั่วไป"],
    ["ระบบเครือข่าย / อินเทอร์เน็ต / Wi-Fi / VPN"],
    ["อีเมลองค์กร / บัญชีผู้ใช้งาน / รหัสผ่าน"],
    ["เครื่องพิมพ์ / สแกนเนอร์"],
    ["ระบบสารสนเทศภายใน / เว็บไซต์"],
    ["งานบริการไอทีอื่นๆ"]
  ]);

  getOrCreateSheet(ss, "InternalSystems", ["System Name"], [
    ["ระบบเว็บไซต์หลักหอการค้าไทย (thaichamber.or.th)"],
    ["ระบบทะเบียนสมาชิกหอการค้าไทย (TCC Member)"],
    ["ระบบสารบรรณอิเล็กทรอนิกส์ (e-Document / e-Office)"],
    ["ระบบทรัพยากรบุคคล / ลางานออนไลน์ (HRIS / ESS)"],
    ["ระบบบัญชีการเงินและงบประมาณ (ERP / SAP)"],
    ["ระบบออกหนังสือรับรองถิ่นกำเนิดสินค้า (CO Online)"],
    ["ระบบจองห้องประชุมและยานพาหนะ"],
    ["ระบบอินทราเน็ตภายใน (TCC Intranet)"],
    ["ระบบอื่นๆ (ระบุในรายละเอียด)"]
  ]);

  var ticketsSheet = getOrCreateSheet(ss, "Tickets", ["Ticket ID", "Title", "Category", "Priority", "Status", "Reporter Name", "Reporter Dept", "Reporter Contact", "Description", "Created At", "SLA Target", "Assigned Agent", "Resolved At", "CSAT Score", "CSAT Feedback", "Attachment Name", "Comments JSON", "Attachment URL", "Drive File ID", "System Name", "Description HTML", "Attachments JSON"], [
    ["ITC-2026-10-25-0001", "หน้าจอโน้ตบุ๊กกระพริบดับบางจังหวะ", "ฮาร์ดแวร์ / เครื่องคอมพิวเตอร์ / จอภาพ", "High", "In Progress", "สมชาย ใจดี", "ฝ่ายการเงินและการบัญชี", "somchai.user@thaichamber.or.th", "เวลาขยับบานพับหน้าจอ ภาพจะกระพริบ", "2026-10-25 10:00", "2026-10-25 14:00", "wattanachai.mi@thaichamber.or.th", "", 0, "", "error_screen.png", JSON.stringify([{ sender: "สมชาย ใจดี", message: "แจ้งเปิดเคสครับ", time: "2026-10-25 10:00", is_internal: false }]), "", "", "", "", "[]"],
    ["ITC-2026-10-27-0002", "ไม่สามารถเชื่อมต่อสัญญาณ Wi-Fi ได้", "ระบบเครือข่าย / อินเทอร์เน็ต / Wi-Fi / VPN", "Critical", "Open", "สุวิมล แสงทอง", "ฝ่ายสมาชิกสัมพันธ์และการบริการ", "suwimon@thaichamber.or.th", "แจ้งเตือน Can't connect to this network", "2026-10-27 11:30", "2026-10-27 13:30", "supakon.su@thaichamber.or.th", "", 0, "", "", JSON.stringify([{ sender: "สุวิมล แสงทอง", message: "รบกวนช่วยตรวจสอบหน่อยค่ะ", time: "2026-10-27 11:30", is_internal: false }]), "", "", "", "", "[]"]
  ]);
  ensureTicketsSchema(ticketsSheet);

  getOrCreateSheet(ss, "KnowledgeBase", ["KB ID", "Category", "Title", "Content", "Doc URL", "Attachment Name", "Attachment Base64", "Attachment URL", "Drive File ID"], [
    ["KB-001", "ระบบเครือข่าย / อินเทอร์เน็ต / Wi-Fi / VPN", "วิธีเชื่อมต่อ VPN หอการค้าไทยจากภายนอกสำนักงาน", "1. เปิดโปรแกรม FortiClient VPN\n2. ใส่ Remote Gateway: vpn.thaichamber.or.th\n3. ใส่ Username และ Password อีเมลองค์กร\n4. รอระบบยืนยันตัวตน OTP ทางโทรศัพท์", "", "", "", "", ""],
    ["KB-002", "อีเมลองค์กร / บัญชีผู้ใช้งาน / รหัสผ่าน", "ขั้นตอนการเปลี่ยนรหัสผ่านอีเมล @thaichamber.or.th", "1. เข้าสู่ระบบ https://myaccount.google.com\n2. ไปที่เมนู Security\n3. เลือก Password กำหนดรหัสผ่านใหม่", "", "", "", "", ""],
    ["KB-003", "ฮาร์ดแวร์ / เครื่องคอมพิวเตอร์ / จอภาพ", "วิธีแก้ปัญหาเครื่องปริ้นเตอร์ไม่ออกหรือเอกสารค้างคิว (Spooler)", "1. กดปุ่ม Windows + R พิมพ์ services.msc\n2. หาบริการ Print Spooler แล้วคลิกขวา Restart", "", "", "", "", ""]
  ]);

  var itemData = ss.getSheetByName("Items").getDataRange().getValues();
  var items = [];
  for (var i = 1; i < itemData.length; i++) {
    if (itemData[i][0]) {
      items.push({
        item_id: String(itemData[i][0]),
        item_name: String(itemData[i][1]),
        category: String(itemData[i][2]),
        serial_number: String(itemData[i][3]),
        status: String(itemData[i][4]),
        image_name: String(itemData[i][5] || ""),
        image_url: String(itemData[i][6] || ""),
        drive_file_id: String(itemData[i][7] || "")
      });
    }
  }

  var logData = ss.getSheetByName("Logs").getDataRange().getValues();
  var allLogs = [];
  var activeBorrows = [];
  for (var j = 1; j < logData.length; j++) {
    if (logData[j][0]) {
      var transObj = {
        trans_id: String(logData[j][0]),
        timestamp: formatGASDate(logData[j][1], "yyyy-MM-dd HH:mm"),
        item_id: String(logData[j][2]),
        borrower_name: String(logData[j][3]),
        borrower_dept: String(logData[j][4]),
        borrower_contact: String(logData[j][5]),
        borrow_date: formatGASDate(logData[j][6], "yyyy-MM-dd"),
        expected_return: formatGASDate(logData[j][7], "yyyy-MM-dd"),
        actual_return: formatGASDate(logData[j][8], "yyyy-MM-dd HH:mm"),
        trans_status: String(logData[j][9]),
        notes: String(logData[j][10] || "")
      };
      allLogs.push(transObj);
      if (transObj.trans_status === "Borrowed") {
        activeBorrows.push({
          trans_id: transObj.trans_id,
          item_id: transObj.item_id,
          borrower_name: transObj.borrower_name,
          borrower_dept: transObj.borrower_dept,
          borrower_contact: transObj.borrower_contact,
          borrow_date: transObj.borrow_date,
          expected_return: transObj.expected_return
        });
      }
    }
  }

  var catData = ss.getSheetByName("Categories").getDataRange().getValues();
  var categories = [];
  for (var c = 1; c < catData.length; c++) {
    if (catData[c][0]) categories.push(String(catData[c][0]));
  }

  var deptData = ss.getSheetByName("Departments").getDataRange().getValues();
  var departments = [];
  for (var d = 1; d < deptData.length; d++) {
    if (deptData[d][0]) departments.push(String(deptData[d][0]));
  }

  var userRoles = [];
  if (rolesSheet) {
    var rData = rolesSheet.getDataRange().getValues();
    if (rData.length > 1) {
      var colMap = getUserRolesColumnMap(rData[0]);
      for (var r = 1; r < rData.length; r++) {
        var row = rData[r];
        if (row[colMap.email]) {
          var em = String(row[colMap.email]).trim();
          var fn = colMap.first_name !== -1 ? String(row[colMap.first_name] || "").trim() : "";
          var ln = colMap.last_name !== -1 ? String(row[colMap.last_name] || "").trim() : "";
          var nm = colMap.name !== -1 ? String(row[colMap.name] || "").trim() : "";
          var sp = splitGASName(nm || em.split("@")[0], fn, ln);
          var rl = colMap.role !== -1 ? String(row[colMap.role] || "user").trim() : "user";
          var dp = colMap.dept !== -1 ? String(row[colMap.dept] || "").trim() : "";
          var pw = colMap.password !== -1 ? String(row[colMap.password] || "123456").trim() : "123456";
          var st = colMap.status !== -1 ? String(row[colMap.status] || "active").trim() : "active";
          var rm = colMap.remark !== -1 ? String(row[colMap.remark] || "").trim() : "";
          userRoles.push({
            email: em,
            first_name: sp.first_name,
            last_name: sp.last_name,
            name: sp.name || em.split("@")[0],
            dept: dp || "",
            role: rl || "user",
            password: pw || "123456",
            status: st || "active",
            remark: rm || ""
          });
        }
      }
    }
  }

  var tktCatSheet = ss.getSheetByName("TicketCategories");
  var ticketCategories = [];
  if (tktCatSheet) {
    var tcData = tktCatSheet.getDataRange().getValues();
    for (var tc = 1; tc < tcData.length; tc++) {
      if (tcData[tc][0]) ticketCategories.push(String(tcData[tc][0]));
    }
  }

  var intSysSheet = ss.getSheetByName("InternalSystems");
  var internalSystems = [];
  if (intSysSheet) {
    var isData = intSysSheet.getDataRange().getValues();
    for (var isIdx = 1; isIdx < isData.length; isIdx++) {
      if (isData[isIdx][0]) internalSystems.push(String(isData[isIdx][0]));
    }
  }

  var ticketData = ss.getSheetByName("Tickets").getDataRange().getValues();
  var tickets = [];
  for (var t = 1; t < ticketData.length; t++) {
    if (ticketData[t][0]) {
      var comms = [];
      try { comms = JSON.parse(ticketData[t][16] || "[]"); } catch(e) {}
      var atts = [];
      try { atts = JSON.parse(ticketData[t][21] || "[]"); } catch(e) {}
      tickets.push({
        ticket_id: String(ticketData[t][0]),
        title: String(ticketData[t][1]),
        category: String(ticketData[t][2]),
        priority: String(ticketData[t][3]),
        status: String(ticketData[t][4]),
        reporter_name: String(ticketData[t][5]),
        reporter_dept: String(ticketData[t][6]),
        reporter_contact: String(ticketData[t][7]),
        description: String(ticketData[t][8]),
        created_at: formatGASDate(ticketData[t][9], "yyyy-MM-dd HH:mm"),
        sla_target: formatGASDate(ticketData[t][10], "yyyy-MM-dd HH:mm"),
        assigned_agent: String(ticketData[t][11]),
        resolved_at: formatGASDate(ticketData[t][12], "yyyy-MM-dd HH:mm"),
        csat_score: parseInt(ticketData[t][13], 10) || 0,
        csat_feedback: String(ticketData[t][14] || ""),
        attachment_name: String(ticketData[t][15] || ""),
        comments: comms,
        attachment_url: String(ticketData[t][17] || ""),
        drive_file_id: String(ticketData[t][18] || ""),
        system_name: String(ticketData[t][19] || ""),
        description_html: String(ticketData[t][20] || ""),
        attachments: Array.isArray(atts) ? atts : []
      });
    }
  }

  var kbData = ss.getSheetByName("KnowledgeBase").getDataRange().getValues();
  var knowledgeBase = [];
  for (var k = 1; k < kbData.length; k++) {
    if (kbData[k][0]) {
      knowledgeBase.push({
        kb_id: String(kbData[k][0]),
        category: String(kbData[k][1]),
        title: String(kbData[k][2]),
        content: String(kbData[k][3]),
        doc_url: String(kbData[k][4] || ""),
        attachment_name: String(kbData[k][5] || ""),
        attachment_base64: String(kbData[k][6] || ""),
        attachment_url: String(kbData[k][7] || ""),
        drive_file_id: String(kbData[k][8] || "")
      });
    }
  }

  var emailSheet = getOrCreateSheet(ss, "EmailSettings", ["Setting Key", "JSON Value", "Updated At"], []);
  var emailNotifyEnabled = true;
  var emailConfig = null;
  var emailTemplates = null;
  var eData = emailSheet.getDataRange().getValues();
  for (var eIdx = 1; eIdx < eData.length; eIdx++) {
    var eKey = String(eData[eIdx][0] || "").trim();
    var eVal = String(eData[eIdx][1] || "").trim();
    if (!eKey || !eVal) continue;
    try {
      if (eKey === "emailNotifyEnabled") {
        emailNotifyEnabled = (eVal === "false") ? false : (eVal === "true" ? true : !!JSON.parse(eVal));
      } else if (eKey === "emailConfig") {
        emailConfig = JSON.parse(eVal);
      } else if (eKey === "emailTemplates") {
        emailTemplates = JSON.parse(eVal);
      }
    } catch (eErr) {}
  }
  try {
    var savedPropPass = PropertiesService.getScriptProperties().getProperty("TCC_SMTP_PASS") || "";
    if (savedPropPass) {
      if (!emailConfig) emailConfig = {};
      if (!emailConfig.smtpPass) emailConfig.smtpPass = savedPropPass;
    }
  } catch (_) {}

  return jsonResponse({
    status: "success",
    items: items,
    activeBorrows: activeBorrows,
    allLogs: allLogs,
    categories: categories,
    departments: departments,
    userRoles: userRoles,
    ticketCategories: ticketCategories,
    internalSystems: internalSystems,
    tickets: tickets,
    knowledgeBase: knowledgeBase,
    emailNotifyEnabled: emailNotifyEnabled,
    emailConfig: emailConfig,
    emailTemplates: emailTemplates
  });
}

function getOrCreateDriveFolder(customFolderId, subFolderName) {
  var rootFolder = null;
  if (customFolderId && String(customFolderId).trim() !== "") {
    try {
      rootFolder = DriveApp.getFolderById(String(customFolderId).trim());
    } catch (e) {
      rootFolder = null;
    }
  }
  if (!rootFolder) {
    var defaultName = "TCC_IT_System_Attachments";
    var folders = DriveApp.getFoldersByName(defaultName);
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder(defaultName);
    }
  }
  if (subFolderName) {
    var subFolders = rootFolder.getFoldersByName(subFolderName);
    if (subFolders.hasNext()) return subFolders.next();
    return rootFolder.createFolder(subFolderName);
  }
  return rootFolder;
}

function saveBase64FileToDrive(base64Data, fileName, folderId, subFolder) {
  if (!base64Data) return null;
  var str = String(base64Data);
  var mimeType = "application/octet-stream";
  var b64Clean = str;
  if (str.indexOf("base64,") !== -1) {
    var parts = str.split("base64,");
    var header = parts[0];
    b64Clean = parts[1];
    var m = header.match(/data:([^;]+);/);
    if (m && m[1]) mimeType = m[1];
  }
  var bytes = Utilities.base64Decode(b64Clean);
  var blob = Utilities.newBlob(bytes, mimeType, fileName || ("attachment_" + new Date().getTime()));
  var folder = getOrCreateDriveFolder(folderId, subFolder || "Tickets");
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {}
  }
  var fid = file.getId();
  return {
    fileId: fid,
    viewUrl: "https://drive.google.com/file/d/" + fid + "/view?usp=sharing",
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + fid,
    thumbnailUrl: "https://drive.google.com/thumbnail?id=" + fid + "&sz=w1600",
    folderName: folder.getName()
  };
}

function handleUploadFileToDrive(data) {
  var saved = saveBase64FileToDrive(data.base64Data, data.fileName, data.folderId, data.subFolder || "Tickets");
  if (!saved) return jsonResponse({ status: "error", message: "No base64 data provided" });
  return jsonResponse({
    status: "success",
    fileId: saved.fileId,
    viewUrl: saved.viewUrl,
    downloadUrl: saved.downloadUrl,
    thumbnailUrl: saved.thumbnailUrl,
    folderName: saved.folderName
  });
}

function ensureTicketsSchema(sheet) {
  if (!sheet) return;
  try {
    var lastCol = Math.max(sheet.getLastColumn(), 22);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (!String(headers[19] || "").trim()) sheet.getRange(1, 20).setValue("System Name");
    if (!String(headers[20] || "").trim()) sheet.getRange(1, 21).setValue("Description HTML");
    if (!String(headers[21] || "").trim()) sheet.getRange(1, 22).setValue("Attachments JSON");
  } catch (e) {}
}

function uploadInlineImagesInHtmlGAS(html, prefix, folderId) {
  var raw = String(html || "");
  if (!raw) return "";
  var idx = 0;
  var out = raw.replace(/src=(["'])(data:image\/([^;]+);base64,([^"']+))\1/gi, function(match, quote, fullDataUrl, ext, b64) {
    idx++;
    try {
      var safeExt = String(ext || "png").split("+")[0].replace(/[^a-zA-Z0-9]/g, "") || "png";
      var saved = saveBase64FileToDrive(fullDataUrl, (prefix || "INLINE") + "_img_" + idx + "." + safeExt, folderId || "", "Tickets");
      if (saved && saved.fileId) {
        return 'src="https://drive.google.com/thumbnail?id=' + saved.fileId + '&sz=w1200"';
      }
    } catch (e) {}
    return match;
  });
  if (out.length > 49000) {
    out = out.replace(/src=(["'])data:image\/[^"']+\1/gi, 'src=""');
  }
  if (out.length > 49000) {
    out = out.substring(0, 49000);
  }
  return out;
}

function handleCreateTicket(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Tickets");
  ensureTicketsSchema(sheet);
  var t = data.ticketData;
  var folderId = data.driveFolderId || data.folderId || "";
  var attUrl = t.attachment_url || "";
  var driveId = t.drive_file_id || "";
  if (!driveId && t.attachment_base64) {
    try {
      var saved = saveBase64FileToDrive(t.attachment_base64, (t.ticket_id || "TKT") + "_" + (t.attachment_name || "image.png"), folderId, "Tickets");
      if (saved) {
        driveId = saved.fileId;
        attUrl = saved.viewUrl;
      }
    } catch (e) {}
  }
  var descHtml = uploadInlineImagesInHtmlGAS(t.description_html || "", t.ticket_id || "TKT", folderId);
  var attachmentsList = Array.isArray(t.attachments) ? t.attachments.map(function(att, aIdx) {
    var item = Object.assign ? Object.assign({}, att) : JSON.parse(JSON.stringify(att));
    if (!item.driveFileId && !item.driveUrl && item.base64) {
      try {
        var savedAtt = saveBase64FileToDrive(item.base64, (t.ticket_id || "TKT") + "_att_" + (aIdx + 1) + "_" + (item.name || "file"), folderId, "Tickets");
        if (savedAtt) {
          item.driveFileId = savedAtt.fileId;
          item.driveUrl = savedAtt.viewUrl;
        }
      } catch (e) {}
    }
    if (item.driveFileId || item.driveUrl) delete item.base64;
    return item;
  }) : [];
  var attachmentsJson = JSON.stringify(attachmentsList);
  if (attachmentsJson.length > 49000) {
    attachmentsJson = JSON.stringify(attachmentsList.map(function(att) {
      return { name: att.name || "", size: att.size || 0, type: att.type || "", driveUrl: att.driveUrl || "", driveFileId: att.driveFileId || "" };
    }));
  }
  var commentsList = Array.isArray(t.comments) ? t.comments.map(function(c, cIdx) {
    var cm = JSON.parse(JSON.stringify(c));
    if (cm.message_html) cm.message_html = uploadInlineImagesInHtmlGAS(cm.message_html, (t.ticket_id || "TKT") + "_C" + (cIdx + 1), folderId);
    return cm;
  }) : [];
  sheet.appendRow([
    t.ticket_id, t.title, t.category, t.priority, t.status,
    t.reporter_name, t.reporter_dept, t.reporter_contact, t.description,
    t.created_at, t.sla_target, t.assigned_agent, t.resolved_at,
    t.csat_score, t.csat_feedback, t.attachment_name, JSON.stringify(commentsList),
    attUrl, driveId, t.system_name || "", descHtml, attachmentsJson
  ]);
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "สร้างเคสเรียบร้อย", attachment_url: attUrl, drive_file_id: driveId, description_html: descHtml, attachments: attachmentsList });
}

function handleUpdateTicket(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Tickets");
  ensureTicketsSchema(sheet);
  var tid = String(data.ticketId).trim().toLowerCase();
  var folderId = data.driveFolderId || data.folderId || "";
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === tid) {
      var row = i + 1;
      var u = data.updates || {};
      if (u.status !== undefined) sheet.getRange(row, 5).setValue(u.status);
      if (u.assigned_agent !== undefined) sheet.getRange(row, 12).setValue(u.assigned_agent);
      if (u.resolved_at !== undefined) sheet.getRange(row, 13).setValue(u.resolved_at);
      if (u.csat_score !== undefined) sheet.getRange(row, 14).setValue(u.csat_score);
      if (u.csat_feedback !== undefined) sheet.getRange(row, 15).setValue(u.csat_feedback);
      if (u.comments !== undefined) {
        var processedComments = Array.isArray(u.comments) ? u.comments.map(function(c, cIdx) {
          var cm = JSON.parse(JSON.stringify(c));
          if (cm.message_html) {
            cm.message_html = uploadInlineImagesInHtmlGAS(cm.message_html, (data.ticketId || "TKT") + "_C" + (cIdx + 1), folderId);
          }
          if (Array.isArray(cm.attachments)) {
            cm.attachments = cm.attachments.map(function(att) {
              var a = JSON.parse(JSON.stringify(att));
              if (a.driveFileId || a.driveUrl) delete a.base64;
              return a;
            });
          }
          return cm;
        }) : u.comments;
        var commentsStr = JSON.stringify(processedComments);
        if (commentsStr.length <= 49000) {
          sheet.getRange(row, 17).setValue(commentsStr);
        } else {
          var strippedComments = Array.isArray(processedComments) ? processedComments.map(function(c) {
            var cm = JSON.parse(JSON.stringify(c));
            if (Array.isArray(cm.attachments)) {
              cm.attachments = cm.attachments.map(function(att) {
                return { name: att.name || "", size: att.size || 0, type: att.type || "", driveUrl: att.driveUrl || "", driveFileId: att.driveFileId || "" };
              });
            }
            return cm;
          }) : processedComments;
          sheet.getRange(row, 17).setValue(JSON.stringify(strippedComments).substring(0, 49000));
        }
      }
      if (u.attachment_url !== undefined) sheet.getRange(row, 18).setValue(u.attachment_url);
      if (u.drive_file_id !== undefined) sheet.getRange(row, 19).setValue(u.drive_file_id);
      if (u.system_name !== undefined) sheet.getRange(row, 20).setValue(u.system_name);
      if (u.description_html !== undefined) {
        sheet.getRange(row, 21).setValue(uploadInlineImagesInHtmlGAS(u.description_html, data.ticketId || "TKT", folderId));
      }
      if (u.attachments !== undefined) {
        var attJson = JSON.stringify(u.attachments);
        if (attJson.length > 49000 && Array.isArray(u.attachments)) {
          attJson = JSON.stringify(u.attachments.map(function(att) {
            return { name: att.name || "", size: att.size || 0, type: att.type || "", driveUrl: att.driveUrl || "", driveFileId: att.driveFileId || "" };
          }));
        }
        sheet.getRange(row, 22).setValue(attJson.substring(0, 49000));
      }
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "อัปเดตเรียบร้อย" });
}

function handleSaveKbArticle(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("KnowledgeBase");
  var k = data.articleData;
  var attUrl = k.attachment_url || "";
  var driveId = k.drive_file_id || "";
  if (!driveId && k.attachment_base64) {
    try {
      var saved = saveBase64FileToDrive(k.attachment_base64, (k.kb_id || "KB") + "_" + (k.attachment_name || "file"), data.folderId || "", "KnowledgeBase");
      if (saved) {
        driveId = saved.fileId;
        attUrl = saved.viewUrl;
      }
    } catch (e) {}
  }
  var safeB64 = (k.attachment_base64 && String(k.attachment_base64).length < 45000) ? k.attachment_base64 : "";
  sheet.appendRow([k.kb_id, k.category, k.title, k.content, k.doc_url || attUrl || "", k.attachment_name || "", safeB64, attUrl, driveId]);
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "บันทึกเรียบร้อย", attachment_url: attUrl, drive_file_id: driveId });
}

function handleDeleteKbArticle(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("KnowledgeBase");
  var kid = String(data.kbId).trim().toLowerCase();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === kid) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "ลบเรียบร้อย" });
}

// Req 1: จัดการรหัสธุรกรรม ITB-YYYY-MM-DD-XXXX
function handleBorrowItem(data) {
  var ss = getSpreadsheet();
  var itemSheet = ss.getSheetByName("Items");
  var logSheet = ss.getSheetByName("Logs");
  var itemIds = data.itemIds || (data.itemId ? [data.itemId] : []);
  var itemData = itemSheet.getDataRange().getValues();
  var now = new Date();
  var yyyy = now.getFullYear();
  var mm = Utilities.formatDate(now, "GMT+7", "MM");
  var dd = Utilities.formatDate(now, "GMT+7", "dd");
  var datePart = yyyy + "-" + mm + "-" + dd;
  var prefixYear = "ITB-" + yyyy + "-";

  var maxSeq = 0;
  if (!data.transIds || data.transIds.length === 0) {
    var logData = logSheet.getDataRange().getValues();
    for (var r = 1; r < logData.length; r++) {
      var lid = String(logData[r][0] || "").trim();
      if (lid.indexOf(prefixYear) === 0) {
        var m = lid.match(/^ITB-d{4}-d{2}-d{2}-(d{4})/);
        if (m) {
          var seq = parseInt(m[1], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    }
  }

  for (var k = 0; k < itemIds.length; k++) {
    var tid = String(itemIds[k]).trim().toLowerCase();
    for (var i = 1; i < itemData.length; i++) {
      if (String(itemData[i][0]).trim().toLowerCase() === tid) {
        itemSheet.getRange(i + 1, 5).setValue("Borrowed");
        var transId = (data.transIds && data.transIds[k]) ? data.transIds[k] : ("ITB-" + datePart + "-" + String(maxSeq + k + 1).padStart(4, "0"));
        logSheet.appendRow([transId, now, itemData[i][0], data.borrowerName, data.dept, data.contact, data.borrowDate, data.expectedReturn, "", "Borrowed", data.notes || ""]);
        break;
      }
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "บันทึกเรียบร้อย" });
}

function handleReturnItem(data) {
  var ss = getSpreadsheet();
  var itemSheet = ss.getSheetByName("Items");
  var logSheet = ss.getSheetByName("Logs");
  var targetTransList = data.transIds || (data.transId ? [data.transId] : []);
  var logData = logSheet.getDataRange().getValues();
  var itemData = itemSheet.getDataRange().getValues();
  var now = new Date();

  targetTransList.forEach(function(tid) {
    var tClean = String(tid).trim().toLowerCase();
    for (var i = 1; i < logData.length; i++) {
      if (String(logData[i][0]).trim().toLowerCase() === tClean) {
        logSheet.getRange(i + 1, 9).setValue(now);
        logSheet.getRange(i + 1, 10).setValue("Returned");
        var matchedItemId = String(logData[i][2]).trim().toLowerCase();
        for (var k = 1; k < itemData.length; k++) {
          if (String(itemData[k][0]).trim().toLowerCase() === matchedItemId) {
            itemSheet.getRange(k + 1, 5).setValue("Available");
            break;
          }
        }
        break;
      }
    }
  });
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "รับคืนเรียบร้อย" });
}

function handleUpdateHistoryLog(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Logs");
  var u = data.updates || data.logData || {};
  var tid = String(data.transId || u.trans_id || "").trim().toLowerCase();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === tid) {
      var row = i + 1;
      if (u.borrower_name !== undefined) sheet.getRange(row, 4).setValue(u.borrower_name);
      if (u.borrower_dept !== undefined) sheet.getRange(row, 5).setValue(u.borrower_dept);
      if (u.borrower_contact !== undefined) sheet.getRange(row, 6).setValue(u.borrower_contact);
      if (u.borrow_date !== undefined) sheet.getRange(row, 7).setValue(u.borrow_date);
      if (u.expected_return !== undefined) sheet.getRange(row, 8).setValue(u.expected_return);
      if (u.actual_return !== undefined) sheet.getRange(row, 9).setValue(u.actual_return);
      if (u.trans_status !== undefined) sheet.getRange(row, 10).setValue(u.trans_status);
      if (u.notes !== undefined) sheet.getRange(row, 11).setValue(u.notes);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "แก้ไขประวัติเรียบร้อย" });
}

function handleAddDepartment(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Departments");
  sheet.appendRow([data.deptName]);
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "เพิ่มแผนกเรียบร้อย" });
}

function handleUpdateDepartment(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Departments");
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(data.oldName).trim().toLowerCase()) {
      sheet.getRange(i + 1, 1).setValue(data.newName);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "แก้ไขแผนกเรียบร้อย" });
}

function handleDeleteDepartment(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Departments");
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(data.deptName).trim().toLowerCase()) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "ลบแผนกเรียบร้อย" });
}

function handleAddTicketCategory(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("TicketCategories");
  sheet.appendRow([data.categoryName]);
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "เพิ่มหมวดหมู่เรียบร้อย" });
}

function handleUpdateTicketCategory(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("TicketCategories");
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(data.oldName).trim().toLowerCase()) {
      sheet.getRange(i + 1, 1).setValue(data.newName);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "แก้ไขหมวดหมู่เรียบร้อย" });
}

function handleDeleteTicketCategory(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("TicketCategories");
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(data.categoryName).trim().toLowerCase()) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "ลบหมวดหมู่เรียบร้อย" });
}

function handleSaveTicketCategoriesOrder(data) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, "TicketCategories", ["Category Name"], []);
  var list = Array.isArray(data.categoriesList) ? data.categoriesList : [];
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).clearContent();
  }
  if (list.length > 0) {
    var rows = list.map(function(item) { return [String(item || "").trim()]; }).filter(function(r) { return r[0] !== ""; });
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 1).setValues(rows);
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "บันทึกลำดับหมวดหมู่ปัญหาเรียบร้อย" });
}

function handleSaveInternalSystemsOrder(data) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, "InternalSystems", ["System Name"], []);
  var list = Array.isArray(data.systemsList) ? data.systemsList : [];
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).clearContent();
  }
  if (list.length > 0) {
    var rows = list.map(function(item) { return [String(item || "").trim()]; }).filter(function(r) { return r[0] !== ""; });
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 1).setValues(rows);
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "บันทึกลำดับชื่อระบบสารสนเทศเรียบร้อย" });
}

function handleAddInternalSystem(data) {
  if (Array.isArray(data.systemsList) && data.systemsList.length > 0) {
    return handleSaveInternalSystemsOrder(data);
  }
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, "InternalSystems", ["System Name"], []);
  sheet.appendRow([data.systemName]);
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "เพิ่มชื่อระบบสารสนเทศเรียบร้อย" });
}

function handleUpdateInternalSystem(data) {
  if (Array.isArray(data.systemsList) && data.systemsList.length > 0) {
    handleSaveInternalSystemsOrder(data);
  } else {
    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet(ss, "InternalSystems", ["System Name"], []);
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim().toLowerCase() === String(data.oldName).trim().toLowerCase()) {
        sheet.getRange(i + 1, 1).setValue(data.newName);
        break;
      }
    }
    SpreadsheetApp.flush();
  }
  return jsonResponse({ status: "success", message: "แก้ไขชื่อระบบสารสนเทศเรียบร้อย" });
}

function handleDeleteInternalSystem(data) {
  if (Array.isArray(data.systemsList)) {
    return handleSaveInternalSystemsOrder(data);
  }
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, "InternalSystems", ["System Name"], []);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(data.systemName).trim().toLowerCase()) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "ลบชื่อระบบสารสนเทศเรียบร้อย" });
}

function handleAddItem(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Items");
  if (sheet.getLastColumn() < 8) {
    sheet.getRange(1, 6, 1, 3).setValues([["Image Name", "Image URL", "Drive File ID"]]).setFontWeight("bold").setBackground("#005ba6").setFontColor("#ffffff");
  }
  var imgUrl = data.imageUrl || "";
  var driveId = data.driveFileId || "";
  if (String(driveId).indexOf("DRV_") === 0) driveId = "";
  if (String(imgUrl).indexOf("drive.google.com/file/d/DRV_") !== -1) imgUrl = "";
  var imgName = data.imageName || "";
  if (!driveId && data.imageBase64) {
    try {
      var saved = saveBase64FileToDrive(data.imageBase64, (data.itemId || "IT") + "_" + (imgName || "equipment.png"), data.folderId || "", "Equipment");
      if (saved) {
        driveId = saved.fileId;
        imgUrl = saved.viewUrl;
      }
    } catch (e) {}
  }
  sheet.appendRow([data.itemId, data.itemName, data.category, data.serialNumber, "Available", imgName, imgUrl, driveId]);
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "เพิ่มอุปกรณ์เรียบร้อย", image_url: imgUrl, drive_file_id: driveId });
}

function handleUpdateItem(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Items");
  if (sheet.getLastColumn() < 8) {
    sheet.getRange(1, 6, 1, 3).setValues([["Image Name", "Image URL", "Drive File ID"]]).setFontWeight("bold").setBackground("#005ba6").setFontColor("#ffffff");
  }
  var id = String(data.itemId).trim().toLowerCase();
  var values = sheet.getDataRange().getValues();
  var imgUrl = data.imageUrl;
  var driveId = data.driveFileId;
  if (driveId !== undefined && String(driveId).indexOf("DRV_") === 0) driveId = "";
  if (imgUrl !== undefined && String(imgUrl).indexOf("drive.google.com/file/d/DRV_") !== -1) imgUrl = "";
  if (!driveId && data.imageBase64) {
    try {
      var saved = saveBase64FileToDrive(data.imageBase64, (data.itemId || "IT") + "_" + (data.imageName || "equipment.png"), data.folderId || "", "Equipment");
      if (saved) {
        driveId = saved.fileId;
        imgUrl = saved.viewUrl;
      }
    } catch (e) {}
  }
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === id) {
      var row = i + 1;
      if (data.itemName !== undefined) sheet.getRange(row, 2).setValue(data.itemName);
      if (data.category !== undefined) sheet.getRange(row, 3).setValue(data.category);
      if (data.serialNumber !== undefined) sheet.getRange(row, 4).setValue(data.serialNumber);
      if (data.status !== undefined) sheet.getRange(row, 5).setValue(data.status);
      if (data.imageName !== undefined) sheet.getRange(row, 6).setValue(data.imageName);
      if (imgUrl !== undefined) sheet.getRange(row, 7).setValue(imgUrl);
      if (driveId !== undefined) sheet.getRange(row, 8).setValue(driveId);
      break;
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "อัปเดตอุปกรณ์เรียบร้อย", image_url: imgUrl || "", drive_file_id: driveId || "" });
}

function splitGASName(fullName, firstName, lastName) {
  var fn = String(firstName || "").trim();
  var ln = String(lastName || "").trim();
  if (fn || ln) {
    return { first_name: fn, last_name: ln, name: [fn, ln].filter(Boolean).join(" ").trim() };
  }
  var raw = String(fullName || "").trim();
  if (!raw) return { first_name: "", last_name: "", name: "" };
  var parts = raw.split(/s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "", name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" "), name: raw };
}

function getUserRolesColumnMap(headerRow) {
  var map = { email: -1, first_name: -1, last_name: -1, name: -1, role: -1, dept: -1, password: -1, status: -1, remark: -1, updated_at: -1 };
  if (!headerRow || headerRow.length === 0) return map;
  for (var c = 0; c < headerRow.length; c++) {
    var h = String(headerRow[c] || "").trim().toLowerCase();
    if (map.email === -1 && (h.indexOf("email") !== -1 || h.indexOf("อีเมล") !== -1 || h.indexOf("username") !== -1 || h.indexOf("บัญชี") !== -1)) map.email = c;
    else if (map.first_name === -1 && (h === "first_name" || h === "firstname" || h.indexOf("first name") !== -1 || (h.indexOf("ชื่อ") !== -1 && h.indexOf("นามสกุล") === -1))) map.first_name = c;
    else if (map.last_name === -1 && (h === "last_name" || h === "lastname" || h.indexOf("last name") !== -1 || (h.indexOf("นามสกุล") !== -1 && h.indexOf("ชื่อ") === -1))) map.last_name = c;
    else if (map.name === -1 && (h === "name" || h.indexOf("full") !== -1 || h.indexOf("ชื่อ") !== -1)) map.name = c;
    else if (map.dept === -1 && (h.indexOf("dept") !== -1 || h.indexOf("department") !== -1 || h.indexOf("ฝ่าย") !== -1 || h.indexOf("แผนก") !== -1)) map.dept = c;
    else if (map.role === -1 && (h.indexOf("role") !== -1 || h.indexOf("สิทธิ์") !== -1 || h.indexOf("ระดับ") !== -1)) map.role = c;
    else if (map.password === -1 && (h.indexOf("pass") !== -1 || h.indexOf("pwd") !== -1 || h.indexOf("รหัส") !== -1)) map.password = c;
    else if (map.status === -1 && (h.indexOf("status") !== -1 || h.indexOf("สถานะ") !== -1)) map.status = c;
    else if (map.remark === -1 && (h.indexOf("remark") !== -1 || h.indexOf("note") !== -1 || h.indexOf("หมายเหตุ") !== -1)) map.remark = c;
    else if (map.updated_at === -1 && (h.indexOf("updated") !== -1 || h.indexOf("date") !== -1 || h.indexOf("เวลา") !== -1 || h.indexOf("timestamp") !== -1)) map.updated_at = c;
  }
  if (map.email === -1) map.email = 0;
  return map;
}

// ตรวจสอบและอัปเกรดโครงสร้างตาราง UserRoles อัตโนมัติ (แยก first_name, last_name และเพิ่มคอลัมน์ dept ที่ขาด)
function ensureUserRolesSchema(sheet) {
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();
  var targetHeaders = ["email", "first_name", "last_name", "dept", "role", "password", "status", "remark", "updated_at"];
  if (values.length === 0) {
    sheet.appendRow(targetHeaders);
    sheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight("bold").setBackground("#005ba6").setFontColor("#ffffff");
    return;
  }
  var colMap = getUserRolesColumnMap(values[0]);
  // หากตารางเดิมยังไม่มีคอลัมน์ first_name, last_name หรือ dept ให้ทำการแปลงและย้ายข้อมูลเดิมเข้าคอลัมน์ใหม่ทันที
  if (colMap.first_name === -1 || colMap.last_name === -1 || colMap.dept === -1) {
    var migratedRows = [targetHeaders];
    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+7", "dd/MM/yyyy, HH:mm:ss");
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var em = colMap.email !== -1 ? String(row[colMap.email] || "").trim() : "";
      if (!em) continue;
      var fn = colMap.first_name !== -1 ? String(row[colMap.first_name] || "").trim() : "";
      var ln = colMap.last_name !== -1 ? String(row[colMap.last_name] || "").trim() : "";
      var nm = colMap.name !== -1 ? String(row[colMap.name] || "").trim() : "";
      var sp = splitGASName(nm || em.split("@")[0], fn, ln);
      var dp = colMap.dept !== -1 ? String(row[colMap.dept] || "").trim() : "";
      var rl = colMap.role !== -1 ? String(row[colMap.role] || "user").trim() : "user";
      var pw = colMap.password !== -1 ? String(row[colMap.password] || "123456").trim() : "123456";
      var st = colMap.status !== -1 ? String(row[colMap.status] || "active").trim() : "active";
      var rm = colMap.remark !== -1 ? String(row[colMap.remark] || "").trim() : "";
      var up = colMap.updated_at !== -1 ? (row[colMap.updated_at] || nowStr) : nowStr;
      migratedRows.push([em, sp.first_name, sp.last_name, dp, rl || "user", pw || "123456", st || "active", rm, up]);
    }
    sheet.clearContents();
    sheet.getRange(1, 1, migratedRows.length, targetHeaders.length).setValues(migratedRows);
    sheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight("bold").setBackground("#005ba6").setFontColor("#ffffff");
    SpreadsheetApp.flush();
  }
}

// UserRoles: บันทึกเดี่ยว (Single Save) รองรับหัวตารางอัตโนมัติ (แยกชื่อ-นามสกุล และฝ่าย/แผนก)
function handleSaveUserRole(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("UserRoles");
  if (!sheet) {
    sheet = ss.insertSheet("UserRoles");
    sheet.appendRow(["email", "first_name", "last_name", "dept", "role", "password", "status", "remark", "updated_at"]);
  }
  ensureUserRolesSchema(sheet);
  var r = data.roleData || {};
  var email = String(r.email || "").trim().toLowerCase();
  if (!email) return jsonResponse({ status: "error", message: "No email provided" });

  var sp = splitGASName(r.name || email.split("@")[0], r.first_name, r.last_name);
  var values = sheet.getDataRange().getValues();
  var colMap = getUserRolesColumnMap(values[0]);
  var numCols = values[0].length;
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+7", "dd/MM/yyyy, HH:mm:ss");

  var foundRow = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colMap.email] || "").trim().toLowerCase() === email) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    var targetRow = values[foundRow - 1];
    if (colMap.first_name !== -1) targetRow[colMap.first_name] = sp.first_name;
    if (colMap.last_name !== -1) targetRow[colMap.last_name] = sp.last_name;
    if (colMap.name !== -1) targetRow[colMap.name] = sp.name;
    if (colMap.dept !== -1 && r.dept !== undefined) targetRow[colMap.dept] = r.dept;
    if (colMap.role !== -1 && r.role !== undefined) targetRow[colMap.role] = r.role;
    if (colMap.password !== -1 && r.password !== undefined) targetRow[colMap.password] = r.password;
    if (colMap.status !== -1 && r.status !== undefined) targetRow[colMap.status] = r.status;
    if (colMap.remark !== -1 && r.remark !== undefined) targetRow[colMap.remark] = r.remark;
    if (colMap.updated_at !== -1) targetRow[colMap.updated_at] = timestamp;
    sheet.getRange(foundRow, 1, 1, numCols).setValues([targetRow]);
  } else {
    var newRow = new Array(numCols);
    for (var k = 0; k < numCols; k++) newRow[k] = "";
    newRow[colMap.email] = email;
    if (colMap.first_name !== -1) newRow[colMap.first_name] = sp.first_name;
    if (colMap.last_name !== -1) newRow[colMap.last_name] = sp.last_name;
    if (colMap.name !== -1) newRow[colMap.name] = sp.name;
    if (colMap.dept !== -1) newRow[colMap.dept] = r.dept || "";
    if (colMap.role !== -1) newRow[colMap.role] = r.role || "user";
    if (colMap.password !== -1) newRow[colMap.password] = r.password || "123456";
    if (colMap.status !== -1) newRow[colMap.status] = r.status || "active";
    if (colMap.remark !== -1) newRow[colMap.remark] = r.remark || "";
    if (colMap.updated_at !== -1) newRow[colMap.updated_at] = timestamp;
    sheet.appendRow(newRow);
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "User role saved" });
}

// UserRoles: บันทึกแบบชุดความเร็วสูง (Batch Save) บันทึก 170+ รายการในคำขอเดียว ไม่ติด Lock/Concurrency Limit
function handleSaveUserRolesBatch(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("UserRoles");
  if (!sheet) {
    sheet = ss.insertSheet("UserRoles");
    sheet.appendRow(["email", "first_name", "last_name", "dept", "role", "password", "status", "remark", "updated_at"]);
  }
  ensureUserRolesSchema(sheet);
  var list = data.rolesList || [];
  if (!Array.isArray(list) || list.length === 0) {
    return jsonResponse({ status: "success", count: 0, message: "No data to save" });
  }

  var values = sheet.getDataRange().getValues();
  var colMap = getUserRolesColumnMap(values[0]);
  var numCols = values[0].length;
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+7", "dd/MM/yyyy, HH:mm:ss");

  // Lookup existing row indices in memory by email
  var emailRowMap = {};
  for (var r = 1; r < values.length; r++) {
    var em = String(values[r][colMap.email] || "").trim().toLowerCase();
    if (em) {
      emailRowMap[em] = r;
    }
  }

  var updatedCount = 0;
  var addedCount = 0;

  list.forEach(function(u) {
    if (!u) return;
    var em = String(u.email || "").trim().toLowerCase();
    if (!em) return;
    var sp = splitGASName(u.name || em.split("@")[0], u.first_name, u.last_name);

    if (emailRowMap.hasOwnProperty(em)) {
      var rIdx = emailRowMap[em];
      if (colMap.first_name !== -1) values[rIdx][colMap.first_name] = sp.first_name;
      if (colMap.last_name !== -1) values[rIdx][colMap.last_name] = sp.last_name;
      if (colMap.name !== -1) values[rIdx][colMap.name] = sp.name;
      if (colMap.dept !== -1 && u.dept !== undefined) values[rIdx][colMap.dept] = u.dept;
      if (colMap.role !== -1 && u.role !== undefined) values[rIdx][colMap.role] = u.role;
      if (colMap.password !== -1 && u.password !== undefined) values[rIdx][colMap.password] = u.password;
      if (colMap.status !== -1 && u.status !== undefined) values[rIdx][colMap.status] = u.status;
      if (colMap.remark !== -1 && u.remark !== undefined) values[rIdx][colMap.remark] = u.remark;
      if (colMap.updated_at !== -1) values[rIdx][colMap.updated_at] = timestamp;
      updatedCount++;
    } else {
      var newRow = new Array(numCols);
      for (var k = 0; k < numCols; k++) newRow[k] = "";
      newRow[colMap.email] = em;
      if (colMap.first_name !== -1) newRow[colMap.first_name] = sp.first_name;
      if (colMap.last_name !== -1) newRow[colMap.last_name] = sp.last_name;
      if (colMap.name !== -1) newRow[colMap.name] = sp.name;
      if (colMap.dept !== -1) newRow[colMap.dept] = u.dept || "";
      if (colMap.role !== -1) newRow[colMap.role] = u.role || "user";
      if (colMap.password !== -1) newRow[colMap.password] = u.password || "123456";
      if (colMap.status !== -1) newRow[colMap.status] = u.status || "active";
      if (colMap.remark !== -1) newRow[colMap.remark] = u.remark || "";
      if (colMap.updated_at !== -1) newRow[colMap.updated_at] = timestamp;
      emailRowMap[em] = values.length;
      values.push(newRow);
      addedCount++;
    }
  });

  if (values.length > 1) {
    sheet.getRange(1, 1, values.length, numCols).setValues(values);
  }
  SpreadsheetApp.flush();

  return jsonResponse({
    status: "success",
    count: list.length,
    added: addedCount,
    updated: updatedCount,
    totalInSheet: values.length - 1,
    message: "บันทึกข้อมูลผู้ใช้งานจำนวน " + list.length + " รายการลง Google Sheets เรียบร้อยแล้ว (เพิ่ม " + addedCount + ", อัปเดต " + updatedCount + ")"
  });
}

function handleDeleteUserRole(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("UserRoles");
  if (!sheet) return jsonResponse({ status: "success" });
  var email = String(data.email || "").trim().toLowerCase();
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return jsonResponse({ status: "success" });
  var colMap = getUserRolesColumnMap(values[0]);
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][colMap.email] || "").trim().toLowerCase() === email) {
      sheet.deleteRow(i + 1);
    }
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: "success", message: "User role deleted" });
}
