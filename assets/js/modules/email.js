function isBlockedNotificationEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return true;
  return BLOCKED_NOTIFICATION_EMAILS.includes(clean);
}

const DEFAULT_EMAIL_CONFIG = {
  transportMode: "smtp",
  senderName: "TCC IT Service & Asset System",
  senderEmail: PRIMARY_SENDER_EMAIL,
  replyTo: PRIMARY_SENDER_EMAIL,
  senderAlias: PRIMARY_SENDER_EMAIL,
  strictSenderOnly: true,
  smtpHost: "auto",
  smtpPort: "",
  smtpUser: PRIMARY_SENDER_EMAIL,
  smtpAuthUser: PRIMARY_SENDER_EMAIL,
  smtpPass: "",
  webhookUrl: "/api/send-email",
  notifyRequester: true,
  notifyAssignedAgent: true,
  notifyAdminRoles: true,
  recipients: [
    { email: "itsupport@thaichamber.or.th", name: "ฝ่ายเทคโนโลยีสารสนเทศ (IT Support Center)", scope: "all", active: true },
    { email: "tatiphon.hi@thaichamber.or.th", name: "ผู้ดูแลระบบหลัก (Super Admin)", scope: "all", active: true },
    { email: "wattanachai.mi@thaichamber.or.th", name: "เจ้าหน้าที่ไอที (Helpdesk & Asset)", scope: "all", active: true },
    { email: "supakon.su@thaichamber.or.th", name: "เจ้าหน้าที่ไอที (Network & Support)", scope: "ticket", active: true }
  ]
};

const DEFAULT_EMAIL_TEMPLATES = {
  BORROW_CREATED: {
    key: "BORROW_CREATED",
    title: "ยืมอุปกรณ์ใหม่ (Borrow Created)",
    group: "borrow",
    enabled: true,
    subject: "[TCC IT Asset] ยืนยันการยืมอุปกรณ์ {{trans_id}} ({{borrower_name}})",
    body: "เรียน คุณ{{borrower_name}} ({{borrower_dept}})\n\nระบบได้รับคำขอยืมอุปกรณ์ไอทีของท่านเรียบร้อยแล้ว โดยมีรายละเอียดดังนี้:\n• รหัสธุรกรรม: {{trans_id}}\n• รายการอุปกรณ์: {{item_names}}\n• วันที่ยืม: {{borrow_date}}\n• กำหนดส่งคืน: {{expected_return}}\n• วัตถุประสงค์ / หมายเหตุ: {{notes}}\n\nกรุณาส่งคืนอุปกรณ์ภายในวันที่กำหนด ขอบคุณครับ/ค่ะ\nฝ่ายเทคโนโลยีสารสนเทศ หอการค้าไทย",
    variables: ["{{trans_id}}", "{{item_names}}", "{{borrower_name}}", "{{borrower_dept}}", "{{borrower_contact}}", "{{borrow_date}}", "{{expected_return}}", "{{notes}}", "{{timestamp}}"],
    sampleData: {
      trans_id: "ITB-2026-11-01-0001",
      item_names: "[IT-001] Dell Latitude 5430 (i7/16GB)",
      borrower_name: "สมชาย ใจดี",
      borrower_dept: "ฝ่ายการเงินและการบัญชี",
      borrower_contact: "somchai.user@thaichamber.or.th",
      borrow_date: getOffsetDate(0),
      expected_return: getOffsetDate(3),
      notes: "ใช้ประชุมงานนอกสถานที่",
      timestamp: getLocalTimestamp(0)
    }
  },
  BORROW_RETURNED: {
    key: "BORROW_RETURNED",
    title: "ยืนยันรับคืนอุปกรณ์ (Borrow Returned)",
    group: "borrow",
    enabled: true,
    subject: "[TCC IT Asset] ยืนยันการรับคืนอุปกรณ์เรียบร้อย ({{trans_id}})",
    body: "เรียน คุณ{{borrower_name}} ({{borrower_dept}})\n\nฝ่ายเทคโนโลยีสารสนเทศได้รับคืนอุปกรณ์จากท่านเรียบร้อยแล้ว:\n• รหัสธุรกรรม: {{trans_id}}\n• รายการอุปกรณ์ที่คืน: {{item_names}}\n• วัน-เวลาที่รับคืน: {{actual_return}}\n\nขอบคุณที่ดูแลรักษาอุปกรณ์เป็นอย่างดีครับ/ค่ะ",
    variables: ["{{trans_id}}", "{{item_names}}", "{{borrower_name}}", "{{borrower_dept}}", "{{borrower_contact}}", "{{actual_return}}", "{{timestamp}}"],
    sampleData: {
      trans_id: "ITB-2026-11-01-0001",
      item_names: "[IT-001] Dell Latitude 5430 (i7/16GB)",
      borrower_name: "สมชาย ใจดี",
      borrower_dept: "ฝ่ายการเงินและการบัญชี",
      borrower_contact: "somchai.user@thaichamber.or.th",
      actual_return: getLocalTimestamp(0),
      timestamp: getLocalTimestamp(0)
    }
  },
  BORROW_UPDATED: {
    key: "BORROW_UPDATED",
    title: "แก้ไข / อัปเดตรายการยืม-คืน (Borrow Updated)",
    group: "borrow",
    enabled: true,
    subject: "[TCC IT Asset] อัปเดตข้อมูลรายการยืม-คืน {{trans_id}} ({{trans_status}})",
    body: "เรียน คุณ{{borrower_name}} ({{borrower_dept}})\n\nเจ้าหน้าที่ได้ปรับปรุงข้อมูลรายการยืม-คืนของท่านแล้ว:\n• รหัสธุรกรรม: {{trans_id}}\n• อุปกรณ์: {{item_names}}\n• สถานะล่าสุด: {{trans_status}}\n• กำหนดส่งคืน: {{expected_return}}\n• วันที่คืนจริง: {{actual_return}}\n• หมายเหตุ: {{notes}}\n\nฝ่ายเทคโนโลยีสารสนเทศ หอการค้าไทย",
    variables: ["{{trans_id}}", "{{item_names}}", "{{borrower_name}}", "{{borrower_dept}}", "{{trans_status}}", "{{borrow_date}}", "{{expected_return}}", "{{actual_return}}", "{{notes}}", "{{timestamp}}"],
    sampleData: {
      trans_id: "ITB-2026-11-01-0001",
      item_names: "[IT-001] Dell Latitude 5430 (i7/16GB)",
      borrower_name: "สมชาย ใจดี",
      borrower_dept: "ฝ่ายการเงินและการบัญชี",
      trans_status: "Returned",
      borrow_date: getOffsetDate(-2),
      expected_return: getOffsetDate(1),
      actual_return: getLocalTimestamp(0),
      notes: "ตรวจสอบสภาพสมบูรณ์ครบถ้วน",
      timestamp: getLocalTimestamp(0)
    }
  },
  TICKET_CREATED: {
    key: "TICKET_CREATED",
    title: "เปิดเคสแจ้งซ่อมใหม่ (Ticket Created)",
    group: "ticket",
    enabled: true,
    subject: "[TCC IT Helpdesk] แจ้งเปิดเคสใหม่ #{{ticket_id}}: {{title}}",
    body: "เรียน คุณ{{reporter_name}} และทีมเจ้าหน้าที่ไอที\n\nระบบได้รับแจ้งปัญหา/เปิดเคสใหม่เรียบร้อยแล้ว:\n• รหัสเคส: {{ticket_id}}\n• หัวข้อปัญหา: {{title}}\n• หมวดหมู่: {{category}} {{system_name}}\n• ระดับความสำคัญ: {{priority}} (กำหนด SLA: {{sla_target}})\n• ผู้แจ้ง: {{reporter_name}} ({{reporter_dept}})\n• รายละเอียด: {{description}}\n\nเจ้าหน้าที่จะดำเนินการตรวจสอบโดยเร็วที่สุดครับ/ค่ะ",
    variables: ["{{ticket_id}}", "{{title}}", "{{category}}", "{{system_name}}", "{{priority}}", "{{status}}", "{{reporter_name}}", "{{reporter_dept}}", "{{reporter_contact}}", "{{description}}", "{{sla_target}}", "{{assigned_agent}}", "{{timestamp}}"],
    sampleData: {
      ticket_id: "ITC-2026-11-01-0001",
      title: "ไม่สามารถเข้าใช้งานอีเมลองค์กรบนมือถือได้",
      category: "อีเมลองค์กร / บัญชีผู้ใช้งาน / รหัสผ่าน",
      system_name: "",
      priority: "High",
      status: "Open",
      reporter_name: "สมชาย ใจดี",
      reporter_dept: "ฝ่ายการเงินและการบัญชี",
      reporter_contact: "somchai.user@thaichamber.or.th",
      description: "ระบบแจ้งรหัสผ่านหมดอายุหลังจากเปลี่ยนเครื่องใหม่",
      sla_target: getLocalTimestamp(4),
      assigned_agent: "ยังไม่มอบหมาย",
      timestamp: getLocalTimestamp(0)
    }
  },
  TICKET_UPDATED: {
    key: "TICKET_UPDATED",
    title: "อัปเดตสถานะเคส (Ticket Updated)",
    group: "ticket",
    enabled: true,
    subject: "[TCC IT Helpdesk] อัปเดตสถานะเคส #{{ticket_id}} → {{status}}",
    body: "เรียน คุณ{{reporter_name}}\n\nเคสแจ้งปัญหาของคุณมีการอัปเดตสถานะจากทีมไอทีแล้ว:\n• รหัสเคส: {{ticket_id}}\n• หัวข้อ: {{title}}\n• สถานะล่าสุด: {{status}}\n• ผู้รับผิดชอบ: {{assigned_agent}}\n• บันทึกเพิ่มเติม: {{note}}\n\nท่านสามารถติดตามรายละเอียดได้ในเมนู 'เคสแจ้งซ่อมของฉัน'",
    variables: ["{{ticket_id}}", "{{title}}", "{{status}}", "{{assigned_agent}}", "{{reporter_name}}", "{{note}}", "{{resolved_at}}", "{{timestamp}}"],
    sampleData: {
      ticket_id: "ITC-2026-11-01-0001",
      title: "ไม่สามารถเข้าใช้งานอีเมลองค์กรบนมือถือได้",
      status: "Resolved",
      assigned_agent: "wattanachai.mi@thaichamber.or.th",
      reporter_name: "สมชาย ใจดี",
      note: "ดำเนินการรีเซ็ต Token และทดสอบเข้าใช้งานสำเร็จแล้ว",
      resolved_at: getLocalTimestamp(0),
      timestamp: getLocalTimestamp(0)
    }
  },
  TICKET_ASSIGNED: {
    key: "TICKET_ASSIGNED",
    title: "มอบหมายผู้รับผิดชอบเคส (Ticket Assigned)",
    group: "ticket",
    enabled: true,
    subject: "[TCC IT Helpdesk] มอบหมายเคส #{{ticket_id}} ให้ {{assigned_agent}}",
    body: "เรียน {{assigned_agent}} และคุณ{{reporter_name}}\n\nระบบได้มอบหมายผู้รับผิดชอบเคสแจ้งซ่อมเรียบร้อยแล้ว:\n• รหัสเคส: {{ticket_id}}\n• หัวข้อ: {{title}}\n• ความสำคัญ: {{priority}} (SLA: {{sla_target}})\n• ผู้แจ้ง: {{reporter_name}} ({{reporter_dept}})\n• ผู้รับผิดชอบเคส: {{assigned_agent}}",
    variables: ["{{ticket_id}}", "{{title}}", "{{priority}}", "{{status}}", "{{assigned_agent}}", "{{reporter_name}}", "{{reporter_dept}}", "{{sla_target}}", "{{timestamp}}"],
    sampleData: {
      ticket_id: "ITC-2026-11-01-0001",
      title: "ไม่สามารถเข้าใช้งานอีเมลองค์กรบนมือถือได้",
      priority: "High",
      status: "In Progress",
      assigned_agent: "Wattanachai (Admin) (wattanachai.mi@thaichamber.or.th)",
      reporter_name: "สมชาย ใจดี",
      reporter_dept: "ฝ่ายการเงินและการบัญชี",
      sla_target: getLocalTimestamp(4),
      timestamp: getLocalTimestamp(0)
    }
  },
  TICKET_COMMENT: {
    key: "TICKET_COMMENT",
    title: "ข้อความตอบกลับใหม่ในเคส (Ticket Comment)",
    group: "ticket",
    enabled: true,
    subject: "[TCC IT Helpdesk] ข้อความใหม่ในเคส #{{ticket_id}}: {{title}}",
    body: "เรียน คุณ{{reporter_name}} และผู้รับผิดชอบเคส\n\nมีการตอบกลับข้อความใหม่ในเคส #{{ticket_id}} ({{title}}):\n• จาก: {{sender}}\n• ข้อความ: {{message}}\n• สถานะเคส: {{status}}\n\nกรุณาตรวจสอบรายละเอียดและตอบกลับผ่านระบบ IT Helpdesk ครับ/ค่ะ",
    variables: ["{{ticket_id}}", "{{title}}", "{{status}}", "{{reporter_name}}", "{{assigned_agent}}", "{{sender}}", "{{message}}", "{{timestamp}}"],
    sampleData: {
      ticket_id: "ITC-2026-11-01-0001",
      title: "ไม่สามารถเข้าใช้งานอีเมลองค์กรบนมือถือได้",
      status: "In Progress",
      reporter_name: "สมชาย ใจดี",
      assigned_agent: "wattanachai.mi@thaichamber.or.th",
      sender: "Wattanachai (Admin)",
      message: "เจ้าหน้าที่ได้ทำการตรวจสอบบัญชีให้เรียบร้อยแล้ว รบกวนลองเข้าสู่ระบบใหม่อีกครั้งครับ",
      timestamp: getLocalTimestamp(0)
    }
  }
};

