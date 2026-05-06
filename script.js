
// Guard: redirect to login if not authenticated
(function() {
  if (!localStorage.getItem('toduck_active')) {
    window.location.href = 'login.html';
  }
})();

// ── STATE ──────────────────────────────────
let tasks = JSON.parse(localStorage.getItem('toduck_tasks') || '[]');
let projects = JSON.parse(localStorage.getItem('toduck_projects') || '[]');

if (!projects.find(p => p.id === 'default')) {
  projects.unshift({ id: 'default', name: 'Umum', color: '#EF4444' });
  saveProjects();
}

function saveTasks() { localStorage.setItem('toduck_tasks', JSON.stringify(tasks)); }
function saveProjects() { localStorage.setItem('toduck_projects', JSON.stringify(projects)); }

let state = {
  currentPage: 'dashboard',
  selectedDate: todayStr(),
  dashPomo: { time: 25 * 60, running: false, interval: null },
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth()
};

function todayStr() {  return formatLocalDate(new Date()); }
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function activeUser() {
  return JSON.parse(localStorage.getItem('toduck_active') || '{}');
}

// ── NAVIGATION ─────────────────────────────
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  
  const pageEl = document.getElementById('page-' + page);
  if(pageEl) pageEl.classList.add('active');
  
  const navEl = document.querySelector(`.nav-item[onclick*="${page}"]`);
  if (navEl) navEl.classList.add('active');
  
  state.currentPage = page;
  
  if (page === 'dashboard') { if(typeof renderDashboard === 'function') renderDashboard(); }
  if (page === 'todo') { if(typeof render === 'function') render(); }
  if (page === 'pomodoro') { 
    if(typeof renderTaskList === 'function') renderTaskList(); 
    if(typeof updateDisplay === 'function') updateDisplay(); 
  }
  if (page === 'settings') { if(typeof renderSettings === 'function') renderSettings(); }
}

// ── DASHBOARD ──────────────────────────────
function renderDashboard() {

  renderCalendar();
  renderDashTaskList();
  updateDuckSpeech();
  renderDashPomoStats();
}

function renderDashTaskList() {
  const container = document.getElementById('dash-task-list');
  const dateLabel = document.getElementById('task-widget-date');
  const filteredTasks = tasks.filter(t => t.date === state.selectedDate);

  dateLabel.textContent = formatDate(state.selectedDate).toUpperCase();

  if (filteredTasks.length === 0) {
    container.innerHTML = `<div style="color:var(--grey);font-size:14px;font-weight:700;padding:20px 0;text-align:center;">Tidak ada tugas untuk hari ini 🐥</div>`;
    return;
  }

  container.innerHTML = filteredTasks
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map(t => {
      const proj = projects.find(p => p.id === t.projectId) || { color: '#EF4444' };
      return `
      <div class="task-row">
        <span class="task-time">${t.time || '--:--'}</span>
        <div class="task-bar" style="background:${proj.color}88;"></div>
        <span class="task-name-text ${t.done ? 'done' : ''}">${t.name}</span>
        <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
        <button class="task-delete" onclick="deleteTask('${t.id}')">×</button>
      </div>`;
    }).join('');
}

function updateDuckSpeech() {
  const messages = [
    'Quack! Ayo selesaikan tugasmu hari ini! 🎯',
    'Semangat! Kamu sudah hebat! ⭐',
    'Jangan lupa istirahat ya! ☕',
    'Fokus, kamu bisa! 💪',
    'Quack quack! Produktif itu keren! 🚀'
  ];
  const todayTasks = tasks.filter(t => t.date === state.selectedDate);
  const done = tasks.filter(t => t.done).length;
  let msg;
  if (todayTasks.length === 0) msg = 'Belum ada tugas hari ini. Santai dulu! 😴';
  else if (done === todayTasks.length) msg = 'Semua tugas selesai! Hebat! 🎉';
  else msg = messages[Math.floor(Math.random() * messages.length)];
  document.getElementById('duck-speech').textContent = msg;
}

// ── CALENDAR ───────────────────────────────
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function renderCalendar() {
  const yr = state.calendarYear;
  const mo = state.calendarMonth;
  document.getElementById('cal-month-label').textContent =
    MONTH_NAMES[mo].toUpperCase().slice(0, 3) + ' ' + yr;

  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const daysInPrev = new Date(yr, mo, 0).getDate();
  const today = todayStr();

  let html = '';
  let cellCount = 0;

  // Weeks
  for (let week = 0; week < 6; week++) {
    let weekHtml = '<div class="cal-week">';
    for (let day = 0; day < 7; day++) {
      cellCount++;
      let cellDate, muted = false;
      const pos = cellCount - firstDay - 1;
      if (cellCount <= firstDay) {
        // Prev month
        cellDate = new Date(yr, mo - 1, daysInPrev - firstDay + cellCount);
        muted = true;
      } else if (pos >= daysInMonth) {
        // Next month
        cellDate = new Date(yr, mo + 1, pos - daysInMonth + 1);
        muted = true;
      } else {
        cellDate = new Date(yr, mo, pos + 1);
      }

      const dateStr = formatLocalDate(cellDate);
      const isToday = dateStr === today;
      const isSelected = dateStr === state.selectedDate;
      const isSun = day === 0;

      let cls = 'cal-cell';
      if (muted) cls += ' muted';
      if (isSun && !muted) cls += ' sun';
      if (isToday) cls += ' today';
      if (isSelected && !isToday) cls += ' selected';

      weekHtml += `<div class="${cls}" onclick="selectDate('${dateStr}')">${cellDate.getDate()}</div>`;
    }
    weekHtml += '</div>';
    html += weekHtml;
    if (cellCount - firstDay >= daysInMonth && week >= 3) break;
  }

  document.getElementById('cal-grid').innerHTML = html;
}

