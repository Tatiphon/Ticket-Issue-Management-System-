function getDatabaseLoadingBlockHtml(message = "กำลังโหลดข้อมูลจากฐานข้อมูล...") {
  return `
    <div class="py-10 px-4 flex flex-col items-center justify-center gap-2.5 text-center">
      <div class="w-7 h-7 border-3 border-tcc-600 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs font-bold text-tcc-800">${message}</p>
      <p class="text-[11px] text-slate-400">กำลังซิงค์ข้อมูลจริงจากฐานข้อมูลกลาง Supabase...</p>
    </div>
  `;
}

function getDatabaseLoadingRowHtml(colspan = 6, message = "กำลังโหลดข้อมูลจากฐานข้อมูล...") {
  return `
    <tr>
      <td colspan="${colspan}" class="py-10 px-4 text-center">
        <div class="inline-flex flex-col items-center justify-center gap-2">
          <div class="w-6 h-6 border-2 border-tcc-600 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-bold text-tcc-800">${message}</span>
        </div>
      </td>
    </tr>
  `;
}

function updateInitialLoadingBannerVisibility() {
  const banner = document.getElementById("dbInitialLoadingBanner");
  if (!banner) return;
  if (state.isInitialLoading) {
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

/* ============================================================================
 * REQUIREMENT 1: DATABASE USER AUTO-MATCHING (ชื่อ - อีเมล - ฝ่าย/แผนก อัตโนมัติ)
 * ============================================================================ */
function getTargetTabFromUrl() {
  let raw = "";
  if (window.location.hash) {
    raw = window.location.hash.replace(/^#/, "").trim();
  }
  if (!raw && window.location.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      raw = (params.get("tab") || params.get("page") || "").trim();
    } catch (e) {}
  }
  if (!raw) return null;

  if (ALL_TAB_IDS.includes(raw)) return raw;

  const lower = raw.toLowerCase().replace(/[-_]/g, "");
  if (TAB_ALIASES[lower]) return TAB_ALIASES[lower];
  const matched = ALL_TAB_IDS.find(t => t.toLowerCase() === lower || t.toLowerCase() === lower + "tab");
  if (matched) return matched;

  return null;
}

function isTabAuthorized(tabId) {
  const user = state.currentUser;
  const role = user ? user.role : null;
  const isSuper = role === "superadmin";
  const isAdmin = role === "admin" || isSuper;

  if (tabId === "kbTab" && state.kbEnabled === false) return isAdmin;
  if (tabId === "rolesTab") return isSuper || isAdmin;
  const adminOnlyTabs = ["dashboardTab", "ticketAdminTab", "helpdeskReportTab", "returnTab", "inventoryTab", "historyTab", "emailSettingsTab"];
  if (adminOnlyTabs.includes(tabId)) return isAdmin;
  return true;
}

function updateUrlHash(tabId) {
  try {
    const targetHash = '#' + tabId;
    if (window.location.hash !== targetHash) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', targetHash);
      } else {
        window.location.hash = targetHash;
      }
    }
  } catch (e) {
    try { window.location.hash = '#' + tabId; } catch (err) {}
  }
}