function sanitizeEmailConfig(parsed = {}) {
  const src = (parsed && typeof parsed === "object") ? parsed : {};
  const cleanAlias = String(src.senderAlias || src.senderEmail || "").trim().toLowerCase();
  const effectiveSender = (!cleanAlias || isBlockedNotificationEmail(cleanAlias))
    ? PRIMARY_SENDER_EMAIL
    : cleanAlias;

  const rawReply = String(src.replyTo || "").trim().toLowerCase();
  const isLegacyDefaultReply = rawReply === "tatiphon.hi@thaichamber.or.th" && !src.senderEmail;
  const effectiveReplyTo = (!rawReply || isBlockedNotificationEmail(rawReply) || isLegacyDefaultReply)
    ? effectiveSender
    : rawReply;

  const mode = ["gas_mailapp", "smtp", "webhook"].includes(src.transportMode)
    ? src.transportMode
    : "smtp";

  const rawAuthUser = String(src.smtpAuthUser || src.smtpUser || effectiveSender).trim().toLowerCase();
  const effectiveAuthUser = (!rawAuthUser || isBlockedNotificationEmail(rawAuthUser))
    ? effectiveSender
    : rawAuthUser;

  let recList = Array.isArray(src.recipients)
    ? src.recipients.map(r => ({
        email: String(r.email || "").trim().toLowerCase(),
        name: String(r.name || "").trim(),
        scope: ["all", "borrow", "ticket"].includes(r.scope) ? r.scope : "all",
        active: r.active !== false
      })).filter(r => r.email && !isBlockedNotificationEmail(r.email))
    : [...DEFAULT_EMAIL_CONFIG.recipients];

  if (!src._migratedItSupportRec && !recList.some(r => r.email === PRIMARY_SENDER_EMAIL)) {
    recList = [
      { email: PRIMARY_SENDER_EMAIL, name: "ฝ่ายเทคโนโลยีสารสนเทศ (IT Support Center)", scope: "all", active: true },
      ...recList
    ];
  }

  let savedPass = String(src.smtpPass || "").trim();
  if (!savedPass) {
    try {
      savedPass = localStorage.getItem(STORAGE_KEY_SMTP_PASS) || sessionStorage.getItem(SESSION_KEY_SMTP_PASS) || "";
    } catch (_) {}
  } else {
    try {
      localStorage.setItem(STORAGE_KEY_SMTP_PASS, savedPass);
      sessionStorage.setItem(SESSION_KEY_SMTP_PASS, savedPass);
    } catch (_) {}
  }

  const hasExplicitNotifyPrefs = src._notifyPrefsExplicit === true;
  const out = {
    ...DEFAULT_EMAIL_CONFIG,
    ...src,
    notifyRequester: hasExplicitNotifyPrefs ? (src.notifyRequester !== false) : true,
    notifyAssignedAgent: hasExplicitNotifyPrefs ? (src.notifyAssignedAgent !== false) : true,
    notifyAdminRoles: hasExplicitNotifyPrefs ? (src.notifyAdminRoles !== false) : true,
    _notifyPrefsExplicit: hasExplicitNotifyPrefs,
    transportMode: mode,
    senderName: String(src.senderName || DEFAULT_EMAIL_CONFIG.senderName).trim() || DEFAULT_EMAIL_CONFIG.senderName,
    senderEmail: effectiveSender,
    senderAlias: effectiveSender,
    replyTo: effectiveReplyTo,
    strictSenderOnly: src.strictSenderOnly !== false,
    smtpHost: String(src.smtpHost || "auto").trim() || "auto",
    smtpPort: src.smtpPort ? Number(src.smtpPort) : "",
    smtpUser: effectiveSender,
    smtpAuthUser: effectiveAuthUser,
    smtpPass: savedPass,
    webhookUrl: String(src.webhookUrl || "/api/send-email").trim() || "/api/send-email",
    recipients: recList,
    _migratedItSupportRec: true
  };
  return out;
}

function normalizeAppPassInput(raw) {
  const trimmed = String(raw || "").trim();
  if (/^[a-z0-9]{4}(\s+[a-z0-9]{4}){3}$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, "");
  }
  return trimmed;
}

function getSessionSmtpPass() {
  try {
    const el = document.getElementById("cfgEmailSmtpPass");
    if (el && el.value.trim()) return normalizeAppPassInput(el.value);
    if (state.emailConfig && state.emailConfig.smtpPass && String(state.emailConfig.smtpPass).trim()) {
      return normalizeAppPassInput(state.emailConfig.smtpPass);
    }
    return normalizeAppPassInput(localStorage.getItem(STORAGE_KEY_SMTP_PASS) || sessionStorage.getItem(SESSION_KEY_SMTP_PASS) || "");
  } catch (_) {
    return "";
  }
}

function updateSmtpPassSavedBadge() {
  const badge = document.getElementById("smtpPassSavedStatusBadge");
  if (!badge) return;
  const saved = getSessionSmtpPass();
  const authUser = state.emailConfig?.smtpAuthUser || PRIMARY_SENDER_EMAIL;
  if (saved) {
    badge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 whitespace-nowrap";
    badge.innerText = `✓ จำค่ารหัสผ่านแล้ว (${authUser})`;
  } else {
    badge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0 whitespace-nowrap";
    badge.innerText = "⚠️ ยังไม่ได้บันทึกรหัสผ่าน";
  }
}

function setSessionSmtpPass(val) {
  try {
    const clean = normalizeAppPassInput(val);
    if (clean) {
      localStorage.setItem(STORAGE_KEY_SMTP_PASS, clean);
      sessionStorage.setItem(SESSION_KEY_SMTP_PASS, clean);
      if (state.emailConfig) state.emailConfig.smtpPass = clean;
      const el = document.getElementById("cfgEmailSmtpPass");
      if (el && el.value.trim() && el.value !== clean) el.value = clean;
    }
  } catch (_) {}
  updateSmtpPassSavedBadge();
}

function getPreferredTestRecipientEmail() {
  const userMail = String(state.currentUser?.email || "").trim().toLowerCase();
  if (userMail && userMail.includes("@") && !isBlockedNotificationEmail(userMail)) {
    return userMail;
  }
  const replyMail = String(state.emailConfig?.replyTo || "").trim().toLowerCase();
  if (replyMail && replyMail.includes("@") && !isBlockedNotificationEmail(replyMail)) {
    return replyMail;
  }
  return PRIMARY_SENDER_EMAIL;
}

function loadSavedEmailConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return sanitizeEmailConfig(parsed);
      }
    }
  } catch (e) {}
  return sanitizeEmailConfig(DEFAULT_EMAIL_CONFIG);
}

function loadSavedEmailTemplates() {
  const merged = JSON.parse(JSON.stringify(DEFAULT_EMAIL_TEMPLATES));
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_TEMPLATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        Object.keys(merged).forEach(k => {
          if (parsed[k] && typeof parsed[k] === "object") {
            merged[k] = {
              ...merged[k],
              enabled: parsed[k].enabled !== undefined ? !!parsed[k].enabled : merged[k].enabled,
              subject: parsed[k].subject || merged[k].subject,
              body: parsed[k].body || merged[k].body
            };
          }
        });
      }
    }
  } catch (e) {}
  return merged;
}

function loadSavedEmailLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  if (!initialDemoMode) return [];
  return [
    {
      id: "EML-INIT-1",
      timestamp: getLocalTimestamp(-3),
      eventType: "TICKET_CREATED",
      subject: "[TCC IT Helpdesk] แจ้งเปิดเคสใหม่ #ITC-2026-10-25-0001: หน้าจอโน้ตบุ๊กกระพริบดับบางจังหวะ",
      senderEmail: PRIMARY_SENDER_EMAIL,
      recipients: ["somchai.user@thaichamber.or.th", "wattanachai.mi@thaichamber.or.th"],
      summary: "ผู้แจ้ง: สมชาย ใจดี (ฝ่ายการเงินและการบัญชี) • สถานะ: In Progress",
      status: "Sent"
    },
    {
      id: "EML-INIT-2",
      timestamp: getLocalTimestamp(-1),
      eventType: "BORROW_CREATED",
      subject: "[TCC IT Asset] ยืนยันการยืมอุปกรณ์ #ITB-2026-10-28-0002 (Rode Wireless GO II Dual Mic)",
      senderEmail: PRIMARY_SENDER_EMAIL,
      recipients: ["suwimon@thaichamber.or.th", "itsupport@thaichamber.or.th"],
      summary: "ผู้ยืม: สุวิมล แสงทอง (ฝ่ายสมาชิกสัมพันธ์และการบริการ) • กำหนดคืน: " + getOffsetDate(4),
      status: "Sent"
    }
  ];
}

state.emailConfig = loadSavedEmailConfig();
state.emailTemplates = loadSavedEmailTemplates();
state.emailLogs = loadSavedEmailLogs();

let lastFocusedTemplateFieldId = "tplBodyInput";

function resolveUserEmailAddress(contactOrName, fallbackName = "") {
  const raw = normalizeEmailDomainTypos(String(contactOrName || "").trim());
  const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    const candidate = normalizeEmailDomainTypos(emailMatch[0].toLowerCase());
    return isBlockedNotificationEmail(candidate) ? "" : candidate;
  }
  const matched = findMatchedUserInDatabase(raw) || findMatchedUserInDatabase(fallbackName);
  if (matched && matched.email && matched.email.includes("@")) {
    const candidate = normalizeEmailDomainTypos(matched.email.trim().toLowerCase());
    return isBlockedNotificationEmail(candidate) ? "" : candidate;
  }
  return "";
}

function getAdminRecipientEmails() {
  const admins = (state.userRoles || []).filter(r =>
    (r.role === "admin" || r.role === "superadmin") &&
    r.status !== "disabled" &&
    String(r.email || "").includes("@") &&
    !isBlockedNotificationEmail(r.email)
  );
  return Array.from(new Set(admins.map(a => a.email.trim().toLowerCase()))).slice(0, 10);
}

function getEmailEventGroup(eventType) {
  const s = String(eventType || "").toUpperCase();
  if (s.startsWith("BORROW_")) return "borrow";
  if (s.startsWith("TICKET_")) return "ticket";
  return "all";
}

function saveEmailConfigToStorage() {
  try {
    state.emailConfig = sanitizeEmailConfig(state.emailConfig || DEFAULT_EMAIL_CONFIG);
    localStorage.setItem(STORAGE_KEY_EMAIL_CONFIG, JSON.stringify(state.emailConfig));
  } catch (e) {}
}

function saveEmailTemplatesToStorage() {
  try {
    const compact = {};
    Object.keys(state.emailTemplates || {}).forEach(k => {
      const tpl = state.emailTemplates[k];
      compact[k] = {
        enabled: tpl.enabled !== false,
        subject: tpl.subject || "",
        body: tpl.body || ""
      };
    });
    localStorage.setItem(STORAGE_KEY_EMAIL_TEMPLATES, JSON.stringify(compact));
  } catch (e) {}
}

async function saveSmtpCredentialsAndRemember() {
  const passEl = document.getElementById("cfgEmailSmtpPass");
  const authEl = document.getElementById("cfgEmailSmtpAuthUser");
  const passVal = (passEl?.value || "").trim() || getSessionSmtpPass();
  const authVal = (authEl?.value || "").trim().toLowerCase() || PRIMARY_SENDER_EMAIL;
  if (!passVal) {
    showNotification("กรุณากรอกรหัสผ่าน หรือ App Password 16 หลักก่อนกดบันทึก", "warning");
    passEl?.focus();
    return;
  }
  setSessionSmtpPass(passVal);
  if (passEl && !passEl.value) passEl.value = passVal;
  await saveAllEmailSettingsToServer(true);
  updateSmtpPassSavedBadge();
  showNotification(`💾 บันทึกและจำค่าอีเมล (${authVal}) พร้อม App Password ในระบบเรียบร้อยแล้ว`, "success");
}

async function saveAllEmailSettingsToServer(silent = false) {
  handleEmailConfigFieldChange();
  const currentPass = getSessionSmtpPass();
  if (currentPass) {
    setSessionSmtpPass(currentPass);
    if (state.emailConfig) state.emailConfig.smtpPass = currentPass;
  }
  saveEmailConfigToStorage();
  saveEmailTemplatesToStorage();
  localStorage.setItem(STORAGE_KEY_EMAIL_ENABLED, state.emailNotifyEnabled ? "true" : "false");

  const badge = document.getElementById("cfgEmailSyncStatusBadge");
  if (badge) badge.innerText = "🔄 กำลังบันทึก...";

  const compactTemplates = {};
  Object.keys(state.emailTemplates || {}).forEach(k => {
    const t = state.emailTemplates[k];
    compactTemplates[k] = { enabled: t.enabled !== false, subject: t.subject || "", body: t.body || "" };
  });

  const res = await callAPI("saveEmailSettings", {
    emailNotifyEnabled: !!state.emailNotifyEnabled,
    emailConfig: state.emailConfig,
    emailTemplates: compactTemplates,
    smtpPass: currentPass,
    smtpAuthUser: state.emailConfig?.smtpAuthUser || PRIMARY_SENDER_EMAIL,
    smtpHost: state.emailConfig?.smtpHost || "auto",
    relayUrl: window.location.origin ? (window.location.origin + "/api/send-email") : ""
  }, true);

  updateSmtpPassSavedBadge();
  if (badge) {
    badge.innerText = res && res.status === "success"
      ? (state.isLive ? "✓ ซิงค์กับ Google Sheets แล้ว" : "✓ บันทึกในระบบเรียบร้อย")
      : "✓ บันทึกในเบราว์เซอร์แล้ว";
  }
  if (!silent) {
    showNotification(`💾 บันทึกการตั้งค่าอีเมลผู้ส่ง (${state.emailConfig?.senderAlias || PRIMARY_SENDER_EMAIL}) และจำค่า App Password เรียบร้อยแล้ว`, "success");
  }
}

function renderEmailTemplate(templateStr, vars = {}) {
  let out = String(templateStr || "");
  out = out.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const val = vars[key];
    return (val !== undefined && val !== null) ? String(val) : "";
  });
  return out.split("\n").map(line => line.replace(/ {2,}/g, " ").trimEnd()).join("\n").trim();
}

function buildNormalizedEmailVars(eventType, details = {}) {
  const transIdsStr = Array.isArray(details.transIds) ? details.transIds.join(", ") : "";
  const itemNamesStr = Array.isArray(details.itemNames) ? details.itemNames.join(", ") : "";
  const sysRaw = String(details.system_name || details.systemName || "").trim();

  return {
    trans_id: String(details.trans_id || details.transId || transIdsStr || "-"),
    item_names: String(details.item_names || details.item_name || itemNamesStr || details.item_id || "-"),
    borrower_name: String(details.borrower_name || details.borrowerName || details.userName || "-"),
    borrower_dept: String(details.borrower_dept || details.dept || details.reporter_dept || "-"),
    borrower_contact: String(details.borrower_contact || details.contact || details.userContact || "-"),
    borrow_date: String(details.borrow_date || details.borrowDate || "-"),
    expected_return: String(details.expected_return || details.expectedReturn || "-"),
    actual_return: String(details.actual_return || details.actualReturn || "-"),
    trans_status: String(details.trans_status || details.status || "-"),
    notes: String(details.notes || details.note || "-"),
    note: String(details.note || details.notes || "-"),
    ticket_id: String(details.ticket_id || details.ticketId || "-"),
    title: String(details.title || "-"),
    category: String(details.category || "-"),
    system_name: sysRaw ? `(ระบบ: ${sysRaw})` : "",
    priority: String(details.priority || "-"),
    status: String(details.status || details.trans_status || "-"),
    reporter_name: String(details.reporter_name || details.reporterName || details.userName || "-"),
    reporter_dept: String(details.reporter_dept || details.dept || "-"),
    reporter_contact: String(details.reporter_contact || details.contact || details.userContact || "-"),
    description: String(details.description || "-"),
    sla_target: String(details.sla_target || details.slaTarget || "-"),
    assigned_agent: String(details.assigned_agent || details.assignedAgent || "ยังไม่มอบหมาย"),
    resolved_at: String(details.resolved_at || details.resolvedAt || "-"),
    sender: String(details.sender || "-"),
    message: String(details.message || "-"),
    timestamp: String(details.timestamp || getLocalTimestamp(0))
  };
}

function updateEmailLogBadges() {
  const badge = document.getElementById("headerEmailLogBadge");
  if (badge) badge.innerText = (state.emailLogs || []).length;
  const toggle = document.getElementById("globalEmailNotifyToggle");
  if (toggle) toggle.checked = !!state.emailNotifyEnabled;
  const cfgToggle = document.getElementById("cfgEmailNotifyEnabled");
  if (cfgToggle) cfgToggle.checked = !!state.emailNotifyEnabled;
}

async function sendViaBuiltInSmtpEndpoint(emailPayload, cfg) {
  const endpointUrl = (cfg.transportMode === "webhook" && cfg.webhookUrl)
    ? cfg.webhookUrl.trim()
    : "/api/send-email";
  const isCheckOnly = emailPayload.action === "check";
  const activePass = getSessionSmtpPass() || cfg.smtpPass || "";
  if (activePass) setSessionSmtpPass(activePass);
  const res = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...emailPayload,
      smtpHost: cfg.smtpHost || "auto",
      smtpPort: cfg.smtpPort || "",
      smtpUser: emailPayload.senderAlias || PRIMARY_SENDER_EMAIL,
      smtpAuthUser: cfg.smtpAuthUser || emailPayload.senderAlias || PRIMARY_SENDER_EMAIL,
      smtpPass: activePass
    })
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok || data.status === "error" || (!isCheckOnly && data.sent === false)) {
    return {
      status: "error",
      sent: false,
      needsSmtpPassword: !!data.needsSmtpPassword,
      mxInfo: data.mxInfo || null,
      error: data.error || data.message || `SMTP Endpoint HTTP ${res.status}`
    };
  }
  if (data.smtpAuthUser && !isBlockedNotificationEmail(data.smtpAuthUser) && state.emailConfig) {
    state.emailConfig.smtpAuthUser = String(data.smtpAuthUser).trim().toLowerCase();
    const elAuth = document.getElementById("cfgEmailSmtpAuthUser");
    if (elAuth) elAuth.value = state.emailConfig.smtpAuthUser;
    saveEmailConfigToStorage();
    updateSmtpPassSavedBadge();
  }
  return {
    status: "success",
    sent: !isCheckOnly,
    senderEmail: data.senderEmail || emailPayload.senderAlias || PRIMARY_SENDER_EMAIL,
    method: data.method || (data.smtpEndpoint ? `SMTP (${data.smtpEndpoint})` : "SMTP Relay"),
    ...data
  };
}

