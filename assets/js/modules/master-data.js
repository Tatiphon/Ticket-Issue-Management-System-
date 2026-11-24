function renderDepartmentSelects() {
  const baseDepts = (state.departments || []).map(d => stripDepartmentNumberPrefix(d)).filter(Boolean);
  const roleDepts = (state.userRoles || []).map(u => stripDepartmentNumberPrefix(u.dept || "")).filter(Boolean);
  const mergedDepts = Array.from(new Set([...baseDepts, ...roleDepts]));

  const placeholderText = (state.isInitialLoading && mergedDepts.length === 0)
    ? "⏳ กำลังโหลดรายชื่อฝ่าย / แผนกจากฐานข้อมูล..."
    : "-- กรุณาเลือกฝ่าย / แผนก --";
  const optionsHtml = [`<option value="">${placeholderText}</option>`]
    .concat(mergedDepts.map(d => `<option value="${escapeQuotes(d)}">${d}</option>`))
    .join('');

  const borrowDeptEl = document.getElementById("borrowerDept");
  if (borrowDeptEl) {
    const cur = stripDepartmentNumberPrefix(borrowDeptEl.value);
    borrowDeptEl.innerHTML = optionsHtml;
    if (cur && mergedDepts.includes(cur)) borrowDeptEl.value = cur;
  }

  const ticketDeptEl = document.getElementById("ticketReporterDept");
  if (ticketDeptEl) {
    const cur = stripDepartmentNumberPrefix(ticketDeptEl.value);
    ticketDeptEl.innerHTML = optionsHtml;
    if (cur && mergedDepts.includes(cur)) ticketDeptEl.value = cur;
  }

  const editHistDeptEl = document.getElementById("editHistoryDept");
  if (editHistDeptEl) {
    const cur = stripDepartmentNumberPrefix(editHistDeptEl.value);
    editHistDeptEl.innerHTML = optionsHtml;
    if (cur && mergedDepts.includes(cur)) editHistDeptEl.value = cur;
  }

  const userRoleDeptEl = document.getElementById("inputRoleDept");
  if (userRoleDeptEl) {
    const cur = stripDepartmentNumberPrefix(userRoleDeptEl.value);
    userRoleDeptEl.innerHTML = '<option value="">-- ไม่ระบุฝ่าย --</option>' + mergedDepts.map(d => `<option value="${escapeQuotes(d)}">${d}</option>`).join("");
    if (cur && mergedDepts.includes(cur)) userRoleDeptEl.value = cur;
  }

  const filterRoleDeptEl = document.getElementById("filterRoleDept");
  if (filterRoleDeptEl) {
    const cur = stripDepartmentNumberPrefix(filterRoleDeptEl.value);
    const allDepts = [...mergedDepts].sort();
    filterRoleDeptEl.innerHTML = '<option value="">🏢 ทุกฝ่าย / แผนก</option>' + allDepts.map(d => `<option value="${escapeQuotes(d)}">${d}</option>`).join("");
    if (cur) filterRoleDeptEl.value = cur;
  }

  populateUserAutocompleteDatalists();
}

function renderTicketCategorySelects() {
  const cats = Array.isArray(state.ticketCategories) ? state.ticketCategories : [];
  const tktCat = document.getElementById("ticketCategory");
  if (tktCat) {
    const cur = tktCat.value;
    if (state.isInitialLoading && cats.length === 0) {
      tktCat.innerHTML = '<option value="">⏳ กำลังโหลดหมวดหมู่ปัญหาจากฐานข้อมูล...</option>';
    } else {
      tktCat.innerHTML = '<option value="">-- เลือกหมวดหมู่งาน --</option>' + cats.map(c => `<option value="${escapeQuotes(c)}">${c}</option>`).join('');
      if (cur && cats.includes(cur)) tktCat.value = cur;
    }
    handleTicketCategoryChange(tktCat.value);
  }

  const kbCat = document.getElementById("inputKbCategory");
  if (kbCat) {
    const cur = kbCat.value;
    if (state.isInitialLoading && cats.length === 0) {
      kbCat.innerHTML = '<option value="">⏳ กำลังโหลดหมวดหมู่จากฐานข้อมูล...</option>';
    } else {
      kbCat.innerHTML = cats.map(c => `<option value="${escapeQuotes(c)}">${c}</option>`).join('');
      if (cur && cats.includes(cur)) kbCat.value = cur;
    }
  }

  renderInternalSystemSelects();
}