function switchTab(tabId, updateUrl = true) {
  // Validate tab existence or fallback to url/default
  if (!tabId || !ALL_TAB_IDS.includes(tabId)) {
    tabId = getTargetTabFromUrl() || "borrowTab";
  }

  // Check role authorization for protected tabs
  if (!isTabAuthorized(tabId)) {
    tabId = "borrowTab";
  }

  // Sync browser URL Hash for persistent reload and sharing
  if (updateUrl) {
    updateUrlHash(tabId);
  }

  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));

  const userNavConfigs = {
    borrowTab: {
      active: ["bg-tcc-600", "text-white", "shadow-md", "ring-2", "ring-tcc-600/20"],
      inactive: ["bg-white", "text-tcc-800", "border", "border-tcc-200/70", "hover:bg-tcc-50", "shadow-2xs"]
    },
    ticketCreateTab: {
      active: ["bg-rose-600", "text-white", "shadow-md", "ring-2", "ring-rose-600/20"],
      inactive: ["bg-white", "text-rose-700", "border", "border-rose-200/70", "hover:bg-rose-50", "shadow-2xs"]
    },
    myBorrowsTab: {
      active: ["bg-slate-800", "text-white", "shadow-sm"],
      inactive: ["text-slate-600", "hover:bg-white", "hover:text-slate-900"]
    },
    myTicketsTab: {
      active: ["bg-slate-800", "text-white", "shadow-sm"],
      inactive: ["text-slate-600", "hover:bg-white", "hover:text-slate-900"]
    },
    kbTab: {
      active: ["bg-amber-500", "text-white", "shadow-sm"],
      inactive: ["text-slate-600", "hover:bg-slate-100"]
    }
  };

  Object.keys(userNavConfigs).forEach(key => {
    const btn = document.getElementById("tabBtn-" + key);
    if (!btn) return;
    const cfg = userNavConfigs[key];
    btn.classList.remove(...cfg.active, ...cfg.inactive);
    if (key === tabId) {
      btn.classList.add(...cfg.active);
    } else {
      btn.classList.add(...cfg.inactive);
    }
  });

  const badgeMyBorrows = document.getElementById("tabBadgeMyBorrows");
  if (badgeMyBorrows) {
    if (tabId === "myBorrowsTab") {
      badgeMyBorrows.className = "px-2 py-0.2 rounded-full text-xs bg-white/20 text-white font-bold";
    } else {
      badgeMyBorrows.className = "px-2 py-0.2 rounded-full text-xs bg-slate-200 text-slate-700 font-bold";
    }
  }
  const badgeMyTickets = document.getElementById("tabBadgeMyTickets");
  if (badgeMyTickets) {
    if (tabId === "myTicketsTab") {
      badgeMyTickets.className = "px-2 py-0.2 rounded-full text-xs bg-white/20 text-white font-bold";
    } else {
      badgeMyTickets.className = "px-2 py-0.2 rounded-full text-xs bg-slate-200 text-slate-700 font-bold";
    }
  }

  document.querySelectorAll(".admin-sidebar-btn").forEach(el => {
    el.classList.remove("bg-tcc-600", "text-white", "shadow-sm", "font-bold");
    el.classList.add("text-slate-700", "hover:bg-slate-100");
  });
  const targetSidebarBtn = document.getElementById("sidebarBtn-" + tabId);
  if (targetSidebarBtn) {
    targetSidebarBtn.classList.add("bg-tcc-600", "text-white", "shadow-sm", "font-bold");
    targetSidebarBtn.classList.remove("text-slate-700", "hover:bg-slate-100");
    expandSidebarSectionOf(targetSidebarBtn);
  }

  const targetTab = document.getElementById("tabContent-" + tabId);
  if (targetTab) targetTab.classList.remove("hidden");

  if (window.innerWidth < 1024) {
    const adminSidebar = document.getElementById("adminSidebar");
    if (adminSidebar && !adminSidebar.classList.contains("hidden")) {
      adminSidebar.classList.add("hidden");
    }
  }

  if (tabId === "borrowTab" || tabId === "ticketCreateTab") {
    autoFillUserFormsFromDatabase(false);
  }
  if (tabId === "dashboardTab") renderMonthlyDashboard();
  if (tabId === "myTicketsTab") renderMyTicketsList();
  if (tabId === "ticketAdminTab") renderAdminTicketsView();
  if (tabId === "helpdeskReportTab") renderHelpdeskReport();
  if (tabId === "kbTab") renderKnowledgeBaseList();
  if (tabId === "rolesTab") { renderDepartmentSelects(); renderRolesTable(); }
  if (tabId === "myBorrowsTab") renderMyBorrowsTable();
  if (tabId === "returnTab") renderReturnTable();
  if (tabId === "inventoryTab") renderInventoryTable();
  if (tabId === "historyTab") renderHistoryTable();
  if (tabId === "emailSettingsTab") renderEmailSettingsTab();
}

// Hash change event listener for browser Back/Forward navigation
window.addEventListener("hashchange", () => {
  const tab = getTargetTabFromUrl();
  if (tab) {
    switchTab(tab, false);
  }
});

function toggleAdminSidebarMobile() {
  const sidebar = document.getElementById("adminSidebar");
  if (sidebar) sidebar.classList.toggle("hidden");
}

