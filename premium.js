/* =====================================================================
   MBM ENTERPRISE — Premium Features Layer
   Loads AFTER script.js. Uses the same global DATA object and helper
   functions (saveData, fmtMoney, ymLabel, todayYM, getMonthOptions,
   sumPayments, getEmployeeMonthInfo, getExpenseMonthTotals,
   getgodawnMonthTotals, showToast, goToView, refreshHome, etc.)
   Nothing here modifies your original data model or Telegram backup.
===================================================================== */

const APP_PIN_KEY = "mbm_pin_v1";
const APP_PIN_ENABLED_KEY = "mbm_pin_enabled_v1";
const DEFAULT_PIN = "7380";

/* ---------------------------------------------------------------------
   1) SPLASH SCREEN
--------------------------------------------------------------------- */
window.addEventListener("load", ()=>{
  setTimeout(()=>{
    const splash = document.getElementById("splashScreen");
    if(splash) splash.classList.add("splash-hide");
  }, 1100);
});

/* ---------------------------------------------------------------------
   2) PIN LOCK
--------------------------------------------------------------------- */
function isPinEnabled(){
  const v = localStorage.getItem(APP_PIN_ENABLED_KEY);
  return v === null ? false : v === "1";
}
function getPin(){ return localStorage.getItem(APP_PIN_KEY) || DEFAULT_PIN; }
function setPinEnabled(on){ localStorage.setItem(APP_PIN_ENABLED_KEY, on ? "1" : "0"); }

let pinBuffer = "";
function renderPinDots(){
  const dots = document.querySelectorAll("#pinDots span");
  dots.forEach((d,i)=> d.classList.toggle("filled", i < pinBuffer.length));
}
function showLockScreen(){
  const lock = document.getElementById("lockScreen");
  if(!lock) return;
  pinBuffer = "";
  renderPinDots();
  lock.classList.remove("hidden");
}
function hideLockScreen(){
  const lock = document.getElementById("lockScreen");
  if(lock) lock.classList.add("hidden");
}
function checkPin(){
  if(pinBuffer === getPin()){
    sessionStorage.setItem("mbm_unlocked", "1");
    hideLockScreen();
  } else {
    const dots = document.getElementById("pinDots");
    const err = document.getElementById("pinError");
    dots.classList.add("pin-shake");
    err.classList.remove("hidden");
    setTimeout(()=>{
      dots.classList.remove("pin-shake");
      pinBuffer = "";
      renderPinDots();
    }, 400);
  }
}
document.addEventListener("click", (e)=>{
  const btn = e.target.closest("#pinPad button");
  if(!btn || !btn.dataset.k) return;
  document.getElementById("pinError").classList.add("hidden");
  if(btn.dataset.k === "back"){
    pinBuffer = pinBuffer.slice(0,-1);
  } else if(pinBuffer.length < 4){
    pinBuffer += btn.dataset.k;
  }
  renderPinDots();
  if(pinBuffer.length === 4) checkPin();
});

function initLockFeature(){
  const toggle = document.getElementById("pinLockToggle");
  const lockNowBtn = document.getElementById("lockNowBtn");
  if(toggle){
    toggle.checked = isPinEnabled();
    toggle.addEventListener("change", (e)=>{
      setPinEnabled(e.target.checked);
      showToast(e.target.checked ? "App Lock enabled 🔒" : "App Lock disabled");
    });
  }
  if(lockNowBtn){
    lockNowBtn.addEventListener("click", ()=>{
      if(!isPinEnabled()){ showToast("Enable App Lock first"); return; }
      sessionStorage.removeItem("mbm_unlocked");
      showLockScreen();
    });
  }
  if(isPinEnabled() && sessionStorage.getItem("mbm_unlocked") !== "1"){
    showLockScreen();
  }
}

