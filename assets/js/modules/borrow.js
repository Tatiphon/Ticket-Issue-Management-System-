function openSearchableItemDropdown() {
  filterSearchableItemDropdown();
  document.getElementById("searchableItemDropdownMenu").classList.remove("hidden");
}
function toggleSearchableItemDropdown() {
  const menu = document.getElementById("searchableItemDropdownMenu");
  if (menu.classList.contains("hidden")) openSearchableItemDropdown();
  else menu.classList.add("hidden");
}

function filterSearchableItemDropdown() {
  const q = (document.getElementById("itemPickerSearchInput")?.value || "").toLowerCase().trim();
  const container = document.getElementById("searchableItemOptionsContainer");
  if (!container) return;

  if (state.isInitialLoading) {
    container.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดรายการอุปกรณ์จากฐานข้อมูล...");
    return;
  }

  const avail = state.items.filter(i => isItemAvailable(i) && !state.selectedBorrowItems.includes(i.item_id));
  const filtered = avail.filter(i => !q || safeLower(i.item_id).includes(q) || safeLower(i.item_name).includes(q) || safeLower(i.category).includes(q));

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">${avail.length === 0 ? "ไม่มีอุปกรณ์ว่างให้ยืม" : "ไม่พบอุปกรณ์"}</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const imgInfo = resolveItemImageInfo(item);
    return `
    <div onclick="addSelectedItem('${escapeQuotes(item.item_id)}'); document.getElementById('searchableItemDropdownMenu').classList.add('hidden');" 
         class="p-2 hover:bg-tcc-50 rounded-xl cursor-pointer transition flex items-center justify-between gap-2.5 text-xs border border-transparent hover:border-tcc-200">
      <div class="flex items-center gap-2.5 min-w-0">
        <div onclick="event.stopPropagation(); openItemImagePreview('${escapeQuotes(item.item_id)}')" title="คลิกเพื่อดูรูปตัวอย่างขนาดใหญ่" class="w-12 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative group">
          <img src="${imgInfo.displaySrc}" alt="${escapeQuotes(item.item_name)}" data-err-step="0" class="w-full h-full object-cover" onerror="handleEquipmentImageError(this, '${escapeQuotes(imgInfo.driveFileId)}', '${imgInfo.fallbackSvg}');" />
          <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold">🔍</div>
        </div>
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 truncate">${item.item_name}</div>
          <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
            <span>${item.item_id} • ${item.category}</span>
            ${imgInfo.driveFileId ? '<span class="text-emerald-600 font-sans font-bold">☁️ Drive</span>' : ''}
          </div>
        </div>
      </div>
      <span class="text-tcc-700 font-bold bg-tcc-50 px-2.5 py-1 rounded-lg shrink-0 border border-tcc-200/60">+ เลือก</span>
    </div>
  `;
  }).join("");
}

function addSelectedItem(itemId) {
  if (state.selectedBorrowItems.includes(itemId)) return;
  state.selectedBorrowItems.push(itemId);
  renderSelectedBorrowItems();
  filterSearchableItemDropdown();
  renderQuickAvailableList();
}
function removeSelectedItem(itemId) {
  state.selectedBorrowItems = state.selectedBorrowItems.filter(id => id !== itemId);
  renderSelectedBorrowItems();
  filterSearchableItemDropdown();
  renderQuickAvailableList();
}
function clearSelectedBorrowItems() {
  state.selectedBorrowItems = [];
  renderSelectedBorrowItems();
  filterSearchableItemDropdown();
  renderQuickAvailableList();
}

