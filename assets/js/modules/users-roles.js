let currentActionTargetEmail = null;
let currentActionTargetIndex = -1;
let pendingImportUsers = [];

function handleRoleSearchInput(val) {
  const clearBtn = document.getElementById("btnClearRoleSearch");
  if (clearBtn) {
    if (val && val.trim() !== "") clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }
  filterRolesTable();
}

function clearRoleSearchInput() {
  const input = document.getElementById("searchRoleInput");
  const clearBtn = document.getElementById("btnClearRoleSearch");
  if (input) input.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  filterRolesTable();
}

function resetRoleFilters() {
  clearRoleSearchInput();
  const deptEl = document.getElementById("filterRoleDept");
  const roleEl = document.getElementById("filterRoleLevel");
  const statusEl = document.getElementById("filterRoleStatus");
  if (deptEl) deptEl.value = "";
  if (roleEl) roleEl.value = "";
  if (statusEl) statusEl.value = "";
  renderRolesTable(state.userRoles);
}

function filterRolesTable() {
  const q = (document.getElementById("searchRoleInput")?.value || "").toLowerCase().trim();
  const d = document.getElementById("filterRoleDept")?.value;
  const r = document.getElementById("filterRoleLevel")?.value;
  const s = document.getElementById("filterRoleStatus")?.value;

  const filtered = state.userRoles.filter(u => {
    const parsed = splitFullName(u.name, u.first_name, u.last_name);
    const matchQ = !q ||
      (u.email && safeLower(u.email).includes(q)) ||
      (parsed.first_name && parsed.first_name.toLowerCase().includes(q)) ||
      (parsed.last_name && parsed.last_name.toLowerCase().includes(q)) ||
      (parsed.name && parsed.name.toLowerCase().includes(q)) ||
      (u.dept && u.dept.toLowerCase().includes(q)) ||
      (u.remark && u.remark.toLowerCase().includes(q));

    const matchD = !d || (u.dept && u.dept === d);
    const matchR = !r || u.role === r;
    const matchS = !s || (u.status || "active") === s;

    return matchQ && matchD && matchR && matchS;
  });

  renderRolesTable(filtered);
}

