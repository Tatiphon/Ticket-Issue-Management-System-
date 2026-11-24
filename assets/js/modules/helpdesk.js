function calculateSlaTarget(priority) {
  let hours = 24;
  if (priority === "Critical") hours = 2;
  else if (priority === "High") hours = 4;
  else if (priority === "Medium") hours = 24;
  else if (priority === "Low") hours = 48;
  return getLocalTimestamp(hours);
}

function syncLegacySingleAttachmentFromDraft() {
  const first = (state.currentAttachments || [])[0] || null;
  state.currentAttachmentName = first ? first.name : "";
  state.currentAttachmentBase64 = first ? first.base64 : "";
  state.currentAttachmentMime = first ? first.mime : "";
}

function renderTicketDraftAttachments() {
  const container = document.getElementById("ticketFilePreviewContainer");
  const grid = document.getElementById("ticketFilePreviewGrid");
  const badge = document.getElementById("ticketFileCountBadge");
  const list = state.currentAttachments || [];

  if (!container || !grid) return;
  if (list.length === 0) {
    container.classList.add("hidden");
    container.classList.remove("flex");
    grid.innerHTML = "";
    if (badge) badge.innerText = "แนบแล้ว 0 ไฟล์";
    return;
  }

  container.classList.remove("hidden");
  container.classList.add("flex");
  if (badge) badge.innerText = `แนบแล้ว ${list.length} ไฟล์/รูปภาพ`;

  grid.innerHTML = list.map((item, idx) => {
    const isImg = isImageAttachment(item.name, item.base64);
    return `
      <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2">
        ${isImg ? `
          <div onclick="previewCurrentDraftAttachment('ticket', ${idx})" class="relative group rounded-lg overflow-hidden border border-slate-200 bg-white h-28 flex items-center justify-center cursor-zoom-in">
            <img src="${item.base64}" alt="${escapeQuotes(item.name)}" class="max-h-28 w-auto object-contain transition group-hover:scale-[1.03]" />
          </div>
        ` : `
          <div class="h-28 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center text-slate-500 p-2">
            <span class="text-2xl">📎</span>
            <span class="text-[10px] mt-1 truncate max-w-full font-medium">${item.name}</span>
          </div>
        `}
        <div class="flex items-center justify-between gap-1.5">
          <div class="min-w-0">
            <span class="block font-bold text-slate-800 truncate text-[11px]" title="${escapeQuotes(item.name)}">${item.name}</span>
            <span class="block text-[10px] text-emerald-600">${item.size ? (item.size / 1024).toFixed(1) + ' KB' : 'พร้อมอัปโหลด'}</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" onclick="previewCurrentDraftAttachment('ticket', ${idx})" class="px-2 py-1 rounded-lg bg-tcc-50 hover:bg-tcc-100 text-tcc-700 font-bold text-[10px] transition" title="ดูตัวอย่าง">🔍</button>
            <button type="button" onclick="removeTicketDraftAttachment(${idx})" class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] transition" title="ลบไฟล์นี้">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function removeTicketDraftAttachment(idx) {
  if (!Array.isArray(state.currentAttachments)) state.currentAttachments = [];
  state.currentAttachments.splice(idx, 1);
  syncLegacySingleAttachmentFromDraft();
  renderTicketDraftAttachments();
}

function handleTicketFileSelect(input) {
  const files = Array.from(input?.files || input?.target?.files || []);
  if (files.length === 0) return;
  if (!Array.isArray(state.currentAttachments)) state.currentAttachments = [];

  files.forEach(file => {
    readAndPrepareAttachmentFile(file, (dataUrl, fileName, mimeType, origSize) => {
      state.currentAttachments.push({
        name: fileName,
        base64: dataUrl,
        mime: mimeType,
        size: origSize
      });
      syncLegacySingleAttachmentFromDraft();
      renderTicketDraftAttachments();
    });
  });

  if (input && "value" in input) {
    try { input.value = ""; } catch (_) {}
  }
}

function clearTicketAttachment() {
  state.currentAttachments = [];
  state.currentAttachmentName = "";
  state.currentAttachmentBase64 = "";
  state.currentAttachmentMime = "";
  const input = document.getElementById("ticketFileInput");
  if (input) input.value = "";
  renderTicketDraftAttachments();
}

function isInternalSystemCategory(cat) {
  const s = String(cat || "").trim();
  return s.includes("ระบบสารสนเทศภายใน") || s.includes("เว็บไซต์");
}

function handleTicketCategoryChange(val) {
  const wrapper = document.getElementById("internalSystemSelectWrapper");
  const sel = document.getElementById("ticketSystemName");
  if (!wrapper || !sel) return;
  if (isInternalSystemCategory(val)) {
    renderInternalSystemSelects();
    wrapper.classList.remove("hidden");
    sel.required = true;
  } else {
    wrapper.classList.add("hidden");
    sel.required = false;
    sel.value = "";
  }
}

async function handleCreateTicketSubmit(e) {
  e.preventDefault();
  if (!state.currentUser) {
    showNotification("กรุณาเข้าสู่ระบบก่อนเปิดเคสแจ้งซ่อม", "warning");
    openLoginModal();
    return;
  }

  const categoryVal = document.getElementById("ticketCategory").value;
  const systemNameVal = isInternalSystemCategory(categoryVal)
    ? (document.getElementById("ticketSystemName")?.value || "").trim()
    : "";

  if (isInternalSystemCategory(categoryVal) && !systemNameVal) {
    return showNotification("กรุณาเลือกชื่อระบบสารสนเทศภายใน / เว็บไซต์ ที่พบปัญหา", "warning");
  }

  const descEditorData = getRichEditorData("ticketDescriptionEditor");
  const fallbackDesc = (document.getElementById("ticketDescription")?.value || "").trim();
  const descText = descEditorData.text || fallbackDesc || (descEditorData.hasImages ? "(แนบรูปภาพในรายละเอียด)" : "");
  if (!descText && !descEditorData.hasImages) {
    focusRichEditor("ticketDescriptionEditor");
    return showNotification("กรุณากรอกรายละเอียดของปัญหา หรือวางรูปภาพประกอบ", "warning");
  }

  const btn = document.getElementById("btnSubmitTicket");
  const spinner = document.getElementById("btnTicketSpinner");
  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.remove("hidden");

  const priority = document.getElementById("ticketPriority").value;
  const ticketNum = generateTicketId();
  const draftAttachments = (state.currentAttachments && state.currentAttachments.length > 0)
    ? state.currentAttachments.map(a => ({ name: a.name, base64: a.base64, mime: a.mime || "", url: "", drive_file_id: "" }))
    : ((state.currentAttachmentBase64 && state.currentAttachmentName)
        ? [{ name: state.currentAttachmentName, base64: state.currentAttachmentBase64, mime: state.currentAttachmentMime || "", url: "", drive_file_id: "" }]
        : []);

  const firstAttach = draftAttachments[0] || null;
  const attachName = firstAttach ? firstAttach.name : "";
  const attachBase64 = firstAttach ? firstAttach.base64 : "";
  const reporterName = document.getElementById("ticketReporterName").value.trim();
  const reporterDept = document.getElementById("ticketReporterDept").value.trim();
  const reporterContact = document.getElementById("ticketReporterContact").value.trim();
  const titleVal = document.getElementById("ticketTitle").value.trim();
  const descVal = descText;
  const descHtmlVal = descEditorData.html || "";
  const nowTs = getLocalTimestamp(0);

  draftAttachments.forEach(att => {
    if (att.base64 && att.name) {
      saveAttachmentToCache(ticketNum, att.name, att.base64, "", "");
    }
  });

  const newTicket = {
    ticket_id: ticketNum,
    title: titleVal,
    category: categoryVal,
    system_name: systemNameVal,
    priority: priority,
    status: "Open",
    reporter_name: reporterName,
    reporter_dept: reporterDept,
    reporter_contact: reporterContact,
    description: descVal,
    description_html: descHtmlVal,
    created_at: nowTs,
    sla_target: calculateSlaTarget(priority),
    assigned_agent: "ยังไม่มอบหมาย",
    resolved_at: "",
    csat_score: 0,
    csat_feedback: "",
    attachment_name: attachName,
    attachment_base64: attachBase64,
    attachment_url: "",
    drive_file_id: "",
    attachments: draftAttachments,
    comments: [
      { sender: reporterName, message: "แจ้งเปิดเคสในระบบ", time: nowTs, is_internal: false }
    ]
  };

  const notifyTicketEmail = document.getElementById("ticketNotifyEmailCheckbox")?.checked !== false;

  // Optimistic UI: update state, cache rich content, reset form, render, and switch tab immediately
  state.tickets.unshift(newTicket);
  saveTicketRichCache(newTicket);

  document.getElementById("createTicketForm")?.reset();
  clearRichEditor("ticketDescriptionEditor");
  const tktNotifyChk = document.getElementById("ticketNotifyEmailCheckbox");
  if (tktNotifyChk) tktNotifyChk.checked = state.emailNotifyEnabled !== false;
  handleTicketCategoryChange(document.getElementById("ticketCategory")?.value || "");
  clearTicketAttachment();

  if (btn) btn.disabled = false;
  if (spinner) spinner.classList.add("hidden");

  autoFillUserFormsFromDatabase(true);
  renderAll();
  switchTab('myTicketsTab');

  showNotification(
    draftAttachments.length > 0
      ? `เปิดเคส [${ticketNum}] พร้อมไฟล์แนบ ${draftAttachments.length} ไฟล์เรียบร้อย (กำลังซิงค์ในพื้นหลัง)`
      : `เปิดเคส [${ticketNum}] เรียบร้อย บันทึกลงระบบแล้ว`,
    "success"
  );

  // Fire email notification asynchronously in the background
  if (notifyTicketEmail) {
    sendSystemEmailNotification("TICKET_CREATED", {
      ticket_id: newTicket.ticket_id,
      title: newTicket.title,
      category: newTicket.category,
      system_name: newTicket.system_name,
      priority: newTicket.priority,
      status: newTicket.status,
      reporter_name: newTicket.reporter_name,
      reporter_dept: newTicket.reporter_dept,
      reporter_contact: newTicket.reporter_contact,
      userEmail: state.currentUser?.email || "",
      description: newTicket.description,
      sla_target: newTicket.sla_target,
      assigned_agent: newTicket.assigned_agent
    });
  }

  // Sync inline images, attachments, and ticket to Google Drive & Google Sheets in the background
  (async () => {
    try {
      if (newTicket.description_html && /data:image\//i.test(newTicket.description_html)) {
        newTicket.description_html = await replaceInlineImagesWithDriveUrls(newTicket.description_html, `${ticketNum}_DESC`, ticketNum);
      }

      for (let i = 0; i < draftAttachments.length; i++) {
        const att = draftAttachments[i];
        if (att.base64 && att.name && !att.drive_file_id) {
          const driveRes = await uploadFileToGoogleDrive(att.base64, `${ticketNum}_${i + 1}_${att.name}`, "Tickets", ticketNum);
          if (driveRes && (driveRes.fileId || driveRes.viewUrl)) {
            const isSimDrive = String(driveRes.fileId || "").startsWith("DRV_");
            att.drive_file_id = isSimDrive ? "" : (driveRes.fileId || "");
            att.url = isSimDrive ? "" : (driveRes.viewUrl || "");
            if (i === 0 && !newTicket.drive_file_id && !isSimDrive) {
              newTicket.drive_file_id = att.drive_file_id;
              newTicket.attachment_url = att.url;
            }
            saveAttachmentToCache(ticketNum, att.name, att.base64, driveRes.viewUrl || "", driveRes.fileId || "");
          }
        }
      }

      const compactAttachments = draftAttachments.map(a => {
        const isSimDrive = String(a.drive_file_id || "").startsWith("DRV_");
        return {
          name: a.name || "",
          mime: a.mime || "",
          url: isSimDrive ? "" : (a.url || ""),
          drive_file_id: isSimDrive ? "" : (a.drive_file_id || "")
        };
      });

      const isSimMainDrive = String(newTicket.drive_file_id || "").startsWith("DRV_");
      const ticketPayload = {
        ...newTicket,
        attachment_url: isSimMainDrive ? "" : (newTicket.attachment_url || ""),
        drive_file_id: isSimMainDrive ? "" : (newTicket.drive_file_id || ""),
        attachment_base64: (!isSimMainDrive && newTicket.drive_file_id) ? "" : newTicket.attachment_base64,
        attachments: compactAttachments
      };

      const createRes = await callAPI("createTicket", {
        ticketData: ticketPayload,
        driveFolderId: state.driveFolderId || "",
        notifyEmail: notifyTicketEmail
      }, true);

      if (createRes && (createRes.drive_view_url || createRes.drive_file_id || createRes.attachment_url)) {
        newTicket.attachment_url = createRes.drive_view_url || createRes.attachment_url || newTicket.attachment_url;
        newTicket.drive_file_id = createRes.drive_file_id || newTicket.drive_file_id;
        if (firstAttach) {
          firstAttach.url = newTicket.attachment_url;
          firstAttach.drive_file_id = newTicket.drive_file_id;
          saveAttachmentToCache(ticketNum, attachName, attachBase64, newTicket.attachment_url, newTicket.drive_file_id);
        }
      }

      saveTicketRichCache(newTicket);
      renderMyTicketsList();
      renderAdminTicketsView();
    } catch (bgErr) {
      console.warn("Background createTicket sync warning:", bgErr);
    }
  })();
}

function renderMyTicketsList() {
  const container = document.getElementById("myTicketsListContainer");
  const badge = document.getElementById("tabBadgeMyTickets");
  if (!container) return;

  if (state.isInitialLoading) {
    if (badge) badge.innerText = "...";
    container.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดรายการเคสแจ้งซ่อมของคุณและฝ่าย/แผนก...");
    return;
  }

  const user = state.currentUser;
  const filterStatus = document.getElementById("filterMyTicketStatus")?.value;
  const uEmail = normalizeEmailDomainTypos(user?.email || "").toLowerCase().trim();
  const uName = (user?.name || "").trim();
  const uDept = getCurrentUserEffectiveDept(user);

  const subtextEl = document.getElementById("myTicketsDeptSubtext");
  if (subtextEl) {
    subtextEl.innerHTML = uDept
      ? `ตรวจสอบความคืบหน้า พูดคุยสอบถาม และช่วยกันติดตามสถานะเคสของคุณและเพื่อนร่วมสังกัด <b class="text-tcc-700">${uDept}</b>`
      : `ตรวจสอบความคืบหน้า พูดคุยสอบถาม และช่วยกันติดตามสถานะเคสภายในฝ่าย/แผนกเดียวกัน`;
  }

  const myTickets = state.tickets.filter(t => {
    const contact = normalizeEmailDomainTypos(t.reporter_contact || "").toLowerCase();
    const repName = String(t.reporter_name || "");
    const repDept = String(t.reporter_dept || "").trim();
    const isMine = !!user && ((uEmail && contact.includes(uEmail)) || (uName && repName.includes(uName)));
    const isSameDept = !!user && !!uDept && isSameDepartmentName(uDept, repDept);
    const matchStatus = !filterStatus || t.status === filterStatus;
    return (isMine || isSameDept) && matchStatus;
  });

  if (badge) badge.innerText = myTickets.length;

  if (myTickets.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 py-10 text-center">ไม่พบเคสแจ้งปัญหาของคุณหรือในฝ่าย/แผนกเดียวกัน 🎉</p>';
    return;
  }

  container.innerHTML = myTickets.map(t => {
    let statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">${t.status}</span>`;
    if (t.status === "In Progress") statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">กำลังดำเนินการ</span>`;
    if (t.status === "Resolved") statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">แก้ไขเสร็จแล้ว</span>`;
    if (t.status === "Closed") statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">ปิดเคสแล้ว</span>`;

    const contact = normalizeEmailDomainTypos(t.reporter_contact || "").toLowerCase();
    const repName = String(t.reporter_name || "");
    const isDirectMine = !!user && ((uEmail && contact.includes(uEmail)) || (uName && repName.includes(uName)));
    const ownerBadge = isDirectMine
      ? `<span class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-tcc-50 text-tcc-700 border border-tcc-200">ของฉัน</span>`
      : `<span class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">ร่วมฝ่าย (${t.reporter_name || '-'})</span>`;

    const sysBadge = t.system_name
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🌐 ${t.system_name}</span>`
      : "";
    const attachList = resolveTicketAttachmentsList(t);
    const attachBadge = attachList.length > 0
      ? `<button type="button" onclick="event.stopPropagation(); openTicketAttachmentPreview('${escapeQuotes(t.ticket_id)}', 0)" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">🖼️ ${attachList.length > 1 ? attachList.length + ' รูปแนบ' : 'ดูรูปแนบ'}</button>`
      : "";

    return `
      <div onclick="openTicketDetailModal('${t.ticket_id}')" class="p-4 rounded-2xl border border-slate-200 hover:border-tcc-400 bg-white hover:bg-slate-50 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono font-bold text-xs text-slate-500">${t.ticket_id}</span>
            <span class="font-bold text-slate-900 text-sm">${t.title}</span>
            ${ownerBadge}
            <span class="px-2 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">${t.category}</span>
            ${sysBadge}
            ${attachBadge}
          </div>
          <p class="text-xs text-slate-500 line-clamp-1">${t.description}</p>
          <div class="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>📅 วันที่เปิดเคส: <b class="font-mono text-slate-600">${t.created_at || '-'}</b></span>
            <span>•</span>
            <span>✅ วันที่ปิดเคส: ${t.resolved_at ? `<b class="font-mono text-emerald-700">${t.resolved_at}</b>` : '<span class="text-slate-400">รอดำเนินการ</span>'}</span>
            <span>•</span>
            <span>ผู้รับผิดชอบ: ${t.assigned_agent}</span>
          </div>
        </div>
        <div class="flex items-center gap-3 self-end sm:self-center">
          ${statusBadge}
          <button class="px-3 py-1 bg-slate-100 hover:bg-tcc-50 text-tcc-700 rounded-xl text-xs font-semibold">ดูรายละเอียด &gt;</button>
        </div>
      </div>
    `;
  }).join("");
}