function renderSelectedBorrowItems() {
  const container = document.getElementById("selectedItemsContainer");
  const count = state.selectedBorrowItems.length;
  document.getElementById("selectedItemsCountBadge").innerText = `เลือกแล้ว ${count} ชิ้น`;
  document.getElementById("btnBorrowText").innerText = `ยืนยันการยืมอุปกรณ์ (${count} ชิ้น)`;

  if (!container) return;
  if (count === 0) {
    container.innerHTML = `<p class="col-span-full text-xs text-slate-400 py-2 text-center italic">ยังไม่ได้เลือกอุปกรณ์ (คลิกเลือกจากช่องค้นหาหรือตารางด้านขวาเพื่อดูรูปตัวอย่าง)</p>`;
    return;
  }
  container.innerHTML = state.selectedBorrowItems.map(id => {
    const item = state.items.find(i => i.item_id === id) || { item_id: id, item_name: id, category: "Equipment" };
    const imgInfo = resolveItemImageInfo(item);
    return `
      <div class="flex items-center gap-2.5 p-2 rounded-xl text-xs bg-white border border-tcc-200 text-tcc-900 shadow-xs hover:border-tcc-400 transition animate-fadeIn">
        <div onclick="openItemImagePreview('${escapeQuotes(id)}')" title="คลิกเพื่อขยายดูรูปตัวอย่างอุปกรณ์" class="w-20 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer relative group">
          <img src="${imgInfo.displaySrc}" alt="${escapeQuotes(item.item_name)}" data-err-step="0" class="w-full h-full object-cover" onerror="handleEquipmentImageError(this, '${escapeQuotes(imgInfo.driveFileId)}', '${imgInfo.fallbackSvg}');" />
          <div class="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold">🔍 ขยาย</div>
        </div>
        <div class="min-w-0 flex-1 space-y-0.5">
          <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-1 min-w-0">
              <span class="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-tcc-50 text-tcc-700 border border-tcc-200/70 shrink-0">${id}</span>
              ${imgInfo.driveFileId ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shrink-0">☁️ Drive</span>' : ''}
            </div>
            <button type="button" onclick="removeSelectedItem('${escapeQuotes(id)}')" title="นำรายการนี้ออก" class="text-slate-400 hover:text-rose-600 font-bold px-1 cursor-pointer shrink-0">✕</button>
          </div>
          <div class="font-bold text-slate-900 text-xs truncate" title="${escapeQuotes(item.item_name)}">${item.item_name}</div>
          <div class="text-[10px] text-slate-500 flex items-center justify-between gap-1">
            <span class="truncate">${item.category || '-'}</span>
            <button type="button" onclick="openItemImagePreview('${escapeQuotes(id)}')" class="text-tcc-600 hover:underline font-bold shrink-0 cursor-pointer">🔍 ขยายดูรูป</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/* DEPARTMENT & CATEGORY SELECT POPULATION */
function selectQuickAvailCategory(cat) {
  state.selectedQuickAvailCat = cat;
  renderQuickAvailableList();
}

function renderQuickAvailableList() {
  const container = document.getElementById("quickAvailableContainer");
  const pillsContainer = document.getElementById("quickAvailableCategoryPills");
  const countEl = document.getElementById("quickAvailableCount");
  if (state.isInitialLoading) {
    if (countEl) countEl.innerText = "กำลังโหลด...";
    if (pillsContainer) pillsContainer.innerHTML = "";
    if (container) container.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดรายการอุปกรณ์ที่ว่างพร้อมยืมจากฐานข้อมูล...");
    return;
  }
  const q = (document.getElementById("quickAvailableSearch")?.value || "").toLowerCase().trim();
  const avail = state.items.filter(i => isItemAvailable(i));

  if (countEl) countEl.innerText = `${avail.length} ชิ้น`;

  if (pillsContainer) {
    const uniqueCats = ["ทั้งหมด", ...Array.from(new Set(avail.map(i => i.category)))];
    pillsContainer.innerHTML = uniqueCats.map(cat => {
      const isAct = (state.selectedQuickAvailCat || "ทั้งหมด") === cat;
      return `
        <button type="button" onclick="selectQuickAvailCategory('${escapeQuotes(cat)}')" 
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${isAct ? 'bg-tcc-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          ${cat}
        </button>
      `;
    }).join("");
  }

  if (!container) return;

  const filtered = avail.filter(i => {
    const matchSearch = !q || safeLower(i.item_name).includes(q) || safeLower(i.item_id).includes(q) || safeLower(i.serial_number).includes(q);
    const matchCat = (!state.selectedQuickAvailCat || state.selectedQuickAvailCat === "ทั้งหมด") || i.category === state.selectedQuickAvailCat;
    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-center py-12 text-xs text-slate-400">ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข</div>';
    return;
  }

  container.innerHTML = filtered.map(i => {
    const isSel = state.selectedBorrowItems.includes(i.item_id);
    const imgInfo = resolveItemImageInfo(i);
    return `
      <div onclick="addSelectedItem('${escapeQuotes(i.item_id)}')" 
           class="p-2.5 rounded-xl border ${isSel ? 'border-tcc-500 bg-tcc-50/70 shadow-xs' : 'border-slate-100 hover:border-tcc-300 bg-white hover:bg-slate-50/60'} cursor-pointer transition flex items-center justify-between gap-2.5 text-xs">
        <div class="flex items-center gap-2.5 min-w-0 pr-1">
          <div onclick="event.stopPropagation(); openItemImagePreview('${escapeQuotes(i.item_id)}')" title="คลิกเพื่อดูรูปตัวอย่างอุปกรณ์ขนาดใหญ่" class="w-14 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative group">
            <img src="${imgInfo.displaySrc}" alt="${escapeQuotes(i.item_name)}" data-err-step="0" class="w-full h-full object-cover" onerror="handleEquipmentImageError(this, '${escapeQuotes(imgInfo.driveFileId)}', '${imgInfo.fallbackSvg}');" />
            <div class="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold">🔍 ดูรูป</div>
          </div>
          <div class="min-w-0">
            <p class="font-bold text-slate-900 truncate">${i.item_name}</p>
            <div class="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5 flex-wrap">
              <span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">${i.item_id}</span>
              <span>•</span>
              <span class="truncate">${i.category}</span>
              ${i.serial_number ? `<span>• S/N: ${i.serial_number}</span>` : ''}
              ${imgInfo.driveFileId ? `<span class="text-emerald-600 font-sans font-bold">• ☁️ Drive</span>` : ''}
            </div>
          </div>
        </div>
        <div class="shrink-0 flex items-center gap-1">
          <button type="button" onclick="event.stopPropagation(); openItemImagePreview('${escapeQuotes(i.item_id)}')" title="ดูรูปตัวอย่างอุปกรณ์" class="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-sky-700 border border-slate-200/70 transition text-[11px]">🖼️</button>
          ${isSel ? '<span class="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg font-bold">✓ เลือกแล้ว</span>' : '<span class="inline-flex items-center gap-1 text-[11px] text-tcc-700 bg-tcc-50 hover:bg-tcc-100 px-2.5 py-1 rounded-lg font-semibold border border-tcc-200">+ เลือก</span>'}
        </div>
      </div>
    `;
  }).join("");
}

/* BORROW SUBMIT (Req 1: STRICT ITB-YYYY-MM-DD-XXXX SEQUENCE) */
async function handleBorrowSubmit(e) {
  e.preventDefault();
  if (!state.currentUser) {
    showNotification("กรุณาเข้าสู่ระบบก่อนทำรายการยืม", "warning");
    openLoginModal();
    return;
  }
  if (state.selectedBorrowItems.length === 0) {
    return showNotification("กรุณาเลือกอุปกรณ์อย่างน้อย 1 ชิ้น", "warning");
  }

  const bNameVal = document.getElementById("borrowerName").value.trim();
  const deptVal = document.getElementById("borrowerDept")?.value.trim() || "";
  const contactVal = document.getElementById("borrowerContact").value.trim();
  const borrowPurposeData = getRichEditorData("borrowPurposeEditor");
  const notesVal = borrowPurposeData.text || (document.getElementById("borrowPurpose")?.value || "").trim();
  const notifyEmail = document.getElementById("borrowNotifyEmailCheckbox")?.checked !== false;

  const bDate = document.getElementById("borrowStartDate")?.value || getOffsetDate(0);
  const rDate = document.getElementById("expectedReturnDate").value;
  if (rDate && bDate && rDate < bDate) {
    return showNotification("กำหนดวันที่ส่งคืนต้องไม่น้อยกว่าวันที่ยืมเครื่อง (วันเริ่มต้น)", "warning");
  }

  const btn = document.getElementById("btnSubmitBorrow");
  const spinner = document.getElementById("btnBorrowSpinner");
  btn.disabled = true; spinner.classList.remove("hidden");

  const createdTransIds = [];
  const borrowedItemNames = [];

  state.selectedBorrowItems.forEach((id, idx) => {
    // Req 1: แต่ละรายการจะได้รับเลขรหัสธุรกรรม ITB-YYYY-MM-DD-XXXX เรียงลำดับ 4 หลักตามมาตรฐาน
    const transId = generateNextBorrowTransId(idx);
    createdTransIds.push(transId);
    const itemObj = state.items.find(i => i.item_id === id);
    borrowedItemNames.push(itemObj ? `[${id}] ${itemObj.item_name}` : `[${id}]`);

    const newBorrow = {
      trans_id: transId,
      item_id: id,
      borrower_name: bNameVal,
      borrower_dept: deptVal,
      borrower_contact: contactVal,
      borrow_date: bDate,
      expected_return: rDate
    };
    state.activeBorrows.push(newBorrow);
    state.allLogs.unshift({
      ...newBorrow,
      timestamp: getLocalTimestamp(0),
      actual_return: "",
      trans_status: "Borrowed",
      notes: notesVal
    });
  });

  syncItemStatuses();
  showNotification(`บันทึกการยืมสำเร็จ ${state.selectedBorrowItems.length} รายการ (รหัส: ${createdTransIds[0]}${createdTransIds.length > 1 ? ' ถึง ' + createdTransIds[createdTransIds.length - 1] : ''})`, "success");

  if (notifyEmail) {
    sendSystemEmailNotification("BORROW_CREATED", {
      transIds: createdTransIds,
      itemNames: borrowedItemNames,
      borrowerName: bNameVal,
      dept: deptVal,
      contact: contactVal,
      borrowDate: bDate,
      expectedReturn: rDate,
      notes: notesVal
    });
  }

  callAPI("borrowItem", {
    itemIds: [...state.selectedBorrowItems],
    transIds: createdTransIds,
    borrowerName: bNameVal,
    dept: deptVal,
    contact: contactVal,
    borrowDate: bDate,
    expectedReturn: rDate,
    notes: notesVal,
    notifyEmail: notifyEmail
  }, true);

  document.getElementById("borrowForm").reset();
  clearRichEditor("borrowPurposeEditor");
  const borrowNotifyChk = document.getElementById("borrowNotifyEmailCheckbox");
  if (borrowNotifyChk) borrowNotifyChk.checked = state.emailNotifyEnabled !== false;
  clearSelectedBorrowItems();
  setDefaultReturnDate();
  autoFillUserFormsFromDatabase(true);

  btn.disabled = false; spinner.classList.add("hidden");
  renderAll();
  switchTab('myBorrowsTab');
}

function renderMyBorrowsTable() {
  const tbody = document.getElementById("myBorrowsTableBody");
  const badge = document.getElementById("tabBadgeMyBorrows");
  if (!tbody) return;
  if (state.isInitialLoading) {
    if (badge) badge.innerText = "...";
    tbody.innerHTML = getDatabaseLoadingRowHtml(6, "กำลังโหลดรายการยืมอุปกรณ์จากฐานข้อมูล...");
    return;
  }

  const user = state.currentUser;
  const q = (document.getElementById("searchMyBorrowsInput")?.value || "").toLowerCase().trim();
  const uEmail = normalizeEmailDomainTypos(user?.email || "").toLowerCase().trim();
  const uName = (user?.name || "").trim();
  const uDept = getCurrentUserEffectiveDept(user);

  const subtextEl = document.getElementById("myBorrowsDeptSubtext");
  if (subtextEl) {
    subtextEl.innerHTML = uDept
      ? `แสดงรายการอุปกรณ์ที่คุณและเพื่อนร่วมสังกัด <b class="text-tcc-700">${uDept}</b> ยืมไว้ เพื่อช่วยกันติดตามกำหนดส่งคืน`
      : `ตรวจสอบกำหนดส่งคืนและติดตามรายการยืมของคุณและเพื่อนร่วมฝ่าย/แผนกเดียวกัน`;
  }

  const myBorrows = state.activeBorrows.filter(b => {
    const contact = normalizeEmailDomainTypos(b.borrower_contact || "").toLowerCase();
    const bName = String(b.borrower_name || "");
    const bDept = String(b.borrower_dept || "").trim();
    const isMine = !!user && ((uEmail && contact.includes(uEmail)) || (uName && bName.includes(uName)));
    const isSameDept = !!user && !!uDept && isSameDepartmentName(uDept, bDept);
    const tid = String(b.trans_id || "").toLowerCase();
    const iid = String(b.item_id || "").toLowerCase();
    const itemObj = state.items.find(i => i.item_id === b.item_id);
    const iName = String(itemObj?.item_name || "").toLowerCase();
    const bNameLower = bName.toLowerCase();
    return (isMine || isSameDept) && (!q || tid.includes(q) || iid.includes(q) || iName.includes(q) || bNameLower.includes(q));
  });

  if (badge) badge.innerText = myBorrows.length;
  if (myBorrows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-400 text-xs">ไม่พบรายการยืมของคุณหรือในฝ่าย/แผนกเดียวกันในขณะนี้ 🎉</td></tr>';
    return;
  }

  const today = getOffsetDate(0);
  tbody.innerHTML = myBorrows.map(b => {
    const item = state.items.find(i => i.item_id === b.item_id) || { item_id: b.item_id, item_name: b.item_id };
    const imgInfo = resolveItemImageInfo(item);
    const isOverdue = b.expected_return && b.expected_return < today;
    const contact = String(b.borrower_contact || "").toLowerCase();
    const bName = String(b.borrower_name || "");
    const isDirectMine = !!user && ((uEmail && contact.includes(uEmail)) || (uName && bName.includes(uName)));
    const ownerPill = isDirectMine
      ? `<span class="inline-block ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-tcc-50 text-tcc-700 border border-tcc-200">ของฉัน</span>`
      : `<span class="inline-block ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">ร่วมฝ่าย</span>`;
    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3 px-4 font-mono font-medium text-xs text-slate-700">${b.trans_id}</td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <div onclick="openItemImagePreview('${escapeQuotes(b.item_id)}')" title="คลิกเพื่อดูรูปตัวอย่างอุปกรณ์" class="w-11 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer">
              <img src="${imgInfo.displaySrc}" alt="${escapeQuotes(item.item_name)}" data-err-step="0" class="w-full h-full object-cover" onerror="handleEquipmentImageError(this, '${escapeQuotes(imgInfo.driveFileId)}', '${imgInfo.fallbackSvg}');" />
            </div>
            <div>
              <div class="font-bold text-slate-900">${item.item_name}</div>
              <div class="text-[11px] text-slate-400 font-mono">[${b.item_id}]</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-4"><div class="font-medium text-slate-800">${b.borrower_name}${ownerPill}</div><div class="text-[11px] text-slate-500">${b.borrower_dept}</div></td>
        <td class="py-3 px-4 text-xs">${b.borrow_date}</td>
        <td class="py-3 px-4 text-xs font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-700'}">${b.expected_return}</td>
        <td class="py-3 px-4 text-center">
          ${isOverdue ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">เกินกำหนด</span>' : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">กำลังยืม</span>'}
        </td>
      </tr>
    `;
  }).join("");
}

function renderReturnTable(filteredList = null) {
  const list = filteredList !== null ? filteredList : state.activeBorrows;
  const tbody = document.getElementById("returnTableBody");
  const today = getOffsetDate(0);
  if (!tbody) return;
  if (state.isInitialLoading) {
    tbody.innerHTML = getDatabaseLoadingRowHtml(8, "กำลังโหลดรายการค้างส่งคืนจากฐานข้อมูล...");
    return;
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400 text-xs">ไม่มีรายการค้างส่งคืน 🎉</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(b => {
    const item = state.items.find(i => i.item_id === b.item_id) || { item_id: b.item_id, item_name: b.item_id };
    const imgInfo = resolveItemImageInfo(item);
    const isOverdue = b.expected_return && b.expected_return < today;
    const isSel = state.selectedReturnTransIds.includes(b.trans_id);

    return `
      <tr class="hover:bg-slate-50/80 transition border-b border-slate-100 whitespace-nowrap text-xs ${isSel ? 'bg-emerald-50/50' : ''}">
        <td class="py-2.5 px-2.5 text-center whitespace-nowrap">
          <input type="checkbox" onchange="toggleReturnSelection('${escapeQuotes(b.trans_id)}')" ${isSel ? 'checked' : ''} class="w-4 h-4 rounded text-tcc-600 cursor-pointer align-middle">
        </td>
        <td class="py-2.5 px-2 font-mono text-[11px] font-bold text-tcc-700 whitespace-nowrap" title="${escapeQuotes(b.trans_id)}">${b.trans_id}</td>
        <td class="py-2.5 px-2 whitespace-nowrap max-w-[190px] xl:max-w-[280px] 2xl:max-w-[380px] truncate" title="[${escapeQuotes(b.item_id)}] ${escapeQuotes(item.item_name)}">
          <div class="flex items-center gap-2 truncate">
            <img onclick="openItemImagePreview('${escapeQuotes(b.item_id)}')" src="${imgInfo.displaySrc}" alt="" data-err-step="0" class="w-8 h-6 rounded object-cover border border-slate-200 cursor-pointer shrink-0" onerror="handleEquipmentImageError(this, '${escapeQuotes(imgInfo.driveFileId)}', '${imgInfo.fallbackSvg}');" />
            <div class="truncate">
              <span class="font-semibold text-slate-800">${item.item_name}</span>
              <span class="font-mono text-[10px] text-slate-400 ml-0.5">(${b.item_id})</span>
            </div>
          </div>
        </td>
        <td class="py-2.5 px-2 whitespace-nowrap max-w-[165px] xl:max-w-[260px] 2xl:max-w-[340px] truncate" title="${escapeQuotes(b.borrower_name)} (${escapeQuotes(b.borrower_dept || '-')})">
          <div class="truncate">
            <span class="font-medium text-slate-800">${b.borrower_name}</span>
            ${b.borrower_dept ? `<span class="text-[10px] text-slate-400 ml-0.5">(${b.borrower_dept})</span>` : ''}
          </div>
        </td>
        <td class="py-2.5 px-2 text-[11px] font-mono text-slate-600 whitespace-nowrap">${b.borrow_date || '-'}</td>
        <td class="py-2.5 px-2 text-[11px] font-mono font-semibold whitespace-nowrap ${isOverdue ? 'text-rose-600' : 'text-slate-700'}">${b.expected_return || '-'}</td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          ${isOverdue 
            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 border border-rose-200/70 font-bold whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>เกินกำหนด</span>' 
            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-800 border border-amber-200/70 font-bold whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>กำลังยืม</span>'}
        </td>
        <td class="py-2.5 px-2.5 text-right whitespace-nowrap">
          <button onclick="requestReturnItem('${escapeQuotes(b.trans_id)}', '${escapeQuotes(item.item_name)}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition whitespace-nowrap cursor-pointer">รับคืน</button>
        </td>
      </tr>
    `;
  }).join("");
}

