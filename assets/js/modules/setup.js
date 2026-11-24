let cachedGasCode = "";

async function loadGasCodeTemplate() {
  if (cachedGasCode) return cachedGasCode;
  const resp = await fetch("scripts/Code.gs");
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  cachedGasCode = await resp.text();
  return cachedGasCode;
}

async function openSetupModal() {
  const urlInput = document.getElementById("inputWebAppUrl");
  if (urlInput) urlInput.value = state.webAppUrl || "";
  const driveInput = document.getElementById("inputDriveFolderId");
  if (driveInput) driveInput.value = state.driveFolderId || "";
  const codeBlock = document.getElementById("gasCodeBlock");
  if (codeBlock) codeBlock.textContent = cachedGasCode || "กำลังโหลดโค้ด Google Apps Script...";
  document.getElementById("setupModal")?.classList.remove("hidden");
  testSupabaseConnection(true);
  if (codeBlock && !cachedGasCode) {
    try {
      codeBlock.textContent = await loadGasCodeTemplate();
    } catch (err) {
      codeBlock.textContent = `// ไม่สามารถโหลดไฟล์ scripts/Code.gs ได้ (${err.message})`;
    }
  }
}

function closeSetupModal() {
  document.getElementById("setupModal")?.classList.add("hidden");
}

function saveWebAppUrl() {
  const val = document.getElementById("inputWebAppUrl")?.value.trim();
  if (!val) return showNotification("กรุณาระบุ Google Apps Script Web App URL", "warning");
  state.webAppUrl = val;
  localStorage.setItem(STORAGE_KEY_URL, val);
  showNotification("บันทึก Google Drive Web App URL เรียบร้อย", "success");
}

function useLiveSupabaseMode() {
  state.useDemoMode = false;
  state.isLive = true;
  state.isInitialLoading = true;
  state.items = [];
  state.activeBorrows = [];
  state.allLogs = [];
  state.tickets = [];
  state.knowledgeBase = [];
  state.categories = [];
  state.ticketCategories = [];
  state.internalSystems = [];
  state.departments = [];
  localStorage.setItem(STORAGE_KEY_DEMO_MODE, "false");
  closeSetupModal();
  renderAll();
  showNotification("เปิดใช้งานโหมดเชื่อมต่อฐานข้อมูล Supabase (Live) แล้ว กำลังโหลดข้อมูล...", "success");
  triggerManualReload();
}

function resetToDemoMode() {
  state.useDemoMode = true;
  state.isLive = false;
  state.isInitialLoading = false;
  state.items = JSON.parse(JSON.stringify(INITIAL_DEMO_ITEMS));
  state.activeBorrows = JSON.parse(JSON.stringify(INITIAL_DEMO_BORROWS));
  state.allLogs = JSON.parse(JSON.stringify(INITIAL_DEMO_LOGS));
  state.tickets = JSON.parse(JSON.stringify(INITIAL_DEMO_TICKETS));
  state.knowledgeBase = JSON.parse(JSON.stringify(INITIAL_DEMO_KB));
  state.categories = [...INITIAL_DEMO_CATEGORIES];
  state.ticketCategories = [...INITIAL_DEMO_TICKET_CATEGORIES];
  state.internalSystems = [...INITIAL_DEMO_INTERNAL_SYSTEMS];
  state.departments = [...INITIAL_DEMO_DEPARTMENTS];
  localStorage.setItem(STORAGE_KEY_DEMO_MODE, "true");
  closeSetupModal();
  renderAll();
  showNotification("สลับใช้งานโหมดจำลอง (Demo Mode) เรียบร้อย", "info");
  triggerManualReload();
}

async function testSupabaseConnection(silent = false) {
  const box = document.getElementById("supabaseDiagnosticBox");
  if (box) {
    box.className = "p-2.5 rounded-lg bg-white border border-sky-200 text-sky-900 text-[11px] leading-relaxed";
    box.innerHTML = "🔄 กำลังทดสอบการเชื่อมต่อ Supabase (/api/db)...";
    box.classList.remove("hidden");
  }
  try {
    const response = await fetch(DB_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkDbSetup", env: IS_UAT_ENV ? "uat" : "prod" })
    });
    const res = await response.json();
    if (res && res.status === "success" && res.connected) {
      const tblSummary = Object.entries(res.tables || {})
        .map(([k, v]) => `<span class="inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 mr-1 mb-1"><b>${k}</b>: ${v ?? "-"}</span>`)
        .join("");
      if (box) {
        box.className = "p-2.5 rounded-lg bg-white border border-emerald-300 text-emerald-950 text-[11px] leading-relaxed";
        box.innerHTML = `✅ <b>เชื่อมต่อ Supabase สำเร็จ!</b> (Environment: <b>${res.environment || (IS_UAT_ENV ? "UAT" : "PROD")}</b> • Host: <code>${res.supabaseHost || "-"}</code>)<div class="mt-1.5">${tblSummary}</div>`;
      }
      if (!silent) showNotification("เชื่อมต่อฐานข้อมูล Supabase สำเร็จ", "success");
      return;
    }
    const errMsg = res?.message || "ไม่สามารถเชื่อมต่อ Supabase ได้";
    if (box) {
      box.className = "p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-relaxed";
      box.innerHTML = `⚠️ <b>ยังไม่พร้อมใช้งาน:</b> ${errMsg}`;
    }
    if (!silent) showNotification(errMsg, "warning");
  } catch (err) {
    const msg = err?.message || String(err);
    if (box) {
      box.className = "p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-[11px] leading-relaxed";
      box.innerHTML = `❌ <b>เชื่อมต่อ /api/db ไม่สำเร็จ:</b> ${msg} (หากรันไฟล์ HTML แบบเปิดตรงโดยไม่มี Vercel Server ระบบจะใช้โหมดจำลองชั่วคราว)`;
    }
    if (!silent) showNotification("เชื่อมต่อ /api/db ไม่สำเร็จ", "warning");
  }
}

async function copyGasCode() {
  try {
    const code = cachedGasCode || await loadGasCodeTemplate();
    const ta = document.createElement("textarea");
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showNotification("คัดลอกโค้ด Google Apps Script แล้ว", "success");
  } catch (err) {
    showNotification("ไม่สามารถโหลดไฟล์ scripts/Code.gs เพื่อคัดลอกได้", "warning");
  }
}
