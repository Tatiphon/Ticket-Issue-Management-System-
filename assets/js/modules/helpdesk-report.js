function populateHelpdeskReportFilterOptions() {
  const catEl = document.getElementById("hdReportCategory");
  if (catEl) {
    const cur = catEl.value;
    const cats = Array.from(new Set([...(state.ticketCategories || []), ...(state.tickets || []).map(t => t.category).filter(Boolean)]));
    catEl.innerHTML = '<option value="">ทุกหมวดหมู่ปัญหา</option>' + cats.map(c => `<option value="${escapeQuotes(c)}">${c}</option>`).join('');
    if (cur) catEl.value = cur;
  }

  const sysEl = document.getElementById("hdReportSystemName");
  if (sysEl) {
    const cur = sysEl.value;
    const systems = Array.from(new Set([...(state.internalSystems || []), ...(state.tickets || []).map(t => t.system_name).filter(Boolean)]));
    sysEl.innerHTML = '<option value="">ทุกระบบสารสนเทศ / ทั้งหมด</option>' + systems.map(s => `<option value="${escapeQuotes(s)}">${s}</option>`).join('');
    if (cur) sysEl.value = cur;
  }

  const deptEl = document.getElementById("hdReportDepartment");
  if (deptEl) {
    const cur = deptEl.value;
    const depts = Array.from(new Set([...(state.departments || []), ...(state.tickets || []).map(t => t.reporter_dept).filter(Boolean)]));
    deptEl.innerHTML = '<option value="">ทุกฝ่าย / แผนก</option>' + depts.map(d => `<option value="${escapeQuotes(d)}">${d}</option>`).join('');
    if (cur) deptEl.value = cur;
  }

  const agentEl = document.getElementById("hdReportAgent");
  if (agentEl) {
    const cur = agentEl.value;
    const admins = (state.userRoles || []).filter(r => r.role === "admin" || r.role === "superadmin");
    const extraAgents = Array.from(new Set((state.tickets || []).map(t => t.assigned_agent).filter(Boolean)));
    const agentOptions = [];
    admins.forEach(a => agentOptions.push({ val: a.email, label: `${a.name} (${a.email})` }));
    extraAgents.forEach(ag => {
      if (!agentOptions.some(o => o.val === ag || o.label.includes(ag))) {
        agentOptions.push({ val: ag, label: ag });
      }
    });
    agentEl.innerHTML = '<option value="">เจ้าหน้าที่ทั้งหมด</option>' + agentOptions.map(o => `<option value="${escapeQuotes(o.val)}">${o.label}</option>`).join('');
    if (cur) agentEl.value = cur;
  }
}

function setHelpdeskReportQuickRange(mode) {
  const startEl = document.getElementById("hdReportStartDate");
  const endEl = document.getElementById("hdReportEndDate");
  if (!startEl || !endEl) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const todayStr = getOffsetDate(0);

  if (mode === "all") {
    startEl.value = "";
    endEl.value = "";
  } else if (mode === "today") {
    startEl.value = todayStr;
    endEl.value = todayStr;
  } else if (mode === "7days") {
    startEl.value = getOffsetDate(-6);
    endEl.value = todayStr;
  } else if (mode === "thisMonth") {
    startEl.value = `${yyyy}-${mm}-01`;
    endEl.value = todayStr;
  } else if (mode === "thisYear") {
    startEl.value = `${yyyy}-01-01`;
    endEl.value = todayStr;
  }
  renderHelpdeskReport();
}