/* UNIFIED DASHBOARD ANALYTICS */
function showNotification(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const t = document.createElement("div");
  const bg = type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : (type === "error" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-amber-50 border-amber-200 text-amber-800");
  t.className = `p-3 rounded-xl border shadow-lg text-xs font-semibold pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0 flex items-center justify-between ${bg}`;
  t.innerHTML = `<span>${msg}</span><button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 font-bold ml-2">✕</button>`;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.remove("translate-y-2", "opacity-0"));
  setTimeout(() => { t.classList.add("opacity-0", "translate-y-2"); setTimeout(() => t.remove(), 300); }, 3500);
}

function renderAll() {
  updateInitialLoadingBannerVisibility();
  syncItemStatuses();
  renderDepartmentSelects();
  renderTicketCategorySelects();
  renderSelectedBorrowItems();
  renderQuickAvailableList();
  renderMyBorrowsTable();
  renderReturnTable();
  renderInventoryTable();
  filterHistory();
  filterRolesTable();
  renderMonthlyDashboard();
  renderKnowledgeBaseList();
  renderMyTicketsList();
  renderAdminTicketsView();
  renderHelpdeskReport();
  updateEmailLogBadges();

  const aiSel = document.getElementById("aiBorrowSelect");
  if (aiSel) {
    aiSel.innerHTML = state.isInitialLoading
      ? '<option value="">กำลังโหลดรายการยืมจากฐานข้อมูล...</option>'
      : '<option value="">-- เลือกรายการยืมเพื่อร่างทวงของ --</option>' + state.activeBorrows.map(b => `<option value="${b.trans_id}">${b.borrower_name} ยืม [${b.item_id}] (กำหนดส่ง: ${b.expected_return})</option>`).join("");
  }

  const activeTickets = state.tickets.filter(t => t.status === "Open" || t.status === "In Progress");
  const sidebarBadgeTickets = document.getElementById("sidebarBadgeTickets");
  if (sidebarBadgeTickets) sidebarBadgeTickets.innerText = state.isInitialLoading ? "..." : activeTickets.length;

  const sidebarBadgeReturns = document.getElementById("sidebarBadgeReturns");
  if (sidebarBadgeReturns) sidebarBadgeReturns.innerText = state.isInitialLoading ? "..." : state.activeBorrows.length;

  const sidebarBadgeHistory = document.getElementById("sidebarBadgeHistory");
  if (sidebarBadgeHistory) sidebarBadgeHistory.innerText = state.isInitialLoading ? "..." : state.allLogs.length;

  const sidebarRoleLabel = document.getElementById("sidebarRoleLabel");
  if (sidebarRoleLabel && state.currentUser) {
    sidebarRoleLabel.innerText = state.currentUser.role === 'superadmin' ? '👑 Super Admin Console' : '🛡️ Admin Console';
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initAllStaticQuillEditors();
  setDefaultReturnDate();
  // Restore cached equipment images from localStorage
  state.items.forEach(item => {
    const cached = getAttachmentFromCache(item.item_id);
    if (cached) {
      if (!item.image_name && cached.name) item.image_name = cached.name;
      if (!item.image_base64 && cached.base64) item.image_base64 = cached.base64;
      if (!item.image_url && cached.driveUrl) item.image_url = cached.driveUrl;
      if (!item.drive_file_id && cached.driveFileId) item.drive_file_id = cached.driveFileId;
    }
  });

  const saved = localStorage.getItem(STORAGE_KEY_USER);
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (state.isInitialLoading) {
        state.currentUser = user;
      } else {
        const u = findMatchedUserInDatabase(user.email) || findMatchedUserInDatabase(user.name);
        if (u && u.status !== "disabled") {
          user.email = u.email || user.email;
          user.first_name = u.first_name || user.first_name || "";
          user.last_name = u.last_name || user.last_name || "";
          user.name = u.name || user.name;
          user.dept = u.dept || user.dept || "";
          user.role = u.role || "user";
          user.status = u.status || "active";
          state.currentUser = user;
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        } else {
          localStorage.removeItem(STORAGE_KEY_USER);
          state.currentUser = null;
        }
      }
    } catch (e) {}
  }

  if (state.isInitialLoading) {
    const dot = document.getElementById("connStatusDot");
    const txt = document.getElementById("connStatusText");
    if (dot && txt) {
      dot.className = "w-2 h-2 rounded-full bg-tcc-500 animate-ping";
      txt.className = "truncate max-w-[130px] sm:max-w-none text-tcc-700 font-medium";
      txt.innerText = "กำลังโหลดฐานข้อมูล...";
    }
  }

  syncItemStatuses();
  renderAll();
  renderEmailSettingsTab();
  applyUserRoleUI();
  populateUserAutocompleteDatalists();
  autoFillUserFormsFromDatabase(true);
  updateEmailLogBadges();
  const initialTab = getTargetTabFromUrl() || 'borrowTab';
  switchTab(initialTab);

  // Fetch latest database records immediately on load and start real-time auto-sync
  refreshData(false);
  startRealtimeAutoSync();

  const dropZone = document.getElementById("ticketFileDropZone");
  if (dropZone) {
    ["dragenter", "dragover"].forEach(evtName => {
      dropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("border-tcc-500", "bg-tcc-50/50");
      });
    });
    ["dragleave", "drop"].forEach(evtName => {
      dropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("border-tcc-500", "bg-tcc-50/50");
      });
    });
    dropZone.addEventListener("drop", (e) => {
      const dtFiles = e.dataTransfer?.files;
      if (dtFiles && dtFiles.length > 0) {
        handleTicketFileSelect({ target: { files: dtFiles } });
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const previewModal = document.getElementById("attachmentPreviewModal");
      if (previewModal && !previewModal.classList.contains("hidden")) {
        closeAttachmentPreviewModal();
      }
      const emailModal = document.getElementById("emailLogModal");
      if (emailModal && !emailModal.classList.contains("hidden")) {
        closeEmailLogModal();
      }
    }
  });
});

