/* app.js — Finanzio core application */

/* ===========================
   STATE
   =========================== */
let currentView = 'dashboard';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let allTransactions = [];
let allBudgets = [];
let allReminders = [];
let superItems = [];
let superHistory = [];
let editingTxId = null;
let ticketDataUrl = null;
let selectedCategory = '';
let gastosCatFilter = 'all';
let casaCatFilter = 'all';
let deferredInstall = null;

const GASTO_CATS = ['Comida','Transporte','Salud','Ocio','Ropa','Educación','Otros'];
const CASA_CATS = ['Luz','Gas','Agua','Internet','Arreglo','Otros'];
const CAT_ICONS = {
  Comida:'🍔', Transporte:'🚗', Salud:'💊', Ocio:'🎮', Ropa:'👕',
  Educación:'📚', Otros:'💸', Luz:'💡', Gas:'🔥', Agua:'💧',
  Internet:'📡', Arreglo:'🔧', 'Casa':'🏠', 'Ingreso':'💵',
};

/* ===========================
   INIT
   =========================== */
window.addEventListener('DOMContentLoaded', async () => {
  applyTheme(await getSetting('theme', 'auto'));
  await loadAll();
  setupThemeToggle();
  setupInstallBanner();
  setupDateDefault();
  setupSuperHandlers();
  setupBudgetHandlers();
  setupFilterChips();
  setupTicketUpload();
  navigate('dashboard');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

async function loadAll() {
  allTransactions = await dbGetAll('transactions');
  allBudgets = await dbGetAll('budget');
  allReminders = await dbGetAll('reminders');
  superItems = await dbGetAll('super_items');
  superHistory = await dbGetAll('super_history');
}

/* ===========================
   NAVIGATION
   =========================== */
function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (navBtn) navBtn.classList.add('active');

  const backBtn = document.getElementById('back-btn');
  const brand = document.getElementById('header-brand');
  const pageTitleEl = document.getElementById('page-title');
  const titles = {
    dashboard: 'Finanzio', gastos: 'Gastos', ingresos: 'Ingresos',
    super: 'Supermercado', casa: 'Casa & Hogar', presupuesto: 'Presupuesto',
    recordatorios: 'Recordatorios'
  };

  if (view === 'dashboard') {
    backBtn.classList.add('hidden');
    brand.classList.remove('hidden');
    pageTitleEl.classList.add('hidden');
  } else {
    backBtn.classList.remove('hidden');
    brand.classList.add('hidden');
    pageTitleEl.classList.remove('hidden');
    pageTitleEl.textContent = titles[view] || view;
  }
  currentView = view;
  renderView(view);
  document.getElementById('main-content').scrollTop = 0;
}

function renderView(view) {
  switch(view) {
    case 'dashboard': renderDashboard(); break;
    case 'gastos': renderTransactionList('gastos'); break;
    case 'ingresos': renderTransactionList('ingresos'); break;
    case 'super': renderSuper(); break;
    case 'casa': renderTransactionList('casa'); break;
    case 'presupuesto': renderPresupuesto(); break;
    case 'recordatorios': renderRecordatorios(); break;
  }
}

/* ===========================
   DASHBOARD
   =========================== */
function renderDashboard() {
  const monthTxs = getMonthTransactions(currentMonth, currentYear);
  const gastos = monthTxs.filter(t => t.type === 'gasto' || t.type === 'casa');
  const ingresos = monthTxs.filter(t => t.type === 'ingreso');
  const totalGastos = gastos.reduce((s, t) => s + t.amount, 0);
  const totalIngresos = ingresos.reduce((s, t) => s + t.amount, 0);
  const balance = totalIngresos - totalGastos;

  document.getElementById('month-label').textContent = formatMonthLabel(currentMonth, currentYear);
  document.getElementById('hero-balance').textContent = formatCurrency(balance);
  document.getElementById('hero-balance').style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('hero-income').textContent = formatCurrency(totalIngresos);
  document.getElementById('hero-expense').textContent = formatCurrency(totalGastos);

  renderHealthScore(totalGastos, totalIngresos, monthTxs.length);
  renderBudgetOverview(gastos);
  renderRecentList(monthTxs);
  renderNavCardSubs(gastos, ingresos, totalGastos, totalIngresos);
  renderTips(gastos, ingresos, totalGastos, totalIngresos);
}

function renderHealthScore(gastos, ingresos, txCount) {
  let score = 100;
  if (ingresos === 0 && txCount === 0) { score = 0; }
  else {
    if (ingresos > 0) {
      const ratio = gastos / ingresos;
      if (ratio > 1) score -= 40;
      else if (ratio > 0.8) score -= 20;
      else if (ratio > 0.6) score -= 10;
    }
    const budgetPenalty = calcBudgetPenalty(gastos);
    score -= budgetPenalty;
    if (txCount > 0) score = Math.max(score, 10);
  }
  score = Math.max(0, Math.min(100, score));

  const el = document.getElementById('health-score');
  const arc = document.getElementById('health-arc');
  const tip = document.getElementById('health-tip');
  const circumference = 138.2;

  el.textContent = score === 0 && allTransactions.length === 0 ? '--' : score;
  const offset = circumference - (circumference * score / 100);
  arc.style.strokeDashoffset = offset;

  let color = 'var(--green)';
  let tipText = '¡Excelente control de gastos!';
  if (score === 0 && allTransactions.length === 0) {
    color = 'var(--color-muted)'; tipText = 'Cargá tus datos para ver el score';
  } else if (score < 40) { color = 'var(--red)'; tipText = 'Tus gastos superan tus ingresos'; }
  else if (score < 60) { color = 'var(--amber)'; tipText = 'Cuidado, estás ajustado este mes'; }
  else if (score < 80) { color = 'var(--amber)'; tipText = 'Vas bien, pero podés mejorar'; }

  arc.style.stroke = color;
  document.documentElement.style.setProperty('--ring-fill', color);
  tip.textContent = tipText;
}

function calcBudgetPenalty(totalGastos) {
  if (allBudgets.length === 0) return 0;
  let penalty = 0;
  allBudgets.forEach(b => {
    const spent = getMonthTransactions(currentMonth, currentYear)
      .filter(t => t.category === b.category)
      .reduce((s, t) => s + t.amount, 0);
    if (spent > b.limit) penalty += 10;
    else if (spent > b.limit * 0.8) penalty += 5;
  });
  return Math.min(penalty, 30);
}

function renderBudgetOverview(gastos) {
  const container = document.getElementById('budget-bars-container');
  const empty = document.getElementById('budget-empty');
  if (allBudgets.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  container.innerHTML = allBudgets.map(b => {
    const spent = getMonthTransactions(currentMonth, currentYear)
      .filter(t => t.category === b.category)
      .reduce((s, t) => s + t.amount, 0);
    const pct = Math.min(100, Math.round((spent / b.limit) * 100));
    const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'ok';
    return `<div class="budget-bar-item">
      <div class="budget-bar-header">
        <span class="budget-bar-cat">${b.category}</span>
        <span class="budget-bar-amounts">${formatCurrency(spent)} / ${formatCurrency(b.limit)} (${pct}%)</span>
      </div>
      <div class="budget-bar-track"><div class="budget-bar-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderRecentList(txs) {
  const container = document.getElementById('recent-list');
  const sorted = [...txs].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 6);
  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="4" y="8" width="32" height="24" rx="4" stroke="var(--color-muted)" stroke-width="1.5"/><path d="M4 15h32" stroke="var(--color-muted)" stroke-width="1.5"/><path d="M10 22h8M10 26h5" stroke="var(--color-muted)" stroke-width="1.5" stroke-linecap="round"/></svg>
      <p>Todavía no hay movimientos este mes</p>
      <button class="btn-primary" onclick="openAddModal('gasto')">+ Agregar gasto</button>
    </div>`;
    return;
  }
  container.innerHTML = sorted.map(t => txItemHTML(t, false)).join('');
}

function renderNavCardSubs(gastos, ingresos, totalGastos, totalIngresos) {
  document.getElementById('nc-gastos').textContent = `${formatCurrency(totalGastos)} este mes`;
  document.getElementById('nc-ingresos').textContent = `${formatCurrency(totalIngresos)} este mes`;
  const casaTxs = getMonthTransactions(currentMonth, currentYear).filter(t => t.type === 'casa');
  const casaTotal = casaTxs.reduce((s,t) => s+t.amount, 0);
  document.getElementById('nc-casa').textContent = `${formatCurrency(casaTotal)} este mes`;

  const activeItems = superItems.filter(i => !i.checked);
  document.getElementById('nc-super').textContent = activeItems.length > 0
    ? `${activeItems.length} items en lista` : 'Sin lista activa';

  if (allBudgets.length === 0) {
    document.getElementById('nc-presupuesto').textContent = 'Sin configurar';
  } else {
    const over = allBudgets.filter(b => {
      const spent = getMonthTransactions(currentMonth, currentYear)
        .filter(t => t.category === b.category).reduce((s,t) => s+t.amount, 0);
      return spent > b.limit;
    }).length;
    document.getElementById('nc-presupuesto').textContent = over > 0
      ? `${over} categoría${over>1?'s':''} excedida${over>1?'s':''}` : 'Todo en orden';
  }

  const pending = allReminders.filter(r => !r.paid).length;
  document.getElementById('nc-recordatorios').textContent = pending > 0
    ? `${pending} pago${pending>1?'s':''} pendiente${pending>1?'s':''}` : 'Sin pendientes';

  const notifBadge = document.getElementById('notif-badge');
  if (pending > 0) {
    notifBadge.textContent = pending;
    notifBadge.classList.remove('hidden');
  } else {
    notifBadge.classList.add('hidden');
  }
}

function renderTips(gastos, ingresos, totalGastos, totalIngresos) {
  const container = document.getElementById('ai-tips-list');
  const tips = [];

  if (allTransactions.length === 0) {
    tips.push({ e:'👋', t:'<strong>Bienvenido a Finanzio.</strong> Empezá registrando tu primer gasto usando el botón + en el centro.' });
    tips.push({ e:'💡', t:'<strong>Consejo:</strong> Configurá tu presupuesto mensual para que te avisemos cuando te estés pasando.' });
    tips.push({ e:'📸', t:'<strong>Guardá tus tickets:</strong> Podés sacar foto al comprobante cuando registrás un gasto.' });
  } else {
    if (totalGastos > totalIngresos && totalIngresos > 0) {
      tips.push({ e:'⚠️', t:`<strong>Atención:</strong> Gastaste ${formatCurrency(totalGastos - totalIngresos)} más de lo que ingresaste este mes.` });
    }
    if (allBudgets.length === 0 && allTransactions.length >= 3) {
      tips.push({ e:'📊', t:'<strong>Configurá tu presupuesto.</strong> Ya tenés movimientos. Poné un límite por categoría para mejor control.' });
    }
    const topCat = getTopCategory(getMonthTransactions(currentMonth, currentYear));
    if (topCat) {
      tips.push({ e:'📈', t:`Tu mayor gasto este mes fue en <strong>${topCat.category}</strong> con ${formatCurrency(topCat.total)}.` });
    }
    if (totalIngresos > 0) {
      const savingPct = Math.max(0, Math.round(((totalIngresos - totalGastos) / totalIngresos) * 100));
      if (savingPct > 20) tips.push({ e:'🎉', t:`<strong>Muy bien:</strong> estás ahorrando el ${savingPct}% de tus ingresos este mes.` });
      else if (savingPct <= 5 && savingPct >= 0) tips.push({ e:'💰', t:'Intentá reservar al menos el 10% de tus ingresos al principio del mes antes de gastar.' });
    }
    const urgentReminders = allReminders.filter(r => !r.paid && isUrgent(r.dueDate));
    if (urgentReminders.length > 0) {
      tips.push({ e:'🔔', t:`<strong>Tenés ${urgentReminders.length} vencimiento${urgentReminders.length>1?'s':''} próximo${urgentReminders.length>1?'s':''}.</strong> Revisá los recordatorios.` });
    }
  }
  container.innerHTML = tips.map(t => `<div class="tip-item"><span class="tip-emoji">${t.e}</span><p class="tip-text">${t.t}</p></div>`).join('');
}

/* ===========================
   TRANSACTION LISTS
   =========================== */
function renderTransactionList(view) {
  let txs, containerId, type;
  if (view === 'gastos') {
    txs = getMonthTransactions(currentMonth, currentYear).filter(t => t.type === 'gasto');
    if (gastosCatFilter !== 'all') txs = txs.filter(t => t.category === gastosCatFilter);
    containerId = 'gastos-list';
  } else if (view === 'ingresos') {
    txs = getMonthTransactions(currentMonth, currentYear).filter(t => t.type === 'ingreso');
    containerId = 'ingresos-list';
  } else if (view === 'casa') {
    txs = getMonthTransactions(currentMonth, currentYear).filter(t => t.type === 'casa');
    if (casaCatFilter !== 'all') txs = txs.filter(t => t.category === casaCatFilter);
    containerId = 'casa-list';
  }
  const container = document.getElementById(containerId);
  txs.sort((a,b) => b.date.localeCompare(a.date));
  if (txs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="4" y="8" width="32" height="24" rx="4" stroke="var(--color-muted)" stroke-width="1.5"/><path d="M4 15h32" stroke="var(--color-muted)" stroke-width="1.5"/><path d="M10 22h8M10 26h5" stroke="var(--color-muted)" stroke-width="1.5" stroke-linecap="round"/></svg>
      <p>No hay registros este mes</p>
      <button class="btn-primary" onclick="openAddModal('${view === 'ingresos' ? 'ingreso' : view === 'casa' ? 'casa' : 'gasto'}')">+ Agregar</button>
    </div>`;
    return;
  }
  container.innerHTML = txs.map(t => txItemHTML(t, true)).join('');
}

function txItemHTML(t, showActions) {
  const icon = CAT_ICONS[t.category] || (t.type === 'ingreso' ? '💵' : '💸');
  const amountClass = t.type === 'ingreso' ? 'pos' : 'neg';
  const sign = t.type === 'ingreso' ? '+' : '-';
  const ticket = t.ticket ? `<img src="${t.ticket}" class="tx-ticket-thumb" alt="Ticket" onclick="viewTicket('${t.ticket}')" />` : '';
  const actions = showActions ? `<div class="tx-actions">
    <button class="tx-action-btn" onclick="openEditModal(${t.id})">Editar</button>
    <button class="tx-action-btn del" onclick="deleteTransaction(${t.id})">Eliminar</button>
  </div>` : '';
  return `<div class="tx-item" data-id="${t.id}">
    <div class="tx-icon" style="background:var(--surface-2)">${icon}</div>
    <div class="tx-info">
      <p class="tx-desc">${t.description || t.category || 'Sin descripción'}</p>
      <p class="tx-meta">${formatDate(t.date)} · ${t.category || ''}</p>
      ${actions}
    </div>
    <div class="tx-right">
      <p class="tx-amount ${amountClass}">${sign}${formatCurrency(t.amount)}</p>
      ${ticket}
    </div>
  </div>`;
}

/* ===========================
   SUPERMERCADO
   =========================== */
function renderSuper() {
  const list = document.getElementById('super-list');
  if (superItems.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:24px">
      <p>La lista está vacía.<br>Agregá productos abajo.</p>
    </div>`;
  } else {
    list.innerHTML = superItems.map(item => `
      <div class="super-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
        <button class="super-check" onclick="toggleSuperItem(${item.id})" aria-label="Tildar">
          ${item.checked ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </button>
        <span class="super-item-name">${escHtml(item.name)}</span>
        <span class="super-item-price">${item.price ? formatCurrency(item.price) : ''}</span>
        <button class="super-item-del" onclick="deleteSuperItem(${item.id})" aria-label="Eliminar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>`).join('');
  }
  updateSuperStats();
  renderSuperHistory();
}

function updateSuperStats() {
  const total = superItems.length;
  const checked = superItems.filter(i => i.checked).length;
  const totalPrice = superItems.filter(i => i.checked && i.price).reduce((s,i) => s + i.price, 0);
  document.getElementById('super-checked-count').textContent = `${checked} / ${total} items`;
  document.getElementById('super-total-price').textContent = `${formatCurrency(totalPrice)} marcado`;
}

function renderSuperHistory() {
  const container = document.getElementById('super-history-list');
  const sorted = [...superHistory].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (sorted.length === 0) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-3);padding:8px 0">No hay compras previas</p>';
    return;
  }
  container.innerHTML = sorted.map(h => `
    <div class="history-item">
      <div class="history-item-info">
        <p class="history-item-date">${formatDate(h.date)}</p>
        <p class="history-item-count">${h.itemCount} productos</p>
      </div>
      <span class="history-item-total">${formatCurrency(h.total)}</span>
    </div>`).join('');
}

function setupSuperHandlers() {
  document.getElementById('super-add-btn').addEventListener('click', addSuperItem);
  document.getElementById('super-item-input').addEventListener('keydown', e => { if (e.key === 'Enter') addSuperItem(); });
  document.getElementById('clear-checked-btn').addEventListener('click', clearCheckedItems);
}

async function addSuperItem() {
  const nameInput = document.getElementById('super-item-input');
  const priceInput = document.getElementById('super-price-input');
  const name = nameInput.value.trim();
  if (!name) return;
  const price = parseFloat(priceInput.value) || 0;
  const item = { name, price: price || null, checked: false, addedAt: new Date().toISOString() };
  const id = await dbAdd('super_items', item);
  item.id = id;
  superItems.push(item);
  nameInput.value = ''; priceInput.value = '';
  nameInput.focus();
  renderSuper();
}

async function toggleSuperItem(id) {
  const item = superItems.find(i => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  await dbPut('super_items', item);
  renderSuper();
}

async function deleteSuperItem(id) {
  await dbDelete('super_items', id);
  superItems = superItems.filter(i => i.id !== id);
  renderSuper();
}

async function clearCheckedItems() {
  const checked = superItems.filter(i => i.checked);
  if (checked.length === 0) { showToast('No hay items tildados'); return; }
  const total = checked.filter(i => i.price).reduce((s,i) => s + i.price, 0);
  const historyEntry = {
    date: new Date().toISOString().split('T')[0],
    itemCount: checked.length, total,
    items: checked.map(i => ({ name: i.name, price: i.price }))
  };
  await dbAdd('super_history', historyEntry);
  superHistory.push(historyEntry);
  for (const item of checked) { await dbDelete('super_items', item.id); }
  superItems = superItems.filter(i => !i.checked);
  showToast(`${checked.length} items guardados en historial`);
  renderSuper();
}

/* ===========================
   PRESUPUESTO
   =========================== */
function renderPresupuesto() {
  const container = document.getElementById('presupuesto-items');
  if (allBudgets.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:16px 0">
      <p>No hay categorías configuradas todavía</p>
    </div>`;
    return;
  }
  const monthTxs = getMonthTransactions(currentMonth, currentYear);
  container.innerHTML = allBudgets.map(b => {
    const spent = monthTxs.filter(t => t.category === b.category).reduce((s,t) => s+t.amount, 0);
    const pct = Math.min(100, Math.round((spent / b.limit) * 100));
    const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'ok';
    return `<div class="budget-config-item">
      <div class="budget-config-header">
        <span class="budget-config-cat">${CAT_ICONS[b.category] || '💰'} ${b.category}</span>
        <div style="display:flex;gap:6px">
          <button class="budget-edit-btn" onclick="editBudget('${b.category}')">Editar</button>
          <button class="budget-del-btn" onclick="deleteBudget('${b.category}')">Eliminar</button>
        </div>
      </div>
      <div class="budget-bar-track" style="margin-bottom:6px"><div class="budget-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <p class="budget-config-meta">${formatCurrency(spent)} gastado de ${formatCurrency(b.limit)} (${pct}%)</p>
    </div>`;
  }).join('');
}

function setupBudgetHandlers() {
  document.getElementById('add-budget-category-btn').addEventListener('click', () => {
    document.getElementById('budget-edit-cat').value = '';
    document.getElementById('budget-cat').value = '';
    document.getElementById('budget-limit').value = '';
    document.getElementById('budget-modal-overlay').classList.remove('hidden');
  });
}

async function submitBudget(e) {
  e.preventDefault();
  const cat = document.getElementById('budget-cat').value;
  const limit = parseFloat(document.getElementById('budget-limit').value);
  if (!cat || !limit) return;
  const entry = { category: cat, limit };
  await dbPut('budget', entry);
  const idx = allBudgets.findIndex(b => b.category === cat);
  if (idx >= 0) allBudgets[idx] = entry; else allBudgets.push(entry);
  closeBudgetModal();
  renderPresupuesto();
  showToast('Presupuesto guardado');
}

async function deleteBudget(cat) {
  await dbDelete('budget', cat);
  allBudgets = allBudgets.filter(b => b.category !== cat);
  renderPresupuesto();
  if (currentView === 'dashboard') renderDashboard();
  showToast('Categoría eliminada');
}

function editBudget(cat) {
  const b = allBudgets.find(b => b.category === cat);
  if (!b) return;
  document.getElementById('budget-edit-cat').value = cat;
  document.getElementById('budget-cat').value = cat;
  document.getElementById('budget-limit').value = b.limit;
  document.getElementById('budget-modal-overlay').classList.remove('hidden');
}

function closeBudgetModal(e) {
  if (e && e.target !== document.getElementById('budget-modal-overlay')) return;
  document.getElementById('budget-modal-overlay').classList.add('hidden');
}

/* ===========================
   RECORDATORIOS
   =========================== */
function renderRecordatorios() {
  const container = document.getElementById('recordatorios-list');
  const sorted = [...allReminders].sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <p>No hay recordatorios de pago</p>
      <button class="btn-primary" onclick="openAddModal('recordatorio')">+ Agregar recordatorio</button>
    </div>`;
    return;
  }
  container.innerHTML = sorted.map(r => {
    const urgent = isUrgent(r.dueDate);
    const soon = isSoon(r.dueDate);
    const dotClass = r.paid ? 'ok' : urgent ? 'urgent' : soon ? 'soon' : 'ok';
    return `<div class="reminder-item tx-list padded" style="margin-bottom:8px">
      <div class="reminder-dot ${dotClass}"></div>
      <div class="reminder-info">
        <p class="reminder-name">${escHtml(r.name)}</p>
        <p class="reminder-date">Vence: ${formatDate(r.dueDate)}${r.paid ? ' · <span style="color:var(--green)">Pagado</span>' : ''}</p>
        <div style="display:flex;gap:8px;margin-top:6px">
          ${!r.paid ? `<button class="tx-action-btn" onclick="markReminderPaid(${r.id})">Marcar pagado</button>` : ''}
          <button class="tx-action-btn del" onclick="deleteReminder(${r.id})">Eliminar</button>
        </div>
      </div>
      <span class="reminder-amount">${r.amount ? formatCurrency(r.amount) : ''}</span>
    </div>`;
  }).join('');
}

async function deleteReminder(id) {
  await dbDelete('reminders', id);
  allReminders = allReminders.filter(r => r.id !== id);
  renderRecordatorios();
  renderDashboard();
  showToast('Recordatorio eliminado');
}

async function markReminderPaid(id) {
  const r = allReminders.find(r => r.id === id);
  if (!r) return;
  r.paid = true;
  await dbPut('reminders', r);
  renderRecordatorios();
  renderDashboard();
  showToast('Marcado como pagado ✓');
}

/* ===========================
   ADD / EDIT MODAL
   =========================== */
function openAddModal(type) {
  editingTxId = null;
  ticketDataUrl = null;
  const modalTitle = { gasto: 'Nuevo gasto', ingreso: 'Nuevo ingreso', casa: 'Gasto de casa', recordatorio: 'Nuevo recordatorio' };
  document.getElementById('modal-title').textContent = modalTitle[type] || 'Nuevo';
  document.getElementById('tx-type').value = type;
  document.getElementById('edit-id').value = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-desc').value = '';
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ticket-preview').classList.add('hidden');
  document.getElementById('ticket-actions-row').classList.remove('hidden');
  document.getElementById('ticket-remove').classList.add('hidden');
  document.getElementById('ocr-result').classList.add('hidden');
  document.getElementById('ocr-status').classList.add('hidden');

  const isReminder = type === 'recordatorio';
  document.getElementById('group-reminder').classList.toggle('hidden', !isReminder);
  document.getElementById('group-categoria').classList.toggle('hidden', isReminder);
  document.getElementById('group-foto').classList.toggle('hidden', isReminder || type === 'ingreso');
  document.getElementById('tx-amount').parentElement.parentElement.classList.toggle('hidden', isReminder);

  renderCategoryChips(type);
  selectedCategory = '';
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('tx-amount').focus(), 300);
}

async function openEditModal(id) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;
  editingTxId = id;
  ticketDataUrl = tx.ticket || null;
  document.getElementById('modal-title').textContent = 'Editar movimiento';
  document.getElementById('tx-type').value = tx.type;
  document.getElementById('edit-id').value = id;
  document.getElementById('tx-amount').value = tx.amount;
  document.getElementById('tx-desc').value = tx.description || '';
  document.getElementById('tx-date').value = tx.date;
  document.getElementById('group-reminder').classList.add('hidden');
  document.getElementById('group-categoria').classList.remove('hidden');
  document.getElementById('group-foto').classList.remove('hidden');
  document.getElementById('tx-amount').parentElement.parentElement.classList.remove('hidden');

  if (tx.ticket) {
    document.getElementById('ticket-preview').src = tx.ticket;
    document.getElementById('ticket-preview').classList.remove('hidden');
    document.getElementById('ticket-actions-row').classList.add('hidden');
    document.getElementById('ticket-remove').classList.remove('hidden');
  } else {
    document.getElementById('ticket-preview').classList.add('hidden');
    document.getElementById('ticket-actions-row').classList.remove('hidden');
    document.getElementById('ticket-remove').classList.add('hidden');
  }
  document.getElementById('ocr-result').classList.add('hidden');
  document.getElementById('ocr-status').classList.add('hidden');

  renderCategoryChips(tx.type);
  selectedCategory = tx.category || '';
  document.querySelectorAll('#category-chips-modal .cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === selectedCategory);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function renderCategoryChips(type) {
  const cats = type === 'casa' ? CASA_CATS : type === 'ingreso' ? ['Sueldo','Freelance','Venta','Otro ingreso'] : GASTO_CATS;
  const container = document.getElementById('category-chips-modal');
  container.innerHTML = cats.map(c => `<button type="button" class="cat-chip" data-value="${c}" onclick="selectCategory('${c}')">${c}</button>`).join('');
}

function selectCategory(cat) {
  selectedCategory = cat;
  document.querySelectorAll('#category-chips-modal .cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === cat);
  });
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

async function submitTransaction(e) {
  e.preventDefault();
  const type = document.getElementById('tx-type').value;

  if (type === 'recordatorio') {
    const name = document.getElementById('reminder-name').value.trim();
    const dueDate = document.getElementById('reminder-date').value;
    const amount = parseFloat(document.getElementById('reminder-amount').value) || 0;
    if (!name || !dueDate) { showToast('Completá nombre y fecha'); return; }
    const reminder = { name, dueDate, amount, paid: false, createdAt: new Date().toISOString() };
    const id = await dbAdd('reminders', reminder);
    reminder.id = id;
    allReminders.push(reminder);
    document.getElementById('modal-overlay').classList.add('hidden');
    showToast('Recordatorio agregado');
    if (currentView === 'recordatorios') renderRecordatorios();
    if (currentView === 'dashboard') renderDashboard();
    return;
  }

  const amount = parseFloat(document.getElementById('tx-amount').value);
  if (!amount || amount <= 0) { showToast('Ingresá un monto válido'); return; }
  const desc = document.getElementById('tx-desc').value.trim();
  const date = document.getElementById('tx-date').value;

  const tx = {
    type, amount, description: desc, category: selectedCategory,
    date, ticket: ticketDataUrl || null,
    createdAt: new Date().toISOString()
  };

  if (editingTxId) {
    tx.id = editingTxId;
    await dbPut('transactions', tx);
    const idx = allTransactions.findIndex(t => t.id === editingTxId);
    if (idx >= 0) allTransactions[idx] = tx;
    showToast('Movimiento actualizado');
  } else {
    const id = await dbAdd('transactions', tx);
    tx.id = id;
    allTransactions.push(tx);
    showToast('Guardado ✓');
  }

  document.getElementById('modal-overlay').classList.add('hidden');
  renderView(currentView);
  if (currentView !== 'dashboard') renderDashboard();
}

async function deleteTransaction(id) {
  await dbDelete('transactions', id);
  allTransactions = allTransactions.filter(t => t.id !== id);
  renderView(currentView);
  if (currentView !== 'dashboard') renderDashboard();
  showToast('Eliminado');
}

/* ===========================
   TICKET UPLOAD + OCR
   =========================== */
function setupTicketUpload() {
  document.getElementById('ticket-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      ticketDataUrl = ev.target.result;
      showTicketPreview();
    };
    reader.readAsDataURL(file);
  });
}