function toggleReturnSelection(tid) {
  if (state.selectedReturnTransIds.includes(tid)) state.selectedReturnTransIds = state.selectedReturnTransIds.filter(id => id !== tid);
  else state.selectedReturnTransIds.push(tid);
  updateBulkReturnBar();
}
function toggleSelectAllReturns(checked) {
  state.selectedReturnTransIds = checked ? state.activeBorrows.map(b => b.trans_id) : [];
  updateBulkReturnBar();
  renderReturnTable();
}
function clearReturnSelections() {
  state.selectedReturnTransIds = [];
  updateBulkReturnBar();
  renderReturnTable();
}
function updateBulkReturnBar() {
  const bar = document.getElementById("bulkReturnBar");
  const c = state.selectedReturnTransIds.length;
  if (!bar) return;
  if (c > 0) {
    bar.classList.remove("hidden");
    document.getElementById("bulkReturnCountText").innerText = `เลือกแล้ว ${c} รายการ`;
    document.getElementById("bulkReturnBtnLabel").innerText = `รับคืนที่เลือก (${c} รายการ)`;
  } else {
    bar.classList.add("hidden");
  }
}

function requestBulkReturn() {
  if (state.selectedReturnTransIds.length === 0) return;
  document.getElementById("returnConfirmMessage").innerText = `ยืนยันรับคืนอุปกรณ์ทั้งหมด ${state.selectedReturnTransIds.length} รายการ?`;
  const chk = document.getElementById("returnConfirmNotifyEmail");
  if (chk) chk.checked = state.emailNotifyEnabled !== false;
  document.getElementById("btnConfirmReturnAction").onclick = () => doExecuteBulkReturn([...state.selectedReturnTransIds]);
  document.getElementById("returnConfirmModal").classList.remove("hidden");
}
function requestReturnItem(tid, name) {
  document.getElementById("returnConfirmMessage").innerText = `ยืนยันรับคืน "${name}" (รหัส: ${tid})?`;
  const chk = document.getElementById("returnConfirmNotifyEmail");
  if (chk) chk.checked = state.emailNotifyEnabled !== false;
  document.getElementById("btnConfirmReturnAction").onclick = () => doExecuteBulkReturn([tid]);
  document.getElementById("returnConfirmModal").classList.remove("hidden");
}
function closeReturnConfirmModal() { document.getElementById("returnConfirmModal").classList.add("hidden"); }

