function extractDriveFolderId(rawInput) {
  const s = String(rawInput || "").trim();
  if (!s) return "";
  const mFolder = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (mFolder) return mFolder[1];
  const mId = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (mId) return mId[1];
  return s;
}

function extractDriveFileIdFromUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  const m1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m2) return m2[1];
  const m3 = s.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m3) return m3[1];
  const m4 = s.match(/^([a-zA-Z0-9_-]{20,})$/);
  if (m4 && !s.includes("/") && !s.includes(".")) return m4[1];
  return "";
}
const extractGoogleDriveFileId = extractDriveFileIdFromUrl;

function handleEquipmentImageError(imgEl, driveFileId, fallbackSrc) {
  if (!imgEl) return;
  const step = parseInt(imgEl.dataset.errStep || "0", 10);
  if (step === 0 && driveFileId && !String(driveFileId).startsWith("DRV_")) {
    imgEl.dataset.errStep = "1";
    imgEl.src = `https://lh3.googleusercontent.com/d/${driveFileId}=w1000`;
    return;
  }
  if (step <= 1 && driveFileId && !String(driveFileId).startsWith("DRV_")) {
    imgEl.dataset.errStep = "2";
    imgEl.src = `https://drive.google.com/uc?export=view&id=${driveFileId}`;
    return;
  }
  imgEl.onerror = null;
  if (fallbackSrc) imgEl.src = fallbackSrc;
}

function saveDriveFolderSetting() {
  const input = document.getElementById("inputDriveFolderId");
  const folderId = extractDriveFolderId(input ? input.value : "");
  state.driveFolderId = folderId;
  try {
    localStorage.setItem(STORAGE_KEY_DRIVE_FOLDER, folderId);
  } catch (e) {}
  if (input) input.value = folderId;
  if (folderId) {
    showNotification(`บันทึก Google Drive Folder ID [${folderId}] เรียบร้อย`, "success");
  } else {
    showNotification("ตั้งค่าให้ระบบสร้างโฟลเดอร์ TCC_IT_System_Attachments ใน Google Drive อัตโนมัติ", "info");
  }
}

function isImageAttachment(fileName, dataOrUrl) {
  const d = String(dataOrUrl || "").trim();
  if (d.startsWith("data:image/")) return true;
  if (d.includes("drive.google.com/thumbnail") || d.includes("googleusercontent.com")) return true;
  const ext = String(fileName || "").toLowerCase().split(".").pop();
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
}

function loadAttachmentsCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ATTACHMENTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveAttachmentToCache(refId, fileName, base64Data, driveViewUrl = "", driveFileId = "") {
  if (!refId && !fileName) return;
  try {
    const cache = loadAttachmentsCache();
    const entry = {
      name: fileName || "",
      base64: base64Data || "",
      driveUrl: driveViewUrl || "",
      driveFileId: driveFileId || "",
      updatedAt: Date.now()
    };
    if (refId) cache[refId] = entry;
    if (fileName) cache["file:" + fileName.toLowerCase()] = entry;
    localStorage.setItem(STORAGE_KEY_ATTACHMENTS, JSON.stringify(cache));
  } catch (e) {
    // If localStorage quota is tight, keep only the 15 most recent entries
    try {
      const cache = loadAttachmentsCache();
      const keys = Object.keys(cache).sort((a, b) => (cache[b]?.updatedAt || 0) - (cache[a]?.updatedAt || 0)).slice(0, 10);
      const trimmed = {};
      keys.forEach(k => { trimmed[k] = cache[k]; });
      if (refId) trimmed[refId] = { name: fileName || "", base64: base64Data || "", driveUrl: driveViewUrl || "", driveFileId: driveFileId || "", updatedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY_ATTACHMENTS, JSON.stringify(trimmed));
    } catch (err) {}
  }
}

function getAttachmentFromCache(refId, fileName) {
  const cache = loadAttachmentsCache();
  if (refId && cache[refId]) return cache[refId];
  if (fileName && cache["file:" + String(fileName).toLowerCase()]) return cache["file:" + String(fileName).toLowerCase()];
  return null;
}