function renderInternalSystemSelects() {
  const systems = Array.isArray(state.internalSystems) ? state.internalSystems : [];
  const sysEl = document.getElementById("ticketSystemName");
  if (sysEl) {
    const cur = sysEl.value;
    const placeholder = (state.isInitialLoading && systems.length === 0)
      ? "⏳ กำลังโหลดรายชื่อระบบสารสนเทศจากฐานข้อมูล..."
      : "-- กรุณาเลือกชื่อระบบสารสนเทศ / เว็บไซต์ --";
    sysEl.innerHTML = `<option value="">${placeholder}</option>` +
      systems.map(s => `<option value="${escapeQuotes(s)}">${s}</option>`).join('');
    if (cur && systems.includes(cur)) sysEl.value = cur;
  }

  const hdSysEl = document.getElementById("hdReportSystemName");
  if (hdSysEl) {
    const cur = hdSysEl.value;
    const allSys = Array.from(new Set([...systems, ...(state.tickets || []).map(t => t.system_name).filter(Boolean)]));
    hdSysEl.innerHTML = '<option value="">ทุกระบบสารสนเทศ / ทั้งหมด</option>' +
      allSys.map(s => `<option value="${escapeQuotes(s)}">${s}</option>`).join('');
    if (cur) hdSysEl.value = cur;
  }
}

/* INTERNAL SYSTEM / WEBSITE MANAGEMENT (Admin Configurable Dropdown) */
function saveInternalSystemsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_INTERNAL_SYSTEMS, JSON.stringify(state.internalSystems || []));
  } catch (e) {}
}

function openInternalSystemManageModal() {
  renderInternalSystemManagementList();
  document.getElementById("internalSystemManageModal")?.classList.remove("hidden");
}

function closeInternalSystemManageModal() {
  document.getElementById("internalSystemManageModal")?.classList.add("hidden");
}

function renderInternalSystemManagementList() {
  const container = document.getElementById("internalSystemListContainer");
  if (!container) return;
  const systems = state.internalSystems || [];
  if (systems.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">ยังไม่มีรายชื่อระบบสารสนเทศภายใน</div>';
    return;
  }
  container.innerHTML = systems.map((sys, idx) => `
    <div class="flex items-center justify-between px-3 py-2.5 text-xs hover:bg-slate-50 transition gap-2">
      <div class="flex items-center gap-2 min-w-0 pr-2">
        <span class="font-mono text-[11px] font-bold text-slate-400 w-5 text-right shrink-0">${idx + 1}.</span>
        <span class="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
        <span class="font-semibold text-slate-800 truncate" title="${escapeQuotes(sys)}">${sys}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button type="button" onclick="moveInternalSystemOrder(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold ${idx === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700 cursor-pointer'} transition" title="เลื่อนขึ้น">
          ⬆️
        </button>
        <button type="button" onclick="moveInternalSystemOrder(${idx}, 1)" ${idx === systems.length - 1 ? 'disabled' : ''} class="px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold ${idx === systems.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700 cursor-pointer'} transition" title="เลื่อนลง">
          ⬇️
        </button>
        <button type="button" onclick="handleEditInternalSystem(${idx})" class="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer" title="แก้ไขชื่อระบบ">
          ✏️
        </button>
        <button type="button" onclick="handleDeleteInternalSystem(${idx})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer" title="ลบชื่อระบบ">
          🗑️
        </button>
      </div>
    </div>
  `).join("");
}

function moveInternalSystemOrder(idx, dir) {
  const systems = state.internalSystems || [];
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= systems.length) return;
  const temp = systems[idx];
  systems[idx] = systems[targetIdx];
  systems[targetIdx] = temp;
  saveInternalSystemsToStorage();
  renderInternalSystemSelects();
  renderInternalSystemManagementList();
  renderAll();
  showNotification("จัดเรียงลำดับชื่อระบบสารสนเทศเรียบร้อย", "success");
  callAPI("saveInternalSystemsOrder", { systemsList: [...systems] }, true);
}