function doExecuteBulkReturn(transIds) {
  const notifyEmail = document.getElementById("returnConfirmNotifyEmail")?.checked !== false;
  closeReturnConfirmModal();
  const now = getLocalTimestamp(0);
  const returnedDetails = [];

  transIds.forEach(tid => {
    const bIdx = state.activeBorrows.findIndex(b => b.trans_id === tid);
    let bRecord = null;
    if (bIdx !== -1) {
      bRecord = state.activeBorrows[bIdx];
      const item = state.items.find(i => i.item_id === bRecord.item_id);
      if (item) item.status = "Available";
      state.activeBorrows.splice(bIdx, 1);
    }
    const log = state.allLogs.find(l => l.trans_id === tid);
    if (log) {
      log.actual_return = now;
      log.trans_status = "Returned";
      if (!bRecord) bRecord = log;
    }
    if (bRecord) {
      const itemObj = state.items.find(i => i.item_id === bRecord.item_id);
      returnedDetails.push({
        trans_id: tid,
        item_label: itemObj ? `[${bRecord.item_id}] ${itemObj.item_name}` : `[${bRecord.item_id}]`,
        borrower_name: bRecord.borrower_name,
        borrower_dept: bRecord.borrower_dept,
        borrower_contact: bRecord.borrower_contact
      });
    }
  });
  syncItemStatuses();
  clearReturnSelections();
  showNotification(`รับคืนอุปกรณ์เรียบร้อยแล้ว`, "success");
  renderAll();

  if (notifyEmail && returnedDetails.length > 0) {
    const first = returnedDetails[0];
    sendSystemEmailNotification("BORROW_RETURNED", {
      transIds: transIds,
      itemNames: returnedDetails.map(d => d.item_label),
      borrowerName: first.borrower_name,
      dept: first.borrower_dept,
      contact: first.borrower_contact,
      actualReturn: now
    });
  }

  callAPI("returnItem", { transIds, notifyEmail }, true);
}