async function sendSystemEmailNotification(eventType, details = {}) {
  if (!state.emailNotifyEnabled && !details.forceSend) return null;

  const tpl = (state.emailTemplates || {})[eventType];
  if (tpl && tpl.enabled === false && !details.forceSend) {
    return null;
  }

  const cfg = sanitizeEmailConfig(state.emailConfig || DEFAULT_EMAIL_CONFIG);
  const configuredSender = (!isBlockedNotificationEmail(cfg.senderAlias) && cfg.senderAlias) || PRIMARY_SENDER_EMAIL;
  const configuredReplyTo = (!isBlockedNotificationEmail(cfg.replyTo) && cfg.replyTo) || configuredSender;
  const group = getEmailEventGroup(eventType);
  const recipientsSet = new Set();

  if (Array.isArray(details.recipients)) {
    details.recipients.forEach(r => {
      const resolved = resolveUserEmailAddress(r);
      if (resolved && !isBlockedNotificationEmail(resolved)) recipientsSet.add(resolved);
    });
  }

  if (cfg.notifyRequester !== false && details.notifyRequester !== false) {
    const contactCandidate = details.borrower_contact || details.contact || details.reporter_contact || details.userContact || "";
    const fallbackEmailCandidate = details.userEmail || details.email || "";
    const nameCandidate = details.borrower_name || details.borrowerName || details.reporter_name || details.reporterName || details.userName || "";
    if (contactCandidate || fallbackEmailCandidate || nameCandidate) {
      const userMail = resolveUserEmailAddress(contactCandidate, nameCandidate) || resolveUserEmailAddress(fallbackEmailCandidate, nameCandidate);
      if (userMail && !isBlockedNotificationEmail(userMail)) recipientsSet.add(userMail);
    }
  }

  if (cfg.notifyAssignedAgent !== false && (details.assigned_agent || details.assignedAgent)) {
    const agRaw = details.assigned_agent || details.assignedAgent;
    const agentMail = resolveUserEmailAddress(agRaw, agRaw);
    if (agentMail && !isBlockedNotificationEmail(agentMail)) recipientsSet.add(agentMail);
  }

  if (details.notifyAdmins !== false) {
    (cfg.recipients || []).forEach(rec => {
      if (!rec || rec.active === false) return;
      const sc = rec.scope || "all";
      if (sc === "all" || sc === group || group === "all") {
        const em = resolveUserEmailAddress(rec.email);
        if (em && !isBlockedNotificationEmail(em)) recipientsSet.add(em);
      }
    });
    if (cfg.notifyAdminRoles !== false) {
      getAdminRecipientEmails().forEach(em => {
        if (!isBlockedNotificationEmail(em)) recipientsSet.add(em);
      });
    }
  }

  const recipients = Array.from(recipientsSet).filter(em => em && !isBlockedNotificationEmail(em));
  if (recipients.length === 0) {
    recipients.push(getPreferredTestRecipientEmail());
  }

  const vars = buildNormalizedEmailVars(eventType, details);
  const subject = details.subject
    ? renderEmailTemplate(details.subject, vars)
    : (tpl ? renderEmailTemplate(tpl.subject, vars) : "[TCC IT Service] แจ้งเตือนความเคลื่อนไหวระบบบริการไอที");
  const body = details.body
    ? renderEmailTemplate(details.body, vars)
    : (tpl ? renderEmailTemplate(tpl.body, vars) : (details.summary || ""));
  const summary = details.summary || body.split("\n").filter(Boolean).slice(0, 2).join(" • ");

  const logEntry = {
    id: "EML-" + Date.now().toString(36).toUpperCase(),
    timestamp: getLocalTimestamp(0),
    eventType: eventType || "SYSTEM_UPDATE",
    subject,
    body,
    summary,
    recipients,
    senderName: cfg.senderName || DEFAULT_EMAIL_CONFIG.senderName,
    replyTo: configuredReplyTo,
    senderAlias: configuredSender,
    senderEmail: configuredSender,
    remainingQuota: null,
    deliveryState: "pending",
    status: "Sending...",
    error: ""
  };

  state.emailLogs = [logEntry, ...(state.emailLogs || [])].slice(0, 60);
  try {
    localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, JSON.stringify(state.emailLogs));
  } catch (e) {}
  updateEmailLogBadges();
  renderEmailLogsList();

  let apiRes = null;
  if (details.sendViaApi !== false) {
    const emailPayload = {
      eventType,
      to: recipients,
      recipients,
      subject,
      body,
      summary,
      senderName: cfg.senderName || DEFAULT_EMAIL_CONFIG.senderName,
      senderEmail: configuredSender,
      replyTo: configuredReplyTo,
      senderAlias: configuredSender,
      strictSenderOnly: true,
      blockedSenderEmails: BLOCKED_NOTIFICATION_EMAILS,
      relayUrl: window.location.origin ? (window.location.origin + "/api/send-email") : "",
      details: vars
    };

    try {
      if (cfg.transportMode === "smtp" || (cfg.transportMode === "webhook" && cfg.webhookUrl)) {
        // ผู้ใช้ใหม่ยังไม่มีรหัส SMTP ในเบราว์เซอร์ -> ส่งผ่าน Google Apps Script (ใช้รหัสที่ Admin บันทึกไว้ฝั่งเซิร์ฟเวอร์) ก่อน
        const hasLocalSmtpPass = !!(getSessionSmtpPass() || cfg.smtpPass);
        if (!hasLocalSmtpPass && state.isLive) {
          const gasFirstRes = await callAPI("sendEmailNotification", emailPayload, true);
          if (gasFirstRes && !gasFirstRes.simulated && gasFirstRes.status === "success" && gasFirstRes.sent && !isBlockedNotificationEmail(gasFirstRes.senderEmail)) {
            apiRes = gasFirstRes;
          } else {
            apiRes = {
              status: "error",
              sent: false,
              error: (gasFirstRes && (gasFirstRes.error || gasFirstRes.message)) || "ยังไม่ได้ตั้งค่ารหัสผ่าน SMTP บนเซิร์ฟเวอร์ (Admin ต้องกด 'บันทึกการตั้งค่าอีเมล' พร้อม App Password หนึ่งครั้ง และ Deploy Apps Script เวอร์ชันล่าสุด)"
            };
          }
        } else {
          apiRes = await sendViaBuiltInSmtpEndpoint(emailPayload, cfg);
          if ((!apiRes || !apiRes.sent) && state.isLive) {
            const gasFallbackRes = await callAPI("sendEmailNotification", emailPayload, true);
            if (gasFallbackRes && !gasFallbackRes.simulated && gasFallbackRes.status === "success" && gasFallbackRes.sent && !isBlockedNotificationEmail(gasFallbackRes.senderEmail)) {
              apiRes = gasFallbackRes;
            }
          }
        }
      } else {
        // Pre-flight check on live GAS to prevent older Code.gs from falling back to tatitop07@gmail.com
        let gasBlockedReason = "";
        if (state.isLive) {
          const setupCheck = await callAPI("checkEmailSetup", {}, true);
          if (setupCheck && !setupCheck.simulated && setupCheck.status === "success") {
            const ownerEm = String(setupCheck.senderEmail || "").trim().toLowerCase();
            const aliasList = Array.isArray(setupCheck.aliases)
              ? setupCheck.aliases.map(a => String(a || "").trim().toLowerCase())
              : [];
            const canSendAsConfigured = (ownerEm === configuredSender.toLowerCase()) || aliasList.includes(configuredSender.toLowerCase()) || Boolean(setupCheck.smtpRelayReady);
            if (isBlockedNotificationEmail(ownerEm) && !canSendAsConfigured) {
              gasBlockedReason = `ระงับการส่งจาก ${ownerEm} อัตโนมัติ (ระบบกำหนดให้ใช้เฉพาะ ${configuredSender} ในการส่งจริงและทดสอบ) — กรุณาเพิ่ม ${configuredSender} ใน Gmail "Send mail as" หรือ Deploy Apps Script ด้วยบัญชี ${configuredSender} หรือเปลี่ยนเป็นโหมด "2) SMTP โดยตรงด้วย ${configuredSender}"`;
            }
          }
        }

        if (gasBlockedReason) {
          if (getSessionSmtpPass()) {
            apiRes = await sendViaBuiltInSmtpEndpoint(emailPayload, { ...cfg, transportMode: "smtp" });
          } else {
            apiRes = { status: "error", sent: false, blockedSender: true, error: gasBlockedReason };
          }
        } else {
          apiRes = await callAPI("sendEmailNotification", emailPayload, true);
          // Double-check returned senderEmail in case GAS sent or attempted with blocked email
          if (apiRes && isBlockedNotificationEmail(apiRes.senderEmail)) {
            apiRes = {
              status: "error",
              sent: false,
              blockedSender: true,
              error: `ไม่อนุญาตให้ส่งอีเมลด้วยบัญชี ${apiRes.senderEmail} (กรุณาอัปเดต Code.gs ล่าสุด และตั้งค่าผู้ส่งเป็น ${configuredSender})`
            };
          }
        }
      }
    } catch (err) {
      console.warn("Email API fallback:", err);
      apiRes = { status: "error", sent: false, error: err?.message || String(err) };
    }
  } else {
    apiRes = { status: "success", sent: false, simulated: true };
  }

  const rawMsg = String(apiRes?.error || apiRes?.message || "");
  const isInvalidAction = /invalid action/i.test(rawMsg);
  const isSimulated = Boolean(apiRes?.simulated);
  const isDelivered = !isSimulated && apiRes && apiRes.status === "success" && apiRes.sent === true;

  if (isDelivered) {
    logEntry.deliveryState = "sent";
    logEntry.status = cfg.transportMode === "smtp"
      ? "Sent (SMTP itsupport)"
      : (cfg.transportMode === "webhook" ? "Sent (Webhook Relay)" : "Sent (itsupport@thaichamber.or.th)");
    logEntry.senderEmail = (!isBlockedNotificationEmail(apiRes.senderEmail) && apiRes.senderEmail) || configuredSender;
    logEntry.remainingQuota = apiRes.remainingQuota !== undefined ? apiRes.remainingQuota : null;
  } else if (isSimulated) {
    logEntry.deliveryState = "simulated";
    logEntry.status = "Simulated (ไม่ส่งเมลจริง)";
    logEntry.senderEmail = configuredSender;
    logEntry.error = "ไม่ได้เชื่อมต่อ Live Google Apps Script / SMTP (ทำงานในโหมดจำลอง)";
  } else {
    logEntry.deliveryState = "failed";
    logEntry.status = apiRes?.blockedSender
      ? "Blocked (ระงับเมล tatitop07)"
      : (isInvalidAction ? "Failed (GAS เวอร์ชันเก่า)" : "Failed (ส่งไม่สำเร็จ)");
    logEntry.error = isInvalidAction
      ? "Google Apps Script บน Web App URL ยังเป็นเวอร์ชันเก่า กรุณาคัดลอกโค้ดล่าสุดไปอัปเดตและ Deploy New Version"
      : (rawMsg || `ไม่สามารถส่งออกจาก ${configuredSender} ได้`);
  }

  try {
    localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, JSON.stringify(state.emailLogs));
  } catch (e) {}
  updateEmailLogBadges();
  renderEmailLogsList();

  if (!details.silentToast) {
    const recPreview = `${recipients.slice(0, 2).join(", ")}${recipients.length > 2 ? ` (+${recipients.length - 2})` : ""}`;
    if (logEntry.deliveryState === "sent") {
      showNotification(`📧 ส่งอีเมลจริงจาก ${logEntry.senderEmail} ไปยัง ${recPreview} สำเร็จ`, "success");
    } else if (logEntry.deliveryState === "simulated") {
      showNotification(`⚠️ บันทึก Log จำลองจาก ${configuredSender} ไปยัง ${recPreview} (โหมด Demo)`, "warning");
    } else {
      showNotification(`❌ ส่งอีเมลไม่สำเร็จ (${recPreview}): ${logEntry.error}`, "error");
    }
  }
  return logEntry;
}