function selectDate(dateStr) {
  state.selectedDate = dateStr;
  renderCalendar();
  renderDashTaskList();
}

document.getElementById('cal-prev').addEventListener('click', () => {
  state.calendarMonth--;
  if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
  renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  state.calendarMonth++;
  if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
  renderCalendar();
});

// ── DASHBOARD POMODORO MINI ─────────────────
function renderDashPomoStats() {
  const stats = JSON.parse(localStorage.getItem('toduck_pomo_stats') || '{"sessions":0,"tasks":0,"minutes":0}');
  const el = document.getElementById('dash-pomo-time');
  if (el) {
    el.innerHTML = `<div style="font-size:14px;line-height:1.2;">Sesi: ${stats.sessions}<br>Tugas: ${stats.tasks}</div>`;
  }
}

function dashPomoToggle() {
  if (state.dashPomo.running) {
    clearInterval(state.dashPomo.interval);
    state.dashPomo.running = false;
    document.getElementById('dash-pomo-play').classList.remove('paused');
  } else {
    state.dashPomo.running = true;
    document.getElementById('dash-pomo-play').classList.add('paused');
    state.dashPomo.interval = setInterval(() => {
      if (state.dashPomo.time > 0) {
        state.dashPomo.time--;
        document.getElementById('dash-pomo-time').textContent = formatTime(state.dashPomo.time);
        // Sync with main pomo
        state.pomodoro.time = state.dashPomo.time;
      } else {
        clearInterval(state.dashPomo.interval);
        state.dashPomo.running = false;
        document.getElementById('dash-pomo-play').classList.remove('paused');
        showToast('🎉 Sesi Pomodoro selesai!');
      }
    }, 1000);
  }
}

function dashPomoReset() {
  clearInterval(state.dashPomo.interval);
  state.dashPomo.running = false;
  state.dashPomo.time = 25 * 60;
  document.getElementById('dash-pomo-play').classList.remove('paused');
  document.getElementById('dash-pomo-time').textContent = formatTime(state.dashPomo.time);
}


// ── SETTINGS ───────────────────────────────
function renderSettings() {
  const user = activeUser();
  document.getElementById('set-name').value = user.name || '';
  document.getElementById('set-email').value = user.email || '';
  document.getElementById('set-old-pass').value = '';
  document.getElementById('set-new-pass').value = '';
  document.getElementById('set-new-pass2').value = '';
}

function saveProfile() {
  const name = document.getElementById('set-name').value.trim();
  const email = document.getElementById('set-email').value.trim();
  if (!name || !email) { showToast('⚠️ Nama dan email tidak boleh kosong!'); return; }
  const user = activeUser();
  user.name = name;
  user.email = email;
  localStorage.setItem('toduck_active', JSON.stringify(user));
  // Update in users list
  const users = JSON.parse(localStorage.getItem('toduck_users') || '[]');
  const idx = users.findIndex(u => u.email === user.email || u.username === user.username);
  if (idx >= 0) { users[idx].name = name; users[idx].email = email; }
  localStorage.setItem('toduck_users', JSON.stringify(users));
  updateSidebarUser();
  showToast('✅ Profil berhasil disimpan!');
}

function changePassword() {
  const oldPass = document.getElementById('set-old-pass').value;
  const newPass = document.getElementById('set-new-pass').value;
  const newPass2 = document.getElementById('set-new-pass2').value;
  if (!oldPass || !newPass || !newPass2) { showToast('⚠️ Isi semua kolom password!'); return; }
  if (newPass !== newPass2) { showToast('❌ Password baru tidak sama!'); return; }
  const user = activeUser();
  const users = JSON.parse(localStorage.getItem('toduck_users') || '[]');
  const idx = users.findIndex(u => (u.email === user.email) && u.password === oldPass);
  if (idx < 0) { showToast('❌ Password lama salah!'); return; }
  users[idx].password = newPass;
  localStorage.setItem('toduck_users', JSON.stringify(users));
  showToast('✅ Password berhasil diubah!');
}

function doLogout() {
  if (confirm('Yakin mau logout?')) {
    localStorage.removeItem('toduck_active');
    window.location.href = 'login.html';
  }
}

function updateSidebarUser() {
  const user = activeUser();
  const nameEl = document.getElementById('sidebar-name');
  const avatarEl = document.getElementById('sidebar-avatar');
  if (nameEl) nameEl.textContent = user.name ? user.name.split(' ')[0] : 'Pengguna';
  if (avatarEl) avatarEl.textContent = user.name ? user.name[0].toUpperCase() : '👤';
}