function renderRolesTable(filteredList = null) {
  const list = filteredList !== null ? filteredList : state.userRoles;
  const tbody = document.getElementById("rolesTableBody");
  const countBadge = document.getElementById("roleCountBadge");
  if (state.isInitialLoading) {
    if (countBadge) countBadge.innerText = "กำลังโหลด...";
    if (tbody) tbody.innerHTML = getDatabaseLoadingRowHtml(8, "กำลังโหลดรายชื่อผู้ใช้งานและสิทธิ์จากฐานข้อมูล...");
    return;
  }
  if (countBadge) {
    countBadge.innerText = `แสดง ${list.length} จาก ${state.userRoles.length} คน`;
  }
  if (!tbody) return;

  const isSuper = state.currentUser && state.currentUser.role === "superadmin";

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400 text-xs">ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไขการค้นหา</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((r, idx) => {
    const isPrimary = r.email === "itsupport@thaichamber.or.th" || r.email === "tatiphon.hi@thaichamber.or.th";
    const isActive = (r.status || "active") !== "disabled";
    const realIndex = state.userRoles.findIndex(u => safeLower(u.email) === safeLower(r.email));
    const parsedName = splitFullName(r.name, r.first_name, r.last_name);
    const firstNameText = parsedName.first_name || '-';
    const lastNameText = parsedName.last_name || '-';

    let roleBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"><svg class="w-3 h-3 text-slate-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg><span>User</span></span>';
    if (r.role === 'superadmin') {
      roleBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"><svg class="w-3 h-3 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg><span>Super Admin</span></span>';
    } else if (r.role === 'admin') {
      roleBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs"><svg class="w-3 h-3 text-sky-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg><span>Admin</span></span>';
    }

    const statusBadge = isActive
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>เปิดใช้งาน</span></span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>ปิดใช้งาน</span></span>`;

    return `
      <tr class="hover:bg-slate-50/80 transition border-b border-slate-100 whitespace-nowrap group text-xs">
        <td class="py-2.5 px-1.5 text-center text-slate-400 font-mono text-[11px] whitespace-nowrap">${idx + 1}</td>
        <td class="py-2.5 px-2.5 font-mono font-semibold text-[11px] text-slate-800 whitespace-nowrap max-w-[185px] xl:max-w-[280px] 2xl:max-w-none truncate" title="${escapeQuotes(r.email)}">
          <div class="flex items-center gap-1 truncate">
            <span class="truncate">${r.email}</span>
            ${isPrimary ? '<span class="text-amber-500 text-xs font-bold shrink-0" title="บัญชีผู้ดูแลระบบหลัก">★</span>' : ''}
          </div>
        </td>
        <td class="py-2.5 px-2 font-medium text-slate-800 text-xs whitespace-nowrap max-w-[100px] xl:max-w-[160px] 2xl:max-w-none truncate" title="${escapeQuotes(firstNameText)}">${firstNameText}</td>
        <td class="py-2.5 px-2 font-medium text-slate-800 text-xs whitespace-nowrap max-w-[110px] xl:max-w-[180px] 2xl:max-w-none truncate" title="${escapeQuotes(lastNameText)}">${lastNameText}</td>
        <td class="py-2.5 px-2 text-slate-600 text-xs whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium max-w-[135px] xl:max-w-[240px] 2xl:max-w-none truncate" title="${escapeQuotes(r.dept || '-')}">
            ${r.dept || '-'}
          </span>
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">${roleBadge}</td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">${statusBadge}</td>
        <td class="py-2.5 px-1.5 text-center whitespace-nowrap">
          ${isSuper ? `
            <button type="button" 
                    onclick="openRoleActionMenu(event, '${escapeQuotes(r.email)}', ${realIndex})" 
                    class="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/90 inline-flex items-center justify-center transition shadow-2xs cursor-pointer" 
                    title="จัดการผู้ใช้">
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.75"/>
                <circle cx="12" cy="12" r="1.75"/>
                <circle cx="12" cy="19" r="1.75"/>
              </svg>
            </button>
          ` : `
            <span class="text-slate-300 text-xs">-</span>
          `}
        </td>
      </tr>
    `;
  }).join("");
}

/* ACTION MENU LOGIC (Floating Dropdown) */
function openRoleActionMenu(e, email, idx) {
  e.stopPropagation();
  const menu = document.getElementById("roleActionFloatingMenu");
  if (!menu) return;

  if (!menu.classList.contains("hidden") && currentActionTargetEmail === email) {
    closeRoleActionMenu();
    return;
  }

  currentActionTargetEmail = email;
  currentActionTargetIndex = idx;

  const user = state.userRoles.find(u => safeLower(u.email) === email.toLowerCase()) || state.userRoles[idx];
  if (!user) return;

  const isPrimary = user.email === "itsupport@thaichamber.or.th" || user.email === "tatiphon.hi@thaichamber.or.th";
  const isActive = (user.status || "active") !== "disabled";

  document.getElementById("actionMenuUserEmail").innerText = user.email;
  document.getElementById("actionMenuUserName").innerText = user.name || user.dept || "-";

  const statusText = document.getElementById("actionMenuToggleStatusText");
  if (statusText) statusText.innerText = isActive ? "ปิดการใช้งาน (Disable)" : "เปิดใช้งาน (Active)";

  const delBtn = document.getElementById("actionMenuDeleteBtn");
  if (delBtn) {
    if (isPrimary) delBtn.classList.add("hidden");
    else delBtn.classList.remove("hidden");
  }

  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const menuWidth = 192; // w-48
  const menuHeight = 175;

  let left = rect.right - menuWidth;
  if (left < 10) left = 10;
  if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;

  let top = rect.bottom + 6;
  if (top + menuHeight > window.innerHeight - 10) {
    top = rect.top - menuHeight - 6;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.classList.remove("hidden");
}

function closeRoleActionMenu() {
  const menu = document.getElementById("roleActionFloatingMenu");
  if (menu) menu.classList.add("hidden");
  currentActionTargetEmail = null;
  currentActionTargetIndex = -1;
}

function executeRoleAction(action) {
  const email = currentActionTargetEmail;
  const idx = currentActionTargetIndex;
  closeRoleActionMenu();
  if (!email) return;

  if (action === "edit") {
    openRoleModal(idx);
  } else if (action === "resetPass") {
    openResetPasswordModal(email);
  } else if (action === "toggleStatus") {
    handleToggleUserStatus(email);
  } else if (action === "delete") {
    handleDeleteUserRole(email);
  }
}

/* EXCEL ACTIONS DROPDOWN */
function toggleExcelDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById("excelDropdownMenu");
  const chevron = document.getElementById("excelMenuChevron");
  if (!menu) return;
  const isHidden = menu.classList.contains("hidden");
  if (isHidden) {
    menu.classList.remove("hidden");
    if (chevron) chevron.classList.add("rotate-180");
  } else {
    menu.classList.add("hidden");
    if (chevron) chevron.classList.remove("rotate-180");
  }
}

function closeExcelDropdown() {
  const menu = document.getElementById("excelDropdownMenu");
  const chevron = document.getElementById("excelMenuChevron");
  if (menu && !menu.classList.contains("hidden")) {
    menu.classList.add("hidden");
    if (chevron) chevron.classList.remove("rotate-180");
  }
}

function triggerExcelAction(action) {
  closeExcelDropdown();
  if (action === "import") {
    openImportUserModal();
  } else if (action === "export") {
    exportUserRolesExcel();
  } else if (action === "template") {
    downloadUserRolesTemplate();
  } else if (action === "syncSheet") {
    triggerSyncAllRolesToSheet();
  }
}

document.addEventListener("click", (e) => {
  const menu = document.getElementById("roleActionFloatingMenu");
  if (menu && !menu.classList.contains("hidden")) {
    if (!menu.contains(e.target)) closeRoleActionMenu();
  }
  const excelDropdown = document.getElementById("excelDropdownContainer");
  if (excelDropdown && !excelDropdown.contains(e.target)) {
    closeExcelDropdown();
  }
});
window.addEventListener("scroll", closeRoleActionMenu, true);
window.addEventListener("resize", () => { closeRoleActionMenu(); closeExcelDropdown(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeRoleActionMenu();
    closeImportUserModal();
    closeExcelDropdown();
  }
});

/* TOGGLE STATUS & RESET PASSWORD */
function handleToggleUserStatus(email) {
  if (email === "itsupport@thaichamber.or.th" || email === "tatiphon.hi@thaichamber.or.th") {
    return showNotification("ไม่สามารถปิดการใช้งานบัญชี Super Admin หลักได้", "warning");
  }
  const user = state.userRoles.find(u => safeLower(u.email) === email.toLowerCase());
  if (!user) return;
  const current = user.status || "active";
  user.status = current === "active" ? "disabled" : "active";
  localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));
  filterRolesTable();
  showNotification(`${user.status === 'active' ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'} บัญชี [${user.email}] เรียบร้อย`, "success");
  callAPI("saveUserRole", { roleData: user }, true);
}

function openResetPasswordModal(email) {
  const user = state.userRoles.find(u => safeLower(u.email) === email.toLowerCase());
  if (!user) return;
  document.getElementById("resetPassTargetEmail").value = user.email;
  document.getElementById("resetPassUserLabel").innerText = `${user.name || user.email} (${user.email})`;
  document.getElementById("inputNewPassword").value = "Tcc@" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById("resetPasswordModal").classList.remove("hidden");
}

function closeResetPasswordModal() {
  document.getElementById("resetPasswordModal").classList.add("hidden");
}

function generateRandomPassForReset() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  let pwd = "";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById("inputNewPassword").value = pwd;
}