function resetHelpdeskReportFilters() {
  const ids = ["hdReportStartDate", "hdReportEndDate", "hdReportCategory", "hdReportSystemName", "hdReportPriority", "hdReportStatus", "hdReportDepartment", "hdReportAgent"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  renderHelpdeskReport();
}

function getFilteredHelpdeskReportTickets() {
  const startDate = document.getElementById("hdReportStartDate")?.value || "";
  const endDate = document.getElementById("hdReportEndDate")?.value || "";
  const cat = document.getElementById("hdReportCategory")?.value || "";
  const sysName = document.getElementById("hdReportSystemName")?.value || "";
  const prio = document.getElementById("hdReportPriority")?.value || "";
  const status = document.getElementById("hdReportStatus")?.value || "";
  const dept = document.getElementById("hdReportDepartment")?.value || "";
  const agent = document.getElementById("hdReportAgent")?.value || "";

  return (state.tickets || []).filter(t => {
    const createdDate = String(t.created_at || "").slice(0, 10);
    if (startDate && createdDate && createdDate < startDate) return false;
    if (endDate && createdDate && createdDate > endDate) return false;
    if (cat && t.category !== cat) return false;
    if (sysName && (t.system_name || "") !== sysName) return false;
    if (prio && t.priority !== prio) return false;
    if (status && t.status !== status) return false;
    if (dept && t.reporter_dept !== dept) return false;
    if (agent && !safeLower(t.assigned_agent).includes(safeLower(agent))) return false;
    return true;
  });
}

function isTicketSlaBreached(t, nowTs) {
  if (!t || !t.sla_target) return false;
  const compareTs = (t.status === "Resolved" || t.status === "Closed") && t.resolved_at ? t.resolved_at : nowTs;
  return compareTs > t.sla_target;
}

function renderHelpdeskReport() {
  populateHelpdeskReportFilterOptions();
  if (state.isInitialLoading) {
    const countBadge = document.getElementById("hdReportFilterCountBadge");
    if (countBadge) countBadge.innerText = "กำลังโหลด...";
    ["hdKpiTotal", "hdKpiResolved", "hdKpiActive", "hdKpiSlaRate", "hdKpiCsat"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = "...";
    });
    ["hdKpiResolvedRate", "hdKpiOpenSub", "hdKpiSlaBreached", "hdKpiCsatCount"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = "กำลังโหลดข้อมูล...";
    });
    ["hdSummaryByCategoryBody", "hdSummaryByPriorityBody", "hdSummaryByDeptBody", "hdSummaryByAgentBody"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดข้อมูลสรุปจากฐานข้อมูล...");
    });
    const tbody = document.getElementById("hdReportTableBody");
    if (tbody) tbody.innerHTML = getDatabaseLoadingRowHtml(8, "กำลังโหลดข้อมูลรายงานแจ้งซ่อมจากฐานข้อมูล...");
    return;
  }
  const filtered = getFilteredHelpdeskReportTickets();
  const nowTs = getLocalTimestamp(0);

  const countBadge = document.getElementById("hdReportFilterCountBadge");
  if (countBadge) countBadge.innerText = `${filtered.length} เคส`;

  const total = filtered.length;
  const resolvedList = filtered.filter(t => t.status === "Resolved" || t.status === "Closed");
  const openList = filtered.filter(t => t.status === "Open");
  const activeList = filtered.filter(t => t.status !== "Resolved" && t.status !== "Closed");
  const breachedList = filtered.filter(t => isTicketSlaBreached(t, nowTs));
  const csatList = filtered.filter(t => Number(t.csat_score) > 0);

  const resolvedRate = total > 0 ? Math.round((resolvedList.length / total) * 100) : 0;
  const slaCompliantRate = total > 0 ? Math.round(((total - breachedList.length) / total) * 100) : 100;
  const avgCsat = csatList.length > 0
    ? (csatList.reduce((acc, t) => acc + Number(t.csat_score || 0), 0) / csatList.length).toFixed(1)
    : "-";

  const elTotal = document.getElementById("hdKpiTotal");
  const elResolved = document.getElementById("hdKpiResolved");
  const elResolvedRate = document.getElementById("hdKpiResolvedRate");
  const elActive = document.getElementById("hdKpiActive");
  const elOpenSub = document.getElementById("hdKpiOpenSub");
  const elSlaRate = document.getElementById("hdKpiSlaRate");
  const elSlaBreached = document.getElementById("hdKpiSlaBreached");
  const elCsat = document.getElementById("hdKpiCsat");
  const elCsatCount = document.getElementById("hdKpiCsatCount");

  if (elTotal) elTotal.innerText = total;
  if (elResolved) elResolved.innerText = resolvedList.length;
  if (elResolvedRate) elResolvedRate.innerText = `อัตราสำเร็จ ${resolvedRate}%`;
  if (elActive) elActive.innerText = activeList.length;
  if (elOpenSub) elOpenSub.innerText = `รอรับเรื่อง ${openList.length} เคส`;
  if (elSlaRate) elSlaRate.innerText = `${slaCompliantRate}%`;
  if (elSlaBreached) elSlaBreached.innerText = `เกินกำหนด SLA ${breachedList.length} เคส`;
  if (elCsat) elCsat.innerText = avgCsat === "-" ? "-" : `${avgCsat} ⭐`;
  if (elCsatCount) elCsatCount.innerText = `จากผู้ประเมิน ${csatList.length} เคส`;

  // 1. Breakdown by Category & System Name
  const catBody = document.getElementById("hdSummaryByCategoryBody");
  if (catBody) {
    if (total === 0) {
      catBody.innerHTML = '<p class="text-center text-slate-400 py-6">ไม่มีข้อมูลในเงื่อนไขที่เลือก</p>';
    } else {
      const catMap = {};
      filtered.forEach(t => {
        const c = t.category || "ไม่ระบุหมวดหมู่";
        if (!catMap[c]) catMap[c] = { count: 0, resolved: 0, systems: {} };
        catMap[c].count++;
        if (t.status === "Resolved" || t.status === "Closed") catMap[c].resolved++;
        if (t.system_name) {
          catMap[c].systems[t.system_name] = (catMap[c].systems[t.system_name] || 0) + 1;
        }
      });
      const sortedCats = Object.entries(catMap).sort((a, b) => b[1].count - a[1].count);
      catBody.innerHTML = sortedCats.map(([cName, info]) => {
        const pct = Math.round((info.count / total) * 100);
        const sysEntries = Object.entries(info.systems).sort((a, b) => b[1] - a[1]);
        const sysSubHtml = sysEntries.length > 0
          ? `<div class="mt-1.5 pl-3 border-l-2 border-indigo-200 space-y-1">${sysEntries.map(([sName, sCnt]) => `<div class="flex items-center justify-between text-[11px] text-indigo-800 bg-indigo-50/70 px-2 py-0.5 rounded"><span>🌐 ${sName}</span><span class="font-bold">${sCnt} เคส</span></div>`).join("")}</div>`
          : "";
        return `
          <div class="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
            <div class="flex items-center justify-between font-semibold text-slate-800">
              <span class="truncate pr-2">${cName}</span>
              <span class="shrink-0 font-bold text-slate-900">${info.count} เคส (${pct}%)</span>
            </div>
            <div class="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${pct}%"></div>
            </div>
            ${sysSubHtml}
          </div>
        `;
      }).join("");
    }
  }

  // 2. Breakdown by Priority (Low -> Medium -> High -> Critical)
  const prioBody = document.getElementById("hdSummaryByPriorityBody");
  if (prioBody) {
    const prioOrder = [
      { key: "Low", label: "🟢 Low (ต่ำ - SLA 48 ชม.)", badge: "bg-emerald-100 text-emerald-800" },
      { key: "Medium", label: "🟡 Medium (ปานกลาง - SLA 24 ชม.)", badge: "bg-amber-100 text-amber-800" },
      { key: "High", label: "🟠 High (สูง - SLA 4 ชม.)", badge: "bg-orange-100 text-orange-800" },
      { key: "Critical", label: "🔴 Critical (วิกฤต - SLA 2 ชม.)", badge: "bg-rose-100 text-rose-800" }
    ];
    prioBody.innerHTML = prioOrder.map(p => {
      const list = filtered.filter(t => t.priority === p.key);
      const resCnt = list.filter(t => t.status === "Resolved" || t.status === "Closed").length;
      const breachCnt = list.filter(t => isTicketSlaBreached(t, nowTs)).length;
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
          <div>
            <span class="px-2 py-0.5 rounded text-[11px] font-bold ${p.badge}">${p.label}</span>
            <div class="text-[11px] text-slate-500 mt-1">ทั้งหมด <b>${list.length}</b> เคส</div>
          </div>
          <div class="text-right text-[11px]">
            <div class="text-emerald-700 font-bold">✓ สำเร็จ ${resCnt} เคส</div>
            <div class="${breachCnt > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}">⚠️ เกิน SLA ${breachCnt} เคส</div>
          </div>
        </div>
      `;
    }).join("");
  }

  // 3. Breakdown by Department
  const deptBody = document.getElementById("hdSummaryByDeptBody");
  if (deptBody) {
    if (total === 0) {
      deptBody.innerHTML = '<p class="text-center text-slate-400 py-6">ไม่มีข้อมูลในเงื่อนไขที่เลือก</p>';
    } else {
      const deptMap = {};
      filtered.forEach(t => {
        const d = t.reporter_dept || "ไม่ระบุฝ่าย/แผนก";
        deptMap[d] = (deptMap[d] || 0) + 1;
      });
      const sortedDepts = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
      deptBody.innerHTML = sortedDepts.map(([dName, cnt]) => {
        const pct = Math.round((cnt / total) * 100);
        return `
          <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <span class="font-medium text-slate-800 truncate pr-2">${dName}</span>
            <span class="shrink-0 font-bold text-tcc-700 bg-tcc-50 px-2.5 py-0.5 rounded-full text-[11px]">${cnt} เคส (${pct}%)</span>
          </div>
        `;
      }).join("");
    }
  }

  // 4. Breakdown by IT Agent
  const agentBody = document.getElementById("hdSummaryByAgentBody");
  if (agentBody) {
    if (total === 0) {
      agentBody.innerHTML = '<p class="text-center text-slate-400 py-6">ไม่มีข้อมูลในเงื่อนไขที่เลือก</p>';
    } else {
      const agMap = {};
      filtered.forEach(t => {
        const ag = t.assigned_agent || "ยังไม่มอบหมาย";
        if (!agMap[ag]) agMap[ag] = { total: 0, resolved: 0, csatSum: 0, csatCnt: 0 };
        agMap[ag].total++;
        if (t.status === "Resolved" || t.status === "Closed") agMap[ag].resolved++;
        if (Number(t.csat_score) > 0) {
          agMap[ag].csatSum += Number(t.csat_score);
          agMap[ag].csatCnt++;
        }
      });
      const sortedAgents = Object.entries(agMap).sort((a, b) => b[1].total - a[1].total);
      agentBody.innerHTML = sortedAgents.map(([agName, st]) => {
        const avg = st.csatCnt > 0 ? (st.csatSum / st.csatCnt).toFixed(1) + " ⭐" : "-";
        return `
          <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <div class="min-w-0 pr-2">
              <div class="font-semibold text-slate-800 truncate">${agName}</div>
              <div class="text-[10px] text-slate-400">คะแนนประเมินเฉลี่ย: ${avg}</div>
            </div>
            <div class="text-right shrink-0 text-[11px]">
              <span class="font-bold text-slate-900">${st.total} เคส</span>
              <span class="text-emerald-700 font-semibold block">ปิดแล้ว ${st.resolved} เคส</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // 5. Detailed Filtered Table (Single-line cells, no text wrapping, fits <= 888px)
  const tbody = document.getElementById("hdReportTableBody");
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400 text-xs whitespace-nowrap">ไม่พบรายการแจ้งซ่อมที่ตรงกับเงื่อนไขการดึงรายงาน</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(t => {
        const breached = isTicketSlaBreached(t, nowTs);
        let prioBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">Low</span>`;
        if (t.priority === "Medium") prioBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">Medium</span>`;
        if (t.priority === "High") prioBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 whitespace-nowrap">High</span>`;
        if (t.priority === "Critical") prioBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 whitespace-nowrap">Critical</span>`;

        const catDisplay = t.system_name
          ? `<span class="text-indigo-700 font-semibold">🌐 ${t.system_name}</span>`
          : `<span class="text-slate-700">${t.category || '-'}</span>`;
        const catTooltip = t.system_name
          ? `${t.category || '-'} • ${t.system_name}`
          : (t.category || '-');
        const agentShort = t.assigned_agent && t.assigned_agent.includes("@")
          ? t.assigned_agent.split("@")[0]
          : (t.assigned_agent || "-");
        const reporterTooltip = `${t.reporter_name || '-'} (${t.reporter_dept || '-'})`;

        return `
          <tr class="hover:bg-slate-50/90 transition whitespace-nowrap text-xs">
            <td class="py-2.5 px-2 whitespace-nowrap">
              <button type="button" onclick="openTicketDetailModal('${escapeQuotes(t.ticket_id)}')" class="font-mono font-bold text-[11px] text-tcc-700 hover:underline whitespace-nowrap" title="วันที่แจ้ง: ${escapeQuotes(t.created_at || '-')}">${t.ticket_id}</button>
            </td>
            <td class="py-2.5 px-2 whitespace-nowrap">
              <div class="max-w-[110px] xl:max-w-[190px] 2xl:max-w-[260px] truncate text-[11px]" title="${escapeQuotes(catTooltip)}">${catDisplay}</div>
            </td>
            <td class="py-2.5 px-2 whitespace-nowrap">
              <div class="max-w-[130px] xl:max-w-[240px] 2xl:max-w-[340px] truncate font-medium text-slate-900" title="${escapeQuotes(t.title)}">${t.title}</div>
            </td>
            <td class="py-2.5 px-2 whitespace-nowrap">
              <div class="max-w-[100px] xl:max-w-[180px] 2xl:max-w-[260px] truncate text-[11px] font-medium text-slate-800" title="${escapeQuotes(reporterTooltip)}">${t.reporter_name || '-'} <span class="text-slate-400 font-normal">(${t.reporter_dept || '-'})</span></div>
            </td>
            <td class="py-2.5 px-1.5 text-center whitespace-nowrap">${prioBadge}</td>
            <td class="py-2.5 px-1.5 text-center font-bold text-[11px] text-slate-700 whitespace-nowrap">${t.status}</td>
            <td class="py-2.5 px-2 whitespace-nowrap">
              <div class="max-w-[78px] xl:max-w-[140px] 2xl:max-w-none truncate text-[11px] text-slate-600 font-mono" title="${escapeQuotes(t.assigned_agent || '-')}">${agentShort}</div>
            </td>
            <td class="py-2.5 px-2 text-center text-[11px] whitespace-nowrap">
              <span class="whitespace-nowrap">${breached ? '<span class="text-rose-600 font-bold">⚠️ เกิน SLA</span>' : '<span class="text-emerald-700 font-semibold">✓ ปกติ</span>'}${Number(t.csat_score) > 0 ? ` <span class="text-amber-600 font-bold text-[10px]">(${t.csat_score}★)</span>` : ''}</span>
            </td>
          </tr>
        `;
      }).join("");
    }
  }
}

