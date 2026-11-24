function findMatchedUserInDatabase(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  if (!q) return null;
  const roles = (state.userRoles || []).map(u => normalizeUserRole(u));

  // 1. Exact email match
  let found = roles.find(u => safeLower(u.email) === q);
  if (found) return found;

  // 2. Email username prefix match (e.g., "somchai.user" matches "somchai.user@thaichamber.or.th")
  const qPrefix = q.includes("@") ? q.split("@")[0] : q;
  found = roles.find(u => {
    const em = safeLower(u.email);
    return em && em.split("@")[0] === qPrefix;
  });
  if (found) return found;

  // 3. Exact full name match ("first_name last_name" or "name")
  const qNormalizedSpace = q.replace(/\s+/g, " ");
  found = roles.find(u => {
    const full1 = safeLower(u.name).replace(/\s+/g, " ");
    const full2 = safeLower([u.first_name, u.last_name].filter(Boolean).join(" ")).replace(/\s+/g, " ");
    return (full1 && full1 === qNormalizedSpace) || (full2 && full2 === qNormalizedSpace);
  });
  if (found) return found;

  // 4. Exact first_name match (when unique or at least 2 chars)
  if (q.length >= 2) {
    found = roles.find(u => safeLower(u.first_name) === q);
    if (found) return found;
  }

  return null;
}

function ensureDeptOptionExistsAndSelect(selectId, deptValue) {
  const sel = document.getElementById(selectId);
  if (!sel || !deptValue) return;
  const cleanDept = stripDepartmentNumberPrefix(deptValue);
  if (!cleanDept) return;

  if (!state.departments.includes(cleanDept)) {
    state.departments.push(cleanDept);
  }
  const hasOption = Array.from(sel.options).some(opt => opt.value === cleanDept);
  if (!hasOption) {
    const opt = document.createElement("option");
    opt.value = cleanDept;
    opt.textContent = cleanDept;
    sel.appendChild(opt);
  }
  sel.value = cleanDept;
}

function populateUserAutocompleteDatalists() {
  const namesList = document.getElementById("userDatabaseNamesList");
  const emailsList = document.getElementById("userDatabaseEmailsList");
  const roles = (state.userRoles || [])
    .filter(u => u && u.status !== "disabled" && !isBlockedNotificationEmail(u.email))
    .map(u => normalizeUserRole(u));

  if (namesList) {
    const seenNames = new Set();
    namesList.innerHTML = roles.map(u => {
      const fullName = (u.name || [u.first_name, u.last_name].filter(Boolean).join(" ")).trim();
      if (!fullName || seenNames.has(fullName.toLowerCase())) return "";
      seenNames.add(fullName.toLowerCase());
      const label = `${u.email}${u.dept ? ' • ' + u.dept : ''}`;
      return `<option value="${escapeQuotes(fullName)}" label="${escapeQuotes(label)}"></option>`;
    }).join("");
  }

  if (emailsList) {
    const seenEmails = new Set();
    emailsList.innerHTML = roles.map(u => {
      const em = (u.email || "").trim();
      if (!em || isBlockedNotificationEmail(em) || seenEmails.has(em.toLowerCase())) return "";
      seenEmails.add(em.toLowerCase());
      const fullName = (u.name || [u.first_name, u.last_name].filter(Boolean).join(" ")).trim();
      const label = `${fullName}${u.dept ? ' • ' + u.dept : ''}`;
      return `<option value="${escapeQuotes(em)}" label="${escapeQuotes(label)}"></option>`;
    }).join("");
  }
}

function updateMatchBadgeUI(badgeId, matchedUser) {
  const badge = document.getElementById(badgeId);
  if (!badge) return;
  if (matchedUser) {
    const safeMail = isBlockedNotificationEmail(matchedUser.email) ? PRIMARY_SENDER_EMAIL : matchedUser.email;
    badge.innerHTML = `<span class="text-emerald-700 font-bold">✓ จับคู่ฐานข้อมูลสำเร็จ:</span> <span class="text-slate-800 font-semibold">${matchedUser.name}</span> <span class="text-slate-500">(${safeMail}${matchedUser.dept ? ' • ' + matchedUser.dept : ''})</span>`;
  } else {
    badge.innerText = "จับคู่ข้อมูล ชื่อ-อีเมล-ฝ่าย จากฐานข้อมูลผู้ใช้งานอัตโนมัติ";
  }
}

