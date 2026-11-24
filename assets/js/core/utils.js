function splitFullName(fullName = "", firstName = "", lastName = "") {
  let fn = String(firstName || "").trim();
  let ln = String(lastName || "").trim();
  const full = String(fullName || "").trim();
  if (!fn && !ln && full) {
    const parts = full.split(/\s+/);
    fn = parts[0] || "";
    ln = parts.slice(1).join(" ") || "";
  }
  const combined = [fn, ln].filter(Boolean).join(" ") || full;
  return {
    first_name: fn || combined,
    last_name: ln,
    name: combined
  };
}

function normalizeEmailDomainTypos(rawEmail) {
  const clean = String(rawEmail || "").trim();
  if (!clean || !clean.includes("@")) return clean;
  return clean
    .replace(/@thaichamber\.ro\.th$/i, "@thaichamber.or.th")
    .replace(/@thaichamber\.ot\.th$/i, "@thaichamber.or.th")
    .replace(/@thaichamber\.or\.ht$/i, "@thaichamber.or.th");
}

function stripDepartmentNumberPrefix(rawDept) {
  return String(rawDept || "")
    .trim()
    .replace(/^\d+\s*[.)-]\s*/, "")
    .trim();
}

function normalizeUserRole(u = {}) {
  const email = normalizeEmailDomainTypos(String(u.email || "").trim());
  const rawFull = u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || (email ? email.split("@")[0] : "");
  const parsed = splitFullName(rawFull, u.first_name, u.last_name);
  const rawDept = u.dept !== undefined ? u.dept : (u.department || "");
  return {
    ...u,
    email: email,
    first_name: parsed.first_name,
    last_name: parsed.last_name,
    name: parsed.name,
    dept: stripDepartmentNumberPrefix(rawDept),
    role: String(u.role || "user").trim(),
    password: String(u.password || "123456").trim(),
    status: String(u.status || "active").trim(),
    remark: String(u.remark || "").trim()
  };
}