// ── TODO JS ──

    // ─── STATE ───
    tasks = JSON.parse(localStorage.getItem('toduck_tasks') || '[]');
    projects = JSON.parse(localStorage.getItem('toduck_projects') || '[]');

    // Ensure default project
    if (!projects.find(p => p.id === 'default')) {
      projects.unshift({ id: 'default', name: 'Umum', color: '#EF4444' });
      saveProjects();
    }

    let currentProject = '__all__';
    let currentFilter = 'all';
    let currentView = 'list';
    let editingTaskId = null;
    let selectedReminder = '30m';
    let selectedColor = '#EF4444';

    

    function formatDisplayDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T00:00:00');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const diff = Math.floor((d - today) / 86400000);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      if (diff === 0) return 'Hari Ini';
      if (diff === 1) return 'Besok';
      if (diff === -1) return 'Kemarin';
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

   function formatGroupDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');

  const today = todayStr();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  if (dateStr === today) return { label: '📅 Hari Ini', isToday: true };
  if (dateStr === tomorrowStr) return { label: '🌅 Besok', isToday: false };

  return {
    label: `${dayNames[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`,
    isToday: false
  };
}

    
    // ─── RENDER ───
    function render() {
      renderProjectPanel();
      renderProjectSelect();
      renderTasks();
      renderProgress();
    }

    function renderProjectPanel() {
      const today = todayStr();
      const todayCount = tasks.filter(t => t.date === today && !t.done).length;
      const allCount = tasks.filter(t => !t.done).length;

      document.getElementById('count-all').textContent = allCount;
      document.getElementById('count-today').textContent = todayCount;

      // Mark active
      document.querySelectorAll('.proj-item').forEach(el => el.classList.remove('active'));
      if (currentProject === '__all__') document.getElementById('proj-all').classList.add('active');
      else if (currentProject === '__today__') document.getElementById('proj-today').classList.add('active');

      const list = document.getElementById('projects-list');
      list.innerHTML = projects.map(p => {
        const count = tasks.filter(t => t.projectId === p.id && !t.done).length;
        return `
    <div class="proj-item ${currentProject === p.id ? 'active' : ''}" onclick="selectProject('${p.id}')">
      <span class="proj-dot" style="background:${p.color};"></span>
      ${p.name}
      <span class="proj-count">${count}</span>
      ${p.id !== 'default' ? `<button onclick="event.stopPropagation();deleteProject('${p.id}')" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;margin-left:2px;" title="Hapus">×</button>` : ''}
    </div>`;
      }).join('');
    }

    function renderProjectSelect() {
      const sel = document.getElementById('t-project');
      sel.innerHTML = `<option value="">Tidak ada proyek</option>` +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    function getFilteredTasks() {
      let filtered = [...tasks];

      // Project filter
      if (currentProject === '__today__') {
        filtered = filtered.filter(t => t.date === todayStr());
      } else if (currentProject !== '__all__') {
        filtered = filtered.filter(t => t.projectId === currentProject);
      }

      // Status filter
      if (currentFilter === 'active') filtered = filtered.filter(t => !t.done);
      if (currentFilter === 'done') filtered = filtered.filter(t => t.done);
      if (currentFilter === 'today') filtered = filtered.filter(t => t.date === todayStr());

      return filtered;
    }

    function renderTasks() {
      const container = document.getElementById('todo-content');
      const filtered = getFilteredTasks();

      if (filtered.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-duck">🦆</div>
        <p>Tidak ada tugas di sini.</p>
        <p style="margin-top:6px;font-size:13px;">Quack! Tambah tugas baru yuk!</p>
      </div>`;
        return;
      }

      if (currentView === 'group') {
        renderGroupView(container, filtered);
      } else {
        renderListView(container, filtered);
      }
    }

    function renderListView(container, filtered) {
      // Group by date
      const groups = {};
      const noDate = [];

      filtered.forEach(t => {
        if (!t.date) { noDate.push(t); return; }
        if (!groups[t.date]) groups[t.date] = [];
        groups[t.date].push(t);
      });

      const sortedDates = Object.keys(groups).sort();
      let html = '';

      sortedDates.forEach(date => {
        const { label, isToday } = formatGroupDate(date);
        const dayTasks = groups[date];
        html += `
    <div class="date-group">
      <div class="date-group-header">
        <span class="date-group-label ${isToday ? 'today-label' : ''}">${label}</span>
        <div class="date-group-line"></div>
        <span class="date-group-count">${dayTasks.length} tugas</span>
      </div>
      ${dayTasks.map(t => taskCardHTML(t)).join('')}
    </div>`;
      });

      if (noDate.length) {
        html += `
    <div class="date-group">
      <div class="date-group-header">
        <span class="date-group-label">📌 Tanpa Deadline</span>
        <div class="date-group-line"></div>
      </div>
      ${noDate.map(t => taskCardHTML(t)).join('')}
    </div>`;
      }

      container.innerHTML = html;
    }

    function renderGroupView(container, filtered) {
      let html = '';

      // Group by project
      const projectGroups = {};
      const noProject = [];

      filtered.forEach(t => {
        if (!t.projectId) { noProject.push(t); return; }
        if (!projectGroups[t.projectId]) projectGroups[t.projectId] = [];
        projectGroups[t.projectId].push(t);
      });

      projects.forEach(p => {
        const pTasks = projectGroups[p.id] || [];
        if (pTasks.length === 0) return;
        html += `
    <div class="date-group">
      <div class="date-group-header">
        <span class="date-group-label" style="color:${p.color};">⬤ ${p.name}</span>
        <div class="date-group-line" style="background:linear-gradient(to right, ${p.color}44, transparent);"></div>
        <span class="date-group-count">${pTasks.filter(t => !t.done).length} aktif</span>
      </div>
      ${pTasks.map(t => taskCardHTML(t)).join('')}
    </div>`;
      });

      if (noProject.length) {
        html += `
    <div class="date-group">
      <div class="date-group-header">
        <span class="date-group-label">📌 Tanpa Proyek</span>
        <div class="date-group-line"></div>
      </div>
      ${noProject.map(t => taskCardHTML(t)).join('')}
    </div>`;
      }

      container.innerHTML = html || `<div class="empty-state"><div class="empty-duck">🦆</div><p>Tidak ada tugas.</p></div>`;
    }

    function taskCardHTML(t) {
      const proj = projects.find(p => p.id === t.projectId);
      const today = todayStr();
      const isOverdue = t.date && t.date < today && !t.done;

      return `
  <div class="task-card ${t.done ? 'done-card' : ''}" id="task-${t.id}">
    ${proj ? `<div class="task-priority-bar" style="background:${proj.color};"></div>` : ''}
    <div class="task-checkbox-big ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
    <div class="task-card-body" style="padding-left:${proj ? '4px' : '0'}">
      <div class="task-card-name ${t.done ? 'done-text' : ''}">${t.name}</div>
      ${t.desc ? `<div class="task-card-desc">${t.desc}</div>` : ''}
      <div class="task-card-meta">
        ${t.date ? `<span class="task-meta-pill pill-time" style="${isOverdue ? 'background:#FEE2E2;color:#EF4444;' : ''}">
          ${isOverdue ? '⚠️' : '📅'} ${formatDisplayDate(t.date)}${t.time ? ' · ' + t.time : ''}
        </span>` : ''}
        ${t.reminder ? `<span class="task-meta-pill pill-reminder">🔔 ${reminderLabel(t.reminderVal)}</span>` : ''}
        ${proj ? `<span class="task-meta-pill pill-project" style="background:${proj.color}22;color:${proj.color};">${proj.name}</span>` : ''}
      </div>
    </div>
    <div class="task-card-actions">
      <button class="action-btn" onclick="editTask('${t.id}')" title="Edit">✏️</button>
      <button class="action-btn" onclick="deleteTask('${t.id}')" title="Hapus">🗑️</button>
    </div>
  </div>`;
    }

    function renderProgress() {
      const filtered = getFilteredTasks();
      const total = filtered.length;
      const done = filtered.filter(t => t.done).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      document.getElementById('prog-label').textContent = `${done} dari ${total} selesai`;
      document.getElementById('prog-pct').textContent = `${pct}%`;
      document.getElementById('prog-fill').style.width = pct + '%';
    }

    // ─── TASK CRUD ───
    function openTaskModal(prefill = null) {
      editingTaskId = null;
      document.getElementById('modal-task-title').textContent = '➕ Tambah Tugas';
      document.getElementById('t-name').value = prefill?.name || '';
      document.getElementById('t-desc').value = '';
      document.getElementById('t-date').value = prefill?.date || '';
      document.getElementById('t-time').value = '';
      document.getElementById('t-reminder-toggle').checked = false;
      document.getElementById('t-project').value = currentProject !== '__all__' && currentProject !== '__today__' ? (currentProject || '') : '';
      document.getElementById('reminder-opts').classList.remove('visible');
      document.querySelectorAll('.reminder-chip').forEach(c => c.classList.remove('selected'));
      document.querySelector('.reminder-chip[data-val="30m"]').classList.add('selected');
      selectedReminder = '30m';
      document.getElementById('modal-task').classList.add('open');
      setTimeout(() => document.getElementById('t-name').focus(), 100);
    }

    function editTask(id) {
      const t = tasks.find(t => t.id === id);
      if (!t) return;
      editingTaskId = id;
      document.getElementById('modal-task-title').textContent = '✏️ Edit Tugas';
      document.getElementById('t-name').value = t.name;
      document.getElementById('t-desc').value = t.desc || '';
      document.getElementById('t-date').value = t.date || '';
      document.getElementById('t-time').value = t.time || '';
      document.getElementById('t-reminder-toggle').checked = !!t.reminder;
      document.getElementById('t-project').value = t.projectId || '';
      if (t.reminder) {
        document.getElementById('reminder-opts').classList.add('visible');
        document.querySelectorAll('.reminder-chip').forEach(c => {
          c.classList.toggle('selected', c.dataset.val === t.reminderVal);
        });
        selectedReminder = t.reminderVal || '30m';
      } else {
        document.getElementById('reminder-opts').classList.remove('visible');
      }
      document.getElementById('modal-task').classList.add('open');
    }

    function submitTask() {
      const name = document.getElementById('t-name').value.trim();
      if (!name) { showToast('⚠️ Nama tugas harus diisi!'); return; }

      const task = {
        id: editingTaskId || Date.now().toString(),
        name,
        desc: document.getElementById('t-desc').value.trim(),
        date: document.getElementById('t-date').value,
        time: document.getElementById('t-time').value,
        reminder: document.getElementById('t-reminder-toggle').checked,
        reminderVal: selectedReminder,
        projectId: document.getElementById('t-project').value || null,
        done: false,
        createdAt: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.createdAt : Date.now()
      };

      if (editingTaskId) {
        task.done = tasks.find(t => t.id === editingTaskId)?.done || false;
        const idx = tasks.findIndex(t => t.id === editingTaskId);
        tasks[idx] = task;
        showToast('✅ Tugas diperbarui!');
      } else {
        tasks.push(task);
        showToast('✅ Tugas ditambahkan!');
      }

      saveTasks();
      closeModal('modal-task');
      render();
      renderDashboard();
    }

    function toggleTask(id) {
      const t = tasks.find(t => t.id === id);
      if (!t) return;
      t.done = !t.done;
      saveTasks();
      render();
      if (t.done) showToast('🎉 Tugas selesai! Quack!');
      renderDashboard();
    }

    function deleteTask(id) {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      render();
      showToast('🗑️ Tugas dihapus.');
      renderDashboard();
    }

    // ─── PROJECT ───
          function openProjectModal() {
        document.getElementById('modal-project-name').value = '';
        document.getElementById('modal-project-color').value = '#EF4444';

        document.getElementById('modal-add-project').classList.add('open');

        setTimeout(() => {
          document.getElementById('modal-project-name').focus();
        }, 100);
      }

      function submitProject() {
        const name = document.getElementById('modal-project-name').value.trim();
        const color = document.getElementById('modal-project-color').value;

        if (!name) {
          showToast('⚠️ Nama proyek harus diisi!');
          return;
        }

        const proj = {
          id: Date.now().toString(),
          name,
          color
        };

        projects.push(proj);
        saveProjects();

        closeModal('modal-add-project'); // ✅ FIX

        render();
        showToast('📁 Proyek berhasil dibuat!');
      }

    function deleteProject(id) {
      if (!confirm('Hapus proyek ini? Task di dalamnya tidak akan dihapus.')) return;
      projects = projects.filter(p => p.id !== id);
      tasks.forEach(t => { if (t.projectId === id) t.projectId = null; });
      saveProjects();
      saveTasks();
      if (currentProject === id) currentProject = '__all__';
      render();
    }

    function selectProject(id) {
      currentProject = id;
      const heading = document.getElementById('page-heading');
      if (id === '__all__') heading.innerHTML = 'Semua <span>Tugas</span>';
      else if (id === '__today__') heading.innerHTML = '📅 Hari <span>Ini</span>';
      else {
        const proj = projects.find(p => p.id === id);
        heading.innerHTML = `${proj?.name || 'Proyek'} <span style="color:${proj?.color}">▸</span>`;
      }
      render();
    }

    // ─── FILTERS & VIEWS ───
    function setFilter(val, el) {
      currentFilter = val;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      render();
    }

    function setView(val, el) {
      currentView = val;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      render();
    }

    // ─── REMINDER ───
    function toggleReminder() {
      const on = document.getElementById('t-reminder-toggle').checked;
      document.getElementById('reminder-opts').classList.toggle('visible', on);
    }

    function selectReminder(el) {
      document.querySelectorAll('.reminder-chip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      selectedReminder = el.dataset.val;
    }

    function reminderLabel(val) {
      const map = { '30m': '30 menit', '1h': '1 jam', '3h': '3 jam', '1d': '1 hari', '2d': '2 hari', '1w': '1 minggu' };
      return map[val] || val;
    }

    // ─── COLOR ───
    function selectColor(el) {
      document.querySelectorAll('.color-opt').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      selectedColor = el.dataset.color;
    }

    // ─── MODAL CLOSE ───
    function closeModal(id) {
      document.getElementById(id).classList.remove('open');
    }

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    });

    // ─── INIT ───
    state.selectedDate = todayStr();
    renderDashboard();
    render();
  