function autoFillUserFormsFromDatabase(forceOverwrite = false) {
  const bStartEl = document.getElementById("borrowStartDate");
  if (bStartEl && (forceOverwrite || !bStartEl.value)) {
    bStartEl.value = getOffsetDate(0);
    handleBorrowStartDateChange();
  }
  const bRetEl = document.getElementById("expectedReturnDate");
  if (bRetEl && !bRetEl.value) {
    setDefaultReturnDate();
  }
  if (!state.currentUser) return;
  // Match current logged-in user against latest state.userRoles database
  const dbUser = findMatchedUserInDatabase(state.currentUser.email) || findMatchedUserInDatabase(state.currentUser.name);
  const effectiveName = (dbUser?.name || [dbUser?.first_name, dbUser?.last_name].filter(Boolean).join(" ") || state.currentUser.name || "").trim();
  const rawEmail = (dbUser?.email || state.currentUser.email || "").trim();
  const effectiveEmail = isBlockedNotificationEmail(rawEmail) ? PRIMARY_SENDER_EMAIL : rawEmail;
  const effectiveDept = (dbUser?.dept || state.currentUser.dept || "").trim();

  if (dbUser) {
    state.currentUser.name = effectiveName || state.currentUser.name;
    state.currentUser.email = rawEmail || state.currentUser.email;
    state.currentUser.dept = effectiveDept || state.currentUser.dept;
  }

  renderDepartmentSelects();

  // 1. Borrow Form
  const bName = document.getElementById("borrowerName");
  const bContact = document.getElementById("borrowerContact");
  const bDept = document.getElementById("borrowerDept");
  if (bName && (forceOverwrite || !bName.value.trim())) bName.value = effectiveName;
  if (bContact && (forceOverwrite || !bContact.value.trim() || isBlockedNotificationEmail(bContact.value))) bContact.value = effectiveEmail;
  if (bDept && effectiveDept && (forceOverwrite || !bDept.value)) {
    ensureDeptOptionExistsAndSelect("borrowerDept", effectiveDept);
  }
  updateMatchBadgeUI("borrowUserMatchBadge", dbUser || state.currentUser);

  // 2. Ticket Create Form
  const tName = document.getElementById("ticketReporterName");
  const tContact = document.getElementById("ticketReporterContact");
  const tDept = document.getElementById("ticketReporterDept");
  if (tName && (forceOverwrite || !tName.value.trim())) tName.value = effectiveName;
  if (tContact && (forceOverwrite || !tContact.value.trim() || isBlockedNotificationEmail(tContact.value))) tContact.value = effectiveEmail;
  if (tDept && effectiveDept && (forceOverwrite || !tDept.value)) {
    ensureDeptOptionExistsAndSelect("ticketReporterDept", effectiveDept);
  }
  updateMatchBadgeUI("ticketUserMatchBadge", dbUser || state.currentUser);
}

function handleBorrowerUserAutoMatch(sourceField) {
  const nameEl = document.getElementById("borrowerName");
  const emailEl = document.getElementById("borrowerContact");
  const query = sourceField === "name" ? nameEl?.value : emailEl?.value;
  const matched = findMatchedUserInDatabase(query);
  if (!matched) return;

  const fullName = (matched.name || [matched.first_name, matched.last_name].filter(Boolean).join(" ")).trim();
  const safeMail = isBlockedNotificationEmail(matched.email) ? PRIMARY_SENDER_EMAIL : matched.email;
  if (sourceField === "name") {
    if (emailEl && safeMail) emailEl.value = safeMail;
  } else if (sourceField === "email") {
    if (nameEl && fullName) nameEl.value = fullName;
    if (emailEl && isBlockedNotificationEmail(emailEl.value)) emailEl.value = safeMail;
  }
  if (matched.dept) {
    ensureDeptOptionExistsAndSelect("borrowerDept", matched.dept);
  }
  updateMatchBadgeUI("borrowUserMatchBadge", matched);
}

function handleTicketReporterAutoMatch(sourceField) {
  const nameEl = document.getElementById("ticketReporterName");
  const emailEl = document.getElementById("ticketReporterContact");
  const query = sourceField === "name" ? nameEl?.value : emailEl?.value;
  const matched = findMatchedUserInDatabase(query);
  if (!matched) return;

  const fullName = (matched.name || [matched.first_name, matched.last_name].filter(Boolean).join(" ")).trim();
  const safeMail = isBlockedNotificationEmail(matched.email) ? PRIMARY_SENDER_EMAIL : matched.email;
  if (sourceField === "name") {
    if (emailEl && safeMail) emailEl.value = safeMail;
  } else if (sourceField === "email") {
    if (nameEl && fullName) nameEl.value = fullName;
    if (emailEl && isBlockedNotificationEmail(emailEl.value)) emailEl.value = safeMail;
  }
  if (matched.dept) {
    ensureDeptOptionExistsAndSelect("ticketReporterDept", matched.dept);
  }
  updateMatchBadgeUI("ticketUserMatchBadge", matched);
}