function showEmailDiagnosticBox(boxId, type, htmlContent) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const styles = {
    success: "bg-emerald-50 border-emerald-300 text-emerald-900",
    warning: "bg-amber-50 border-amber-300 text-amber-900",
    error: "bg-rose-50 border-rose-300 text-rose-900",
    info: "bg-sky-50 border-sky-200 text-sky-900"
  };
  box.className = `p-2.5 rounded-xl border text-[11px] leading-relaxed ${styles[type] || styles.info}`;
  box.innerHTML = htmlContent;
  box.classList.remove("hidden");
}

async function checkEmailDeliverySetup(boxId = "emailDiagnosticResultBox") {
  handleEmailConfigFieldChange();
  const cfg = sanitizeEmailConfig(state.emailConfig || DEFAULT_EMAIL_CONFIG);
  const targetSender = cfg.senderAlias || PRIMARY_SENDER_EMAIL;
  showEmailDiagnosticBox(boxId, "info", `🔄 กำลังตรวจสอบความพร้อมของอีเมลผู้ส่ง <code>${targetSender}</code>...`);

  if (cfg.transportMode === "smtp") {
    try {
      const checkRes = await sendViaBuiltInSmtpEndpoint(
        { action: "check", senderAlias: targetSender, senderName: cfg.senderName },
        cfg
      );
      if (checkRes && checkRes.status === "success") {
        return showEmailDiagnosticBox(
          boxId,
          "success",
          `✅ <b>พร้อมส่งอีเมลผ่าน SMTP โดยตรง!</b><br>• <b>ผู้ส่ง (From):</b> <code>${targetSender}</code> (${checkRes.method || "SMTP"})`
        );
      }
      return showEmailDiagnosticBox(
        boxId,
        "warning",
        `⚠️ <b>โหมด SMTP (${targetSender}):</b> ${checkRes?.error || "กรุณากรอกรหัสผ่าน / App Password ของ " + targetSender}`
      );
    } catch (err) {
      return showEmailDiagnosticBox(boxId, "error", `❌ <b>ตรวจสอบ SMTP ไม่สำเร็จ:</b> ${err?.message || err}`);
    }
  }

  if (cfg.transportMode === "webhook") {
    if (!cfg.webhookUrl) {
      return showEmailDiagnosticBox(boxId, "warning", "⚠️ เลือกโหมด <b>Webhook</b> แต่ยังไม่ได้กรอก Webhook URL");
    }
    return showEmailDiagnosticBox(boxId, "info", `🔗 กำลังใช้งานผ่าน Webhook: <code>${cfg.webhookUrl}</code> ในนามผู้ส่ง <code>${targetSender}</code>`);
  }

  const res = await callAPI("checkEmailSetup", {}, true);
  if (res && res.simulated) {
    return showEmailDiagnosticBox(
      boxId,
      "warning",
      `⚠️ <b>เชื่อมต่อ Google Apps Script ไม่สำเร็จ (Demo / Offline Mode)</b><br>กรุณาตรวจสอบ Web App URL ในเมนู <button type="button" onclick="openSetupModal()" class="underline font-bold text-tcc-700 cursor-pointer">Google Sheets &amp; Apps Script</button>`
    );
  }
  const msg = String(res?.error || res?.message || "");
  if (/invalid action/i.test(msg)) {
    return showEmailDiagnosticBox(
      boxId,
      "error",
      `❌ <b>Apps Script ยังเป็นเวอร์ชันเก่า:</b> <code>${msg}</code><br>วิธีแก้: กดปุ่ม <button type="button" onclick="openSetupModal()" class="underline font-bold text-rose-800 cursor-pointer">เปิดหน้าต่าง Google Sheets &amp; Apps Script</button> &rarr; คัดลอกโค้ดไปวางทับใน <code>Code.gs</code> &rarr; Deploy New Version`
    );
  }
  if (!res || res.status === "error" || res.mailAuthorized === false) {
    return showEmailDiagnosticBox(
      boxId,
      "error",
      `❌ <b>ระบบส่งอีเมลใน Apps Script ยังไม่พร้อม:</b> ${msg || "ไม่ได้รับสิทธิ์ MailApp"}`
    );
  }

  const ownerEmail = String(res.senderEmail || "").trim().toLowerCase();
  const aliases = Array.isArray(res.aliases) ? res.aliases.map(a => String(a || "").trim().toLowerCase()) : [];
  const hasTargetAlias = (ownerEmail === targetSender.toLowerCase()) || aliases.includes(targetSender.toLowerCase());

  if (isBlockedNotificationEmail(ownerEmail) && !hasTargetAlias && !res.smtpRelayReady) {
    return showEmailDiagnosticBox(
      boxId,
      "error",
      `⛔ <b>ตรวจพบว่า Google Apps Script ปัจจุบันยังผูกอยู่กับบัญชี <code>${ownerEmail}</code> (ซึ่งระบบได้สั่งบล็อกไม่ให้ใช้ส่งจริงและทดสอบแล้ว)</b><br>` +
      `เพื่อให้ส่งออกจาก <b><code>${targetSender}</code></b> ได้ทันที กรุณาเลือกวิธีใดวิธีหนึ่ง:<br>` +
      `1️⃣ <b>วิธีที่ง่ายที่สุด (ไม่ต้องย้าย Sheet):</b> เปลี่ยนช่องทางการส่งด้านบนเป็น <b>"2) SMTP โดยตรงด้วย ${targetSender}"</b> แล้วกรอกรหัสผ่าน/App Password ของ <code>${targetSender}</code><br>` +
      `2️⃣ <b>หรือตั้งค่าใน Gmail / Apps Script:</b> เพิ่ม <code>${targetSender}</code> ในเมนู <b>Gmail Settings &rarr; Accounts and Import &rarr; Send mail as (ส่งอีเมลในชื่อ)</b> หรือเปิดโปรเจกต์ Apps Script ด้วยบัญชี <code>${targetSender}</code> แล้วกด Deploy Web App ใหม่`
    );
  }

  const aliasTxt = aliases.length > 0 ? `<br>• <b>Alias ที่ตรวจพบ:</b> ${aliases.join(", ")}` : "";
  showEmailDiagnosticBox(
    boxId,
    "success",
    `✅ <b>พร้อมส่งอีเมลจริงในนาม <code>${targetSender}</code></b><br>• <b>บัญชีผู้ส่งที่จะใช้ส่งออก (From):</b> <code>${targetSender}</code> | <b>โควต้าคงเหลือวันนี้:</b> ${res.remainingQuota ?? "-"} ฉบับ${aliasTxt}`
  );
}

function openEmailLogModal() {
  updateEmailLogBadges();
  renderEmailLogsList();
  const inp = document.getElementById("emailLogTestRecipient");
  if (inp && (!inp.value.trim() || isBlockedNotificationEmail(inp.value))) {
    inp.value = getPreferredTestRecipientEmail();
  }
  document.getElementById("emailLogTestStatusStrip")?.classList.add("hidden");
  document.getElementById("emailLogModal")?.classList.remove("hidden");
}

function closeEmailLogModal() {
  document.getElementById("emailLogModal")?.classList.add("hidden");
}

function toggleGlobalEmailSetting(enabled) {
  state.emailNotifyEnabled = !!enabled;
  localStorage.setItem(STORAGE_KEY_EMAIL_ENABLED, state.emailNotifyEnabled ? "true" : "false");
  updateEmailLogBadges();
  showNotification(
    state.emailNotifyEnabled
      ? "เปิดระบบส่งอีเมลแจ้งเตือนอัตโนมัติแล้ว"
      : "ปิดระบบส่งอีเมลแจ้งเตือนชั่วคราว",
    state.emailNotifyEnabled ? "success" : "warning"
  );
  saveAllEmailSettingsToServer(true);
}

function clearEmailLogs() {
  state.emailLogs = [];
  localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, "[]");
  updateEmailLogBadges();
  renderEmailLogsList();
  showNotification("ล้างประวัติการแจ้งเตือนอีเมลเรียบร้อย", "info");
}

