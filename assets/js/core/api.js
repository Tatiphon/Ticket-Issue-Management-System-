function updateConnectionStatus(connected) {
  const dot = document.getElementById("connStatusDot");
  const txt = document.getElementById("connStatusText");
  const envTag = IS_UAT_ENV ? "UAT" : "PROD";
  if (dot && txt) {
    if (connected) {
      dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
      txt.className = "truncate max-w-[130px] sm:max-w-none text-emerald-700 font-medium";
      txt.innerText = `เชื่อมต่อ Supabase (${envTag})`;
    } else {
      dot.className = "w-2 h-2 rounded-full bg-amber-500";
      txt.className = "truncate max-w-[130px] sm:max-w-none text-amber-700 font-medium";
      txt.innerText = "โหมดจำลอง (Demo)";
    }
  }
}

function updateLastSyncedTime() {
  const el = document.getElementById("lastSyncText");
  if (el) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.innerText = `อัปเดต: ${timeStr} น.`;
  }
}

async function callAPI(action, payload = {}, isBackground = false) {
  // Step 5: Route Google Drive uploads & GAS email fallback to Google Apps Script
  if (GAS_ONLY_ACTIONS.has(action)) {
    if (!state.useDemoMode && state.webAppUrl && state.webAppUrl.trim() !== "") {
      try {
        const response = await fetch(state.webAppUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, ...payload })
        });
        if (!response.ok) {
          throw new Error(`GAS HTTP Error ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        console.warn(`GAS action "${action}" failed, fallback to simulator:`, err);
      }
    }
    return simulateBackend(action, payload);
  }

  // Step 4: Route all database operations to shared Supabase backend (/api/db) for both PROD & UAT
  if (!state.useDemoMode) {
    try {
      const response = await fetch(DB_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          env: IS_UAT_ENV ? "uat" : "prod",
          ...payload
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const result = await response.json();
      if (result && result.needsSupabaseConfig) {
        throw new Error(result.message || "Supabase environment variables not configured");
      }

      state.isLive = true;
      updateConnectionStatus(true);
      return result;
    } catch (err) {
      console.warn("Supabase (/api/db) connection failed, fallback to local simulator:", err);
      state.isLive = false;
      updateConnectionStatus(false);
      if (!isBackground) {
        showNotification("ไม่สามารถเชื่อมต่อฐานข้อมูล Supabase ได้ ข้อมูลทำงานในโหมดจำลองชั่วคราว", "warning");
      }
    }
  } else {
    state.isLive = false;
    updateConnectionStatus(false);
  }
  return simulateBackend(action, payload);
}

function simulateBackend(action, data = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      switch (action) {
        case "getInitialData": {
          syncItemStatuses();
          resolve({
            status: "success",
            items: [...state.items],
            activeBorrows: [...state.activeBorrows],
            allLogs: [...state.allLogs],
            categories: [...state.categories],
            ticketCategories: [...state.ticketCategories],
            internalSystems: [...(state.internalSystems || [])],
            departments: [...state.departments],
            userRoles: [...state.userRoles],
            tickets: [...state.tickets],
            knowledgeBase: [...state.knowledgeBase],
            emailNotifyEnabled: state.emailNotifyEnabled,
            emailConfig: state.emailConfig,
            emailTemplates: state.emailTemplates
          });
          break;
        }
        case "createTicket": {
          resolve({ status: "success", message: "บันทึกเคสในระบบจำลองเรียบร้อย", ticket_id: data.ticketData?.ticket_id });
          break;
        }
        case "updateTicket": {
          resolve({ status: "success", message: "อัปเดตเคสในระบบจำลองเรียบร้อย" });
          break;
        }
        case "borrowItem": {
          resolve({ status: "success", message: "บันทึกการยืมในระบบจำลองเรียบร้อย" });
          break;
        }
        case "returnItem": {
          resolve({ status: "success", message: "รับคืนอุปกรณ์ในระบบจำลองเรียบร้อย" });
          break;
        }
        case "saveUserRole": {
          resolve({ status: "success", message: "บันทึกสิทธิ์ในระบบจำลองเรียบร้อย" });
          break;
        }
        case "saveUserRolesBatch": {
          const list = data.rolesList || [];
          let added = 0, updated = 0;
          list.forEach(u => {
            if (!u || !u.email) return;
            const norm = normalizeUserRole(u);
            const idx = state.userRoles.findIndex(x => safeLower(x.email) === safeLower(norm.email));
            if (idx !== -1) {
              state.userRoles[idx] = normalizeUserRole({ ...state.userRoles[idx], ...norm });
              updated++;
            } else {
              state.userRoles.push(norm);
              added++;
            }
          });
          localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));
          resolve({
            status: "success",
            count: list.length,
            added: added,
            updated: updated,
            message: "บันทึกข้อมูลผู้ใช้งานจำนวน " + list.length + " รายการเรียบร้อย (จำลอง)"
          });
          break;
        }
        case "deleteUserRole": {
          resolve({ status: "success", message: "ลบสิทธิ์ในระบบจำลองเรียบร้อย" });
          break;
        }
        case "uploadFileToDrive": {
          const simId = "DRV_" + Date.now().toString(36).toUpperCase() + "_" + Math.random().toString(36).substring(2, 6).toUpperCase();
          const folderLabel = data.folderId ? `Folder:${data.folderId}` : `TCC_IT_System_Attachments/${data.subFolder || 'Tickets'}`;
          resolve({
            status: "success",
            fileId: simId,
            viewUrl: `https://drive.google.com/file/d/${simId}/view?usp=sharing`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${simId}`,
            thumbnailUrl: data.base64Data || "",
            folderName: folderLabel
          });
          break;
        }
        case "sendEmailNotification": {
          resolve({ status: "success", sent: false, simulated: true, message: "บันทึก Log จำลองเท่านั้น (ไม่ได้เชื่อมต่อ Live GAS)" });
          break;
        }
        case "checkEmailSetup": {
          resolve({ status: "success", simulated: true, mailAuthorized: false, message: "โหมดจำลอง (Demo Mode): ยังไม่ได้เชื่อมต่อ Google Apps Script จริง" });
          break;
        }
        case "saveEmailSettings": {
          if (data.emailNotifyEnabled !== undefined) {
            state.emailNotifyEnabled = !!data.emailNotifyEnabled;
            localStorage.setItem(STORAGE_KEY_EMAIL_ENABLED, state.emailNotifyEnabled ? "true" : "false");
          }
          if (data.emailConfig && typeof data.emailConfig === "object") {
            state.emailConfig = sanitizeEmailConfig(data.emailConfig);
            saveEmailConfigToStorage();
          }
          if (data.emailTemplates && typeof data.emailTemplates === "object") {
            Object.keys(data.emailTemplates).forEach(k => {
              if (state.emailTemplates[k] && data.emailTemplates[k]) {
                state.emailTemplates[k] = {
                  ...state.emailTemplates[k],
                  enabled: data.emailTemplates[k].enabled !== false,
                  subject: data.emailTemplates[k].subject || state.emailTemplates[k].subject,
                  body: data.emailTemplates[k].body || state.emailTemplates[k].body
                };
              }
            });
            saveEmailTemplatesToStorage();
          }
          resolve({ status: "success", message: "บันทึกการตั้งค่าอีเมลเรียบร้อย (จำลอง)" });
          break;
        }
        case "addItem":
        case "updateItem":
        case "addDepartment":
        case "deleteDepartment":
        case "addTicketCategory":
        case "updateTicketCategory":
        case "deleteTicketCategory":
        case "saveTicketCategoriesOrder":
        case "addInternalSystem":
        case "updateInternalSystem":
        case "deleteInternalSystem":
        case "saveInternalSystemsOrder":
        case "saveKbArticle":
        case "deleteKbArticle": {
          resolve({ status: "success", message: "ดำเนินการเรียบร้อย (จำลอง)" });
          break;
        }
        default: {
          resolve({ status: "success", message: "Action processed" });
          break;
        }
      }
    }, 120);
  });
}