/* ---------------------------------------------------------------------
   3) RIPPLE EFFECT (delegated, works on all current + future buttons)
--------------------------------------------------------------------- */
document.addEventListener("pointerdown", (e)=>{
  const btn = e.target.closest("button");
  if(!btn || btn.disabled) return;
  btn.classList.add("ripple-wrap");
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const dot = document.createElement("span");
  dot.className = "ripple-dot";
  dot.style.width = dot.style.height = size + "px";
  dot.style.left = (e.clientX - rect.left - size/2) + "px";
  dot.style.top = (e.clientY - rect.top - size/2) + "px";
  btn.appendChild(dot);
  setTimeout(()=> dot.remove(), 650);
});

/* ---------------------------------------------------------------------
   4) CONFETTI (fires whenever showToast is called with a ✅ success msg)
--------------------------------------------------------------------- */
const confettiCanvas = document.getElementById("confettiCanvas");
const confettiCtx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
function resizeConfetti(){
  if(!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeConfetti);
resizeConfetti();

function fireConfetti(){
  if(!confettiCtx) return;
  confettiCanvas.style.display = "block";
  const colors = ["#E7B25D","#CE8A4F","#6BDB98","#A9CDBA","#CFA9C9"];
  const pieces = Array.from({length:70}, ()=>({
    x: Math.random()*confettiCanvas.width,
    y: -20 - Math.random()*100,
    r: 4+Math.random()*5,
    c: colors[Math.floor(Math.random()*colors.length)],
    vy: 3+Math.random()*4,
    vx: -2+Math.random()*4,
    rot: Math.random()*360,
    vr: -6+Math.random()*12
  }));
  let frame = 0;
  function tick(){
    frame++;
    confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    pieces.forEach(p=>{
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot*Math.PI/180);
      confettiCtx.fillStyle = p.c;
      confettiCtx.fillRect(-p.r/2, -p.r/2, p.r, p.r*1.6);
      confettiCtx.restore();
    });
    if(frame < 90){
      requestAnimationFrame(tick);
    } else {
      confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
      confettiCanvas.style.display = "none";
    }
  }
  tick();
}

const _originalShowToast = window.showToast;
window.showToast = function(msg){
  _originalShowToast(msg);
  if(typeof msg === "string" && msg.includes("✅")){
    fireConfetti();
  }
};

/* ---------------------------------------------------------------------
   5) VIEW TRANSITION RE-TRIGGER (re-plays the .view animation on nav)
--------------------------------------------------------------------- */
const _originalGoToView = window.goToView;
window.goToView = function(name){
  _originalGoToView(name);
  const el = document.getElementById(`view-${name}`);
  if(el){
    el.style.animation = "none";
    requestAnimationFrame(()=>{ el.style.animation = ""; });
  }
};

/* ---------------------------------------------------------------------
   6) ANIMATED COUNT-UP for stat numbers & big amounts
--------------------------------------------------------------------- */
function animateCount(el){
  if(!el) return;
  const raw = el.textContent;
  const match = raw.match(/-?[\d,]+/);
  if(!match) return;
  const target = parseInt(match[0].replace(/,/g,""), 10);
  if(isNaN(target)) return;
  const prefix = raw.slice(0, match.index);
  const suffix = raw.slice(match.index + match[0].length);
  const start = 0;
  const duration = 650;
  const startTime = performance.now();
  function step(now){
    const p = Math.min(1, (now-startTime)/duration);
    const eased = 1 - Math.pow(1-p, 3);
    const val = Math.round(start + (target-start)*eased);
    el.textContent = prefix + val.toLocaleString("en-IN") + suffix;
    if(p < 1) requestAnimationFrame(step);
    else el.textContent = raw;
  }
  requestAnimationFrame(step);
}
const _originalRefreshHome = window.refreshHome;
window.refreshHome = function(){
  _originalRefreshHome();
  ["statEmployeeCount","statSalaryDue","sumSalaryPaid","sumRentPaid","sumElecPaid","sumOthersPaid","sumTotalAll"]
    .forEach(id=> animateCount(document.getElementById(id)));
  renderReminders();
};

