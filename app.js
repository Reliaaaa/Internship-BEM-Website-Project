const $ = (selector) => document.querySelector(selector);
const projectList = $('#project-list');
const board = $('#board');
const stats = $('#stats');
const projectForm = $('#project-form');
const taskForm = $('#task-form');
const projectDialog = $('#project-dialog');
const taskDialog = $('#task-dialog');
const search = $('#search');
const statusFilter = $('#status-filter');
const themeToggle = $('#theme-toggle');
const toast = $('#toast');
const currentProject = $('#current-project');
const profileDialog = $('#profile-dialog');
const islandToggle = $('.island-toggle');
const islandMenu = $('#island-menu');
const statuses = ['To-do', 'In-Progress', 'Done'];
// Lucide icons, ISC licensed; see assets/lucide/LICENSE.
const statIcons = [
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  '<path d="M10.1 2.182a10 10 0 0 1 3.8 0M13.9 21.818a10 10 0 0 1-3.8 0M17.609 3.721a10 10 0 0 1 2.69 2.7M2.182 13.9a10 10 0 0 1 0-3.8M20.279 17.609a10 10 0 0 1-2.7 2.69M21.818 10.1a10 10 0 0 1 0 3.8M3.721 6.391a10 10 0 0 1 2.7-2.69M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
  '<circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>',
  '<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>'
];
let selectedProject = null;
let editingProject = null;
let editingTask = null;
let toastTimer;
let projectAnimation;
let projectTransition = 0;

