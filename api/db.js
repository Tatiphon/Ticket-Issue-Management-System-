// Vercel Serverless Function: /api/db
// Connects both PROD and UAT environments to the same shared Supabase PostgreSQL database.
// Zero external dependencies (uses Node.js built-in fetch).

const TABLES = {
  items: process.env.SUPABASE_TABLE_ITEMS || "items",
  logs: process.env.SUPABASE_TABLE_LOGS || "logs",
  categories: process.env.SUPABASE_TABLE_CATEGORIES || "categories",
  departments: process.env.SUPABASE_TABLE_DEPARTMENTS || "departments",
  user_roles: process.env.SUPABASE_TABLE_USER_ROLES || "user_roles",
  ticket_categories: process.env.SUPABASE_TABLE_TICKET_CATEGORIES || "ticket_categories",
  internal_systems: process.env.SUPABASE_TABLE_INTERNAL_SYSTEMS || "internal_systems",
  tickets: process.env.SUPABASE_TABLE_TICKETS || "tickets",
  knowledge_base: process.env.SUPABASE_TABLE_KNOWLEDGE_BASE || "knowledge_base",
  email_settings: process.env.SUPABASE_TABLE_EMAIL_SETTINGS || "email_settings"
};

function getSupabaseConfig() {
  const url = String(
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim().replace(/\/+$/, "");

  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  return { url, key };
}

function getBangkokDateParts(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(d);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = map.hour === "24" ? "00" : map.hour;
  return {
    yyyy: map.year,
    mm: map.month,
    dd: map.day,
    hh: hour,
    min: map.minute,
    ss: map.second,
    ymd: `${map.year}-${map.month}-${map.day}`,
    ymdhms: `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}`,
    dmyhms: `${map.day}/${map.month}/${map.year}, ${hour}:${map.minute}:${map.second}`
  };
}

function safeJsonParse(val, fallback) {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(String(val));
  } catch (_) {
    return fallback;
  }
}

function sanitizeDrivePair(urlVal, fileIdVal) {
  let cleanUrl = String(urlVal || "").trim();
  let cleanId = String(fileIdVal || "").trim();
  if (cleanId.startsWith("DRV_")) cleanId = "";
  if (cleanUrl.includes("/file/d/DRV_")) cleanUrl = "";
  return { url: cleanUrl, fileId: cleanId };
}

function splitName(fullName, firstName, lastName) {
  const fn = String(firstName || "").trim();
  const ln = String(lastName || "").trim();
  if (fn || ln) {
    return { first_name: fn, last_name: ln, name: [fn, ln].filter(Boolean).join(" ").trim() };
  }
  const raw = String(fullName || "").trim();
  if (!raw) return { first_name: "", last_name: "", name: "" };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "", name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" "), name: raw };
}

async function sbFetch(cfg, path, options = {}) {
  const method = options.method || "GET";
  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = text; }
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.hint)) || `Supabase HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data && data.code;
    err.details = data;
    throw err;
  }
  return { data, headers: res.headers };
}

async function sbFetchAll(cfg, table, queryParams = "select=*") {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data } = await sbFetch(cfg, `${table}?${queryParams}`, {
      method: "GET",
      headers: {
        Range: `${offset}-${offset + pageSize - 1}`,
        "Range-Unit": "items"
      }
    });
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function sbFetchTableSafe(cfg, table, orderedQuery, fallbackQuery = "select=*") {
  try {
    return await sbFetchAll(cfg, table, orderedQuery);
  } catch (err) {
    if (err.code === "42703" || String(err.message || "").includes("column")) {
      return await sbFetchAll(cfg, table, fallbackQuery);
    }
    throw err;
  }
}

async function sbCountTable(cfg, table) {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}?select=*`, {
      method: "HEAD",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Prefer: "count=exact"
      }
    });
    if (!res.ok) return null;
    const range = res.headers.get("content-range") || "";
    const parts = range.split("/");
    return parts.length === 2 ? parseInt(parts[1], 10) : null;
  } catch (_) {
    return null;
  }
}

async function handleCheckDbSetup(cfg, envName) {
  const counts = {};
  const entries = await Promise.all(
    Object.entries(TABLES).map(async ([key, tableName]) => [key, await sbCountTable(cfg, tableName)])
  );
  for (const [k, v] of entries) counts[k] = v;

  let host = "";
  try { host = new URL(cfg.url).host; } catch (_) { host = cfg.url; }

  return {
    status: "success",
    connected: true,
    database: "supabase",
    environment: envName,
    supabaseHost: host,
    tables: counts
  };
}

