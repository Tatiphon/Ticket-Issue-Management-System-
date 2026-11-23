/**
 * ============================================================================
 * TCC IT Service & Asset System - Step 6: Auto Backup Supabase -> Google Drive
 * ============================================================================
 * วิธีติดตั้งใช้งาน (ทำใน 5 นาที):
 * 1. สร้างโฟลเดอร์ชื่อ "TCC_DB_Backups" ใน Google Drive แล้วก๊อปปี้ Folder ID (รหัสหลัง /folders/)
 * 2. เปิด Google Sheet เปล่าขึ้นมา 1 ไฟล์ -> เมนู Extensions -> Apps Script
 * 3. ไปที่ Project Settings (รูปเฟือง) -> Script Properties -> เพิ่มค่าดังนี้:
 *    - SUPABASE_URL     = https://xxxxxxxxxxxx.supabase.co
 *    - SUPABASE_KEY     = <service_role secret key จาก Supabase -> Settings -> API>
 *    - BACKUP_FOLDER_ID = <Folder ID ของโฟลเดอร์ TCC_DB_Backups> (หากไม่ใส่ ระบบจะสร้าง/หาให้อัตโนมัติ)
 * 4. วางโค้ดนี้ลงใน Code.gs แล้วกด Save -> ลองกด Run ฟังก์ชัน backupSupabaseToDrive 1 ครั้งเพื่ออนุญาตสิทธิ์
 * 5. ไปที่เมนู Triggers (รูปนาฬิกา) -> Add Trigger -> เลือกฟังก์ชัน backupSupabaseToDrive
 *    - Event source: Time-driven
 *    - Type of time based trigger: Day timer
 *    - Time of day: 2am to 3am (ตี 2 - ตี 3)
 *    (หรือกด Run ฟังก์ชัน setupDailyBackupTrigger ครั้งเดียวเพื่อให้สร้าง Trigger ให้อัตโนมัติ)
 */

var BACKUP_TABLES = [
  "items",
  "logs",
  "categories",
  "departments",
  "user_roles",
  "ticket_categories",
  "internal_systems",
  "tickets",
  "knowledge_base",
  "email_settings"
];

var DEFAULT_BACKUP_FOLDER_NAME = "TCC_DB_Backups";
var RETENTION_DAYS = 30; // เก็บไฟล์สำรองย้อนหลัง 30 วัน (ลบไฟล์เก่ากว่านี้อัตโนมัติ)