function setIsland(open) {
  islandMenu.inert = !open;
  islandMenu.setAttribute('aria-hidden', String(!open));
  islandToggle.setAttribute('aria-expanded', String(open));
  islandToggle.setAttribute('aria-label', open ? 'Tutup navigasi cepat' : 'Buka navigasi cepat');
}
islandToggle.addEventListener('click', () => setIsland(islandToggle.getAttribute('aria-expanded') !== 'true'));
$('.island').addEventListener('focusout', (event) => {
  if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setIsland(false);
});
profileDialog.addEventListener('close', () => {
  if (!document.body.classList.contains('auth-locked')) islandToggle.focus({ preventScroll: true });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && islandToggle.getAttribute('aria-expanded') === 'true') { setIsland(false); islandToggle.focus(); }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.island') && islandToggle.getAttribute('aria-expanded') === 'true') setIsland(false);
});
function navigateTo(element) {
  setIsland(false);
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
function cancelProjectTransition() {
  projectTransition += 1;
  projectAnimation?.cancel();
  projectAnimation = undefined;
}
async function selectProject(id) {
  if (id === selectedProject && !projectAnimation) return;
  cancelProjectTransition();
  const token = projectTransition;
  const panel = $('.tasks');
  const restoreFocus = document.activeElement?.dataset.action === 'select-project';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && panel.animate) {
    projectAnimation = panel.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0.2, transform: 'translateY(6px)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
    try { await projectAnimation.finished; } catch { return; }
    if (token !== projectTransition) return;
  }
  selectedProject = id;
  render();
  if (restoreFocus) [...projectList.querySelectorAll('[data-action="select-project"]')].find((button) => (button.dataset.id || null) === id)?.focus({ preventScroll: true });
  projectAnimation?.cancel();
  projectAnimation = undefined;
  if (!reduced && panel.animate) {
    const animation = panel.animate([{ opacity: 0.2, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
    projectAnimation = animation;
    animation.finished.then(() => { if (projectAnimation === animation) projectAnimation = undefined; }).catch(() => {});
  }
}

function load(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
let activeUser = null;
let projects = [];
let tasks = [];

function notify(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}
function save() {
  try {
    if (!activeUser) throw new Error('Sesi tidak tersedia');
    localStorage.setItem(`tf_workspace_${activeUser.id}`, JSON.stringify({ projects, tasks }));
    return true;
  } catch {
    notify('Penyimpanan tidak tersedia. Perubahan mungkin tidak tersimpan.');
    return false;
  }
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function action(label, name, id, className = '') {
  const button = make('button', className, label);
  button.type = 'button';
  button.dataset.action = name;
  if (id) button.dataset.id = id;
  return button;
}
function formValue(form, name) { return form.elements.namedItem(name).value.trim(); }
function setValue(form, name, value) { form.elements.namedItem(name).value = value || ''; }
function dateLabel(value) {
  if (!value) return 'Tanpa tenggat';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
function renderStats() {
  stats.replaceChildren();
  const entries = [['Total proyek', projects.length], ...statuses.map((status) => [status, tasks.filter((task) => task.status === status).length])];
  for (const [index, [label, count]] of entries.entries()) {
    const card = make('div', 'stat-card');
    card.dataset.stat = ['projects', 'todo', 'progress', 'done'][index];
    const icon = make('span', 'stat-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${statIcons[index]}</svg>`;
    card.append(make('span', 'stat-label', label), make('strong', 'stat-value', String(count)), icon);
    stats.append(card);
  }
}
function renderProjects() {
  projectList.replaceChildren();
  const all = action('Semua proyek', 'select-project', '', 'project-button');
  all.setAttribute('aria-pressed', String(selectedProject === null));
  projectList.append(all);
  for (const project of projects) {
    const item = make('div', 'project-item');
    const select = action(project.name, 'select-project', project.id, 'project-button');
    select.setAttribute('aria-pressed', String(selectedProject === project.id));
    const count = tasks.filter((task) => task.projectId === project.id);
    const meta = make('span', 'project-meta', `${project.status || 'Aktif'} · ${count.filter((task) => task.status === 'Done').length}/${count.length} selesai`);
    const completed = count.filter((task) => task.status === 'Done').length;
    const progress = document.createElement('progress');
    progress.className = 'project-progress';
    progress.max = 100;
    progress.value = count.length ? Math.round(completed / count.length * 100) : 0;
    progress.setAttribute('aria-label', `Progres ${project.name}: ${progress.value}%`);
    const buttons = make('div', 'project-actions');
    const edit = action('Ubah', 'edit-project', project.id);
    const remove = action('Hapus', 'delete-project', project.id);
    edit.setAttribute('aria-label', `Ubah proyek ${project.name}`);
    remove.setAttribute('aria-label', `Hapus proyek ${project.name}`);
    buttons.append(edit, remove);
    item.append(select, meta, buttons, progress);
    projectList.append(item);
  }
  if (!projects.length) {
    const empty = make('div', 'empty-state');
    empty.append(make('strong', '', 'Mulai proyek pertama'), make('p', '', 'Buat proyek untuk mengelompokkan tugasmu.'), action('Tambah proyek', 'add-project', '', 'empty-action'));
    projectList.append(empty);
  }
  const current = projects.find((p) => p.id === selectedProject);
  currentProject.textContent = current ? `Tugas · ${current.name}` : 'Semua tugas';
  const overview = $('#project-overview');
  const grid = $('#project-grid');
  overview.hidden = Boolean(selectedProject);
  grid.replaceChildren();
  if (!projects.length) {
    const empty = make('div', 'empty-state overview-empty');
    empty.append(make('strong', '', 'Belum ada proyek'), make('p', '', 'Buat proyek pertama untuk mulai mengatur tugas.'), action('Tambah proyek', 'add-project', '', 'empty-action'));
    grid.append(empty);
  }
  for (const project of projects) {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const completed = projectTasks.filter((task) => task.status === 'Done').length;
    const percentage = projectTasks.length ? Math.round(completed / projectTasks.length * 100) : 0;
    const card = action('', 'select-project', project.id, 'overview-card');
    const heading = make('div', 'overview-card-heading');
    heading.append(make('strong', 'overview-name', project.name), make('span', 'overview-status', project.status || 'Aktif'));
    const description = make('p', 'overview-description', project.description || 'Belum ada deskripsi proyek.');
    const meta = make('div', 'overview-meta');
    meta.append(make('span', '', `${completed}/${projectTasks.length} tugas selesai`), make('span', '', `${percentage}%`));
    const progress = document.createElement('progress');
    progress.className = 'overview-progress'; progress.max = 100; progress.value = percentage;
    progress.setAttribute('aria-label', `Progres ${project.name}: ${percentage}%`);
    card.append(heading, description, meta, progress, make('span', 'overview-date', dateLabel(project.deadline)));
    grid.append(card);
  }
}
function renderBoard() {
  const query = search.value.trim().toLocaleLowerCase('id');
  const visible = tasks.filter((task) => (!selectedProject || task.projectId === selectedProject) && (statusFilter.value === 'ALL' || !statusFilter.value || task.status === statusFilter.value) && `${task.title} ${task.description || ''}`.toLocaleLowerCase('id').includes(query));
  board.replaceChildren();
  for (const [index, status] of statuses.entries()) {
    const column = make('section', 'kanban-column');
    column.dataset.status = ['todo', 'progress', 'done'][index];
    const matching = visible.filter((task) => task.status === status);
    const header = make('div', 'kanban-header');
    header.append(make('h3', '', status), make('span', 'count-badge', String(matching.length)));
    column.append(header);
    if (!matching.length) column.append(make('p', 'empty-state', query || statusFilter.value !== 'ALL' ? 'Tidak ada tugas yang cocok.' : 'Belum ada tugas di tahap ini.'));
    for (const task of matching) {
      const card = make('article', 'task-card');
      card.append(make('h4', '', task.title));
      if (task.description) card.append(make('p', 'task-description', task.description));
      const project = projects.find((p) => p.id === task.projectId);
      card.append(make('p', 'task-meta', `${project?.name || 'Proyek'} · ${dateLabel(task.deadline)}`));
      if (task.attachmentId) card.append(action(`Unduh: ${task.attachmentName}`, 'download-attachment', task.id, 'attachment-link'));
      const controls = make('div', 'task-actions');
      const move = make('div', 'task-status-options');
      move.setAttribute('role', 'group');
      move.setAttribute('aria-label', `Status tugas ${task.title}`);
      for (const optionStatus of statuses) {
        const option = action(optionStatus, 'move-task', task.id, 'task-status-option');
        option.dataset.status = optionStatus;
        option.setAttribute('aria-pressed', String(optionStatus === task.status));
        move.append(option);
      }
      const edit = action('Ubah', 'edit-task', task.id);
      const remove = action('Hapus', 'delete-task', task.id);
      edit.setAttribute('aria-label', `Ubah tugas ${task.title}`);
      remove.setAttribute('aria-label', `Hapus tugas ${task.title}`);
      controls.append(edit, remove);
      card.append(move, controls);
      column.append(card);
    }
    board.append(column);
  }
}
function renderUrgent() {
  const section = $('#urgent-section');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 3);
  const urgent = tasks.filter((task) => task.status !== 'Done' && task.deadline && new Date(`${task.deadline}T00:00:00`) <= limit).sort((a, b) => a.deadline.localeCompare(b.deadline));
  section.replaceChildren();
  section.hidden = !urgent.length;
  if (urgent.length) {
    section.append(make('strong', '', `${urgent.length} tugas mendekati atau melewati tenggat`));
    const list = make('ul');
    for (const task of urgent) list.append(make('li', '', `${task.title} — ${dateLabel(task.deadline)}`));
    section.append(list);
  }
}
function render() { renderStats(); renderProjects(); renderBoard(); renderUrgent(); }

function openProject(project = null) {
  editingProject = project?.id || null;
  projectForm.reset();
  projectForm.querySelector('h2').textContent = project ? 'Ubah proyek' : 'Proyek baru';
  if (project) for (const key of ['name', 'description', 'deadline', 'status']) setValue(projectForm, key, project[key]);
  projectDialog.showModal();
}
function openTask(task = null) {
  if (!projects.length) { notify('Tambahkan proyek sebelum membuat tugas.'); return; }
  editingTask = task?.id || null;
  taskForm.reset();
  taskForm.querySelector('h2').textContent = task ? 'Ubah tugas' : 'Tugas baru';
  $('#attachment-info').textContent = task?.attachmentName ? `Lampiran saat ini: ${task.attachmentName}. Pilih berkas baru untuk mengganti.` : 'Opsional. Berkas disimpan di browser ini.';
  const projectSelect = taskForm.elements.namedItem('projectId');
  projectSelect.replaceChildren();
  for (const project of projects) {
    const option = make('option', '', project.name);
    option.value = project.id;
    projectSelect.append(option);
  }
  projectSelect.value = task?.projectId || selectedProject || projects[0].id;
  if (task) for (const key of ['title', 'description', 'deadline', 'status']) setValue(taskForm, key, task[key]);
  taskDialog.showModal();
}
projectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = formValue(projectForm, 'name');
  if (!name) { notify('Nama proyek wajib diisi.'); return; }
  const values = { name, description: formValue(projectForm, 'description'), deadline: formValue(projectForm, 'deadline'), status: formValue(projectForm, 'status') };
  const previous = projects;
  const previousSelection = selectedProject;
  if (editingProject) projects = projects.map((project) => project.id === editingProject ? { ...project, ...values } : project);
  else { const project = { id: crypto.randomUUID(), ...values }; projects = [...projects, project]; selectedProject = project.id; }
  if (!save()) { projects = previous; selectedProject = previousSelection; return; }
  render(); projectDialog.close();
  notify(editingProject ? 'Proyek diperbarui.' : 'Proyek ditambahkan.');
});
taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = formValue(taskForm, 'title');
  const status = formValue(taskForm, 'status');
  if (!title || !statuses.includes(status)) { notify('Isi judul dan pilih status tugas.'); return; }
  const projectId = formValue(taskForm, 'projectId');
  if (!projects.some((project) => project.id === projectId)) { notify('Pilih proyek yang tersedia.'); return; }
  const values = { projectId, title, description: formValue(taskForm, 'description'), deadline: formValue(taskForm, 'deadline'), status };
  const file = taskForm.elements.namedItem('attachment').files[0];
  const previous = tasks.slice();
  const userAtSubmit = activeUser?.id;
  const oldTask = tasks.find((task) => task.id === editingTask);
  const submit = taskForm.querySelector('[type="submit"]');
  submit.disabled = true;
  let uploaded;
  try {
    if (file) uploaded = await TaskFlowAttachments.save(file);
    if (activeUser?.id !== userAtSubmit) { if (uploaded) await TaskFlowAttachments.removeMany([uploaded.id]); return; }
    const attachment = uploaded ? { attachmentId: uploaded.id, attachmentName: uploaded.name } : {};
    if (oldTask) tasks = tasks.map((task) => task.id === editingTask ? { ...task, ...values, ...attachment } : task);
    else tasks = [...tasks, { id: crypto.randomUUID(), ...values, ...attachment }];
    if (!save()) { tasks = previous; if (uploaded) await TaskFlowAttachments.removeMany([uploaded.id]); return; }
    render(); taskDialog.close();
    notify(editingTask ? 'Tugas diperbarui.' : 'Tugas ditambahkan.');
    if (uploaded && oldTask?.attachmentId) await TaskFlowAttachments.removeMany([oldTask.attachmentId]);
  } catch (error) { notify(error.message || 'Lampiran tidak dapat disimpan.'); }
  finally { submit.disabled = false; }
});
document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || target.tagName === 'SELECT') return;
  const id = target.dataset.id;
  switch (target.dataset.action) {
    case 'add-project': openProject(); break;
    case 'add-task': openTask(); break;
    case 'import-legacy': {
      if (projects.length || tasks.length || !confirm('Salin proyek dan tugas lama ke akun ini? Data lama tetap disimpan.')) break;
      const oldProjects = load('tf_projects');
      const ids = new Set(oldProjects.map((project) => project.id));
      projects = oldProjects;
      tasks = load('tf_tasks').filter((task) => ids.has(task.projectId));
      if (!save()) { projects = []; tasks = []; break; }
      $('#legacy-import').hidden = true;
      render(); notify('Data lama disalin ke akun ini.');
      break;
    }
    case 'close-dialog': target.closest('dialog')?.close(); break;
    case 'logout': if (!TaskFlowAuth.logout()) notify('Tidak dapat keluar. Periksa penyimpanan browser.'); break;
    case 'select-project': await selectProject(id || null); break;
    case 'navigate-projects': cancelProjectTransition(); selectedProject = null; render(); navigateTo($('#overview-heading')); break;
    case 'navigate-tasks': navigateTo(currentProject); break;
    case 'navigate-profile':
      if (activeUser) { $('#profile-name').textContent = activeUser.name; $('#profile-email').textContent = activeUser.email; setIsland(false); profileDialog.showModal(); }
      break;
    case 'move-task': {
      const task = tasks.find((item) => item.id === id);
      const status = target.dataset.status;
      if (!task || !statuses.includes(status) || task.status === status) break;
      const previous = task.status;
      task.status = status;
      if (!save()) { task.status = previous; break; }
      render();
      const selected = [...board.querySelectorAll('[data-action="move-task"]')].find((button) => button.dataset.id === id && button.dataset.status === status);
      selected?.focus({ preventScroll: true });
      notify(`Status tugas diubah ke ${status}.`);
      break;
    }
    case 'edit-project': { const project = projects.find((p) => p.id === id); if (project) openProject(project); break; }
    case 'edit-task': { const task = tasks.find((t) => t.id === id); if (task) openTask(task); break; }
    case 'download-attachment': {
      const task = tasks.find((item) => item.id === id);
      try {
        const attachment = task?.attachmentId && await TaskFlowAttachments.get(task.attachmentId);
        if (!attachment) throw new Error('Lampiran tidak ditemukan.');
        const url = URL.createObjectURL(attachment.blob);
        const link = document.createElement('a'); link.href = url; link.download = attachment.name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { notify(error.message || 'Lampiran tidak dapat diunduh.'); }
      break;
    }
    case 'delete-project':
      if (confirm('Hapus proyek dan semua tugas di dalamnya?')) { const oldProjects = projects; const oldTasks = tasks; const removed = tasks.filter((task) => task.projectId === id); projects = projects.filter((p) => p.id !== id); tasks = tasks.filter((t) => t.projectId !== id); if (!save()) { projects = oldProjects; tasks = oldTasks; break; } if (selectedProject === id) selectedProject = null; render(); try { await TaskFlowAttachments.removeMany(removed.map((task) => task.attachmentId)); notify('Proyek dihapus.'); } catch { notify('Proyek dihapus, tetapi lampiran belum dapat dibersihkan.'); } }
      break;
    case 'delete-task':
      if (confirm('Hapus tugas ini?')) { const oldTasks = tasks; const removed = tasks.find((task) => task.id === id); tasks = tasks.filter((t) => t.id !== id); if (!save()) { tasks = oldTasks; break; } render(); try { await TaskFlowAttachments.removeMany([removed?.attachmentId]); notify('Tugas dihapus.'); } catch { notify('Tugas dihapus, tetapi lampiran belum dapat dibersihkan.'); } }
      break;
  }
});
search.addEventListener('input', renderBoard);
statusFilter.addEventListener('change', renderBoard);
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
  themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
}
let savedTheme = 'light';
try { savedTheme = localStorage.getItem('tf_theme') === 'dark' ? 'dark' : 'light'; } catch { /* Use light mode when storage is unavailable. */ }
setTheme(savedTheme);
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try { localStorage.setItem('tf_theme', theme); } catch { notify('Preferensi tema tidak dapat disimpan.'); }
});
TaskFlowAuth.start((user) => {
  cancelProjectTransition();
  if (projectDialog.open) projectDialog.close();
  if (taskDialog.open) taskDialog.close();
  if (profileDialog.open) profileDialog.close();
  setIsland(false);
  activeUser = user;
  selectedProject = null;
  projects = []; tasks = [];
  if (user) {
    try {
      const data = JSON.parse(localStorage.getItem(`tf_workspace_${user.id}`) || '{}');
      projects = Array.isArray(data.projects) ? data.projects : [];
      tasks = Array.isArray(data.tasks) ? data.tasks : [];
    } catch { notify('Data tidak dapat dibaca.'); }
  }
  $('#legacy-import').hidden = !user || projects.length > 0 || tasks.length > 0 || !load('tf_projects').length;
  render();
});