async function handleGetInitialData(cfg) {
  const [
    rawItems,
    rawLogs,
    rawCategories,
    rawDepartments,
    rawUserRoles,
    rawTicketCats,
    rawInternalSys,
    rawTickets,
    rawKb,
    rawEmailSettings
  ] = await Promise.all([
    sbFetchTableSafe(cfg, TABLES.items, "select=*&order=item_id.asc"),
    sbFetchTableSafe(cfg, TABLES.logs, "select=*&order=trans_id.desc"),
    sbFetchTableSafe(cfg, TABLES.categories, "select=*"),
    sbFetchTableSafe(cfg, TABLES.departments, "select=*"),
    sbFetchTableSafe(cfg, TABLES.user_roles, "select=*"),
    sbFetchTableSafe(cfg, TABLES.ticket_categories, "select=*&order=sort_order.asc"),
    sbFetchTableSafe(cfg, TABLES.internal_systems, "select=*&order=sort_order.asc"),
    sbFetchTableSafe(cfg, TABLES.tickets, "select=*&order=created_at.desc"),
    sbFetchTableSafe(cfg, TABLES.knowledge_base, "select=*&order=kb_id.asc"),
    sbFetchTableSafe(cfg, TABLES.email_settings, "select=*")
  ]);

  const items = rawItems
    .filter((r) => r && r.item_id)
    .map((r) => ({
      item_id: String(r.item_id || ""),
      item_name: String(r.item_name || ""),
      category: String(r.category || ""),
      serial_number: String(r.serial_number || ""),
      status: String(r.status || "Available"),
      image_name: String(r.image_name || ""),
      image_url: String(r.image_url || ""),
      drive_file_id: String(r.drive_file_id || "")
    }));

  const allLogs = [];
  const activeBorrows = [];
  for (const r of rawLogs) {
    if (!r || !r.trans_id) continue;
    const transObj = {
      trans_id: String(r.trans_id || ""),
      timestamp: String(r.timestamp || ""),
      item_id: String(r.item_id || ""),
      borrower_name: String(r.borrower_name || ""),
      borrower_dept: String(r.borrower_dept ?? r.department ?? ""),
      borrower_contact: String(r.borrower_contact ?? r.contact ?? ""),
      borrow_date: String(r.borrow_date || ""),
      expected_return: String(r.expected_return || ""),
      actual_return: String(r.actual_return || ""),
      trans_status: String(r.trans_status ?? r.status ?? "Borrowed"),
      notes: String(r.notes || "")
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

  const categories = rawCategories
    .map((r) => String(r.category_name ?? r.name ?? "").trim())
    .filter(Boolean);

  const departments = rawDepartments
    .map((r) => String(r.department_name ?? r.name ?? "").trim())
    .filter(Boolean);

  const userRoles = rawUserRoles
    .filter((r) => r && r.email)
    .map((r) => {
      const em = String(r.email || "").trim();
      const sp = splitName(r.name || em.split("@")[0], r.first_name, r.last_name);
      return {
        email: em,
        first_name: sp.first_name,
        last_name: sp.last_name,
        name: sp.name || em.split("@")[0],
        dept: String(r.dept || "").trim(),
        role: String(r.role || "user").trim(),
        password: String(r.password || "123456").trim(),
        status: String(r.status || "active").trim(),
        remark: String(r.remark || "").trim()
      };
    });

  const ticketCategories = rawTicketCats
    .map((r) => String(r.category_name ?? r.name ?? "").trim())
    .filter(Boolean);

  const internalSystems = rawInternalSys
    .map((r) => String(r.system_name ?? r.name ?? "").trim())
    .filter(Boolean);

  const tickets = rawTickets
    .filter((r) => r && r.ticket_id)
    .map((r) => {
      const comms = safeJsonParse(r.comments ?? r.comments_json, []);
      const atts = safeJsonParse(r.attachments ?? r.attachments_json, []);
      return {
        ticket_id: String(r.ticket_id || ""),
        title: String(r.title || ""),
        category: String(r.category || ""),
        priority: String(r.priority || "Medium"),
        status: String(r.status || "Open"),
        reporter_name: String(r.reporter_name || ""),
        reporter_dept: String(r.reporter_dept || ""),
        reporter_contact: String(r.reporter_contact || ""),
        description: String(r.description || ""),
        created_at: String(r.created_at || ""),
        sla_target: String(r.sla_target || ""),
        assigned_agent: String(r.assigned_agent || ""),
        resolved_at: String(r.resolved_at || ""),
        csat_score: parseInt(r.csat_score, 10) || 0,
        csat_feedback: String(r.csat_feedback || ""),
        attachment_name: String(r.attachment_name || ""),
        comments: Array.isArray(comms) ? comms : [],
        attachment_url: String(r.attachment_url || ""),
        drive_file_id: String(r.drive_file_id || ""),
        system_name: String(r.system_name || ""),
        description_html: String(r.description_html || ""),
        attachments: Array.isArray(atts) ? atts : []
      };
    });

  const knowledgeBase = rawKb
    .filter((r) => r && r.kb_id)
    .map((r) => ({
      kb_id: String(r.kb_id || ""),
      category: String(r.category || ""),
      title: String(r.title || ""),
      content: String(r.content || ""),
      doc_url: String(r.doc_url || ""),
      attachment_name: String(r.attachment_name || ""),
      attachment_base64: String(r.attachment_base64 || ""),
      attachment_url: String(r.attachment_url || ""),
      drive_file_id: String(r.drive_file_id || "")
    }));

  let emailNotifyEnabled = true;
  let emailConfig = null;
  let emailTemplates = null;
  for (const r of rawEmailSettings) {
    const key = String(r.setting_key || "").trim();
    const val = r.json_value;
    if (!key || val === undefined || val === null) continue;
    if (key === "emailNotifyEnabled") {
      if (typeof val === "boolean") emailNotifyEnabled = val;
      else if (val === "false") emailNotifyEnabled = false;
      else if (val === "true") emailNotifyEnabled = true;
      else emailNotifyEnabled = Boolean(safeJsonParse(val, true));
    } else if (key === "emailConfig") {
      emailConfig = safeJsonParse(val, null);
    } else if (key === "emailTemplates") {
      emailTemplates = safeJsonParse(val, null);
    }
  }

  return {
    status: "success",
    backend: "supabase",
    items,
    activeBorrows,
    allLogs,
    categories,
    departments,
    userRoles,
    ticketCategories,
    internalSystems,
    tickets,
    knowledgeBase,
    emailNotifyEnabled,
    emailConfig,
    emailTemplates
  };
}

async function handleBorrowItem(cfg, data) {
  const itemIds = Array.isArray(data.itemIds)
    ? data.itemIds
    : (data.itemId ? [data.itemId] : []);
  if (itemIds.length === 0) {
    return { status: "error", message: "No itemIds provided" };
  }

  const now = getBangkokDateParts();
  let maxSeq = 0;
  if (!Array.isArray(data.transIds) || data.transIds.length === 0) {
    const prefixYear = `ITB-${now.yyyy}-`;
    const existingLogs = await sbFetchAll(cfg, TABLES.logs, `select=trans_id&trans_id=like.${encodeURIComponent(prefixYear + "*")}`);
    for (const row of existingLogs) {
      const m = String(row.trans_id || "").match(/^ITB-\d{4}-\d{2}-\d{2}-(\d{4})/);
      if (m) {
        const seq = parseInt(m[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
  }

  const logRows = [];
  for (let k = 0; k < itemIds.length; k++) {
    const itemId = String(itemIds[k] || "").trim();
    if (!itemId) continue;
    await sbFetch(cfg, `${TABLES.items}?item_id=eq.${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: { status: "Borrowed" }
    });
    const transId = (Array.isArray(data.transIds) && data.transIds[k])
      ? String(data.transIds[k]).trim()
      : `ITB-${now.ymd}-${String(maxSeq + k + 1).padStart(4, "0")}`;
    logRows.push({
      trans_id: transId,
      timestamp: now.ymdhms,
      item_id: itemId,
      borrower_name: String(data.borrowerName || ""),
      borrower_dept: String(data.dept || ""),
      borrower_contact: String(data.contact || ""),
      borrow_date: String(data.borrowDate || now.ymd),
      expected_return: String(data.expectedReturn || ""),
      actual_return: "",
      trans_status: "Borrowed",
      notes: String(data.notes || "")
    });
  }

  if (logRows.length > 0) {
    await sbFetch(cfg, `${TABLES.logs}?on_conflict=trans_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: logRows
    });
  }

  return { status: "success", message: "บันทึกการยืมลง Supabase เรียบร้อย" };
}

async function handleReturnItem(cfg, data) {
  const targetTransList = Array.isArray(data.transIds)
    ? data.transIds
    : (data.transId ? [data.transId] : []);
  const nowStr = getBangkokDateParts().ymdhms;

  for (const rawTid of targetTransList) {
    const tid = String(rawTid || "").trim();
    if (!tid) continue;
    const { data: updatedLogs } = await sbFetch(
      cfg,
      `${TABLES.logs}?trans_id=eq.${encodeURIComponent(tid)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: { trans_status: "Returned", actual_return: nowStr }
      }
    );
    if (Array.isArray(updatedLogs)) {
      for (const l of updatedLogs) {
        if (l.item_id) {
          await sbFetch(
            cfg,
            `${TABLES.items}?item_id=eq.${encodeURIComponent(l.item_id)}`,
            { method: "PATCH", body: { status: "Available" } }
          );
        }
      }
    }
  }
  return { status: "success", message: "รับคืนอุปกรณ์และอัปเดต Supabase เรียบร้อย" };
}

async function handleUpdateHistoryLog(cfg, data) {
  const u = data.updates || data.logData || {};
  const tid = String(data.transId || u.trans_id || "").trim();
  if (!tid) return { status: "error", message: "No transId provided" };

  const patch = {};
  if (u.borrower_name !== undefined) patch.borrower_name = String(u.borrower_name);
  if (u.borrower_dept !== undefined) patch.borrower_dept = String(u.borrower_dept);
  if (u.borrower_contact !== undefined) patch.borrower_contact = String(u.borrower_contact);
  if (u.borrow_date !== undefined) patch.borrow_date = String(u.borrow_date);
  if (u.expected_return !== undefined) patch.expected_return = String(u.expected_return);
  if (u.actual_return !== undefined) patch.actual_return = String(u.actual_return);
  if (u.trans_status !== undefined) patch.trans_status = String(u.trans_status);
  if (u.notes !== undefined) patch.notes = String(u.notes);

  if (Object.keys(patch).length > 0) {
    await sbFetch(cfg, `${TABLES.logs}?trans_id=eq.${encodeURIComponent(tid)}`, {
      method: "PATCH",
      body: patch
    });
  }
  return { status: "success", message: "แก้ไขประวัติใน Supabase เรียบร้อย" };
}

async function handleAddItem(cfg, data) {
  const itemId = String(data.itemId || "").trim();
  if (!itemId) return { status: "error", message: "No itemId provided" };
  const cleanDrive = sanitizeDrivePair(data.imageUrl, data.driveFileId);
  const category = String(data.category || "").trim();

  await sbFetch(cfg, `${TABLES.items}?on_conflict=item_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [{
      item_id: itemId,
      item_name: String(data.itemName || ""),
      category,
      serial_number: String(data.serialNumber || ""),
      status: String(data.status || "Available"),
      image_name: String(data.imageName || ""),
      image_url: cleanDrive.url,
      drive_file_id: cleanDrive.fileId
    }]
  });

  if (category) {
    try {
      await sbFetch(cfg, `${TABLES.categories}?on_conflict=category_name`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: [{ category_name: category }]
      });
    } catch (_) {}
  }

  return {
    status: "success",
    message: "เพิ่มอุปกรณ์ลง Supabase เรียบร้อย",
    image_url: cleanDrive.url,
    drive_file_id: cleanDrive.fileId
  };
}

async function handleUpdateItem(cfg, data) {
  const itemId = String(data.itemId || "").trim();
  if (!itemId) return { status: "error", message: "No itemId provided" };
  const cleanDrive = sanitizeDrivePair(data.imageUrl, data.driveFileId);

  const patch = {};
  if (data.itemName !== undefined) patch.item_name = String(data.itemName);
  if (data.category !== undefined) patch.category = String(data.category);
  if (data.serialNumber !== undefined) patch.serial_number = String(data.serialNumber);
  if (data.status !== undefined) patch.status = String(data.status);
  if (data.imageName !== undefined) patch.image_name = String(data.imageName);
  if (data.imageUrl !== undefined) patch.image_url = cleanDrive.url;
  if (data.driveFileId !== undefined) patch.drive_file_id = cleanDrive.fileId;

  if (Object.keys(patch).length > 0) {
    await sbFetch(cfg, `${TABLES.items}?item_id=eq.${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: patch
    });
  }

  return {
    status: "success",
    message: "อัปเดตอุปกรณ์ใน Supabase เรียบร้อย",
    image_url: cleanDrive.url,
    drive_file_id: cleanDrive.fileId
  };
}

async function handleAddDepartment(cfg, data) {
  const name = String(data.deptName || "").trim();
  if (!name) return { status: "error", message: "No deptName provided" };
  await sbFetch(cfg, `${TABLES.departments}?on_conflict=department_name`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: [{ department_name: name }]
  });
  return { status: "success", message: "เพิ่มแผนกลง Supabase เรียบร้อย" };
}

async function handleUpdateDepartment(cfg, data) {
  const oldName = String(data.oldName || "").trim();
  const newName = String(data.newName || "").trim();
  if (!oldName || !newName) return { status: "error", message: "Missing department names" };
  await sbFetch(cfg, `${TABLES.departments}?department_name=eq.${encodeURIComponent(oldName)}`, {
    method: "PATCH",
    body: { department_name: newName }
  });
  return { status: "success", message: "แก้ไขแผนกใน Supabase เรียบร้อย" };
}

async function handleDeleteDepartment(cfg, data) {
  const name = String(data.deptName || "").trim();
  if (!name) return { status: "success" };
  await sbFetch(cfg, `${TABLES.departments}?department_name=eq.${encodeURIComponent(name)}`, {
    method: "DELETE"
  });
  return { status: "success", message: "ลบแผนกจาก Supabase เรียบร้อย" };
}

async function replaceOrderedLookupList(cfg, table, colName, list) {
  const cleanList = Array.from(
    new Set((Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter(Boolean))
  );
  // Delete all existing rows then insert ordered rows
  await sbFetch(cfg, `${table}?${colName}=neq.__never_match__`, { method: "DELETE" });
  if (cleanList.length === 0) return;
  const rowsWithOrder = cleanList.map((val, idx) => ({ [colName]: val, sort_order: idx + 1 }));
  try {
    await sbFetch(cfg, table, { method: "POST", body: rowsWithOrder });
  } catch (err) {
    if (err.code === "42703" || String(err.message || "").includes("sort_order")) {
      const rowsBasic = cleanList.map((val) => ({ [colName]: val }));
      await sbFetch(cfg, table, { method: "POST", body: rowsBasic });
    } else {
      throw err;
    }
  }
}

async function handleSaveTicketCategoriesOrder(cfg, data) {
  await replaceOrderedLookupList(cfg, TABLES.ticket_categories, "category_name", data.categoriesList);
  return { status: "success", message: "บันทึกลำดับหมวดหมู่ปัญหาลง Supabase เรียบร้อย" };
}

async function handleAddTicketCategory(cfg, data) {
  if (Array.isArray(data.categoriesList) && data.categoriesList.length > 0) {
    return handleSaveTicketCategoriesOrder(cfg, data);
  }
  const name = String(data.categoryName || "").trim();
  if (!name) return { status: "error", message: "No categoryName provided" };
  await sbFetch(cfg, `${TABLES.ticket_categories}?on_conflict=category_name`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: [{ category_name: name }]
  });
  return { status: "success", message: "เพิ่มหมวดหมู่ลง Supabase เรียบร้อย" };
}

async function handleUpdateTicketCategory(cfg, data) {
  if (Array.isArray(data.categoriesList) && data.categoriesList.length > 0) {
    return handleSaveTicketCategoriesOrder(cfg, data);
  }
  const oldName = String(data.oldName || "").trim();
  const newName = String(data.newName || "").trim();
  if (oldName && newName) {
    await sbFetch(cfg, `${TABLES.ticket_categories}?category_name=eq.${encodeURIComponent(oldName)}`, {
      method: "PATCH",
      body: { category_name: newName }
    });
  }
  return { status: "success", message: "แก้ไขหมวดหมู่ใน Supabase เรียบร้อย" };
}

async function handleDeleteTicketCategory(cfg, data) {
  if (Array.isArray(data.categoriesList)) {
    return handleSaveTicketCategoriesOrder(cfg, data);
  }
  const name = String(data.categoryName || "").trim();
  if (name) {
    await sbFetch(cfg, `${TABLES.ticket_categories}?category_name=eq.${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
  }
  return { status: "success", message: "ลบหมวดหมู่จาก Supabase เรียบร้อย" };
}

async function handleSaveInternalSystemsOrder(cfg, data) {
  await replaceOrderedLookupList(cfg, TABLES.internal_systems, "system_name", data.systemsList);
  return { status: "success", message: "บันทึกลำดับระบบสารสนเทศลง Supabase เรียบร้อย" };
}

async function handleAddInternalSystem(cfg, data) {
  if (Array.isArray(data.systemsList) && data.systemsList.length > 0) {
    return handleSaveInternalSystemsOrder(cfg, data);
  }
  const name = String(data.systemName || "").trim();
  if (!name) return { status: "error", message: "No systemName provided" };
  await sbFetch(cfg, `${TABLES.internal_systems}?on_conflict=system_name`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: [{ system_name: name }]
  });
  return { status: "success", message: "เพิ่มชื่อระบบสารสนเทศลง Supabase เรียบร้อย" };
}

async function handleUpdateInternalSystem(cfg, data) {
  if (Array.isArray(data.systemsList) && data.systemsList.length > 0) {
    return handleSaveInternalSystemsOrder(cfg, data);
  }
  const oldName = String(data.oldName || "").trim();
  const newName = String(data.newName || "").trim();
  if (oldName && newName) {
    await sbFetch(cfg, `${TABLES.internal_systems}?system_name=eq.${encodeURIComponent(oldName)}`, {
      method: "PATCH",
      body: { system_name: newName }
    });
  }
  return { status: "success", message: "แก้ไขชื่อระบบสารสนเทศใน Supabase เรียบร้อย" };
}

async function handleDeleteInternalSystem(cfg, data) {
  if (Array.isArray(data.systemsList)) {
    return handleSaveInternalSystemsOrder(cfg, data);
  }
  const name = String(data.systemName || "").trim();
  if (name) {
    await sbFetch(cfg, `${TABLES.internal_systems}?system_name=eq.${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
  }
  return { status: "success", message: "ลบชื่อระบบสารสนเทศจาก Supabase เรียบร้อย" };
}

function buildUserRoleRow(r, timestamp) {
  const email = String(r.email || "").trim().toLowerCase();
  if (!email) return null;
  const sp = splitName(r.name || email.split("@")[0], r.first_name, r.last_name);
  return {
    email,
    first_name: sp.first_name,
    last_name: sp.last_name,
    dept: String(r.dept !== undefined ? r.dept : (r.department || "")).trim(),
    role: String(r.role || "user").trim(),
    password: String(r.password || "123456").trim(),
    status: String(r.status || "active").trim(),
    remark: String(r.remark || "").trim(),
    updated_at: timestamp
  };
}

async function handleSaveUserRole(cfg, data) {
  const timestamp = getBangkokDateParts().dmyhms;
  const row = buildUserRoleRow(data.roleData || {}, timestamp);
  if (!row) return { status: "error", message: "No email provided" };

  await sbFetch(cfg, `${TABLES.user_roles}?on_conflict=email`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [row]
  });
  return { status: "success", message: "บันทึกสิทธิ์ผู้ใช้งานลง Supabase เรียบร้อย" };
}

async function handleSaveUserRolesBatch(cfg, data) {
  const list = Array.isArray(data.rolesList) ? data.rolesList : [];
  if (list.length === 0) {
    return { status: "success", count: 0, message: "No data to save" };
  }
  const timestamp = getBangkokDateParts().dmyhms;
  const dedupMap = new Map();
  for (const u of list) {
    if (!u) continue;
    const row = buildUserRoleRow(u, timestamp);
    if (row) dedupMap.set(row.email, row);
  }
  const rows = Array.from(dedupMap.values());
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await sbFetch(cfg, `${TABLES.user_roles}?on_conflict=email`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: chunk
    });
  }
  return {
    status: "success",
    count: rows.length,
    message: `บันทึกข้อมูลผู้ใช้งานจำนวน ${rows.length} รายการลง Supabase เรียบร้อยแล้ว`
  };
}

async function handleDeleteUserRole(cfg, data) {
  const email = String(data.email || "").trim().toLowerCase();
  if (!email) return { status: "success" };
  await sbFetch(cfg, `${TABLES.user_roles}?email=ilike.${encodeURIComponent(email)}`, {
    method: "DELETE"
  });
  return { status: "success", message: "ลบผู้ใช้งานจาก Supabase เรียบร้อย" };
}

function cleanAttachmentList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((att) => {
    const a = { ...att };
    const clean = sanitizeDrivePair(a.url || a.driveUrl, a.drive_file_id || a.driveFileId);
    if (a.url !== undefined || a.driveUrl !== undefined) {
      if (a.driveUrl !== undefined) a.driveUrl = clean.url;
      else a.url = clean.url;
    }
    if (a.drive_file_id !== undefined || a.driveFileId !== undefined) {
      if (a.driveFileId !== undefined) a.driveFileId = clean.fileId;
      else a.drive_file_id = clean.fileId;
    }
    if (clean.fileId || clean.url) {
      delete a.base64;
    }
    return a;
  });
}

async function handleCreateTicket(cfg, data) {
  const t = data.ticketData || {};
  const ticketId = String(t.ticket_id || "").trim();
  if (!ticketId) return { status: "error", message: "No ticket_id provided" };

  const cleanDrive = sanitizeDrivePair(t.attachment_url, t.drive_file_id);
  const attachments = cleanAttachmentList(t.attachments);
  const comments = Array.isArray(t.comments)
    ? t.comments.map((c) => ({
        ...c,
        attachments: Array.isArray(c.attachments) ? cleanAttachmentList(c.attachments) : undefined
      }))
    : [];

  await sbFetch(cfg, `${TABLES.tickets}?on_conflict=ticket_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [{
      ticket_id: ticketId,
      title: String(t.title || ""),
      category: String(t.category || ""),
      priority: String(t.priority || "Medium"),
      status: String(t.status || "Open"),
      reporter_name: String(t.reporter_name || ""),
      reporter_dept: String(t.reporter_dept || ""),
      reporter_contact: String(t.reporter_contact || ""),
      description: String(t.description || ""),
      created_at: String(t.created_at || getBangkokDateParts().ymdhms),
      sla_target: String(t.sla_target || ""),
      assigned_agent: String(t.assigned_agent || ""),
      resolved_at: String(t.resolved_at || ""),
      csat_score: parseInt(t.csat_score, 10) || 0,
      csat_feedback: String(t.csat_feedback || ""),
      attachment_name: String(t.attachment_name || ""),
      comments,
      attachment_url: cleanDrive.url,
      drive_file_id: cleanDrive.fileId,
      system_name: String(t.system_name || ""),
      description_html: String(t.description_html || ""),
      attachments
    }]
  });

  return {
    status: "success",
    message: "บันทึกเคสแจ้งซ่อมลง Supabase เรียบร้อย",
    ticket_id: ticketId,
    attachment_url: cleanDrive.url,
    drive_file_id: cleanDrive.fileId
  };
}

async function handleUpdateTicket(cfg, data) {
  const tid = String(data.ticketId || "").trim();
  if (!tid) return { status: "error", message: "No ticketId provided" };
  const u = data.updates || {};
  const patch = {};

  if (u.status !== undefined) patch.status = String(u.status);
  if (u.assigned_agent !== undefined) patch.assigned_agent = String(u.assigned_agent);
  if (u.resolved_at !== undefined) patch.resolved_at = String(u.resolved_at);
  if (u.csat_score !== undefined) patch.csat_score = parseInt(u.csat_score, 10) || 0;
  if (u.csat_feedback !== undefined) patch.csat_feedback = String(u.csat_feedback);
  if (u.system_name !== undefined) patch.system_name = String(u.system_name);
  if (u.description_html !== undefined) patch.description_html = String(u.description_html);
  if (u.attachment_name !== undefined) patch.attachment_name = String(u.attachment_name);
  if (u.attachment_url !== undefined || u.drive_file_id !== undefined) {
    const clean = sanitizeDrivePair(u.attachment_url, u.drive_file_id);
    if (u.attachment_url !== undefined) patch.attachment_url = clean.url;
    if (u.drive_file_id !== undefined) patch.drive_file_id = clean.fileId;
  }
  if (u.comments !== undefined) {
    patch.comments = Array.isArray(u.comments)
      ? u.comments.map((c) => ({
          ...c,
          attachments: Array.isArray(c.attachments) ? cleanAttachmentList(c.attachments) : undefined
        }))
      : u.comments;
  }
  if (u.attachments !== undefined) {
    patch.attachments = cleanAttachmentList(u.attachments);
  }

  if (Object.keys(patch).length > 0) {
    await sbFetch(cfg, `${TABLES.tickets}?ticket_id=eq.${encodeURIComponent(tid)}`, {
      method: "PATCH",
      body: patch
    });
  }
  return { status: "success", message: "อัปเดตเคสใน Supabase เรียบร้อย" };
}

async function handleSaveKbArticle(cfg, data) {
  const k = data.articleData || {};
  const kbId = String(k.kb_id || "").trim();
  if (!kbId) return { status: "error", message: "No kb_id provided" };

  const cleanDrive = sanitizeDrivePair(k.attachment_url, k.drive_file_id);
  const safeBase64 = cleanDrive.fileId ? "" : (String(k.attachment_base64 || "").length < 150000 ? String(k.attachment_base64 || "") : "");

  await sbFetch(cfg, `${TABLES.knowledge_base}?on_conflict=kb_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [{
      kb_id: kbId,
      category: String(k.category || ""),
      title: String(k.title || ""),
      content: String(k.content || ""),
      doc_url: String(k.doc_url || cleanDrive.url || ""),
      attachment_name: String(k.attachment_name || ""),
      attachment_base64: safeBase64,
      attachment_url: cleanDrive.url,
      drive_file_id: cleanDrive.fileId
    }]
  });

  return {
    status: "success",
    message: "บันทึกบทความคลังความรู้ลง Supabase เรียบร้อย",
    attachment_url: cleanDrive.url,
    drive_file_id: cleanDrive.fileId
  };
}

async function handleDeleteKbArticle(cfg, data) {
  const kid = String(data.kbId || "").trim();
  if (kid) {
    await sbFetch(cfg, `${TABLES.knowledge_base}?kb_id=eq.${encodeURIComponent(kid)}`, {
      method: "DELETE"
    });
  }
  return { status: "success", message: "ลบบทความจาก Supabase เรียบร้อย" };
}

async function handleSaveEmailSettings(cfg, data) {
  const nowStr = getBangkokDateParts().ymdhms;
  const rows = [];

  if (data.emailNotifyEnabled !== undefined) {
    rows.push({
      setting_key: "emailNotifyEnabled",
      json_value: Boolean(data.emailNotifyEnabled),
      updated_at: nowStr
    });
  }
  if (data.emailConfig !== undefined) {
    const cleanCfg = JSON.parse(JSON.stringify(data.emailConfig || {}));
    const passToSave = String(data.smtpPass || cleanCfg.smtpPass || "").replace(/\s+/g, "").trim();
    if (passToSave) cleanCfg.smtpPass = passToSave;
    cleanCfg.senderEmail = "itsupport@thaichamber.or.th";
    if (!cleanCfg.senderAlias || cleanCfg.senderAlias === "tatitop07@gmail.com") {
      cleanCfg.senderAlias = "itsupport@thaichamber.or.th";
    }
    if (!cleanCfg.replyTo || cleanCfg.replyTo === "tatitop07@gmail.com") {
      cleanCfg.replyTo = "itsupport@thaichamber.or.th";
    }
    if (cleanCfg._notifyPrefsExplicit !== true) {
      cleanCfg.notifyRequester = true;
      cleanCfg.notifyAssignedAgent = true;
      cleanCfg.notifyAdminRoles = true;
    }
    rows.push({
      setting_key: "emailConfig",
      json_value: cleanCfg,
      updated_at: nowStr
    });
  }
  if (data.emailTemplates !== undefined) {
    rows.push({
      setting_key: "emailTemplates",
      json_value: data.emailTemplates,
      updated_at: nowStr
    });
  }

  if (rows.length > 0) {
    await sbFetch(cfg, `${TABLES.email_settings}?on_conflict=setting_key`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: rows
    });
  }

  return { status: "success", message: "บันทึกการตั้งค่าอีเมลลง Supabase เรียบร้อยแล้ว" };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.key) {
    return res.status(200).json({
      status: "error",
      connected: false,
      needsSupabaseConfig: true,
      message: "ยังไม่ได้ตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน Environment Variables ของ Vercel"
    });
  }

  let data = {};
  if (req.method === "GET") {
    data = { action: (req.query && req.query.action) || "getInitialData" };
  } else if (req.method === "POST") {
    try {
      data = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    } catch (_) {
      return res.status(400).json({ status: "error", message: "Invalid JSON payload" });
    }
  } else {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  const action = String(data.action || "").trim();
  const envName = String(data.env || "unknown").toUpperCase();

  try {
    let result;
    switch (action) {
      case "checkDbSetup":
        result = await handleCheckDbSetup(cfg, envName);
        break;
      case "getInitialData":
        result = await handleGetInitialData(cfg);
        break;
      case "borrowItem":
        result = await handleBorrowItem(cfg, data);
        break;
      case "returnItem":
        result = await handleReturnItem(cfg, data);
        break;
      case "updateHistoryLog":
        result = await handleUpdateHistoryLog(cfg, data);
        break;
      case "addItem":
        result = await handleAddItem(cfg, data);
        break;
      case "updateItem":
        result = await handleUpdateItem(cfg, data);
        break;
      case "addDepartment":
        result = await handleAddDepartment(cfg, data);
        break;
      case "updateDepartment":
        result = await handleUpdateDepartment(cfg, data);
        break;
      case "deleteDepartment":
        result = await handleDeleteDepartment(cfg, data);
        break;
      case "addTicketCategory":
        result = await handleAddTicketCategory(cfg, data);
        break;
      case "updateTicketCategory":
        result = await handleUpdateTicketCategory(cfg, data);
        break;
      case "deleteTicketCategory":
        result = await handleDeleteTicketCategory(cfg, data);
        break;
      case "saveTicketCategoriesOrder":
        result = await handleSaveTicketCategoriesOrder(cfg, data);
        break;
      case "addInternalSystem":
        result = await handleAddInternalSystem(cfg, data);
        break;
      case "updateInternalSystem":
        result = await handleUpdateInternalSystem(cfg, data);
        break;
      case "deleteInternalSystem":
        result = await handleDeleteInternalSystem(cfg, data);
        break;
      case "saveInternalSystemsOrder":
        result = await handleSaveInternalSystemsOrder(cfg, data);
        break;
      case "saveUserRole":
        result = await handleSaveUserRole(cfg, data);
        break;
      case "saveUserRolesBatch":
        result = await handleSaveUserRolesBatch(cfg, data);
        break;
      case "deleteUserRole":
        result = await handleDeleteUserRole(cfg, data);
        break;
      case "createTicket":
        result = await handleCreateTicket(cfg, data);
        break;
      case "updateTicket":
        result = await handleUpdateTicket(cfg, data);
        break;
      case "saveKbArticle":
        result = await handleSaveKbArticle(cfg, data);
        break;
      case "deleteKbArticle":
        result = await handleDeleteKbArticle(cfg, data);
        break;
      case "saveEmailSettings":
        result = await handleSaveEmailSettings(cfg, data);
        break;
      default:
        return res.status(400).json({ status: "error", message: `Invalid action: ${action}` });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[api/db] Action "${action}" error:`, err);
    return res.status(500).json({
      status: "error",
      message: err.message || String(err)
    });
  }
};