function submitResetPassword() {
  const email = document.getElementById("resetPassTargetEmail").value;
  const newPass = document.getElementById("inputNewPassword").value.trim();
  if (!newPass) return showNotification("กรุณาระบุรหัสผ่านใหม่", "warning");
  const user = state.userRoles.find(u => safeLower(u.email) === email.toLowerCase());
  if (!user) return;
  user.password = newPass;
  localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));
  closeResetPasswordModal();
  filterRolesTable();
  showNotification(`รีเซ็ตรหัสผ่านของ [${user.email}] เรียบร้อย`, "success");
  callAPI("saveUserRole", { roleData: user }, true);
}

async function handleDeleteUserRole(email) {
  if (email === "itsupport@thaichamber.or.th" || email === "tatiphon.hi@thaichamber.or.th") {
    return showNotification("ไม่สามารถลบบัญชี Super Admin หลักของระบบได้", "warning");
  }
  if (!confirm(`คุณต้องการลบผู้ใช้งาน "${email}" ออกจากระบบใช่หรือไม่?`)) return;
  const idx = state.userRoles.findIndex(u => safeLower(u.email) === email.toLowerCase());
  if (idx !== -1) {
    state.userRoles.splice(idx, 1);
    localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));
    filterRolesTable();
    renderDepartmentSelects();
    showNotification(`ลบผู้ใช้งาน [${email}] เรียบร้อย`, "info");
    await callAPI("deleteUserRole", { email: email }, true);
  }
}

