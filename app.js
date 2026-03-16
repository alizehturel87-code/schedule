const CATEGORY_META = [
  {
    id: "ultra_12",
    label: "Ultra important to be completed in next 12 hrs",
    shortLabel: "Next 12 hrs",
    accent: "#d94b3d",
    subtitle: "Critical work that should stay visible until it is done.",
  },
  {
    id: "important_24",
    label: "Important to be done in next 24 hrs",
    shortLabel: "Next 24 hrs",
    accent: "#eb8f2f",
    subtitle: "Core commitments that matter today and tomorrow.",
  },
  {
    id: "weekend",
    label: "Weekend Tasks",
    shortLabel: "Weekend",
    accent: "#2d8f84",
    subtitle: "Things grouped for the next slower planning window.",
  },
  {
    id: "leisure",
    label: "Do it at your leisure",
    shortLabel: "Leisure",
    accent: "#6674d9",
    subtitle: "Low-pressure tasks you can place when energy allows.",
  },
];

const SETTINGS_KEY = "orbit_tasks_settings_v1";
const REMINDER_LOG_KEY = "orbit_tasks_reminders_v1";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const API_ENDPOINT = "/.netlify/functions/tasks";

const state = {
  tasks: [],
  profileName: "Operator",
  selectedView: "board",
  selectedDateKey: dateKey(new Date()),
  calendarCursor: startOfMonth(new Date()),
  lastSyncLabel: "Not synced yet",
};

const reminderTimers = new Map();

const elements = {
  profileNameInput: document.getElementById("profileNameInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  syncBtn: document.getElementById("syncBtn"),
  connectionStatus: document.getElementById("connectionStatus"),
  connectionDot: document.getElementById("connectionDot"),
  notificationStatus: document.getElementById("notificationStatus"),
  notifyBtn: document.getElementById("notifyBtn"),
  heroDate: document.getElementById("heroDate"),
  heroTitle: document.getElementById("heroTitle"),
  metricsGrid: document.getElementById("metricsGrid"),
  formTitle: document.getElementById("formTitle"),
  taskForm: document.getElementById("taskForm"),
  taskIdInput: document.getElementById("taskIdInput"),
  taskTitleInput: document.getElementById("taskTitleInput"),
  taskCategoryInput: document.getElementById("taskCategoryInput"),
  taskDueInput: document.getElementById("taskDueInput"),
  taskReminderInput: document.getElementById("taskReminderInput"),
  taskNotesInput: document.getElementById("taskNotesInput"),
  clearFormBtn: document.getElementById("clearFormBtn"),
  boardToggle: document.getElementById("boardToggle"),
  calendarToggle: document.getElementById("calendarToggle"),
  boardView: document.getElementById("boardView"),
  calendarView: document.getElementById("calendarView"),
  calendarMonthLabel: document.getElementById("calendarMonthLabel"),
  prevMonthBtn: document.getElementById("prevMonthBtn"),
  nextMonthBtn: document.getElementById("nextMonthBtn"),
  todayBtn: document.getElementById("todayBtn"),
  calendarGrid: document.getElementById("calendarGrid"),
  agendaTitle: document.getElementById("agendaTitle"),
  agendaList: document.getElementById("agendaList"),
  metricCardTemplate: document.getElementById("metricCardTemplate"),
};

init();

function init() {
  hydrateSettings();
  buildCategoryOptions();
  bindEvents();
  updateHero();
  refreshNotificationStatus();
  render();
  syncTasks();
}

function hydrateSettings() {
  const saved = safeParse(localStorage.getItem(SETTINGS_KEY), {});
  state.profileName = saved.profileName || state.profileName;
  elements.profileNameInput.value = state.profileName;
}

function buildCategoryOptions() {
  elements.taskCategoryInput.innerHTML = CATEGORY_META.map((category) => (
    `<option value="${category.id}">${category.label}</option>`
  )).join("");
}

function bindEvents() {
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
  elements.syncBtn.addEventListener("click", syncTasks);
  elements.notifyBtn.addEventListener("click", enableNotifications);
  elements.boardToggle.addEventListener("click", () => setView("board"));
  elements.calendarToggle.addEventListener("click", () => setView("calendar"));
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.clearFormBtn.addEventListener("click", resetForm);
  elements.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  elements.nextMonthBtn.addEventListener("click", () => changeMonth(1));
  elements.todayBtn.addEventListener("click", jumpToToday);
}

function saveSettings() {
  state.profileName = (elements.profileNameInput.value || "Operator").trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    profileName: state.profileName,
  }));

  updateHero();
  updateConnectionState("configured", "Preferences saved. Sync will use the Netlify function connected to Google Sheets.");
  syncTasks();
}