function showTicketPreview() {
  document.getElementById('ticket-preview').src = ticketDataUrl;
  document.getElementById('ticket-preview').classList.remove('hidden');
  document.getElementById('ticket-actions-row').classList.add('hidden');
  document.getElementById('ticket-remove').classList.remove('hidden');
}

/* ===========================
   ACTION SHEET (FAB +)
   =========================== */
function openActionSheet() {
  document.getElementById('action-sheet-overlay').classList.remove('hidden');
}
function closeActionSheet(e) {
  if (e && e.target !== document.getElementById('action-sheet-overlay')) return;
  document.getElementById('action-sheet-overlay').classList.add('hidden');
}
function actionSelect(type) {
  closeActionSheet();
  setTimeout(() => openAddModal(type), 200);
}

async function scanTicket() {
  // Fallback Tesseract local
  if (typeof Tesseract === 'undefined') {
    showToast('Esperá unos segundos, cargando motor de escaneo...');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      ticketDataUrl = ev.target.result;
      showTicketPreview();
      await runOCR(ticketDataUrl);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

/* ===========================
   GROQ AI VISION
   =========================== */
async function scanTicketAI() {
  const apiKey = await getSetting('groqApiKey');
  if (!apiKey) {
    showToast('Configurá tu API key primero');
    closeModal();
    setTimeout(() => openSettingsModal(), 300);
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      ticketDataUrl = ev.target.result;
      showTicketPreview();
      await runGroqOCR(ticketDataUrl, apiKey);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function runGroqOCR(imageDataUrl, apiKey) {
  const statusEl = document.getElementById('ocr-status');
  const resultEl = document.getElementById('ocr-result');
  const titleEl = document.getElementById('ocr-title');
  const progressEl = document.getElementById('ocr-progress');

  resultEl.classList.add('hidden');
  statusEl.classList.remove('hidden');
  titleEl.textContent = 'Analizando ticket con IA...';
  progressEl.textContent = 'Conectando con Groq';

  try {
    const compressedImage = await compressImage(imageDataUrl, 1024, 0.8);
    progressEl.textContent = 'Enviando imagen...';

    const prompt = `Analizá esta imagen de un ticket o comprobante de compra argentino. Extraé la información y respondé ÚNICAMENTE con un JSON válido (sin texto adicional, sin markdown, sin explicaciones).

Formato exacto:
{
  "monto_total": 1234.56,
  "comercio": "Nombre del comercio",
  "fecha": "2025-06-09",
  "categoria_sugerida": "Comida",
  "items": ["Producto 1", "Producto 2"]
}

Reglas:
- monto_total debe ser el TOTAL FINAL del ticket (no subtotal ni items individuales), como número decimal sin símbolos
- comercio: nombre que aparece arriba del ticket o más prominente
- fecha en formato YYYY-MM-DD; si no la encontrás, usá la de hoy
- categoria_sugerida debe ser UNA de: Comida, Transporte, Salud, Ocio, Ropa, Educación, Luz, Gas, Agua, Internet, Arreglo, Otros
- items: lista corta de los productos principales (máximo 5, nombres cortos)
- Si algún dato no se puede leer, usá null para ese campo (excepto monto_total)
- Respondé SOLO el JSON, nada más`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: compressedImage } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Respuesta vacía de Groq');

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No se pudo parsear la respuesta');
    }

    statusEl.classList.add('hidden');

    if (parsed.monto_total && !isNaN(parsed.monto_total)) {
      const amount = parseFloat(parsed.monto_total);
      document.getElementById('tx-amount').value = amount.toFixed(2);
      document.getElementById('ocr-result-amount').textContent = formatCurrency(amount);
      resultEl.classList.remove('hidden');

      const descField = document.getElementById('tx-desc');
      if (!descField.value && parsed.comercio) {
        descField.value = parsed.comercio.substring(0, 80);
      }

      if (parsed.fecha && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) {
        document.getElementById('tx-date').value = parsed.fecha;
      }

      if (parsed.categoria_sugerida && !selectedCategory) {
        const type = document.getElementById('tx-type').value;
        const validCats = type === 'casa' ? CASA_CATS : GASTO_CATS;
        if (validCats.includes(parsed.categoria_sugerida)) {
          selectCategory(parsed.categoria_sugerida);
        }
      }

      showToast(`✨ IA detectó ${formatCurrency(amount)}`);
    } else {
      showToast('No se pudo detectar el importe. Cargalo a mano.');
    }
  } catch (err) {
    statusEl.classList.add('hidden');
    console.error('Groq error:', err);
    if (err.message.includes('401')) {
      showToast('❌ API key inválida. Revisá la configuración.');
    } else if (err.message.includes('429')) {
      showToast('⏱️ Límite de uso alcanzado. Probá en un minuto.');
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      showToast('❌ Sin internet. Probá "Solo foto" o revisá tu conexión.');
    } else {
      showToast('Error al analizar. Intentá de nuevo o cargá a mano.');
    }
  }
}

async function compressImage(dataUrl, maxWidth = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/* ===========================
   SETTINGS / API KEY
   =========================== */
async function openSettingsModal() {
  const key = await getSetting('groqApiKey');
  const input = document.getElementById('groq-api-key');
  if (key) {
    input.value = key;
    document.getElementById('api-key-set').classList.remove('hidden');
    document.getElementById('api-key-not-set').classList.add('hidden');
    document.getElementById('clear-key-btn').classList.remove('hidden');
  } else {
    input.value = '';
    document.getElementById('api-key-set').classList.add('hidden');
    document.getElementById('api-key-not-set').classList.remove('hidden');
    document.getElementById('clear-key-btn').classList.add('hidden');
  }
  document.getElementById('api-instructions').classList.add('hidden');
  document.getElementById('settings-modal-overlay').classList.remove('hidden');
}

function closeSettingsModal(e) {
  if (e && e.target !== document.getElementById('settings-modal-overlay')) return;
  document.getElementById('settings-modal-overlay').classList.add('hidden');
}

function toggleInstructions() {
  const box = document.getElementById('api-instructions');
  box.classList.toggle('hidden');
}

async function saveGroqKey() {
  const key = document.getElementById('groq-api-key').value.trim();
  if (!key) { showToast('Pegá una API key primero'); return; }
  if (!key.startsWith('gsk_')) {
    showToast('La key debe empezar con "gsk_"');
    return;
  }
  await setSetting('groqApiKey', key);
  document.getElementById('api-key-set').classList.remove('hidden');
  document.getElementById('api-key-not-set').classList.add('hidden');
  document.getElementById('clear-key-btn').classList.remove('hidden');
  showToast('✅ Clave guardada');
}

async function testGroqKey() {
  const key = document.getElementById('groq-api-key').value.trim();
  if (!key) { showToast('Pegá la key primero'); return; }
  showToast('Probando conexión...');
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (response.ok) {
      showToast('✅ Conexión OK — guardá la clave');
    } else if (response.status === 401) {
      showToast('❌ Clave inválida');
    } else {
      showToast(`Error ${response.status}`);
    }
  } catch (err) {
    showToast('❌ Sin internet o error de red');
  }
}

async function clearGroqKey() {
  if (!confirm('¿Borrar la API key guardada? Vas a tener que pegarla de nuevo para usar IA.')) return;
  await setSetting('groqApiKey', null);
  document.getElementById('groq-api-key').value = '';
  document.getElementById('api-key-set').classList.add('hidden');
  document.getElementById('api-key-not-set').classList.remove('hidden');
  document.getElementById('clear-key-btn').classList.add('hidden');
  showToast('Clave eliminada');
}

async function runOCR(imageDataUrl) {
  const statusEl = document.getElementById('ocr-status');
  const resultEl = document.getElementById('ocr-result');
  const titleEl = document.getElementById('ocr-title');
  const progressEl = document.getElementById('ocr-progress');

  resultEl.classList.add('hidden');
  statusEl.classList.remove('hidden');
  titleEl.textContent = 'Leyendo ticket...';
  progressEl.textContent = 'Iniciando...';

  try {
    const result = await Tesseract.recognize(imageDataUrl, 'spa', {
      logger: m => {
        if (m.status === 'recognizing text') {
          progressEl.textContent = Math.round(m.progress * 100) + '%';
        } else if (m.status === 'loading language traineddata') {
          titleEl.textContent = 'Descargando idioma (1ra vez, demora un poco)';
        } else if (m.status === 'initializing api') {
          titleEl.textContent = 'Preparando lectura...';
        }
      }
    });
    const text = result.data.text;
    const amount = extractAmount(text);
    statusEl.classList.add('hidden');
    if (amount) {
      document.getElementById('tx-amount').value = amount.toFixed(2);
      document.getElementById('ocr-result-amount').textContent = formatCurrency(amount);
      resultEl.classList.remove('hidden');
      showToast('Importe detectado: ' + formatCurrency(amount));
      const descField = document.getElementById('tx-desc');
      if (!descField.value) {
        const merchant = extractMerchant(text);
        if (merchant) descField.value = merchant;
      }
    } else {
      showToast('No se pudo detectar el importe. Cargalo a mano.');
    }
  } catch (err) {
    statusEl.classList.add('hidden');
    showToast('Error al leer la foto');
    console.error('OCR error:', err);
  }
}

function extractAmount(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const candidates = [];

  const priorityKeywords = /\b(total|importe|total\s*a\s*pagar|a\s*pagar|monto)\b/i;
  const negativeKeywords = /\b(subtotal|descuento|vuelto|cambio|efectivo\s*entregado|saldo|iva)\b/i;

  const moneyRegex = /\$?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)/g;

  lines.forEach((line, idx) => {
    const hasPriority = priorityKeywords.test(line);
    const hasNegative = negativeKeywords.test(line);
    let match;
    moneyRegex.lastIndex = 0;
    while ((match = moneyRegex.exec(line)) !== null) {
      const raw = match[1];
      const num = parseAmountString(raw);
      if (num === null || num < 1 || num > 100000000) continue;
      let score = 0;
      if (hasPriority) score += 100;
      if (hasNegative) score -= 50;
      if (idx >= lines.length - 5) score += 20;
      score += Math.log10(num + 1) * 5;
      if (line.includes('$')) score += 10;
      candidates.push({ amount: num, score, line });
    }
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].amount;
}

function parseAmountString(s) {
  if (!s) return null;
  let clean = s.replace(/\s/g, '');
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  if (lastComma > lastDot) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    clean = clean.replace(/,/g, '');
  } else {
    clean = clean.replace(/[.,]/g, '');
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function extractMerchant(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length >= 3);
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i];
    if (/^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s\.&]{2,30}$/.test(line) && !/[0-9]/.test(line)) {
      return line.substring(0, 40);
    }
  }
  return null;
}