/* EXCEL EXPORT & TEMPLATE DOWNLOAD (Req 1) */
function downloadUserRolesTemplate() {
  const headers = ["อีเมล (Username/Email)*", "ชื่อ (First Name)*", "นามสกุล (Last Name)*", "ฝ่าย/แผนก (Department)", "ระดับสิทธิ์ (superadmin/admin/user)*", "รหัสผ่าน (Password)*", "สถานะ (active/disabled)*", "หมายเหตุ"];
  const sampleRows = [
    ["somchai.ja@thaichamber.or.th", "สมชาย", "ใจดี", "ฝ่ายเทคโนโลยีสารสนเทศ", "user", "Tcc@2026", "active", "ผู้ใช้งานทั่วไป"],
    ["wattanachai.mi@thaichamber.or.th", "วัฒนชัย", "มั่นคง", "ฝ่ายเทคโนโลยีสารสนเทศ", "admin", "Admin@2026", "active", "เจ้าหน้าที่ไอที"],
    ["supakon.su@thaichamber.or.th", "ศุภกร", "สุขเจริญ", "ฝ่ายการเงินและบัญชี", "user", "User@2026", "active", "ประสานงานการเงิน"]
  ];

  if (window.XLSX) {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      ws["!cols"] = [
        { wch: 32 },
        { wch: 18 },
        { wch: 20 },
        { wch: 26 },
        { wch: 34 },
        { wch: 22 },
        { wch: 24 },
        { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "UserTemplate");
      XLSX.writeFile(wb, "tcc_user_template.xlsx");
      showNotification("ดาวน์โหลดแบบฟอร์ม Template Excel (.xlsx) เรียบร้อย (เปิดกรอกได้ทันที)", "success");
      return;
    } catch (e) {
      console.warn("XLSX template export fallback to CSV:", e);
    }
  }

  const csvContent = "\uFEFF" + [
    headers.join(","),
    ...sampleRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tcc_user_template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showNotification("ดาวน์โหลดแบบฟอร์ม Template เรียบร้อย (เปิดกรอกใน Excel ได้ทันที)", "success");
}

function exportUserRolesExcel() {
  if (!state.userRoles || state.userRoles.length === 0) {
    return showNotification("ไม่มีข้อมูลผู้ใช้งานสำหรับส่งออก", "warning");
  }
  const headers = ["อีเมล (Username/Email)", "ชื่อ (First Name)", "นามสกุล (Last Name)", "ฝ่าย/แผนก (Department)", "ระดับสิทธิ์ (Role)", "รหัสผ่าน (Password)", "สถานะ (Status)", "หมายเหตุ"];
  const rows = state.userRoles.map(u => {
    const parsed = splitFullName(u.name, u.first_name, u.last_name);
    return [
      u.email || "",
      parsed.first_name || "",
      parsed.last_name || "",
      u.dept || "",
      u.role || "user",
      u.password || "123456",
      u.status || "active",
      u.remark || ""
    ];
  });

  if (window.XLSX) {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [
        { wch: 32 }, { wch: 18 }, { wch: 20 }, { wch: 26 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 26 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "UserRoles");
      XLSX.writeFile(wb, `tcc_user_accounts_${getOffsetDate(0)}.xlsx`);
      showNotification("ส่งออกไฟล์ Excel สำหรับจัดการผู้ใช้เรียบร้อย", "success");
      return;
    } catch (e) {
      console.warn("XLSX export fallback to CSV:", e);
    }
  }

  const csvRows = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tcc_user_accounts_${getOffsetDate(0)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showNotification("ส่งออกไฟล์ Excel สำหรับจัดการผู้ใช้เรียบร้อย", "success");
}

/* CSV & EXCEL IMPORT MODAL & PARSER (Req 1) */
function openImportUserModal() {
  pendingImportUsers = [];
  const previewContainer = document.getElementById("importPreviewContainer");
  const confirmBtn = document.getElementById("btnConfirmImportCsv");
  const fileInput = document.getElementById("inputImportCsvFile");
  if (previewContainer) previewContainer.classList.add("hidden");
  if (confirmBtn) confirmBtn.disabled = true;
  if (fileInput) fileInput.value = "";
  document.getElementById("importUserModal")?.classList.remove("hidden");
  initImportDropZone();
}

function closeImportUserModal() {
  document.getElementById("importUserModal")?.classList.add("hidden");
  pendingImportUsers = [];
}

function initImportDropZone() {
  const dropZone = document.getElementById("importDropZone");
  if (!dropZone || dropZone.dataset.initialized) return;
  dropZone.dataset.initialized = "true";

  ["dragenter", "dragover"].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("border-tcc-600", "bg-sky-50");
    });
  });

  ["dragleave", "drop"].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("border-tcc-600", "bg-sky-50");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileInput = document.getElementById("inputImportCsvFile");
      if (fileInput) {
        fileInput.files = e.dataTransfer.files;
        previewImportCsvFile({ target: fileInput });
      }
    }
  });
}