/* ADMIN SIDEBAR: COLLAPSIBLE SECTIONS (พับ/กางหมวดหมู่เมนู) */
const STORAGE_KEY_SIDEBAR_SECTIONS = "it_asset_sidebar_sections";
const SIDEBAR_SECTION_DEFAULTS = { dashboard: true, helpdesk: true, reports: true, settings: false };

function getSidebarSectionStates() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_SIDEBAR_SECTIONS) || "{}");
    return { ...SIDEBAR_SECTION_DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch (_) {
    return { ...SIDEBAR_SECTION_DEFAULTS };
  }
}

function setSidebarSectionOpen(key, open, persist = true) {
  const sec = document.querySelector(`[data-sidebar-section="${key}"]`);
  if (!sec) return;
  sec.querySelector(".sidebar-section-body")?.classList.toggle("hidden", !open);
  sec.querySelector(".sidebar-section-chevron")?.classList.toggle("-rotate-90", !open);
  sec.querySelector(".sidebar-section-header")?.setAttribute("aria-expanded", open ? "true" : "false");
  if (persist) {
    try {
      const states = getSidebarSectionStates();
      states[key] = open;
      localStorage.setItem(STORAGE_KEY_SIDEBAR_SECTIONS, JSON.stringify(states));
    } catch (_) {}
  }
}

function toggleSidebarSection(key) {
  const sec = document.querySelector(`[data-sidebar-section="${key}"]`);
  if (!sec) return;
  const isOpen = !sec.querySelector(".sidebar-section-body")?.classList.contains("hidden");
  setSidebarSectionOpen(key, !isOpen);
}

function initSidebarSections() {
  const states = getSidebarSectionStates();
  document.querySelectorAll("[data-sidebar-section]").forEach(sec => {
    const key = sec.getAttribute("data-sidebar-section");
    setSidebarSectionOpen(key, states[key] !== false, false);
  });
  const active = document.querySelector(".admin-sidebar-btn.bg-tcc-600");
  if (active) expandSidebarSectionOf(active);
}

function expandSidebarSectionOf(btn) {
  const sec = btn?.closest("[data-sidebar-section]");
  if (sec) setSidebarSectionOpen(sec.getAttribute("data-sidebar-section"), true, false);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidebarSections);
} else {
  initSidebarSections();
}