function handleAddNewInternalSystem(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("newInternalSystemInput");
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  if (!state.internalSystems) state.internalSystems = [];
  if (state.internalSystems.includes(val)) {
    return showNotification(`ชื่อระบบ "${val}" มีอยู่ในรายการแล้ว`, "warning");
  }
  state.internalSystems.push(val);
  input.value = "";
  saveInternalSystemsToStorage();
  renderInternalSystemSelects();
  renderInternalSystemManagementList();
  renderAll();
  showNotification(`เพิ่มระบบ "${val}" เรียบร้อย`, "success");
  callAPI("addInternalSystem", { systemName: val, systemsList: [...state.internalSystems] }, true);
}

function handleEditInternalSystem(idx) {
  const current = state.internalSystems[idx];
  if (!current) return;
  const updated = prompt("แก้ไขชื่อระบบสารสนเทศภายใน / เว็บไซต์:", current);
  if (updated && updated.trim() && updated.trim() !== current) {
    const val = updated.trim();
    if (state.internalSystems.includes(val)) {
      return showNotification(`ชื่อระบบ "${val}" มีอยู่ในระบบแล้ว`, "warning");
    }
    state.internalSystems[idx] = val;
    (state.tickets || []).forEach(t => {
      if (t.system_name === current) t.system_name = val;
    });
    saveInternalSystemsToStorage();
    renderInternalSystemSelects();
    renderInternalSystemManagementList();
    renderAll();
    showNotification(`แก้ไขชื่อระบบเป็น "${val}" เรียบร้อย`, "success");
    callAPI("updateInternalSystem", { oldName: current, newName: val, systemsList: [...state.internalSystems] }, true);
  }
}

function handleDeleteInternalSystem(idx) {
  const current = state.internalSystems[idx];
  if (!current) return;
  if (!confirm(`คุณต้องการลบชื่อระบบ "${current}" ออกจากรายการตัวเลือกใช่หรือไม่?`)) return;
  state.internalSystems.splice(idx, 1);
  saveInternalSystemsToStorage();
  renderInternalSystemSelects();
  renderInternalSystemManagementList();
  renderAll();
  showNotification(`ลบชื่อระบบ "${current}" เรียบร้อย`, "info");
  callAPI("deleteInternalSystem", { systemName: current, systemsList: [...state.internalSystems] }, true);
}

/* HELPDESK SUMMARY REPORT & EXPORT FUNCTIONS */
function openTicketCategoryManageModal() {
  renderTicketCategoryManagementList();
  document.getElementById("ticketCategoryManageModal").classList.remove("hidden");
}

function closeTicketCategoryManageModal() {
  document.getElementById("ticketCategoryManageModal").classList.add("hidden");
}

function renderTicketCategoryManagementList() {
  const container = document.getElementById("ticketCategoryListContainer");
  if (!container) return;
  const cats = state.ticketCategories || [];
  if (cats.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">ยังไม่มีรายการหมวดหมู่ปัญหา</div>';
    return;
  }
  container.innerHTML = cats.map((cat, idx) => `
    <div class="flex items-center justify-between px-3 py-2.5 text-xs hover:bg-slate-50 transition gap-2">
      <div class="flex items-center gap-2 min-w-0 pr-2">
        <span class="font-mono text-[11px] font-bold text-slate-400 w-5 text-right shrink-0">${idx + 1}.</span>
        <span class="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
        <span class="font-semibold text-slate-800 truncate" title="${escapeQuotes(cat)}">${cat}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button type="button" onclick="moveTicketCategoryOrder(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold ${idx === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-purple-700 cursor-pointer'} transition" title="เลื่อนขึ้น">
          ⬆️
        </button>
        <button type="button" onclick="moveTicketCategoryOrder(${idx}, 1)" ${idx === cats.length - 1 ? 'disabled' : ''} class="px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold ${idx === cats.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-purple-700 cursor-pointer'} transition" title="เลื่อนลง">
          ⬇️
        </button>
        <button type="button" onclick="handleEditTicketCategory(${idx})" class="p-1.5 text-slate-500 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition cursor-pointer" title="แก้ไข">
          ✏️
        </button>
        <button type="button" onclick="handleDeleteTicketCategory(${idx})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer" title="ลบ">
          🗑️
        </button>
      </div>
    </div>
  `).join("");
}

