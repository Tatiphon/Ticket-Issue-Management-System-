function handleKbFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showNotification("ขนาดไฟล์เอกสารแนบเกิน 10MB", "warning");
    clearKbAttachment();
    return;
  }
  readAndPrepareAttachmentFile(file, (dataUrl, fileName, mimeType, origSize) => {
    state.currentKbAttachmentName = fileName;
    state.currentKbAttachmentBase64 = dataUrl;
    state.currentKbAttachmentMime = mimeType;

    const preview = document.getElementById("kbFilePreviewName");
    const txt = document.getElementById("kbFileSelectedText");
    const btn = document.getElementById("btnClearKbFile");
    const thumbWrap = document.getElementById("kbFileThumbWrapper");
    const thumbImg = document.getElementById("kbFileThumbImg");

    if (txt) txt.textContent = `${fileName} (${(origSize / 1024).toFixed(1)} KB)`;
    if (preview) preview.classList.remove("hidden");
    if (btn) btn.classList.remove("hidden");
    if (isImageAttachment(fileName, dataUrl) && thumbWrap && thumbImg) {
      thumbImg.src = dataUrl;
      thumbWrap.classList.remove("hidden");
    } else if (thumbWrap) {
      thumbWrap.classList.add("hidden");
    }
  });
}

function clearKbAttachment() {
  state.currentKbAttachmentName = "";
  state.currentKbAttachmentBase64 = "";
  state.currentKbAttachmentMime = "";
  const input = document.getElementById("kbFileInput");
  if (input) input.value = "";
  const preview = document.getElementById("kbFilePreviewName");
  const btn = document.getElementById("btnClearKbFile");
  const thumbWrap = document.getElementById("kbFileThumbWrapper");
  if (preview) preview.classList.add("hidden");
  if (btn) btn.classList.add("hidden");
  if (thumbWrap) thumbWrap.classList.add("hidden");
}

function downloadKbAttachment(kbId) {
  const k = state.knowledgeBase.find(item => item.kb_id === kbId);
  if (!k) return;
  const info = resolveAttachmentInfo(k, "kb_id");
  if (info && info.base64) {
    const a = document.createElement("a");
    a.href = info.base64;
    a.download = info.name || "kb-document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else if (info && info.driveDirectUrl) {
    window.open(info.driveDirectUrl, "_blank", "noopener,noreferrer");
  } else if (k.doc_url) {
    window.open(k.doc_url, "_blank", "noopener,noreferrer");
  } else if (info) {
    openKbAttachmentPreview(kbId);
  } else {
    showNotification("บทความนี้ไม่มีไฟล์แนบ", "info");
  }
}

function getDisabledKbIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KB_DISABLED_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

function saveDisabledKbIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY_KB_DISABLED_IDS, JSON.stringify(Array.isArray(ids) ? ids : []));
  } catch (_) {}
}

function isKbArticleEnabled(k) {
  if (!k) return false;
  if (k.enabled === false) return false;
  const disabledIds = getDisabledKbIds();
  return !disabledIds.includes(k.kb_id);
}

function applyKbFeatureVisibility() {
  const enabled = state.kbEnabled !== false;
  const user = state.currentUser;
  const isAdmin = user && (user.role === "admin" || user.role === "superadmin");

  const navDivider = document.getElementById("userNavKbDivider");
  const navWrapper = document.getElementById("userNavKbWrapper");
  if (navDivider) {
    if (enabled) {
      navDivider.classList.remove("hidden");
      navDivider.classList.add("sm:block");
    } else {
      navDivider.classList.add("hidden");
      navDivider.classList.remove("sm:block");
    }
  }
  if (navWrapper) {
    navWrapper.classList.toggle("hidden", !enabled);
  }

  const sidebarBadge = document.getElementById("sidebarKbStatusBadge");
  if (sidebarBadge) {
    sidebarBadge.innerText = enabled ? "เปิด" : "ปิด";
    sidebarBadge.className = enabled
      ? "px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800"
      : "px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600";
  }

  const toggleInput = document.getElementById("kbGlobalToggleInput");
  if (toggleInput) toggleInput.checked = enabled;

  const toggleLabel = document.getElementById("kbGlobalToggleLabel");
  if (toggleLabel) {
    toggleLabel.innerText = enabled ? "เปิดใช้งานคลังความรู้" : "ปิดคลังความรู้ชั่วคราว";
  }

  const globalBadge = document.getElementById("kbGlobalStatusBadge");
  if (globalBadge) {
    globalBadge.innerText = enabled ? "🟢 เปิดใช้งาน" : "🔴 ปิดการแสดงผลชั่วคราว";
    globalBadge.className = enabled
      ? "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
      : "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200";
  }

  const disabledBanner = document.getElementById("kbDisabledNoticeBanner");
  if (disabledBanner) {
    disabledBanner.classList.toggle("hidden", enabled);
  }

  const searchWrapper = document.getElementById("kbSearchAndListWrapper");
  if (searchWrapper) {
    searchWrapper.classList.toggle("hidden", !enabled && !isAdmin);
  }

  if (!enabled && !isAdmin) {
    const kbTabContent = document.getElementById("tabContent-kbTab");
    if (kbTabContent && !kbTabContent.classList.contains("hidden")) {
      if (typeof switchTab === "function") switchTab("borrowTab");
    }
  }
}