// ── POMO JS ──

// ═══════════════════════════════════════
//  POMODORO STATE
// ═══════════════════════════════════════
const MODES = {
  focus: { label: 'Sesi Fokus', secs: 25 * 60, color: '#EF4444', ringColor: '#EF4444' },
  short: { label: 'Istirahat Pendek', secs: 5 * 60, color: '#3B82F6', ringColor: '#3B82F6' },
  long:  { label: 'Istirahat Panjang', secs: 15 * 60, color: '#22C55E', ringColor: '#22C55E' },
};

const TIPS = [
  'Fokus pada satu tugas dalam satu sesi Pomodoro. Jangan multitasking! 🎯',
  'Setelah 4 sesi Pomodoro, ambil istirahat panjang 15-30 menit. 😴',
  'Catat gangguan yang muncul dan tangani setelah sesi selesai. 📝',
  'Atur lingkungan kerja yang bebas gangguan sebelum mulai. 🔕',
  'Sesi Pomodoro ideal adalah 25 menit — cukup untuk fokus mendalam! ⏰',
  'Gunakan waktu istirahat untuk gerak badan, bukan scroll media sosial. 🏃',
];

let timerInterval = null;
let currentMode = 'focus';
let currentSecs = MODES.focus.secs;
let isRunning = false;
let sessionCount = 0;
let completedSessions = 0;
let totalMinutes = 0;
let selectedTaskId = null;

