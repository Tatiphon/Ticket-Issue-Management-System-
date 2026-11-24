function isItemBorrowed(item) {
  if (!item) return false;
  const itemId = String(item.item_id || item).trim().toLowerCase();
  const hasActive = state.activeBorrows.some(b => String(b.item_id || "").trim().toLowerCase() === itemId);
  if (hasActive) return true;
  const s = String(item.status || "").trim().toLowerCase();
  return s === "borrowed" || s === "กำลังถูกยืม" || s === "กำลังยืม";
}

function isItemAvailable(item) {
  if (!item || isItemBorrowed(item)) return false;
  const s = String(item.status || "").trim().toLowerCase();
  return s !== "maintenance" && s !== "ซ่อมบำรุง" && s !== "ส่งซ่อม";
}

function syncItemStatuses() {
  state.items.forEach(item => {
    if (isItemBorrowed(item)) item.status = "Borrowed";
    else if (item.status !== "Maintenance") item.status = "Available";
  });
}

/* EQUIPMENT PREVIEW IMAGES & GOOGLE DRIVE STORAGE (Requirement 3) */
function generateEquipmentFallbackSvg(item) {
  const cat = String(item?.category || "Equipment").trim();
  const id = String(item?.item_id || "IT").trim();
  const name = String(item?.item_name || "IT Asset").trim();
  const catLower = cat.toLowerCase();

  let bg1 = "#0f172a", bg2 = "#0284c7", accent = "#38bdf8", iconLabel = "💻";
  if (catLower.includes("laptop") || catLower.includes("notebook")) {
    bg1 = "#0c4a6e"; bg2 = "#0284c7"; accent = "#7dd3fc"; iconLabel = "💻 LAPTOP";
  } else if (catLower.includes("projector")) {
    bg1 = "#312e81"; bg2 = "#4f46e5"; accent = "#a5b4fc"; iconLabel = "📽️ PROJECTOR";
  } else if (catLower.includes("monitor") || catLower.includes("display")) {
    bg1 = "#1e293b"; bg2 = "#334155"; accent = "#94a3b8"; iconLabel = "🖥️ MONITOR";
  } else if (catLower.includes("audio") || catLower.includes("mic")) {
    bg1 = "#064e3b"; bg2 = "#059669"; accent = "#6ee7b7"; iconLabel = "🎙️ AUDIO";
  } else if (catLower.includes("adapter") || catLower.includes("hub") || catLower.includes("accessory")) {
    bg1 = "#78350f"; bg2 = "#d97706"; accent = "#fcd34d"; iconLabel = "🔌 ADAPTER";
  } else if (catLower.includes("tablet") || catLower.includes("ipad")) {
    bg1 = "#4c1d95"; bg2 = "#7c3aed"; accent = "#c4b5fd"; iconLabel = "📱 TABLET";
  }

  const safeTitle = name.replace(/[&<>'"]/g, "").substring(0, 32);
  const safeId = id.replace(/[&<>'"]/g, "");
  const safeCat = cat.replace(/[&<>'"]/g, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="480" height="320" rx="24" fill="url(#g)"/>
    <circle cx="410" cy="60" r="85" fill="${accent}" opacity="0.12"/>
    <circle cx="65" cy="265" r="70" fill="${accent}" opacity="0.1"/>
    <rect x="28" y="26" width="135" height="30" rx="8" fill="#ffffff" opacity="0.16"/>
    <text x="40" y="46" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="bold">${safeId} • ${safeCat}</text>
    <rect x="140" y="76" width="200" height="122" rx="14" fill="#ffffff" opacity="0.14" stroke="${accent}" stroke-width="2"/>
    <text x="240" y="145" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold">${iconLabel}</text>
    <text x="240" y="236" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="17" font-weight="bold">${safeTitle}</text>
    <text x="240" y="264" text-anchor="middle" fill="${accent}" font-family="sans-serif" font-size="12">☁️ TCC IT Asset Preview (Google Drive)</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function resolveItemImageInfo(item) {
  if (!item) return { displaySrc: generateEquipmentFallbackSvg({}), fallbackSvg: generateEquipmentFallbackSvg({}), isCustom: false, driveViewUrl: "", driveFileId: "", name: "" };
  const refId = String(item.item_id || "").trim();
  const cached = getAttachmentFromCache(refId);

  const name = item.image_name || item.attachment_name || cached?.name || `${refId}_preview.png`;
  const base64 = item.image_base64 || item.attachment_base64 || cached?.base64 || "";
  const rawUrl = item.image_url || item.attachment_url || cached?.driveUrl || "";
  const extractedFromUrl = extractGoogleDriveFileId(rawUrl);
  const driveFileId = item.drive_file_id || cached?.driveFileId || extractedFromUrl || "";
  const isSimulatedDriveId = String(driveFileId || "").startsWith("DRV_");

  let driveViewUrl = rawUrl;
  let driveDirectUrl = "";
  if (driveFileId && !isSimulatedDriveId) {
    driveViewUrl = (rawUrl && rawUrl.startsWith("http")) ? rawUrl : `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;
    driveDirectUrl = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1000`;
  } else if (driveFileId && isSimulatedDriveId && !driveViewUrl) {
    driveViewUrl = `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;
  }

  const fallbackSvg = generateEquipmentFallbackSvg(item);
  const nonDriveDirectUrl = (rawUrl && !rawUrl.includes("DRV_") && !extractedFromUrl) ? rawUrl : "";
  const displaySrc = base64 || driveDirectUrl || nonDriveDirectUrl || fallbackSvg;
  const isCustom = Boolean(base64 || (driveFileId && !isSimulatedDriveId) || nonDriveDirectUrl || (driveFileId && isSimulatedDriveId && base64));

  return {
    refId,
    name,
    isImage: true,
    base64: base64 || displaySrc,
    driveFileId,
    driveViewUrl,
    driveDirectUrl,
    displaySrc,
    fallbackSvg,
    isCustom
  };
}

function openItemImagePreview(itemId) {
  const item = state.items.find(i => i.item_id === itemId);
  if (!item) return;
  const info = resolveItemImageInfo(item);
  openAttachmentPreviewModal({
    refId: item.item_id,
    name: `${item.item_name} (${item.item_id})`,
    isImage: true,
    displaySrc: info.displaySrc,
    base64: info.base64,
    fallbackSvg: info.fallbackSvg,
    driveFileId: info.driveFileId,
    driveViewUrl: info.driveViewUrl || (info.driveFileId ? `https://drive.google.com/file/d/${info.driveFileId}/view?usp=sharing` : ""),
    driveDirectUrl: info.driveDirectUrl
  });
}

function handleItemImageSelect(input, mode) {
  const file = input?.files?.[0] || input?.target?.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showNotification("ไฟล์รูปภาพอุปกรณ์ต้องมีขนาดไม่เกิน 10MB", "warning");
    if (input && "value" in input) input.value = "";
    return;
  }
  readAndPrepareAttachmentFile(file, (dataUrl, fileName, mimeType, origSize) => {
    if (mode === "add") {
      state.draftItemImageAdd = { name: fileName, base64: dataUrl, mime: mimeType, size: origSize };
      const urlInp = document.getElementById("newItemDriveUrl");
      if (urlInp) urlInp.value = "";
      const box = document.getElementById("newItemImagePreviewBox");
      const img = document.getElementById("newItemImageThumb");
      const nameEl = document.getElementById("newItemImageNameLabel");
      const btnClear = document.getElementById("btnClearNewItemImage");
      if (img) {
        img.onerror = null;
        img.dataset.errStep = "0";
        img.src = dataUrl;
      }
      if (nameEl) nameEl.innerText = `${fileName} (${(origSize / 1024).toFixed(1)} KB) • พร้อมอัปโหลดขึ้น Drive`;
      if (box) box.classList.remove("hidden");
      if (btnClear) btnClear.classList.remove("hidden");
    } else {
      state.draftItemImageEdit = { name: fileName, base64: dataUrl, mime: mimeType, size: origSize, cleared: false };
      const urlInp = document.getElementById("editItemDriveUrl");
      if (urlInp) urlInp.value = "";
      const box = document.getElementById("editItemImagePreviewBox");
      const img = document.getElementById("editItemImageThumb");
      const nameEl = document.getElementById("editItemImageNameLabel");
      const btnClear = document.getElementById("btnClearEditItemImage");
      if (img) {
        img.onerror = null;
        img.dataset.errStep = "0";
        img.src = dataUrl;
      }
      if (nameEl) nameEl.innerText = `${fileName} (${(origSize / 1024).toFixed(1)} KB) • พร้อมอัปโหลดขึ้น Drive`;
      if (box) box.classList.remove("hidden");
      if (btnClear) btnClear.classList.remove("hidden");
    }
  }, 10);
}

function handleItemDriveUrlInput(val, mode) {
  const cleanUrl = String(val || "").trim();
  const isAdd = mode === "add";
  const box = document.getElementById(isAdd ? "newItemImagePreviewBox" : "editItemImagePreviewBox");
  const img = document.getElementById(isAdd ? "newItemImageThumb" : "editItemImageThumb");
  const nameEl = document.getElementById(isAdd ? "newItemImageNameLabel" : "editItemImageNameLabel");
  const btnClear = document.getElementById(isAdd ? "btnClearNewItemImage" : "btnClearEditItemImage");
  const fileInput = document.getElementById(isAdd ? "newItemImageInput" : "editItemImageInput");

  if (!cleanUrl) {
    const draft = isAdd ? state.draftItemImageAdd : state.draftItemImageEdit;
    if (!draft?.base64) {
      if (isAdd) {
        if (img) img.src = "";
        if (nameEl) nameEl.innerText = "";
        if (box) box.classList.add("hidden");
        if (btnClear) btnClear.classList.add("hidden");
      } else {
        const itemId = document.getElementById("editItemId")?.value.trim() || "IT";
        const itemName = document.getElementById("editItemName")?.value.trim() || "IT Asset";
        const cat = document.getElementById("editItemCategory")?.value || "Equipment";
        const fallbackSvg = generateEquipmentFallbackSvg({ item_id: itemId, item_name: itemName, category: cat });
        if (img) {
          img.onerror = null;
          img.src = fallbackSvg;
        }
        if (nameEl) nameEl.innerText = "ภาพจำลองมาตรฐานตามหมวดหมู่ (อัปโหลดรูปจริงหรือใส่ลิงก์ Drive ได้)";
        if (box) box.classList.remove("hidden");
        if (btnClear) btnClear.classList.add("hidden");
      }
    }
    return;
  }

  if (fileInput) fileInput.value = "";
  if (isAdd) {
    state.draftItemImageAdd = { name: "", base64: "", mime: "" };
  } else {
    state.draftItemImageEdit = { name: "", base64: "", mime: "", cleared: false };
  }

  const driveId = extractGoogleDriveFileId(cleanUrl);
  const isSim = String(driveId || "").startsWith("DRV_");
  const itemId = document.getElementById(isAdd ? "newItemId" : "editItemId")?.value.trim() || "IT";
  const itemName = document.getElementById(isAdd ? "newItemName" : "editItemName")?.value.trim() || "Equipment";
  const cat = document.getElementById(isAdd ? "newItemCategory" : "editItemCategory")?.value || "Equipment";
  const fallbackSvg = generateEquipmentFallbackSvg({ item_id: itemId, item_name: itemName, category: cat });
  const previewSrc = (driveId && !isSim)
    ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`
    : cleanUrl;

  if (img) {
    img.dataset.errStep = "0";
    img.onerror = function() { handleEquipmentImageError(this, driveId, fallbackSvg); };
    img.src = previewSrc;
  }
  if (nameEl) {
    nameEl.innerText = (driveId && !isSim)
      ? `☁️ ลิงก์ Google Drive (${driveId})`
      : "🔗 ลิงก์รูปภาพภายนอก / Google Drive";
  }
  if (box) box.classList.remove("hidden");
  if (btnClear) btnClear.classList.remove("hidden");
}

function clearItemImageAttachment(mode) {
  if (mode === "add") {
    state.draftItemImageAdd = { name: "", base64: "", mime: "" };
    const inp = document.getElementById("newItemImageInput");
    if (inp) inp.value = "";
    const urlInp = document.getElementById("newItemDriveUrl");
    if (urlInp) urlInp.value = "";
    const img = document.getElementById("newItemImageThumb");
    if (img) { img.onerror = null; img.src = ""; }
    const nameEl = document.getElementById("newItemImageNameLabel");
    if (nameEl) nameEl.innerText = "";
    const box = document.getElementById("newItemImagePreviewBox");
    const btnClear = document.getElementById("btnClearNewItemImage");
    if (box) box.classList.add("hidden");
    if (btnClear) btnClear.classList.add("hidden");
  } else {
    state.draftItemImageEdit = { name: "", base64: "", mime: "", cleared: true };
    const inp = document.getElementById("editItemImageInput");
    if (inp) inp.value = "";
    const urlInp = document.getElementById("editItemDriveUrl");
    if (urlInp) urlInp.value = "";
    const img = document.getElementById("editItemImageThumb");
    if (img) { img.onerror = null; img.src = ""; }
    const nameEl = document.getElementById("editItemImageNameLabel");
    if (nameEl) nameEl.innerText = "";
    const box = document.getElementById("editItemImagePreviewBox");
    const btnClear = document.getElementById("btnClearEditItemImage");
    if (box) box.classList.add("hidden");
    if (btnClear) btnClear.classList.add("hidden");
  }
}

function previewDraftItemImage(mode) {
  if (mode === "add") {
    const draft = state.draftItemImageAdd;
    const urlVal = document.getElementById("newItemDriveUrl")?.value.trim() || "";
    const itemName = document.getElementById("newItemName")?.value.trim() || "อุปกรณ์ใหม่";
    const itemId = document.getElementById("newItemId")?.value.trim() || "IT-NEW";
    const tempItem = {
      item_id: itemId,
      item_name: itemName,
      category: document.getElementById("newItemCategory")?.value || "Laptop",
      image_name: draft?.name || "",
      image_base64: draft?.base64 || "",
      image_url: urlVal
    };
    const info = resolveItemImageInfo(tempItem);
    openAttachmentPreviewModal({
      refId: itemId,
      name: `${itemName} (${itemId})`,
      isImage: true,
      displaySrc: info.displaySrc,
      base64: info.base64,
      fallbackSvg: info.fallbackSvg,
      driveFileId: info.driveFileId,
      driveViewUrl: info.driveViewUrl,
      driveDirectUrl: info.driveDirectUrl
    });
  } else {
    const itemId = document.getElementById("editItemId")?.value.trim();
    const existing = state.items.find(i => i.item_id === itemId) || {};
    const draft = state.draftItemImageEdit;
    const urlVal = document.getElementById("editItemDriveUrl")?.value.trim() || "";
    const tempItem = {
      ...existing,
      item_name: document.getElementById("editItemName")?.value.trim() || existing.item_name,
      category: document.getElementById("editItemCategory")?.value.trim() || existing.category,
      image_name: draft?.name || (draft?.cleared ? "" : existing.image_name) || "",
      image_base64: draft?.base64 || (draft?.cleared ? "" : existing.image_base64) || "",
      image_url: urlVal || (draft?.cleared ? "" : existing.image_url) || ""
    };
    const info = resolveItemImageInfo(tempItem);
    openAttachmentPreviewModal({
      refId: tempItem.item_id || "IT",
      name: `${tempItem.item_name} (${tempItem.item_id})`,
      isImage: true,
      displaySrc: info.displaySrc,
      base64: info.base64,
      fallbackSvg: info.fallbackSvg,
      driveFileId: info.driveFileId,
      driveViewUrl: info.driveViewUrl,
      driveDirectUrl: info.driveDirectUrl
    });
  }
}

function renderInventoryTable(filteredList = null) {
  const list = filteredList || state.items;
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;
  if (state.isInitialLoading) {
    tbody.innerHTML = getDatabaseLoadingRowHtml(6, "กำลังโหลดคลังอุปกรณ์จากฐานข้อมูล...");
    return;
  }
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-400 text-xs">ไม่พบรายการอุปกรณ์ในคลัง</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => {
    const imgInfo = resolveItemImageInfo(item);
    return `
    <tr class="hover:bg-slate-50 transition">
      <td class="py-3 px-4 font-mono font-bold text-tcc-700">${item.item_id}</td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <div onclick="openItemImagePreview('${escapeQuotes(item.item_id)}')" title="คลิกเพื่อดูรูปตัวอย่างอุปกรณ์ (Google Drive)" class="w-12 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer relative group">
            <img src="${imgInfo.displaySrc}" alt="${escapeQuotes(item.item_name)}" data-err-step="0" class="w-full h-full object-cover" onerror="handleEquipmentImageError(this, '${escapeQuotes(imgInfo.driveFileId)}', '${imgInfo.fallbackSvg}');" />
            <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white">🔍</div>
          </div>
          <div>
            <div class="font-bold text-slate-900">${item.item_name}</div>
            <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <button type="button" onclick="openItemImagePreview('${escapeQuotes(item.item_id)}')" class="text-tcc-600 hover:underline font-semibold">🖼️ ดูรูปตัวอย่าง</button>
              ${imgInfo.driveFileId ? `<span class="text-emerald-600 font-bold">• ☁️ Google Drive</span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td class="py-3 px-4 text-xs"><span class="bg-slate-100 px-2 py-0.5 rounded">${item.category}</span></td>
      <td class="py-3 px-4 font-mono text-xs text-slate-500">${item.serial_number || '-'}</td>
      <td class="py-3 px-4 text-center">
        ${isItemBorrowed(item) ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">กำลังยืม</span>' : (item.status === 'Maintenance' ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">ซ่อมบำรุง</span>' : '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">พร้อมใช้งาน</span>')}
      </td>
      <td class="py-3 px-4 text-center">
        <button onclick="openEditItemModal('${escapeQuotes(item.item_id)}')" class="px-2.5 py-1 text-xs text-tcc-700 hover:bg-tcc-50 rounded-lg border border-slate-200">✏️ แก้ไข / รูปภาพ</button>
      </td>
    </tr>
  `;
  }).join("");
}

let historySortField = null;
let historySortDir = 'asc';

function getHistorySortValue(l, field) {
  const item = state.items.find(i => i.item_id === l.item_id) || { item_name: l.item_id || "" };
  switch (field) {
    case 'trans_id':
    case 'manage':
      return String(l.trans_id || "");
    case 'item':
      return `${item.item_name || ""} ${l.item_id || ""}`.trim();
    case 'borrower':
      return `${l.borrower_name || ""} ${l.borrower_dept || ""}`.trim();
    case 'borrow_date':
      return String(l.borrow_date || "");
    case 'expected_return':
      return String(l.expected_return || "");
    case 'actual_return':
      return l.trans_status === "Returned" ? String(l.actual_return || "") : "";
    case 'trans_status':
      return l.trans_status === "Returned" ? "คืนแล้ว" : "กำลังยืม";
    case 'notes':
      return String(l.notes || "");
    default:
      return String(l.trans_id || "");
  }
}

function updateHistorySortIndicators() {
  const cols = ['trans_id', 'item', 'borrower', 'borrow_date', 'expected_return', 'actual_return', 'trans_status', 'notes', 'manage'];
  cols.forEach(col => {
    const el = document.getElementById(`histSortIcon-${col}`);
    if (!el) return;
    if (historySortField === col) {
      el.innerText = historySortDir === 'asc' ? '↑' : '↓';
      el.className = 'text-[10px] text-tcc-600 font-extrabold';
    } else {
      el.innerText = '↕';
      el.className = 'text-[10px] text-slate-400';
    }
  });
}

function sortHistoryBy(field) {
  if (historySortField === field) {
    historySortDir = historySortDir === 'asc' ? 'desc' : 'asc';
  } else {
    historySortField = field;
    historySortDir = 'asc';
  }
  filterHistory();
}

function renderHistoryTable(filteredList = null) {
  const rawList = filteredList !== null ? filteredList : state.allLogs;
  const list = [...rawList];
  if (historySortField) {
    const dir = historySortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const valA = getHistorySortValue(a, historySortField);
      const valB = getHistorySortValue(b, historySortField);
      if (!valA && valB) return 1;
      if (valA && !valB) return -1;
      return valA.localeCompare(valB, 'th', { numeric: true, sensitivity: 'base' }) * dir;
    });
  }
  updateHistorySortIndicators();

  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;
  if (state.isInitialLoading) {
    tbody.innerHTML = getDatabaseLoadingRowHtml(9, "กำลังโหลดประวัติการยืม-คืนจากฐานข้อมูล...");
    return;
  }
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-400 text-xs">ไม่พบบันทึกประวัติการยืม-คืน</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(l => {
    const item = state.items.find(i => i.item_id === l.item_id) || { item_name: l.item_id };
    const isRet = l.trans_status === "Returned";
    const actualReturnFull = isRet ? (l.actual_return || '-') : '-';
    const actualReturnShort = isRet && l.actual_return ? String(l.actual_return).split(' ')[0] : '-';
    return `
      <tr class="hover:bg-slate-50/80 transition border-b border-slate-100 whitespace-nowrap text-xs">
        <td class="py-2.5 px-2 font-mono text-[11px] font-bold text-tcc-700 whitespace-nowrap" title="${escapeQuotes(l.trans_id)}">${l.trans_id}</td>
        <td class="py-2.5 px-2 whitespace-nowrap max-w-[135px] xl:max-w-[230px] 2xl:max-w-[320px] truncate" title="[${escapeQuotes(l.item_id)}] ${escapeQuotes(item.item_name)}">
          <div class="truncate">
            <span class="font-semibold text-slate-800">${item.item_name}</span>
            <span class="font-mono text-[10px] text-slate-400 ml-0.5">(${l.item_id})</span>
          </div>
        </td>
        <td class="py-2.5 px-2 whitespace-nowrap max-w-[135px] xl:max-w-[230px] 2xl:max-w-[320px] truncate" title="${escapeQuotes(l.borrower_name)} (${escapeQuotes(l.borrower_dept || '-')})">
          <div class="truncate">
            <span class="font-medium text-slate-800">${l.borrower_name}</span>
            ${l.borrower_dept ? `<span class="text-[10px] text-slate-400 ml-0.5">(${l.borrower_dept})</span>` : ''}
          </div>
        </td>
        <td class="py-2.5 px-1.5 text-[11px] font-mono text-slate-600 whitespace-nowrap">${l.borrow_date || '-'}</td>
        <td class="py-2.5 px-1.5 text-[11px] font-mono text-slate-600 whitespace-nowrap">${l.expected_return || '-'}</td>
        <td class="py-2.5 px-1.5 text-[11px] font-mono text-emerald-700 whitespace-nowrap" title="${escapeQuotes(actualReturnFull)}">${actualReturnShort}</td>
        <td class="py-2.5 px-1.5 text-center whitespace-nowrap">
          ${isRet 
            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>คืนแล้ว</span>' 
            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>กำลังยืม</span>'}
        </td>
        <td class="py-2.5 px-2 text-[11px] max-w-[90px] xl:max-w-[180px] 2xl:max-w-[260px] truncate text-slate-600 whitespace-nowrap" title="${escapeQuotes(l.notes || '-')}">${l.notes || '-'}</td>
        <td class="py-2.5 px-1.5 text-center whitespace-nowrap">
          <button type="button" onclick="openEditHistoryModal('${escapeQuotes(l.trans_id)}')" class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-tcc-700 bg-tcc-50 hover:bg-tcc-100 rounded-lg transition border border-tcc-200/70 shadow-2xs whitespace-nowrap cursor-pointer">
            <span>✏️</span><span>แก้ไข</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

/* USER & ROLE MANAGEMENT LOGIC (Req 1, 2, 3, 4, 5, 6, 7) */
function openEditHistoryModal(tid) {
  const log = state.allLogs.find(l => l.trans_id === tid);
  if (!log) return;
  document.getElementById("editHistoryTransId").value = log.trans_id;
  document.getElementById("editHistoryTransLabel").innerText = `รหัสธุรกรรม: ${log.trans_id}`;
  document.getElementById("editHistoryItemInfo").innerText = `[${log.item_id}]`;
  document.getElementById("editHistoryBorrowerName").value = log.borrower_name;

  renderDepartmentSelects();
  const deptEl = document.getElementById("editHistoryDept");
  if (deptEl) {
    if (log.borrower_dept && !Array.from(deptEl.options).some(o => o.value === log.borrower_dept)) {
      const opt = document.createElement("option");
      opt.value = log.borrower_dept;
      opt.textContent = log.borrower_dept;
      deptEl.appendChild(opt);
    }
    deptEl.value = log.borrower_dept;
  }

  document.getElementById("editHistoryContact").value = log.borrower_contact;
  document.getElementById("editHistoryBorrowDate").value = log.borrow_date;
  document.getElementById("editHistoryExpectedReturn").value = log.expected_return;
  document.getElementById("editHistoryActualReturn").value = log.actual_return || "";
  document.getElementById("editHistoryStatus").value = log.trans_status;
  document.getElementById("editHistoryNotes").value = log.notes || "";
  setRichEditorContent("editHistoryNotesEditor", log.notes || "", false);
  const notifyChk = document.getElementById("editHistoryNotifyEmail");
  if (notifyChk) notifyChk.checked = state.emailNotifyEnabled !== false;
  document.getElementById("editHistoryModal").classList.remove("hidden");
}
function closeEditHistoryModal() { document.getElementById("editHistoryModal").classList.add("hidden"); }

function handleSaveHistoryEdit(e) {
  e.preventDefault();
  const tid = document.getElementById("editHistoryTransId").value;
  const log = state.allLogs.find(l => l.trans_id === tid);
  if (!log) return;

  log.borrower_name = document.getElementById("editHistoryBorrowerName").value.trim();
  log.borrower_dept = document.getElementById("editHistoryDept").value.trim();
  log.borrower_contact = document.getElementById("editHistoryContact").value.trim();
  log.borrow_date = document.getElementById("editHistoryBorrowDate").value;
  log.expected_return = document.getElementById("editHistoryExpectedReturn").value;
  log.actual_return = document.getElementById("editHistoryActualReturn").value.trim();
  log.trans_status = document.getElementById("editHistoryStatus").value;
  const editNotesData = getRichEditorData("editHistoryNotesEditor");
  log.notes = editNotesData.text || (document.getElementById("editHistoryNotes")?.value || "").trim();
  const notifyEmail = document.getElementById("editHistoryNotifyEmail")?.checked !== false;

  if (log.trans_status === "Returned") {
    if (!log.actual_return) log.actual_return = getLocalTimestamp(0);
    const bIdx = state.activeBorrows.findIndex(b => b.trans_id === tid);
    if (bIdx !== -1) state.activeBorrows.splice(bIdx, 1);
    const item = state.items.find(i => i.item_id === log.item_id);
    if (item && item.status !== "Maintenance") item.status = "Available";
  } else if (log.trans_status === "Borrowed") {
    const exists = state.activeBorrows.some(b => b.trans_id === tid);
    if (!exists) {
      state.activeBorrows.push({
        trans_id: log.trans_id,
        item_id: log.item_id,
        borrower_name: log.borrower_name,
        borrower_dept: log.borrower_dept,
        borrower_contact: log.borrower_contact,
        borrow_date: log.borrow_date,
        expected_return: log.expected_return
      });
    }
  }
  syncItemStatuses();

  closeEditHistoryModal();
  showNotification(`แก้ไขข้อมูล [${tid}] เรียบร้อย`, "success");
  renderAll();

  if (notifyEmail) {
    const itemObj = state.items.find(i => i.item_id === log.item_id);
    sendSystemEmailNotification("BORROW_UPDATED", {
      trans_id: log.trans_id,
      item_id: log.item_id,
      item_name: itemObj ? `[${log.item_id}] ${itemObj.item_name}` : `[${log.item_id}]`,
      borrower_name: log.borrower_name,
      borrower_dept: log.borrower_dept,
      borrower_contact: log.borrower_contact,
      borrow_date: log.borrow_date,
      expected_return: log.expected_return,
      actual_return: log.actual_return,
      trans_status: log.trans_status,
      notes: log.notes
    });
  }

  callAPI("updateHistoryLog", { transId: log.trans_id, updates: log, logData: log, notifyEmail }, true);
}

function openAddItemModal() {
  const nextNum = state.items.length + 1;
  document.getElementById("newItemId").value = "IT-" + String(nextNum).padStart(3, "0");
  const nameInp = document.getElementById("newItemName");
  if (nameInp) nameInp.value = "";
  const serialInp = document.getElementById("newItemSerial");
  if (serialInp) serialInp.value = "";
  const driveUrlInp = document.getElementById("newItemDriveUrl");
  if (driveUrlInp) driveUrlInp.value = "";
  clearItemImageAttachment("add");

  const sel = document.getElementById("newItemCategory");
  if (sel) {
    sel.innerHTML = '<option value="">-- เลือกหมวดหมู่ --</option>' + state.categories.map(c => `<option value="${c}">${c}</option>`).join("") + '<option value="__custom__">+ เพิ่มหมวดหมู่ใหม่...</option>';
  }
  document.getElementById("addItemModal").classList.remove("hidden");
}
function closeAddItemModal() { document.getElementById("addItemModal").classList.add("hidden"); }

function handleCategorySelectionChange(val) {
  const cust = document.getElementById("newItemCustomCategory");
  if (cust) {
    if (val === "__custom__") cust.classList.remove("hidden"), cust.focus();
    else cust.classList.add("hidden"), (cust.value = "");
  }
}

async function handleAddNewItem(e) {
  e.preventDefault();
  const catSel = document.getElementById("newItemCategory").value;
  const catCust = document.getElementById("newItemCustomCategory")?.value.trim();
  const finalCat = (catSel === "__custom__" ? catCust : catSel) || "Other";
  const itemId = document.getElementById("newItemId").value.trim();
  const itemName = document.getElementById("newItemName").value.trim();
  const serialNum = document.getElementById("newItemSerial").value.trim() || "-";
  const manualDriveUrl = document.getElementById("newItemDriveUrl")?.value.trim() || "";

  if (state.items.some(i => safeLower(i.item_id) === safeLower(itemId))) {
    return showNotification(`รหัสอุปกรณ์ "${itemId}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`, "warning");
  }

  const draftImg = state.draftItemImageAdd || {};
  let imageName = draftImg.name || "";
  let imageBase64 = draftImg.base64 || "";
  let driveFileId = extractGoogleDriveFileId(manualDriveUrl) || "";
  let imageUrl = manualDriveUrl;

  const newItem = {
    item_id: itemId,
    item_name: itemName,
    category: finalCat,
    serial_number: serialNum,
    status: "Available",
    image_name: imageName,
    image_base64: imageBase64,
    image_url: imageUrl,
    drive_file_id: driveFileId
  };

  if (imageBase64 || imageUrl || driveFileId) {
    saveAttachmentToCache(itemId, imageName || `${itemId}.png`, imageBase64, imageUrl, driveFileId);
  }

  if (!state.categories.includes(finalCat)) state.categories.push(finalCat);
  state.items.push(newItem);
  closeAddItemModal();
  clearItemImageAttachment("add");
  renderAll();

  if (imageBase64) {
    showNotification(`กำลังอัปโหลดรูปตัวอย่างอุปกรณ์ [${itemId}] ขึ้น Google Drive...`, "info");
    const driveRes = await uploadFileToGoogleDrive(imageBase64, `${itemId}_${imageName || "preview.png"}`, "Equipment", itemId);
    if (driveRes && (driveRes.fileId || driveRes.viewUrl)) {
      newItem.drive_file_id = driveRes.fileId || driveFileId;
      newItem.image_url = driveRes.viewUrl || imageUrl;
      saveAttachmentToCache(itemId, imageName || `${itemId}.png`, imageBase64, newItem.image_url, newItem.drive_file_id);
      renderAll();
    }
  }

  const isSimulatedId = String(newItem.drive_file_id || "").startsWith("DRV_");
  const addRes = await callAPI("addItem", {
    itemId: newItem.item_id,
    itemName: newItem.item_name,
    category: newItem.category,
    serialNumber: newItem.serial_number,
    imageName: newItem.image_name,
    imageUrl: isSimulatedId ? manualDriveUrl : newItem.image_url,
    driveFileId: isSimulatedId ? (extractGoogleDriveFileId(manualDriveUrl) || "") : newItem.drive_file_id,
    imageBase64: (!isSimulatedId && newItem.drive_file_id) ? "" : imageBase64,
    folderId: state.driveFolderId || ""
  }, true);

  if (addRes && (addRes.drive_file_id || addRes.image_url)) {
    newItem.drive_file_id = addRes.drive_file_id || newItem.drive_file_id;
    newItem.image_url = addRes.image_url || newItem.image_url;
    saveAttachmentToCache(itemId, imageName || `${itemId}.png`, imageBase64, newItem.image_url, newItem.drive_file_id);
    renderAll();
  }

  showNotification(
    newItem.drive_file_id || newItem.image_url
      ? `เพิ่มอุปกรณ์ [${newItem.item_id}] พร้อมบันทึกรูปลง Google Drive สำเร็จ`
      : `เพิ่มอุปกรณ์ [${newItem.item_id}] สำเร็จ`,
    "success"
  );
}

function exportHistoryCsv() {
  if (state.allLogs.length === 0) return showNotification("ไม่มีข้อมูลประวัติสำหรับส่งออก", "warning");
  const headers = ["รหัสธุรกรรม", "วัน-เวลา", "รหัสอุปกรณ์", "ผู้ยืม", "แผนก", "เบอร์ติดต่อ", "วันที่ยืม", "กำหนดคืน", "วันที่คืนจริง", "สถานะ", "หมายเหตุ"];
  const rows = state.allLogs.map(l => [l.trans_id, l.timestamp, l.item_id, l.borrower_name, l.borrower_dept, l.borrower_contact, l.borrow_date, l.expected_return, l.actual_return, l.trans_status, l.notes].map(v => `"${v || ''}"`).join(","));
  const blob = new Blob(["\uFEFF" + [headers.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tcc_it_history_${getOffsetDate(0)}.csv`;
  a.click();
}

function filterInventory() {
  const s = document.getElementById("filterStatus")?.value;
  const c = document.getElementById("filterCategory")?.value;
  const q = (document.getElementById("searchInventoryInput")?.value || "").toLowerCase().trim();
  const filtered = state.items.filter(i => {
    const matchS = !s || (s === "Available" && isItemAvailable(i)) || (s === "Borrowed" && isItemBorrowed(i)) || (s === "Maintenance" && i.status === "Maintenance");
    const matchC = !c || i.category === c;
    const matchQ = !q || safeLower(i.item_name).includes(q) || safeLower(i.item_id).includes(q) || safeLower(i.serial_number).includes(q);
    return matchS && matchC && matchQ;
  });
  renderInventoryTable(filtered);
}

function filterHistory() {
  const s = document.getElementById("filterHistoryStatus")?.value;
  const q = (document.getElementById("searchHistoryInput")?.value || "").toLowerCase().trim();
  const filtered = state.allLogs.filter(l => {
    const item = state.items.find(i => i.item_id === l.item_id);
    const matchS = !s || l.trans_status === s;
    const matchQ = !q || safeLower(l.trans_id).includes(q) || safeLower(l.borrower_name).includes(q) || safeLower(l.borrower_dept).includes(q) || safeLower(l.item_id).includes(q) || safeLower(item?.item_name).includes(q) || safeLower(l.notes).includes(q);
    return matchS && matchQ;
  });
  renderHistoryTable(filtered);
}

function openEditItemModal(itemId) {
  const item = state.items.find(i => i.item_id === itemId);
  if (!item) return;
  document.getElementById("editItemId").value = item.item_id;
  document.getElementById("editItemName").value = item.item_name;
  document.getElementById("editItemCategory").value = item.category;
  document.getElementById("editItemSerial").value = item.serial_number || "";
  const stat = document.getElementById("editItemStatus");
  if (stat) stat.value = item.status;

  state.draftItemImageEdit = { name: "", base64: "", mime: "", cleared: false };
  const imgInput = document.getElementById("editItemImageInput");
  if (imgInput) imgInput.value = "";
  const imgInfo = resolveItemImageInfo(item);
  const rawDisplayUrl = (item.image_url && !String(item.image_url).includes("/DRV_"))
    ? item.image_url
    : ((imgInfo.driveViewUrl && !String(imgInfo.driveViewUrl).includes("/DRV_")) ? imgInfo.driveViewUrl : "");
  const urlInput = document.getElementById("editItemDriveUrl");
  if (urlInput) urlInput.value = rawDisplayUrl;

  const box = document.getElementById("editItemImagePreviewBox");
  const thumb = document.getElementById("editItemImageThumb");
  const nameTxt = document.getElementById("editItemImageNameLabel");
  const btnClear = document.getElementById("btnClearEditItemImage");
  if (box && thumb) {
    thumb.dataset.errStep = "0";
    thumb.onerror = function() {
      handleEquipmentImageError(this, imgInfo.driveFileId, imgInfo.fallbackSvg);
    };
    thumb.src = imgInfo.displaySrc;
    if (nameTxt) nameTxt.innerText = imgInfo.isCustom ? (imgInfo.name || "รูปภาพอุปกรณ์บน Google Drive") : "ภาพจำลองมาตรฐานตามหมวดหมู่ (อัปโหลดรูปจริงเพื่อแทนที่ได้)";
    box.classList.remove("hidden");
    if (btnClear) {
      if (imgInfo.isCustom) btnClear.classList.remove("hidden");
      else btnClear.classList.add("hidden");
    }
  }

  document.getElementById("editItemModal")?.classList.remove("hidden");
}

function closeEditItemModal() {
  document.getElementById("editItemModal")?.classList.add("hidden");
}

async function handleSaveItemEdit(e) {
  e.preventDefault();
  const id = document.getElementById("editItemId").value;
  const item = state.items.find(i => i.item_id === id);
  if (!item) return;
  item.item_name = document.getElementById("editItemName").value.trim();
  item.category = document.getElementById("editItemCategory").value.trim();
  item.serial_number = document.getElementById("editItemSerial").value.trim();
  item.status = document.getElementById("editItemStatus").value;

  const manualUrl = document.getElementById("editItemDriveUrl")?.value.trim() || "";
  const draftImg = state.draftItemImageEdit || {};
  const prevUrl = String(item.image_url || "").trim();

  if (draftImg.cleared && !draftImg.base64 && !manualUrl) {
    item.image_name = "";
    item.image_base64 = "";
    item.image_url = "";
    item.drive_file_id = "";
    saveAttachmentToCache(id, "", "", "", "");
  } else if (draftImg.base64) {
    item.image_name = draftImg.name || `${id}_preview.png`;
    item.image_base64 = draftImg.base64;
    item.image_url = "";
    item.drive_file_id = "";
  } else if (manualUrl) {
    item.image_url = manualUrl;
    item.drive_file_id = extractGoogleDriveFileId(manualUrl) || "";
    if (manualUrl !== prevUrl) {
      item.image_base64 = "";
      if (!item.image_name) item.image_name = item.drive_file_id ? `drive_${item.drive_file_id}` : "external_image";
    }
  }

  closeEditItemModal();
  syncItemStatuses();
  renderAll();

  if (draftImg.base64) {
    showNotification(`กำลังอัปโหลดรูปภาพอุปกรณ์ [${id}] ขึ้น Google Drive...`, "info");
    const driveRes = await uploadFileToGoogleDrive(draftImg.base64, `${id}_${item.image_name || "preview.png"}`, "Equipment", id);
    if (driveRes && (driveRes.fileId || driveRes.viewUrl)) {
      item.drive_file_id = driveRes.fileId || item.drive_file_id || "";
      item.image_url = driveRes.viewUrl || item.image_url || "";
    }
  }

  if (item.image_base64 || item.image_url || item.drive_file_id) {
    saveAttachmentToCache(id, item.image_name || `${id}.png`, item.image_base64 || "", item.image_url || "", item.drive_file_id || "");
  }

  renderAll();

  const isSimulatedId = String(item.drive_file_id || "").startsWith("DRV_");
  const updateRes = await callAPI("updateItem", {
    itemId: id,
    itemName: item.item_name,
    category: item.category,
    serialNumber: item.serial_number,
    status: item.status,
    imageName: item.image_name || "",
    imageUrl: isSimulatedId ? manualUrl : (item.image_url || ""),
    driveFileId: isSimulatedId ? (extractGoogleDriveFileId(manualUrl) || "") : (item.drive_file_id || ""),
    imageBase64: (!isSimulatedId && item.drive_file_id) ? "" : (draftImg.base64 || ""),
    folderId: state.driveFolderId || ""
  }, true);

  if (updateRes && (updateRes.drive_file_id || updateRes.image_url)) {
    item.drive_file_id = updateRes.drive_file_id || item.drive_file_id;
    item.image_url = updateRes.image_url || item.image_url;
    saveAttachmentToCache(id, item.image_name || `${id}.png`, item.image_base64 || "", item.image_url || "", item.drive_file_id || "");
    renderAll();
  }

  showNotification(`อัปเดตอุปกรณ์ [${id}] เรียบร้อย`, "success");
}

function handleEditHistoryStatusChange(val) {
  const actualInput = document.getElementById("editHistoryActualReturn");
  if (actualInput) {
    if (val === "Returned" && !actualInput.value) actualInput.value = getLocalTimestamp(0);
    if (val === "Borrowed") actualInput.value = "";
  }
}