function runAiEquipmentRecommendation() {
  const p = document.getElementById("aiWorkPrompt").value.trim();
  if (!p) return showNotification("กรุณาระบุลักษณะงาน", "warning");
  const btn = document.getElementById("aiRecommendBtn");
  const spin = document.getElementById("aiRecommendSpinner");
  const res = document.getElementById("aiRecommendResult");
  btn.disabled = true; spin.classList.remove("hidden");
  setTimeout(() => {
    const item = state.items.find(i => isItemAvailable(i)) || state.items[0];
    res.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-900">[${item.item_id}] ${item.item_name}</span>
        <button onclick="addSelectedItem('${item.item_id}'); switchTab('borrowTab');" class="px-2.5 py-1 bg-tcc-600 text-white rounded text-xs font-bold">เลือกยืมทันที</button>
      </div>
      <p class="text-slate-600 text-xs mt-1">แนะนำอุปกรณ์นี้เนื่องจากมีสเปกพร้อมใช้งานและตรงกับงาน "${p}"</p>
    `;
    res.classList.remove("hidden");
    btn.disabled = false; spin.classList.add("hidden");
  }, 500);
}

function runAiDraftReminder() {
  const tid = document.getElementById("aiBorrowSelect").value;
  if (!tid) return showNotification("กรุณาเลือกรายการยืม", "warning");
  const b = state.activeBorrows.find(x => x.trans_id === tid);
  const res = document.getElementById("aiReminderResult");
  res.innerHTML = `
    <p class="font-bold text-slate-800">ร่างข้อความติดตามทางการ (TCC):</p>
    <p class="bg-white p-2.5 rounded-lg border border-slate-200 mt-1">เรียน คุณ${b.borrower_name} (${b.borrower_dept}) ฝ่ายไอทีขออนุญาตติดตามอุปกรณ์ [${b.item_id}] ซึ่งครบกำหนดส่งคืนวันที่ ${b.expected_return} รบกวนนำส่งคืน ณ ฝ่ายเทคโนโลยีสารสนเทศ ขอบคุณครับ</p>
  `;
  res.classList.remove("hidden");
}

function setDefaultReturnDate() {
  const today = getOffsetDate(0);
  const s = document.getElementById("borrowStartDate");
  if (s) {
    s.value = today;
  }
  const d = document.getElementById("expectedReturnDate");
  if (d) {
    d.min = s?.value || today;
    d.value = getOffsetDate(3);
  }
  updateThaiDateDisplay("borrowStartDate");
  updateThaiDateDisplay("expectedReturnDate");
}

function handleBorrowStartDateChange() {
  const today = getOffsetDate(0);
  const s = document.getElementById("borrowStartDate");
  const d = document.getElementById("expectedReturnDate");
  const startVal = (s && s.value) ? s.value : today;
  if (s && !s.value) s.value = today;
  if (d) {
    d.min = startVal;
    if (!d.value || d.value < startVal) {
      d.value = startVal;
    }
  }
  updateThaiDateDisplay("borrowStartDate");
  updateThaiDateDisplay("expectedReturnDate");
}

function filterActiveBorrows() {
  const q = (document.getElementById("searchReturnInput")?.value || "").toLowerCase().trim();
  const filtered = state.activeBorrows.filter(b => {
    const item = state.items.find(i => i.item_id === b.item_id);
    return !q || safeLower(b.trans_id).includes(q) || safeLower(b.borrower_name).includes(q) || safeLower(b.borrower_dept).includes(q) || safeLower(b.item_id).includes(q) || safeLower(item?.item_name).includes(q);
  });
  renderReturnTable(filtered);
}

function handleResetBorrowForm() {
  clearSelectedBorrowItems();
  clearRichEditor("borrowPurposeEditor");
  setTimeout(() => {
    setDefaultReturnDate();
    const borrowNotifyChk = document.getElementById("borrowNotifyEmailCheckbox");
    if (borrowNotifyChk) borrowNotifyChk.checked = state.emailNotifyEnabled !== false;
    autoFillUserFormsFromDatabase(true);
  }, 10);
}