function handleHistoryBorrowerAutoMatch(sourceField) {
  const nameEl = document.getElementById("editHistoryBorrowerName");
  const emailEl = document.getElementById("editHistoryContact");
  const query = sourceField === "name" ? nameEl?.value : emailEl?.value;
  const matched = findMatchedUserInDatabase(query);
  if (!matched) return;

  const fullName = (matched.name || [matched.first_name, matched.last_name].filter(Boolean).join(" ")).trim();
  const safeMail = isBlockedNotificationEmail(matched.email) ? PRIMARY_SENDER_EMAIL : matched.email;
  if (sourceField === "name" && emailEl && safeMail) emailEl.value = safeMail;
  if (sourceField === "email" && nameEl && fullName) nameEl.value = fullName;
  if (matched.dept) {
    ensureDeptOptionExistsAndSelect("editHistoryDept", matched.dept);
  }
}

/* ============================================================================
 * REQUIREMENT 2: AUTOMATED EMAIL NOTIFICATION SYSTEM & ADMIN EMAIL MANAGER
 * ============================================================================ */
function togglePasswordVisibility(inputId, iconId) {
  const el = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!el) return;
  const isHidden = el.type === "password";
  el.type = isHidden ? "text" : "password";
  if (icon) {
    icon.innerHTML = isHidden ? PASSWORD_EYE_OFF_SVG : PASSWORD_EYE_SVG;
  }
  const btn = icon?.closest("button");
  if (btn) {
    btn.setAttribute("aria-pressed", String(isHidden));
    btn.setAttribute("title", isHidden ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน");
  }
}

function generateRandomPassForInput(inputId) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const el = document.getElementById(inputId);
  if (el) {
    el.value = pwd;
    el.type = "text";
    if (inputId === "inputRolePassword") {
      const icon = document.getElementById("roleModalPassToggleIcon");
      if (icon) {
        icon.innerHTML = PASSWORD_EYE_OFF_SVG;
        const btn = icon.closest("button");
        if (btn) {
          btn.setAttribute("aria-pressed", "true");
          btn.setAttribute("title", "ซ่อนรหัสผ่าน");
        }
      }
    }
    showNotification(`สุ่มรหัสผ่านเรียบร้อย: ${pwd}`, "info");
  }
}

function handleGateUserPassLogin() {
  const emailOrUser = document.getElementById("gateLoginEmailInput")?.value.trim();
  const password = document.getElementById("gateLoginPasswordInput")?.value;
  if (!emailOrUser) return showNotification("กรุณาระบุบัญชีผู้ใช้งานหรืออีเมล", "warning");
  if (!password) return showNotification("กรุณาระบุรหัสผ่าน", "warning");
  processUserLogin(emailOrUser, password);
}

function handleModalUserPassLogin() {
  const emailOrUser = document.getElementById("manualLoginEmailInput")?.value.trim();
  const password = document.getElementById("manualLoginPasswordInput")?.value;
  if (!emailOrUser) return showNotification("กรุณาระบุบัญชีผู้ใช้งานหรืออีเมล", "warning");
  if (!password) return showNotification("กรุณาระบุรหัสผ่าน", "warning");
  processUserLogin(emailOrUser, password);
}

function processUserLogin(emailOrUser, password) {
  const user = findMatchedUserInDatabase(emailOrUser);

  if (!user) {
    showNotification("⛔ ไม่พบบัญชีผู้ใช้งานในระบบ (กรุณาให้ผู้ดูแลระบบ Super Admin เพิ่มบัญชีก่อน)", "error");
    return false;
  }

  if (user.status === "disabled") {
    showNotification("⛔ บัญชีผู้ใช้นี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ (Super Admin)", "error");
    return false;
  }

  if (user.password && user.password !== password) {
    showNotification("⛔ รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง", "error");
    return false;
  }

  const fullName = (user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email.split('@')[0]).trim();
  const userObj = {
    name: fullName,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email.trim().toLowerCase(),
    dept: user.dept || "",
    picture: `https://placehold.co/100x100/005ba6/ffffff?text=${encodeURIComponent((fullName || user.email).charAt(0).toUpperCase())}`,
    role: user.role || "user",
    status: user.status || "active"
  };

  setCurrentUser(userObj);
  closeLoginModal();

  if (userObj.role === "superadmin") showNotification(`👑 ยินดีต้อนรับ Super Admin: ${userObj.name}`, "success");
  else if (userObj.role === "admin") showNotification(`🛡️ ยินดีต้อนรับเจ้าหน้าที่ไอที (Admin): ${userObj.name}`, "success");
  else showNotification(`✓ ยินดีต้อนรับคุณ ${userObj.name} (${userObj.dept || 'จับคู่ข้อมูลสำเร็จ'})`, "success");

  return true;
}