function processImportedRows(rawRows, fileName) {
  if (!rawRows || rawRows.length === 0) {
    showNotification("ไฟล์ที่เลือกไม่มีข้อมูลผู้ใช้", "warning");
    return;
  }

  // หาแถว Header และแมปคอลัมน์ (รองรับทั้งไฟล์ที่แยก ชื่อ/นามสกุล และไฟล์ที่รวม ชื่อ-นามสกุล)
  let headerIndex = -1;
  let colMap = { email: 0, first_name: -1, last_name: -1, name: 1, dept: 2, role: 3, password: 4, status: 5, remark: 6 };

  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = (rawRows[r] || []).map(c => String(c || "").trim().toLowerCase());
    const hasEmailHeader = row.some(c => c.includes("อีเมล") || c.includes("email") || c.includes("username") || c.includes("บัญชี"));
    if (hasEmailHeader) {
      headerIndex = r;
      row.forEach((colName, idx) => {
        if (colName.includes("อีเมล") || colName.includes("email") || colName.includes("username") || colName.includes("บัญชี")) colMap.email = idx;
        else if (colName.includes("ชื่อ-นามสกุล") || colName.includes("ชื่อสกุล") || colName.includes("fullname") || colName.includes("full name") || colName.includes("full_name")) colMap.name = idx;
        else if (colName.includes("นามสกุล") || colName.includes("last") || colName.includes("surname") || colName.includes("lname")) colMap.last_name = idx;
        else if (colName.includes("ชื่อ") || colName.includes("first") || colName.includes("fname") || colName.includes("name")) {
          colMap.first_name = idx;
          colMap.name = idx;
        }
        else if (colName.includes("แผนก") || colName.includes("ฝ่าย") || colName.includes("ส่วนงาน") || colName.includes("สำนัก") || colName.includes("dept") || colName.includes("department")) colMap.dept = idx;
        else if (colName.includes("สิทธิ์") || colName.includes("role") || colName.includes("level")) colMap.role = idx;
        else if (colName.includes("รหัส") || colName.includes("pass") || colName.includes("pwd")) colMap.password = idx;
        else if (colName.includes("สถานะ") || colName.includes("status")) colMap.status = idx;
        else if (colName.includes("หมายเหตุ") || colName.includes("remark") || colName.includes("note")) colMap.remark = idx;
      });
      break;
    }
  }

  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;
  pendingImportUsers = [];

  for (let i = startRow; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    let email = String(row[colMap.email] !== undefined ? row[colMap.email] : (row[0] || "")).trim().toLowerCase();

    // หาก index ตาม colMap ไม่มี @ ให้ลองสแกนหาช่องอื่นในแถวที่มี @
    if (!email || !email.includes("@")) {
      const foundEmail = row.find(val => String(val || "").includes("@") && String(val || "").includes("."));
      if (foundEmail) {
        email = String(foundEmail).trim().toLowerCase();
      }
    }

    // ถ้ายังไม่มีอีเมล หรือเป็นแถวหัวตาราง ให้ข้าม
    if (!email || !email.includes("@") || email.includes("username/email")) {
      continue;
    }

    let parsedName;
    if (colMap.last_name !== -1) {
      const rawFn = String(row[colMap.first_name !== -1 ? colMap.first_name : 1] || "").trim();
      const rawLn = String(row[colMap.last_name] || "").trim();
      parsedName = splitFullName("", rawFn, rawLn);
    } else {
      const rawFull = String(row[colMap.name !== -1 ? colMap.name : 1] || "").trim() || email.split("@")[0];
      parsedName = splitFullName(rawFull, "", "");
    }
    const first_name = parsedName.first_name || email.split("@")[0];
    const last_name = parsedName.last_name || "";
    const name = parsedName.name || first_name;

    const dept = String(row[colMap.dept] !== undefined ? row[colMap.dept] : "").trim();

    let rawRole = String(row[colMap.role] !== undefined ? row[colMap.role] : "").trim().toLowerCase();
    let role = "user";
    if (rawRole.includes("super")) role = "superadmin";
    else if (rawRole.includes("admin")) role = "admin";
    else role = "user";

    const password = String(row[colMap.password] !== undefined ? row[colMap.password] : "").trim() || "123456";

    let rawStatus = String(row[colMap.status] !== undefined ? row[colMap.status] : "").trim().toLowerCase();
    let status = (rawStatus.includes("disable") || rawStatus.includes("ปิด") || rawStatus.includes("ระงับ")) ? "disabled" : "active";

    const remark = String(row[colMap.remark] !== undefined ? row[colMap.remark] : "").trim();

    pendingImportUsers.push({ email, first_name, last_name, name, dept, role, password, status, remark });
  }

  if (pendingImportUsers.length === 0) {
    showNotification("ไม่พบบัญชีผู้ใช้ที่ถูกต้องในไฟล์ (ต้องมีอีเมลที่มีเครื่องหมาย @)", "error");
    return;
  }

  const previewContainer = document.getElementById("importPreviewContainer");
  const previewSummary = document.getElementById("importPreviewSummary");
  const previewValidCount = document.getElementById("importPreviewValidCount");
  const confirmBtn = document.getElementById("btnConfirmImportCsv");
  const tbody = document.getElementById("importPreviewTbody");

  if (previewContainer) previewContainer.classList.remove("hidden");
  if (previewSummary) previewSummary.innerText = `ไฟล์: ${fileName}`;
  if (previewValidCount) previewValidCount.innerText = `พร้อมนำเข้า ${pendingImportUsers.length} รายการ`;
  if (confirmBtn) confirmBtn.disabled = false;

  if (tbody) {
    tbody.innerHTML = pendingImportUsers.slice(0, 50).map(u => `
      <tr class="hover:bg-slate-50">
        <td class="py-1.5 px-2.5 font-mono font-medium">${u.email}</td>
        <td class="py-1.5 px-2.5">${u.first_name || '-'}</td>
        <td class="py-1.5 px-2.5">${u.last_name || '-'}</td>
        <td class="py-1.5 px-2.5">${u.dept || '-'}</td>
        <td class="py-1.5 px-2.5 font-semibold">${u.role}</td>
        <td class="py-1.5 px-2.5">${u.status === 'active' ? 'Active' : 'Disabled'}</td>
      </tr>
    `).join("") + (pendingImportUsers.length > 50 ? `<tr><td colspan="6" class="py-1.5 px-2.5 text-center text-slate-400 italic">... และอีก ${pendingImportUsers.length - 50} รายการ</td></tr>` : "");
  }
}

function previewImportCsvFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const isExcel = /\.(xlsx|xls)$/i.test(file.name);

  if (isExcel) {
    readExcelFile(file, (err, rows) => {
      if (err) {
        console.error(err);
        showNotification("ไม่สามารถอ่านไฟล์ Excel ได้: " + (err.message || err), "error");
        return;
      }
      processImportedRows(rows, file.name);
    });
  } else {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const text = decodeTextBuffer(evt.target.result);
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
        if (lines.length <= 1) {
          showNotification("ไฟล์ที่เลือกไม่มีข้อมูลผู้ใช้", "warning");
          return;
        }

        const headerLine = lines[0];
        const delimiter = headerLine.includes(";") ? ";" : (headerLine.includes("\t") ? "\t" : ",");
        const rows = lines.map(l => parseCsvLine(l, delimiter));
        processImportedRows(rows, file.name);
      } catch(err) {
        console.error(err);
        showNotification("เกิดข้อผิดพลาดในการประมวลผลไฟล์ CSV", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

let isSyncingRoles = false;

async function syncUserRolesToGoogleSheets(usersList) {
  if (isSyncingRoles) {
    showNotification("กำลังดำเนินการบันทึกข้อมูลผู้ใช้ลง Supabase อยู่แล้ว กรุณารอสักครู่", "info");
    return;
  }
  if (!Array.isArray(usersList) || usersList.length === 0) {
    showNotification("ไม่มีรายชื่อผู้ใช้งานที่ต้องซิงค์", "warning");
    return;
  }

  isSyncingRoles = true;
  const banner = document.getElementById("roleSyncProgressBanner");
  const icon = document.getElementById("roleSyncIcon");
  const title = document.getElementById("roleSyncTitle");
  const percent = document.getElementById("roleSyncPercent");
  const bar = document.getElementById("roleSyncProgressBar");
  const subtext = document.getElementById("roleSyncSubtext");
  const countText = document.getElementById("roleSyncCountText");
  const syncBtn = document.getElementById("btnSyncAllRolesToSheet");

  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.classList.add("opacity-60", "cursor-not-allowed");
  }

  if (banner) {
    banner.className = "rounded-2xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs transition-all duration-300";
    if (icon) { icon.innerText = "🔄"; icon.className = "inline-block text-base animate-spin"; }
    if (title) title.innerText = "กำลังบันทึกข้อมูลลง Supabase...";
    if (percent) percent.innerText = "0%";
    if (bar) { bar.className = "bg-sky-600 h-2 rounded-full transition-all duration-200"; bar.style.width = "0%"; }
    if (subtext) subtext.innerText = "กำลังเชื่อมต่อกับฐานข้อมูล Supabase...";
    if (countText) countText.innerText = `0 / ${usersList.length}`;
    banner.classList.remove("hidden");
  }

  // Ensure all users in usersList are present/updated in state.userRoles & storage
  usersList.forEach(u => {
    if (!u || !u.email) return;
    const norm = normalizeUserRole(u);
    const idx = state.userRoles.findIndex(x => safeLower(x.email) === safeLower(norm.email));
    if (idx !== -1) {
      state.userRoles[idx] = normalizeUserRole({ ...state.userRoles[idx], ...norm });
    } else {
      state.userRoles.push(norm);
    }
  });
  localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));
  renderRolesTable();

  // Check if in Demo Mode
  if (state.useDemoMode) {
    if (banner) {
      banner.className = "rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs";
      if (icon) { icon.innerText = "ℹ️"; icon.className = "text-base"; }
      if (title) title.innerText = "โหมดจำลอง (Demo Mode)";
      if (subtext) subtext.innerText = "บันทึกในหน่วยความจำและ Local Storage เรียบร้อยแล้ว (เปิดโหมด Live ในหน้าตั้งค่า Supabase เพื่อซิงค์ขึ้นฐานข้อมูล)";
      setTimeout(() => banner.classList.add("hidden"), 4000);
    }
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.classList.remove("opacity-60", "cursor-not-allowed");
    }
    isSyncingRoles = false;
    return;
  }

  // 1. Try Batch Sync API first (Fast: 1 single execution for all users)
  let batchSuccess = false;
  try {
    if (bar) bar.style.width = "25%";
    if (percent) percent.innerText = "25%";
    if (subtext) subtext.innerText = `กำลังส่งข้อมูลแบบชุด (Batch) ${usersList.length} รายการลง Supabase...`;

    const batchRes = await callAPI("saveUserRolesBatch", { rolesList: usersList }, true);
    if (batchRes && batchRes.status === "success") {
      batchSuccess = true;
      if (bar) bar.style.width = "100%";
      if (percent) percent.innerText = "100%";
      if (countText) countText.innerText = `${usersList.length} / ${usersList.length}`;
      if (icon) { icon.innerText = "✅"; icon.className = "text-base"; }
      if (title) title.innerText = "บันทึกข้อมูลลง Supabase สำเร็จครบถ้วน!";
      if (subtext) subtext.innerText = `บันทึกข้อมูลสำเร็จครบทั้ง ${usersList.length} รายการ (Batch Upsert)`;
      if (banner) banner.className = "rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs transition-all duration-300";
      showNotification(`บันทึกข้อมูลผู้ใช้งานลง Supabase ครบทั้ง ${usersList.length} รายการเรียบร้อยแล้ว`, "success");
      setTimeout(() => { if (banner) banner.classList.add("hidden"); }, 5000);
    }
  } catch (err) {
    console.warn("saveUserRolesBatch failed, falling back to sequential:", err);
  }

  // 2. Sequential Throttled Queue Fallback if batch failed
  if (!batchSuccess) {
    if (subtext) subtext.innerText = "ระบบกำลังทยอยบันทึกทีละรายการอย่างปลอดภัย (Safe Sequential Queue)...";
    let savedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < usersList.length; i++) {
      const user = usersList[i];
      const currentNum = i + 1;
      const pct = Math.round((currentNum / usersList.length) * 100);

      if (bar) bar.style.width = `${pct}%`;
      if (percent) percent.innerText = `${pct}%`;
      if (countText) countText.innerText = `${currentNum} / ${usersList.length}`;
      if (subtext) subtext.innerText = `กำลังบันทึก: ${user.email} (${currentNum} จาก ${usersList.length}) - กรุณาอย่าเพิ่งปิดหน้าต่าง...`;

      let ok = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await callAPI("saveUserRole", { roleData: user }, true);
          if (res && res.status === "success") {
            ok = true;
            break;
          }
        } catch (e) {
          console.warn(`Retry ${attempt + 1} for ${user.email}:`, e);
        }
        await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
      }

      if (ok) savedCount++;
      else failedCount++;

      await new Promise(r => setTimeout(r, 80));
    }

    if (banner) {
      if (failedCount === 0) {
        banner.className = "rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs transition-all duration-300";
        if (icon) { icon.innerText = "✅"; icon.className = "text-base"; }
        if (title) title.innerText = "บันทึกข้อมูลลง Supabase สำเร็จครบถ้วน!";
        if (subtext) subtext.innerText = `บันทึกข้อมูลสำเร็จครบทั้ง ${savedCount} รายการ`;
        showNotification(`บันทึกข้อมูลผู้ใช้งานลง Supabase ครบทั้ง ${savedCount} รายการเรียบร้อยแล้ว`, "success");
      } else {
        banner.className = "rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs transition-all duration-300";
        if (icon) { icon.innerText = "⚠️"; icon.className = "text-base"; }
        if (title) title.innerText = "บันทึกข้อมูลบางส่วนเรียบร้อย";
        if (subtext) subtext.innerText = `บันทึกสำเร็จ ${savedCount} รายการ, ติดขัด ${failedCount} รายการ (กดปุ่ม "ซิงค์ขึ้น Supabase" เพื่อบันทึกซ้ำได้)`;
        showNotification(`บันทึกสำเร็จ ${savedCount} รายการ (ไม่สำเร็จ ${failedCount} รายการ)`, "warning");
      }
      setTimeout(() => { if (banner) banner.classList.add("hidden"); }, 7000);
    }
  }

  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.classList.remove("opacity-60", "cursor-not-allowed");
  }
  isSyncingRoles = false;
}