function removeTicket() {
  ticketDataUrl = null;
  document.getElementById('ticket-file').value = '';
  document.getElementById('ticket-preview').classList.add('hidden');
  document.getElementById('ticket-actions-row').classList.remove('hidden');
  document.getElementById('ticket-remove').classList.add('hidden');
  document.getElementById('ocr-result').classList.add('hidden');
  document.getElementById('ocr-status').classList.add('hidden');
}

function viewTicket(src) {
  document.getElementById('img-viewer-src').src = src;
  document.getElementById('img-viewer').classList.remove('hidden');
}
function closeImgViewer() {
  document.getElementById('img-viewer').classList.add('hidden');
}

/* ===========================
   MONTH NAV
   =========================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    if (currentView === 'dashboard') renderDashboard();
    else renderView(currentView);
  });
  document.getElementById('next-month').addEventListener('click', () => {
    const now = new Date();
    if (currentYear === now.getFullYear() && currentMonth === now.getMonth()) return;
    currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    if (currentView === 'dashboard') renderDashboard();
    else renderView(currentView);
  });
});

/* ===========================
   FILTER CHIPS
   =========================== */
function setupFilterChips() {
  document.getElementById('gastos-filter-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    gastosCatFilter = chip.dataset.cat;
    document.querySelectorAll('#gastos-filter-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderTransactionList('gastos');
  });
  document.getElementById('casa-filter-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    casaCatFilter = chip.dataset.cat;
    document.querySelectorAll('#casa-filter-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderTransactionList('casa');
  });
}