tasks = JSON.parse(localStorage.getItem('toduck_tasks') || '[]');
projects = JSON.parse(localStorage.getItem('toduck_projects') || '[]');
let stats = JSON.parse(localStorage.getItem('toduck_pomo_stats') || '{"sessions":0,"tasks":0,"minutes":0}');
selectedReminder = '30m';

function saveStats() { localStorage.setItem('toduck_pomo_stats', JSON.stringify(stats)); }

// ── FORMAT ──
function formatSecs(s) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}



// ── TIMER CORE ──
function setMode(mode) {
  if (isRunning) { toggleTimer(); }
  currentMode = mode;
  currentSecs = MODES[mode].secs;

  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active','break-active','long-active'));
  const tabEl = document.getElementById(`tab-${mode}`);
  if (mode === 'focus') tabEl.classList.add('active');
  else if (mode === 'short') tabEl.classList.add('break-active');
  else tabEl.classList.add('long-active');

  document.getElementById('pomo-mode-label').textContent = MODES[mode].label;
  document.getElementById('ring-fill').style.stroke = MODES[mode].ringColor;
  updateDisplay();
  updateRing();
  updateDuckMsg();
}

function updateDisplay() {
  document.getElementById('pomo-time').textContent = formatSecs(currentSecs);
}

function updateRing() {
  const total = MODES[currentMode].secs;
  const pct = currentSecs / total;
  const circ = 2 * Math.PI * 96; // r=96
  const offset = circ * (1 - pct);
  document.getElementById('ring-fill').style.strokeDasharray = circ;
  document.getElementById('ring-fill').style.strokeDashoffset = offset;
}