function triggerSyncAllRolesToSheet() {
  if (!state.userRoles || state.userRoles.length === 0) {
    return showNotification("ไม่มีรายชื่อผู้ใช้งานในระบบสำหรับซิงค์", "warning");
  }
  showNotification(`เริ่มทำการซิงค์รายชื่อผู้ใช้ทั้งหมด ${state.userRoles.length} รายการขึ้น Supabase...`, "info");
  syncUserRolesToGoogleSheets(state.userRoles);
}

function executeImportCsv() {
  if (!pendingImportUsers || pendingImportUsers.length === 0) {
    return showNotification("ไม่มีข้อมูลที่พร้อมนำเข้า", "warning");
  }

  const usersToImport = pendingImportUsers.map(u => normalizeUserRole(u));
  let count = 0;
  usersToImport.forEach(userObj => {
    const existingIdx = state.userRoles.findIndex(u => safeLower(u.email) === userObj.email.toLowerCase());
    if (existingIdx !== -1) {
      state.userRoles[existingIdx] = normalizeUserRole({ ...state.userRoles[existingIdx], ...userObj });
    } else {
      state.userRoles.push(userObj);
    }
    count++;
  });

  localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));
  closeImportUserModal();
  renderDepartmentSelects();
  renderRolesTable();
  showNotification(`นำเข้าข้อมูลผู้ใช้งาน ${count} รายการ กำลังเริ่มบันทึกลง Supabase...`, "info");

  // Start resilient sync to Supabase
  syncUserRolesToGoogleSheets(usersToImport);
}