function setTicketViewMode(mode) {
  state.currentTicketViewMode = mode;
  const kanbanView = document.getElementById("adminTicketKanbanView");
  const tableView = document.getElementById("adminTicketTableView");
  const btnK = document.getElementById("btnViewKanban");
  const btnT = document.getElementById("btnViewTable");

  if (mode === 'kanban') {
    kanbanView?.classList.remove("hidden");
    tableView?.classList.add("hidden");
    btnK?.classList.add("bg-white", "text-tcc-700", "shadow-sm");
    btnT?.classList.remove("bg-white", "text-tcc-700", "shadow-sm");
  } else {
    kanbanView?.classList.add("hidden");
    tableView?.classList.remove("hidden");
    btnT?.classList.add("bg-white", "text-tcc-700", "shadow-sm");
    btnK?.classList.remove("bg-white", "text-tcc-700", "shadow-sm");
  }
  renderAdminTicketsView();
}

function renderAdminTicketsView() {
  const catFilterEl = document.getElementById("adminTicketFilterCategory");
  if (catFilterEl) {
    const curCat = catFilterEl.value;
    const cats = state.ticketCategories || [];
    catFilterEl.innerHTML = '<option value="">หมวดหมู่ทั้งหมด</option>' + cats.map(c => `<option value="${escapeQuotes(c)}">${c}</option>`).join("");
    if (curCat && cats.includes(curCat)) catFilterEl.value = curCat;
  }

  const sysFilterEl = document.getElementById("adminTicketFilterSystem");
  if (sysFilterEl) {
    const curSys = sysFilterEl.value;
    const sysSet = new Set(state.internalSystems || []);
    (state.tickets || []).forEach(t => {
      const sn = String(t.system_name || "").trim();
      if (sn) sysSet.add(sn);
    });
    const sysList = Array.from(sysSet);
    sysFilterEl.innerHTML = '<option value="">ระบบสารสนเทศทั้งหมด</option>' + sysList.map(sn => `<option value="${escapeQuotes(sn)}">${sn}</option>`).join("");
    if (curSys && sysSet.has(curSys)) sysFilterEl.value = curSys;
  }

  const agentFilterEl = document.getElementById("adminTicketFilterAgent");
  if (agentFilterEl) {
    const curAgent = agentFilterEl.value;
    const admins = (state.userRoles || []).filter(r => r.role === "admin" || r.role === "superadmin");
    agentFilterEl.innerHTML = '<option value="">เจ้าหน้าที่ทั้งหมด</option>' + admins.map(a => `<option value="${escapeQuotes(a.email)}">${a.name} (${a.email})</option>`).join("") + '<option value="ยังไม่มอบหมาย">ยังไม่มอบหมาย</option>';
    if (curAgent) agentFilterEl.value = curAgent;
  }

  const columns = ["Open", "InProgress", "PendingUser", "Resolved", "Closed"];
  const statusMap = { Open: "Open", InProgress: "In Progress", PendingUser: "Pending User", Resolved: "Resolved", Closed: "Closed" };
  const badge = document.getElementById("tabBadgeAdminTickets") || document.getElementById("sidebarBadgeTickets");
  const tbody = document.getElementById("adminTicketTableBody");

  if (state.isInitialLoading) {
    if (badge) badge.innerText = "...";
    columns.forEach(col => {
      const countEl = document.getElementById(`kanbanCount-${col}`);
      if (countEl) countEl.innerText = "...";
      const colEl = document.getElementById(`kanbanColumn-${col}`);
      if (colEl) colEl.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดเคส...");
    });
    if (tbody) tbody.innerHTML = getDatabaseLoadingRowHtml(11, "กำลังโหลดข้อมูลเคสแจ้งซ่อมจากฐานข้อมูล...");
    return;
  }

  const q = (document.getElementById("adminTicketSearchInput")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("adminTicketFilterCategory")?.value;
  const sys = document.getElementById("adminTicketFilterSystem")?.value;
  const p = document.getElementById("adminTicketFilterPriority")?.value;
  const a = document.getElementById("adminTicketFilterAgent")?.value;
  const s = document.getElementById("adminTicketFilterSla")?.value;
  const nowTs = getLocalTimestamp();

  const filtered = state.tickets.filter(t => {
    const matchQ = !q || safeLower(t.ticket_id).includes(q) || safeLower(t.title).includes(q) || safeLower(t.reporter_name).includes(q) || safeLower(t.reporter_dept).includes(q) || safeLower(t.system_name).includes(q);
    const matchCat = !cat || t.category === cat;
    const matchSys = !sys || String(t.system_name || "").trim() === sys;
    const matchP = !p || t.priority === p;
    const matchA = !a || safeLower(t.assigned_agent).includes(a.toLowerCase());
    let matchS = true;
    if (s === "breached") matchS = t.sla_target < nowTs && t.status !== "Resolved" && t.status !== "Closed";
    if (s === "on_track") matchS = t.sla_target >= nowTs || t.status === "Resolved" || t.status === "Closed";
    return matchQ && matchCat && matchSys && matchP && matchA && matchS;
  });

  if (badge) badge.innerText = filtered.length;

  columns.forEach(col => {
    const realStatus = statusMap[col];
    const colTickets = filtered.filter(t => t.status === realStatus);
    const countEl = document.getElementById(`kanbanCount-${col}`);
    if (countEl) countEl.innerText = colTickets.length;

    const colEl = document.getElementById(`kanbanColumn-${col}`);
    if (colEl) {
      if (colTickets.length === 0) {
        colEl.innerHTML = '<p class="text-[11px] text-slate-400 py-6 text-center">ไม่มีเคส</p>';
      } else {
        colEl.innerHTML = colTickets.map(t => {
          let pColor = "bg-slate-100 text-slate-700";
          if (t.priority === "Critical") pColor = "bg-rose-100 text-rose-800 border border-rose-300";
          if (t.priority === "High") pColor = "bg-amber-100 text-amber-800 border border-amber-300";

          const attachList = resolveTicketAttachmentsList(t);
          const hasAttach = attachList.length > 0;
          const isDone = (t.status === "Resolved" || t.status === "Closed") && Boolean(t.resolved_at);
          const closedDateBadge = isDone || t.resolved_at
            ? `<span class="font-mono font-bold text-emerald-700">${t.resolved_at}</span>`
            : `<span class="text-slate-400">รอดำเนินการ</span>`;
          return `
            <div onclick="openTicketDetailModal('${t.ticket_id}')" class="p-3 bg-white rounded-xl border border-slate-200 hover:border-tcc-400 cursor-pointer shadow-sm transition space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-mono text-[11px] font-bold text-slate-500">${t.ticket_id}</span>
                <div class="flex items-center gap-1">
                  ${hasAttach ? `<button type="button" onclick="event.stopPropagation(); openTicketAttachmentPreview('${t.ticket_id}', 0)" title="คลิกเพื่อดูไฟล์แนบ (${attachList.length} รายการ)" class="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 font-bold">🖼️ ${attachList.length > 1 ? attachList.length + ' รูป' : 'รูป'}</button>` : ''}
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${pColor}">${t.priority}</span>
                </div>
              </div>
              <h4 class="font-bold text-slate-900 text-xs line-clamp-2">${t.title}</h4>
              ${t.system_name ? `<div class="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded truncate" title="${escapeQuotes(t.system_name)}">🌐 ${t.system_name}</div>` : ''}
              <div class="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] space-y-0.5">
                <div class="flex items-center justify-between gap-1 text-slate-600">
                  <span class="font-semibold text-slate-500">📅 วันที่เปิดเคส:</span>
                  <span class="font-mono font-semibold text-slate-700">${t.created_at || '-'}</span>
                </div>
                <div class="flex items-center justify-between gap-1">
                  <span class="font-semibold text-slate-500">✅ วันที่ปิดเคส:</span>
                  ${closedDateBadge}
                </div>
              </div>
              <div class="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                <span class="truncate max-w-[100px]">${t.reporter_name}</span>
                <button onclick="event.stopPropagation(); openTicketDetailModal('${t.ticket_id}')" class="text-tcc-600 hover:underline font-bold">ดู / จัดการ</button>
              </div>
            </div>
          `;
        }).join("");
      }
    }
  });

  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400 text-xs">ไม่พบรายการเคสแจ้งซ่อมที่ตรงกับเงื่อนไข</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(t => {
      const agentShort = t.assigned_agent && t.assigned_agent.includes("@") ? t.assigned_agent.split("@")[0] : (t.assigned_agent || "-");
      const catOrSys = t.system_name ? `🌐 ${t.system_name}` : (t.category || "-");
      const sysCellHtml = t.system_name
        ? `<span class="inline-block max-w-[140px] xl:max-w-[200px] truncate px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold text-[10px]" title="${escapeQuotes(t.system_name)}">🌐 ${t.system_name}</span>`
        : `<span class="text-slate-400">-</span>`;
      const closedCellHtml = t.resolved_at
        ? `<span class="text-emerald-700 font-semibold">${t.resolved_at}</span>`
        : `<span class="font-sans text-slate-400">รอดำเนินการ</span>`;
      return `
      <tr onclick="openTicketDetailModal('${t.ticket_id}')" class="hover:bg-sky-50/70 cursor-pointer transition whitespace-nowrap" title="คลิกเพื่อดูรายละเอียดและจัดการเคส">
        <td class="py-2 px-2 font-mono font-bold text-[11px] text-tcc-700 whitespace-nowrap" title="วันที่เปิดเคส: ${escapeQuotes(t.created_at || '-')}">${t.ticket_id}</td>
        <td class="py-2 px-2 font-medium text-slate-900 whitespace-nowrap">
          <div class="max-w-[140px] xl:max-w-[240px] 2xl:max-w-[340px] truncate" title="${escapeQuotes(t.title + ' (' + catOrSys + ')')}">${t.title}</div>
        </td>
        <td class="py-2 px-2 whitespace-nowrap">${sysCellHtml}</td>
        <td class="py-2 px-2 whitespace-nowrap">
          <div class="max-w-[110px] xl:max-w-[180px] 2xl:max-w-[260px] truncate text-slate-700" title="${escapeQuotes((t.reporter_name || '-') + ' • ' + (t.reporter_dept || '-'))}">${t.reporter_name || '-'} <span class="text-slate-400 text-[10px]">(${t.reporter_dept || '-'})</span></div>
        </td>
        <td class="py-2 px-2 font-mono text-[11px] text-slate-700 whitespace-nowrap">${t.created_at || '-'}</td>
        <td class="py-2 px-2 font-mono text-[11px] whitespace-nowrap">${closedCellHtml}</td>
        <td class="py-2 px-1.5 text-center whitespace-nowrap"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${t.priority}</span></td>
        <td class="py-2 px-1.5 text-center font-bold text-[11px] whitespace-nowrap">${t.status}</td>
        <td class="py-2 px-2 text-[11px] text-slate-600 whitespace-nowrap">
          <div class="max-w-[85px] xl:max-w-[140px] 2xl:max-w-none truncate" title="${escapeQuotes(t.assigned_agent || '-')}">${agentShort}</div>
        </td>
        <td class="py-2 px-1.5 text-center text-[10px] whitespace-nowrap">${t.sla_target < nowTs ? '<span class="text-rose-600 font-bold">⚠️ หลุด</span>' : '<span class="text-emerald-700 font-semibold">✓ ปกติ</span>'}</td>
        <td class="py-2 px-2 text-center whitespace-nowrap">
          <button type="button" onclick="event.stopPropagation(); openTicketAdminActionModal('${t.ticket_id}')" class="px-2.5 py-1 bg-tcc-50 text-tcc-700 hover:bg-tcc-100 rounded-lg font-bold text-[11px] border border-tcc-200/70 transition cursor-pointer">จัดการ</button>
        </td>
      </tr>
    `;
      }).join("");
    }
  }
}