function toggleTimer() {
  if (isRunning) {
    clearInterval(timerInterval);
    isRunning = false;
    document.getElementById('btn-play').textContent = '▶';
    setDuckMsg('Timer dijeda. Lanjutkan saat siap! 🐥');
  } else {
    isRunning = true;
    document.getElementById('btn-play').textContent = '⏸';
    setDuckMsg(selectedTaskId
      ? `Fokus mengerjakan "${tasks.find(t=>t.id===selectedTaskId)?.name || '...'}". Semangat! 💪`
      : 'Fokus! Jangan terganggu dulu ya~ 🎯');
    timerInterval = setInterval(() => {
      if (currentSecs > 0) {
        currentSecs--;
        updateDisplay();
        updateRing();
        if (currentMode === 'focus') totalMinutes = Math.floor((MODES.focus.secs - currentSecs) / 60);
      } else {
        clearInterval(timerInterval);
        isRunning = false;
        document.getElementById('btn-play').textContent = '▶';
        onTimerEnd();
      }
    }, 1000);
  }
}

function onTimerEnd() {
  if (currentMode === 'focus') {
    completedSessions++;
    stats.sessions++;
    stats.minutes += 25;
    saveStats();
    updateStats();
    updateSessionDots();
    showToast('🎉 Sesi fokus selesai! Saatnya istirahat!');
    setDuckMsg('Kerja keras! Waktunya istirahat sebentar~ ☕');
    // Auto go to break
    setTimeout(() => openBreakOverlay(), 500);
  } else {
    showToast('⏰ Istirahat selesai! Saatnya fokus lagi!');
    setMode('focus');
  }
}

function skipBack() {
  clearInterval(timerInterval);
  isRunning = false;
  document.getElementById('btn-play').textContent = '▶';
  currentSecs = MODES[currentMode].secs;
  updateDisplay();
  updateRing();
}

function skipForward() {
  clearInterval(timerInterval);
  isRunning = false;
  document.getElementById('btn-play').textContent = '▶';
  currentSecs = 0;
  updateDisplay();
  updateRing();
  onTimerEnd();
}

function updateSessionDots() {
  const dots = document.getElementById('session-dots').children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = 'session-dot';
    if (i < completedSessions % 4) dots[i].classList.add('done');
    else if (i === completedSessions % 4) dots[i].classList.add('current');
  }
}

function updateStats() {
  document.getElementById('stat-sessions').textContent = stats.sessions;
  document.getElementById('stat-tasks').textContent = stats.tasks;
  document.getElementById('stat-minutes').textContent = stats.minutes;
}

// ── DUCK MESSAGES ──
function setDuckMsg(msg) {
  document.getElementById('duck-msg').textContent = msg;
}

function updateDuckMsg() {
  const msgs = {
    focus: 'Pilih tugas yang mau dikerjakan, terus fokus! 🎯',
    short: 'Istirahat sebentar, minum air ya! ☕',
    long: 'Istirahat panjang — gerakin badan dulu! 🏃',
  };
  setDuckMsg(msgs[currentMode]);
}

// ── TASK LIST ──
function renderTaskList() {
  const container = document.getElementById('pomo-task-list');
  const activeTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  let html = '';

  if (activeTasks.length === 0 && doneTasks.length === 0) {
    html = `<div style="color:#A3A3A3;font-size:13px;font-weight:700;padding:10px 0;text-align:center;">Belum ada tugas. Yuk tambah!</div>`;
  }

  activeTasks.forEach(t => {
    const isSelected = selectedTaskId === t.id;
    html += `
    <div class="pomo-task-item ${isSelected ? 'selected-task' : ''}" onclick="selectTask('${t.id}')">
      <div class="pomo-task-dot" style="${isSelected ? 'background:#EF4444;' : ''}"></div>
      <span class="pomo-task-name">${t.name}</span>
      ${t.date ? `<span style="font-size:11px;color:#A3A3A3;font-weight:700;">${t.date}</span>` : ''}
      <div class="pomo-task-check" onclick="event.stopPropagation();doneTask('${t.id}')"></div>
    </div>`;
  });

  if (doneTasks.length > 0) {
    html += `<div style="font-size:11px;font-weight:900;color:#A3A3A3;text-transform:uppercase;letter-spacing:1px;margin:12px 0 8px;">✅ Selesai (${doneTasks.length})</div>`;
    doneTasks.forEach(t => {
      html += `
      <div class="pomo-task-item" style="opacity:.55;">
        <div class="pomo-task-dot" style="background:#22C55E;"></div>
        <span class="pomo-task-name done-task">${t.name}</span>
        <div class="pomo-task-check checked" onclick="event.stopPropagation();undoneTask('${t.id}')"></div>
      </div>`;
    });
  }

  container.innerHTML = html;
}

function selectTask(id) {
  selectedTaskId = id;
  const t = tasks.find(t => t.id === id);
  if (t) setDuckMsg(`Mengerjakan: "${t.name}" 💪`);
  renderTaskList();
}

function doneTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = true;
  if (selectedTaskId === id) selectedTaskId = null;
  stats.tasks++;
  saveStats();
  saveTasks();
  updateStats();
  renderTaskList();
  showToast('🎉 Tugas selesai! Quack!');
  setDuckMsg('Mantap! Tugas selesai! 🎉');
}

function undoneTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = false;
  saveTasks();
  renderTaskList();
}

// ── ADD TASK MODAL ──
function openAddTaskModal() {
  document.getElementById('t-name').value = '';
  document.getElementById('t-desc').value = '';
  document.getElementById('t-date').value = '';
  document.getElementById('t-time').value = '';
  const sel = document.getElementById('t-project');
  sel.innerHTML = `<option value="">Tidak ada proyek</option>` + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('modal-task').classList.add('open');
  setTimeout(() => document.getElementById('t-name').focus(), 100);
}

function closeAddTaskModal() {
  document.getElementById('modal-task').classList.remove('open');
}

function toggleReminder() {
  const opts = document.getElementById('reminder-opts');
  opts.style.display = document.getElementById('t-reminder-toggle').checked ? 'block' : 'none';
}

function selectReminder(el) {
  document.querySelectorAll('.reminder-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedReminder = el.getAttribute('data-val');
}

function submitNewTask() {
  const name = document.getElementById('t-name').value.trim();
  if (!name) { showToast('⚠️ Nama tugas harus diisi!'); return; }
  const task = {
    id: Date.now().toString(),
    name,
    desc: document.getElementById('t-desc').value.trim(),
    date: document.getElementById('t-date').value,
    time: document.getElementById('t-time').value,
    reminder: document.getElementById('t-reminder-toggle').checked,
    reminderVal: selectedReminder,
    projectId: document.getElementById('t-project').value || null,
    done: false,
    createdAt: Date.now()
  };
  tasks.push(task);
  saveTasks();
  closeAddTaskModal();
  renderTaskList();
  showToast('✅ Tugas ditambahkan!');
}

// ═══════════════════════════════════════
//  BREAK OVERLAY
// ═══════════════════════════════════════
let breakInterval = null;
let breakSecs = 5 * 60;
let activeGame = null;

function openBreakOverlay() {
  breakSecs = currentMode === 'long' ? 15 * 60 : 5 * 60;
  document.getElementById('break-timer').textContent = formatSecs(breakSecs);
  document.getElementById('break-overlay').classList.add('open');
  document.getElementById('game-selection-area').style.display = 'block';
  document.querySelectorAll('.game-area').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.game-card').forEach(c => c.classList.remove('game-active'));
  activeGame = null;

  breakInterval = setInterval(() => {
    if (breakSecs > 0) {
      breakSecs--;
      document.getElementById('break-timer').textContent = formatSecs(breakSecs);
    } else {
      endBreak();
    }
  }, 1000);
}

function endBreak() {
  clearInterval(breakInterval);
  stopAllGames();
  document.getElementById('break-overlay').classList.remove('open');
  setMode('focus');
  showToast('⏰ Istirahat selesai! Fokus lagi!');
}

function selectGame(game) {
  document.querySelectorAll('.game-card').forEach(c => c.classList.remove('game-active'));
  document.getElementById(`game-card-${game}`).classList.add('game-active');
  document.querySelectorAll('.game-area').forEach(a => a.classList.remove('active'));
  document.getElementById(`game-${game}`).classList.add('active');
  activeGame = game;

  if (game === 'memory') initMemory();
  else if (game === 'catch') initCatch();
  else if (game === 'scramble') initScramble();
}

function stopAllGames() {
  if (catchInterval) clearInterval(catchInterval);
  catchInterval = null;
}

// ═══════════════════════════════════════
//  GAME 1: MEMORY MATCH
// ═══════════════════════════════════════
const MEMORY_EMOJIS = ['🐥','🦆','🐣','🐤','🦉','🦜','🐦','🦚'];
let memCards = [];
let memFlipped = [];
let memMatched = 0;
let memLocked = false;

function initMemory() {
  const pairs = [...MEMORY_EMOJIS, ...MEMORY_EMOJIS];
  pairs.sort(() => Math.random() - .5);
  memMatched = 0;
  memFlipped = [];
  memLocked = false;
  document.getElementById('mem-score').textContent = '0 pasang';
  memCards = pairs;

  const grid = document.getElementById('memory-grid');
  grid.innerHTML = pairs.map((emoji, i) => `
    <div class="mem-card" id="mc-${i}" onclick="flipMemCard(${i})" style="position:relative;height:70px;">
      <div class="mem-back" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#3B82F6;">🐥</div>
      <div class="mem-front" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#DBEAFE;transform:rotateY(180deg);backface-visibility:hidden;">${emoji}</div>
    </div>
  `).join('');

  // Apply 3d style to each card
  document.querySelectorAll('.mem-card').forEach(c => {
    c.style.transformStyle = 'preserve-3d';
    c.style.transition = 'transform .4s';
  });
}

function flipMemCard(idx) {
  if (memLocked) return;
  if (memFlipped.includes(idx)) return;
  const card = document.getElementById(`mc-${idx}`);
  card.style.transform = 'rotateY(180deg)';
  memFlipped.push(idx);

  if (memFlipped.length === 2) {
    memLocked = true;
    const [a, b] = memFlipped;
    if (memCards[a] === memCards[b]) {
      memMatched++;
      document.getElementById('mem-score').textContent = `${memMatched} pasang`;
      document.getElementById(`mc-${a}`).querySelector('.mem-front').style.background = '#DCFCE7';
      document.getElementById(`mc-${b}`).querySelector('.mem-front').style.background = '#DCFCE7';
      memFlipped = [];
      memLocked = false;
      if (memMatched === 8) showToast('🎉 Memory Match selesai! Luar biasa!');
    } else {
      setTimeout(() => {
        document.getElementById(`mc-${a}`).style.transform = '';
        document.getElementById(`mc-${b}`).style.transform = '';
        memFlipped = [];
        memLocked = false;
      }, 900);
    }
  }
}

// ═══════════════════════════════════════
//  GAME 2: CATCH DUCK
// ═══════════════════════════════════════
let catchScore = 0;
let catchInterval = null;
let catchDucks = [];

function initCatch() {
  catchScore = 0;
  catchDucks = [];
  document.getElementById('catch-score').textContent = 'Score: 0';
  const area = document.getElementById('catch-area');
  area.innerHTML = '';
  if (catchInterval) clearInterval(catchInterval);

  spawnDuck();
  catchInterval = setInterval(() => {
    if (activeGame === 'catch') spawnDuck();
  }, 1200);
}

function spawnDuck() {
  const area = document.getElementById('catch-area');
  const duck = document.createElement('div');
  duck.className = 'catch-duck';
  duck.textContent = Math.random() > .2 ? '🦆' : '🐥';
  duck.style.left = Math.random() * (area.offsetWidth - 50) + 'px';
  duck.style.top = Math.random() * (area.offsetHeight - 50) + 'px';
  duck.style.fontSize = (28 + Math.random() * 20) + 'px';
  duck.addEventListener('click', () => {
    catchScore += duck.textContent === '🐥' ? 3 : 1;
    document.getElementById('catch-score').textContent = `Score: ${catchScore}`;
    duck.style.transform = 'scale(0)';
    duck.style.transition = 'transform .15s';
    setTimeout(() => duck.remove(), 150);
  });
  area.appendChild(duck);
  setTimeout(() => {
    if (duck.parentNode) duck.remove();
  }, 2500);
}

// ═══════════════════════════════════════
//  GAME 3: WORD SCRAMBLE
// ═══════════════════════════════════════
const SCRAMBLE_WORDS = [
  { word: 'BEBEK', hint: 'Hewan air yang quack' },
  { word: 'FOKUS', hint: 'Konsentrasi penuh' },
  { word: 'BELAJAR', hint: 'Proses mendapat ilmu' },
  { word: 'SEMANGAT', hint: 'Motivasi untuk terus maju' },
  { word: 'PRODUKTIF', hint: 'Menghasilkan banyak hal' },
  { word: 'ISTIRAHAT', hint: 'Rehat sejenak dari kerja' },
  { word: 'TUGAS', hint: 'Pekerjaan yang harus diselesaikan' },
  { word: 'JADWAL', hint: 'Rencana waktu kegiatan' },
  { word: 'SUKSES', hint: 'Berhasil mencapai tujuan' },
  { word: 'QUACK', hint: 'Suara bebek! 🦆' },
];

let scrambleScore = 0;
let currentWord = null;
let scrambleUsed = [];

function initScramble() {
  scrambleScore = 0;
  scrambleUsed = [];
  document.getElementById('scramble-score').textContent = '0 benar';
  nextScramble();
}

function scrambleStr(str) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Make sure it's actually scrambled
  const res = arr.join('');
  return res === str ? scrambleStr(str) : res;
}

