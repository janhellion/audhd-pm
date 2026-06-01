/* =========================================================================
   Niki — Application Logic
   ========================================================================= */

const API = '/api';
let state = { view: 'dashboard', safeMode: false, energy: 'medium' };

/* ── API Helpers ────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if (!r.ok) { const e = await r.text(); console.error('API error', r.status, e); throw new Error(e); }
  return r.json();
}

const get    = (p) => api('GET', p);
const post   = (p, b) => api('POST', p, b);
const put    = (p, b) => api('PUT', p, b);
const del    = (p) => api('DELETE', p);

/* ── View Switcher ──────────────────────────────────────────────────── */
function switchView(name) {
  state.view = name;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  document.querySelectorAll('.view-container').forEach(c => c.style.display = c.id === `view-${name}` ? '' : 'none');

  const titles = {
    dashboard: ['Dashboard', 'your current landscape'],
    tasks: ['Tasks', 'all your active items'],
    board: ['Board', 'visual workflow'],
    projects: ['Projects', 'organise by theme or context'],
    settings: ['Settings', 'preferences & system info'],
  };
  document.getElementById('viewTitle').textContent = titles[name][0];
  document.getElementById('viewSubtitle').textContent = titles[name][1];

  const actions = document.getElementById('topbarActions');
  if (name === 'tasks' || name === 'dashboard' || name === 'board') {
    actions.innerHTML = `<button class="btn btn-orange" onclick="openQuickCapture()">+ New Task</button>`;
  } else if (name === 'projects') {
    actions.innerHTML = `<button class="btn btn-orange" onclick="openNewProject()">+ New Project</button>`;
  } else {
    actions.innerHTML = '';
  }

  renderView(name);
}

