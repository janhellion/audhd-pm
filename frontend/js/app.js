     1|/* =========================================================================
     2|   AuDHD Task Manager — Application Logic
     3|   ========================================================================= */
     4|
     5|const API = '/api';
     6|let state = { view: 'dashboard', safeMode: false, energy: 'medium' };
     7|
     8|/* ── API Helpers ────────────────────────────────────────────────────── */
     9|async function api(method, path, body) {
    10|  const opts = { method, headers: { 'Content-Type': 'application/json' } };
    11|  if (body) opts.body = JSON.stringify(body);
    12|  const r = await fetch(API + path, opts);
    13|  if (!r.ok) { const e = await r.text(); console.error('API error', r.status, e); throw new Error(e); }
    14|  return r.json();
    15|}
    16|
    17|const get    = (p) => api('GET', p);
    18|const post   = (p, b) => api('POST', p, b);
    19|const put    = (p, b) => api('PUT', p, b);
    20|const del    = (p) => api('DELETE', p);
    21|
    22|/* ── View Switcher ──────────────────────────────────────────────────── */
    23|function switchView(name) {
    24|  state.view = name;
    25|  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
    26|  document.querySelectorAll('.view-container').forEach(c => c.style.display = c.id === `view-${name}` ? '' : 'none');
    27|
  const titles = {
    dashboard: ['Dashboard', 'your current landscape'],
    tasks: ['Tasks', 'all your active items'],
    board: ['Board', 'visual workflow'],
    projects: ['Projects', 'organise by theme or context'],
    settings: ['Settings', 'preferences & system info'],
  };
  document.getElementById('viewTitle').textContent = titles[name][0];
    35|  document.getElementById('viewSubtitle').textContent = titles[name][1];
    36|
    const actions = document.getElementById('topbarActions');
    if (name === 'tasks' || name === 'dashboard') {
      actions.innerHTML = `<button class="btn btn-orange" onclick="openQuickCapture()">+ New Task</button>`;
    } else if (name === 'projects') {
      actions.innerHTML = `<button class="btn btn-orange" onclick="openNewProject()">+ New Project</button>`;
    } else if (name === 'board') {
      actions.innerHTML = `<button class="btn btn-orange" onclick="openQuickCapture()">+ New Task</button>`;
    } else {
      actions.innerHTML = '';
    }
    45|
    46|  renderView(name);
    47|}
    48|
    49|/* ── Render Views ───────────────────────────────────────────────────── */
    50|async function renderView(name) {
    51|  const el = document.getElementById(`view-${name}`);
    52|  if (!el) return;
    53|  el.innerHTML = `<div class="text-muted" style="padding:2rem;text-align:center;">loading…</div>`;
    54|
  if (name === 'dashboard') await renderDashboard(el);
  else if (name === 'tasks') await renderTasks(el);
  else if (name === 'board') await renderBoard(el);
  else if (name === 'projects') await renderProjects(el);
  else if (name === 'settings') await renderSettings(el);
}
    60|
    61|/* ═══════════════════════════════════════════════════════════════════════
    62|   DASHBOARD
    63|   ═══════════════════════════════════════════════════════════════════════ */
    64|async function renderDashboard(el) {
    65|  const data = await get('/dashboard');
    66|  const active = data.today_tasks.filter(t => t.status === 'active');
    67|  const deferred = data.today_tasks.filter(t => t.status === 'deferred');
    68|
    69|  // Burnout detection
    70|  if (data.deferral_rate > 0.5) {
    71|    const banner = document.getElementById('burnoutBanner');
    72|    banner.style.display = '';
    73|    banner.querySelector('span:nth-child(2)').textContent =
    74|      `Deferral rate is at ${Math.round(data.deferral_rate * 100)}%. Safe mode available.`;
    75|  }
    76|
    77|  // Update energy indicator
    78|  setEnergyIndicator(data.energy_state);
    79|
    80|  el.innerHTML = `
    81|    <div class="dashboard-grid">
    82|      <!-- Banana zone -->
    83|      <div class="full-width banana-zone">
    84|        <div class="banana-label">✦ The One Thing</div>
    85|        ${data.banana
    86|          ? `<div class="banana-task" onclick="openTaskDetail(${data.banana.id})">${esc(data.banana.title)}</div>
    87|             <div style="margin-top:var(--sp-2);display:flex;gap:var(--sp-1);justify-content:center;">
    88|               <button class="btn btn-orange" onclick="completeTask(${data.banana.id})">Done ✓</button>
    89|               <button class="btn btn-ghost" onclick="clearBanana(${data.banana.id})">Unset</button>
    90|             </div>`
    91|          : `<div class="banana-empty">set your focus for today</div>`
    92|        }
    93|      </div>
    94|
    95|      <!-- Active Tasks -->
    96|      <div class="glass full-width">
    97|        <div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Active Tasks</div>
    98|        <div class="task-list">
    99|          ${active.length === 0
   100|            ? `<div class="empty-state" style="padding:var(--sp-4);"><p>nothing active yet. add a task to get started.</p></div>`
   101|            : active.map(t => renderTaskCard(t)).join('')
   102|          }
   103|        </div>
   104|      </div>
   105|    </div>
   106|  `;
   107|
   108|  // Re-attach drag events for task list
   109|  attachTaskEvents();
   110|}
   111|
   112|/* ═══════════════════════════════════════════════════════════════════════
   113|   TASKS VIEW
   114|   ═══════════════════════════════════════════════════════════════════════ */
   115|async function renderTasks(el) {

/* ═══════════════════════════════════════════════════════════════════════
   BOARD (KANBAN) VIEW
   ═══════════════════════════════════════════════════════════════════════ */
async function renderBoard(el) {
  const tasks = await get('/tasks');
  // Group by status
  const todo = tasks.filter(t => t.status === 'active' && !t.is_banana);
  const inprogress = tasks.filter(t => t.status === 'active' && t.is_banana);
  const done = tasks.filter(t => t.status === 'completed');

  el.innerHTML = `
    <div class="kanban-board">
      <div class="kanban-column" data-col="todo">
        <div class="kanban-column-header">
          <span class="kanban-col-title">To Do</span>
          <span class="kanban-col-count">${todo.length}</span>
        </div>
        <div class="kanban-card-list">
          ${todo.length === 0
            ? '<div class="kanban-empty">clear horizon</div>'
            : todo.map(t => renderKanbanCard(t)).join('')
          }
        </div>
      </div>
      <div class="kanban-column" data-col="focus">
        <div class="kanban-column-header">
          <span class="kanban-col-title">Focus</span>
          <span class="kanban-col-count">${inprogress.length}</span>
        </div>
        <div class="kanban-card-list">
          ${inprogress.length === 0
            ? '<div class="kanban-empty">nothing in focus. set your banana.</div>'
            : inprogress.map(t => renderKanbanCard(t)).join('')
          }
        </div>
      </div>
      <div class="kanban-column" data-col="done">
        <div class="kanban-column-header">
          <span class="kanban-col-title">Done</span>
          <span class="kanban-col-count">${done.length}</span>
        </div>
        <div class="kanban-card-list">
          ${done.length === 0
            ? '<div class="kanban-empty">nothing completed yet</div>'
            : done.slice(0, 10).map(t => renderKanbanCard(t)).join('')
          }
        </div>
      </div>
    </div>
  `;
}

function renderKanbanCard(t) {
  const energyClass = t.energy_level ? `kanban-energy-${t.energy_level}` : '';
  const bananaMark = t.is_banana ? '<span class="kanban-badge">★ today</span>' : '';
  return `
    <div class="kanban-card glass-sm ${energyClass}" data-task-id="${t.id}" onclick="openTaskDetail(${t.id})">
      <div class="kanban-card-title">${esc(t.title)}</div>
      <div class="kanban-card-meta">
        ${bananaMark}
        ${t.micro_step ? `<span class="kanban-micro">↳ ${esc(t.micro_step)}</span>` : ''}
      </div>
      <div class="kanban-card-actions">
        ${t.status !== 'completed'
          ? `<button class="btn btn-icon" onclick="event.stopPropagation();completeTask(${t.id});renderView('board')" title="Complete">✓</button>`
          : ''
        }
        <button class="btn btn-icon" onclick="event.stopPropagation();openTaskDetail(${t.id})" title="Edit">✎</button>
      </div>
    </div>
  `;
}

   116|  const tasks = await get('/tasks');
   117|  const active = tasks.filter(t => t.status === 'active');
   118|  const deferred = tasks.filter(t => t.status === 'deferred');
   119|  const completed = tasks.filter(t => t.status === 'completed');
   120|
   121|  el.innerHTML = `
   122|    <!-- Quick Capture -->
   123|    <div class="glass quick-capture mb-lg" style="padding:var(--sp-3);">
   124|      <div class="flex items-center" style="gap:var(--sp-2);">
   125|        <input class="input" id="quickTaskInput" placeholder="what needs doing? (enter to add)" style="flex:1;"
   126|               onkeydown="if(event.key==='Enter') quickAddTask(this.value)">
   127|        <button class="btn btn-orange" onclick="quickAddTask(document.getElementById('quickTaskInput').value)">Add</button>
   128|      </div>
   129|    </div>
   130|
   131|    <!-- Tabs -->
   132|    <div class="flex items-center mb-md" style="gap:var(--sp-2);">
   133|      <div class="view-toggle" id="taskTabs">
   134|        <button class="active" data-filter="active" onclick="filterTasks('active')">Active (${active.length})</button>
   135|        <button data-filter="deferred" onclick="filterTasks('deferred')">Deferred (${deferred.length})</button>
   136|        <button data-filter="completed" onclick="filterTasks('completed')">Done (${completed.length})</button>
   137|      </div>
   138|    </div>
   139|
   140|    <!-- Task lists (shown/hidden by filter) -->
   141|    <div id="taskListActive" class="task-list">
   142|      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Active</div>
   143|      ${active.length === 0
   144|        ? `<div class="empty-state"><p>all clear. nothing active right now.</p></div>`
   145|        : active.map(t => renderTaskCard(t)).join('')
   146|      }</div>
   147|    </div>
   148|
   149|    <div id="taskListDeferred" class="task-list" style="display:none;">
   150|      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Deferred</div>
   151|      ${deferred.length === 0
   152|        ? `<div class="empty-state"><p>no deferred tasks.</p></div>`
   153|        : deferred.map(t => renderTaskCard(t)).join('')
   154|      }</div>
   155|    </div>
   156|
   157|    <div id="taskListCompleted" class="task-list" style="display:none;">
   158|      <div class="glass"><div class="task-section-title" style="padding:var(--sp-3) var(--sp-3) 0;">Completed</div>
   159|      ${completed.length === 0
   160|        ? `<div class="empty-state"><p>complete something to see it here.</p></div>`
   161|        : completed.map(t => renderTaskCard(t)).join('')
   162|      }</div>
   163|    </div>
   164|  `;
   165|
   166|  attachTaskEvents();
   167|}
   168|
   169|let _currentTaskFilter = 'active';
   170|function filterTasks(filter) {
   171|  _currentTaskFilter = filter;
   172|  document.querySelectorAll('#taskTabs button').forEach(b => {
   173|    b.classList.toggle('active', b.dataset.filter === filter);
   174|  });
   175|  ['active', 'deferred', 'completed'].forEach(f => {
   176|    document.getElementById(`taskList${f.charAt(0).toUpperCase()+f.slice(1)}`).style.display = f === filter ? '' : 'none';
   177|  });
   178|}
   179|
   180|/* ═══════════════════════════════════════════════════════════════════════
   181|   PROJECTS VIEW
   182|   ═══════════════════════════════════════════════════════════════════════ */
   183|async function renderProjects(el) {
   184|  const projects = await get('/projects');
   185|  const tasks = await get('/tasks');
   186|
   187|  el.innerHTML = `
   188|    <div class="projects-grid">
   189|      ${projects.length === 0
   190|        ? `<div class="glass full-width empty-state"><h3>no projects yet</h3><p>create a project to group your tasks by context or theme.</p></div>`
   191|        : projects.map(p => {
   192|            const projectTasks = tasks.filter(t => t.project_id === p.id);
   193|            const activeCount = projectTasks.filter(t => t.status === 'active').length;
   194|            return `
   195|              <div class="glass project-card" onclick="openProjectDetail(${p.id})">
   196|                <div class="project-card-header">
   197|                  <span class="project-color-dot" style="background:${p.color}"></span>
   198|                  <span class="project-name">${esc(p.name)}</span>
   199|                  <span class="project-task-count">${activeCount} active</span>
   200|                </div>
   201|                ${p.description ? `<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:var(--sp-1);">${esc(p.description)}</p>` : ''}
   202|                <div class="flex items-center" style="gap:var(--sp-2);margin-top:var(--sp-2);">
   203|                  <span style="font-size:0.75rem;color:var(--text-muted);">stability</span>
   204|                  <div style="flex:1;height:4px;background:var(--border-subtle);border-radius:2px;position:relative;">
   205|                    <div style="position:absolute;left:0;top:0;height:100%;width:${p.stability_slider}%;background:var(--orange);border-radius:2px;"></div>
   206|                  </div>
   207|                  <span style="font-size:0.7rem;color:var(--text-muted);">${p.stability_slider}%</span>
   208|                </div>
   209|                <div style="margin-top:var(--sp-2);display:flex;gap:var(--sp-1);flex-wrap:wrap;">
   210|                  ${projectTasks.filter(t => t.is_banana).map(t => `<span class="badge badge-banana">★ ${esc(t.title)}</span>`).join('')}
   211|                </div>
   212|              </div>
   213|            `;
   214|          }).join('')
   215|      }
   216|    </div>
   217|  `;
   218|}
   219|
   220|/* ═══════════════════════════════════════════════════════════════════════
   221|   SETTINGS VIEW
   222|   ═══════════════════════════════════════════════════════════════════════ */
   223|async function renderSettings(el) {
   224|  el.innerHTML = `
   225|    <div class="glass" style="padding:var(--sp-4);max-width:600px;">
   226|      <h2 style="font-size:1rem;margin-bottom:var(--sp-3);">System</h2>
   227|      <div class="form-group">
   228|        <label>Database location</label>
   229|        <p class="text-muted" style="font-size:0.85rem;">Local SQLite — data never leaves your server.</p>
   230|      </div>
   231|      <div class="form-group">
   232|        <label>Version</label>
   233|        <p class="text-muted" style="font-size:0.85rem;">AuDHD Task Manager v1.0.0</p>
   234|      </div>
   235|      <div class="form-group">
   236|        <label>Principles</label>
   237|        <ul style="font-size:0.85rem;color:var(--text-secondary);padding-left:var(--sp-4);list-style-type:'· ';">
   238|          <li>No streak counters, no deadlines, no guilt</li>
   239|          <li>Data is local-first and yours only</li>
   240|          <li>Energy-based scheduling, not calendar blocks</li>
   241|          <li>Glass design, dark mode, sensory-friendly</li>
   242|        </ul>
   243|      </div>
   244|    </div>
   245|  `;
   246|}
   247|
   248|/* ═══════════════════════════════════════════════════════════════════════
   249|   TASK CARD RENDERER
   250|   ═══════════════════════════════════════════════════════════════════════ */
   251|function renderTaskCard(t) {
   252|  const energyBadge = t.energy_level ? `<span class="badge badge-${t.energy_level}">${t.energy_level}</span>` : '';
   253|  const bananaMark = t.is_banana ? `<span class="badge badge-banana">★ today</span>` : '';
   254|  const microHtml = t.micro_step ? `<div class="task-micro">↳ ${esc(t.micro_step)}</div>` : '';
   255|
   256|  return `
   257|    <div class="glass task-card ${t.status === 'completed' ? 'completed' : ''}" data-task-id="${t.id}" onclick="openTaskDetail(${t.id})">
   258|      <div class="task-check ${t.status === 'completed' ? 'done' : ''}" onclick="event.stopPropagation();toggleComplete(${t.id})">${t.status === 'completed' ? '✓' : ''}</div>
   259|      <div class="task-body">
   260|        <div class="task-title">${esc(t.title)}</div>
   261|        <div class="task-meta">${energyBadge} ${bananaMark}</div>
   262|        ${microHtml}
   263|      </div>
   264|    </div>
   265|  `;
   266|}
   267|
   268|function attachTaskEvents() {
   269|  // handled by inline onclick
   270|}
   271|
   272|/* ═══════════════════════════════════════════════════════════════════════
   273|   QUICK CAPTURE
   274|   ═══════════════════════════════════════════════════════════════════════ */
   275|async function quickAddTask(title) {
   276|  if (!title || !title.trim()) return;
   277|  const input = document.getElementById('quickTaskInput');
   278|  if (input) input.value = '';
   279|  await post('/tasks', {
   280|    title: title.trim(),
   281|    energy_level: state.energy,
   282|    description: '',
   283|    micro_step: '',
   284|    is_banana: false,
   285|  });
   286|  renderView(state.view);
   287|}
   288|
   289|function openQuickCapture() {
   290|  showModal(`
   291|    <h2>New Task</h2>
   292|    <form id="newTaskForm" onsubmit="submitNewTask(event)">
   293|      <div class="form-group">
   294|        <label>What needs doing?</label>
   295|        <input class="input" name="title" placeholder="task title" required autofocus>
   296|      </div>
   297|      <div class="form-group">
   298|        <label>First step (optional — make it tiny, 2 min max)</label>
   299|        <input class="input" name="micro_step" placeholder="e.g. 'open the file and write the first sentence'">
   300|      </div>
   301|      <div class="form-row">
   302|        <div class="form-group">
   303|          <label>Energy</label>
   304|          <select class="input" name="energy_level">
   305|            <option value="low">Low — gentle work</option>
   306|            <option value="medium" selected>Medium — normal flow</option>
   307|            <option value="high">High — tackle anything</option>
   308|          </select>
   309|        </div>
   310|        <div class="form-group">
   311|          <label>Set as today's focus?</label>
   312|          <select class="input" name="is_banana">
   313|            <option value="false">No</option>
   314|            <option value="true">Yes — the one thing</option>
   315|          </select>
   316|        </div>
   317|      </div>
   318|      <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">
   319|        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
   320|        <button type="submit" class="btn btn-orange">Create</button>
   321|      </div>
   322|    </form>
   323|  `);
   324|}
   325|
   326|async function submitNewTask(e) {
   327|  e.preventDefault();
   328|  const fd = new FormData(e.target);
   329|  const data = Object.fromEntries(fd.entries());
   330|  data.is_banana = data.is_banana === 'true';
   331|  await post('/tasks', data);
   332|  closeModal();
   333|  renderView(state.view);
   334|}
   335|
   336|/* ═══════════════════════════════════════════════════════════════════════
   337|   TASK DETAIL MODAL
   338|   ═══════════════════════════════════════════════════════════════════════ */
   339|async function openTaskDetail(id) {
   340|  const t = await get(`/tasks/${id}`);
   341|  const projects = await get('/projects');
   342|
   343|  const energyOpts = ['low', 'medium', 'high'].map(e =>
   344|    `<option value="${e}" ${t.energy_level === e ? 'selected' : ''}>${e.charAt(0).toUpperCase()+e.slice(1)}</option>`
   345|  ).join('');
   346|
   347|  const projectOpts = projects.map(p =>
   348|    `<option value="${p.id}" ${t.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`
   349|  ).join('');
   350|
   351|  showModal(`
   352|    <h2>${esc(t.title)}</h2>
   353|    <form id="taskDetailForm" onsubmit="submitTaskUpdate(${id}, event)">
   354|      <div class="form-group">
   355|        <label>Title</label>
   356|        <input class="input" name="title" value="${esc(t.title)}">
   357|      </div>
   358|      <div class="form-group">
   359|        <label>Description</label>
   360|        <textarea class="input" name="description" rows="3">${esc(t.description)}</textarea>
   361|      </div>
   362|      <div class="form-group" style="background:var(--status-subtle-dim);border-radius:var(--radius);padding:var(--sp-2);">
   363|        <label style="color:var(--status-subtle);">Micro-step — the smallest possible start</label>
   364|        <input class="input" name="micro_step" value="${esc(t.micro_step)}" placeholder="e.g. 'open the file'">
   365|        <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">the first action only. should take ≤2 minutes.</p>
   366|      </div>
   367|      <div class="form-row">
   368|        <div class="form-group">
   369|          <label>Energy Level</label>
   370|          <select class="input" name="energy_level">${energyOpts}</select>
   371|        </div>
   372|        <div class="form-group">
   373|          <label>Project</label>
   374|          <select class="input" name="project_id">
   375|            <option value="">— None —</option>
   376|            ${projectOpts}
   377|          </select>
   378|        </div>
   379|      </div>
   380|      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-top:var(--sp-2);">
   381|        <label class="flex items-center" style="gap:var(--sp-1);font-size:0.85rem;cursor:pointer;">
   382|          <input type="checkbox" name="is_banana" value="true" ${t.is_banana ? 'checked' : ''}> Today's focus
   383|        </label>
   384|      </div>
   385|      <div style="display:flex;gap:var(--sp-2);justify-content:space-between;margin-top:var(--sp-4);">
   386|        <div style="display:flex;gap:var(--sp-1);">
   387|          <button type="button" class="btn btn-ghost" onclick="deferTask(${id})">Not Now</button>
   388|          <button type="button" class="btn btn-ghost" style="color:var(--status-warn);" onclick="deleteTask(${id})">Archive</button>
   389|        </div>
   390|        <div style="display:flex;gap:var(--sp-1);">
   391|          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
   392|          <button type="button" class="btn btn-orange" onclick="completeTask(${id})">Complete ✓</button>
   393|          <button type="submit" class="btn">Save</button>
   394|        </div>
   395|      </div>
   396|    </form>
   397|  `);
   398|}
   399|
   400|async function submitTaskUpdate(id, e) {
   401|  e.preventDefault();
   402|  const fd = new FormData(e.target);
   403|  const data = {};
   404|
   405|  // Handle checkbox
   406|  data.is_banana = fd.get('is_banana') === 'true';
   407|
   408|  ['title', 'description', 'micro_step', 'energy_level', 'project_id'].forEach(k => {
   409|    const v = fd.get(k);
   410|    if (k === 'project_id') data[k] = v ? parseInt(v) : null;
   411|    else data[k] = v;
   412|  });
   413|
   414|  await put(`/tasks/${id}`, data);
   415|  closeModal();
   416|  renderView(state.view);
   417|}
   418|
   419|/* ═══════════════════════════════════════════════════════════════════════
   420|   TASK ACTIONS
   421|   ═══════════════════════════════════════════════════════════════════════ */
   422|async function toggleComplete(id) {
   423|  // If currently completed, reactivate; else complete
   424|  const t = await get(`/tasks/${id}`);
   425|  if (t.status === 'completed') {
   426|    await post(`/tasks/${id}/reactivate`);
   427|  } else {
   428|    await post(`/tasks/${id}/complete`);
   429|  }
   430|  renderView(state.view);
   431|}
   432|
   433|async function completeTask(id) {
   434|  await post(`/tasks/${id}/complete`);
   435|  closeModal();
   436|  renderView(state.view);
   437|}
   438|
   439|async function deferTask(id) {
   440|  await post(`/tasks/${id}/defer?until_days=1`);
   441|  closeModal();
   442|  renderView(state.view);
   443|}
   444|
   445|async function clearBanana(id) {
   446|  await put(`/tasks/${id}`, { is_banana: false });
   447|  renderView(state.view);
   448|}
   449|
   450|async function deleteTask(id) {
   451|  if (!confirm('Archive this task? It will be hidden from active views.')) return;
   452|  await del(`/tasks/${id}`);
   453|  closeModal();
   454|  renderView(state.view);
   455|}
   456|
   457|/* ═══════════════════════════════════════════════════════════════════════
   458|   PROJECT MODALS
   459|   ═══════════════════════════════════════════════════════════════════════ */
   460|function openNewProject() {
   461|  showModal(`
   462|    <h2>New Project</h2>
   463|    <form id="newProjectForm" onsubmit="submitNewProject(event)">
   464|      <div class="form-group">
   465|        <label>Project Name</label>
   466|        <input class="input" name="name" required autofocus>
   467|      </div>
   468|      <div class="form-group">
   469|        <label>Description</label>
   470|        <textarea class="input" name="description" rows="2"></textarea>
   471|      </div>
   472|      <div class="form-row">
   473|        <div class="form-group">
   474|          <label>Color</label>
   475|          <input class="input" type="color" name="color" value="#eb5e28" style="height:44px;padding:4px;">
   476|        </div>
   477|        <div class="form-group">
   478|          <label>Stability vs Surprise</label>
   479|          <div class="slider-group">
   480|            <span class="slider-label">surprise</span>
   481|            <input type="range" name="stability_slider" min="0" max="100" value="70">
   482|            <span class="slider-label">stability</span>
   483|          </div>
   484|        </div>
   485|      </div>
   486|      <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4);">
   487|        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
   488|        <button type="submit" class="btn btn-orange">Create Project</button>
   489|      </div>
   490|    </form>
   491|  `);
   492|}
   493|
   494|async function submitNewProject(e) {
   495|  e.preventDefault();
   496|  const fd = new FormData(e.target);
   497|  const data = Object.fromEntries(fd.entries());
   498|  data.stability_slider = parseInt(data.stability_slider);
   499|  await post('/projects', data);
   500|  closeModal();
   501|