async function sendTestEmailNotification(inputId = "emailLogTestRecipient", resultBoxId = "emailLogTestStatusStrip") {
  handleEmailConfigFieldChange();
  const inputEl = document.getElementById(inputId);
  let targetEmail = (inputEl?.value || "").trim().toLowerCase();
  if (!targetEmail) {
    targetEmail = getPreferredTestRecipientEmail();
    if (inputEl) inputEl.value = targetEmail;
  }
  if (isBlockedNotificationEmail(targetEmail)) {
    const msg = `⛔ ไม่อนุญาตให้ใช้อีเมล ${targetEmail} ในการทดสอบหรือส่งจริง กรุณาระบุอีเมลองค์กร เช่น ${PRIMARY_SENDER_EMAIL}`;
    showNotification(msg, "error");
    showEmailDiagnosticBox(resultBoxId, "error", msg);
    if (inputEl) {
      inputEl.value = getPreferredTestRecipientEmail();
      inputEl.focus();
    }
    return;
  }
  if (!targetEmail || !targetEmail.includes("@")) {
    showNotification("กรุณาระบุอีเมลปลายทางสำหรับทดสอบส่งให้ถูกต้อง", "warning");
    inputEl?.focus();
    return;
  }

  const senderAddr = state.emailConfig?.senderAlias || PRIMARY_SENDER_EMAIL;
  showEmailDiagnosticBox(resultBoxId, "info", `🚀 กำลังส่งอีเมลทดสอบจาก <code>${senderAddr}</code> ไปยัง <code>${targetEmail}</code>...`);

  const logEntry = await sendSystemEmailNotification("TEST_EMAIL", {
    forceSend: true,
    sendViaApi: true,
    recipients: [targetEmail],
    notifyAdmins: false,
    notifyRequester: false,
    subject: `[TCC IT System] ทดสอบระบบแจ้งเตือนอีเมลอัตโนมัติ (${getLocalTimestamp(0)})`,
    body: `เรียน ผู้ดูแลระบบฝ่ายเทคโนโลยีสารสนเทศ\n\nนี่คืออีเมลทดสอบจากระบบบริหารจัดการอุปกรณ์และ Helpdesk หอการค้าไทย\n• ผู้ส่ง (From): ${senderAddr}\n• ผู้รับทดสอบ (To): ${targetEmail}\n• เวลาที่ส่ง: ${getLocalTimestamp(0)}\n• สถานะ: ระบบส่งอีเมลอัตโนมัติพร้อมใช้งาน`,
    summary: `ทดสอบส่งอีเมลแจ้งเตือนจาก ${senderAddr} ไปยัง: ${targetEmail}`
  });

  if (!logEntry) return;
  if (logEntry.deliveryState === "sent") {
    const senderNote = ` (ผู้ส่ง From: <code>${logEntry.senderEmail || senderAddr}</code>)`;
    const quotaNote = logEntry.remainingQuota !== null ? ` • โควต้าคงเหลือ: ${logEntry.remainingQuota} ฉบับ/วัน` : "";
    showEmailDiagnosticBox(
      resultBoxId,
      "success",
      `✅ <b>ส่งอีเมลจริงสำเร็จ!</b> ไปยัง <code>${targetEmail}</code>${senderNote}${quotaNote}<br><span class="text-slate-600">* หากไม่พบใน Inbox กรุณาตรวจสอบโฟลเดอร์ Spam/Junk ของอีเมลปลายทาง</span>`
    );
  } else if (logEntry.deliveryState === "simulated") {
    showEmailDiagnosticBox(
      resultBoxId,
      "warning",
      `⚠️ <b>บันทึกเฉพาะ Log จำลอง (ผู้ส่ง: <code>${senderAddr}</code>):</b> ${logEntry.error}`
    );
  } else {
    showEmailDiagnosticBox(
      resultBoxId,
      "error",
      `❌ <b>ส่งอีเมลไม่สำเร็จ:</b> ${logEntry.error}<br><button type="button" onclick="openSetupModal()" class="underline font-bold text-rose-800 mt-1 cursor-pointer">เปิดดูโค้ด Google Apps Script ล่าสุดเพื่ออัปเดตและ Deploy</button>`
    );
  }
}