/* ===========================
   THEME
   =========================== */
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', async () => {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    applyTheme(next);
    await setSetting('theme', next);
  });
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.getElementById('icon-sun').classList.toggle('hidden', isDark);
  document.getElementById('icon-moon').classList.toggle('hidden', !isDark);
  const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])') || document.createElement('meta');
  metaTheme.name = 'theme-color';
  metaTheme.content = isDark ? '#0F0F1A' : '#F8F9FC';
  if (!metaTheme.parentNode) document.head.appendChild(metaTheme);
}

/* ===========================
   INSTALL BANNER (PWA)
   =========================== */
function setupInstallBanner() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    document.getElementById('install-banner').classList.remove('hidden');
  });
  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    deferredInstall = null;
    document.getElementById('install-banner').classList.add('hidden');
  });
  document.getElementById('install-dismiss').addEventListener('click', () => {
    document.getElementById('install-banner').classList.add('hidden');
  });
}

/* ===========================
   UTILS
   =========================== */
function setupDateDefault() {
  const d = document.getElementById('tx-date');
  if (d) d.value = new Date().toISOString().split('T')[0];
}

function getMonthTransactions(month, year) {
  return allTransactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

function formatCurrency(amount) {
  if (isNaN(amount)) return '$0';
  return '$' + Math.abs(amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function formatMonthLabel(month, year) {
  return new Date(year, month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function isUrgent(dateStr) {
  if (!dateStr) return false;
  const diff = (new Date(dateStr) - new Date()) / 86400000;
  return diff <= 3 && diff >= 0;
}

function isSoon(dateStr) {
  if (!dateStr) return false;
  const diff = (new Date(dateStr) - new Date()) / 86400000;
  return diff > 3 && diff <= 7;
}

function getTopCategory(txs) {
  const gastos = txs.filter(t => t.type !== 'ingreso' && t.category);
  const map = {};
  gastos.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
  const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]);
  if (sorted.length === 0) return null;
  return { category: sorted[0][0], total: sorted[0][1] };
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden', 'fade-out');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    t.classList.add('fade-out');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, 2200);
}
