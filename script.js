/* =====================================================================
   MBM ENTERPRISE — App Logic
   ⚠️ SECURITY NOTE: Telegram Bot Token is embedded below because this is
   a purely static (client-side) site hosted on GitHub Pages. Anyone who
   views this repository's source code (public repos!) can see the token
   and chat ID. Keep this repository PRIVATE, or anyone could send junk
   to your bot / read backups sent to that chat. For real protection,
   move backup sending behind a small serverless function later.
===================================================================== */

const TELEGRAM_BOT_TOKEN = "8831608943:AAHGij4u-nJFRWCyNWe15m6FNqz0WNEHtfs";
const TELEGRAM_CHAT_ID   = "7611072559";
const TG_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}`;

const STORAGE_KEY = "mbm_data_v1";
const EN_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ---------------------------------------------------------------------
   DATA LAYER
--------------------------------------------------------------------- */
function defaultData(){
  return {
    settings:{ businessName:"MBM ENTERPRISE", autoBackup:true, darkMode:false },
    employees:[],                 // {id,name,phone,salaryType,monthlyAmount,dailyRate}
    employeePayments:{},          // { empId: { "YYYY-MM": { workingDays:0, payments:[{date,amount,note}] } } }
    attendance:{},                // { empId: { "YYYY-MM-DD": "present"|"halfday"|"absent" } }
    godawnRent:{},                // { "YYYY-MM": { amount:0, payments:[{date,amount,note}] } }
    electricity:{},               // { "YYYY-MM": { billAmount:0, payments:[{date,amount,note}] } }
    others:{},                    // { "YYYY-MM": [ {id,title,amount,date,note} ] }
    godawnPurchases:{},           // { "YYYY-MM": [ {id,itemName,party,quantity,unit,rate,amount,date,note} ] }
    godawnSales:{}                // { "YYYY-MM": [ {id,itemName,party,quantity,unit,rate,amount,date,note} ] }
  };
}

let DATA = loadData();

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return { ...defaultData(), ...parsed };
  }catch(e){
    console.error("Load Error:", e);
    return defaultData();
  }
}

function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function todayYM(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function ymLabel(ym){
  const [y,m] = ym.split("-").map(Number);
  return `${EN_MONTHS[m-1]} ${y}`;
}
function fmtMoney(n){
  n = Math.round(n || 0);
  return "Tk " + n.toLocaleString("en-IN");
}
function todayISO(){ return new Date().toISOString().slice(0,10); }

/* Build list of last 12 months + next month, most recent first */
function getMonthOptions(){
  const opts = [];
  const now = new Date();
  for(let i=1;i>=-11;i--){
    const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  return opts;
}

/* ---------------------------------------------------------------------
   TOAST
--------------------------------------------------------------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.add("hidden"), 2600);
}

/* ---------------------------------------------------------------------
   MODAL
--------------------------------------------------------------------- */
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");

function openModal(title, bodyHTML){
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modalOverlay.classList.remove("hidden");
}
function closeModal(){
  modalOverlay.classList.add("hidden");
  modalBody.innerHTML = "";
}
document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e)=>{ if(e.target === modalOverlay) closeModal(); });

/* ---------------------------------------------------------------------
   NAVIGATION
--------------------------------------------------------------------- */
const views = ["home","employees","expenses","godawn","settings"];
const navItems = document.querySelectorAll(".nav-item");
const navIndicator = document.getElementById("navIndicator");
const islandNavEl = document.getElementById("islandNav");

/* Pixel-perfect indicator: measures the actual active button instead of
   assuming a fixed percentage width, so it always fits correctly no
   matter how many nav items exist or how wide their labels are. */
function updateNavIndicator(){
  const activeBtn = document.querySelector(".nav-item.active");
  if(!activeBtn) return;
  const navRect = islandNavEl.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  navIndicator.style.width = btnRect.width + "px";
  navIndicator.style.transform = `translateX(${btnRect.left - navRect.left}px)`;
}

function goToView(name){
  views.forEach(v=>{
    document.getElementById(`view-${v}`).classList.toggle("hidden", v!==name);
  });
  navItems.forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.view === name);
  });
  updateNavIndicator();
  if(name==="home") refreshHome();
  if(name==="employees") refreshEmployees();
  if(name==="expenses") refreshExpensesActiveTab();
  if(name==="godawn") refreshGodawnActiveTab();
  window.scrollTo({top:0, behavior:"smooth"});
}

navItems.forEach(btn=>{
  btn.addEventListener("click", ()=> goToView(btn.dataset.view));
});
document.querySelectorAll("[data-nav]").forEach(btn=>{
  btn.addEventListener("click", ()=> goToView(btn.dataset.nav));
});
window.addEventListener("resize", updateNavIndicator);
window.addEventListener("load", updateNavIndicator);

/* ---------------------------------------------------------------------
   THEME (DARK MODE)
--------------------------------------------------------------------- */
function applyTheme(){
  document.documentElement.setAttribute("data-theme", DATA.settings.darkMode ? "dark" : "light");
  document.getElementById("darkModeToggle").checked = DATA.settings.darkMode;
  const icon = document.getElementById("topThemeIcon");
  if(icon){
    icon.innerHTML = DATA.settings.darkMode
      ? '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
}
document.getElementById("darkModeToggle").addEventListener("change", (e)=>{
  DATA.settings.darkMode = e.target.checked;
  saveData();
  applyTheme();
});
document.getElementById("topDarkToggle").addEventListener("click", ()=>{
  DATA.settings.darkMode = !DATA.settings.darkMode;
  saveData();
  applyTheme();
});

/* =======================================================================
   HOME
======================================================================= */
function refreshHome(){
  const ym = todayYM();
  document.getElementById("homeDateLine").textContent = new Date().toLocaleDateString("en-US", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
  document.getElementById("homeMonthPill").textContent = ymLabel(ym);

  document.getElementById("statEmployeeCount").textContent = DATA.employees.length;

  // Salary due this month
  let totalDue = 0, totalPaidSalary = 0;
  DATA.employees.forEach(emp=>{
    const info = getEmployeeMonthInfo(emp.id, ym);
    if(info.balance > 0) totalDue += info.balance;
    totalPaidSalary += info.paid;
  });
  document.getElementById("statSalaryDue").textContent = fmtMoney(totalDue);

  // Rent status
  const rent = DATA.godawnRent[ym] || {amount:0, payments:[]};
  const rentPaid = sumPayments(rent.payments);
  const rentDue = (rent.amount||0) - rentPaid;
  document.getElementById("statRentStatus").textContent = rent.amount ? (rentDue<=0 ? "Paid" : fmtMoney(rentDue)+" Due") : "Not Set";
  document.getElementById("rentStatusIcon").classList.toggle("txt-danger", rentDue>0);

  // Electricity status
  const elec = DATA.electricity[ym] || {billAmount:0, payments:[]};
  const elecPaid = sumPayments(elec.payments);
  const elecDue = (elec.billAmount||0) - elecPaid;
  document.getElementById("statElecStatus").textContent = elec.billAmount ? (elecDue<=0 ? "Paid" : fmtMoney(elecDue)+" Due") : "Not Set";
  document.getElementById("elecStatusIcon").classList.toggle("txt-danger", elecDue>0);

  // Others total
  const othersTotal = (DATA.others[ym]||[]).reduce((s,o)=>s+Number(o.amount||0),0);

  document.getElementById("sumSalaryPaid").textContent = fmtMoney(totalPaidSalary);
  document.getElementById("sumRentPaid").textContent = fmtMoney(rentPaid);
  document.getElementById("sumElecPaid").textContent = fmtMoney(elecPaid);
  document.getElementById("sumOthersPaid").textContent = fmtMoney(othersTotal);
  document.getElementById("sumTotalAll").textContent = fmtMoney(totalPaidSalary+rentPaid+elecPaid+othersTotal);
}
document.getElementById("qaBackupNow").addEventListener("click", ()=> sendBackupToTelegram(false));

/* =======================================================================
   EMPLOYEES
======================================================================= */
function sumPayments(payments){
  return (payments||[]).reduce((s,p)=>s+Number(p.amount||0),0);
}

function getEmployeeMonthInfo(empId, ym){
  const rec = (DATA.employeePayments[empId] && DATA.employeePayments[empId][ym]) || {workingDays:0, payments:[]};
  const emp = DATA.employees.find(e=>e.id===empId);
  let earned = 0;
  if(emp){
    earned = emp.salaryType === "monthly" ? Number(emp.monthlyAmount||0) : Number(emp.dailyRate||0) * Number(rec.workingDays||0);
  }
  const paid = sumPayments(rec.payments);
  return { earned, paid, balance: earned - paid, workingDays: rec.workingDays||0, payments: rec.payments||[] };
}

function ensureEmpMonthRec(empId, ym){
  if(!DATA.employeePayments[empId]) DATA.employeePayments[empId] = {};
  if(!DATA.employeePayments[empId][ym]) DATA.employeePayments[empId][ym] = {workingDays:0, payments:[]};
  return DATA.employeePayments[empId][ym];
}

function populateMonthSelect(selectEl, keepValue){
  const opts = getMonthOptions();
  const current = keepValue || selectEl.value || todayYM();
  selectEl.innerHTML = opts.map(ym=>`<option value="${ym}">${ymLabel(ym)}</option>`).join("");
  selectEl.value = opts.includes(current) ? current : todayYM();
}

const empMonthSelect = document.getElementById("empMonthSelect");
populateMonthSelect(empMonthSelect);
empMonthSelect.addEventListener("change", refreshEmployees);

const empSearchInput = document.getElementById("empSearchInput");
empSearchInput.addEventListener("input", refreshEmployees);

function refreshEmployees(){
  const ym = empMonthSelect.value || todayYM();
  const list = document.getElementById("employeeList");
  const emptyHint = document.getElementById("employeeEmptyHint");
  const search = (empSearchInput.value||"").trim().toLowerCase();

  if(DATA.employees.length===0){
    list.innerHTML = "";
    emptyHint.classList.remove("hidden");
    emptyHint.textContent = "No employees added. Click the \"+ New\" button above.";
    document.getElementById("empTotalDue").textContent = "Tk 0";
    document.getElementById("empTotalAdvance").textContent = "Tk 0";
    return;
  }

  const filteredEmployees = DATA.employees.filter(emp=>
    !search || emp.name.toLowerCase().includes(search) || (emp.phone||"").toLowerCase().includes(search)
  );

  if(filteredEmployees.length===0){
    list.innerHTML = "";
    emptyHint.classList.remove("hidden");
    emptyHint.textContent = "No employees matched your search.";
    document.getElementById("empTotalDue").textContent = "Tk 0";
    document.getElementById("empTotalAdvance").textContent = "Tk 0";
    return;
  }
  emptyHint.classList.add("hidden");

  let totalDue=0, totalAdvance=0;
  list.innerHTML = filteredEmployees.map(emp=>{
    const info = getEmployeeMonthInfo(emp.id, ym);
    if(info.balance>0) totalDue += info.balance; else totalAdvance += Math.abs(info.balance);

    let badge;
    if(info.balance>0) badge = `<span class="badge badge-due">Due ${fmtMoney(info.balance)}</span>`;
    else if(info.balance<0) badge = `<span class="badge badge-advance">Advance ${fmtMoney(Math.abs(info.balance))}</span>`;
    else badge = `<span class="badge badge-settled">Paid</span>`;

    const salaryTypeLabel = emp.salaryType === "monthly" ? "Monthly" : `Daily (${info.workingDays} days)`;

    return `
    <div class="list-item">
      <div class="li-top">
        <div>
          <div class="li-title">${escapeHTML(emp.name)}</div>
          <div class="li-sub">${escapeHTML(emp.phone||"No Number")} · ${salaryTypeLabel}</div>
        </div>
        ${badge}
      </div>
      <div class="li-sub" style="margin-top:6px;">Earned: <strong>${fmtMoney(info.earned)}</strong> · Paid: <strong>${fmtMoney(info.paid)}</strong></div>
