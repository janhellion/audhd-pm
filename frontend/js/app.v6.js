/* =========================================================================
   Niki — Application Logic (v2)
   Dashboard redesign · Calendar · Recurring · Search · Undo · Mobile nav
   ========================================================================= */

const API = '/api';
let state = { view: 'dashboard', safeMode: false, energy: 'medium', toastTimer: null };

/* ── API ────────────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if (!r.ok) { const e = await r.text(); console.error('API error', r.status, e); throw new Error(e); }
  return r.json();
}
const get = (p) => api('GET', p);
const post = (p, b) => api('POST', p, b);
const put = (p, b) => api('PUT', p, b);
const del = (p) => api('DELETE', p);

/* ── View Switcher ──────────────────────────────────────────────────── */
function switchView(name) {
  state.view = name;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  document.querySelectorAll('.view-container').forEach(c => c.style.display = c.id === 'view-' + name ? '' : 'none');

  const titles = {
    dashboard: ['Dashboard', 'your landscape'],
    tasks: ['Tasks', 'all items'],
    board: ['Board', 'visual workflow'],
    calendar: ['Calendar', 'journal & plan'],
    projects: ['Projects', 'organise by context'],
    settings: ['Settings', 'preferences & admin'],
  };
  document.getElementById('viewTitle').textContent = titles[name][0];
  document.getElementById('viewSubtitle').textContent = titles[name][1];

  const actions = document.getElementById('topbarActions');
  if (name === 'tasks' || name === 'dashboard' || name === 'board' || name === 'calendar') {
    actions.innerHTML = '<button class="btn btn-orange" onclick="openQuickCapture()">+ New</button>';
  } else if (name === 'projects') {
    actions.innerHTML = '<button class="btn btn-orange" onclick="openNewProject()">+ New Project</button>';
  } else {
    actions.innerHTML = '';
  }
  renderView(name);
}

async function renderView(name) {
  const el = document.getElementById('view-' + name);
  if (!el) return;
  el.innerHTML = '<div class="text-muted" style="padding:2rem;text-align:center;">loading\u2026</div>';
  if (name === 'dashboard') await renderDashboard(el);
  else if (name === 'tasks') await renderTasks(el);
  else if (name === 'board') await renderBoard(el);
  else if (name === 'calendar') await renderCalendar(el);
  else if (name === 'projects') await renderProjects(el);
  else if (name === 'settings') await renderSettings(el);
}

/* ═══════════════════════════════════════════════════════════════════════
   ONBOARDING
   ═══════════════════════════════════════════════════════════════════════ */
function checkOnboarding() {
  if (localStorage.getItem('niki_onboarded')) return;
  setTimeout(() => {
    showToast('Quick tip: press \u2018n\u2019 to capture a task instantly', 5000);
    showToast('Drop a task in the Banana zone to make it your focus', 5000);
    localStorage.setItem('niki_onboarded', '1');
  }, 2000);
}

/* ═══════════════════════════════════════════════════════════════════════
   TOAST / UNDO
   ═══════════════════════════════════════════════════════════════════════ */