function getOffsetDate(daysOffset = 0, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(d.getHours() + hoursOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalTimestamp(offsetHours = 0) {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

/* Null-safe lowercase: data from Google Sheets may have empty/undefined/numeric cells */
function safeLower(v) {
  return (v === undefined || v === null) ? "" : String(v).toLowerCase();
}

function escapeQuotes(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ").replace(/\r/g, "");
}

/* ID GENERATORS (Req 1 & Req 6) */
function generateTicketId() {
  // ITC ตามด้วย ปี-เดือน-วัน ตามด้วยเลข 4 หลัก (ITC-YYYY-MM-DD-XXXX)
  // กรณีขึ้นปีใหม่ ให้เริ่มนับเลข 4 หลักใหม่ (0001)
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePart = `${yyyy}-${mm}-${dd}`;
  const prefixYear = `ITC-${yyyy}-`;

  let maxSeq = 0;
  (state.tickets || []).forEach(t => {
    const id = String(t.ticket_id || "").trim();
    if (id.startsWith(prefixYear)) {
      const m = id.match(/^ITC-\d{4}-\d{2}-\d{2}-(\d{4})$/);
      if (m) {
        const seq = parseInt(m[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  return `ITC-${datePart}-${String(nextSeq).padStart(4, "0")}`;
}

// Req 1: เลขรหัสธุรกรรมใช้ ITB-YYYY-MM-DD-XXXX (รีเซ็ตทุกปีใหม่)
function generateNextBorrowTransId(offset = 0) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePart = `${yyyy}-${mm}-${dd}`;
  const prefixYear = `ITB-${yyyy}-`;

  let maxSeq = 0;
  const allTx = [...(state.allLogs || []), ...(state.activeBorrows || [])];
  allTx.forEach(l => {
    const id = String(l.trans_id || "").trim();
    if (id.startsWith(prefixYear)) {
      const m = id.match(/^ITB-\d{4}-\d{2}-\d{2}-(\d{4})/);
      if (m) {
        const seq = parseInt(m[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
  });

  const nextSeq = maxSeq + 1 + offset;
  return `ITB-${datePart}-${String(nextSeq).padStart(4, "0")}`;
}

const generateBorrowBatchId = () => generateNextBorrowTransId(0);

function sanitizeRichHtml(rawHtml) {
  const html = String(rawHtml || "");
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const allowedTags = new Set(["B", "STRONG", "U", "I", "EM", "S", "STRIKE", "A", "BR", "P", "DIV", "SPAN", "FONT", "IMG", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "H1", "H2", "H3", "H4"]);
  const cleanNode = (node) => {
    if (node.nodeType === 3) return; // Text node
    if (node.nodeType !== 1) {
      node.remove();
      return;
    }
    const tag = node.tagName.toUpperCase();
    if (!allowedTags.has(tag)) {
      const text = document.createTextNode(node.textContent || "");
      node.replaceWith(text);
      return;
    }
    // Strip unsafe attributes
    Array.from(node.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      if (tag === "IMG" && (name === "src" || name === "alt")) {
        if (name === "src" && !/^data:image\/|^https?:\/\//i.test(attr.value)) {
          node.removeAttribute("src");
        }
      } else if (tag === "A" && (name === "href" || name === "target" || name === "rel")) {
        if (name === "href" && !/^https?:\/\/|^mailto:/i.test(attr.value)) {
          node.removeAttribute("href");
        } else if (name === "href") {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
      } else if (tag === "FONT" && name === "color") {
        // keep color
      } else if (name === "style") {
        const colorMatch = attr.value.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        const bgMatch = attr.value.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i);
        const fwMatch = attr.value.match(/(?:^|;)\s*font-weight\s*:\s*([^;]+)/i);
        const tdMatch = attr.value.match(/(?:^|;)\s*text-decoration(?:-line)?\s*:\s*([^;]+)/i);
        const parts = [];
        if (colorMatch) parts.push(`color: ${colorMatch[1].trim()}`);
        if (bgMatch) parts.push(`background-color: ${bgMatch[1].trim()}`);
        if (fwMatch) parts.push(`font-weight: ${fwMatch[1].trim()}`);
        if (tdMatch) parts.push(`text-decoration: ${tdMatch[1].trim()}`);
        if (parts.length > 0) node.setAttribute("style", parts.join("; "));
        else node.removeAttribute("style");
      } else {
        node.removeAttribute(attr.name);
      }
    });
    Array.from(node.childNodes).forEach(cleanNode);
  };
  Array.from(doc.body.childNodes).forEach(cleanNode);
  const cleaned = doc.body.innerHTML.trim();
  if (cleaned === "<p><br></p>" || cleaned === "<div><br></div>" || cleaned === "<br>") return "";
  return cleaned;
}

function normalizeDepartmentForComparison(dept) {
  return String(dept || "")
    .trim()
    .toLowerCase()
    .replace(/^\d+\s*[.)-]?\s*/, "")
    .replace(/\s+/g, " ");
}

function isSameDepartmentName(deptA, deptB) {
  const a = normalizeDepartmentForComparison(deptA);
  const b = normalizeDepartmentForComparison(deptB);
  if (!a || !b) return false;
  return a === b;
}

function getCurrentUserEffectiveDept(user) {
  if (!user) return "";
  if (user.dept && String(user.dept).trim()) return String(user.dept).trim();
  const matched = findMatchedUserInDatabase(user.email) || findMatchedUserInDatabase(user.name);
  return matched && matched.dept ? String(matched.dept).trim() : "";
}

function parseCsvLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '').trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').trim());
  return result;
}

function decodeTextBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  // 1. ตรวจสอบ UTF-8 BOM: 0xEF, 0xBB, 0xBF
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }
  // 2. ตรวจสอบ UTF-16 LE / BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder("utf-16be").decode(bytes.slice(2));
  }

  // 3. ตรวจหาว่ามี byte ภาษาไทยช่วงรหัส Windows-874 / TIS-620 (0xA1 - 0xFB) หรือไม่
  let thaiWin874Count = 0;
  let hasUtf8Thai = false;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0xA1 && bytes[i] <= 0xFB) thaiWin874Count++;
    if (i < bytes.length - 2 && bytes[i] === 0xE0 && (bytes[i + 1] === 0xB8 || bytes[i + 1] === 0xB9)) {
      hasUtf8Thai = true;
    }
  }

  // ถ้าพบ byte รหัสภาษาไทย Windows-874 แต่ไม่มี multibyte UTF-8 Thai เลย -> เป็น Windows-874 แน่นอน
  if (thaiWin874Count > 3 && !hasUtf8Thai) {
    try {
      return new TextDecoder("windows-874").decode(bytes);
    } catch (e) {
      try {
        return new TextDecoder("tis-620").decode(bytes);
      } catch (e2) {}
    }
  }

  // 4. ทดลองถอดรหัสแบบ UTF-8 fatal
  try {
    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    return utf8Decoder.decode(bytes);
  } catch (err) {
    // หากไม่ใช่ UTF-8 ให้ถอดรหัสด้วย Windows-874 / TIS-620 (ANSI ภาษาไทยของ Microsoft Excel)
    try {
      return new TextDecoder("windows-874").decode(bytes);
    } catch (e) {
      try {
        return new TextDecoder("tis-620").decode(bytes);
      } catch (e2) {
        return new TextDecoder("utf-8").decode(bytes);
      }
    }
  }
}

function ensureXlsxLoaded(callback) {
  if (window.XLSX) return callback(true);
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  script.onload = () => callback(true);
  script.onerror = () => callback(false);
  document.head.appendChild(script);
}

function readExcelFile(file, callback) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const buffer = evt.target.result;
      const data = new Uint8Array(buffer);
      const doParse = () => {
        try {
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          callback(null, rows);
        } catch (err) {
          callback(err);
        }
      };

      if (window.XLSX) {
        doParse();
      } else {
        ensureXlsxLoaded((ok) => {
          if (ok && window.XLSX) {
            doParse();
          } else {
            callback(new Error("ไม่สามารถโหลดไลบรารีอ่านไฟล์ Excel ได้ กรุณาเชื่อมต่ออินเทอร์เน็ตหรือแปลงไฟล์เป็น .csv"));
          }
        });
      }
    } catch (err) {
      callback(err);
    }
  };
  reader.onerror = () => callback(new Error("อ่านไฟล์ล้มเหลว"));
  reader.readAsArrayBuffer(file);
}

function formatThaiDateDisplay(isoDateStr) {
  const m = String(isoDateStr || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "วว/ดด/ปปปป";
  const yyyy = parseInt(m[1], 10);
  const beYear = yyyy < 2400 ? yyyy + 543 : yyyy;
  return `${m[3]}/${m[2]}/${beYear}`;
}

function updateThaiDateDisplay(inputId) {
  const input = document.getElementById(inputId);
  const disp = document.getElementById(inputId + "Display");
  if (!disp) return;
  const val = input ? input.value : "";
  disp.innerText = formatThaiDateDisplay(val);
  if (val) {
    disp.classList.remove("text-slate-400");
    disp.classList.add("text-slate-800");
  } else {
    disp.classList.add("text-slate-400");
    disp.classList.remove("text-slate-800");
  }
}