/* ---------------------------------------------------------------------
   7) REMINDERS (due rent / bill / salary this month)
--------------------------------------------------------------------- */
function renderReminders(){
  const stack = document.getElementById("reminderStack");
  if(!stack) return;
  const ym = todayYM();
  const items = [];

  const rent = DATA.godawnRent[ym] || {amount:0, payments:[]};
  const rentDue = (rent.amount||0) - sumPayments(rent.payments);
  if(rent.amount && rentDue > 0) items.push({icon:"🏬", text:`Godawn rent due: ${fmtMoney(rentDue)}`, ok:false});

  const elec = DATA.electricity[ym] || {billAmount:0, payments:[]};
  const elecDue = (elec.billAmount||0) - sumPayments(elec.payments);
  if(elec.billAmount && elecDue > 0) items.push({icon:"⚡", text:`Electricity bill due: ${fmtMoney(elecDue)}`, ok:false});

  let salaryDueCount = 0;
  DATA.employees.forEach(emp=>{
    const info = getEmployeeMonthInfo(emp.id, ym);
    if(info.balance > 0) salaryDueCount++;
  });
  if(salaryDueCount > 0) items.push({icon:"👥", text:`${salaryDueCount} employee(s) have salary due this month`, ok:false});

  if(items.length === 0){
    stack.innerHTML = `<div class="reminder-card reminder-ok"><span class="r-icon">✅</span><div class="r-text"><strong>All caught up</strong>No pending dues this month.</div></div>`;
  } else {
    stack.innerHTML = items.map(it=>`
      <div class="reminder-card">
        <span class="r-icon">${it.icon}</span>
        <div class="r-text">${it.text}</div>
      </div>`).join("");
    if(Notification && Notification.permission === "granted" && !sessionStorage.getItem("mbm_notified")){
      sessionStorage.setItem("mbm_notified","1");
      try{ new Notification("MBM Enterprise", { body: items.map(i=>i.text).join(" · "), icon:"img/logo.png" }); }catch(e){}
    }
  }
}
if(window.Notification && Notification.permission === "default"){
  document.addEventListener("click", function reqPerm(){
    Notification.requestPermission();
    document.removeEventListener("click", reqPerm);
  }, {once:true});
}