async function syncTasks() {
  if (window.location.protocol === "file:") {
    updateConnectionState("error", "Run this app through Netlify or `netlify dev`. Serverless sync does not work from a local file URL.");
    return;
  }

  updateConnectionState("loading", "Syncing tasks from Google Sheets...");

  try {
    const response = await apiRequest("list");
    state.tasks = sortTasks(response.tasks || []);
    state.lastSyncLabel = `Synced ${formatTime(new Date())}`;
    updateConnectionState("connected", `${state.tasks.length} tasks loaded from Google Sheets. ${state.lastSyncLabel}.`);
    scheduleNotifications();
    render();
  } catch (error) {
    updateConnectionState("error", `Sync failed. ${error.message}`);
  }
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  if (window.location.protocol === "file:") {
    updateConnectionState("error", "Run this app through Netlify or `netlify dev` before creating tasks.");
    return;
  }

  const payload = {
    id: elements.taskIdInput.value.trim(),
    title: elements.taskTitleInput.value.trim(),
    notes: elements.taskNotesInput.value.trim(),
    category: elements.taskCategoryInput.value,
    dueAt: localInputToIso(elements.taskDueInput.value),
    reminderAt: elements.taskReminderInput.value ? localInputToIso(elements.taskReminderInput.value) : "",
    status: "open",
  };

  if (!payload.title || !payload.dueAt) {
    updateConnectionState("error", "Task title and due time are required.");
    return;
  }

  const existingTask = state.tasks.find((task) => task.id === payload.id);
  if (existingTask) {
    payload.createdAt = existingTask.createdAt || "";
    if (existingTask.status === "completed") {
      payload.status = "completed";
      payload.completedAt = existingTask.completedAt || new Date().toISOString();
    }
  }

  updateConnectionState("loading", payload.id ? "Updating task in Google Sheets..." : "Saving task to Google Sheets...");

  try {
    const response = await apiRequest("save", { task: payload });
    upsertTaskInState(response.task);
    state.lastSyncLabel = `Synced ${formatTime(new Date())}`;
    updateConnectionState("connected", `Task saved. ${state.lastSyncLabel}.`);
    resetForm();
    scheduleNotifications();
    render();
  } catch (error) {
    updateConnectionState("error", `Save failed. ${error.message}`);
  }
}

function setView(view) {
  state.selectedView = view;
  elements.boardToggle.classList.toggle("active", view === "board");
  elements.calendarToggle.classList.toggle("active", view === "calendar");
  elements.boardView.classList.toggle("hidden", view !== "board");
  elements.calendarView.classList.toggle("hidden", view !== "calendar");
}

function changeMonth(offset) {
  const next = new Date(state.calendarCursor);
  next.setMonth(next.getMonth() + offset);
  state.calendarCursor = startOfMonth(next);
  renderCalendar();
}

function jumpToToday() {
  const today = new Date();
  state.calendarCursor = startOfMonth(today);
  state.selectedDateKey = dateKey(today);
  renderCalendar();
  renderAgenda();
}