function backupSupabaseToDrive() {
  var props = PropertiesService.getScriptProperties();
  var supabaseUrl = String(props.getProperty("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
  var supabaseKey = String(props.getProperty("SUPABASE_KEY") || props.getProperty("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  var folderId = String(props.getProperty("BACKUP_FOLDER_ID") || "").trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_KEY (service_role) ใน Script Properties ก่อนใช้งาน");
  }

  var rootFolder = getOrCreateBackupRootFolder_(folderId);
  var now = new Date();
  var dateStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
  var timeStr = Utilities.formatDate(now, "Asia/Bangkok", "HHmmss");
  var humanTime = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

  var snapshot = {
    backed_up_at: humanTime,
    timezone: "Asia/Bangkok (GMT+7)",
    supabase_url: supabaseUrl,
    table_counts: {},
    tables: {}
  };

  var dailyFolderName = "Backup_" + dateStr;
  var dailyFolder = getOrCreateSubFolder_(rootFolder, dailyFolderName);

  var summaryParts = [];
  var totalRows = 0;

  for (var i = 0; i < BACKUP_TABLES.length; i++) {
    var tableName = BACKUP_TABLES[i];
    var rows = fetchAllFromSupabaseTable_(supabaseUrl, supabaseKey, tableName);
    snapshot.tables[tableName] = rows;
    snapshot.table_counts[tableName] = rows.length;
    totalRows += rows.length;
    summaryParts.push(tableName + ":" + rows.length);

    // บันทึกเป็นไฟล์ CSV รายตารางในโฟลเดอร์ย่อยประจำวัน (เปิดใน Excel อ่านภาษาไทยได้ทันทีด้วย UTF-8 BOM)
    var csvContent = "\uFEFF" + convertRowsToCsv_(rows);
    upsertDriveTextFile_(dailyFolder, tableName + ".csv", csvContent, MimeType.CSV);
  }

  // บันทึกไฟล์ Snapshot JSON รวมทั้ง 10 ตาราง (สำหรับ Restore กลับได้ทั้งก้อน)
  var jsonFilename = "TCC_DB_Backup_" + dateStr + "_" + timeStr + ".json";
  var jsonFile = rootFolder.createFile(jsonFilename, JSON.stringify(snapshot, null, 2), MimeType.PLAIN_TEXT);

  // ลบไฟล์ Backup เก่าที่เกิน RETENTION_DAYS วัน
  var cleanedCount = cleanupOldBackups_(rootFolder, RETENTION_DAYS);

  // บันทึกประวัติการ Backup ลงใน Google Sheet ปัจจุบัน
  logBackupRunToSheet_({
    timestamp: humanTime,
    status: "SUCCESS",
    totalRows: totalRows,
    details: summaryParts.join(", "),
    jsonFileUrl: jsonFile.getUrl(),
    cleanedCount: cleanedCount
  });

  Logger.log("Backup completed: " + jsonFilename + " (Total rows: " + totalRows + ")");
}

function fetchAllFromSupabaseTable_(supabaseUrl, supabaseKey, tableName) {
  var allRows = [];
  var pageSize = 1000;
  var offset = 0;

  while (true) {
    var endpoint = supabaseUrl + "/rest/v1/" + encodeURIComponent(tableName) + "?select=*";
    var res = UrlFetchApp.fetch(endpoint, {
      method: "get",
      headers: {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey,
        "Range": offset + "-" + (offset + pageSize - 1),
        "Range-Unit": "items"
      },
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error("ดึงข้อมูลตาราง [" + tableName + "] ไม่สำเร็จ (HTTP " + code + "): " + res.getContentText());
    }

    var chunk = JSON.parse(res.getContentText() || "[]");
    if (!Array.isArray(chunk) || chunk.length === 0) break;

    for (var j = 0; j < chunk.length; j++) {
      allRows.push(chunk[j]);
    }
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

function convertRowsToCsv_(rows) {
  if (!rows || rows.length === 0) return "";
  var headersMap = {};
  var headers = [];
  for (var i = 0; i < rows.length; i++) {
    var keys = Object.keys(rows[i] || {});
    for (var k = 0; k < keys.length; k++) {
      if (!headersMap[keys[k]]) {
        headersMap[keys[k]] = true;
        headers.push(keys[k]);
      }
    }
  }
  var lines = [headers.map(escapeCsvCell_).join(",")];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || {};
    var cells = [];
    for (var c = 0; c < headers.length; c++) {
      var val = row[headers[c]];
      if (val !== null && val !== undefined && typeof val === "object") {
        val = JSON.stringify(val);
      }
      cells.push(escapeCsvCell_(val));
    }
    lines.push(cells.join(","));
  }
  return lines.join("\r\n");
}

function escapeCsvCell_(val) {
  if (val === null || val === undefined) return '""';
  var str = String(val).replace(/"/g, '""');
  return '"' + str + '"';
}

function getOrCreateBackupRootFolder_(folderId) {
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log("Warning: BACKUP_FOLDER_ID invalid, falling back to folder name: " + DEFAULT_BACKUP_FOLDER_NAME);
    }
  }
  var folders = DriveApp.getFoldersByName(DEFAULT_BACKUP_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DEFAULT_BACKUP_FOLDER_NAME);
}

function getOrCreateSubFolder_(parent, name) {
  var existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

function upsertDriveTextFile_(folder, filename, content, mimeType) {
  var files = folder.getFilesByName(filename);
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }
  return folder.createFile(filename, content, mimeType || MimeType.PLAIN_TEXT);
}

function cleanupOldBackups_(rootFolder, retentionDays) {
  if (!retentionDays || retentionDays <= 0) return 0;
  var cutoff = new Date().getTime() - retentionDays * 24 * 60 * 60 * 1000;
  var trashed = 0;

  var files = rootFolder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().indexOf("TCC_DB_Backup_") === 0 && f.getLastUpdated().getTime() < cutoff) {
      f.setTrashed(true);
      trashed++;
    }
  }

  var subFolders = rootFolder.getFolders();
  while (subFolders.hasNext()) {
    var sf = subFolders.next();
    if (sf.getName().indexOf("Backup_") === 0 && sf.getLastUpdated().getTime() < cutoff) {
      sf.setTrashed(true);
      trashed++;
    }
  }
  return trashed;
}

function logBackupRunToSheet_(info) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    var sheet = ss.getSheetByName("BackupLogs");
    if (!sheet) {
      sheet = ss.insertSheet("BackupLogs");
      sheet.appendRow(["Timestamp (GMT+7)", "Status", "Total Rows", "Table Counts", "JSON Backup Link", "Old Files Cleaned"]);
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#005ba6").setFontColor("#ffffff");
    }
    sheet.appendRow([
      info.timestamp,
      info.status,
      info.totalRows,
      info.details,
      info.jsonFileUrl,
      info.cleanedCount
    ]);
  } catch (e) {
    Logger.log("Sheet logging skipped: " + e);
  }
}

/**
 * รันฟังก์ชันนี้ 1 ครั้ง (ถ้าต้องการให้สคริปต์สร้าง Trigger รันอัตโนมัติทุกวันเวลา 02:00 - 03:00 น.)
 */
function setupDailyBackupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "backupSupabaseToDrive") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("backupSupabaseToDrive")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  Logger.log("Daily trigger created for backupSupabaseToDrive at 02:00-03:00.");
}