function loginDemoAccount() {
  showNotification("⛔ ปิดระบบทดสอบเข้าใช้งานด่วนแล้ว กรุณากรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าสู่ระบบ", "error");
  return false;
}

function setCurrentUser(user) {
  state.currentUser = user;
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  applyUserRoleUI();

  if (user) {
    autoFillUserFormsFromDatabase(true);
    refreshData(false);
  }
  const targetTab = getTargetTabFromUrl() || 'borrowTab';
  switchTab(targetTab);
}

function handleSignOut() {
  state.currentUser = null;
  localStorage.removeItem(STORAGE_KEY_USER);
  applyUserRoleUI();
  switchTab('borrowTab');
  showNotification("ออกจากระบบเรียบร้อยแล้ว", "info");
}

function applyUserRoleUI() {
  const user = state.currentUser;
  const role = user ? user.role : null;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;
  const isUser = !!user;

  const authGate = document.getElementById("authGateScreen");
  const mainApp = document.getElementById("mainAppContainer");
  if (isUser) {
    authGate?.classList.add("hidden");
    mainApp?.classList.remove("hidden");
  } else {
    authGate?.classList.remove("hidden");
    mainApp?.classList.add("hidden");
  }

  const btnLoginModal = document.getElementById("btnLoginModal");
  const userProfilePill = document.getElementById("userProfilePill");
  const userAvatarImg = document.getElementById("userAvatarImg");
  const userDisplayName = document.getElementById("userDisplayName");
  const userEmailSub = document.getElementById("userEmailSub");
  const roleBadge = document.getElementById("roleBadge");

  if (user) {
    btnLoginModal?.classList.add("hidden");
    userProfilePill?.classList.remove("hidden");
    userProfilePill?.classList.add("flex");
    if (userAvatarImg) userAvatarImg.src = user.picture;
    if (userDisplayName) userDisplayName.innerText = user.name;
    if (userEmailSub) userEmailSub.innerText = isSuperAdmin ? "👑 Super Admin" : (isAdmin ? "🛡️ Admin ไอที" : user.email);
  } else {
    btnLoginModal?.classList.remove("hidden");
    userProfilePill?.classList.add("hidden");
    userProfilePill?.classList.remove("flex");
  }

  if (roleBadge) {
    if (isSuperAdmin) {
      roleBadge.innerText = "👑 Super Admin";
      roleBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0 whitespace-nowrap";
    } else if (isAdmin) {
      roleBadge.innerText = "🛡️ Admin ไอที";
      roleBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 shrink-0 whitespace-nowrap";
    } else if (isUser) {
      roleBadge.innerText = "ผู้ใช้งานระบบ";
      roleBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 whitespace-nowrap";
    } else {
      roleBadge.innerText = "รอเข้าสู่ระบบ";
      roleBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shrink-0 whitespace-nowrap";
    }
  }

  document.querySelectorAll(".superadmin-only").forEach(el => {
    if (isSuperAdmin) el.classList.remove("superadmin-hidden");
    else el.classList.add("superadmin-hidden");
  });

  document.querySelectorAll(".admin-only").forEach(el => {
    if (isAdmin) el.classList.remove("admin-hidden");
    else el.classList.add("admin-hidden");
  });

  const sidebarRoleLabel = document.getElementById("sidebarRoleLabel");
  if (sidebarRoleLabel && user) {
    sidebarRoleLabel.innerText = isSuperAdmin ? "Super Admin Console" : "Admin Console";
  }

  const adminSidebar = document.getElementById("adminSidebar");
  if (isAdmin) {
    adminSidebar?.classList.remove("admin-hidden");
    if (window.innerWidth >= 1024) adminSidebar?.classList.remove("hidden");
  } else {
    adminSidebar?.classList.add("admin-hidden");
  }

  renderAll();
}

function openLoginModal() {
  document.getElementById("loginModal").classList.remove("hidden");
}
function closeLoginModal() {
  document.getElementById("loginModal").classList.add("hidden");
}

/* TAB ROUTING & NAVIGATION WITH HASH (#) AND QUERY (?) */