function toggleKnowledgeBaseEnabled(enabled) {
  state.kbEnabled = !!enabled;
  try {
    localStorage.setItem(STORAGE_KEY_KB_ENABLED, state.kbEnabled ? "true" : "false");
    if (!state.emailConfig || typeof state.emailConfig !== "object") {
      state.emailConfig = {};
    }
    state.emailConfig.kbEnabled = state.kbEnabled;
    saveEmailConfigToStorage();
  } catch (_) {}

  applyKbFeatureVisibility();
  renderKnowledgeBaseList();

  showNotification(
    state.kbEnabled
      ? "เปิดใช้งานคลังความรู้และคู่มือไอที (Knowledge Base) สำหรับผู้ใช้งานแล้ว"
      : "ปิดการแสดงผลคลังความรู้และคู่มือไอที (ซ่อนจากผู้ใช้งานทั่วไปแล้ว)",
    state.kbEnabled ? "success" : "warning"
  );

  saveAllEmailSettingsToServer(true);
}

function toggleKbArticleEnabled(kbId) {
  const article = state.knowledgeBase.find(k => k.kb_id === kbId);
  if (!article) return;
  const currentlyEnabled = isKbArticleEnabled(article);
  const nextEnabled = !currentlyEnabled;
  article.enabled = nextEnabled;

  let disabledIds = getDisabledKbIds();
  if (nextEnabled) {
    disabledIds = disabledIds.filter(id => id !== kbId);
  } else if (!disabledIds.includes(kbId)) {
    disabledIds.push(kbId);
  }
  saveDisabledKbIds(disabledIds);
  try {
    if (!state.emailConfig || typeof state.emailConfig !== "object") {
      state.emailConfig = {};
    }
    state.emailConfig.kbDisabledIds = disabledIds;
    saveEmailConfigToStorage();
  } catch (_) {}

  renderKnowledgeBaseList();
  showNotification(
    nextEnabled
      ? `เปิดแสดงบทความ [${article.kb_id}] ${article.title} แล้ว`
      : `ซ่อนบทความ [${article.kb_id}] ${article.title} จากผู้ใช้งานชั่วคราวแล้ว`,
    nextEnabled ? "success" : "info"
  );
  saveAllEmailSettingsToServer(true);
}