<div class="li-actions">
  <button class="act-pay" onclick="openPaySalaryModal('${emp.id}')">💰 Pay</button>
        ${emp.salaryType==='daily' ? `<button onclick="openWorkingDaysModal('${emp.id}')">📅 Work Days</button>` : ""}
        <button onclick="openEmployeeHistoryModal('${emp.id}')">📜 History</button>
        <button onclick="openEditEmployeeModal('${emp.id}')">✏️ Edit</button>
        <button class="act-del" onclick="deleteEmployee('${emp.id}')">🗑️ Delete</button>
      </div>
    </div>`;
  }).join("");

  document.getElementById("empTotalDue").textContent = fmtMoney(totalDue);
  document.getElementById("empTotalAdvance").textContent = fmtMoney(totalAdvance);
}

function escapeHTML(str){
  return String(str||"").replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

document.getElementById("addEmployeeBtn").addEventListener("click", ()=> openEditEmployeeModal(null));

function openEditEmployeeModal(empId){
  const emp = empId ? DATA.employees.find(e=>e.id===empId) : null;
  openModal(emp ? "Edit Employee" : "Add New Employee", `
    <label class="field-label">Name</label>
    <input type="text" id="fEmpName" class="neo-input" value="${emp?escapeHTML(emp.name):""}" placeholder="e.g. John Doe">
    <label class="field-label">Mobile Number</label>
    <input type="tel" id="fEmpPhone" class="neo-input" value="${emp?escapeHTML(emp.phone||""):""}" placeholder="01XXXXXXXXX">
    <label class="field-label">Salary Type</label>
    <select id="fEmpType" class="neo-select">
      <option value="monthly" ${emp&&emp.salaryType==='monthly'?"selected":""}>Monthly Salary</option>
      <option value="daily" ${emp&&emp.salaryType==='daily'?"selected":""}>Daily Wages</option>
    </select>
    <div id="fMonthlyWrap">
      <label class="field-label">Monthly Salary (Tk)</label>
      <input type="number" id="fEmpMonthly" class="neo-input" value="${emp?emp.monthlyAmount||"":""}" placeholder="0">
    </div>
    <div id="fDailyWrap">
      <label class="field-label">Daily Rate (Tk)</label>
      <input type="number" id="fEmpDaily" class="neo-input" value="${emp?emp.dailyRate||"":""}" placeholder="0">
    </div>
    <button class="primary-btn" id="saveEmpBtn">${emp?"Save":"Add"}</button>
  `);

  function toggleWraps(){
    const t = document.getElementById("fEmpType").value;
    document.getElementById("fMonthlyWrap").classList.toggle("hidden", t!=="monthly");
    document.getElementById("fDailyWrap").classList.toggle("hidden", t!=="daily");
  }
  document.getElementById("fEmpType").addEventListener("change", toggleWraps);
  toggleWraps();

  document.getElementById("saveEmpBtn").addEventListener("click", ()=>{
    const name = document.getElementById("fEmpName").value.trim();
    if(!name){ showToast("Please enter a name"); return; }
    const phone = document.getElementById("fEmpPhone").value.trim();
    const salaryType = document.getElementById("fEmpType").value;
    const monthlyAmount = Number(document.getElementById("fEmpMonthly").value||0);
    const dailyRate = Number(document.getElementById("fEmpDaily").value||0);

    if(emp){
      Object.assign(emp, {name, phone, salaryType, monthlyAmount, dailyRate});
    } else {
      DATA.employees.push({id:uid(), name, phone, salaryType, monthlyAmount, dailyRate});
    }
    saveData();
    closeModal();
    refreshEmployees();
    showToast("Saved successfully ✅");
  });
}

function deleteEmployee(empId){
  if(!confirm("Are you sure you want to delete this employee?")) return;
  DATA.employees = DATA.employees.filter(e=>e.id!==empId);
  delete DATA.employeePayments[empId];
  saveData();
  refreshEmployees();
  showToast("Deleted successfully");
}

function openPaySalaryModal(empId){
  const emp = DATA.employees.find(e=>e.id===empId);
  const ym = empMonthSelect.value || todayYM();
  const info = getEmployeeMonthInfo(empId, ym);
  openModal(`Pay Salary — ${escapeHTML(emp.name)}`, `
    <p class="muted">Month: ${ymLabel(ym)} · Current Due/Advance: <strong>${fmtMoney(info.balance)}</strong></p>
    <label class="field-label">Amount (Tk)</label>
    <input type="number" id="fPayAmount" class="neo-input" placeholder="0">
    <label class="field-label">Date</label>
    <input type="date" id="fPayDate" class="neo-input" value="${todayISO()}">
    <label class="field-label">Note (Optional)</label>
    <input type="text" id="fPayNote" class="neo-input" placeholder="e.g. Advance Salary">
    <button class="primary-btn" id="confirmPayBtn">Confirm Payment</button>
  `);
  document.getElementById("confirmPayBtn").addEventListener("click", ()=>{
    const amount = Number(document.getElementById("fPayAmount").value||0);
    if(amount<=0){ showToast("Please enter a valid amount"); return; }
    const date = document.getElementById("fPayDate").value || todayISO();
    const note = document.getElementById("fPayNote").value.trim();
    const rec = ensureEmpMonthRec(empId, ym);
    rec.payments.push({date, amount, note});
    saveData();
    closeModal();
    refreshEmployees();
    showToast("Salary payment recorded successfully ✅");
  });
}

function openWorkingDaysModal(empId){
  const emp = DATA.employees.find(e=>e.id===empId);
  const ym = empMonthSelect.value || todayYM();
  const rec = ensureEmpMonthRec(empId, ym);
  openModal(`Work Days — ${escapeHTML(emp.name)}`, `
    <p class="muted">Month: ${ymLabel(ym)}</p>
    <label class="field-label">Total Work Days this Month</label>
    <input type="number" id="fWorkDays" class="neo-input" value="${rec.workingDays||0}">
    <button class="primary-btn" id="saveWorkDaysBtn">Save</button>
  `);
  document.getElementById("saveWorkDaysBtn").addEventListener("click", ()=>{
    rec.workingDays = Number(document.getElementById("fWorkDays").value||0);
    saveData();
    closeModal();
    refreshEmployees();
    showToast("Work days saved successfully ✅");
  });
}

function openEmployeeHistoryModal(empId){
  const emp = DATA.employees.find(e=>e.id===empId);
  const ym = empMonthSelect.value || todayYM();
  const info = getEmployeeMonthInfo(empId, ym);
  const rows = info.payments.length
    ? info.payments.slice().reverse().map(p=>`
        <div class="list-item">
          <div class="li-top"><span>${p.date}</span><span class="li-amount">${fmtMoney(p.amount)}</span></div>
          ${p.note?`<div class="li-sub">${escapeHTML(p.note)}</div>`:""}
        </div>`).join("")
    : `<p class="empty-hint">No payments found for this month.</p>`;
  openModal(`Payment History — ${escapeHTML(emp.name)}`, `
    <p class="muted">Month: ${ymLabel(ym)} · Earned: ${fmtMoney(info.earned)} · Paid: ${fmtMoney(info.paid)}</p>
    <div class="list-stack" style="margin-top:10px;">${rows}</div>
  `);
}

/* =======================================================================
   ATTENDANCE SHEET (daily Present / Half-day / Absent per employee)
   Separate from "Work Days" — for record-keeping only, does not affect
   salary calculation.
======================================================================= */
document.getElementById("openAttendanceBtn")?.addEventListener("click", ()=> openAttendanceModal());

function getAttendanceStatus(empId, dateStr){
  return (DATA.attendance[empId] && DATA.attendance[empId][dateStr]) || null;
}
function setAttendanceStatus(empId, dateStr, status){
  if(!DATA.attendance[empId]) DATA.attendance[empId] = {};
  if(DATA.attendance[empId][dateStr] === status){
    delete DATA.attendance[empId][dateStr]; // tap same status again to clear it
  } else {
    DATA.attendance[empId][dateStr] = status;
  }
  saveData();
}

function openAttendanceModal(){
  renderAttendanceModalBody(todayISO());
}

function shiftAttendanceDate(dateStr, days){
  const d = new Date(dateStr+"T00:00:00");
  d.setDate(d.getDate()+days);
  renderAttendanceModalBody(d.toISOString().slice(0,10));
}

function formatAttDate(dateStr){
  const d = new Date(dateStr+"T00:00:00");
  return d.toLocaleDateString("en-US", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
}

function renderAttendanceModalBody(dateStr){
  let present=0, half=0, absent=0;
  const rows = DATA.employees.length ? DATA.employees.map(emp=>{
    const status = getAttendanceStatus(emp.id, dateStr);
    if(status==="present") present++;
    else if(status==="halfday") half++;
    else if(status==="absent") absent++;
    const initial = emp.name.trim().charAt(0).toUpperCase() || "?";
    return `
      <div class="attendance-row">
        <div class="att-avatar">${initial}</div>
        <span class="att-name">${escapeHTML(emp.name)}</span>
        <div class="att-btns">
          <button class="att-btn att-present ${status==='present'?'active':''}" data-emp="${emp.id}" data-status="present" title="Present">✅</button>
          <button class="att-btn att-half ${status==='halfday'?'active':''}" data-emp="${emp.id}" data-status="halfday" title="Half-day">➗</button>
          <button class="att-btn att-absent ${status==='absent'?'active':''}" data-emp="${emp.id}" data-status="absent" title="Absent">❌</button>
        </div>
      </div>`;
  }).join("") : `<p class="empty-hint">No employees added yet.</p>`;

  const isToday = dateStr === todayISO();

  openModal("Attendance Sheet", `
    <div class="att-date-nav">
      <button class="att-nav-arrow" id="attPrevDay">◀</button>
      <input type="date" id="attDateInput" class="att-date-input-premium" value="${dateStr}">
      <button class="att-nav-arrow" id="attNextDay">▶</button>
    </div>
    <div class="att-date-sub">
      <span class="att-date-label">${formatAttDate(dateStr)}</span>
      ${isToday
        ? `<span class="att-today-badge">Today</span>`
        : `<button class="att-today-btn" id="attGoToday">↺ Jump to Today</button>`}
    </div>

    <div class="att-quick-stats">
      <div class="att-stat att-stat-present"><strong>${present}</strong><span>Present</span></div>
      <div class="att-stat att-stat-half"><strong>${half}</strong><span>Half-day</span></div>
      <div class="att-stat att-stat-absent"><strong>${absent}</strong><span>Absent</span></div>
    </div>

    <div class="attendance-list" id="attendanceRows">${rows}</div>
    <button class="secondary-btn att-summary-btn" id="viewAttSummaryBtn">📊 View Monthly Summary</button>
  `);

  document.getElementById("attPrevDay").addEventListener("click", ()=> shiftAttendanceDate(dateStr, -1));
  document.getElementById("attNextDay").addEventListener("click", ()=> shiftAttendanceDate(dateStr, 1));
  const goTodayBtn = document.getElementById("attGoToday");
  if(goTodayBtn) goTodayBtn.addEventListener("click", ()=> renderAttendanceModalBody(todayISO()));
  document.getElementById("attDateInput").addEventListener("change", (e)=>{
    renderAttendanceModalBody(e.target.value);
  });
  document.querySelectorAll(".att-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const empId = btn.dataset.emp;
      const status = btn.dataset.status;
      setAttendanceStatus(empId, dateStr, status);
      renderAttendanceModalBody(dateStr);
      showToast("Attendance saved ✅");
    });
  });
  document.getElementById("viewAttSummaryBtn").addEventListener("click", ()=>{
    renderAttendanceSummaryBody(todayYM());
  });
}

function renderAttendanceSummaryBody(ym){
  const [y,m] = ym.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const rows = DATA.employees.length ? DATA.employees.map(emp=>{
    let present=0, half=0, absent=0;
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = `${ym}-${String(d).padStart(2,"0")}`;
      const s = getAttendanceStatus(emp.id, dateStr);
      if(s==="present") present++;
      else if(s==="halfday") half++;
      else if(s==="absent") absent++;
    }
    const marked = present+half+absent;
    const workedEquiv = present + half*0.5;
    const pct = marked ? Math.round((workedEquiv/marked)*100) : 0;
    const initial = emp.name.trim().charAt(0).toUpperCase() || "?";
    return `
      <div class="att-summary-card">
        <div class="att-summary-top">
          <div class="att-avatar">${initial}</div>
          <div class="att-summary-name">
            <strong>${escapeHTML(emp.name)}</strong>
            <span class="muted">${marked} of ${daysInMonth} days marked</span>
          </div>
          <span class="att-summary-pct">${pct}%</span>
        </div>
        <div class="att-progress-track">
          <div class="att-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="att-summary-chips">
          <span class="chip chip-present">✅ ${present}</span>
          <span class="chip chip-half">➗ ${half}</span>
          <span class="chip chip-absent">❌ ${absent}</span>
        </div>
      </div>`;
  }).join("") : `<p class="empty-hint">No employees added yet.</p>`;

  openModal("Monthly Attendance Summary", `
    <div class="filter-row">
      <select id="attSummaryMonthSelect" class="neo-select"></select>
    </div>
    <div class="att-summary-list" id="attSummaryList">${rows}</div>
  `);
  const sel = document.getElementById("attSummaryMonthSelect");
  populateMonthSelect(sel, ym);
  sel.addEventListener("change", ()=> renderAttendanceSummaryBody(sel.value));
}

let activeExpenseTab = "rent";
document.querySelectorAll("#view-expenses .tabbar .tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("#view-expenses .tabbar .tab-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    activeExpenseTab = btn.dataset.tab;
    document.querySelectorAll("#view-expenses .tab-panel").forEach(p=>p.classList.add("hidden"));
    document.getElementById(`tab-${activeExpenseTab}`).classList.remove("hidden");
    refreshExpensesActiveTab();
  });
});
function refreshExpensesActiveTab(){
  if(activeExpenseTab==="rent") refreshRent();
  if(activeExpenseTab==="electricity") refreshElectricity();
  if(activeExpenseTab==="others") refreshOthers();
  if(activeExpenseTab==="summary") refreshExpenseSummary();
}

/* ---------- GODAWN RENT ---------- */
const rentMonthSelect = document.getElementById("rentMonthSelect");
populateMonthSelect(rentMonthSelect);
rentMonthSelect.addEventListener("change", refreshRent);

function refreshRent(){
  const ym = rentMonthSelect.value || todayYM();
  const rec = DATA.godawnRent[ym] || {amount:0, payments:[]};
  const paid = sumPayments(rec.payments);
  const due = (rec.amount||0) - paid;
  const pct = rec.amount ? Math.min(100,(paid/rec.amount)*100) : 0;

  document.getElementById("rentAmountShow").textContent = fmtMoney(rec.amount);
  document.getElementById("rentPaidShow").textContent = fmtMoney(paid);
  document.getElementById("rentDueShow").textContent = fmtMoney(due>0?due:0);
  document.getElementById("rentProgressFill").style.width = pct+"%";
  const statusPill = document.getElementById("rentStatusPill");
  statusPill.textContent = !rec.amount ? "Not Set" : due<=0 ? "Paid ✅" : "Due";

  const list = document.getElementById("rentHistoryList");
  const emptyHint = document.getElementById("rentEmptyHint");
  if(!rec.payments || rec.payments.length===0){
    list.innerHTML=""; emptyHint.classList.remove("hidden");
  } else {
    emptyHint.classList.add("hidden");
    list.innerHTML = rec.payments.slice().reverse().map((p,i)=>`
      <div class="list-item">
        <div class="li-top"><span>${p.date}</span><span class="li-amount">${fmtMoney(p.amount)}</span></div>
        ${p.note?`<div class="li-sub">${escapeHTML(p.note)}</div>`:""}
      </div>`).join("");
  }
}
document.getElementById("editRentAmountBtn").addEventListener("click", ()=>{
  const ym = rentMonthSelect.value || todayYM();
  if(!DATA.godawnRent[ym]) DATA.godawnRent[ym] = {amount:0, payments:[]};
  openModal("Set Godawn Rent", `
    <label class="field-label">Monthly Rent (Tk) — ${ymLabel(ym)}</label>
    <input type="number" id="fRentAmount" class="neo-input" value="${DATA.godawnRent[ym].amount||""}">
    <button class="primary-btn" id="saveRentAmountBtn">Save</button>
  `);
  document.getElementById("saveRentAmountBtn").addEventListener("click", ()=>{
    DATA.godawnRent[ym].amount = Number(document.getElementById("fRentAmount").value||0);
    saveData(); closeModal(); refreshRent();
    showToast("Rent set successfully ✅");
  });
});
document.getElementById("payRentBtn").addEventListener("click", ()=>{
  const ym = rentMonthSelect.value || todayYM();
  if(!DATA.godawnRent[ym]) DATA.godawnRent[ym] = {amount:0, payments:[]};
  openModal("Pay Rent", `
    <p class="muted">Month: ${ymLabel(ym)}</p>
    <label class="field-label">Amount (Tk)</label>
    <input type="number" id="fRentPayAmount" class="neo-input" placeholder="0">
    <label class="field-label">Date</label>
    <input type="date" id="fRentPayDate" class="neo-input" value="${todayISO()}">
    <label class="field-label">Note (Optional)</label>
    <input type="text" id="fRentPayNote" class="neo-input">
    <button class="primary-btn" id="confirmRentPayBtn">Confirm</button>
  `);
  document.getElementById("confirmRentPayBtn").addEventListener("click", ()=>{
    const amount = Number(document.getElementById("fRentPayAmount").value||0);
    if(amount<=0){ showToast("Please enter a valid amount"); return; }
    DATA.godawnRent[ym].payments.push({
      date: document.getElementById("fRentPayDate").value||todayISO(),
      amount, note: document.getElementById("fRentPayNote").value.trim()
    });
    saveData(); closeModal(); refreshRent();
    showToast("Rent payment recorded successfully ✅");
  });
});

/* ---------- ELECTRICITY BILL ---------- */
const elecMonthSelect = document.getElementById("elecMonthSelect");
populateMonthSelect(elecMonthSelect);
elecMonthSelect.addEventListener("change", refreshElectricity);

function refreshElectricity(){
  const ym = elecMonthSelect.value || todayYM();
  const rec = DATA.electricity[ym] || {billAmount:0, payments:[]};
  const paid = sumPayments(rec.payments);
  const due = (rec.billAmount||0) - paid;
  const pct = rec.billAmount ? Math.min(100,(paid/rec.billAmount)*100) : 0;

  document.getElementById("elecAmountShow").textContent = fmtMoney(rec.billAmount);
  document.getElementById("elecPaidShow").textContent = fmtMoney(paid);
  document.getElementById("elecDueShow").textContent = fmtMoney(due>0?due:0);
  document.getElementById("elecProgressFill").style.width = pct+"%";
  const statusPill = document.getElementById("elecStatusPill");
  statusPill.textContent = !rec.billAmount ? "Not Set" : due<=0 ? "Paid ✅" : "Due";

  const list = document.getElementById("elecHistoryList");
  const emptyHint = document.getElementById("elecEmptyHint");
  if(!rec.payments || rec.payments.length===0){
    list.innerHTML=""; emptyHint.classList.remove("hidden");
  } else {
    emptyHint.classList.add("hidden");
    list.innerHTML = rec.payments.slice().reverse().map(p=>`
      <div class="list-item">
        <div class="li-top"><span>${p.date}</span><span class="li-amount">${fmtMoney(p.amount)}</span></div>
        ${p.note?`<div class="li-sub">${escapeHTML(p.note)}</div>`:""}
      </div>`).join("");
  }
}
document.getElementById("editElecAmountBtn").addEventListener("click", ()=>{
  const ym = elecMonthSelect.value || todayYM();
  if(!DATA.electricity[ym]) DATA.electricity[ym] = {billAmount:0, payments:[]};
  openModal("Set Electricity Bill", `
    <label class="field-label">Bill for this Month (Tk) — ${ymLabel(ym)}</label>
    <input type="number" id="fElecAmount" class="neo-input" value="${DATA.electricity[ym].billAmount||""}">
    <button class="primary-btn" id="saveElecAmountBtn">Save</button>
  `);
  document.getElementById("saveElecAmountBtn").addEventListener("click", ()=>{
    DATA.electricity[ym].billAmount = Number(document.getElementById("fElecAmount").value||0);
    saveData(); closeModal(); refreshElectricity();
    showToast("Bill set successfully ✅");
  });
});
document.getElementById("payElecBtn").addEventListener("click", ()=>{
  const ym = elecMonthSelect.value || todayYM();
  if(!DATA.electricity[ym]) DATA.electricity[ym] = {billAmount:0, payments:[]};
  openModal("Pay Electricity Bill", `
    <p class="muted">Month: ${ymLabel(ym)}</p>
    <label class="field-label">Amount (Tk)</label>
    <input type="number" id="fElecPayAmount" class="neo-input" placeholder="0">
    <label class="field-label">Date</label>
    <input type="date" id="fElecPayDate" class="neo-input" value="${todayISO()}">
    <label class="field-label">Note (Optional)</label>
    <input type="text" id="fElecPayNote" class="neo-input">
    <button class="primary-btn" id="confirmElecPayBtn">Confirm</button>
  `);
  document.getElementById("confirmElecPayBtn").addEventListener("click", ()=>{
    const amount = Number(document.getElementById("fElecPayAmount").value||0);
    if(amount<=0){ showToast("Please enter a valid amount"); return; }
    DATA.electricity[ym].payments.push({
      date: document.getElementById("fElecPayDate").value||todayISO(),
      amount, note: document.getElementById("fElecPayNote").value.trim()
    });
    saveData(); closeModal(); refreshElectricity();
    showToast("Bill payment recorded successfully ✅");
  });
});

/* ---------- OTHERS ---------- */
const othersMonthSelect = document.getElementById("othersMonthSelect");
populateMonthSelect(othersMonthSelect);
othersMonthSelect.addEventListener("change", refreshOthers);

function refreshOthers(){
  const ym = othersMonthSelect.value || todayYM();
  const items = DATA.others[ym] || [];
  const total = items.reduce((s,o)=>s+Number(o.amount||0),0);
  document.getElementById("othersTotalShow").textContent = fmtMoney(total);

  const list = document.getElementById("othersList");
  const emptyHint = document.getElementById("othersEmptyHint");
  if(items.length===0){
    list.innerHTML=""; emptyHint.classList.remove("hidden");
  } else {
    emptyHint.classList.add("hidden");
    list.innerHTML = items.slice().reverse().map(o=>`
      <div class="list-item">
        <div class="li-top">
          <div>
            <div class="li-title">${escapeHTML(o.title)}</div>
            <div class="li-sub">${o.date}${o.note?" · "+escapeHTML(o.note):""}</div>
          </div>
          <span class="li-amount">${fmtMoney(o.amount)}</span>
        </div>
        <div class="li-actions">
          <button class="act-del" onclick="deleteOtherExpense('${ym}','${o.id}')">🗑️ Delete</button>
        </div>
      </div>`).join("");
  }
}
document.getElementById("addOtherBtn").addEventListener("click", ()=>{
  const ym = othersMonthSelect.value || todayYM();
  openModal("Add New Expense", `
    <label class="field-label">Expense Details</label>
    <input type="text" id="fOtherTitle" class="neo-input" placeholder="e.g. Thread transport cost">
    <label class="field-label">Amount (Tk)</label>
    <input type="number" id="fOtherAmount" class="neo-input" placeholder="0">
    <label class="field-label">Date</label>
    <input type="date" id="fOtherDate" class="neo-input" value="${todayISO()}">
    <label class="field-label">Note (Optional)</label>
    <input type="text" id="fOtherNote" class="neo-input">
    <button class="primary-btn" id="saveOtherBtn">Add</button>
  `);
  document.getElementById("saveOtherBtn").addEventListener("click", ()=>{
    const title = document.getElementById("fOtherTitle").value.trim();
    const amount = Number(document.getElementById("fOtherAmount").value||0);
    if(!title || amount<=0){ showToast("Please enter details and a valid amount"); return; }
    if(!DATA.others[ym]) DATA.others[ym] = [];
    DATA.others[ym].push({
      id:uid(), title, amount,
      date:document.getElementById("fOtherDate").value||todayISO(),
      note:document.getElementById("fOtherNote").value.trim()
    });
    saveData(); closeModal(); refreshOthers();
    showToast("Expense added successfully ✅");
  });
});
function deleteOtherExpense(ym, id){
  if(!confirm("Are you sure you want to delete this expense?")) return;
  DATA.others[ym] = (DATA.others[ym]||[]).filter(o=>o.id!==id);
  saveData(); refreshOthers();
  showToast("Deleted successfully");
}

/* ---------- EXPENSES SUMMARY (Month to Month) ---------- */
function getExpenseMonthTotals(ym){
  const rent = DATA.godawnRent[ym] || {payments:[]};
  const elec = DATA.electricity[ym] || {payments:[]};
  const others = DATA.others[ym] || [];
  const rentPaid = sumPayments(rent.payments);
  const elecPaid = sumPayments(elec.payments);
  const othersTotal = others.reduce((s,o)=>s+Number(o.amount||0),0);
  let salaryPaid = 0;
  DATA.employees.forEach(emp=>{ salaryPaid += getEmployeeMonthInfo(emp.id, ym).paid; });
  return { rentPaid, elecPaid, othersTotal, salaryPaid, total: rentPaid+elecPaid+othersTotal+salaryPaid };
}

const expenseSummarySearch = document.getElementById("expenseSummarySearch");
expenseSummarySearch.addEventListener("input", refreshExpenseSummary);

function refreshExpenseSummary(){
  const search = (expenseSummarySearch.value||"").trim().toLowerCase();
  const months = getMonthOptions();
  const list = document.getElementById("expenseSummaryList");
  const filteredMonths = months.filter(ym => ymLabel(ym).toLowerCase().includes(search) || ym.includes(search));

  const grandTotal = filteredMonths.reduce((s,ym)=> s + getExpenseMonthTotals(ym).total, 0);
  document.getElementById("expenseSummaryGrandTotal").textContent = fmtMoney(grandTotal);

  if(filteredMonths.length===0){
    list.innerHTML = `<p class="empty-hint">No months matched your search.</p>`;
    return;
  }

  list.innerHTML = filteredMonths.map(ym=>{
    const t = getExpenseMonthTotals(ym);
    return `
    <div class="list-item">
      <div class="li-top">
        <div class="li-title">${ymLabel(ym)}</div>
        <span class="li-amount">${fmtMoney(t.total)}</span>
      </div>
      <div class="li-sub">Salary: ${fmtMoney(t.salaryPaid)} · Rent: ${fmtMoney(t.rentPaid)} · Electricity: ${fmtMoney(t.elecPaid)} · Others: ${fmtMoney(t.othersTotal)}</div>
    </div>`;
  }).join("");
}

/* =======================================================================
   godawn (YARN STOCK — PURCHASE / SALE / SUMMARY)
======================================================================= */
function getGodawnMonthTotals(ym){
  const purchases = DATA.godawnPurchases[ym] || [];
  const sales = DATA.godawnSales[ym] || [];
  const purchaseQty = purchases.reduce((s,p)=>s+Number(p.quantity||0),0);
  const purchaseAmount = purchases.reduce((s,p)=>s+Number(p.amount||0),0);
  const saleQty = sales.reduce((s,p)=>s+Number(p.quantity||0),0);
  const saleAmount = sales.reduce((s,p)=>s+Number(p.amount||0),0);
  return { purchaseQty, purchaseAmount, saleQty, saleAmount, net: saleAmount - purchaseAmount };
}

let activeGodawnTab = "purchase";
document.querySelectorAll("#godawnTabbar .tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("#godawnTabbar .tab-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    activeGodawnTab = btn.dataset.gtab;
    document.querySelectorAll("#view-godawn .tab-panel").forEach(p=>p.classList.add("hidden"));
    document.getElementById(`gtab-${activeGodawnTab}`).classList.remove("hidden");
    refreshGodawnActiveTab();
  });
});
function refreshGodawnActiveTab(){
  if(activeGodawnTab==="purchase") refreshPurchases();
  if(activeGodawnTab==="sale") refreshSales();
  if(activeGodawnTab==="summary") refreshGodawnSummary();
}

/* ---------- PURCHASE (Yarn Purchase) ---------- */
const purchaseMonthSelect = document.getElementById("purchaseMonthSelect");
populateMonthSelect(purchaseMonthSelect);
purchaseMonthSelect.addEventListener("change", refreshPurchases);

function refreshPurchases(){
  const ym = purchaseMonthSelect.value || todayYM();
  const items = DATA.godawnPurchases[ym] || [];
  const t = getGodawnMonthTotals(ym);

  document.getElementById("purchaseTotalQty").textContent = t.purchaseQty.toLocaleString("en-IN");
  document.getElementById("purchaseTotalAmount").textContent = fmtMoney(t.purchaseAmount);

  const list = document.getElementById("purchaseList");
  const emptyHint = document.getElementById("purchaseEmptyHint");
  if(items.length===0){
    list.innerHTML=""; emptyHint.classList.remove("hidden");
  } else {
    emptyHint.classList.add("hidden");
    list.innerHTML = items.slice().reverse().map(p=>`
      <div class="list-item">
        <div class="li-top">
          <div>
            <div class="li-title">${escapeHTML(p.itemName)}</div>
            <div class="li-sub">${escapeHTML(p.party||"Unknown Seller")} · ${p.quantity} ${escapeHTML(p.unit||"kg")} × ${fmtMoney(p.rate)}</div>
            <div class="li-sub">${p.date}${p.note?" · "+escapeHTML(p.note):""}</div>
          </div>
          <span class="li-amount txt-danger">${fmtMoney(p.amount)}</span>
        </div>
        <div class="li-actions">
          <button onclick="openEditPurchaseModal('${ym}','${p.id}')">✏️ Edit</button>
          <button class="act-del" onclick="deletePurchase('${ym}','${p.id}')">🗑️ Delete</button>
        </div>
      </div>`).join("");
  }
}

document.getElementById("addPurchaseBtn").addEventListener("click", ()=> openEditPurchaseModal(purchaseMonthSelect.value || todayYM(), null));

function openEditPurchaseModal(ym, id){
  const items = DATA.godawnPurchases[ym] || [];
  const item = id ? items.find(i=>i.id===id) : null;
  openModal(item ? "Edit Purchase" : "New Yarn Purchase", `
    <label class="field-label">Yarn Name / Description</label>
    <input type="text" id="fPName" class="neo-input" value="${item?escapeHTML(item.itemName):""}" placeholder="e.g. Cotton Yarn 30/1">
    <label class="field-label">Seller / Supplier</label>
    <input type="text" id="fPParty" class="neo-input" value="${item?escapeHTML(item.party||""):""}" placeholder="Name (Optional)">
    <label class="field-label">Quantity</label>
    <input type="number" id="fPQty" class="neo-input" value="${item?item.quantity:""}" placeholder="0">
    <label class="field-label">Unit</label>
    <input type="text" id="fPUnit" class="neo-input" value="${item?escapeHTML(item.unit||"kg"):"kg"}" placeholder="kg / Bag / Cone">
    <label class="field-label">Rate per Unit (Tk)</label>
    <input type="number" id="fPRate" class="neo-input" value="${item?item.rate:""}" placeholder="0">
    <label class="field-label">Date</label>
    <input type="date" id="fPDate" class="neo-input" value="${item?item.date:todayISO()}">
    <label class="field-label">Note (Optional)</label>
    <input type="text" id="fPNote" class="neo-input" value="${item?escapeHTML(item.note||""):""}">
    <button class="primary-btn" id="savePurchaseBtn">${item?"Save Changes":"Add Purchase"}</button>
  `);
  document.getElementById("savePurchaseBtn").addEventListener("click", ()=>{
    const itemName = document.getElementById("fPName").value.trim();
    const qty = Number(document.getElementById("fPQty").value||0);
    const rate = Number(document.getElementById("fPRate").value||0);
    if(!itemName || qty<=0){ showToast("Please enter valid details"); return; }
    const data = {
      itemName,
      party: document.getElementById("fPParty").value.trim(),
      quantity: qty,
      unit: document.getElementById("fPUnit").value.trim() || "kg",
      rate,
      amount: qty*rate,
      date: document.getElementById("fPDate").value || todayISO(),
      note: document.getElementById("fPNote").value.trim()
    };
    if(!DATA.godawnPurchases[ym]) DATA.godawnPurchases[ym] = [];
    if(item){
      Object.assign(item, data);
    } else {
      DATA.godawnPurchases[ym].push({id:uid(), ...data});
    }
    saveData(); closeModal(); refreshPurchases();
    showToast("Saved successfully ✅");
  });
}
function deletePurchase(ym, id){
  if(!confirm("Are you sure you want to delete this purchase?")) return;
  DATA.godawnPurchases[ym] = (DATA.godawnPurchases[ym]||[]).filter(p=>p.id!==id);
  saveData(); refreshPurchases();
  showToast("Deleted successfully");
}

/* ---------- SALE (Yarn Sale) ---------- */
const saleMonthSelect = document.getElementById("saleMonthSelect");
populateMonthSelect(saleMonthSelect);
saleMonthSelect.addEventListener("change", refreshSales);

function refreshSales(){
  const ym = saleMonthSelect.value || todayYM();
  const items = DATA.godawnSales[ym] || [];
  const t = getGodawnMonthTotals(ym);

  document.getElementById("saleTotalQty").textContent = t.saleQty.toLocaleString("en-IN");
  document.getElementById("saleTotalAmount").textContent = fmtMoney(t.saleAmount);

  const list = document.getElementById("saleList");
  const emptyHint = document.getElementById("saleEmptyHint");
  if(items.length===0){
    list.innerHTML=""; emptyHint.classList.remove("hidden");
  } else {
    emptyHint.classList.add("hidden");
    list.innerHTML = items.slice().reverse().map(p=>`
      <div class="list-item">
        <div class="li-top">
          <div>
            <div class="li-title">${escapeHTML(p.itemName)}</div>
            <div class="li-sub">${escapeHTML(p.party||"Unknown Buyer")} · ${p.quantity} ${escapeHTML(p.unit||"kg")} × ${fmtMoney(p.rate)}</div>
            <div class="li-sub">${p.date}${p.note?" · "+escapeHTML(p.note):""}</div>
          </div>
          <span class="li-amount txt-success">${fmtMoney(p.amount)}</span>
        </div>
        <div class="li-actions">
          <button onclick="openEditSaleModal('${ym}','${p.id}')">✏️ Edit</button>
          <button class="act-del" onclick="deleteSale('${ym}','${p.id}')">🗑️ Delete</button>
        </div>
      </div>`).join("");
  }
}

document.getElementById("addSaleBtn").addEventListener("click", ()=> openEditSaleModal(saleMonthSelect.value || todayYM(), null));

function openEditSaleModal(ym, id){
  const items = DATA.godawnSales[ym] || [];
  const item = id ? items.find(i=>i.id===id) : null;
  openModal(item ? "Edit Sale" : "New Yarn Sale", `
    <label class="field-label">Yarn Name / Description</label>
    <input type="text" id="fSName" class="neo-input" value="${item?escapeHTML(item.itemName):""}" placeholder="e.g. Cotton Yarn 30/1">
    <label class="field-label">Buyer</label>
    <input type="text" id="fSParty" class="neo-input" value="${item?escapeHTML(item.party||""):""}" placeholder="Name (Optional)">
    <label class="field-label">Quantity</label>
    <input type="number" id="fSQty" class="neo-input" value="${item?item.quantity:""}" placeholder="0">
    <label class="field-label">Unit</label>
    <input type="text" id="fSUnit" class="neo-input" value="${item?escapeHTML(item.unit||"kg"):"kg"}" placeholder="kg / Bag / Cone">
    <label class="field-label">Rate per Unit (Tk)</label>
    <input type="number" id="fSRate" class="neo-input" value="${item?item.rate:""}" placeholder="0">
    <label class="field-label">Date</label>
    <input type="date" id="fSDate" class="neo-input" value="${item?item.date:todayISO()}">
    <label class="field-label">Note (Optional)</label>
    <input type="text" id="fSNote" class="neo-input" value="${item?escapeHTML(item.note||""):""}">
    <button class="primary-btn" id="saveSaleBtn">${item?"Save Changes":"Add Sale"}</button>
  `);
  document.getElementById("saveSaleBtn").addEventListener("click", ()=>{
    const itemName = document.getElementById("fSName").value.trim();
    const qty = Number(document.getElementById("fSQty").value||0);
    const rate = Number(document.getElementById("fSRate").value||0);
    if(!itemName || qty<=0){ showToast("Please enter valid details"); return; }
    const data = {
      itemName,
      party: document.getElementById("fSParty").value.trim(),
      quantity: qty,
      unit: document.getElementById("fSUnit").value.trim() || "kg",
      rate,
      amount: qty*rate,
      date: document.getElementById("fSDate").value || todayISO(),
      note: document.getElementById("fSNote").value.trim()
    };
    if(!DATA.godawnSales[ym]) DATA.godawnSales[ym] = [];
    if(item){
      Object.assign(item, data);
    } else {
      DATA.godawnSales[ym].push({id:uid(), ...data});
    }
    saveData(); closeModal(); refreshSales();
    showToast("Saved successfully ✅");
  });
}
function deleteSale(ym, id){
  if(!confirm("Are you sure you want to delete this sale?")) return;
  DATA.godawnSales[ym] = (DATA.godawnSales[ym]||[]).filter(p=>p.id!==id);
  saveData(); refreshSales();
  showToast("Deleted successfully");
}

/* ---------- GODAWN SUMMARY (Month to Month) ---------- */
const godawnSummarySearch = document.getElementById("godawnSummarySearch");
godawnSummarySearch.addEventListener("input", refreshGodawnSummary);

function refreshGodawnSummary(){
  const ym = todayYM();
  const cur = getGodawnMonthTotals(ym);
  document.getElementById("godawnCurrentMonthPill").textContent = ymLabel(ym);
  document.getElementById("godawnCurPurchase").textContent = fmtMoney(cur.purchaseAmount);
  document.getElementById("godawnCurSale").textContent = fmtMoney(cur.saleAmount);
  const netEl = document.getElementById("godawnCurNet");
  netEl.textContent = fmtMoney(cur.net);
  netEl.classList.toggle("txt-success", cur.net>=0);
  netEl.classList.toggle("txt-danger", cur.net<0);

  const search = (godawnSummarySearch.value||"").trim().toLowerCase();
  const months = getMonthOptions();
  const filteredMonths = months.filter(m => ymLabel(m).toLowerCase().includes(search) || m.includes(search));
  const list = document.getElementById("godawnSummaryList");

  if(filteredMonths.length===0){
    list.innerHTML = `<p class="empty-hint">No records found.</p>`;
    return;
  }

  list.innerHTML = filteredMonths.map(m=>{
    const t = getGodawnMonthTotals(m);
    const netClass = t.net>=0 ? "txt-success" : "txt-danger";
    return `
    <div class="list-item">
      <div class="li-top">
        <div class="li-title">${ymLabel(m)}</div>
        <span class="li-amount ${netClass}">${fmtMoney(t.net)}</span>
      </div>
      <div class="li-sub">Purchase: ${fmtMoney(t.purchaseAmount)} (${t.purchaseQty}) · Sale: ${fmtMoney(t.saleAmount)} (${t.saleQty})</div>
    </div>`;
  }).join("");
}

/* =======================================================================
   SETTINGS
======================================================================= */
document.getElementById("settingBizName").value = DATA.settings.businessName;
document.getElementById("saveBizNameBtn").addEventListener("click", ()=>{
  const name = document.getElementById("settingBizName").value.trim() || "MBM ENTERPRISE";
  DATA.settings.businessName = name;
  saveData();
  document.querySelector(".brand-text h1").textContent = name;
  showToast("Saved successfully ✅");
});

document.getElementById("autoBackupToggle").checked = DATA.settings.autoBackup;
document.getElementById("autoBackupToggle").addEventListener("change", (e)=>{
  DATA.settings.autoBackup = e.target.checked;
  saveData();
});

document.getElementById("clearAllBtn").addEventListener("click", ()=>{
  if(!confirm("Are you sure? All data (employees, expenses, payments) will be permanently deleted!")) return;
  if(!confirm("This cannot be undone. Please confirm again.")) return;
  DATA = defaultData();
  saveData();
  applyTheme();
  goToView("home");
  showToast("All data deleted successfully");
});

/* =======================================================================
   TELEGRAM BACKUP
======================================================================= */
function setBackupStatus(msg){
  document.getElementById("backupStatusText").textContent = msg;
}

async function sendBackupToTelegram(silent){
  try{
    if(!silent) setBackupStatus("⏳ Sending backup...");
    const jsonStr = JSON.stringify(DATA, null, 2);
    const blob = new Blob([jsonStr], {type:"application/json"});
    const filename = `MBM_Backup_${todayISO()}.json`;

    const form = new FormData();
    form.append("chat_id", TELEGRAM_CHAT_ID);
    form.append("caption", `📦 MBM Enterprise Backup\n🗓️ ${new Date().toLocaleString("en-US")}`);
    form.append("document", blob, filename);

    const res = await fetch(`${TG_API}/sendDocument`, { method:"POST", body:form });
    const result = await res.json();
    if(result.ok){
      if(!silent){ setBackupStatus("✅ Backup successfully sent to Telegram."); showToast("Backup sent ✅"); }
    } else {
      throw new Error(result.description || "Unknown error");
    }
  }catch(err){
    console.error(err);
    if(!silent){ setBackupStatus("❌ Backup failed: "+err.message); showToast("Backup failed ❌"); }
  }
}
document.getElementById("sendBackupBtn").addEventListener("click", ()=> sendBackupToTelegram(false));

async function fetchBackupFromTelegram(){
  try{
    setBackupStatus("⏳ Fetching latest backup...");
    const res = await fetch(`${TG_API}/getUpdates?limit=100`);
    const result = await res.json();
    if(!result.ok) throw new Error(result.description || "getUpdates failed");

    // Find the most recent message with a document, sent to our chat
    const docs = result.result
      .filter(u=> (u.message && u.message.document) || (u.channel_post && u.channel_post.document))
      .map(u=> u.message || u.channel_post)
      .filter(m=> String(m.chat.id) === String(TELEGRAM_CHAT_ID));

    if(docs.length===0){
      setBackupStatus("⚠️ No backup file found (getUpdates only shows recent messages).");
      return;
    }
    const lastDoc = docs[docs.length-1].document;
    const fileRes = await fetch(`${TG_API}/getFile?file_id=${lastDoc.file_id}`);
    const fileResult = await fileRes.json();
    if(!fileResult.ok) throw new Error("File path not found");

    const fileUrl = `${TG_FILE}/${fileResult.result.file_path}`;
    const contentRes = await fetch(fileUrl);
    const jsonData = await contentRes.json();

    if(!confirm("Backup found on Telegram. This will overwrite your current data. Do you want to proceed?")) {
      setBackupStatus("Cancelled.");
      return;
    }
    DATA = { ...defaultData(), ...jsonData };
    saveData();
    applyTheme();
    goToView("home");
    setBackupStatus("✅ Backup successfully restored.");
    showToast("Backup restored ✅");
  }catch(err){
    console.error(err);
    setBackupStatus("❌ Failed to fetch backup: "+err.message);
    showToast("Failed ❌");
  }
}
document.getElementById("fetchBackupBtn").addEventListener("click", fetchBackupFromTelegram);

document.getElementById("importFileInput").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (evt)=>{
    try{
      const jsonData = JSON.parse(evt.target.result);
      if(!confirm("Importing data from this file will overwrite current data. Are you sure?")) return;
      DATA = { ...defaultData(), ...jsonData };
      saveData();
      applyTheme();
      goToView("home");
      setBackupStatus("✅ Successfully imported from file.");
      showToast("Import successful ✅");
    }catch(err){
      setBackupStatus("❌ Invalid file format.");
    }
  };
  reader.readAsText(file);
});

/* =======================================================================
   INIT
======================================================================= */
function init(){
  applyTheme();
  document.querySelector(".brand-text h1").textContent = DATA.settings.businessName || "MBM ENTERPRISE";
  goToView("home");

  // Auto-send backup every time the app is opened (per settings toggle)
  if(DATA.settings.autoBackup){
    sendBackupToTelegram(true);
  }
}
document.addEventListener("DOMContentLoaded", init);