/* ── Render Views ───────────────────────────────────────────────────── */
async function renderView(name) {
  const el = document.getElementById(`view-${name}`);
  if (!el) return;
  el.innerHTML = `<div class="text-muted" style="padding:2rem;text-align:center;">loading…</div>`;

  if (name === 'dashboard') await renderDashboard(el);
  else if (name === 'tasks') await renderTasks(el);
  else if (name === 'board') await renderBoard(el);
  else if (name === 'projects') await renderProjects(el);
  else if (name === 'settings') await renderSettings(el);
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */
async function renderDashboard(el) {
  const data = await get('/dashboard');
  const active = data.today_tasks.filter(t => t.status === 'active');
  const deferred = data.today_tasks.filter(t => t.status === 'deferred');

  // Burnout detection
  if (data.deferral_rate > 0.5) {
    const banner = document.getElementById('burnoutBanner');
    banner.style.display = '';
    banner.querySelector('span:nth-child(2)').textContent =
      `Deferral rate is at ${Math.round(data.deferral_rate * 100)}%. Safe mode available.`;
  }

  setEnergyIndicator(data.energy_state);

  el.innerHTML = `
    <div class="dashboard-grid">
      <div class="full-width banana-zone">
        <div class="banana-label">✦ The One Thing</div>
        ${data.banana
          ? `<div class="banana-task" onclick="openTaskDetail(${data.banana.id})">${esc(data.banana.title)}</div>
             <div style="margin-top:var(--sp-2);display:flex;gap:var(--sp-1);justify-content:center;">
               <button class="btn btn-orange" onclick="completeTask(${data.banana.id})">Done ✓</button>
               <button class="btn btn-ghost" onclick="clearBanana(${data.banana.id})">Unset</button>
             </div>`
          : `<div class="banana-empty">set your focus for today</div>`
        }
      </div>
      <div class="glass full-width">
        <div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Active Tasks</div>
        <div class="task-list">
          ${active.length === 0
            ? `<div class="empty-state" style="padding:var(--sp-4);"><p>nothing active yet. add a task to get started.</p></div>`
            : active.map(t => renderTaskCard(t)).join('')
          }
        </div>
      </div>
    </div>
  `;
  attachTaskEvents();
}

/* ═══════════════════════════════════════════════════════════════════════
   TASKS VIEW
   ═══════════════════════════════════════════════════════════════════════ */
async function renderTasks(el) {
  const tasks = await get('/tasks');
  const active = tasks.filter(t => t.status === 'active');
  const deferred = tasks.filter(t => t.status === 'deferred');
  const completed = tasks.filter(t => t.status === 'completed');

  el.innerHTML = `
    <div class="glass quick-capture mb-lg" style="padding:var(--sp-3);">
      <div class="flex items-center" style="gap:var(--sp-2);">
        <input class="input" id="quickTaskInput" placeholder="what needs doing? (enter to add)" style="flex:1;"
               onkeydown="if(event.key==='Enter') quickAddTask(this.value)">
        <button class="btn btn-orange" onclick="quickAddTask(document.getElementById('quickTaskInput').value)">Add</button>
      </div>
    </div>
    <div class="flex items-center mb-md" style="gap:var(--sp-2);">
      <div class="view-toggle" id="taskTabs">
        <button class="active" data-filter="active" onclick="filterTasks('active')">Active (${active.length})</button>
        <button data-filter="deferred" onclick="filterTasks('deferred')">Deferred (${deferred.length})</button>
        <button data-filter="completed" onclick="filterTasks('completed')">Done (${completed.length})</button>
      </div>
    </div>
    <div id="taskListActive" class="task-list">
      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Active</div>
      ${active.length === 0
        ? `<div class="empty-state"><p>all clear. nothing active right now.</p></div>`
        : active.map(t => renderTaskCard(t)).join('')
      }</div>
    </div>
    <div id="taskListDeferred" class="task-list" style="display:none;">
      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Deferred</div>
      ${deferred.length === 0
        ? `<div class="empty-state"><p>no deferred tasks.</p></div>`
        : deferred.map(t => renderTaskCard(t)).join('')
      }</div>
    </div>
    <div id="taskListCompleted" class="task-list" style="display:none;">
      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Completed</div>
      ${completed.length === 0
        ? `<div class="empty-state"><p>complete something to see it here.</p></div>`
        : completed.map(t => renderTaskCard(t)).join('')
      }</div>
    </div>
  `;
  attachTaskEvents();
}

let _currentTaskFilter = 'active';
function filterTasks(filter) {
  _currentTaskFilter = filter;
  document.querySelectorAll('#taskTabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  ['active', 'deferred', 'completed'].forEach(f => {
    document.getElementById(`taskList${f.charAt(0).toUpperCase()+f.slice(1)}`).style.display = f === filter ? '' : 'none';
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   BOARD (KANBAN) VIEW
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
            : todo.map(t => renderKanbanCard(t)).join('')
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
            ? '<div class="kanban-empty">nothing in focus. set your banana.</div>'
            : focus.map(t => renderKanbanCard(t)).join('')
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
            : done.slice(0, 10).map(t => renderKanbanCard(t)).join('')
          }
        </div>
      </div>
    </div>
  `;

  setupKanbanDragDrop();
}

function renderKanbanCard(t) {
  const energyClass = t.energy_level ? `kanban-energy-${t.energy_level}` : '';
  const bananaMark = t.is_banana ? '<span class="kanban-badge">★ today</span>' : '';
  return `
    <div class="kanban-card glass-sm ${energyClass}" data-task-id="${t.id}" draggable="true" onclick="openTaskDetail(${t.id})">
      <div class="kanban-card-title">${esc(t.title)}</div>
      <div class="kanban-card-meta">
        ${bananaMark}
        ${t.micro_step ? `<span class="kanban-micro">↳ ${esc(t.micro_step)}</span>` : ''}
      </div>
      <div class="kanban-card-actions">
        ${t.status !== 'completed'
          ? `<button class="btn btn-icon" onclick="event.stopPropagation();completeTask(${t.id}).then(()=>renderBoard(document.getElementById('view-board')))" title="Complete">✓</button>`
          : ''
        }
        <button class="btn btn-icon" onclick="event.stopPropagation();openTaskDetail(${t.id})" title="Edit">✎</button>
      </div>
    </div>
  `;
}

/* ── Kanban Drag & Drop ────────────────────────────────────────────── */
function setupKanbanDragDrop() {
  const cards = document.querySelectorAll('.kanban-card[draggable]');
  const lists = document.querySelectorAll('.kanban-card-list');

  // Mouse drag
  cards.forEach(c => {
    c.addEventListener('dragstart', onDragStart);
    c.addEventListener('dragend', onDragEnd);
  });

  lists.forEach(l => {
    l.addEventListener('dragover', onDragOver);
    l.addEventListener('dragenter', onDragEnter);
    l.addEventListener('dragleave', onDragLeave);
    l.addEventListener('drop', onDrop);
  });

  // Touch drag (mobile)
  let touchDragId = null;
  let touchClone = null;
  let touchSourceList = null;

  cards.forEach(c => {
    c.addEventListener('touchstart', (e) => {
      touchDragId = c.dataset.taskId;
      touchSourceList = c.closest('.kanban-card-list');

      const rect = c.getBoundingClientRect();
      touchClone = c.cloneNode(true);
      touchClone.style.position = 'fixed';
      touchClone.style.width = rect.width + 'px';
      touchClone.style.zIndex = '9999';
      touchClone.style.pointerEvents = 'none';
      touchClone.style.opacity = '0.85';
      touchClone.style.transform = 'rotate(2deg) scale(1.03)';
      touchClone.style.borderRadius = 'var(--radius)';
      touchClone.style.boxShadow = 'var(--shadow-elevated)';
      document.body.appendChild(touchClone);

      c.style.opacity = '0.3';
      moveTouchClone(e);
    }, { passive: true });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      moveTouchClone(e);

      // Detect which column we're over
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const list = el?.closest('.kanban-card-list');
      lists.forEach(l => l.classList.remove('drag-over'));
      if (list) list.classList.add('drag-over');
    }, { passive: false });

    c.addEventListener('touchend', (e) => {
      if (touchClone) {
        touchClone.remove();
        touchClone = null;
      }
      c.style.opacity = '1';
      lists.forEach(l => l.classList.remove('drag-over'));

      // Find target column
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetList = el?.closest('.kanban-card-list');
      if (targetList && touchDragId && touchSourceList !== targetList) {
        moveTaskToColumn(touchDragId, targetList.dataset.col);
      }
      touchDragId = null;
      touchSourceList = null;
    });
  });

  function moveTouchClone(e) {
    if (!touchClone) return;
    const touch = e.touches[0];
    touchClone.style.left = (touch.clientX - 80) + 'px';
    touchClone.style.top = (touch.clientY - 20) + 'px';
  }
}

function onDragStart(e) {
  e.dataTransfer.setData('text/plain', this.dataset.taskId);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.kanban-card-list').forEach(l => l.classList.remove('drag-over'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function onDragLeave(e) {
  this.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const taskId = e.dataTransfer.getData('text/plain');
  const targetCol = this.dataset.col;
  moveTaskToColumn(taskId, targetCol);
}

async function moveTaskToColumn(taskId, targetCol) {
  if (!taskId || !targetCol) return;
  const updates = {
    todo: { status: 'active', is_banana: false },
    focus: { status: 'active', is_banana: true },
    done: { status: 'completed', is_banana: false },
  };
  const u = updates[targetCol];
  if (!u) return;
  if (u.status === 'completed') {
    await post(`/tasks/${taskId}/complete`);
  } else {
    await put(`/tasks/${taskId}`, u);
  }
  renderView('board');
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECTS VIEW
   ═══════════════════════════════════════════════════════════════════════ */
async function renderProjects(el) {
  const projects = await get('/projects');
  const tasks = await get('/tasks');

  el.innerHTML = `
    <div class="projects-grid">
      ${projects.length === 0
        ? `<div class="glass full-width empty-state"><h3>no projects yet</h3><p>create a project to group your tasks by context or theme.</p></div>`
        : projects.map(p => {
            const projectTasks = tasks.filter(t => t.project_id === p.id);
            const activeCount = projectTasks.filter(t => t.status === 'active').length;
            return `
              <div class="glass project-card" onclick="openProjectDetail(${p.id})">
                <div class="project-card-header">
                  <span class="project-color-dot" style="background:${p.color}"></span>
                  <span class="project-name">${esc(p.name)}</span>
                  <span class="project-task-count">${activeCount} active</span>
                </div>
                ${p.description ? `<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:var(--sp-1);">${esc(p.description)}</p>` : ''}
                <div class="flex items-center" style="gap:var(--sp-2);margin-top:var(--sp-2);">
                  <span style="font-size:0.75rem;color:var(--text-muted);">stability</span>
                  <div style="flex:1;height:4px;background:var(--border-subtle);border-radius:2px;position:relative;">
                    <div style="position:absolute;left:0;top:0;height:100%;width:${p.stability_slider}%;background:var(--orange);border-radius:2px;"></div>
                  </div>
                  <span style="font-size:0.7rem;color:var(--text-muted);">${p.stability_slider}%</span>
                </div>
                <div style="margin-top:var(--sp-2);display:flex;gap:var(--sp-1);flex-wrap:wrap;">
                  ${projectTasks.filter(t => t.is_banana).map(t => `<span class="badge badge-banana">★ ${esc(t.title)}</span>`).join('')}
                </div>
              </div>
            `;
          }).join('')
      }
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS VIEW
   ═══════════════════════════════════════════════════════════════════════ */
async function renderSettings(el) {
  let users = [], teams = [], notifStatus = { configured: false };
  try {
    users = await get('/users');
    teams = await get('/teams');
    notifStatus = await (await fetch('/api/notifications/matrix-status')).json();
  } catch {}

  const userRows = users.map(u => `
    <div class="flex items-center" style="gap:var(--sp-2);padding:var(--sp-1) 0;">
      <span style="flex:1;">${esc(u.username)}</span>
      <span class="badge ${u.role === 'admin' ? 'badge-banana' : u.role === 'user' ? 'badge-medium' : ''}">${u.role}</span>
      <span style="font-size:0.8rem;color:var(--text-muted);">${u.is_active ? 'active' : 'inactive'}</span>
    </div>
  `).join('');

  const teamRows = teams.map(t => `
    <div class="flex items-center" style="gap:var(--sp-2);padding:var(--sp-1) 0;">
      <span style="flex:1;">${esc(t.name)}</span>
      <span style="font-size:0.8rem;color:var(--text-muted);">${t.member_count} members</span>
    </div>
  `).join('');

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);max-width:600px;">
      <!-- System -->
      <div class="glass" style="padding:var(--sp-4);">
        <h2 style="font-size:1rem;margin-bottom:var(--sp-3);">System</h2>
        <div class="form-group">
          <label>Database</label>
          <p class="text-muted" style="font-size:0.85rem;">Local SQLite — data never leaves your server.</p>
        </div>
        <div class="form-group">
          <label>Version</label>
          <p class="text-muted" style="font-size:0.85rem;">Niki v1.1.0</p>
        </div>
        <div class="form-group">
          <label>Principles</label>
          <ul style="font-size:0.85rem;color:var(--text-secondary);padding-left:var(--sp-4);list-style-type:'· ';">
            <li>No streak counters, no deadlines, no guilt</li>
            <li>Data is local-first and yours only</li>
            <li>Energy-based scheduling, not calendar blocks</li>
            <li>Light scheme, sensory-friendly, AuDHD-aware design</li>
          </ul>
        </div>
      </div>

      <!-- Users -->
      <div class="glass" style="padding:var(--sp-4);">
        <div class="flex items-center justify-between mb-2">
          <h2 style="font-size:1rem;">Users</h2>
          <button class="btn btn-ghost" onclick="showAddUser()">+ Add</button>
        </div>
        ${userRows || '<p class="text-muted">no users</p>'}
      </div>

      <!-- Teams -->
      <div class="glass" style="padding:var(--sp-4);">
        <div class="flex items-center justify-between mb-2">
          <h2 style="font-size:1rem;">Teams</h2>
          <button class="btn btn-ghost" onclick="showAddTeam()">+ Add</button>
        </div>
        ${teamRows || '<p class="text-muted">no teams</p>'}
      </div>

      <!-- Notifications -->
      <div class="glass" style="padding:var(--sp-4);">
        <h2 style="font-size:1rem;margin-bottom:var(--sp-2);">Notifications</h2>
        <p class="text-muted mb-2" style="font-size:0.85rem;">
          Status: ${notifStatus.configured
            ? '<span style="color:var(--status-calm);">✓ Connected</span>'
            : '<span style="color:var(--status-warn);">○ Not configured</span>'}
          ${notifStatus.working === false ? ' (test failed)' : ''}
        </p>
        <div class="form-group">
          <label>Matrix Access Token</label>
          <div class="flex items-center" style="gap:var(--sp-1);">
            <input class="input" id="matrixTokenInput" placeholder="paste your Matrix token" style="flex:1;">
            <button class="btn btn-ghost" onclick="saveMatrixToken()">Save</button>
          </div>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
            Get token from Element → Settings → Sessions → Access Token
          </p>
        </div>
      </div>
    </div>
  `;
}

function showAddUser() {
  showModal(`
    <h2>Add User</h2>
    <form id="addUserForm" onsubmit="submitAddUser(event)">
      <div class="form-group">
        <label>Username</label>
        <input class="input" name="username" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input class="input" type="password" name="password" required>
      </div>
      <div class="form-group">
        <label>Display Name</label>
        <input class="input" name="display_name">
      </div>
      <div class="form-group">
        <label>Role</label>
        <select class="input" name="role">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-orange">Create</button>
      </div>
    </form>
  `);
}

async function submitAddUser(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await post('/users', Object.fromEntries(fd.entries()));
  closeModal();
  renderView('settings');
}

function showAddTeam() {
  showModal(`
    <h2>New Team</h2>
    <form id="addTeamForm" onsubmit="submitAddTeam(event)">
      <div class="form-group">
        <label>Team Name</label>
        <input class="input" name="name" required>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="input" name="description" rows="2"></textarea>
      </div>
      <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-orange">Create</button>
      </div>
    </form>
  `);
}

async function submitAddTeam(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await post('/teams', Object.fromEntries(fd.entries()));
  closeModal();
  renderView('settings');
}

async function saveMatrixToken() {
  const token = document.getElementById('matrixTokenInput').value;
  if (!token) return;
  await post('/notifications/matrix-config', { access_token: token });
  renderView('settings');
}

/* ═══════════════════════════════════════════════════════════════════════
   TASK CARD RENDERER
   ═══════════════════════════════════════════════════════════════════════ */
function renderTaskCard(t) {
  const energyBadge = t.energy_level ? `<span class="badge badge-${t.energy_level}">${t.energy_level}</span>` : '';
  const bananaMark = t.is_banana ? `<span class="badge badge-banana">★ today</span>` : '';
  const microHtml = t.micro_step ? `<div class="task-micro">↳ ${esc(t.micro_step)}</div>` : '';

  return `
    <div class="glass task-card ${t.status === 'completed' ? 'completed' : ''}" data-task-id="${t.id}" onclick="openTaskDetail(${t.id})">
      <div class="task-check ${t.status === 'completed' ? 'done' : ''}" onclick="event.stopPropagation();toggleComplete(${t.id})">${t.status === 'completed' ? '✓' : ''}</div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${energyBadge} ${bananaMark}</div>
        ${microHtml}
      </div>
    </div>
  `;
}

function attachTaskEvents() {
  // handled by inline onclick
}

/* ═══════════════════════════════════════════════════════════════════════
   QUICK CAPTURE
   ═══════════════════════════════════════════════════════════════════════ */
async function quickAddTask(title) {
  if (!title || !title.trim()) return;
  const input = document.getElementById('quickTaskInput');
  if (input) input.value = '';
  await post('/tasks', {
    title: title.trim(),
    energy_level: state.energy,
    description: '',
    micro_step: '',
    is_banana: false,
  });
  renderView(state.view);
}

function openQuickCapture() {
  showModal(`
    <h2>New Task</h2>
    <form id="newTaskForm" onsubmit="submitNewTask(event)">
      <div class="form-group">
        <label>What needs doing?</label>
        <input class="input" name="title" placeholder="task title" required autofocus>
      </div>
      <div class="form-group">
        <label>First step (optional — make it tiny, 2 min max)</label>
        <input class="input" name="micro_step" placeholder="e.g. 'open the file and write the first sentence'">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Energy</label>
          <select class="input" name="energy_level">
            <option value="low">Low — gentle work</option>
            <option value="medium" selected>Medium — normal flow</option>
            <option value="high">High — tackle anything</option>
          </select>
        </div>
        <div class="form-group">
          <label>Set as today's focus?</label>
          <select class="input" name="is_banana">
            <option value="false">No</option>
            <option value="true">Yes — the one thing</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-orange">Create</button>
      </div>
    </form>
  `);
}

async function submitNewTask(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  data.is_banana = data.is_banana === 'true';
  await post('/tasks', data);
  closeModal();
  renderView(state.view);
}

/* ═══════════════════════════════════════════════════════════════════════
   TASK DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════════ */
async function openTaskDetail(id) {
  const t = await get(`/tasks/${id}`);
  const projects = await get('/projects');

  const energyOpts = ['low', 'medium', 'high'].map(e =>
    `<option value="${e}" ${t.energy_level === e ? 'selected' : ''}>${e.charAt(0).toUpperCase()+e.slice(1)}</option>`
  ).join('');

  const projectOpts = projects.map(p =>
    `<option value="${p.id}" ${t.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  showModal(`
    <h2>${esc(t.title)}</h2>
    <form id="taskDetailForm" onsubmit="submitTaskUpdate(${id}, event)">
      <div class="form-group">
        <label>Title</label>
        <input class="input" name="title" value="${esc(t.title)}">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="input" name="description" rows="3">${esc(t.description)}</textarea>
      </div>
      <div class="form-group" style="background:var(--status-subtle-dim);border-radius:var(--radius);padding:var(--sp-2);">
        <label style="color:var(--status-subtle);">Micro-step — the smallest possible start</label>
        <input class="input" name="micro_step" value="${esc(t.micro_step)}" placeholder="e.g. 'open the file'">
        <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">the first action only. should take ≤2 minutes.</p>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Energy Level</label>
          <select class="input" name="energy_level">${energyOpts}</select>
        </div>
        <div class="form-group">
          <label>Project</label>
          <select class="input" name="project_id">
            <option value="">— None —</option>
            ${projectOpts}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-top:var(--sp-2);">
        <label class="flex items-center" style="gap:var(--sp-1);font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" name="is_banana" value="true" ${t.is_banana ? 'checked' : ''}> Today's focus
        </label>
      </div>
      <div style="display:flex;gap:var(--sp-2);justify-content:space-between;margin-top:var(--sp-4);">
        <div style="display:flex;gap:var(--sp-1);">
          <button type="button" class="btn btn-ghost" onclick="deferTask(${id})">Not Now</button>
          <button type="button" class="btn btn-ghost" style="color:var(--status-warn);" onclick="deleteTask(${id})">Archive</button>
        </div>
        <div style="display:flex;gap:var(--sp-1);">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="button" class="btn btn-orange" onclick="completeTask(${id})">Complete ✓</button>
          <button type="submit" class="btn">Save</button>
        </div>
      </div>
    </form>
  `);
}

async function submitTaskUpdate(id, e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {};
  data.is_banana = fd.get('is_banana') === 'true';
  ['title', 'description', 'micro_step', 'energy_level', 'project_id'].forEach(k => {
    const v = fd.get(k);
    if (k === 'project_id') data[k] = v ? parseInt(v) : null;
    else data[k] = v;
  });
  await put(`/tasks/${id}`, data);
  closeModal();
  renderView(state.view);
}

/* ═══════════════════════════════════════════════════════════════════════
   TASK ACTIONS
   ═══════════════════════════════════════════════════════════════════════ */
async function toggleComplete(id) {
  const t = await get(`/tasks/${id}`);
  if (t.status === 'completed') {
    await post(`/tasks/${id}/reactivate`);
  } else {
    await post(`/tasks/${id}/complete`);
  }
  renderView(state.view);
}

async function completeTask(id) {
  await post(`/tasks/${id}/complete`);
  closeModal();
  renderView(state.view);
}

async function deferTask(id) {
  await post(`/tasks/${id}/defer?until_days=1`);
  closeModal();
  renderView(state.view);
}

async function clearBanana(id) {
  await put(`/tasks/${id}`, { is_banana: false });
  renderView(state.view);
}

async function deleteTask(id) {
  if (!confirm('Archive this task? It will be hidden from active views.')) return;
  await del(`/tasks/${id}`);
  closeModal();
  renderView(state.view);
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECT MODALS
   ═══════════════════════════════════════════════════════════════════════ */
function openNewProject() {
  showModal(`
    <h2>New Project</h2>
    <form id="newProjectForm" onsubmit="submitNewProject(event)">
      <div class="form-group">
        <label>Project Name</label>
        <input class="input" name="name" required autofocus>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="input" name="description" rows="2"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Color</label>
          <input class="input" type="color" name="color" value="#eb5e28" style="height:44px;padding:4px;">
        </div>
        <div class="form-group">
          <label>Stability vs Surprise</label>
          <div class="slider-group">
            <span class="slider-label">surprise</span>
            <input type="range" name="stability_slider" min="0" max="100" value="70">
            <span class="slider-label">stability</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-orange">Create Project</button>
      </div>
    </form>
  `);
}

async function submitNewProject(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  data.stability_slider = parseInt(data.stability_slider);
  await post('/projects', data);
  closeModal();
  renderView(state.view);
}

async function openProjectDetail(id) {
  const p = await get(`/projects/${id}`);
  const tasks = await get(`/tasks?project_id=${id}`);

  showModal(`
    <h2>${esc(p.name)}</h2>
    <p class="text-muted mb-md">${esc(p.description || 'no description')}</p>
    <div class="flex items-center mb-md" style="gap:var(--sp-2);">
      <span class="project-color-dot" style="background:${p.color};width:16px;height:16px;"></span>
      <div class="slider-group" style="flex:1;">
        <span class="slider-label">surprise</span>
        <input type="range" value="${p.stability_slider}" min="0" max="100"
               onchange="updateProjectSlider(${id}, this.value)" style="flex:1;">
        <span class="slider-label">stability</span>
      </div>
    </div>
    <div class="task-list">
      ${tasks.filter(t => t.status === 'active').length === 0
        ? `<p class="text-muted">no active tasks in this project.</p>`
        : tasks.filter(t => t.status === 'active').map(t => renderTaskCard(t)).join('')
      }
    </div>
    <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `);
  attachTaskEvents();
}

async function updateProjectSlider(id, val) {
  await put(`/projects/${id}`, { stability_slider: parseInt(val) });
}

/* ═══════════════════════════════════════════════════════════════════════
   ENERGY
   ═══════════════════════════════════════════════════════════════════════ */
function setEnergy(level) {
  state.energy = level;
  setEnergyIndicator(level);
  post('/energy-log', { level, note: 'user set' }).catch(() => {});
}

function setEnergyIndicator(level) {
  const labels = { low: 'low energy — gentle', medium: 'medium energy — normal', high: 'high energy — focused' };
  document.querySelectorAll('.energy-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.level === level);
  });
  const label = document.querySelector('.energy-label');
  if (label) label.textContent = labels[level] || 'medium';
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
  overlay.innerHTML = `<div class="modal glass">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modalContainer').appendChild(overlay);
  const firstInput = overlay.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

function closeModal() {
  const m = document.getElementById('activeModal');
  if (m) m.remove();
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ═══════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════ */
switchView('dashboard');

document.addEventListener('keydown', (e) => {
  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.target.closest('input,textarea,select')) {
    e.preventDefault();
    openQuickCapture();
  }
});