async function refreshData(showToast = false) {
  if (state.isRefreshing) return;
  state.isRefreshing = true;

  const reloadIcons = document.querySelectorAll("#reloadIcon");
  reloadIcons.forEach(icon => icon.classList.add("animate-spin"));

  try {
    const res = await callAPI("getInitialData", {}, !showToast);
    if (res && res.status === "success") {
      state.isInitialLoading = false;
      if (Array.isArray(res.items)) {
        state.items = res.items.map(item => {
          const cached = getAttachmentFromCache(item.item_id);
          if (cached) {
            if (!item.image_name && cached.name) item.image_name = cached.name;
            if (!item.image_base64 && cached.base64) item.image_base64 = cached.base64;
            if (!item.image_url && cached.driveUrl) item.image_url = cached.driveUrl;
            if (!item.drive_file_id && cached.driveFileId) item.drive_file_id = cached.driveFileId;
          }
          return item;
        });
      }
      if (Array.isArray(res.activeBorrows)) state.activeBorrows = res.activeBorrows;
      if (Array.isArray(res.allLogs)) state.allLogs = res.allLogs;
      if (Array.isArray(res.tickets)) {
        const prevTicketsMap = new Map((state.tickets || []).map(pt => [String(pt.ticket_id || '').trim().toLowerCase(), pt]));
        state.tickets = res.tickets.map(t => {
          const cached = getAttachmentFromCache(t.ticket_id);
          if (cached) {
            if (!t.attachment_name && cached.name) t.attachment_name = cached.name;
            if (!t.attachment_base64 && cached.base64) t.attachment_base64 = cached.base64;
            if (!t.attachment_url && cached.driveUrl) t.attachment_url = cached.driveUrl;
            if (!t.drive_file_id && cached.driveFileId) t.drive_file_id = cached.driveFileId;
          }
          const prevT = prevTicketsMap.get(String(t.ticket_id || '').trim().toLowerCase());
          const richCached = typeof getTicketRichCache === 'function' ? getTicketRichCache(t.ticket_id) : null;
          if (!t.description_html) {
            if (prevT && prevT.description_html) t.description_html = prevT.description_html;
            else if (richCached && richCached.description_html) t.description_html = richCached.description_html;
          }
          if (!Array.isArray(t.attachments) || t.attachments.length === 0) {
            if (prevT && Array.isArray(prevT.attachments) && prevT.attachments.length > 0) t.attachments = prevT.attachments;
            else if (richCached && Array.isArray(richCached.attachments) && richCached.attachments.length > 0) t.attachments = richCached.attachments;
          }
          const fallbackComments = (prevT && Array.isArray(prevT.comments) && prevT.comments.length > 0)
            ? prevT.comments
            : (richCached && Array.isArray(richCached.comments) ? richCached.comments : null);
          if (fallbackComments) {
            if (!Array.isArray(t.comments) || t.comments.length === 0) {
              t.comments = fallbackComments;
            } else {
              t.comments = t.comments.map((cm, idx) => {
                const fc = fallbackComments[idx];
                if (fc && String(fc.sender || '') === String(cm.sender || '')) {
                  if (!cm.message_html && fc.message_html) cm.message_html = fc.message_html;
                  if ((!Array.isArray(cm.attachments) || cm.attachments.length === 0) && Array.isArray(fc.attachments) && fc.attachments.length > 0) {
                    cm.attachments = fc.attachments;
                  }
                  if (!cm.edited_at && fc.edited_at) {
                    cm.edited_at = fc.edited_at;
                    if (fc.message) cm.message = fc.message;
                  }
                }
                return cm;
              });
            }
          }
          return t;
        });
      }
      if (Array.isArray(res.knowledgeBase)) {
        state.knowledgeBase = res.knowledgeBase.map(k => {
          const cached = getAttachmentFromCache(k.kb_id);
          if (cached) {
            if (!k.attachment_name && cached.name) k.attachment_name = cached.name;
            if (!k.attachment_base64 && cached.base64) k.attachment_base64 = cached.base64;
            if (!k.attachment_url && cached.driveUrl) k.attachment_url = cached.driveUrl;
            if (!k.drive_file_id && cached.driveFileId) k.drive_file_id = cached.driveFileId;
          }
          return k;
        });
      }
      if (Array.isArray(res.categories)) state.categories = res.categories;
      if (Array.isArray(res.ticketCategories)) {
        state.ticketCategories = res.ticketCategories;
        saveTicketCategoriesToStorage();
      }
      if (Array.isArray(res.internalSystems)) {
        state.internalSystems = res.internalSystems;
        saveInternalSystemsToStorage();
      }
      if (Array.isArray(res.departments)) {
        state.departments = Array.from(new Set(res.departments.map(d => stripDepartmentNumberPrefix(d)).filter(Boolean)));
      }
      if (typeof res.emailNotifyEnabled === "boolean") {
        state.emailNotifyEnabled = res.emailNotifyEnabled;
        localStorage.setItem(STORAGE_KEY_EMAIL_ENABLED, state.emailNotifyEnabled ? "true" : "false");
      }
      if (res.emailConfig && typeof res.emailConfig === "object") {
        const incomingPass = String(res.emailConfig.smtpPass || "").replace(/\s+/g, "").trim();
        if (incomingPass) {
          setSessionSmtpPass(incomingPass);
        }
        state.emailConfig = sanitizeEmailConfig({
          ...state.emailConfig,
          ...res.emailConfig,
          smtpPass: incomingPass || getSessionSmtpPass() || state.emailConfig?.smtpPass || ""
        });
        saveEmailConfigToStorage();
        if (typeof state.emailConfig.kbEnabled === "boolean") {
          state.kbEnabled = state.emailConfig.kbEnabled;
          try {
            localStorage.setItem(STORAGE_KEY_KB_ENABLED, state.kbEnabled ? "true" : "false");
          } catch (_) {}
        }
        if (Array.isArray(state.emailConfig.kbDisabledIds)) {
          if (typeof saveDisabledKbIds === "function") {
            saveDisabledKbIds(state.emailConfig.kbDisabledIds);
          } else {
            try {
              localStorage.setItem(STORAGE_KEY_KB_DISABLED_IDS, JSON.stringify(state.emailConfig.kbDisabledIds));
            } catch (_) {}
          }
        }
      }
      if (res.emailTemplates && typeof res.emailTemplates === "object") {
        const mergedTpls = JSON.parse(JSON.stringify(DEFAULT_EMAIL_TEMPLATES));
        Object.keys(mergedTpls).forEach(k => {
          const inc = res.emailTemplates[k];
          if (inc && typeof inc === "object") {
            mergedTpls[k] = {
              ...mergedTpls[k],
              enabled: inc.enabled !== undefined ? !!inc.enabled : mergedTpls[k].enabled,
              subject: inc.subject || mergedTpls[k].subject,
              body: inc.body || mergedTpls[k].body
            };
          }
        });
        state.emailTemplates = mergedTpls;
        saveEmailTemplatesToStorage();
      }
      if (Array.isArray(res.userRoles)) {
        state.userRoles = mergeWithBuiltinRoles(res.userRoles);
        localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));

        if (state.currentUser) {
          const updatedMe = findMatchedUserInDatabase(state.currentUser.email) || findMatchedUserInDatabase(state.currentUser.name);
          if (!updatedMe || updatedMe.status === "disabled") {
            state.currentUser = null;
            localStorage.removeItem(STORAGE_KEY_USER);
            applyUserRoleUI();
            switchTab('borrowTab');
            showNotification("บัญชีผู้ใช้งานของคุณถูกลบหรือถูกระงับการใช้งาน ระบบจึงออกจากระบบอัตโนมัติ", "warning");
          } else {
            state.currentUser = {
              ...state.currentUser,
              email: updatedMe.email || state.currentUser.email,
              first_name: updatedMe.first_name || state.currentUser.first_name || "",
              last_name: updatedMe.last_name || state.currentUser.last_name || "",
              name: updatedMe.name || state.currentUser.name,
              dept: updatedMe.dept || state.currentUser.dept || "",
              role: updatedMe.role || "user",
              status: updatedMe.status || "active"
            };
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(state.currentUser));
            applyUserRoleUI();
          }
        }
      }

      syncItemStatuses();
      populateUserAutocompleteDatalists();
      renderAll();
      renderEmailSettingsTab();
      autoFillUserFormsFromDatabase(false);
      updateLastSyncedTime();
      if (showToast) showNotification("ซิงค์ข้อมูลล่าสุดกับฐานข้อมูล Supabase เรียบร้อย", "success");
    }
  } catch (err) {
    console.error("Data refresh error:", err);
  } finally {
    if (state.isInitialLoading) {
      state.isInitialLoading = false;
      renderAll();
    }
    state.isRefreshing = false;
    reloadIcons.forEach(icon => icon.classList.remove("animate-spin"));
  }
}

function isUserActivelyEditingModal() {
  const modalIds = [
    "editItemModal",
    "addItemModal",
    "ticketAdminActionModal",
    "roleModal",
    "editHistoryModal",
    "deptManageModal",
    "addKbModal"
  ];
  return modalIds.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
}

function startRealtimeAutoSync() {
  if (state.autoReloadTimer) {
    clearInterval(state.autoReloadTimer);
  }
  // Poll Supabase every 20 seconds when tab is visible and no edit modal is open
  state.autoReloadTimer = setInterval(() => {
    if (document.visibilityState === "visible" && !state.useDemoMode && !state.isRefreshing && !isUserActivelyEditingModal()) {
      refreshData(false);
    }
  }, 20000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !state.useDemoMode && !state.isRefreshing) {
      refreshData(false);
    }
  });

  window.addEventListener("focus", () => {
    if (!state.useDemoMode && !state.isRefreshing && !isUserActivelyEditingModal()) {
      refreshData(false);
    }
  });
}

function triggerManualReload() {
  refreshData(true);
}