function syncRoleFullNameInput() {
  const fn = document.getElementById("inputRoleFirstName")?.value.trim() || "";
  const ln = document.getElementById("inputRoleLastName")?.value.trim() || "";
  const nameEl = document.getElementById("inputRoleName");
  if (nameEl) {
    nameEl.value = [fn, ln].filter(Boolean).join(" ").trim();
  }
}

function openRoleModal(idx = -1) {
  document.getElementById("roleEditIndex").value = idx;
  renderDepartmentSelects();
  const deptEl = document.getElementById("inputRoleDept");
  if (deptEl) {
    deptEl.innerHTML = '<option value="">-- ไม่ระบุฝ่าย --</option>' + (state.departments || []).map(d => `<option value="${escapeQuotes(d)}">${d}</option>`).join("");
  }

  const titleEl = document.getElementById("roleModalTitle");
  const firstNameEl = document.getElementById("inputRoleFirstName");
  const lastNameEl = document.getElementById("inputRoleLastName");
  const fullNameEl = document.getElementById("inputRoleName");

  if (idx >= 0 && state.userRoles[idx]) {
    const r = normalizeUserRole(state.userRoles[idx]);
    if (titleEl) titleEl.innerText = "แก้ไขข้อมูลผู้ใช้งานระบบ";
    document.getElementById("inputRoleEmail").value = r.email;
    if (firstNameEl) firstNameEl.value = r.first_name || "";
    if (lastNameEl) lastNameEl.value = r.last_name || "";
    if (fullNameEl) fullNameEl.value = r.name || "";
    if (deptEl) {
      if (r.dept && !Array.from(deptEl.options).some(o => o.value === r.dept)) {
        const opt = document.createElement("option");
        opt.value = r.dept;
        opt.textContent = r.dept;
        deptEl.appendChild(opt);
      }
      deptEl.value = r.dept || "";
    }
    document.getElementById("inputRoleLevel").value = r.role || "user";
    document.getElementById("inputRolePassword").value = r.password || "123456";
    document.getElementById("inputRoleStatus").value = r.status || "active";
    document.getElementById("inputRoleRemark").value = r.remark || "";
  } else {
    if (titleEl) titleEl.innerText = "เพิ่มผู้ใช้งานระบบใหม่";
    document.getElementById("roleForm").reset();
    if (firstNameEl) firstNameEl.value = "";
    if (lastNameEl) lastNameEl.value = "";
    if (fullNameEl) fullNameEl.value = "";
    document.getElementById("inputRolePassword").value = "Tcc@" + Math.floor(1000 + Math.random() * 9000);
    document.getElementById("inputRoleStatus").value = "active";
    document.getElementById("inputRoleLevel").value = "user";
  }
  document.getElementById("roleModal").classList.remove("hidden");
}

function closeRoleModal() { document.getElementById("roleModal").classList.add("hidden"); }

function handleSaveUserRole(e) {
  e.preventDefault();
  const idx = parseInt(document.getElementById("roleEditIndex").value, 10);
  const email = document.getElementById("inputRoleEmail").value.trim().toLowerCase();
  const password = document.getElementById("inputRolePassword").value.trim() || "123456";
  const fnInput = document.getElementById("inputRoleFirstName")?.value.trim() || "";
  const lnInput = document.getElementById("inputRoleLastName")?.value.trim() || "";
  const legacyNameInput = document.getElementById("inputRoleName")?.value.trim() || "";
  const parsedName = splitFullName(legacyNameInput || email.split("@")[0], fnInput, lnInput);

  const roleObj = normalizeUserRole({
    email: email,
    first_name: parsedName.first_name,
    last_name: parsedName.last_name,
    name: parsedName.name,
    dept: document.getElementById("inputRoleDept")?.value || "",
    role: document.getElementById("inputRoleLevel").value,
    password: password,
    status: document.getElementById("inputRoleStatus").value,
    remark: document.getElementById("inputRoleRemark").value.trim()
  });
  if (idx >= 0) {
    const dup = state.userRoles.findIndex((u, i) => i !== idx && safeLower(u.email) === email);
    if (dup !== -1) {
      return showNotification(`อีเมล "${email}" ซ้ำกับผู้ใช้งานอื่นในระบบ`, "warning");
    }
    state.userRoles[idx] = roleObj;
  } else {
    const existing = state.userRoles.findIndex(u => safeLower(u.email) === email);
    if (existing !== -1) state.userRoles[existing] = roleObj;
    else state.userRoles.push(roleObj);
  }

  localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(state.userRoles));
  closeRoleModal();
  showNotification(`บันทึกข้อมูลผู้ใช้ [${email}] เรียบร้อย`, "success");
  applyUserRoleUI();
  renderDepartmentSelects();
  filterRolesTable();
  callAPI("saveUserRole", { roleData: roleObj }, true);
}