function nextScramble() {
  const available = SCRAMBLE_WORDS.filter((_, i) => !scrambleUsed.includes(i));
  if (available.length === 0) {
    scrambleUsed = [];
    nextScramble();
    return;
  }
  const idx = Math.floor(Math.random() * available.length);
  const globalIdx = SCRAMBLE_WORDS.indexOf(available[idx]);
  scrambleUsed.push(globalIdx);
  currentWord = available[idx];
  document.getElementById('scramble-display').textContent = scrambleStr(currentWord.word);
  document.getElementById('scramble-hint').textContent = `Hint: ${currentWord.hint}`;
  document.getElementById('scramble-input').value = '';
  document.getElementById('scramble-result').textContent = '';
  document.getElementById('scramble-result').className = 'scramble-result';
}

function checkScramble() {
  const input = document.getElementById('scramble-input').value.trim().toUpperCase();
  const result = document.getElementById('scramble-result');
  if (!input) return;
  if (input === currentWord.word) {
    scrambleScore++;
    document.getElementById('scramble-score').textContent = `${scrambleScore} benar`;
    result.textContent = '✅ Benar! Keren!';
    result.className = 'scramble-result correct';
    setTimeout(() => nextScramble(), 1200);
  } else {
    result.textContent = '❌ Kurang tepat, coba lagi!';
    result.className = 'scramble-result wrong';
  }
}

document.getElementById('scramble-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkScramble();
});

// ═══════════════════════════════════════
//  TIPS
// ═══════════════════════════════════════
function showRandomTip() {
  document.getElementById('pomo-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
}


// ── INIT ──

document.getElementById('new-task-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitNewTask();
});

document.getElementById('modal-add-task').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-add-task')) closeAddTaskModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAddTaskModal();
  }
  if (e.key === ' ' && !['INPUT','TEXTAREA'].includes(e.target.tagName) && state.currentPage === 'pomodoro') {
    e.preventDefault();
    toggleTimer();
  }
});

updateDisplay();
updateRing();
updateStats();
renderTaskList();
showRandomTip();
setInterval(showRandomTip, 30000);

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

updateSidebarUser();
renderDashboard();
