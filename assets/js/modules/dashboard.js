function renderMonthlyDashboard() {
  const yearSelect = document.getElementById("dashboardYearSelect");
  const currentYear = new Date().getFullYear();

  if (yearSelect && yearSelect.options.length === 0) {
    for (let y = currentYear; y >= currentYear - 3; y--) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.innerText = `พ.ศ. ${y + 543} (${y})`;
      if (y === currentYear) opt.selected = true;
      yearSelect.appendChild(opt);
    }
  }

  if (state.isInitialLoading) {
    ["kpiActiveTickets", "kpiSlaComplianceRate", "kpiMttrHours", "kpiCsatAverage", "kpiCurrentActiveBorrows", "kpiOverdueCount"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = "...";
    });
    const kpiCsatCount = document.getElementById("kpiCsatCount");
    if (kpiCsatCount) kpiCsatCount.innerText = "กำลังโหลดข้อมูล...";
    const kpiTotalItemsSub = document.getElementById("kpiTotalItemsSub");
    if (kpiTotalItemsSub) kpiTotalItemsSub.innerText = "กำลังโหลดข้อมูล...";
    const catContainer = document.getElementById("categoryProgressContainer");
    if (catContainer) catContainer.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดสถิติหมวดหมู่เคสแจ้งซ่อม...");
    const topDeptTbody = document.getElementById("topDeptTableBody");
    if (topDeptTbody) topDeptTbody.innerHTML = getDatabaseLoadingRowHtml(3, "กำลังโหลดสถิติฝ่าย/แผนก...");
    const watchlistContainer = document.getElementById("slaWatchlistContainer");
    if (watchlistContainer) watchlistContainer.innerHTML = getDatabaseLoadingBlockHtml("กำลังโหลดรายการเฝ้าระวัง SLA...");
    return;
  }

  const selectedYear = yearSelect ? parseInt(yearSelect.value, 10) : currentYear;

  const activeTickets = state.tickets.filter(t => t.status === "Open" || t.status === "In Progress");
  document.getElementById("kpiActiveTickets").innerText = activeTickets.length;

  const resolvedOrClosed = state.tickets.filter(t => t.status === "Resolved" || t.status === "Closed");
  let onTimeTicketCount = 0;
  let totalResolutionHours = 0;
  let ratedTicketsCount = 0;
  let sumCsat = 0;

  resolvedOrClosed.forEach(t => {
    const resolvedTime = t.resolved_at || t.created_at;
    if (resolvedTime <= t.sla_target) onTimeTicketCount++;
    
    const diffMs = new Date(resolvedTime.replace(" ", "T")) - new Date(t.created_at.replace(" ", "T"));
    if (!isNaN(diffMs) && diffMs > 0) totalResolutionHours += diffMs / 3600000;
    
    if (t.csat_score && t.csat_score > 0) {
      sumCsat += t.csat_score;
      ratedTicketsCount++;
    }
  });

  const slaRate = resolvedOrClosed.length > 0 ? Math.round((onTimeTicketCount / resolvedOrClosed.length) * 100) : 100;
  document.getElementById("kpiSlaComplianceRate").innerText = `${slaRate}%`;

  const mttr = resolvedOrClosed.length > 0 ? (totalResolutionHours / resolvedOrClosed.length).toFixed(1) : "1.8";
  document.getElementById("kpiMttrHours").innerText = mttr;

  const csatAvg = ratedTicketsCount > 0 ? (sumCsat / ratedTicketsCount).toFixed(1) : "5.0";
  document.getElementById("kpiCsatAverage").innerText = csatAvg;
  document.getElementById("kpiCsatCount").innerText = `จาก ${ratedTicketsCount} การประเมิน`;

  const today = getOffsetDate(0);
  const overdueBorrows = state.activeBorrows.filter(b => b.expected_return && b.expected_return < today);
  document.getElementById("kpiCurrentActiveBorrows").innerText = state.activeBorrows.length;
  document.getElementById("kpiTotalItemsSub").innerText = `จากทั้งหมด ${state.items.length} ชิ้น`;
  document.getElementById("kpiOverdueCount").innerText = overdueBorrows.length;

  const monthlyData = [];
  const monthlyTicketData = [];
  for (let m = 0; m < 12; m++) {
    monthlyData.push({ monthIndex: m, monthName: THAI_MONTHS[m], users: new Set(), borrows: 0 });
    monthlyTicketData.push({ monthIndex: m, monthName: THAI_MONTHS[m], total: 0, resolved: 0 });
  }

  state.allLogs.forEach(l => {
    const dStr = l.borrow_date || (l.timestamp ? l.timestamp.split(' ')[0] : "");
    if (!dStr) return;
    const p = dStr.split('-');
    if (p.length >= 2 && parseInt(p[0], 10) === selectedYear) {
      const mIdx = parseInt(p[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        monthlyData[mIdx].users.add(l.borrower_contact || l.borrower_name);
        monthlyData[mIdx].borrows += 1;
      }
    }
  });

  let yearTicketTotal = 0;
  let yearTicketResolved = 0;
  (state.tickets || []).forEach(t => {
    const dStr = t.created_at ? String(t.created_at).split(' ')[0] : "";
    if (!dStr) return;
    const p = dStr.split('-');
    if (p.length >= 2 && parseInt(p[0], 10) === selectedYear) {
      const mIdx = parseInt(p[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        monthlyTicketData[mIdx].total += 1;
        yearTicketTotal += 1;
        if (t.status === "Resolved" || t.status === "Closed") {
          monthlyTicketData[mIdx].resolved += 1;
          yearTicketResolved += 1;
        }
      }
    }
  });

  const maxVal = Math.max(5, ...monthlyData.map(d => Math.max(d.users.size, d.borrows)));
  const chartBars = document.getElementById("monthlyChartBarsContainer");
  if (chartBars) {
    chartBars.innerHTML = monthlyData.map(d => {
      const uH = Math.max(Math.round((d.users.size / maxVal) * 100), 5);
      const bH = Math.max(Math.round((d.borrows / maxVal) * 100), 5);
      return `
        <div class="flex-1 flex flex-col items-center justify-end h-full">
          <div class="w-full flex items-end justify-center gap-1 h-36">
            <div style="height: ${uH}%;" class="w-1/2 max-w-[14px] bg-tcc-600 rounded-t relative flex justify-center" title="${d.monthName}: ผู้ยืม ${d.users.size} คน">
              ${d.users.size > 0 ? `<span class="text-[8px] text-white -mt-3.5 font-bold">${d.users.size}</span>` : ''}
            </div>
            <div style="height: ${bH}%;" class="w-1/2 max-w-[14px] bg-amber-400 rounded-t relative flex justify-center" title="${d.monthName}: ยืม ${d.borrows} ครั้ง">
              ${d.borrows > 0 ? `<span class="text-[8px] text-amber-950 -mt-3.5 font-bold">${d.borrows}</span>` : ''}
            </div>
          </div>
          <span class="text-[10px] text-slate-500 mt-1">${d.monthName}</span>
        </div>
      `;
    }).join("");
  }

  const ticketYearBadge = document.getElementById("monthlyTicketYearTotalBadge");
  if (ticketYearBadge) {
    ticketYearBadge.innerText = `รวม ${yearTicketTotal} เคส (ปิดแล้ว ${yearTicketResolved})`;
  }

  const maxTicketVal = Math.max(5, ...monthlyTicketData.map(d => Math.max(d.total, d.resolved)));
  const ticketChartBars = document.getElementById("monthlyTicketChartBarsContainer");
  if (ticketChartBars) {
    ticketChartBars.innerHTML = monthlyTicketData.map(d => {
      const tH = Math.max(Math.round((d.total / maxTicketVal) * 100), 5);
      const rH = Math.max(Math.round((d.resolved / maxTicketVal) * 100), 5);
      return `
        <div class="flex-1 flex flex-col items-center justify-end h-full">
          <div class="w-full flex items-end justify-center gap-1 h-36">
            <div style="height: ${tH}%;" class="w-1/2 max-w-[14px] bg-rose-500 rounded-t relative flex justify-center" title="${d.monthName}: แจ้งซ่อม ${d.total} เคส">
              ${d.total > 0 ? `<span class="text-[8px] text-rose-700 -mt-3.5 font-bold">${d.total}</span>` : ''}
            </div>
            <div style="height: ${rH}%;" class="w-1/2 max-w-[14px] bg-emerald-500 rounded-t relative flex justify-center" title="${d.monthName}: แก้ไข/ปิดเคสแล้ว ${d.resolved} เคส">
              ${d.resolved > 0 ? `<span class="text-[8px] text-emerald-700 -mt-3.5 font-bold">${d.resolved}</span>` : ''}
            </div>
          </div>
          <span class="text-[10px] text-slate-500 mt-1">${d.monthName}</span>
        </div>
      `;
    }).join("");
  }

  const catCount = {};
  state.tickets.forEach(t => { catCount[t.category] = (catCount[t.category] || 0) + 1; });
  const catContainer = document.getElementById("categoryProgressContainer");
  document.getElementById("ticketTotalSummaryBadge").innerText = `รวม ${state.tickets.length} เคส`;
  if (catContainer) {
    const totalT = Math.max(state.tickets.length, 1);
    catContainer.innerHTML = Object.entries(catCount).map(([cName, count]) => {
      const pct = Math.round((count / totalT) * 100);
      return `
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span class="font-medium text-slate-700">${cName}</span>
            <span class="font-bold text-slate-900">${count} เคส (${pct}%)</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div class="bg-tcc-600 h-2 rounded-full" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  const deptActivity = {};
  state.allLogs.forEach(l => {
    if (l.borrower_dept) {
      if (!deptActivity[l.borrower_dept]) deptActivity[l.borrower_dept] = { borrows: 0, tickets: 0 };
      deptActivity[l.borrower_dept].borrows++;
    }
  });
  state.tickets.forEach(t => {
    if (t.reporter_dept) {
      if (!deptActivity[t.reporter_dept]) deptActivity[t.reporter_dept] = { borrows: 0, tickets: 0 };
      deptActivity[t.reporter_dept].tickets++;
    }
  });

  const topDepts = Object.entries(deptActivity)
    .map(([dept, v]) => ({ dept, ...v, total: v.borrows + v.tickets }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const topDeptTbody = document.getElementById("topDeptTableBody");
  if (topDeptTbody) {
    topDeptTbody.innerHTML = topDepts.map(d => `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-2 px-3 font-medium text-slate-800">${d.dept}</td>
        <td class="py-2 px-3 text-center font-bold text-tcc-700">${d.borrows}</td>
        <td class="py-2 px-3 text-center font-bold text-rose-600">${d.tickets}</td>
      </tr>
    `).join("");
  }

  const nowTs = getLocalTimestamp();
  const openT = state.tickets.filter(t => t.status === "Open" || t.status === "In Progress");
  const watchlistContainer = document.getElementById("slaWatchlistContainer");
  if (watchlistContainer) {
    if (openT.length === 0) {
      watchlistContainer.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">ไม่มีเคสค้างที่ต้องเฝ้าระวัง 🎉</p>';
    } else {
      watchlistContainer.innerHTML = openT.map(t => {
        const isBreached = t.sla_target < nowTs;
        return `
          <div onclick="openTicketDetailModal('${t.ticket_id}')" class="p-2.5 rounded-xl border ${isBreached ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-slate-50'} hover:border-tcc-400 cursor-pointer flex items-center justify-between transition">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-xs font-bold ${isBreached ? 'text-rose-700' : 'text-slate-700'}">${t.ticket_id}</span>
                <span class="text-xs font-medium text-slate-900 truncate max-w-[200px]">${t.title}</span>
              </div>
              <span class="text-[10px] text-slate-400">${t.reporter_name} (${t.reporter_dept})</span>
            </div>
            <div class="text-right">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isBreached ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}">
                ${isBreached ? '⚠️ หลุด SLA' : '⏳ ใกล้ครบกำหนด'}
              </span>
              <p class="text-[10px] text-slate-400 mt-0.5">${t.sla_target.split(' ')[1]} น.</p>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

/* TICKETING & HELPDESK LOGIC */
/* ATTACHMENT & GOOGLE DRIVE STORAGE HELPERS (Req 1 & Req 2) */