/* ---------------------------------------------------------------------
   8) PULL TO REFRESH (Home view only)
--------------------------------------------------------------------- */
(function(){
  const ptr = document.getElementById("ptrIndicator");
  let startY = null, pulling = false;
  document.addEventListener("touchstart", (e)=>{
    const homeView = document.getElementById("view-home");
    if(!homeView || homeView.classList.contains("hidden")) return;
    if(window.scrollY > 4) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, {passive:true});
  document.addEventListener("touchmove", (e)=>{
    if(!pulling || startY===null) return;
    const dy = e.touches[0].clientY - startY;
    if(dy > 0){
      const dist = Math.min(70, dy*0.5);
      ptr.style.transform = `translate(-50%, ${-60+dist}px)`;
      ptr.classList.add("ptr-show");
    }
  }, {passive:true});
  document.addEventListener("touchend", (e)=>{
    if(!pulling) return;
    pulling = false;
    const shown = ptr.classList.contains("ptr-show");
    ptr.style.transform = "";
    ptr.classList.remove("ptr-show");
    if(shown){
      ptr.classList.add("ptr-show","ptr-loading");
      ptr.style.transform = "translate(-50%, 8px)";
      setTimeout(()=>{
        refreshHome();
        showToast("Dashboard refreshed 🔄");
        ptr.classList.remove("ptr-loading","ptr-show");
        ptr.style.transform = "";
      }, 650);
    }
    startY = null;
  });
})();

/* ---------------------------------------------------------------------
   9) SWIPE TO DELETE on .list-item cards (delegates to existing
      .act-del button already wired by script.js for that item)
--------------------------------------------------------------------- */
(function(){
  let activeItem = null, startX = 0, currentX = 0, dragging = false;
  document.addEventListener("touchstart", (e)=>{
    const item = e.target.closest(".list-item");
    if(!item || e.target.closest("button")) return;
    if(!item.querySelector(".act-del")) return; // only items with a delete action
    activeItem = item;
    startX = e.touches[0].clientX;
    dragging = true;
    activeItem.classList.add("swiping");
  }, {passive:true});
  document.addEventListener("touchmove", (e)=>{
    if(!dragging || !activeItem) return;
    currentX = e.touches[0].clientX - startX;
    if(currentX < 0){
      activeItem.style.transform = `translateX(${Math.max(currentX,-110)}px)`;
    }
  }, {passive:true});
  document.addEventListener("touchend", ()=>{
    if(!dragging || !activeItem) return;
    dragging = false;
    activeItem.classList.remove("swiping");
    activeItem.classList.add("swipe-snap");
    if(currentX < -70){
      const delBtn = activeItem.querySelector(".act-del");
      activeItem.style.transform = "translateX(-110px)";
      setTimeout(()=>{ if(delBtn) delBtn.click(); }, 150);
    } else {
      activeItem.style.transform = "";
    }
    currentX = 0;
    setTimeout(()=>{ if(activeItem) activeItem.classList.remove("swipe-snap"); }, 260);
    activeItem = null;
  });
})();

/* ---------------------------------------------------------------------
   10) GENERIC SEARCH/FILTER for lists without built-in filtering
       (Others, Purchase, Sale) — filters already-rendered .list-item
       cards by visible text, non-destructively.
--------------------------------------------------------------------- */
document.querySelectorAll(".list-filter-input").forEach(input=>{
  input.addEventListener("input", ()=>{
    const targetId = input.dataset.filterList;
    const container = document.getElementById(targetId);
    if(!container) return;
    const q = input.value.trim().toLowerCase();
    container.querySelectorAll(".list-item").forEach(item=>{
      const match = !q || item.textContent.toLowerCase().includes(q);
      item.style.display = match ? "" : "none";
    });
  });
});

/* ---------------------------------------------------------------------
   11) CHARTS — animated canvas donut (Expense Summary) & bar
       (Godawn Summary). Re-render whenever those views refresh.
--------------------------------------------------------------------- */
function drawDonutChart(canvasId, legendId, segments){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const total = segments.reduce((s,x)=>s+x.value,0);
  const cx = canvas.width/2, cy = canvas.height/2, radius = Math.min(cx,cy)-10;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(total <= 0){
    ctx.font = "13px Poppins, sans-serif";
    ctx.fillStyle = "#8A7B63";
    ctx.textAlign = "center";
    ctx.fillText("No data yet", cx, cy);
    if(legendId) document.getElementById(legendId).innerHTML = "";
    return;
  }
  let startAngle = -Math.PI/2;
  const duration = 700, t0 = performance.now();
  function frame(now){
    const p = Math.min(1, (now-t0)/duration);
    const eased = 1-Math.pow(1-p,3);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let a = -Math.PI/2;
    segments.forEach(seg=>{
      if(seg.value<=0) return;
      const sweep = (seg.value/total) * Math.PI*2 * eased;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,radius,a,a+sweep);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      a += sweep;
    });
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx,cy,radius*0.58,0,Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    if(p<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if(legendId){
    document.getElementById(legendId).innerHTML = segments.filter(s=>s.value>0).map(s=>
      `<span><span class="dot" style="background:${s.color}"></span>${s.label}: ${fmtMoney(s.value)}</span>`
    ).join("");
  }
}

function drawBarChart(canvasId, bars){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const max = Math.max(1, ...bars.map(b=>Math.abs(b.value)));
  const padding = 24, w = canvas.width, h = canvas.height;
  const barW = (w - padding*2) / bars.length * 0.5;
  const gap = (w - padding*2) / bars.length;
  const duration = 700, t0 = performance.now();
  function frame(now){
    const p = Math.min(1,(now-t0)/duration);
    const eased = 1-Math.pow(1-p,3);
    ctx.clearRect(0,0,w,h);
    const baseline = h - 26;
    bars.forEach((b,i)=>{
      const barH = (Math.abs(b.value)/max) * (h-50) * eased;
      const x = padding + i*gap + (gap-barW)/2;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x, baseline-barH, barW, barH, 6);
      else ctx.rect(x, baseline-barH, barW, barH);
      ctx.fill();
      ctx.fillStyle = "#8A7B63";
      ctx.font = "11px Poppins, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label, x+barW/2, h-8);
    });
    if(p<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const _originalRefreshExpenseSummary = window.refreshExpenseSummary;
window.refreshExpenseSummary = function(){
  _originalRefreshExpenseSummary();
  const ym = todayYM();
  const t = getExpenseMonthTotals(ym);
  drawDonutChart("expenseDonutChart", "expenseChartLegend", [
    {label:"Salary", value:t.salaryPaid, color:"#B5792B"},
    {label:"Rent", value:t.rentPaid, color:"#8F5A28"},
    {label:"Electricity", value:t.elecPaid, color:"#3D8A5A"},
    {label:"Others", value:t.othersTotal, color:"#BE4E3D"}
  ]);
};

const _originalRefreshGodawnSummary = window.refreshGodawnSummary;
window.refreshGodawnSummary = function(){
  _originalRefreshGodawnSummary();
  const ym = todayYM();
  const t = getGodawnMonthTotals(ym);
  drawBarChart("godawnBarChart", [
    {label:"Purchase", value:t.purchaseAmount, color:"#BE4E3D"},
    {label:"Sale", value:t.saleAmount, color:"#3D8A5A"}
  ]);
};

/* ---------------------------------------------------------------------
   12) PDF EXPORT ("save as image-style PDF to phone storage")
       Uses html2canvas to snapshot the target card, then jsPDF to
       embed that image in an A4-ish PDF and trigger a download.
--------------------------------------------------------------------- */
document.addEventListener("click", async (e)=>{
  const btn = e.target.closest(".pdf-export-btn");
  if(!btn) return;
  const targetId = btn.dataset.pdfTarget;
  const name = btn.dataset.pdfName || "MBM_Report";
  const el = document.getElementById(targetId);
  if(!el || typeof html2canvas === "undefined" || typeof window.jspdf === "undefined"){
    showToast("PDF export not available");
    return;
  }
  btn.classList.add("pdf-loading");
  btn.textContent = "⏳ Preparing PDF...";
  try{
    const canvas = await html2canvas(el, {
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      scale: 2
    });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:"pt", format:"a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 60;
    const imgH = (canvas.height/canvas.width) * imgW;
    pdf.setFontSize(14);
    pdf.text(DATA.settings.businessName || "MBM Enterprise", 30, 34);
    pdf.setFontSize(9);
    pdf.text(new Date().toLocaleString("en-US"), 30, 48);
    let y = 60;
    if(imgH > pageH-80){
      pdf.addImage(imgData, "PNG", 30, y, imgW, pageH-90);
    } else {
      pdf.addImage(imgData, "PNG", 30, y, imgW, imgH);
    }
    pdf.save(`${name}_${todayISO()}.pdf`);
    showToast("PDF saved to your device ✅");
  }catch(err){
    console.error(err);
    showToast("PDF export failed ❌");
  } finally {
    btn.classList.remove("pdf-loading");
    btn.textContent = "📄 Export as PDF";
  }
});

/* ---------------------------------------------------------------------
   13) PWA INSTALL PROMPT
--------------------------------------------------------------------- */
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById("installBanner");
  if(banner && !localStorage.getItem("mbm_install_dismissed")) banner.classList.remove("hidden");
});
function triggerInstall(){
  if(!deferredInstallPrompt){ showToast("Already installed or not supported on this browser"); return; }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(()=>{
    document.getElementById("installBanner")?.classList.add("hidden");
    deferredInstallPrompt = null;
  });
}
document.getElementById("installBtn")?.addEventListener("click", triggerInstall);
document.getElementById("settingsInstallBtn")?.addEventListener("click", triggerInstall);
document.getElementById("installCloseBtn")?.addEventListener("click", ()=>{
  document.getElementById("installBanner").classList.add("hidden");
  localStorage.setItem("mbm_install_dismissed","1");
});

/* Register service worker for installability + basic offline shell */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

/* ---------------------------------------------------------------------
   14) INIT PREMIUM FEATURES (after original init() has already run
       via script.js's own DOMContentLoaded listener)
--------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  initLockFeature();
  renderReminders();
});