function generateFallbackDiagnosticImage(fileName, title, refId) {
  const safeName = String(fileName || "attachment.png").replace(/[<>&"']/g, "");
  const safeTitle = String(title || "ภาพหน้าจอประกอบการแจ้งซ่อมไอที").slice(0, 55).replace(/[<>&"']/g, "");
  const safeRef = String(refId || "ITC").replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e3a8a"/>
      </linearGradient>
    </defs>
    <rect width="800" height="480" rx="18" fill="url(#bg)"/>
    <rect x="28" y="28" width="744" height="424" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 4"/>
    <rect x="28" y="28" width="744" height="46" rx="14" fill="#0284c7"/>
    <circle cx="56" cy="51" r="7" fill="#f43f5e"/>
    <circle cx="78" cy="51" r="7" fill="#f59e0b"/>
    <circle cx="100" cy="51" r="7" fill="#10b981"/>
    <text x="125" y="56" fill="#ffffff" font-family="sans-serif" font-size="15" font-weight="bold">TCC IT Helpdesk Screenshot • ${safeName}</text>
    <rect x="70" y="110" width="660" height="230" rx="12" fill="#0f172a" stroke="#475569" stroke-width="1.5"/>
    <path d="M90 175 L710 175 M90 225 L710 225 M90 275 L710 275" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.25" stroke-dasharray="12 6"/>
    <text x="400" y="165" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="18" font-weight="bold">[ ไฟล์ภาพแนบในระบบ: ${safeName} ]</text>
    <text x="400" y="210" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="20" font-weight="bold">${safeTitle}</text>
    <text x="400" y="255" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">รหัสอ้างอิง: ${safeRef} • จัดเก็บในระบบ IT System Management &amp; Google Drive</text>
    <rect x="250" y="282" width="300" height="34" rx="8" fill="#0284c7" fill-opacity="0.25" stroke="#38bdf8"/>
    <text x="400" y="304" text-anchor="middle" fill="#7dd3fc" font-family="sans-serif" font-size="13" font-weight="bold">☁️ Google Drive Attachment Preview</text>
    <text x="400" y="395" text-anchor="middle" fill="#cbd5e1" font-family="sans-serif" font-size="13">ฝ่ายเทคโนโลยีสารสนเทศ หอการค้าไทย (Thai Chamber of Commerce)</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function resolveAttachmentInfo(record, idField = "ticket_id") {
  if (!record) return null;
  const refId = record[idField] || "";
  const cached = getAttachmentFromCache(refId, record.attachment_name);
  const name = record.attachment_name || cached?.name || (record.attachment_url ? "ไฟล์แนบ Google Drive" : "");
  const base64 = record.attachment_base64 || cached?.base64 || "";
  const rawDriveUrl = record.attachment_url || record.doc_url || cached?.driveUrl || "";
  const driveFileId = record.drive_file_id || cached?.driveFileId || extractDriveFileIdFromUrl(rawDriveUrl);

  if (!name && !base64 && !rawDriveUrl && !driveFileId) return null;

  const isSimulatedDriveId = String(driveFileId || "").startsWith("DRV_");
  const driveViewUrl = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/view`
    : (rawDriveUrl && rawDriveUrl.startsWith("http") ? rawDriveUrl : "");
  const driveThumbUrl = (driveFileId && !isSimulatedDriveId)
    ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`
    : "";
  const driveDirectUrl = (driveFileId && !isSimulatedDriveId)
    ? `https://drive.google.com/uc?export=download&id=${driveFileId}`
    : "";

  const isImg = isImageAttachment(name, base64 || driveThumbUrl || rawDriveUrl);
  let displaySrc = base64 || driveThumbUrl || rawDriveUrl;
  if (!displaySrc && isImg) {
    displaySrc = generateFallbackDiagnosticImage(name, record.title || "", refId);
  }

  return {
    refId,
    name: name || "attachment",
    isImage: isImg,
    displaySrc,
    base64,
    driveFileId,
    driveViewUrl,
    driveDirectUrl
  };
}

function readAndPrepareAttachmentFile(file, onDone, maxSizeMB = 10) {
  if (!file) return;
  if (file.size > maxSizeMB * 1024 * 1024) {
    showNotification(`ขนาดไฟล์แนบเกิน ${maxSizeMB}MB กรุณาเลือกไฟล์ขนาดไม่เกิน ${maxSizeMB}MB`, "warning");
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    const rawDataUrl = evt.target.result;
    // Compress large raster images so they upload smoothly to Google Drive & Google Sheets
    if (file.type && file.type.startsWith("image/") && file.type !== "image/svg+xml" && file.type !== "image/gif" && file.size > 250 * 1024) {
      const img = new Image();
      img.onload = function() {
        try {
          const maxDim = 1400;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
            else { w = Math.round((w * maxDim) / h); h = maxDim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          onDone(compressed, file.name, "image/jpeg", file.size);
        } catch (err) {
          onDone(rawDataUrl, file.name, file.type || "application/octet-stream", file.size);
        }
      };
      img.onerror = function() {
        onDone(rawDataUrl, file.name, file.type || "application/octet-stream", file.size);
      };
      img.src = rawDataUrl;
    } else {
      onDone(rawDataUrl, file.name, file.type || "application/octet-stream", file.size);
    }
  };
  reader.readAsDataURL(file);
}

async function uploadFileToGoogleDrive(base64Data, fileName, subFolder = "Tickets", refId = "") {
  if (!base64Data || !fileName) return null;
  const payload = {
    base64Data,
    fileName,
    folderId: state.driveFolderId || "",
    subFolder,
    refId
  };
  try {
    const res = await callAPI("uploadFileToDrive", payload, true);
    if (res && res.status === "success" && (res.fileId || res.viewUrl)) {
      saveAttachmentToCache(refId, fileName, base64Data, res.viewUrl || "", res.fileId || "");
      return res;
    }
    // Fallback to local simulator if deployed GAS script has not been updated with uploadFileToDrive yet
    const simRes = await simulateBackend("uploadFileToDrive", payload);
    if (simRes && simRes.status === "success") {
      saveAttachmentToCache(refId, fileName, base64Data, simRes.viewUrl || "", simRes.fileId || "");
      return simRes;
    }
  } catch (e) {
    console.warn("Google Drive upload fallback to local cache:", e);
  }
  saveAttachmentToCache(refId, fileName, base64Data, "", "");
  return null;
}

function openAttachmentPreviewModal(info) {
  if (!info) return;
  state.activePreviewAttachment = info;
  const modal = document.getElementById("attachmentPreviewModal");
  const titleEl = document.getElementById("previewModalTitle");
  const subEl = document.getElementById("previewModalSubtitle");
  const bodyEl = document.getElementById("previewModalBody");
  const driveLink = document.getElementById("previewModalDriveLink");
  if (!modal || !bodyEl) return;

  if (titleEl) titleEl.innerText = info.name || "ไฟล์แนบ";
  if (subEl) {
    subEl.innerText = info.driveViewUrl
      ? "☁️ จัดเก็บใน Google Drive เรียบร้อยแล้ว (คลิกที่รูปเพื่อขยาย/ย่อ)"
      : "☁️ จัดเก็บในระบบเรียบร้อยแล้ว (คลิกที่รูปเพื่อขยาย/ย่อ)";
  }

  if (driveLink) {
    if (info.driveViewUrl) {
      driveLink.href = info.driveViewUrl;
      driveLink.classList.remove("hidden");
      driveLink.classList.add("inline-flex");
    } else {
      driveLink.classList.add("hidden");
      driveLink.classList.remove("inline-flex");
    }
  }

  if (info.isImage && info.displaySrc) {
    const fallbackSrc = info.fallbackSvg || generateFallbackDiagnosticImage(info.name, info.name, info.refId);
    const onerrorAttr = info.driveFileId && !String(info.driveFileId).startsWith("DRV_")
      ? `handleEquipmentImageError(this, '${escapeQuotes(info.driveFileId)}', '${fallbackSrc}');`
      : `this.onerror=null; this.src='${fallbackSrc}';`;
    bodyEl.innerHTML = `
      <div class="flex flex-col items-center justify-center w-full gap-3">
        <img id="previewLightboxImg"
             src="${info.displaySrc}"
             alt="${escapeQuotes(info.name)}"
             data-err-step="0"
             onerror="${onerrorAttr}"
             onclick="this.classList.toggle('max-h-[65vh]'); this.classList.toggle('max-w-none'); this.classList.toggle('scale-125');"
             class="max-h-[65vh] max-w-full w-auto object-contain rounded-xl shadow-2xl border border-slate-700 cursor-zoom-in transition-transform duration-200 bg-slate-800">
      </div>
    `;
  } else if (info.displaySrc && String(info.displaySrc).startsWith("data:application/pdf")) {
    bodyEl.innerHTML = `<iframe src="${info.displaySrc}" class="w-full h-[65vh] rounded-xl bg-white border-0"></iframe>`;
  } else {
    bodyEl.innerHTML = `
      <div class="bg-white rounded-2xl p-6 text-center max-w-sm mx-auto space-y-3">
        <div class="w-14 h-14 rounded-2xl bg-tcc-50 text-tcc-700 flex items-center justify-center text-2xl mx-auto">📎</div>
        <div class="font-bold text-slate-900 text-sm break-all">${info.name}</div>
        <p class="text-xs text-slate-500">กดปุ่ม "ดาวน์โหลดไฟล์" ด้านบนเพื่อเปิดไฟล์เอกสารนี้</p>
      </div>
    `;
  }

  modal.classList.remove("hidden");
}

function closeAttachmentPreviewModal() {
  document.getElementById("attachmentPreviewModal")?.classList.add("hidden");
  state.activePreviewAttachment = null;
}

function downloadCurrentPreviewAttachment() {
  const info = state.activePreviewAttachment;
  if (!info) return;
  const href = info.base64 || info.driveDirectUrl || info.displaySrc || info.driveViewUrl;
  if (!href) {
    return showNotification("ไม่พบข้อมูลไฟล์สำหรับดาวน์โหลด", "warning");
  }
  if (href.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = href;
    a.download = info.name || "attachment";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotification(`ดาวน์โหลดไฟล์ [${info.name}] เรียบร้อย`, "success");
  } else {
    window.open(href, "_blank");
  }
}

function resolveTicketAttachmentsList(ticket) {
  if (!ticket) return [];
  const refId = ticket.ticket_id || "";
  const list = [];
  const seenNames = new Set();

  const normalizeEntry = (att, idx) => {
    if (!att) return null;
    const rawName = att.name || att.attachment_name || "";
    const cached = getAttachmentFromCache(refId, rawName);
    const name = rawName || cached?.name || (att.url || att.attachment_url ? `ไฟล์แนบ ${idx + 1}` : "");
    const base64 = att.base64 || att.attachment_base64 || cached?.base64 || "";
    const rawDriveUrl = att.url || att.attachment_url || cached?.driveUrl || "";
    const driveFileId = att.drive_file_id || cached?.driveFileId || extractDriveFileIdFromUrl(rawDriveUrl);
    if (!name && !base64 && !rawDriveUrl && !driveFileId) return null;
    const isSimulatedDriveId = String(driveFileId || "").startsWith("DRV_");
    const driveViewUrl = driveFileId
      ? `https://drive.google.com/file/d/${driveFileId}/view`
      : (rawDriveUrl && rawDriveUrl.startsWith("http") ? rawDriveUrl : "");
    const driveThumbUrl = (driveFileId && !isSimulatedDriveId)
      ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`
      : "";
    const driveDirectUrl = (driveFileId && !isSimulatedDriveId)
      ? `https://drive.google.com/uc?export=download&id=${driveFileId}`
      : "";
    const isImg = isImageAttachment(name, base64 || driveThumbUrl || rawDriveUrl);
    let displaySrc = base64 || driveThumbUrl || rawDriveUrl;
    if (!displaySrc && isImg) {
      displaySrc = generateFallbackDiagnosticImage(name, ticket.title || "", refId);
    }
    return {
      refId,
      name: name || `attachment_${idx + 1}`,
      isImage: isImg,
      displaySrc,
      base64,
      driveFileId,
      driveViewUrl,
      driveDirectUrl
    };
  };

  if (Array.isArray(ticket.attachments) && ticket.attachments.length > 0) {
    ticket.attachments.forEach((att, idx) => {
      const norm = normalizeEntry(att, idx);
      if (norm) {
        list.push(norm);
        seenNames.add(norm.name);
      }
    });
  }

  const legacy = resolveAttachmentInfo(ticket, "ticket_id");
  if (legacy && !seenNames.has(legacy.name) && (list.length === 0 || (legacy.base64 && !list.some(x => x.base64 === legacy.base64)))) {
    list.unshift(legacy);
  }

  return list;
}

function previewCurrentDraftAttachment(mode = "ticket", idx = 0) {
  if (mode === "ticket") {
    const list = Array.isArray(state.currentAttachments) && state.currentAttachments.length > 0
      ? state.currentAttachments
      : (state.currentAttachmentBase64 || state.currentAttachmentName
          ? [{ name: state.currentAttachmentName, base64: state.currentAttachmentBase64 }]
          : []);
    const item = list[idx] || list[0];
    if (!item) return;
    openAttachmentPreviewModal({
      refId: "DRAFT-TICKET",
      name: item.name || "ตัวอย่างรูปภาพแนบ",
      isImage: isImageAttachment(item.name, item.base64),
      displaySrc: item.base64,
      base64: item.base64,
      driveViewUrl: ""
    });
  } else {
    if (!state.currentKbAttachmentBase64 && !state.currentKbAttachmentName) return;
    openAttachmentPreviewModal({
      refId: "DRAFT-KB",
      name: state.currentKbAttachmentName || "ตัวอย่างไฟล์แนบคู่มือ",
      isImage: isImageAttachment(state.currentKbAttachmentName, state.currentKbAttachmentBase64),
      displaySrc: state.currentKbAttachmentBase64,
      base64: state.currentKbAttachmentBase64,
      driveViewUrl: ""
    });
  }
}

function openTicketAttachmentPreview(ticketId, index = 0) {
  const ticket = state.tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) return;
  const list = resolveTicketAttachmentsList(ticket);
  const info = list[index] || list[0];
  if (!info) return showNotification("เคสนี้ไม่มีไฟล์แนบ", "info");
  openAttachmentPreviewModal(info);
}

function openCommentAttachmentPreview(ticketId, commentIdx, attachIdx = 0) {
  const ticket = state.tickets.find(t => t.ticket_id === ticketId);
  if (!ticket || !Array.isArray(ticket.comments)) return;
  const comment = ticket.comments[commentIdx];
  if (!comment || !Array.isArray(comment.attachments)) return;
  const att = comment.attachments[attachIdx];
  if (!att) return;
  const name = att.name || `reply_file_${attachIdx + 1}`;
  const displaySrc = att.base64 || att.url || "";
  openAttachmentPreviewModal({
    refId: `${ticketId}-C${commentIdx}`,
    name,
    isImage: isImageAttachment(name, displaySrc),
    displaySrc,
    base64: att.base64 || "",
    driveFileId: att.drive_file_id || "",
    driveViewUrl: att.url || "",
    driveDirectUrl: ""
  });
}

function openKbAttachmentPreview(kbId) {
  const kb = state.knowledgeBase.find(k => k.kb_id === kbId);
  if (!kb) return;
  const info = resolveAttachmentInfo(kb, "kb_id");
  if (!info) return showNotification("บทความนี้ไม่มีไฟล์แนบ", "info");
  openAttachmentPreviewModal(info);
}