function exportHelpdeskReportCsv() {
  const list = getFilteredHelpdeskReportTickets();
  if (list.length === 0) {
    return showNotification("ไม่มีข้อมูลเคสแจ้งซ่อมตามเงื่อนไขที่เลือกสำหรับส่งออก", "warning");
  }
  const nowTs = getLocalTimestamp(0);
  const headers = [
    "รหัสเคส (Ticket ID)",
    "วันที่แจ้ง (Created At)",
    "หมวดหมู่ปัญหา (Category)",
    "ชื่อระบบสารสนเทศ/เว็บไซต์ (System Name)",
    "หัวข้อปัญหา (Title)",
    "รายละเอียด (Description)",
    "ระดับความสำคัญ (Priority)",
    "สถานะ (Status)",
    "ผู้แจ้ง (Reporter)",
    "ฝ่าย/แผนก (Department)",
    "ช่องทางติดต่อ (Contact)",
    "ผู้รับผิดชอบ (Assigned Agent)",
    "กำหนดเวลา SLA (SLA Target)",
    "วันที่แก้ไขเสร็จ (Resolved At)",
    "ผลประเมิน SLA",
    "คะแนนความพึงพอใจ (CSAT)",
    "ข้อเสนอแนะ (CSAT Feedback)"
  ];

  const rows = list.map(t => {
    const slaResult = isTicketSlaBreached(t, nowTs) ? "เกินกำหนด SLA" : "ผ่านเกณฑ์ SLA";
    return [
      t.ticket_id || "",
      t.created_at || "",
      t.category || "",
      t.system_name || "-",
      t.title || "",
      t.description || "",
      t.priority || "",
      t.status || "",
      t.reporter_name || "",
      t.reporter_dept || "",
      t.reporter_contact || "",
      t.assigned_agent || "",
      t.sla_target || "",
      t.resolved_at || "-",
      slaResult,
      t.csat_score > 0 ? t.csat_score : "-",
      t.csat_feedback || "-"
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tcc_helpdesk_tickets_report_${getOffsetDate(0)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showNotification(`ส่งออกรายงานข้อมูลเคสละเอียด (${list.length} เคส) เรียบร้อย`, "success");
}

function exportHelpdeskSummaryCsv() {
  const list = getFilteredHelpdeskReportTickets();
  if (list.length === 0) {
    return showNotification("ไม่มีข้อมูลสำหรับสรุปผลตามเงื่อนไขที่เลือก", "warning");
  }
  const nowTs = getLocalTimestamp(0);
  const total = list.length;
  const resolved = list.filter(t => t.status === "Resolved" || t.status === "Closed").length;
  const active = total - resolved;
  const breached = list.filter(t => isTicketSlaBreached(t, nowTs)).length;
  const slaRate = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;
  const csatTickets = list.filter(t => Number(t.csat_score) > 0);
  const avgCsat = csatTickets.length > 0
    ? (csatTickets.reduce((s, t) => s + Number(t.csat_score), 0) / csatTickets.length).toFixed(2)
    : "-";

  const lines = [];
  const row = arr => arr.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");

  lines.push(row(["รายงานสรุปผลการดำเนินงานบริการไอที (IT Helpdesk Executive Summary)", `วันที่ออกรายงาน: ${getLocalTimestamp(0)}`]));
  lines.push("");
  lines.push(row(["1. ภาพรวมตัวชี้วัดหลัก (KPI Summary)", "ค่าสถิติ"]));
  lines.push(row(["จำนวนเคสแจ้งซ่อมทั้งหมด", `${total} เคส`]));
  lines.push(row(["แก้ไขเสร็จสิ้น (Resolved / Closed)", `${resolved} เคส (${total ? Math.round((resolved / total) * 100) : 0}%)`]));
  lines.push(row(["กำลังดำเนินการ / รอดำเนินการ", `${active} เคส`]));
  lines.push(row(["อัตราผ่านเกณฑ์ SLA", `${slaRate}% (เกิน SLA ${breached} เคส)`]));
  lines.push(row(["คะแนนความพึงพอใจเฉลี่ย (CSAT)", `${avgCsat} / 5.00 (จาก ${csatTickets.length} เคส)`]));
  lines.push("");

  lines.push(row(["2. สรุปแยกตามระดับความสำคัญ (น้อย -> สูง)", "จำนวนทั้งหมด", "แก้ไขสำเร็จ", "เกินกำหนด SLA"]));
  ["Low", "Medium", "High", "Critical"].forEach(p => {
    const sub = list.filter(t => t.priority === p);
    const subRes = sub.filter(t => t.status === "Resolved" || t.status === "Closed").length;
    const subBreach = sub.filter(t => isTicketSlaBreached(t, nowTs)).length;
    lines.push(row([p, sub.length, subRes, subBreach]));
  });
  lines.push("");

  lines.push(row(["3. สรุปแยกตามหมวดหมู่ปัญหา", "จำนวนเคส", "สัดส่วน (%)", "แก้ไขสำเร็จ"]));
  const catMap = {};
  list.forEach(t => {
    const c = t.category || "ไม่ระบุ";
    if (!catMap[c]) catMap[c] = { total: 0, res: 0 };
    catMap[c].total++;
    if (t.status === "Resolved" || t.status === "Closed") catMap[c].res++;
  });
  Object.entries(catMap).sort((a, b) => b[1].total - a[1].total).forEach(([c, st]) => {
    lines.push(row([c, st.total, `${Math.round((st.total / total) * 100)}%`, st.res]));
  });
  lines.push("");

  lines.push(row(["4. สรุปแยกตามชื่อระบบสารสนเทศภายใน / เว็บไซต์", "จำนวนเคส", "แก้ไขสำเร็จ"]));
  const sysMap = {};
  list.filter(t => t.system_name).forEach(t => {
    const s = t.system_name;
    if (!sysMap[s]) sysMap[s] = { total: 0, res: 0 };
    sysMap[s].total++;
    if (t.status === "Resolved" || t.status === "Closed") sysMap[s].res++;
  });
  if (Object.keys(sysMap).length === 0) {
    lines.push(row(["ไม่มีเคสหมวดระบบสารสนเทศภายในในช่วงเวลานี้", 0, 0]));
  } else {
    Object.entries(sysMap).sort((a, b) => b[1].total - a[1].total).forEach(([s, st]) => {
      lines.push(row([s, st.total, st.res]));
    });
  }
  lines.push("");

  lines.push(row(["5. สรุปแยกตามฝ่าย / แผนกผู้แจ้ง", "จำนวนเคส"]));
  const deptMap = {};
  list.forEach(t => {
    const d = t.reporter_dept || "ไม่ระบุ";
    deptMap[d] = (deptMap[d] || 0) + 1;
  });
  Object.entries(deptMap).sort((a, b) => b[1] - a[1]).forEach(([d, cnt]) => {
    lines.push(row([d, cnt]));
  });

  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tcc_helpdesk_executive_summary_${getOffsetDate(0)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showNotification("ส่งออกตารางสรุปผลงานบริการไอที (CSV/Excel) เรียบร้อย", "success");
}

function printHelpdeskSummaryReport() {
  window.print();
}

/* TICKET CATEGORY MANAGEMENT */