function renderKnowledgeBaseList() {
  applyKbFeatureVisibility();
  const container = document.getElementById("kbListContainer");
  const q = (document.getElementById("kbSearchInput")?.value || "").toLowerCase().trim();
  if (!container) return;

  if (state.isInitialLoading) {
    container.innerHTML = `<div class="col-span-full">${getDatabaseLoadingBlockHtml("กำลังโหลดบทความคลังความรู้ไอทีจากฐานข้อมูล...")}</div>`;
    return;
  }

  const user = state.currentUser;
  const isAdmin = user && (user.role === "admin" || user.role === "superadmin");

  if (state.kbEnabled === false && !isAdmin) {
    container.innerHTML = '<p class="text-xs text-slate-400 py-8 text-center col-span-full">ขณะนี้ระบบคลังความรู้และคู่มือไอทีปิดปรับปรุงชั่วคราว</p>';
    return;
  }

  const filtered = state.knowledgeBase.filter(k => {
    if (!isAdmin && !isKbArticleEnabled(k)) return false;
    return !q || safeLower(k.title).includes(q) || safeLower(k.content).includes(q) || safeLower(k.category).includes(q);
  });
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 py-8 text-center col-span-full">ไม่พบคู่มือที่ตรงกับคำค้นหา</p>';
    return;
  }

  container.innerHTML = filtered.map(k => {
    const isArtEnabled = isKbArticleEnabled(k);
    let attachmentBadge = "";
    const info = resolveAttachmentInfo(k, "kb_id");
    if (info) {
      const thumbHtml = info.isImage && info.displaySrc
        ? `<div onclick="openKbAttachmentPreview('${escapeQuotes(k.kb_id)}')" class="mt-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-40 flex items-center justify-center p-1 cursor-pointer hover:border-tcc-400 transition group relative">
            <img src="${info.displaySrc}" alt="${escapeQuotes(info.name)}" class="max-h-36 w-auto object-contain rounded-lg" />
            <div class="absolute inset-0 bg-slate-900/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span class="px-2.5 py-1 rounded-lg bg-white text-slate-900 font-bold text-[11px] shadow">🔍 ดูรูปภาพขนาดใหญ่</span>
            </div>
          </div>`
        : "";
      attachmentBadge = `
        <div class="pt-2 border-t border-slate-100 space-y-2">
          ${thumbHtml}
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="text-[11px] text-slate-500 font-medium truncate max-w-[160px]" title="${escapeQuotes(info.name)}">${info.isImage ? '🖼️' : '📎'} ${info.name}</span>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="openKbAttachmentPreview('${escapeQuotes(k.kb_id)}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tcc-50 hover:bg-tcc-100 text-tcc-700 font-bold text-xs transition border border-tcc-200">
                🔍 ดูไฟล์
              </button>
              <button type="button" onclick="downloadKbAttachment('${escapeQuotes(k.kb_id)}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition border border-emerald-200/60">
                ⬇️ ดาวน์โหลด
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (k.doc_url) {
      attachmentBadge = `
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span class="text-[11px] text-slate-500 font-medium">เอกสารออนไลน์:</span>
          <a href="${k.doc_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition border border-blue-200/60 shadow-xs">
            <span>🔗</span> <span>เปิดเอกสารคู่มือ</span> <span>↗</span>
          </a>
        </div>
      `;
    }

    const adminArticleToggle = isAdmin
      ? `<button type="button" onclick="toggleKbArticleEnabled('${escapeQuotes(k.kb_id)}')" class="px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${isArtEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'}" title="คลิกเพื่อเปิด/ปิดการแสดงบทความนี้">
          ${isArtEnabled ? '● เปิดแสดง' : '○ ปิดซ่อน'}
        </button>`
      : "";

    return `
      <div class="p-4 rounded-2xl border ${isArtEnabled ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/70 opacity-75'} hover:border-tcc-400 shadow-sm transition space-y-2.5 flex flex-col justify-between">
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-1.5 flex-wrap">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">${k.category}</span>
            <div class="flex items-center gap-1.5">
              ${adminArticleToggle}
              <span class="font-mono text-[10px] text-slate-400">${k.kb_id}</span>
            </div>
          </div>
          <h4 class="font-bold text-slate-900 text-sm leading-snug">${k.title}</h4>
          <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">${k.content}</p>
        </div>
        ${attachmentBadge}
      </div>
    `;
  }).join("");
}

function openAddKbModal() {
  clearRichEditor("inputKbContentEditor");
  document.getElementById("addKbModal").classList.remove("hidden");
}
function closeAddKbModal() { document.getElementById("addKbModal").classList.add("hidden"); }

async function handleSaveKbArticle(e) {
  e.preventDefault();
  const docUrl = document.getElementById("inputKbDocUrl")?.value.trim() || "";
  const kbId = "KB-" + String(state.knowledgeBase.length + 1).padStart(3, "0");
  const attachName = state.currentKbAttachmentName || "";
  const attachBase64 = state.currentKbAttachmentBase64 || "";
  const kbEditorData = getRichEditorData("inputKbContentEditor");
  const kbContentText = kbEditorData.text || (document.getElementById("inputKbContent")?.value || "").trim();
  if (!kbContentText) {
    focusRichEditor("inputKbContentEditor");
    return showNotification("กรุณากรอกขั้นตอนหรือคำตอบแนะนำ", "warning");
  }

  const newArticle = {
    kb_id: kbId,
    category: document.getElementById("inputKbCategory").value,
    title: document.getElementById("inputKbTitle").value.trim(),
    content: kbContentText,
    doc_url: docUrl,
    attachment_name: attachName,
    attachment_base64: attachBase64,
    attachment_url: "",
    drive_file_id: "",
    enabled: true
  };

  if (attachName && attachBase64) {
    saveAttachmentToCache(kbId, attachName, attachBase64, "", "");
  }

  state.knowledgeBase.unshift(newArticle);
  closeAddKbModal();
  clearKbAttachment();
  const urlInput = document.getElementById("inputKbDocUrl");
  if (urlInput) urlInput.value = "";
  const titleInput = document.getElementById("inputKbTitle");
  if (titleInput) titleInput.value = "";
  const contentInput = document.getElementById("inputKbContent");
  if (contentInput) contentInput.value = "";
  clearRichEditor("inputKbContentEditor");

  showNotification(`เพิ่มบทความ [${newArticle.title}] เรียบร้อย`, "success");
  renderKnowledgeBaseList();

  if (attachName && attachBase64) {
    const driveRes = await uploadFileToGoogleDrive(attachBase64, `${kbId}_${attachName}`, "KnowledgeBase", kbId);
    if (driveRes && (driveRes.fileId || driveRes.viewUrl)) {
      const isSimDrive = String(driveRes.fileId || "").startsWith("DRV_");
      newArticle.drive_file_id = isSimDrive ? "" : (driveRes.fileId || "");
      newArticle.attachment_url = isSimDrive ? "" : (driveRes.viewUrl || "");
      if (!isSimDrive && !newArticle.doc_url && driveRes.viewUrl) newArticle.doc_url = driveRes.viewUrl;
      saveAttachmentToCache(kbId, attachName, attachBase64, driveRes.viewUrl || "", driveRes.fileId || "");
      renderKnowledgeBaseList();
    } else if (!state.useDemoMode) {
      showNotification("อัปโหลดไฟล์แนบขึ้น Google Drive ไม่สำเร็จ (ระบบจะไม่เก็บไฟล์ลงฐานข้อมูล Supabase)", "warning");
    }
  }

  const kbPayload = {
    ...newArticle,
    attachment_base64: ""
  };
  callAPI("saveKbArticle", { articleData: kbPayload }, true);
}

function openKbQuickSelectModal() {
  const list = document.getElementById("quickKbOptionsList");
  if (!list) return;
  if (state.isInitialLoading) {
    list.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดบทความคลังความรู้...");
    document.getElementById("quickKbModal").classList.remove("hidden");
    return;
  }
  const enabledArticles = state.knowledgeBase.filter(k => isKbArticleEnabled(k));
  if (enabledArticles.length === 0) {
    list.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">ไม่มีบทความคลังความรู้ที่เปิดใช้งานอยู่</p>';
  } else {
    list.innerHTML = enabledArticles.map(k => `
      <div onclick="selectKbAnswer('${escapeQuotes(k.content)}')" class="p-2.5 rounded-xl border border-slate-200 hover:bg-tcc-50 hover:border-tcc-400 cursor-pointer transition">
        <p class="font-bold text-xs text-slate-900">${k.title}</p>
        <p class="text-[11px] text-slate-500 line-clamp-2 mt-0.5">${k.content}</p>
      </div>
    `).join("");
  }
  document.getElementById("quickKbModal").classList.remove("hidden");
}
function closeKbQuickSelectModal() { document.getElementById("quickKbModal").classList.add("hidden"); }

function selectKbAnswer(text) {
  setRichEditorContent("replyMessageInput", text, false);
  focusRichEditor("replyMessageInput");
  closeKbQuickSelectModal();
}

/* ASSET FUNCTIONS & GENERAL HELPERS */