function openTicketDetailModal(ticketId) {
  const ticket = state.tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) return;
  state.activeDetailTicketId = ticketId;
  state.editingCommentIndex = null;
  clearReplyAttachments();
  clearRichEditor("replyMessageInput");

  document.getElementById("detailTicketNumber").innerText = ticket.ticket_id;
  document.getElementById("detailTicketTitle").innerText = ticket.title;
  const sysInfo = ticket.system_name ? ` • ระบบ: ${ticket.system_name}` : ` • หมวด: ${ticket.category || '-'}`;
  const closedMeta = ticket.resolved_at ? ` • วันที่ปิดเคส: ${ticket.resolved_at}` : "";
  document.getElementById("detailTicketMeta").innerText = `ผู้แจ้ง: ${ticket.reporter_name} (${ticket.reporter_dept})${sysInfo} • วันที่เปิดเคส: ${ticket.created_at || '-'}${closedMeta}`;
  const descEl = document.getElementById("detailTicketDesc");
  if (descEl) {
    if (ticket.description_html) {
      descEl.innerHTML = sanitizeRichHtml(ticket.description_html);
    } else {
      descEl.innerText = ticket.description || "-";
    }
  }
  document.getElementById("detailTicketPriorityBadge").innerText = ticket.priority;
  document.getElementById("detailTicketStatusBadge").innerText = ticket.status;
  document.getElementById("detailTicketSlaBadge").innerText = `${ticket.sla_target} น.`;
  const detailCreatedEl = document.getElementById("detailTicketCreatedAt");
  if (detailCreatedEl) detailCreatedEl.innerText = ticket.created_at || "-";
  const detailResolvedEl = document.getElementById("detailTicketResolvedAt");
  if (detailResolvedEl) {
    if (ticket.resolved_at) {
      detailResolvedEl.innerText = ticket.resolved_at;
      detailResolvedEl.className = "font-mono font-bold text-emerald-700";
    } else {
      detailResolvedEl.innerText = "รอดำเนินการ";
      detailResolvedEl.className = "font-sans font-medium text-slate-400";
    }
  }

  // Populate inline Admin Quick Manage controls
  const detailStatusSel = document.getElementById("detailAdminStatus");
  if (detailStatusSel) detailStatusSel.value = ticket.status;
  const detailAgentSel = document.getElementById("detailAdminAgent");
  if (detailAgentSel) {
    const admins = (state.userRoles || []).filter(r => r.role === "admin" || r.role === "superadmin");
    detailAgentSel.innerHTML = '<option value="ยังไม่มอบหมาย">-- ยังไม่มอบหมาย --</option>' +
      admins.map(a => `<option value="${escapeQuotes(a.email)}" ${safeLower(ticket.assigned_agent).includes(safeLower(a.email)) ? 'selected' : ''}>${a.name} (${a.email})</option>`).join("");
  }
  const detailNoteInp = document.getElementById("detailAdminNote");
  if (detailNoteInp) detailNoteInp.value = "";
  clearRichEditor("detailAdminNoteEditor");
  const detailNotifyChk = document.getElementById("detailAdminNotifyEmail");
  if (detailNotifyChk) detailNotifyChk.checked = state.emailNotifyEnabled !== false;

  const attachBox = document.getElementById("detailAttachmentBox");
  const attachCont = document.getElementById("detailAttachmentContainer");
  const attachList = resolveTicketAttachmentsList(ticket);
  if (attachList.length > 0) {
    attachBox.classList.remove("hidden");
    attachCont.className = "p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs";
    attachCont.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${attachList.map((attachInfo, idx) => {
          const fallbackImgSrc = generateFallbackDiagnosticImage(attachInfo.name, ticket.title, ticket.ticket_id);
          const thumbHtml = attachInfo.isImage && attachInfo.displaySrc
            ? `<div onclick="openTicketAttachmentPreview('${escapeQuotes(ticket.ticket_id)}', ${idx})" class="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 bg-white h-40 flex items-center justify-center p-1 hover:border-tcc-400 transition">
                <img src="${attachInfo.displaySrc}" alt="${escapeQuotes(attachInfo.name)}" class="max-h-36 w-auto object-contain rounded-lg" onerror="this.onerror=null; this.src='${fallbackImgSrc}';" />
                <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span class="px-2.5 py-1 rounded-xl bg-white text-slate-900 font-bold text-[11px] shadow-lg">🔍 ขยายดูเต็มจอ</span>
                </div>
              </div>`
            : `<div onclick="openTicketAttachmentPreview('${escapeQuotes(ticket.ticket_id)}', ${idx})" class="cursor-pointer rounded-xl border border-slate-200 bg-white h-40 flex flex-col items-center justify-center p-3 hover:border-tcc-400 transition">
                <span class="text-3xl">📎</span>
                <span class="text-[11px] font-semibold text-slate-600 mt-1.5 truncate max-w-full">${attachInfo.name}</span>
              </div>`;
          const driveBadge = attachInfo.driveViewUrl
            ? `<a href="${attachInfo.driveViewUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[10px] inline-flex items-center gap-1 transition">☁️ Drive ↗</a>`
            : `<span class="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-[10px]">💾 ในระบบ</span>`;
          return `
            <div class="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2 flex flex-col justify-between">
              ${thumbHtml}
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-slate-800 truncate text-[11px]" title="${escapeQuotes(attachInfo.name)}">${attachInfo.isImage ? '🖼️' : '📎'} ${attachInfo.name}</span>
              </div>
              <div class="flex items-center justify-between gap-1.5 flex-wrap">
                <button type="button" onclick="openTicketAttachmentPreview('${escapeQuotes(ticket.ticket_id)}', ${idx})" class="px-2.5 py-1 rounded-lg bg-tcc-600 hover:bg-tcc-700 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow-xs transition">
                  🔍 เปิดดูไฟล์
                </button>
                ${driveBadge}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else {
    attachBox.classList.add("hidden");
  }

  const csatBox = document.getElementById("detailCsatBox");
  const csatLabel = document.getElementById("detailCsatStatusLabel");
  if (ticket.status === "Resolved" || ticket.status === "Closed") {
    csatBox.classList.remove("hidden");
    if (ticket.csat_score > 0) {
      csatLabel.innerText = `ประเมินแล้ว: ${ticket.csat_score} ดาว ⭐ ("${ticket.csat_feedback || '-'}")`;
      document.getElementById("detailCsatActionArea").classList.add("hidden");
    } else {
      csatLabel.innerText = "ยังไม่ได้ประเมิน";
      document.getElementById("detailCsatActionArea").classList.remove("hidden");
    }
  } else {
    csatBox.classList.add("hidden");
  }

  renderTicketComments(ticket);
  document.getElementById("ticketDetailModal").classList.remove("hidden");
}

function closeTicketDetailModal() {
  state.activeDetailTicketId = null;
  clearReplyAttachments();
  document.getElementById("ticketDetailModal").classList.add("hidden");
}

async function handleSaveTicketDetailAdminAction(e) {
  e.preventDefault();
  if (!state.activeDetailTicketId) return;
  const ticket = state.tickets.find(t => t.ticket_id === state.activeDetailTicketId);
  if (!ticket) return;

  ticket.status = document.getElementById("detailAdminStatus").value;
  ticket.assigned_agent = document.getElementById("detailAdminAgent").value;
  const noteData = getRichEditorData("detailAdminNoteEditor");
  const fallbackNote = document.getElementById("detailAdminNote")?.value.trim() || "";
  const note = noteData.text || fallbackNote || (noteData.hasImages ? "(แนบรูปภาพประกอบ)" : "");
  let rawNoteHtml = noteData.html || "";
  const notifyEmail = document.getElementById("detailAdminNotifyEmail")?.checked !== false;

  if (ticket.status === "Resolved" || ticket.status === "Closed") {
    if (!ticket.resolved_at) {
      ticket.resolved_at = getLocalTimestamp(0);
    }
  } else {
    ticket.resolved_at = "";
  }

  let addedComment = null;
  if (note || noteData.hasImages) {
    const statusPrefixHtml = `<div><strong style="color:#0369a1">[อัปเดตสถานะเป็น ${ticket.status}]</strong></div>`;
    addedComment = {
      sender: state.currentUser ? state.currentUser.name : "Admin",
      message: `[อัปเดตสถานะเป็น ${ticket.status}] ${note}`,
      message_html: rawNoteHtml ? `${statusPrefixHtml}${rawNoteHtml}` : "",
      time: getLocalTimestamp(0),
      is_internal: false
    };
    (ticket.comments = Array.isArray(ticket.comments) ? ticket.comments : []).push(addedComment);
  }

  saveTicketRichCache(ticket);
  showNotification(`บันทึกการจัดการเคส [${ticket.ticket_id}] สำเร็จ`, "success");
  openTicketDetailModal(ticket.ticket_id);
  renderAll();

  if (notifyEmail) {
    sendSystemEmailNotification("TICKET_UPDATED", {
      ticket_id: ticket.ticket_id,
      title: ticket.title,
      status: ticket.status,
      assigned_agent: ticket.assigned_agent,
      reporter_name: ticket.reporter_name,
      reporter_contact: ticket.reporter_contact,
      resolved_at: ticket.resolved_at,
      note: note
    });
  }

  if (addedComment && addedComment.message_html && /data:image\//i.test(addedComment.message_html)) {
    addedComment.message_html = await replaceInlineImagesWithDriveUrls(addedComment.message_html, `${ticket.ticket_id}_ADMIN_NOTE`, ticket.ticket_id);
    saveTicketRichCache(ticket);
  }

  const compactComments = (ticket.comments || []).map(c => ({
    ...c,
    attachments: Array.isArray(c.attachments)
      ? c.attachments.map(a => ({ name: a.name || "", mime: a.mime || "", url: a.url || "", drive_file_id: a.drive_file_id || "" }))
      : undefined
  }));

  await callAPI("updateTicket", {
    ticketId: ticket.ticket_id,
    driveFolderId: state.driveFolderId || "",
    updates: {
      status: ticket.status,
      assigned_agent: ticket.assigned_agent,
      resolved_at: ticket.resolved_at,
      comments: compactComments
    },
    notifyEmail: notifyEmail
  }, true);
}

function renderReplyAttachmentsPreview() {
  const container = document.getElementById("replyAttachmentsPreview");
  const list = state.replyAttachments || [];
  if (!container) return;
  if (list.length === 0) {
    container.classList.add("hidden");
    container.classList.remove("flex");
    container.innerHTML = "";
    return;
  }
  container.classList.remove("hidden");
  container.classList.add("flex");
  container.innerHTML = list.map((att, idx) => {
    const isImg = isImageAttachment(att.name, att.base64);
    return `
      <div class="relative group flex items-center gap-1.5 p-1.5 pr-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px]">
        ${isImg
          ? `<img src="${att.base64}" alt="${escapeQuotes(att.name)}" class="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />`
          : `<span class="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-base shrink-0">📎</span>`}
        <span class="max-w-[110px] truncate font-semibold text-slate-700" title="${escapeQuotes(att.name)}">${att.name}</span>
        <button type="button" onclick="removeReplyAttachment(${idx})" class="ml-1 w-5 h-5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[10px] flex items-center justify-center shrink-0 cursor-pointer" title="ลบรูป/ไฟล์นี้">✕</button>
      </div>
    `;
  }).join("");
}

function handleReplyFilesSelect(input) {
  const files = Array.from(input?.files || input?.target?.files || []);
  if (files.length === 0) return;
  if (!Array.isArray(state.replyAttachments)) state.replyAttachments = [];

  files.forEach(file => {
    readAndPrepareAttachmentFile(file, (dataUrl, fileName, mimeType, origSize) => {
      state.replyAttachments.push({
        name: fileName,
        base64: dataUrl,
        mime: mimeType,
        size: origSize,
        url: "",
        drive_file_id: ""
      });
      renderReplyAttachmentsPreview();
    });
  });

  if (input && "value" in input) {
    try { input.value = ""; } catch (_) {}
  }
}

function removeReplyAttachment(idx) {
  if (!Array.isArray(state.replyAttachments)) state.replyAttachments = [];
  state.replyAttachments.splice(idx, 1);
  renderReplyAttachmentsPreview();
}

function clearReplyAttachments() {
  state.replyAttachments = [];
  const input = document.getElementById("replyAttachmentInput");
  if (input) input.value = "";
  renderReplyAttachmentsPreview();
}

function renderTicketComments(ticket) {
  const container = document.getElementById("ticketCommentsList");
  if (!container) return;
  if (!Array.isArray(ticket.comments)) ticket.comments = [];
  container.innerHTML = ticket.comments.map((c, cIdx) => {
    const atts = Array.isArray(c.attachments) ? c.attachments : [];
    const attsHtml = atts.length > 0
      ? `<div class="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          ${atts.map((att, aIdx) => {
            const src = att.base64 || att.url || "";
            const isImg = isImageAttachment(att.name || "", src);
            if (isImg && src) {
              return `
                <div onclick="openCommentAttachmentPreview('${escapeQuotes(ticket.ticket_id)}', ${cIdx}, ${aIdx})" class="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-24 flex items-center justify-center cursor-zoom-in hover:border-tcc-400 transition">
                  <img src="${src}" alt="${escapeQuotes(att.name || 'image')}" class="max-h-24 w-auto object-contain" />
                  <div class="absolute inset-0 bg-slate-900/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span class="px-2 py-0.5 rounded bg-white text-slate-900 text-[10px] font-bold">🔍 ดูรูป</span>
                  </div>
                </div>
              `;
            }
            return `
              <div onclick="openCommentAttachmentPreview('${escapeQuotes(ticket.ticket_id)}', ${cIdx}, ${aIdx})" class="p-2 rounded-xl border border-slate-200 bg-white flex items-center gap-1.5 cursor-pointer hover:border-tcc-400 transition text-[11px]">
                <span>📎</span>
                <span class="truncate font-semibold text-slate-700">${att.name || 'ไฟล์แนบ'}</span>
              </div>
            `;
          }).join("")}
        </div>`
      : "";
    const user = state.currentUser;
    const isAdmin = user && (user.role === "admin" || user.role === "superadmin");
    const canEdit = isAdmin || (user && safeLower(c.sender) === safeLower(user.name));
    const isEditing = state.editingCommentIndex === cIdx;
    const editedBadge = c.edited_at ? `<span class="text-[10px] text-slate-400 italic ml-1">(แก้ไขแล้ว ${c.edited_at})</span>` : "";

    return `
      <div class="p-3 rounded-xl text-xs sm:text-sm ${c.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}">
        <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold ${c.is_internal ? 'text-amber-900' : 'text-slate-800'}">${c.sender} ${c.is_internal ? '(🔒 บันทึกภายใน)' : ''}</span>
            ${editedBadge}
          </div>
          <div class="flex items-center gap-2">
            ${canEdit && !isEditing ? `<button type="button" onclick="startEditTicketComment(${cIdx})" class="text-[11px] font-semibold text-tcc-700 hover:text-tcc-900 hover:underline cursor-pointer" title="แก้ไขข้อความนี้">✏️ แก้ไข</button>` : ''}
            <span class="text-[11px] text-slate-400">${c.time}</span>
          </div>
        </div>
        ${isEditing ? `
          <div class="space-y-2 mt-1.5">
            <div class="quill-wrapper quill-compact border-tcc-400 bg-white overflow-hidden">
              <input type="file" id="editCommentImgInput-${cIdx}" multiple accept="image/*" onchange="handleRichEditorImagePick(this, 'editCommentEditor-${cIdx}')" class="hidden">
              <div id="editCommentEditor-${cIdx}" data-placeholder="แก้ไขข้อความสนทนา..."></div>
            </div>
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" onclick="cancelEditTicketComment()" class="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs cursor-pointer">ยกเลิก</button>
              <button type="button" onclick="saveEditedTicketComment(${cIdx})" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer">💾 บันทึก</button>
            </div>
          </div>
        ` : (c.message_html
            ? `<div class="rich-display-content text-slate-700 whitespace-pre-wrap break-words leading-relaxed">${sanitizeRichHtml(c.message_html)}</div>`
            : (c.message ? `<p class="text-slate-700 whitespace-pre-wrap break-words">${c.message}</p>` : ''))}
        ${attsHtml}
      </div>
    `;
  }).join("");
}

function autoResizeReplyTextarea(el) {
  if (!el || el.isContentEditable) return;
  el.style.height = "auto";
  const maxH = 160;
  const nextH = Math.min(el.scrollHeight, maxH);
  el.style.height = Math.max(38, nextH) + "px";
  el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
}

function handleReplyTextareaKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const form = e.target?.closest("form");
    if (form) form.requestSubmit();
  }
}

function startEditTicketComment(commentIdx) {
  if (!state.activeDetailTicketId) return;
  const ticket = state.tickets.find(t => t.ticket_id === state.activeDetailTicketId);
  if (!ticket || !Array.isArray(ticket.comments) || !ticket.comments[commentIdx]) return;
  state.editingCommentIndex = commentIdx;
  const editorId = `editCommentEditor-${commentIdx}`;
  delete quillEditors[editorId];
  renderTicketComments(ticket);
  const c = ticket.comments[commentIdx];
  initQuillEditor(editorId, {
    imageInputId: `editCommentImgInput-${commentIdx}`,
    compact: true,
    allowImage: true
  });
  const initialContent = c.message_html
    ? sanitizeRichHtml(c.message_html)
    : (c.message ? String(c.message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") : "");
  setRichEditorContent(editorId, initialContent, true);
  focusRichEditor(editorId);
}

function cancelEditTicketComment() {
  if (state.editingCommentIndex !== null && state.editingCommentIndex !== undefined) {
    delete quillEditors[`editCommentEditor-${state.editingCommentIndex}`];
  }
  state.editingCommentIndex = null;
  if (!state.activeDetailTicketId) return;
  const ticket = state.tickets.find(t => t.ticket_id === state.activeDetailTicketId);
  if (ticket) renderTicketComments(ticket);
}

async function saveEditedTicketComment(commentIdx) {
  if (!state.activeDetailTicketId) return;
  const ticket = state.tickets.find(t => t.ticket_id === state.activeDetailTicketId);
  if (!ticket || !Array.isArray(ticket.comments) || !ticket.comments[commentIdx]) return;
  const editorId = `editCommentEditor-${commentIdx}`;
  const editorData = getRichEditorData(editorId);
  const comment = ticket.comments[commentIdx];
  if (!editorData.text && !editorData.hasImages && (!Array.isArray(comment.attachments) || comment.attachments.length === 0)) {
    return showNotification("กรุณากรอกข้อความหรือวางรูปภาพก่อนบันทึก", "warning");
  }
  comment.message = editorData.text || (editorData.hasImages ? "(แนบรูปภาพในข้อความ)" : "");
  comment.message_html = editorData.html;
  comment.edited_at = getLocalTimestamp(0);
  delete quillEditors[editorId];
  state.editingCommentIndex = null;
  saveTicketRichCache(ticket);
  renderTicketComments(ticket);
  showNotification("แก้ไขข้อความสนทนาเรียบร้อยแล้ว", "success");

  if (comment.message_html && /data:image\//i.test(comment.message_html)) {
    comment.message_html = await replaceInlineImagesWithDriveUrls(comment.message_html, `${ticket.ticket_id}_EDIT_${commentIdx}_${Date.now()}`, ticket.ticket_id);
    saveTicketRichCache(ticket);
  }

  const compactComments = ticket.comments.map(c => ({
    ...c,
    attachments: Array.isArray(c.attachments)
      ? c.attachments.map(a => ({ name: a.name || "", mime: a.mime || "", url: a.url || "", drive_file_id: a.drive_file_id || "" }))
      : []
  }));

  await callAPI("updateTicket", {
    ticketId: ticket.ticket_id,
    updates: { comments: compactComments },
    notifyEmail: false
  }, true);
}

function handleSendTicketComment(e) {
  e.preventDefault();
  const editorData = getRichEditorData("replyMessageInput");
  const msg = editorData.text;
  const attachments = Array.isArray(state.replyAttachments)
    ? state.replyAttachments.map(a => ({ name: a.name, base64: a.base64, mime: a.mime || "", url: a.url || "", drive_file_id: a.drive_file_id || "" }))
    : [];
  if ((!msg && !editorData.hasImages && attachments.length === 0) || !state.activeDetailTicketId) return;

  const ticket = state.tickets.find(t => t.ticket_id === state.activeDetailTicketId);
  if (!ticket) return;

  const isInternal = document.getElementById("replyIsInternal")?.checked || false;
  const senderName = state.currentUser ? state.currentUser.name : "ผู้ใช้งาน";

  const newComment = {
    sender: senderName,
    message: msg || (editorData.hasImages ? "(แนบรูปภาพในข้อความ)" : (attachments.length > 0 ? `(แนบไฟล์/รูปภาพ ${attachments.length} รายการ)` : "")),
    message_html: editorData.html || "",
    time: getLocalTimestamp(0),
    is_internal: isInternal,
    attachments: attachments
  };

  (ticket.comments = Array.isArray(ticket.comments) ? ticket.comments : []).push(newComment);

  clearRichEditor("replyMessageInput");
  state.editingCommentIndex = null;
  clearReplyAttachments();
  saveTicketRichCache(ticket);
  renderTicketComments(ticket);
  showNotification("ส่งข้อความตอบกลับแล้ว", "success");

  if (!isInternal) {
    sendSystemEmailNotification("TICKET_COMMENT", {
      ticket_id: ticket.ticket_id,
      title: ticket.title,
      status: ticket.status,
      reporter_name: ticket.reporter_name,
      reporter_contact: ticket.reporter_contact,
      assigned_agent: ticket.assigned_agent,
      sender: senderName,
      message: newComment.message
    });
  }

  (async () => {
    try {
      if (newComment.message_html && /data:image\//i.test(newComment.message_html)) {
        newComment.message_html = await replaceInlineImagesWithDriveUrls(newComment.message_html, `${ticket.ticket_id}_REPLY_${Date.now()}`, ticket.ticket_id);
      }
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        if (att.base64 && att.name && !att.drive_file_id) {
          const driveRes = await uploadFileToGoogleDrive(att.base64, `${ticket.ticket_id}_REPLY_${Date.now()}_${i + 1}_${att.name}`, "Tickets", ticket.ticket_id);
          if (driveRes && (driveRes.fileId || driveRes.viewUrl)) {
            const isSimDrive = String(driveRes.fileId || "").startsWith("DRV_");
            att.drive_file_id = isSimDrive ? "" : (driveRes.fileId || "");
            att.url = isSimDrive ? "" : (driveRes.viewUrl || "");
          }
        }
      }
      saveTicketRichCache(ticket);
      const compactComments = ticket.comments.map(c => ({
        ...c,
        attachments: Array.isArray(c.attachments)
          ? c.attachments.map(a => {
              const isSimDrive = String(a.drive_file_id || "").startsWith("DRV_");
              return {
                name: a.name || "",
                mime: a.mime || "",
                url: isSimDrive ? "" : (a.url || ""),
                drive_file_id: isSimDrive ? "" : (a.drive_file_id || "")
              };
            })
          : []
      }));
      await callAPI("updateTicket", {
        ticketId: ticket.ticket_id,
        updates: { comments: compactComments },
        notifyEmail: !isInternal
      }, true);
    } catch (bgErr) {
      console.warn("Background reply attachment sync warning:", bgErr);
    }
  })();
}

function setCsatStar(n) {
  state.tempSelectedRating = n;
  document.querySelectorAll(".csat-star").forEach((s, idx) => {
    if (idx < n) s.classList.add("text-amber-500"), s.classList.remove("text-slate-300");
    else s.classList.remove("text-amber-500"), s.classList.add("text-slate-300");
  });
}

async function submitTicketCsat() {
  if (!state.activeDetailTicketId) return;
  const ticket = state.tickets.find(t => t.ticket_id === state.activeDetailTicketId);
  if (!ticket) return;

  ticket.csat_score = state.tempSelectedRating;
  ticket.csat_feedback = document.getElementById("csatFeedbackInput")?.value.trim() || "";
  showNotification(`ขอบคุณสำหรับการประเมิน ${ticket.csat_score} ดาว ⭐`, "success");
  openTicketDetailModal(ticket.ticket_id);
  renderAll();

  sendSystemEmailNotification("TICKET_UPDATED", {
    ticket_id: ticket.ticket_id,
    title: ticket.title,
    status: ticket.status,
    assigned_agent: ticket.assigned_agent,
    reporter_name: ticket.reporter_name,
    reporter_contact: ticket.reporter_contact,
    note: `ผู้ใช้งานประเมินความพึงพอใจ (CSAT): ${ticket.csat_score} ดาว ⭐ ${ticket.csat_feedback ? `("${ticket.csat_feedback}")` : ""}`
  });

  await callAPI("updateTicket", {
    ticketId: ticket.ticket_id,
    updates: { csat_score: ticket.csat_score, csat_feedback: ticket.csat_feedback }
  }, true);
}

function openTicketAdminActionModal(ticketId) {
  const ticket = state.tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) return;
  document.getElementById("adminActionTicketId").value = ticket.ticket_id;
  document.getElementById("adminActionTicketNumber").innerText = `รหัสเคส: ${ticket.ticket_id} - ${ticket.title}`;
  document.getElementById("adminActionStatus").value = ticket.status;
  const createdEl = document.getElementById("adminActionCreatedAt");
  if (createdEl) createdEl.innerText = ticket.created_at || "-";
  const resolvedEl = document.getElementById("adminActionResolvedAt");
  if (resolvedEl) {
    if (ticket.resolved_at) {
      resolvedEl.innerText = ticket.resolved_at;
      resolvedEl.className = "font-mono font-bold text-emerald-700";
    } else {
      resolvedEl.innerText = "รอดำเนินการ";
      resolvedEl.className = "font-sans font-medium text-slate-400";
    }
  }
  const noteEl = document.getElementById("adminActionNote");
  if (noteEl) noteEl.value = "";
  clearRichEditor("adminActionNoteEditor");
  const notifyChk = document.getElementById("adminActionNotifyEmail");
  if (notifyChk) notifyChk.checked = state.emailNotifyEnabled !== false;

  const agentSel = document.getElementById("adminActionAgent");
  if (agentSel) {
    const admins = state.userRoles.filter(r => r.role === "admin" || r.role === "superadmin");
    agentSel.innerHTML = admins.map(a => `<option value="${a.email}" ${safeLower(ticket.assigned_agent).includes(safeLower(a.email)) ? 'selected' : ''}>${a.name} (${a.email})</option>`).join("");
  }
  document.getElementById("ticketAdminActionModal").classList.remove("hidden");
}

function closeTicketAdminActionModal() {
  document.getElementById("ticketAdminActionModal").classList.add("hidden");
}

async function handleSaveTicketAdminAction(e) {
  e.preventDefault();
  const tid = document.getElementById("adminActionTicketId").value;
  const ticket = state.tickets.find(t => t.ticket_id === tid);
  if (!ticket) return;

  ticket.status = document.getElementById("adminActionStatus").value;
  ticket.assigned_agent = document.getElementById("adminActionAgent").value;
  const noteData = getRichEditorData("adminActionNoteEditor");
  const fallbackNote = document.getElementById("adminActionNote")?.value.trim() || "";
  const note = noteData.text || fallbackNote || (noteData.hasImages ? "(แนบรูปภาพประกอบ)" : "");
  const rawNoteHtml = noteData.html || "";
  const notifyEmail = document.getElementById("adminActionNotifyEmail")?.checked !== false;

  if (ticket.status === "Resolved" || ticket.status === "Closed") {
    if (!ticket.resolved_at) {
      ticket.resolved_at = getLocalTimestamp(0);
    }
  } else {
    ticket.resolved_at = "";
  }

  let addedComment = null;
  if (note || noteData.hasImages) {
    const statusPrefixHtml = `<div><strong style="color:#0369a1">[อัปเดตสถานะเป็น ${ticket.status}]</strong></div>`;
    addedComment = {
      sender: state.currentUser ? state.currentUser.name : "Admin",
      message: `[อัปเดตสถานะเป็น ${ticket.status}] ${note}`,
      message_html: rawNoteHtml ? `${statusPrefixHtml}${rawNoteHtml}` : "",
      time: getLocalTimestamp(0),
      is_internal: false
    };
    (ticket.comments = Array.isArray(ticket.comments) ? ticket.comments : []).push(addedComment);
  }

  saveTicketRichCache(ticket);
  closeTicketAdminActionModal();
  showNotification(`บันทึกการจัดการเคส [${ticket.ticket_id}] สำเร็จ`, "success");
  renderAll();

  if (notifyEmail) {
    sendSystemEmailNotification("TICKET_UPDATED", {
      ticket_id: ticket.ticket_id,
      title: ticket.title,
      status: ticket.status,
      assigned_agent: ticket.assigned_agent,
      reporter_name: ticket.reporter_name,
      reporter_contact: ticket.reporter_contact,
      resolved_at: ticket.resolved_at,
      note: note
    });
  }

  if (addedComment && addedComment.message_html && /data:image\//i.test(addedComment.message_html)) {
    addedComment.message_html = await replaceInlineImagesWithDriveUrls(addedComment.message_html, `${ticket.ticket_id}_ADMIN_NOTE`, ticket.ticket_id);
    saveTicketRichCache(ticket);
  }

  const compactComments = (ticket.comments || []).map(c => ({
    ...c,
    attachments: Array.isArray(c.attachments)
      ? c.attachments.map(a => ({ name: a.name || "", mime: a.mime || "", url: a.url || "", drive_file_id: a.drive_file_id || "" }))
      : undefined
  }));

  await callAPI("updateTicket", {
    ticketId: ticket.ticket_id,
    driveFolderId: state.driveFolderId || "",
    updates: {
      status: ticket.status,
      assigned_agent: ticket.assigned_agent,
      resolved_at: ticket.resolved_at,
      comments: compactComments
    },
    notifyEmail: notifyEmail
  }, true);
}

function runAutoAssignRoundRobin() {
  const openTickets = state.tickets.filter(t => t.status === "Open" && (!t.assigned_agent || t.assigned_agent === "ยังไม่มอบหมาย"));
  if (openTickets.length === 0) return showNotification("ไม่มีเคสใหม่ที่รอจ่ายงาน", "info");

  const admins = state.userRoles.filter(r => (r.role === "admin" || r.role === "superadmin") && (r.status !== "disabled"));
  if (admins.length === 0) return;

  openTickets.forEach((t, idx) => {
    const agent = admins[idx % admins.length];
    t.assigned_agent = agent.email || agent.name;
    t.status = "In Progress";
    (t.comments = Array.isArray(t.comments) ? t.comments : []).push({
      sender: "ระบบจ่ายงานอัตโนมัติ",
      message: `มอบหมายงานให้ ${agent.name} (${agent.email}) เรียบร้อย`,
      time: getLocalTimestamp(0),
      is_internal: true
    });

    sendSystemEmailNotification("TICKET_ASSIGNED", {
      ticket_id: t.ticket_id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      assigned_agent: `${agent.name} (${agent.email})`,
      reporter_name: t.reporter_name,
      reporter_dept: t.reporter_dept,
      reporter_contact: t.reporter_contact,
      sla_target: t.sla_target
    });

    callAPI("updateTicket", {
      ticketId: t.ticket_id,
      updates: {
        status: t.status,
        assigned_agent: t.assigned_agent,
        comments: t.comments
      },
      notifyEmail: true
    }, true);
  });

  showNotification(`จ่ายงานอัตโนมัติและส่งอีเมลแจ้งเตือนสำเร็จ ${openTickets.length} เคส`, "success");
  renderAll();
}

/* KNOWLEDGE BASE FUNCTIONS (Req 5: Single Clean Title Input) */