function renderEmailLogsList() {
  const container = document.getElementById("emailLogListContainer");
  if (!container) return;
  const logs = state.emailLogs || [];
  if (logs.length === 0) {
    container.innerHTML = `<div class="py-12 text-center text-xs text-slate-400">ยังไม่มีประวัติการส่งอีเมลแจ้งเตือน</div>`;
    return;
  }

  const typeBadgeMap = {
    BORROW_CREATED: { label: "📝 ยืมอุปกรณ์", cls: "bg-tcc-50 text-tcc-700 border-tcc-200" },
    BORROW_RETURNED: { label: "✅ คืนอุปกรณ์", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    BORROW_UPDATED: { label: "🔄 อัปเดตการยืม", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    TICKET_CREATED: { label: "🛠️ เปิดเคสใหม่", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    TICKET_UPDATED: { label: "🔔 อัปเดตสถานะเคส", cls: "bg-purple-50 text-purple-700 border-purple-200" },
    TICKET_COMMENT: { label: "💬 ข้อความใหม่ในเคส", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    TICKET_ASSIGNED: { label: "👤 มอบหมายเคส", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    TEST_EMAIL: { label: "🚀 ทดสอบระบบ", cls: "bg-slate-100 text-slate-700 border-slate-300" }
  };

  container.innerHTML = logs.map(l => {
    const badge = typeBadgeMap[l.eventType] || { label: "📧 แจ้งเตือนระบบ", cls: "bg-slate-100 text-slate-700 border-slate-200" };
    const bodyOrSummary = l.body || l.summary || "";
    const dState = l.deliveryState || (String(l.status || "").toLowerCase().includes("fail") || String(l.status || "").toLowerCase().includes("block") ? "failed" : (String(l.status || "").toLowerCase().includes("sim") ? "simulated" : "sent"));
    let statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ ${l.status || "Sent"}</span>`;
    if (dState === "failed") {
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">✕ ${l.status || "Failed"}</span>`;
    } else if (dState === "simulated") {
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">⚠ ${l.status || "Simulated"}</span>`;
    } else if (dState === "pending") {
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">🔄 ${l.status || "Sending..."}</span>`;
    }
    const dispSender = (!isBlockedNotificationEmail(l.senderEmail) && l.senderEmail) || PRIMARY_SENDER_EMAIL;

    return `
      <div class="p-3 rounded-2xl border ${dState === "failed" ? "border-rose-200 bg-rose-50/30" : "border-slate-200 bg-slate-50/60"} hover:bg-white transition space-y-1.5 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-lg border text-[10px] font-bold ${badge.cls}">${badge.label}</span>
            <span class="font-mono text-[10px] text-slate-400">${l.timestamp}</span>
          </div>
          ${statusPill}
        </div>
        <div class="font-bold text-slate-900">${l.subject}</div>
        ${l.error ? `<div class="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium">⚠️ <b>สาเหตุ:</b> ${l.error}</div>` : ""}
        ${bodyOrSummary ? `<div class="text-slate-600 text-[11px] whitespace-pre-line bg-white/80 p-2 rounded-xl border border-slate-100">${bodyOrSummary}</div>` : ""}
        <div class="text-[10px] text-slate-500 flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100">
          <span class="font-semibold text-slate-600 mr-1">จาก (From):</span><span class="px-1.5 py-0.2 bg-white border border-slate-200 rounded font-mono text-emerald-700 mr-2">${dispSender}</span>
          <span class="font-semibold text-slate-600">ผู้รับ (To):</span>
          ${(l.recipients || []).filter(r => !isBlockedNotificationEmail(r)).map(r => `<span class="px-1.5 py-0.2 bg-white border border-slate-200 rounded font-mono text-tcc-700">${r}</span>`).join("")}
        </div>
      </div>
    `;
  }).join("");
}

/* ADMIN EMAIL SETTINGS & TEMPLATE MANAGER UI FUNCTIONS */
function renderEmailSettingsTab() {
  state.emailConfig = sanitizeEmailConfig(state.emailConfig || DEFAULT_EMAIL_CONFIG);
  const cfg = state.emailConfig;
  const elEnabled = document.getElementById("cfgEmailNotifyEnabled");
  const elTransport = document.getElementById("cfgEmailTransportMode");
  const elSmtpWrap = document.getElementById("cfgEmailSmtpWrapper");
  const elSmtpHost = document.getElementById("cfgEmailSmtpHost");
  const elSmtpAuthUser = document.getElementById("cfgEmailSmtpAuthUser");
  const elSmtpPass = document.getElementById("cfgEmailSmtpPass");
  const elWebhookWrap = document.getElementById("cfgEmailWebhookWrapper");
  const elWebhookUrl = document.getElementById("cfgEmailWebhookUrl");
  const elSender = document.getElementById("cfgEmailSenderName");
  const elReply = document.getElementById("cfgEmailReplyTo");
  const elAlias = document.getElementById("cfgEmailSenderAlias");
  const elReq = document.getElementById("cfgEmailNotifyRequester");
  const elAgent = document.getElementById("cfgEmailNotifyAssignedAgent");
  const elRoles = document.getElementById("cfgEmailNotifyAdminRoles");
  const elTestRec = document.getElementById("cfgEmailTestRecipient");
  const elTplRec = document.getElementById("tplTestTargetEmail");

  const mode = ["gas_mailapp", "smtp", "webhook"].includes(cfg.transportMode) ? cfg.transportMode : "smtp";
  if (elEnabled) elEnabled.checked = !!state.emailNotifyEnabled;
  if (elTransport) elTransport.value = mode;
  if (elSmtpWrap) elSmtpWrap.classList.toggle("hidden", mode !== "smtp");
  if (elSmtpHost) elSmtpHost.value = cfg.smtpHost || "auto";
  if (elSmtpAuthUser) elSmtpAuthUser.value = (!isBlockedNotificationEmail(cfg.smtpAuthUser) && cfg.smtpAuthUser) || PRIMARY_SENDER_EMAIL;
  const rememberedPass = getSessionSmtpPass() || cfg.smtpPass || "";
  if (elSmtpPass && rememberedPass) elSmtpPass.value = rememberedPass;
  if (elWebhookWrap) elWebhookWrap.classList.toggle("hidden", mode !== "webhook");
  if (elWebhookUrl) elWebhookUrl.value = cfg.webhookUrl || "/api/send-email";
  if (elSender) elSender.value = cfg.senderName || DEFAULT_EMAIL_CONFIG.senderName;
  if (elReply) elReply.value = (!isBlockedNotificationEmail(cfg.replyTo) && cfg.replyTo) || PRIMARY_SENDER_EMAIL;
  if (elAlias) elAlias.value = (!isBlockedNotificationEmail(cfg.senderAlias) && cfg.senderAlias) || PRIMARY_SENDER_EMAIL;
  if (elReq) elReq.checked = cfg.notifyRequester !== false;
  if (elAgent) elAgent.checked = cfg.notifyAssignedAgent !== false;
  if (elRoles) elRoles.checked = cfg.notifyAdminRoles !== false;

  const defaultTestEmail = getPreferredTestRecipientEmail();
  if (elTestRec && (!elTestRec.value.trim() || isBlockedNotificationEmail(elTestRec.value))) elTestRec.value = defaultTestEmail;
  if (elTplRec && (!elTplRec.value.trim() || isBlockedNotificationEmail(elTplRec.value))) elTplRec.value = defaultTestEmail;

  state._emailSettingsDomInitialized = true;
  updateSmtpPassSavedBadge();
  renderEmailRecipientsTable();
  renderEmailTemplateEventList();
  selectEmailTemplateEvent(state.selectedEmailTemplateEvent || "BORROW_CREATED");
}

function handleEmailConfigFieldChange(explicitNotifyToggle = false) {
  if (!state.emailConfig) state.emailConfig = sanitizeEmailConfig(DEFAULT_EMAIL_CONFIG);
  if (!state._emailSettingsDomInitialized) {
    renderEmailSettingsTab();
  }
  const rawMode = document.getElementById("cfgEmailTransportMode")?.value || "smtp";
  const mode = ["gas_mailapp", "smtp", "webhook"].includes(rawMode) ? rawMode : "smtp";
  state.emailConfig.transportMode = mode;
  state.emailConfig.smtpHost = document.getElementById("cfgEmailSmtpHost")?.value || "auto";
  state.emailConfig.webhookUrl = document.getElementById("cfgEmailWebhookUrl")?.value.trim() || "/api/send-email";

  const elAuthUser = document.getElementById("cfgEmailSmtpAuthUser");
  let authUserVal = (elAuthUser?.value || "").trim().toLowerCase();
  if (!authUserVal || isBlockedNotificationEmail(authUserVal)) {
    if (isBlockedNotificationEmail(authUserVal) && authUserVal) {
      showNotification(`ไม่อนุญาตให้ใช้ ${authUserVal} ยืนยันตัวตน SMTP ระบบเปลี่ยนกลับเป็น ${PRIMARY_SENDER_EMAIL}`, "error");
    }
    authUserVal = PRIMARY_SENDER_EMAIL;
    if (elAuthUser) elAuthUser.value = PRIMARY_SENDER_EMAIL;
  }
  state.emailConfig.smtpAuthUser = authUserVal;

  const passInput = document.getElementById("cfgEmailSmtpPass");
  if (passInput && passInput.value.trim()) {
    setSessionSmtpPass(passInput.value.trim());
  } else {
    updateSmtpPassSavedBadge();
  }

  document.getElementById("cfgEmailSmtpWrapper")?.classList.toggle("hidden", mode !== "smtp");
  document.getElementById("cfgEmailWebhookWrapper")?.classList.toggle("hidden", mode !== "webhook");

  const elAlias = document.getElementById("cfgEmailSenderAlias");
  const elReply = document.getElementById("cfgEmailReplyTo");
  let aliasVal = (elAlias?.value || "").trim().toLowerCase();
  let replyVal = (elReply?.value || "").trim().toLowerCase();

  if (!aliasVal || isBlockedNotificationEmail(aliasVal)) {
    if (isBlockedNotificationEmail(aliasVal) && aliasVal) {
      showNotification(`ไม่อนุญาตให้ใช้ ${aliasVal} เป็นผู้ส่ง ระบบเปลี่ยนกลับเป็น ${PRIMARY_SENDER_EMAIL}`, "warning");
    }
    aliasVal = PRIMARY_SENDER_EMAIL;
    if (elAlias) elAlias.value = PRIMARY_SENDER_EMAIL;
  }
  if (!replyVal || isBlockedNotificationEmail(replyVal)) {
    replyVal = aliasVal;
    if (elReply) elReply.value = replyVal;
  }

  state.emailConfig.senderName = document.getElementById("cfgEmailSenderName")?.value.trim() || DEFAULT_EMAIL_CONFIG.senderName;
  state.emailConfig.senderEmail = aliasVal;
  state.emailConfig.senderAlias = aliasVal;
  state.emailConfig.replyTo = replyVal;
  if (explicitNotifyToggle === true) {
    state.emailConfig._notifyPrefsExplicit = true;
  }
  if (state.emailConfig._notifyPrefsExplicit === true) {
    state.emailConfig.notifyRequester = !!document.getElementById("cfgEmailNotifyRequester")?.checked;
    state.emailConfig.notifyAssignedAgent = !!document.getElementById("cfgEmailNotifyAssignedAgent")?.checked;
    state.emailConfig.notifyAdminRoles = !!document.getElementById("cfgEmailNotifyAdminRoles")?.checked;
  } else {
    state.emailConfig.notifyRequester = true;
    state.emailConfig.notifyAssignedAgent = true;
    state.emailConfig.notifyAdminRoles = true;
  }
  saveEmailConfigToStorage();
  const badge = document.getElementById("cfgEmailSyncStatusBadge");
  if (badge) badge.innerText = "● บันทึกในเบราว์เซอร์แล้ว (กดบันทึกทั้งหมดเพื่อซิงค์ฐานข้อมูล)";
}

function renderEmailRecipientsTable() {
  const tbody = document.getElementById("emailRecipientsTableBody");
  const countBadge = document.getElementById("emailRecipientCountBadge");
  if (!tbody) return;

  const list = (state.emailConfig?.recipients || []).filter(rec => rec && !isBlockedNotificationEmail(rec.email));
  const q = (document.getElementById("searchEmailRecipientInput")?.value || "").trim().toLowerCase();
  const scopeFilter = document.getElementById("filterEmailRecipientScope")?.value || "";

  const indexed = list.map((rec, idx) => ({ ...rec, _idx: idx })).filter(rec => {
    const matchQ = !q || safeLower(rec.email).includes(q) || safeLower(rec.name).includes(q);
    const matchScope = !scopeFilter || (rec.scope || "all") === scopeFilter;
    return matchQ && matchScope;
  });

  if (countBadge) countBadge.innerText = `${indexed.length} / ${list.length} อีเมล`;

  if (indexed.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-400">ไม่พบรายการอีเมลแจ้งเตือน (กด "+ เพิ่มอีเมลแจ้งเตือน" เพื่อเพิ่ม)</td></tr>`;
    return;
  }

  const scopeBadge = {
    all: `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🌐 ทั้งหมด (ยืม-คืน &amp; Helpdesk)</span>`,
    borrow: `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-tcc-50 text-tcc-700 border border-tcc-200">💻 เฉพาะยืม-คืนอุปกรณ์</span>`,
    ticket: `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">🛠️ เฉพาะ Helpdesk</span>`
  };

  tbody.innerHTML = indexed.map((rec, rowNum) => {
    const active = rec.active !== false;
    return `
      <tr class="hover:bg-slate-50/80 transition text-xs">
        <td class="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">${rowNum + 1}</td>
        <td class="py-2.5 px-3 font-mono font-semibold text-slate-800">${rec.email}</td>
        <td class="py-2.5 px-3 text-slate-700">${rec.name || "-"}</td>
        <td class="py-2.5 px-3 text-center">${scopeBadge[rec.scope || "all"] || scopeBadge.all}</td>
        <td class="py-2.5 px-3 text-center">
          <button type="button" onclick="toggleEmailRecipientActive(${rec._idx})" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${active ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"}">
            ${active ? "✓ เปิดรับแจ้งเตือน" : "⏸ พักการส่ง"}
          </button>
        </td>
        <td class="py-2.5 px-3 text-center">
          <div class="inline-flex items-center gap-1">
            <button type="button" onclick="openEmailRecipientModal(${rec._idx})" class="px-2 py-1 rounded-lg bg-tcc-50 hover:bg-tcc-100 text-tcc-700 font-semibold text-[11px] border border-tcc-200/70 transition cursor-pointer">✏️ แก้ไข</button>
            <button type="button" onclick="deleteEmailRecipient(${rec._idx})" class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-[11px] border border-rose-200/70 transition cursor-pointer">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openEmailRecipientModal(idx = -1) {
  const idxInput = document.getElementById("emailRecipientEditIdx");
  const titleEl = document.getElementById("emailRecipientModalTitle");
  const emailEl = document.getElementById("inputEmailRecipientAddr");
  const nameEl = document.getElementById("inputEmailRecipientName");
  const scopeEl = document.getElementById("inputEmailRecipientScope");
  const activeEl = document.getElementById("inputEmailRecipientActive");

  if (idxInput) idxInput.value = String(idx);
  const existing = idx >= 0 ? (state.emailConfig?.recipients || [])[idx] : null;
  if (existing) {
    if (titleEl) titleEl.innerText = "แก้ไขอีเมลรับแจ้งเตือนอัตโนมัติ";
    if (emailEl) emailEl.value = existing.email || "";
    if (nameEl) nameEl.value = existing.name || "";
    if (scopeEl) scopeEl.value = existing.scope || "all";
    if (activeEl) activeEl.checked = existing.active !== false;
  } else {
    if (titleEl) titleEl.innerText = "เพิ่มอีเมลรับแจ้งเตือนอัตโนมัติ";
    if (emailEl) emailEl.value = "";
    if (nameEl) nameEl.value = "";
    if (scopeEl) scopeEl.value = "all";
    if (activeEl) activeEl.checked = true;
  }
  document.getElementById("emailRecipientModal")?.classList.remove("hidden");
}

function closeEmailRecipientModal() {
  document.getElementById("emailRecipientModal")?.classList.add("hidden");
}

function handleSaveEmailRecipient(e) {
  e.preventDefault();
  const idx = parseInt(document.getElementById("emailRecipientEditIdx")?.value || "-1", 10);
  const email = (document.getElementById("inputEmailRecipientAddr")?.value || "").trim().toLowerCase();
  const name = (document.getElementById("inputEmailRecipientName")?.value || "").trim();
  const scope = document.getElementById("inputEmailRecipientScope")?.value || "all";
  const active = !!document.getElementById("inputEmailRecipientActive")?.checked;

  if (!email || !email.includes("@")) {
    return showNotification("กรุณาระบุรูปแบบอีเมลที่ถูกต้อง", "warning");
  }
  if (isBlockedNotificationEmail(email)) {
    return showNotification(`ไม่อนุญาตให้เพิ่ม ${email} ในระบบแจ้งเตือน (กรุณาใช้อีเมล @thaichamber.or.th)`, "error");
  }
  if (!state.emailConfig) state.emailConfig = sanitizeEmailConfig(DEFAULT_EMAIL_CONFIG);
  if (!Array.isArray(state.emailConfig.recipients)) state.emailConfig.recipients = [];

  const dupIdx = state.emailConfig.recipients.findIndex((r, i) => i !== idx && safeLower(r.email) === email);
  if (dupIdx !== -1) {
    return showNotification(`อีเมล "${email}" มีอยู่ในรายการแจ้งเตือนแล้ว`, "warning");
  }

  const recObj = { email, name, scope, active };
  if (idx >= 0 && idx < state.emailConfig.recipients.length) {
    state.emailConfig.recipients[idx] = recObj;
  } else {
    state.emailConfig.recipients.push(recObj);
  }

  closeEmailRecipientModal();
  renderEmailRecipientsTable();
  saveAllEmailSettingsToServer(true);
  showNotification(`บันทึกอีเมลแจ้งเตือน [${email}] เรียบร้อย`, "success");
}

function toggleEmailRecipientActive(idx) {
  const list = state.emailConfig?.recipients;
  if (!list || !list[idx]) return;
  list[idx].active = list[idx].active === false;
  renderEmailRecipientsTable();
  saveAllEmailSettingsToServer(true);
  showNotification(`${list[idx].active ? "เปิด" : "พัก"}การส่งอีเมลไปยัง ${list[idx].email} แล้ว`, "info");
}

function deleteEmailRecipient(idx) {
  const list = state.emailConfig?.recipients;
  if (!list || !list[idx]) return;
  const targetEmail = list[idx].email;
  if (!confirm(`ต้องการลบอีเมล "${targetEmail}" ออกจากรายการแจ้งเตือนใช่หรือไม่?`)) return;
  list.splice(idx, 1);
  renderEmailRecipientsTable();
  saveAllEmailSettingsToServer(true);
  showNotification(`ลบอีเมล [${targetEmail}] ออกจากรายการแจ้งเตือนเรียบร้อย`, "info");
}

function renderEmailTemplateEventList() {
  const container = document.getElementById("emailTemplateEventList");
  if (!container) return;
  const tpls = state.emailTemplates || DEFAULT_EMAIL_TEMPLATES;
  const selectedKey = state.selectedEmailTemplateEvent || "BORROW_CREATED";
  const eventOrder = [
    "BORROW_CREATED", "BORROW_RETURNED", "BORROW_UPDATED",
    "TICKET_CREATED", "TICKET_UPDATED", "TICKET_ASSIGNED", "TICKET_COMMENT"
  ];

  container.innerHTML = eventOrder.map(key => {
    const tpl = tpls[key] || DEFAULT_EMAIL_TEMPLATES[key];
    if (!tpl) return "";
    const isSelected = key === selectedKey;
    const isBorrow = tpl.group === "borrow";
    const groupBadge = isBorrow
      ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-tcc-50 text-tcc-700 border border-tcc-200">ยืม-คืน</span>`
      : `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Helpdesk</span>`;
    const statusDot = tpl.enabled !== false
      ? `<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="เปิดส่งอัตโนมัติ"></span>`
      : `<span class="w-2 h-2 rounded-full bg-slate-300 shrink-0" title="ปิดใช้งานชั่วคราว"></span>`;

    return `
      <button type="button" onclick="selectEmailTemplateEvent('${key}')" class="w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${isSelected ? "bg-tcc-600 text-white border-tcc-600 shadow-sm" : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"}">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            ${isSelected ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 text-white">${isBorrow ? "ยืม-คืน" : "Helpdesk"}</span>` : groupBadge}
            <span class="font-mono text-[10px] ${isSelected ? "text-sky-100" : "text-slate-400"} truncate">${key}</span>
          </div>
          <div class="font-bold text-xs truncate">${tpl.title}</div>
        </div>
        ${statusDot}
      </button>
    `;
  }).join("");
}

function selectEmailTemplateEvent(eventKey) {
  if (!state.emailTemplates) state.emailTemplates = loadSavedEmailTemplates();
  const tpl = state.emailTemplates[eventKey] || DEFAULT_EMAIL_TEMPLATES[eventKey];
  if (!tpl) return;
  state.selectedEmailTemplateEvent = eventKey;

  const badge = document.getElementById("tplEditorEventBadge");
  const titleEl = document.getElementById("tplEditorEventTitle");
  const enabledChk = document.getElementById("tplEnabledCheckbox");
  const subjEl = document.getElementById("tplSubjectInput");
  const bodyEl = document.getElementById("tplBodyInput");
  const chipsEl = document.getElementById("tplVariableChips");

  if (badge) badge.innerText = eventKey;
  if (titleEl) titleEl.innerText = tpl.title;
  if (enabledChk) enabledChk.checked = tpl.enabled !== false;
  if (subjEl) subjEl.value = tpl.subject || "";
  if (bodyEl) bodyEl.value = tpl.body || "";

  if (chipsEl) {
    const vars = (DEFAULT_EMAIL_TEMPLATES[eventKey]?.variables || tpl.variables || []);
    chipsEl.innerHTML = vars.map(v => `
      <button type="button" onclick="insertTemplateVariable('${v}')" class="px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-mono text-[11px] font-semibold transition cursor-pointer">
        + ${v}
      </button>
    `).join("");
  }

  renderEmailTemplateEventList();
  updateTemplateLivePreview();
}

function setLastFocusedTemplateField(fieldId) {
  lastFocusedTemplateFieldId = fieldId;
}

function insertTemplateVariable(varToken) {
  const targetEl = document.getElementById(lastFocusedTemplateFieldId) || document.getElementById("tplBodyInput");
  if (!targetEl) return;
  const start = targetEl.selectionStart ?? targetEl.value.length;
  const end = targetEl.selectionEnd ?? targetEl.value.length;
  const val = targetEl.value;
  targetEl.value = val.slice(0, start) + varToken + val.slice(end);
  targetEl.focus();
  const nextPos = start + varToken.length;
  targetEl.setSelectionRange(nextPos, nextPos);
  handleTemplateFormInput();
}

function handleTemplateFormInput() {
  const eventKey = state.selectedEmailTemplateEvent || "BORROW_CREATED";
  if (!state.emailTemplates || !state.emailTemplates[eventKey]) return;
  const enabledChk = document.getElementById("tplEnabledCheckbox");
  const subjEl = document.getElementById("tplSubjectInput");
  const bodyEl = document.getElementById("tplBodyInput");

  if (enabledChk) state.emailTemplates[eventKey].enabled = !!enabledChk.checked;
  if (subjEl) state.emailTemplates[eventKey].subject = subjEl.value;
  if (bodyEl) state.emailTemplates[eventKey].body = bodyEl.value;

  renderEmailTemplateEventList();
  updateTemplateLivePreview();
}

function updateTemplateLivePreview() {
  const eventKey = state.selectedEmailTemplateEvent || "BORROW_CREATED";
  const tpl = (state.emailTemplates || {})[eventKey] || DEFAULT_EMAIL_TEMPLATES[eventKey];
  if (!tpl) return;
  const sample = DEFAULT_EMAIL_TEMPLATES[eventKey]?.sampleData || {};
  const subjEl = document.getElementById("tplPreviewSubject");
  const bodyEl = document.getElementById("tplPreviewBody");
  if (subjEl) subjEl.innerText = renderEmailTemplate(tpl.subject, sample);
  if (bodyEl) bodyEl.innerText = renderEmailTemplate(tpl.body, sample);
}

function saveCurrentEmailTemplate() {
  handleTemplateFormInput();
  saveAllEmailSettingsToServer(false);
}

function resetSelectedTemplateToDefault() {
  const eventKey = state.selectedEmailTemplateEvent || "BORROW_CREATED";
  const def = DEFAULT_EMAIL_TEMPLATES[eventKey];
  if (!def) return;
  state.emailTemplates[eventKey] = JSON.parse(JSON.stringify(def));
  selectEmailTemplateEvent(eventKey);
  saveAllEmailSettingsToServer(true);
  showNotification(`คืนค่าข้อความเริ่มต้นสำหรับเหตุการณ์ ${eventKey} แล้ว`, "info");
}

function resetAllEmailTemplatesToDefault() {
  if (!confirm("ต้องการคืนค่าข้อความอีเมลเริ่มต้นของทุกเหตุการณ์ใช่หรือไม่?")) return;
  state.emailTemplates = JSON.parse(JSON.stringify(DEFAULT_EMAIL_TEMPLATES));
  selectEmailTemplateEvent(state.selectedEmailTemplateEvent || "BORROW_CREATED");
  saveAllEmailSettingsToServer(true);
  showNotification("คืนค่าข้อความอีเมลเริ่มต้นทั้งหมดเรียบร้อยแล้ว", "info");
}

async function testSendSelectedEmailTemplate() {
  handleEmailConfigFieldChange();
  const eventKey = state.selectedEmailTemplateEvent || "BORROW_CREATED";
  const sample = DEFAULT_EMAIL_TEMPLATES[eventKey]?.sampleData || {};
  const targetEl = document.getElementById("tplTestTargetEmail");
  let targetEmail = (targetEl?.value || "").trim().toLowerCase();
  if (!targetEmail) {
    targetEmail = getPreferredTestRecipientEmail();
    if (targetEl) targetEl.value = targetEmail;
  }
  if (isBlockedNotificationEmail(targetEmail)) {
    const msg = `⛔ ไม่อนุญาตให้ใช้อีเมล ${targetEmail} ในการทดสอบหรือส่งจริง กรุณาระบุอีเมลองค์กร เช่น ${PRIMARY_SENDER_EMAIL}`;
    showNotification(msg, "error");
    showEmailDiagnosticBox("tplTestResultBox", "error", msg);
    if (targetEl) {
      targetEl.value = getPreferredTestRecipientEmail();
      targetEl.focus();
    }
    return;
  }
  if (!targetEmail || !targetEmail.includes("@")) {
    showNotification("กรุณากรอกอีเมลปลายทางสำหรับทดสอบส่งให้ถูกต้อง", "warning");
    targetEl?.focus();
    return;
  }
  const senderAddr = state.emailConfig?.senderAlias || PRIMARY_SENDER_EMAIL;
  showEmailDiagnosticBox("tplTestResultBox", "info", `🚀 กำลังทดสอบส่งเทมเพลต <b>${eventKey}</b> จาก <code>${senderAddr}</code> ไปยัง <code>${targetEmail}</code>...`);

  const logEntry = await sendSystemEmailNotification(eventKey, {
    ...sample,
    forceSend: true,
    sendViaApi: true,
    recipients: [targetEmail],
    notifyAdmins: false,
    notifyRequester: false
  });

  if (!logEntry) return;
  if (logEntry.deliveryState === "sent") {
    const senderNote = ` (จาก: <code>${logEntry.senderEmail || senderAddr}</code>)`;
    const quotaNote = logEntry.remainingQuota !== null ? ` • โควต้าคงเหลือ: ${logEntry.remainingQuota} ฉบับ/วัน` : "";
    showEmailDiagnosticBox(
      "tplTestResultBox",
      "success",
      `✅ <b>ส่งอีเมลจริงสำเร็จ!</b> ไปยัง <code>${targetEmail}</code>${senderNote}${quotaNote}<br><span class="text-slate-600">* หากไม่พบใน Inbox กรุณาตรวจสอบ Spam/Junk ของอีเมลปลายทาง</span>`
    );
  } else if (logEntry.deliveryState === "simulated") {
    showEmailDiagnosticBox(
      "tplTestResultBox",
      "warning",
      `⚠️ <b>บันทึกเฉพาะ Log จำลอง (ผู้ส่ง: <code>${senderAddr}</code>):</b> ${logEntry.error}`
    );
  } else {
    showEmailDiagnosticBox(
      "tplTestResultBox",
      "error",
      `❌ <b>ส่งอีเมลไม่สำเร็จ:</b> ${logEntry.error}<br><button type="button" onclick="openSetupModal()" class="underline font-bold text-rose-800 mt-1 cursor-pointer">เปิดดูโค้ด Google Apps Script ล่าสุดเพื่ออัปเดตและ Deploy</button>`
    );
  }
}

/* AUTH & RBAC (Req 2 & Req 4: USER & PASS ONLY) */