async function toggleTaskCompletion(taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  const nextStatus = task.status === "completed" ? "open" : "completed";

  try {
    updateConnectionState("loading", "Updating task status...");
    const response = await apiRequest("save", {
      task: {
        ...task,
        status: nextStatus,
        completedAt: nextStatus === "completed" ? new Date().toISOString() : "",
      },
    });
    upsertTaskInState(response.task);
    state.lastSyncLabel = `Synced ${formatTime(new Date())}`;
    updateConnectionState("connected", `Task updated. ${state.lastSyncLabel}.`);
    scheduleNotifications();
    render();
  } catch (error) {
    updateConnectionState("error", `Status change failed. ${error.message}`);
  }
}

async function deleteTask(taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  const shouldDelete = window.confirm(`Delete "${task.title}"? The history entry will stay in Google Sheets.`);
  if (!shouldDelete) {
    return;
  }

  try {
    updateConnectionState("loading", "Deleting task...");
    await apiRequest("delete", { id: taskId });
    state.tasks = state.tasks.filter((entry) => entry.id !== taskId);
    state.lastSyncLabel = `Synced ${formatTime(new Date())}`;
    updateConnectionState("connected", `Task deleted. ${state.lastSyncLabel}.`);
    scheduleNotifications();
    render();
  } catch (error) {
    updateConnectionState("error", `Delete failed. ${error.message}`);
  }
}

function editTask(taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  elements.formTitle.textContent = "Edit task";
  elements.taskIdInput.value = task.id;
  elements.taskTitleInput.value = task.title || "";
  elements.taskCategoryInput.value = task.category || CATEGORY_META[0].id;
  elements.taskDueInput.value = isoToLocalInput(task.dueAt);
  elements.taskReminderInput.value = isoToLocalInput(task.reminderAt);
  elements.taskNotesInput.value = task.notes || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  elements.formTitle.textContent = "Add a task";
  elements.taskForm.reset();
  elements.taskIdInput.value = "";
  elements.taskCategoryInput.value = CATEGORY_META[0].id;
}

function render() {
  updateHero();
  renderMetrics();
  renderBoard();
  renderCalendar();
  renderAgenda();
}

function updateHero() {
  elements.heroDate.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  elements.heroTitle.textContent = `${state.profileName}, plan the next move.`;
}

function renderMetrics() {
  const openTasks = state.tasks.filter((task) => task.status !== "completed");
  const dueToday = openTasks.filter((task) => isSameDay(new Date(task.dueAt), new Date())).length;
  const next12Hours = openTasks.filter((task) => {
    const hours = hoursUntil(task.dueAt);
    return hours >= 0 && hours <= 12;
  }).length;
  const weekend = openTasks.filter((task) => task.category === "weekend").length;
  const completed = state.tasks.filter((task) => task.status === "completed").length;

  const metrics = [
    { label: "Open tasks", value: openTasks.length },
    { label: "Due today", value: dueToday },
    { label: "Next 12 hrs", value: next12Hours },
    { label: "Weekend queue", value: weekend },
    { label: "Completed", value: completed },
    { label: "Last sync", value: state.lastSyncLabel.replace("Synced ", "") },
  ];

  elements.metricsGrid.innerHTML = "";
  metrics.forEach((metric) => {
    const fragment = elements.metricCardTemplate.content.cloneNode(true);
    fragment.querySelector(".metric-label").textContent = metric.label;
    fragment.querySelector(".metric-value").textContent = metric.value;
    elements.metricsGrid.appendChild(fragment);
  });
}

function renderBoard() {
  elements.boardView.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "board-grid";

  CATEGORY_META.forEach((category) => {
    const column = document.createElement("article");
    column.className = "category-column";
    column.appendChild(renderColumnHead(category, state.tasks.filter((task) => task.category === category.id).length));

    const tasks = sortTasks(state.tasks.filter((task) => task.category === category.id));
    const list = document.createElement("div");
    list.className = "task-list";

    if (!tasks.length) {
      list.innerHTML = `<div class="empty-state">Nothing here right now.</div>`;
    } else {
      tasks.forEach((task) => list.appendChild(renderTaskCard(task, category)));
    }

    column.appendChild(list);
    grid.appendChild(column);
  });

  elements.boardView.appendChild(grid);
}