function moveTicketCategoryOrder(idx, dir) {
  const cats = state.ticketCategories || [];
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= cats.length) return;
  const temp = cats[idx];
  cats[idx] = cats[targetIdx];
  cats[targetIdx] = temp;
  saveTicketCategoriesToStorage();
  renderTicketCategorySelects();
  renderTicketCategoryManagementList();
  renderAll();
  showNotification("จัดเรียงลำดับหมวดหมู่ปัญหาเรียบร้อย", "success");
  callAPI("saveTicketCategoriesOrder", { categoriesList: [...cats] }, true);
}

function handleAddNewTicketCategory(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("newTicketCategoryInput");
  const val = input.value.trim();
  if (!val) return;
  if (!state.ticketCategories) state.ticketCategories = [];
  if (state.ticketCategories.includes(val)) {
    return showNotification(`หมวดหมู่ "${val}" มีอยู่ในระบบแล้ว`, "warning");
  }
  state.ticketCategories.push(val);
  input.value = "";
  saveTicketCategoriesToStorage();
  renderTicketCategorySelects();
  renderTicketCategoryManagementList();
  renderAll();
  showNotification(`เพิ่มหมวดหมู่ "${val}" เรียบร้อย`, "success");
  callAPI("addTicketCategory", { categoryName: val, categoriesList: [...state.ticketCategories] }, true);
}

function handleEditTicketCategory(idx) {
  const current = state.ticketCategories[idx];
  if (!current) return;
  const updated = prompt("แก้ไขชื่อหมวดหมู่ปัญหา:", current);
  if (updated && updated.trim() && updated.trim() !== current) {
    const val = updated.trim();
    state.ticketCategories[idx] = val;
    saveTicketCategoriesToStorage();
    renderTicketCategorySelects();
    renderTicketCategoryManagementList();
    renderAll();
    showNotification(`แก้ไขหมวดหมู่เป็น "${val}" เรียบร้อย`, "success");
    callAPI("updateTicketCategory", { oldName: current, newName: val, categoriesList: [...state.ticketCategories] }, true);
  }
}

function handleDeleteTicketCategory(idx) {
  const current = state.ticketCategories[idx];
  if (!current) return;
  if (!confirm(`คุณต้องการลบหมวดหมู่ "${current}" ใช่หรือไม่?`)) return;
  state.ticketCategories.splice(idx, 1);
  saveTicketCategoriesToStorage();
  renderTicketCategorySelects();
  renderTicketCategoryManagementList();
  renderAll();
  showNotification(`ลบหมวดหมู่ "${current}" เรียบร้อย`, "info");
  callAPI("deleteTicketCategory", { categoryName: current, categoriesList: [...state.ticketCategories] }, true);
}

/* QUICK AVAILABLE LIST */
function openDeptManagementModal() {
  state.departments = Array.from(new Set((state.departments || []).map(d => stripDepartmentNumberPrefix(d)).filter(Boolean)));
  const container = document.getElementById("deptManageListContainer");
  document.getElementById("deptCountLabel").innerText = state.departments.length;
  if (container) {
    container.innerHTML = state.departments.map((d, idx) => `
      <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
        <span class="font-medium text-slate-800">${d}</span>
        <button onclick="handleDeleteDept(${idx})" class="text-rose-500 hover:text-rose-700 font-bold">🗑️</button>
      </div>
    `).join("");
  }
  document.getElementById("deptManageModal").classList.remove("hidden");
}
function closeDeptManagementModal() { document.getElementById("deptManageModal").classList.add("hidden"); }

function handleAddNewDepartment() {
  const input = document.getElementById("newDepartmentNameInput");
  const val = stripDepartmentNumberPrefix(input.value);
  if (!val) return;
  if (!state.departments.includes(val)) state.departments.push(val);
  input.value = "";
  renderDepartmentSelects();
  openDeptManagementModal();
  showNotification(`เพิ่มแผนก "${val}" เรียบร้อย`, "success");
  callAPI("addDepartment", { deptName: val }, true);
}
function handleDeleteDept(idx) {
  const deptName = state.departments[idx];
  state.departments.splice(idx, 1);
  renderDepartmentSelects();
  openDeptManagementModal();
  if (deptName) callAPI("deleteDepartment", { deptName }, true);
}