function showToast(msg, duration, undoCallback) {
  clearTimeout(state.toastTimer);
  const existing = document.getElementById('toastContainer');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'toastContainer';
  el.innerHTML = '<span>' + esc(msg) + '</span>'
    + (undoCallback ? '<button class="btn btn-ghost" onclick="this.parentElement.remove();(' + undoCallback + ')()">Undo</button>' : '');
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;'
    + 'background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius);'
    + 'padding:12px 20px;box-shadow:var(--shadow-modal);display:flex;align-items:center;gap:12px;'
    + 'font-size:0.9rem;animation:slideUp 200ms ease;max-width:90vw;';
  document.body.appendChild(el);
  if (duration) state.toastTimer = setTimeout(() => { if (el.parentNode) el.remove(); }, duration);
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD (redesigned)
   ═══════════════════════════════════════════════════════════════════════ */
async function renderDashboard(el) {
  const data = await get('/dashboard');
  setEnergyIndicator(data.energy_state);

  if (data.deferral_rate > 0.5) {
    const banner = document.getElementById('burnoutBanner');
    banner.style.display = '';
    banner.querySelector('span:nth-child(2)').textContent = 'Deferral rate at ' + Math.round(data.deferral_rate * 100) + '%. Safe mode available.';
  }

  const sparkSvg = data.energy_insights && data.energy_insights.sparkline
    ? renderSparkline(data.energy_insights.days, data.energy_insights.sparkline)
    : '';

  const bananaHtml = data.banana
    ? '<div class="banana-task" onclick="openTaskDetail(' + data.banana.id + ')">' + esc(data.banana.title) + '</div>'
      + '<div style="margin-top:var(--sp-2);display:flex;gap:var(--sp-1);justify-content:center;">'
      + '<button class="btn btn-orange" onclick="completeTask(' + data.banana.id + ')">Done \u2713</button>'
      + '<button class="btn btn-ghost" onclick="clearBanana(' + data.banana.id + ')">Unset</button></div>'
    : '<div class="banana-empty">set your focus for today</div>';

  const stats = data.stats || {};
  const ei = data.energy_insights || {};
  const totalEnergy = (ei.week_totals ? ei.week_totals.low + ei.week_totals.medium + ei.week_totals.high : 0) || 1;

  el.innerHTML = `
    <div class="dashboard-grid">
      <div class="full-width banana-zone">${bananaHtml}</div>

      <!-- Quick capture -->
      <div class="glass full-width" style="padding:var(--sp-2);">
        <div class="flex items-center" style="gap:var(--sp-1);">
          <input class="input" id="dashQuickInput" placeholder="capture a thought\u2026 (enter to add)" style="flex:1;"
                 onkeydown="if(event.key==='Enter') quickAddTask(this.value)">
          <button class="btn btn-orange" onclick="quickAddTask(document.getElementById('dashQuickInput').value)">Add</button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="glass" style="padding:var(--sp-3);text-align:center;">
        <div style="font-size:1.8rem;font-family:var(--font-display);font-weight:400;">${stats.completed_today || 0}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">done today</div>
      </div>
      <div class="glass" style="padding:var(--sp-3);text-align:center;">
        <div style="font-size:1.8rem;font-family:var(--font-display);font-weight:400;">${stats.total_active || 0}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">active</div>
      </div>
      <div class="glass" style="padding:var(--sp-3);text-align:center;">
        <div style="font-size:1.8rem;font-family:var(--font-display);font-weight:400;">${ei.week_totals ? ei.week_totals.high || 0 : 0}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">high-energy logs</div>
      </div>

      <!-- Energy breakdown -->
      <div class="glass" style="padding:var(--sp-3);">
        <div class="task-section-title" style="padding:0 0 var(--sp-2) 0;">Energy this week</div>
        <div style="display:flex;gap:var(--sp-1);height:24px;">
          <div style="flex:${(ei.week_totals ? ei.week_totals.low : 0) / totalEnergy};background:var(--energy-low);border-radius:4px 0 0 4px;min-width:${ei.week_totals && ei.week_totals.low > 0 ? '4' : '0'}px;"></div>
          <div style="flex:${(ei.week_totals ? ei.week_totals.medium : 0) / totalEnergy};background:var(--energy-med);min-width:${ei.week_totals && ei.week_totals.medium > 0 ? '4' : '0'}px;"></div>
          <div style="flex:${(ei.week_totals ? ei.week_totals.high : 0) / totalEnergy};background:var(--energy-high);border-radius:0 4px 4px 0;min-width:${ei.week_totals && ei.week_totals.high > 0 ? '4' : '0'}px;"></div>
        </div>
        <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-1);font-size:0.7rem;color:var(--text-muted);">
          <span>low ${ei.week_totals ? ei.week_totals.low : 0}</span>
          <span>med ${ei.week_totals ? ei.week_totals.medium : 0}</span>
          <span>high ${ei.week_totals ? ei.week_totals.high : 0}</span>
        </div>
      </div>

      <!-- Sparkline -->
      <div class="glass" style="padding:var(--sp-3);">
        <div class="task-section-title" style="padding:0 0 var(--sp-2) 0;">Completions</div>
        ${sparkSvg}
      </div>

      <!-- Active tasks -->
      <div class="glass full-width">
        <div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Active Tasks</div>
        <div class="task-list">
          ${data.today_tasks && data.today_tasks.length
            ? data.today_tasks.map(renderTaskCard).join('')
            : '<div class="empty-state" style="padding:var(--sp-4);"><p>nothing active. add a task to get started.</p></div>'
          }
        </div>
      </div>
    </div>
  `;
  checkOnboarding();
  attachTaskEvents();
}

function renderSparkline(days, counts) {
  const max = Math.max(...counts, 1);
  const w = 210, h = 40;
  const pts = counts.map((c, i) => {
    const x = 15 + i * (w - 30) / Math.max(counts.length - 1, 1);
    const y = h - 8 - (c / max) * (h - 16);
    return x + ',' + y;
  }).join(' ');
  const bars = counts.map((c, i) => {
    const barW = Math.max(4, (w - 30) / counts.length - 2);
    const x = 15 + i * (w - 30) / Math.max(counts.length - 1, 1) - barW / 2;
    const bh = (c / max) * (h - 16);
    return '<rect x="' + x + '" y="' + (h - 8 - bh) + '" width="' + barW + '" height="' + bh + '" fill="var(--orange)" rx="2" opacity="0.6"/>';
  }).join('');

  return '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="overflow:visible;">'
    + bars
    + (counts.length > 1 ? '<polyline points="' + pts + '" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linejoin="round"/>' : '')
    + days.map((d, i) => {
      const x = 15 + i * (w - 30) / Math.max(counts.length - 1, 1);
      return '<text x="' + x + '" y="' + (h - 2) + '" text-anchor="middle" font-size="8" fill="var(--text-muted)">' + d + '</text>';
    }).join('')
    + '</svg>';
}

/* ═══════════════════════════════════════════════════════════════════════
   CALENDAR VIEW
   ═══════════════════════════════════════════════════════════════════════ */
let calMonth = new Date().getMonth() + 1;
let calYear = new Date().getFullYear();

async function renderCalendar(el) {
  const data = await get('/calendar?year=' + calYear + '&month=' + calMonth);
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  let grid = '';
  // Header row
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    grid += '<div class="cal-header">' + d + '</div>';
  });
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    grid += '<div class="cal-day cal-other"></div>';
  }
  // Day cells
  const today = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    const key = calYear + '-' + String(calMonth).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const tasks = data.days[key] || [];
    const isToday = d === today.getDate() && calMonth === today.getMonth() + 1 && calYear === today.getFullYear();
    const taskBars = tasks.slice(0, 3).map(t =>
      '<div class="cal-task cal-task-' + t.energy_level + '" onclick="openTaskDetail(' + t.id + ')" title="' + esc(t.title) + '">'
      + esc(t.title.substring(0, 18)) + '</div>'
    ).join('');
    const more = tasks.length > 3 ? '<div class="cal-more">+' + (tasks.length - 3) + ' more</div>' : '';
    grid += '<div class="cal-day' + (isToday ? ' cal-today' : '') + '">'
      + '<span class="cal-num">' + d + '</span>'
      + taskBars + more
      + '</div>';
  }

  el.innerHTML = `
    <div class="glass full-width" style="padding:var(--sp-3);">
      <div class="flex items-center justify-between mb-2">
        <button class="btn btn-ghost" onclick="calMonth--;if(calMonth<1){calMonth=12;calYear--;}renderView('calendar')">&larr;</button>
        <h2 style="font-size:1rem;font-weight:400;">${monthNames[calMonth-1]} ${calYear}</h2>
        <button class="btn btn-ghost" onclick="calMonth++;if(calMonth>12){calMonth=1;calYear++;}renderView('calendar')">&rarr;</button>
      </div>
      <div class="cal-grid">${grid}</div>
    </div>
    <div style="margin-top:var(--sp-2);">
      <p class="text-muted" style="font-size:0.85rem;">Tasks appear on their due date or completion date. Click a task to edit.</p>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════
   TASKS VIEW (with search)
   ═══════════════════════════════════════════════════════════════════════ */
async function renderTasks(el) {
  const tasks = await get('/tasks');
  const active = tasks.filter(t => t.status === 'active');
  const deferred = tasks.filter(t => t.status === 'deferred');
  const completed = tasks.filter(t => t.status === 'completed');

  el.innerHTML = `
    <!-- Quick Capture -->
    <div class="glass quick-capture mb-lg" style="padding:var(--sp-3);">
      <div class="flex items-center" style="gap:var(--sp-1);">
        <input class="input" id="quickTaskInput" placeholder="what needs doing? (enter to add)" style="flex:1;"
               onkeydown="if(event.key==='Enter') quickAddTask(this.value)">
        <button class="btn btn-orange" onclick="quickAddTask(document.getElementById('quickTaskInput').value)">Add</button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="glass mb-lg" style="padding:var(--sp-2);">
      <div class="flex items-center" style="gap:var(--sp-1);">
        <span style="color:var(--text-muted);font-size:0.9rem;">\u2315</span>
        <input class="input" id="searchInput" placeholder="search tasks\u2026" style="flex:1;"
               oninput="searchTasks(this.value)">
        <select class="input" id="searchEnergy" style="width:auto;min-width:100px;" onchange="searchTasks(document.getElementById('searchInput').value)">
          <option value="">all energy</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </div>
      <div id="searchResults" style="display:none;margin-top:var(--sp-1);"></div>
    </div>

    <!-- Tabs -->
    <div class="flex items-center mb-md" style="gap:var(--sp-2);">
      <div class="view-toggle" id="taskTabs">
        <button class="active" data-filter="active" onclick="filterTasks('active')">Active</button>
        <button data-filter="deferred" onclick="filterTasks('deferred')">Deferred</button>
        <button data-filter="completed" onclick="filterTasks('completed')">Done</button>
      </div>
    </div>

    <div id="taskListActive" class="task-list">
      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Active</div>
      ${active.length === 0
        ? '<div class="empty-state"><p>all clear.</p></div>'
        : active.map(renderTaskCard).join('')
      }</div>
    </div>
    <div id="taskListDeferred" class="task-list" style="display:none;">
      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Deferred</div>
      ${deferred.length === 0
        ? '<div class="empty-state"><p>no deferred tasks.</p></div>'
        : deferred.map(renderTaskCard).join('')
      }</div>
    </div>
    <div id="taskListCompleted" class="task-list" style="display:none;">
      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Completed</div>
      ${completed.length === 0
        ? '<div class="empty-state"><p>complete something to see it here.</p></div>'
        : completed.map(renderTaskCard).join('')
      }</div>
    </div>
  `;
  attachTaskEvents();
}

let searchTimeout = null;
async function searchTasks(q) {
  const results = document.getElementById('searchResults');
  if (!q || q.length < 2) { results.style.display = 'none'; return; }
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const energy = document.getElementById('searchEnergy').value;
    const url = '/tasks/search?q=' + encodeURIComponent(q) + (energy ? '&energy=' + energy : '');
    try {
      const tasks = await get(url);
      if (tasks.length === 0) {
        results.innerHTML = '<p class="text-muted" style="padding:var(--sp-1);">no matches</p>';
      } else {
        results.innerHTML = tasks.map(t =>
          '<div class="task-card" style="padding:var(--sp-1) 0;cursor:pointer;" onclick="openTaskDetail(' + t.id + ')">'
          + '<div style="display:flex;align-items:center;gap:var(--sp-1);">'
          + '<span class="badge badge-' + t.energy_level + '">' + t.energy_level + '</span>'
          + '<span>' + esc(t.title) + '</span></div></div>'
        ).join('');
      }
      results.style.display = '';
    } catch {}
  }, 200);
}

function filterTasks(filter) {
  document.querySelectorAll('#taskTabs button').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  ['active', 'deferred', 'completed'].forEach(f => {
    const el = document.getElementById('taskList' + f.charAt(0).toUpperCase() + f.slice(1));
    if (el) el.style.display = f === filter ? '' : 'none';
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   KANBAN BOARD (unchanged core, added data-col to lists)
   ═══════════════════════════════════════════════════════════════════════ */
async function renderBoard(el) {
  const tasks = await get('/tasks');
  const todo = tasks.filter(t => t.status === 'active' && !t.is_banana);
  const focus = tasks.filter(t => t.status === 'active' && t.is_banana);
  const done = tasks.filter(t => t.status === 'completed');

  el.innerHTML = `
    <div class="kanban-board">
      <div class="kanban-column" data-col="todo">
        <div class="kanban-column-header">
          <span class="kanban-col-title">To Do</span>
          <span class="kanban-col-count">${todo.length}</span>
        </div>
        <div class="kanban-card-list" data-col="todo">
          ${todo.length === 0
            ? '<div class="kanban-empty">clear horizon</div>'
            : todo.map(renderKanbanCard).join('')
          }
        </div>
      </div>
      <div class="kanban-column" data-col="focus">
        <div class="kanban-column-header">
          <span class="kanban-col-title">Focus</span>
          <span class="kanban-col-count">${focus.length}</span>
        </div>
        <div class="kanban-card-list" data-col="focus">
          ${focus.length === 0
            ? '<div class="kanban-empty">nothing in focus</div>'
            : focus.map(renderKanbanCard).join('')
          }
        </div>
      </div>
      <div class="kanban-column" data-col="done">
        <div class="kanban-column-header">
          <span class="kanban-col-title">Done</span>
          <span class="kanban-col-count">${done.length}</span>
        </div>
        <div class="kanban-card-list" data-col="done">
          ${done.length === 0
            ? '<div class="kanban-empty">nothing completed yet</div>'
            : done.slice(0, 10).map(renderKanbanCard).join('')
          }
        </div>
      </div>
    </div>
  `;
  setupKanbanDragDrop();
}

function renderKanbanCard(t) {
  const ec = t.energy_level ? 'kanban-energy-' + t.energy_level : '';
  const banana = t.is_banana ? '<span class="kanban-badge">\u2605 today</span>' : '';
  return '<div class="kanban-card glass-sm ' + ec + '" data-task-id="' + t.id + '" draggable="true" onclick="openTaskDetail(' + t.id + ')">'
    + '<div class="kanban-card-title">' + esc(t.title) + '</div>'
    + '<div class="kanban-card-meta">' + banana
    + (t.micro_step ? '<span class="kanban-micro">\u21b3 ' + esc(t.micro_step) + '</span>' : '') + '</div>'
    + '<div class="kanban-card-actions">'
    + (t.status !== 'completed'
      ? '<button class="btn btn-icon" onclick="event.stopPropagation();completeTask(' + t.id + ')">\u2713</button>'
      : '')
    + '<button class="btn btn-icon" onclick="event.stopPropagation();openTaskDetail(' + t.id + ')">\u270e</button>'
    + '</div></div>';
}

/* ── Drag & Drop ────────────────────────────────────────────────────── */
function setupKanbanDragDrop() {
  document.querySelectorAll('.kanban-card[draggable]').forEach(c => {
    c.addEventListener('dragstart', onDragStart);
    c.addEventListener('dragend', onDragEnd);
  });
  document.querySelectorAll('.kanban-card-list').forEach(l => {
    l.addEventListener('dragover', onDragOver);
    l.addEventListener('dragenter', onDragEnter);
    l.addEventListener('dragleave', onDragLeave);
    l.addEventListener('drop', onDrop);
  });
  // Touch
  let tid = null, tclone = null, tsrc = null;
  document.querySelectorAll('.kanban-card[draggable]').forEach(c => {
    c.addEventListener('touchstart', e => {
      tid = c.dataset.taskId; tsrc = c.closest('.kanban-card-list');
      const r = c.getBoundingClientRect();
      tclone = c.cloneNode(true);
      Object.assign(tclone.style, {position:'fixed',width:r.width+'px',zIndex:'9999',pointerEvents:'none',opacity:'0.85',transform:'rotate(2deg) scale(1.03)',borderRadius:'var(--radius)',boxShadow:'var(--shadow-elevated)'});
      document.body.appendChild(tclone);
      c.style.opacity = '0.3';
      mt(e);
    }, {passive:true});
    c.addEventListener('touchmove', e => {
      e.preventDefault(); mt(e);
      const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      const list = el?.closest('.kanban-card-list');
      document.querySelectorAll('.kanban-card-list').forEach(l => l.classList.remove('drag-over'));
      if (list) list.classList.add('drag-over');
    }, {passive:false});
    c.addEventListener('touchend', e => {
      if (tclone) { tclone.remove(); tclone = null; }
      c.style.opacity = '1';
      document.querySelectorAll('.kanban-card-list').forEach(l => l.classList.remove('drag-over'));
      const el = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      const target = el?.closest('.kanban-card-list');
      if (target && tid && tsrc !== target) moveTaskToColumn(tid, target.dataset.col);
      tid = null; tsrc = null;
    });
  });
  function mt(e) { if (tclone) { const t = e.touches[0]; tclone.style.left = (t.clientX - 80) + 'px'; tclone.style.top = (t.clientY - 20) + 'px'; } }
}

function onDragStart(e) { e.dataTransfer.setData('text/plain', this.dataset.taskId); this.classList.add('dragging'); }
function onDragEnd(e) { this.classList.remove('dragging'); document.querySelectorAll('.kanban-card-list').forEach(l => l.classList.remove('drag-over')); }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function onDragEnter(e) { e.preventDefault(); this.classList.add('drag-over'); }
function onDragLeave(e) { this.classList.remove('drag-over'); }
function onDrop(e) { e.preventDefault(); this.classList.remove('drag-over'); moveTaskToColumn(e.dataTransfer.getData('text/plain'), this.dataset.col); }

async function moveTaskToColumn(taskId, col) {
  if (!taskId || !col) return;
  const u = { todo: {status:'active',is_banana:false}, focus: {status:'active',is_banana:true}, done: {status:'completed',is_banana:false} }[col];
  if (!u) return;
  if (u.status === 'completed') await post('/tasks/' + taskId + '/complete');
  else await put('/tasks/' + taskId, u);
  renderView('board');
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECTS (unchanged)
   ═══════════════════════════════════════════════════════════════════════ */
async function renderProjects(el) {
  const projects = await get('/projects');
  const tasks = await get('/tasks');
  el.innerHTML = '<div class="projects-grid">'
    + (projects.length === 0
      ? '<div class="glass full-width empty-state"><h3>no projects yet</h3><p>create a project to group your tasks.</p></div>'
      : projects.map(p => {
          const pt = tasks.filter(t => t.project_id === p.id);
          return '<div class="glass project-card" onclick="openProjectDetail(' + p.id + ')">'
            + '<div class="project-card-header">'
            + '<span class="project-color-dot" style="background:' + p.color + '"></span>'
            + '<span class="project-name">' + esc(p.name) + '</span>'
            + '<span class="project-task-count">' + pt.filter(t => t.status === 'active').length + ' active</span></div>'
            + (p.description ? '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:var(--sp-1);">' + esc(p.description) + '</p>' : '')
            + '<div class="flex items-center" style="gap:var(--sp-2);margin-top:var(--sp-2);">'
            + '<span style="font-size:0.75rem;color:var(--text-muted);">stability</span>'
            + '<div style="flex:1;height:4px;background:var(--border-subtle);border-radius:2px;position:relative;">'
            + '<div style="position:absolute;left:0;top:0;height:100%;width:' + p.stability_slider + '%;background:var(--orange);border-radius:2px;"></div></div>'
            + '<span style="font-size:0.7rem;color:var(--text-muted);">' + p.stability_slider + '%</span></div></div>';
        }).join(''))
    + '</div>';
}

/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS (unchanged)
   ═══════════════════════════════════════════════════════════════════════ */
async function renderSettings(el) {
  let users = [], teams = [], notifStatus = { configured: false };
  try { users = await get('/users'); teams = await get('/teams'); notifStatus = await (await fetch('/api/notifications/matrix-status')).json(); } catch {}

  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:var(--sp-3);max-width:600px;">'
    + '<div class="glass" style="padding:var(--sp-4);">'
    + '<h2 style="font-size:1rem;margin-bottom:var(--sp-3);">System</h2>'
    + '<div class="form-group"><label>Database</label><p class="text-muted" style="font-size:0.85rem;">Local SQLite</p></div>'
    + '<div class="form-group"><label>Version</label><p class="text-muted" style="font-size:0.85rem;">Niki v2.0.0</p></div>'
    + '<div class="form-group"><label>Principles</label><ul style="font-size:0.85rem;color:var(--text-secondary);padding-left:var(--sp-4);list-style-type:\'\u00b7 \';">'
    + '<li>No streak counters, no deadlines, no guilt</li>'
    + '<li>Data is local-first and yours only</li>'
    + '<li>Energy-based scheduling, not calendar blocks</li>'
    + '<li>Recurring tasks for routines</li></ul></div></div>'

    + '<div class="glass" style="padding:var(--sp-4);">'
    + '<div class="flex items-center justify-between mb-2"><h2 style="font-size:1rem;">Users</h2><button class="btn btn-ghost" onclick="showAddUser()">+ Add</button></div>'
    + (users.length ? users.map(u => '<div class="flex items-center" style="gap:var(--sp-2);padding:var(--sp-1) 0;"><span style="flex:1;">' + esc(u.username) + '</span><span class="badge ' + (u.role === 'admin' ? 'badge-banana' : 'badge-medium') + '">' + u.role + '</span></div>').join('') : '<p class="text-muted">no users</p>')
    + '</div>'

    + '<div class="glass" style="padding:var(--sp-4);">'
    + '<div class="flex items-center justify-between mb-2"><h2 style="font-size:1rem;">Teams</h2><button class="btn btn-ghost" onclick="showAddTeam()">+ Add</button></div>'
    + (teams.length ? teams.map(t => '<div class="flex items-center" style="gap:var(--sp-2);padding:var(--sp-1) 0;"><span style="flex:1;">' + esc(t.name) + '</span><span style="font-size:0.8rem;color:var(--text-muted);">' + t.member_count + ' members</span></div>').join('') : '<p class="text-muted">no teams</p>')
    + '</div>'

    + '<div class="glass" style="padding:var(--sp-4);">'
    + '<h2 style="font-size:1rem;margin-bottom:var(--sp-2);">Notifications</h2>'
    + '<p class="text-muted mb-2" style="font-size:0.85rem;">Status: ' + (notifStatus.configured ? '<span style="color:var(--status-calm);">\u2713 Connected</span>' : '<span style="color:var(--status-warn);">\u25cb Not configured</span>') + '</p>'
    + '<div class="form-group"><label>Matrix Access Token</label>'
    + '<div class="flex items-center" style="gap:var(--sp-1);"><input class="input" id="matrixTokenInput" placeholder="paste token" style="flex:1;"><button class="btn btn-ghost" onclick="saveMatrixToken()">Save</button></div></div></div>'
    + '</div>';
}

/* ═══════════════════════════════════════════════════════════════════════
   TASK CARD (with priority/interest badges)
   ═══════════════════════════════════════════════════════════════════════ */
function renderTaskCard(t) {
  const energyBadge = t.energy_level ? '<span class="badge badge-' + t.energy_level + '">' + t.energy_level + '</span>' : '';
  const bananaMark = t.is_banana ? '<span class="badge badge-banana">\u2605 today</span>' : '';
  const priorityStars = t.priority > 0 ? '<span style="color:var(--orange);font-size:0.7rem;">' + '\u2605'.repeat(t.priority) + '</span>' : '';
  const interestTag = t.interest_level > 0 ? '<span class="badge badge-medium" style="font-size:0.65rem;">\u2661 ' + t.interest_level + '</span>' : '';
  const repeatTag = t.repeat ? '<span class="badge" style="background:var(--orange-dim);color:var(--orange);font-size:0.65rem;">\u21bb ' + t.repeat + '</span>' : '';
  const microHtml = t.micro_step ? '<div class="task-micro">\u21b3 ' + esc(t.micro_step) + '</div>' : '';

  return '<div class="glass task-card ' + (t.status === 'completed' ? 'completed' : '') + '" data-task-id="' + t.id + '" onclick="openTaskDetail(' + t.id + ')">'
    + '<div class="task-check ' + (t.status === 'completed' ? 'done' : '') + '" onclick="event.stopPropagation();toggleComplete(' + t.id + ')">' + (t.status === 'completed' ? '\u2713' : '') + '</div>'
    + '<div class="task-body">'
    + '<div class="task-title">' + esc(t.title) + '</div>'
    + '<div class="task-meta">' + energyBadge + ' ' + bananaMark + ' ' + priorityStars + ' ' + interestTag + ' ' + repeatTag + '</div>'
    + microHtml
    + '</div></div>';
}

function attachTaskEvents() {}

/* ═══════════════════════════════════════════════════════════════════════
   QUICK CAPTURE
   ═══════════════════════════════════════════════════════════════════════ */
async function quickAddTask(title) {
  if (!title || !title.trim()) return;
  const input = document.getElementById('quickTaskInput') || document.getElementById('dashQuickInput');
  if (input) input.value = '';
  await post('/tasks', { title: title.trim(), energy_level: state.energy });
  showToast('task added', 2000);
  renderView(state.view);
}

function openQuickCapture() {
  showModal('<h2>New Task</h2>'
    + '<form id="newTaskForm" onsubmit="submitNewTask(event)">'
    + '<div class="form-group"><label>What needs doing?</label><input class="input" name="title" placeholder="task title" required autofocus></div>'
    + '<div class="form-group"><label>First step (optional, 2 min max)</label><input class="input" name="micro_step" placeholder="e.g. open the file"></div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Energy</label><select class="input" name="energy_level">'
    + '<option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>'
    + '<div class="form-group"><label>Repeat</label><select class="input" name="repeat">'
    + '<option value="">Never</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Priority</label><select class="input" name="priority"><option value="0">None</option><option value="1">\u2605</option><option value="2">\u2605\u2605</option><option value="3">\u2605\u2605\u2605</option></select></div>'
    + '<div class="form-group"><label>Interest</label><select class="input" name="interest_level"><option value="0">None</option><option value="1">\u2661</option><option value="2">\u2661\u2661</option><option value="3">\u2661\u2661\u2661</option></select></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Est. minutes</label><input class="input" type="number" name="estimated_minutes" placeholder="e.g. 15"></div>'
    + '<div class="form-group"><label>Set as focus?</label><select class="input" name="is_banana"><option value="false">No</option><option value="true">Yes</option></select></div>'
    + '</div>'
    + '<div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">'
    + '<button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>'
    + '<button type="submit" class="btn btn-orange">Create</button></div></form>');
}

async function submitNewTask(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  data.is_banana = data.is_banana === 'true';
  data.priority = parseInt(data.priority) || 0;
  data.interest_level = parseInt(data.interest_level) || 0;
  data.estimated_minutes = parseInt(data.estimated_minutes) || null;
  await post('/tasks', data);
  closeModal();
  showToast('task created', 2000);
  renderView(state.view);
}

/* ═══════════════════════════════════════════════════════════════════════
   TASK DETAIL MODAL (updated with repeat, priority, interest)
   ═══════════════════════════════════════════════════════════════════════ */
async function openTaskDetail(id) {
  const t = await get('/tasks/' + id);
  const projects = await get('/projects');
  const enOpts = ['low','medium','high'].map(e => '<option value="' + e + '"' + (t.energy_level === e ? ' selected' : '') + '>' + e.charAt(0).toUpperCase() + e.slice(1) + '</option>').join('');
  const prOpts = projects.map(p => '<option value="' + p.id + '"' + (t.project_id === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');

  showModal('<h2>' + esc(t.title) + '</h2>'
    + '<form id="taskDetailForm" onsubmit="submitTaskUpdate(' + id + ', event)">'
    + '<div class="form-group"><label>Title</label><input class="input" name="title" value="' + esc(t.title) + '"></div>'
    + '<div class="form-group"><label>Description</label><textarea class="input" name="description" rows="2">' + esc(t.description) + '</textarea></div>'
    + '<div class="form-group" style="background:var(--status-subtle-dim);border-radius:var(--radius);padding:var(--sp-2);">'
    + '<label style="color:var(--status-subtle);">Micro-step</label>'
    + '<input class="input" name="micro_step" value="' + esc(t.micro_step) + '" placeholder="e.g. \'open the file\'">'
    + '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">first action only. \u22642 minutes.</p></div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Energy</label><select class="input" name="energy_level">' + enOpts + '</select></div>'
    + '<div class="form-group"><label>Project</label><select class="input" name="project_id"><option value="">\u2014 None \u2014</option>' + prOpts + '</select></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Priority</label><select class="input" name="priority">'
    + [0,1,2,3].map(i => '<option value="' + i + '"' + (t.priority === i ? ' selected' : '') + '>' + (i === 0 ? 'None' : '\u2605'.repeat(i)) + '</option>').join('')
    + '</select></div>'
    + '<div class="form-group"><label>Interest</label><select class="input" name="interest_level">'
    + [0,1,2,3].map(i => '<option value="' + i + '"' + (t.interest_level === i ? ' selected' : '') + '>' + (i === 0 ? 'None' : '\u2661'.repeat(i)) + '</option>').join('')
    + '</select></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Repeat</label><select class="input" name="repeat">'
    + ['','daily','weekdays','weekly','monthly'].map(r => '<option value="' + r + '"' + (t.repeat === r ? ' selected' : '') + '>' + (r || 'Never') + '</option>').join('')
    + '</select></div>'
    + '<div class="form-group"><label>Est. minutes</label><input class="input" type="number" name="estimated_minutes" value="' + (t.estimated_minutes || '') + '"></div>'
    + '</div>'
    + '<div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-top:var(--sp-2);">'
    + '<label class="flex items-center" style="gap:var(--sp-1);font-size:0.85rem;cursor:pointer;">'
    + '<input type="checkbox" name="is_banana" value="true"' + (t.is_banana ? ' checked' : '') + '> Today\'s focus</label>'
    + '</div>'
    + '<div style="display:flex;gap:var(--sp-2);justify-content:space-between;margin-top:var(--sp-4);">'
    + '<div style="display:flex;gap:var(--sp-1);">'
    + '<button type="button" class="btn btn-ghost" onclick="deferTask(' + id + ')">Not Now</button>'
    + '<button type="button" class="btn btn-ghost" style="color:var(--status-warn);" onclick="deleteTask(' + id + ')">Archive</button></div>'
    + '<div style="display:flex;gap:var(--sp-1);">'
    + '<button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="btn btn-orange" onclick="completeTask(' + id + ')">Complete \u2713</button>'
    + '<button type="submit" class="btn">Save</button></div></div></form>');
}

async function submitTaskUpdate(id, e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {};
  data.is_banana = fd.get('is_banana') === 'true';
  ['title','description','micro_step','energy_level','repeat'].forEach(k => data[k] = fd.get(k) || '');
  ['priority','interest_level'].forEach(k => data[k] = parseInt(fd.get(k)) || 0);
  data.estimated_minutes = parseInt(fd.get('estimated_minutes')) || null;
  const pid = fd.get('project_id');
  data.project_id = pid ? parseInt(pid) : null;
  await put('/tasks/' + id, data);
  closeModal();
  showToast('saved', 2000);
  renderView(state.view);
}

/* ═══════════════════════════════════════════════════════════════════════
   TASK ACTIONS (with undo)
   ═══════════════════════════════════════════════════════════════════════ */
async function toggleComplete(id) {
  const t = await get('/tasks/' + id);
  if (t.status === 'completed') {
    await post('/tasks/' + id + '/reactivate');
    showToast('task reactivated', 2000);
  } else {
    await post('/tasks/' + id + '/complete');
    showToast('task completed', 4000, 'function(){ fetch(\'/api/tasks/' + id + '/reactivate\', {method:\'POST\'}).then(()=>renderView(state.view)); }');
  }
  renderView(state.view);
}

async function completeTask(id) {
  await post('/tasks/' + id + '/complete');
  closeModal();
  showToast('completed' + (document.querySelector('[name=\\"repeat\\"]')?.value ? ' \u2014 next instance created' : ''), 4000,
    'function(){ fetch(\'/api/tasks/' + id + '/reactivate\', {method:\'POST\'}).then(()=>renderView(state.view)); }');
  renderView(state.view);
}

async function deferTask(id) {
  await post('/tasks/' + id + '/defer?until_days=1');
  closeModal();
  showToast('deferred until tomorrow', 2000);
  renderView(state.view);
}

async function clearBanana(id) {
  await put('/tasks/' + id, { is_banana: false });
  renderView(state.view);
}

async function deleteTask(id) {
  if (!confirm('Archive this task?')) return;
  await del('/tasks/' + id);
  closeModal();
  renderView(state.view);
}

/* ═══════════════════════════════════════════════════════════════════════
   USER / TEAM / NOTIFICATION MODALS
   ═══════════════════════════════════════════════════════════════════════ */
function showAddUser() {
  showModal('<h2>Add User</h2><form id="addUserForm" onsubmit="submitAddUser(event)">'
    + '<div class="form-group"><label>Username</label><input class="input" name="username" required></div>'
    + '<div class="form-group"><label>Password</label><input class="input" type="password" name="password" required></div>'
    + '<div class="form-group"><label>Display Name</label><input class="input" name="display_name"></div>'
    + '<div class="form-group"><label>Role</label><select class="input" name="role"><option value="user">User</option><option value="admin">Admin</option></select></div>'
    + '<div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">'
    + '<button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>'
    + '<button type="submit" class="btn btn-orange">Create</button></div></form>');
}
async function submitAddUser(e) { e.preventDefault(); await post('/users', Object.fromEntries(new FormData(e.target).entries())); closeModal(); renderView('settings'); }

function showAddTeam() {
  showModal('<h2>New Team</h2><form id="addTeamForm" onsubmit="submitAddTeam(event)">'
    + '<div class="form-group"><label>Team Name</label><input class="input" name="name" required></div>'
    + '<div class="form-group"><label>Description</label><textarea class="input" name="description" rows="2"></textarea></div>'
    + '<div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">'
    + '<button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>'
    + '<button type="submit" class="btn btn-orange">Create</button></div></form>');
}
async function submitAddTeam(e) { e.preventDefault(); await post('/teams', Object.fromEntries(new FormData(e.target).entries())); closeModal(); renderView('settings'); }

async function saveMatrixToken() {
  const token = document.getElementById('matrixTokenInput').value;
  if (!token) return;
  await post('/notifications/matrix-config', { access_token: token });
  showToast('Matrix token saved', 2000);
  renderView('settings');
}

async function openProjectDetail(id) {
  const p = await get('/projects/' + id);
  const tasks = await get('/tasks?project_id=' + id);
  showModal('<h2>' + esc(p.name) + '</h2>'
    + '<p class="text-muted mb-md">' + esc(p.description || 'no description') + '</p>'
    + '<div class="flex items-center mb-md" style="gap:var(--sp-2);">'
    + '<span class="project-color-dot" style="background:' + p.color + ';width:16px;height:16px;"></span>'
    + '<div class="slider-group" style="flex:1;"><span class="slider-label">surprise</span>'
    + '<input type="range" value="' + p.stability_slider + '" min="0" max="100" onchange="updateProjectSlider(' + id + ', this.value)" style="flex:1;">'
    + '<span class="slider-label">stability</span></div></div>'
    + '<div class="task-list">'
    + (tasks.filter(t => t.status === 'active').length === 0
      ? '<p class="text-muted">no active tasks.</p>'
      : tasks.filter(t => t.status === 'active').map(renderTaskCard).join(''))
    + '</div><div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">'
    + '<button class="btn btn-ghost" onclick="closeModal()">Close</button></div>');
  attachTaskEvents();
}
async function updateProjectSlider(id, val) { await put('/projects/' + id, { stability_slider: parseInt(val) }); }

/* ═══════════════════════════════════════════════════════════════════════
   ENERGY
   ═══════════════════════════════════════════════════════════════════════ */
function setEnergy(level) { state.energy = level; setEnergyIndicator(level); post('/energy-log', { level, note: 'user set' }).catch(() => {}); }
function setEnergyIndicator(level) {
  const labels = { low: 'low', medium: 'medium', high: 'high' };
  document.querySelectorAll('.energy-pill').forEach(p => p.classList.toggle('active', p.dataset.level === level));
  const l = document.querySelector('.energy-label');
  if (l) l.textContent = labels[level] || 'medium';
}

/* ═══════════════════════════════════════════════════════════════════════
   SAFE MODE
   ═══════════════════════════════════════════════════════════════════════ */
function toggleSafeMode() {
  state.safeMode = !state.safeMode;
  document.body.classList.toggle('safe-mode', state.safeMode);
  document.getElementById('burnoutBanner').style.display = 'none';
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════════════════════════════ */
function showModal(html) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'activeModal';
  overlay.innerHTML = '<div class="modal glass">' + html + '</div>';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modalContainer').appendChild(overlay);
  const first = overlay.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 100);
}
function closeModal() { const m = document.getElementById('activeModal'); if (m) m.remove(); }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ═══════════════════════════════════════════════════════════════════════
   MOBILE BOTTOM NAV
   ═══════════════════════════════════════════════════════════════════════ */
function initMobileNav() {
  const nav = document.createElement('div');
  nav.id = 'mobileNav';
  nav.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;background:var(--bg-surface);border-top:1px solid var(--border-subtle);z-index:500;padding:4px 0;justify-content:space-around;';
  nav.innerHTML = ['dashboard','tasks','board','calendar','settings']
    .map(v => '<button class="nav-item-mobile" data-view="' + v + '" onclick="switchView(\'' + v + '\')" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 12px;border:none;background:none;color:var(--text-muted);font-size:0.6rem;cursor:pointer;font-family:var(--font-body);">'
      + ({dashboard:'◉',tasks:'☰',board:'▤',calendar:'📅',settings:'⚙'}[v] || '')
      + '<span>' + v + '</span></button>').join('');
  document.body.appendChild(nav);

  // Show on mobile
  if (window.innerWidth <= 768) {
    nav.style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
  }
  window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    nav.style.display = isMobile ? 'flex' : 'none';
    document.getElementById('sidebar').style.display = isMobile ? 'none' : '';
    document.querySelector('.main-content').style.paddingBottom = isMobile ? '70px' : '';
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) return;
  if (e.key === 'n') { e.preventDefault(); openQuickCapture(); }
  if (e.key === '/') { e.preventDefault(); const inp = document.getElementById('searchInput'); if (inp) inp.focus(); }
  if (e.key === '1') switchView('dashboard');
  if (e.key === '2') switchView('tasks');
  if (e.key === '3') switchView('board');
  if (e.key === '4') switchView('calendar');
});

/* ═══════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════ */
switchView('dashboard');
initMobileNav();