function renderColumnHead(category, count) {
  const wrapper = document.createElement("div");
  wrapper.className = "column-head";
  wrapper.innerHTML = `
    <div>
      <h3 class="column-title">${category.label}</h3>
      <p class="column-subtitle">${category.subtitle}</p>
    </div>
    <div>
      <div class="column-badge" style="background:${category.accent}">${category.shortLabel}</div>
      <p class="task-count">${count} task${count === 1 ? "" : "s"}</p>
    </div>
  `;
  return wrapper;
}

function renderTaskCard(task, category) {
  const card = document.createElement("article");
  card.className = `task-card ${task.status === "completed" ? "completed" : ""}`;

  card.innerHTML = `
    <div class="task-headline">
      <div>
        <h4 class="task-title">${escapeHtml(task.title || "Untitled task")}</h4>
      </div>
      <div class="task-status">${task.status === "completed" ? "Completed" : formatRelative(task.dueAt)}</div>
    </div>
    <p class="task-notes">${task.notes ? escapeHtml(task.notes) : "No notes added."}</p>
    <div class="task-meta">
      <span class="meta-pill">Due ${formatDateTime(task.dueAt)}</span>
      <span class="meta-pill">${task.reminderAt ? `Reminder ${formatDateTime(task.reminderAt)}` : "No reminder"}</span>
      <span class="meta-pill">${category.shortLabel}</span>
    </div>
  `;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const completeButton = document.createElement("button");
  completeButton.className = "btn btn-secondary";
  completeButton.type = "button";
  completeButton.textContent = task.status === "completed" ? "Mark open" : "Mark done";
  completeButton.addEventListener("click", () => toggleTaskCompletion(task.id));

  const editButton = document.createElement("button");
  editButton.className = "btn btn-secondary";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => editTask(task.id));

  const deleteButton = document.createElement("button");
  deleteButton.className = "btn btn-secondary";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  actions.append(completeButton, editButton, deleteButton);
  card.appendChild(actions);
  return card;
}

function renderCalendar() {
  elements.calendarMonthLabel.textContent = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(state.calendarCursor);

  const allDays = buildCalendarDays(state.calendarCursor);
  const taskMap = groupTasksByDay(state.tasks);

  elements.calendarGrid.innerHTML = "";
  WEEKDAY_LABELS.forEach((label) => {
    const weekday = document.createElement("div");
    weekday.className = "calendar-weekday";
    weekday.textContent = label;
    elements.calendarGrid.appendChild(weekday);
  });

  allDays.forEach((day) => {
    const key = dateKey(day.date);
    const dayTasks = taskMap.get(key) || [];
    const cell = document.createElement("div");
    cell.className = [
      "calendar-day",
      day.inCurrentMonth ? "" : "outside-month",
      key === state.selectedDateKey ? "selected" : "",
      key === dateKey(new Date()) ? "today" : "",
    ].filter(Boolean).join(" ");

    const chips = dayTasks.slice(0, 3).map((task) => {
      const color = categoryById(task.category).accent;
      return `<span class="calendar-task-chip" style="background:${color}">${escapeHtml(task.title)}</span>`;
    }).join("");

    cell.innerHTML = `
      <div class="calendar-date">
        <span class="day-number">${day.date.getDate()}</span>
        <span>${dayTasks.length ? `${dayTasks.length} item${dayTasks.length === 1 ? "" : "s"}` : ""}</span>
      </div>
      ${chips}
    `;

    cell.addEventListener("click", () => {
      state.selectedDateKey = key;
      renderCalendar();
      renderAgenda();
    });

    elements.calendarGrid.appendChild(cell);
  });
}

function renderAgenda() {
  const selectedDate = parseDateKey(state.selectedDateKey);
  elements.agendaTitle.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(selectedDate);

  const dayTasks = sortTasks(state.tasks.filter((task) => dateKey(new Date(task.dueAt)) === state.selectedDateKey));
  elements.agendaList.innerHTML = "";

  if (!dayTasks.length) {
    elements.agendaList.innerHTML = `<div class="empty-state">No tasks scheduled for this day.</div>`;
    return;
  }

  dayTasks.forEach((task) => {
    elements.agendaList.appendChild(renderTaskCard(task, categoryById(task.category)));
  });
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    elements.notificationStatus.textContent = "This browser does not support notifications.";
    return;
  }

  const permission = await Notification.requestPermission();
  refreshNotificationStatus(permission);
  if (permission === "granted") {
    scheduleNotifications();
  }
}

function refreshNotificationStatus(permission = typeof Notification !== "undefined" ? Notification.permission : "default") {
  if (!("Notification" in window)) {
    elements.notificationStatus.textContent = "This browser does not support notifications.";
    return;
  }

  if (permission === "granted") {
    elements.notificationStatus.textContent = "Notifications are enabled.";
  } else if (permission === "denied") {
    elements.notificationStatus.textContent = "Notifications are blocked in the browser.";
  } else {
    elements.notificationStatus.textContent = "Notifications are not enabled yet.";
  }
}

function scheduleNotifications() {
  reminderTimers.forEach((timerId) => clearTimeout(timerId));
  reminderTimers.clear();

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const sentReminders = safeParse(localStorage.getItem(REMINDER_LOG_KEY), {});

  state.tasks
    .filter((task) => task.status !== "completed" && task.reminderAt)
    .forEach((task) => {
      const reminderAt = new Date(task.reminderAt).getTime();
      const reminderKey = `${task.id}:${task.reminderAt}`;
      if (!Number.isFinite(reminderAt) || reminderAt <= Date.now() || sentReminders[reminderKey]) {
        return;
      }

      const timeout = reminderAt - Date.now();
      const timerId = window.setTimeout(() => {
        new Notification("Task reminder", {
          body: `${task.title} - ${categoryById(task.category).label}`,
        });
        sentReminders[reminderKey] = true;
        localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(sentReminders));
      }, timeout);

      reminderTimers.set(reminderKey, timerId);
    });
}

async function apiRequest(action, payload = {}) {
  if (action === "list") {
    const response = await fetch(`${API_ENDPOINT}?action=list&ts=${Date.now()}`, { method: "GET" });
    return handleApiResponse(response);
  }

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  return handleApiResponse(response);
}

async function handleApiResponse(response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Unknown API error");
  }
  return data;
}

function updateConnectionState(kind, message) {
  elements.connectionStatus.textContent = message;
  elements.connectionDot.classList.toggle("connected", kind === "connected");
}

function upsertTaskInState(task) {
  const index = state.tasks.findIndex((entry) => entry.id === task.id);
  if (index === -1) {
    state.tasks.push(task);
  } else {
    state.tasks[index] = task;
  }
  state.tasks = sortTasks(state.tasks);
}

function buildCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    days.push({
      date: current,
      inCurrentMonth: current.getMonth() === monthDate.getMonth(),
    });
  }
  return days;
}

function groupTasksByDay(tasks) {
  const map = new Map();
  tasks.forEach((task) => {
    const key = dateKey(new Date(task.dueAt));
    const bucket = map.get(key) || [];
    bucket.push(task);
    map.set(key, sortTasks(bucket));
  });
  return map;
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "completed" ? 1 : -1;
    }
    return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  });
}

function categoryById(categoryId) {
  return CATEGORY_META.find((category) => category.id === categoryId) || CATEGORY_META[0];
}

function localInputToIso(value) {
  return value ? new Date(value).toISOString() : "";
}

function isoToLocalInput(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelative(value) {
  const hours = hoursUntil(value);
  if (hours < 0) {
    return "Overdue";
  }
  if (hours < 1) {
    return "Due soon";
  }
  if (hours < 24) {
    return `${Math.round(hours)}h left`;
  }
  return `${Math.round(hours / 24)}d left`;
}

function hoursUntil(value) {
  return (new Date(value).getTime() - Date.now()) / 36e5;
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameDay(left, right) {
  return dateKey(left) === dateKey(right);
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
