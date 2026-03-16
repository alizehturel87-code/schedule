const CATEGORY_META = [
  {
    id: "needs_priority",
    label: "Needs Priority",
    optionLabel: "List now, prioritize later",
    shortLabel: "Local only",
    accent: "#8f90a6",
    syncsToSheets: false,
  },
  {
    id: "ultra_12",
    label: "Ultra Important",
    optionLabel: "Ultra important to be completed in next 12 hrs",
    shortLabel: "Next 12 hrs",
    accent: "#ff4d62",
    syncsToSheets: true,
  },
  {
    id: "important_24",
    label: "Important",
    optionLabel: "Important to be done in next 24 hrs",
    shortLabel: "Next 24 hrs",
    accent: "#ffb347",
    syncsToSheets: true,
  },
  {
    id: "weekend",
    label: "Weekend",
    optionLabel: "Weekend Tasks",
    shortLabel: "This weekend",
    accent: "#5fa2ff",
    syncsToSheets: true,
  },
  {
    id: "meetings_events",
    label: "Meetings & Events",
    optionLabel: "Meetings and events to reach on time",
    shortLabel: "On time",
    accent: "#c487ff",
    syncsToSheets: true,
  },
  {
    id: "leisure",
    label: "Leisure",
    optionLabel: "Do it at your leisure",
    shortLabel: "Whenever",
    accent: "#59dda0",
    syncsToSheets: true,
  },
];

const SETTINGS_KEY = "orbit_tasks_settings_v1";
const DRAFT_TASKS_KEY = "orbit_tasks_drafts_v1";
const REMINDER_LOG_KEY = "orbit_tasks_reminders_v1";
const API_ENDPOINT = "/.netlify/functions/tasks";

const state = {
  tasks: [],
  profileName: "Operator",
  selectedView: "board",
  selectedDateKey: dateKey(new Date()),
  selectedCategoryFilter: "all",
  calendarCursor: startOfMonth(new Date()),
  editingTaskId: "",
};

const reminderTimers = new Map();
let statusToastTimer = 0;

const elements = {
  profileNameInput: document.getElementById("profileNameInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  syncBtn: document.getElementById("syncBtn"),
  connectionStatus: document.getElementById("connectionStatus"),
  connectionDot: document.getElementById("connectionDot"),
  notificationStatus: document.getElementById("notificationStatus"),
  statusToast: document.getElementById("statusToast"),
  notifyBtn: document.getElementById("notifyBtn"),
  categorySummaryList: document.getElementById("categorySummaryList"),
  progressCount: document.getElementById("progressCount"),
  progressBarFill: document.getElementById("progressBarFill"),
  sidebarAddTaskBtn: document.getElementById("sidebarAddTaskBtn"),
  formTitle: document.getElementById("formTitle"),
  taskModalWrap: document.getElementById("taskModalWrap"),
  deleteTaskBtn: document.getElementById("deleteTaskBtn"),
  taskForm: document.getElementById("taskForm"),
  taskIdInput: document.getElementById("taskIdInput"),
  taskTitleInput: document.getElementById("taskTitleInput"),
  taskCategoryInput: document.getElementById("taskCategoryInput"),
  taskDueInput: document.getElementById("taskDueInput"),
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
};

init();

function init() {
  hydrateSettings();
  buildCategoryOptions();
  bindEvents();
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
    `<option value="${category.id}">${category.optionLabel}</option>`
  )).join("");
}

function bindEvents() {
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
  elements.syncBtn.addEventListener("click", syncTasks);
  elements.notifyBtn.addEventListener("click", enableNotifications);
  elements.sidebarAddTaskBtn.addEventListener("click", () => openTaskModal());
  elements.boardToggle.addEventListener("click", () => setView("board"));
  elements.calendarToggle.addEventListener("click", () => setView("calendar"));
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.clearFormBtn.addEventListener("click", closeTaskModal);
  elements.deleteTaskBtn.addEventListener("click", handleModalDelete);
  elements.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  elements.nextMonthBtn.addEventListener("click", () => changeMonth(1));
  elements.todayBtn.addEventListener("click", jumpToToday);
  elements.taskModalWrap.addEventListener("click", handleModalBackdrop);
  document.addEventListener("keydown", handleGlobalKeydown);
}

function saveSettings() {
  state.profileName = (elements.profileNameInput.value || "Operator").trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    profileName: state.profileName,
  }));
  updateConnectionState("configured", "Workspace name saved.");
}

async function syncTasks() {
  if (window.location.protocol === "file:") {
    updateConnectionState("error", "Run this app through Netlify or `netlify dev`. Serverless sync does not work from a local file URL.");
    return;
  }

  updateConnectionState("loading", "Syncing tasks from Google Sheets...");

  try {
    const response = await apiRequest("list");
    const remoteTasks = response.tasks || [];
    const draftTasks = loadDraftTasks();
    state.tasks = sortTasks([...remoteTasks, ...draftTasks]);
    const draftSuffix = draftTasks.length ? ` ${draftTasks.length} local drafts still need priority.` : "";
    updateConnectionState("connected", `${remoteTasks.length} tasks loaded from Google Sheets.${draftSuffix}`);
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
    category: categoryById(elements.taskCategoryInput.value).label,
    dueAt: localInputToIso(elements.taskDueInput.value),
    status: "open",
  };
  const selectedCategory = categoryById(elements.taskCategoryInput.value);

  if (!payload.title || !payload.dueAt) {
    updateConnectionState("error", "Task title and due time are required.");
    return;
  }

  const existingTask = state.tasks.find((task) => task.id === payload.id);
  if (existingTask && !isDraftTask(existingTask) && !selectedCategory.syncsToSheets) {
    updateConnectionState("error", "Tasks already in Google Sheets must keep a real priority.");
    return;
  }

  if (existingTask) {
    payload.createdAt = existingTask.createdAt || "";
    if (existingTask.status === "completed") {
      payload.status = "completed";
      payload.completedAt = existingTask.completedAt || new Date().toISOString();
    }
  }

  if (!selectedCategory.syncsToSheets) {
    saveDraftTask({
      id: isDraftTask(existingTask) ? existingTask.id : createDraftId(),
      title: payload.title,
      notes: payload.notes,
      category: selectedCategory.label,
      dueAt: payload.dueAt,
      status: payload.status,
      createdAt: existingTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: payload.completedAt || "",
      localOnly: true,
    });
    closeTaskModal();
    scheduleNotifications();
    render();
    updateConnectionState("configured", "Task saved locally. It will sync after you assign a priority.");
    return;
  }

  updateConnectionState("loading", payload.id ? "Updating task..." : "Saving task...");

  try {
    const draftId = isDraftTask(existingTask) ? existingTask.id : "";
    if (draftId) {
      payload.id = "";
    }
    const response = await apiRequest("save", { task: payload });
    if (draftId) {
      removeDraftTask(draftId);
      state.tasks = state.tasks.filter((task) => task.id !== draftId);
    }
    upsertTaskInState(response.task);
    closeTaskModal();
    scheduleNotifications();
    render();
    updateConnectionState("connected", "Task saved.");
  } catch (error) {
    updateConnectionState("error", `Save failed. ${error.message}`);
  }
}

async function handleModalDelete() {
  const taskId = elements.taskIdInput.value.trim();
  if (!taskId) {
    return;
  }
  await deleteTask(taskId, { skipConfirm: true, closeModal: true });
}

function setView(view) {
  state.selectedView = view;
  elements.boardToggle.classList.toggle("on", view === "board");
  elements.calendarToggle.classList.toggle("on", view === "calendar");
  elements.boardView.classList.toggle("hidden", view !== "board");
  elements.calendarView.classList.toggle("hidden", view !== "calendar");
}

function setCategoryFilter(filter) {
  state.selectedCategoryFilter = filter;
  renderSidebarSummary();
  renderBoard();
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

function openTaskModal(options = {}) {
  const {
    categoryId = CATEGORY_META[0].id,
    dueValue = "",
    preserveValues = false,
  } = options;

  if (!preserveValues) {
    resetForm();
    elements.taskCategoryInput.value = categoryId;
    if (dueValue) {
      elements.taskDueInput.value = dueValue;
    }
  }

  elements.taskModalWrap.classList.add("on");
  window.setTimeout(() => elements.taskTitleInput.focus(), 20);
}

function closeTaskModal() {
  elements.taskModalWrap.classList.remove("on");
  resetForm();
}

function handleModalBackdrop(event) {
  if (event.target === elements.taskModalWrap) {
    closeTaskModal();
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && elements.taskModalWrap.classList.contains("on")) {
    closeTaskModal();
  }
}

async function toggleTaskCompletion(taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  const nextStatus = task.status === "completed" ? "open" : "completed";
  if (isDraftTask(task)) {
    saveDraftTask({
      ...task,
      status: nextStatus,
      completedAt: nextStatus === "completed" ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString(),
    });
    scheduleNotifications();
    render();
    updateConnectionState("configured", "Draft updated locally.");
    return;
  }

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
    scheduleNotifications();
    render();
    updateConnectionState("connected", "Task updated.");
  } catch (error) {
    updateConnectionState("error", `Status change failed. ${error.message}`);
  }
}

async function deleteTask(taskId, options = {}) {
  const { skipConfirm = false, closeModal = false } = options;
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  if (!skipConfirm) {
    const prompt = isDraftTask(task)
      ? `Delete local draft "${task.title}"?`
      : `Delete "${task.title}"? The history entry will stay in Google Sheets.`;
    const shouldDelete = window.confirm(prompt);
    if (!shouldDelete) {
      return;
    }
  }

  if (isDraftTask(task)) {
    removeDraftTask(taskId);
    state.tasks = state.tasks.filter((entry) => entry.id !== taskId);
    scheduleNotifications();
    render();
    updateConnectionState("configured", "Draft deleted.");
    if (closeModal) {
      closeTaskModal();
    }
    return;
  }

  try {
    updateConnectionState("loading", "Deleting task...");
    await apiRequest("delete", { id: taskId });
    state.tasks = state.tasks.filter((entry) => entry.id !== taskId);
    scheduleNotifications();
    render();
    updateConnectionState("connected", "Task deleted.");
    if (closeModal) {
      closeTaskModal();
    }
  } catch (error) {
    updateConnectionState("error", `Delete failed. ${error.message}`);
  }
}

function editTask(taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  state.editingTaskId = task.id;
  elements.formTitle.textContent = "Edit Task";
  elements.taskIdInput.value = task.id;
  elements.taskTitleInput.value = task.title || "";
  elements.taskCategoryInput.value = canonicalCategoryId(task.category);
  elements.taskDueInput.value = isoToLocalInput(task.dueAt);
  elements.taskNotesInput.value = task.notes || "";
  elements.deleteTaskBtn.classList.remove("hidden");
  elements.taskModalWrap.classList.add("on");
  window.setTimeout(() => elements.taskTitleInput.focus(), 20);
}

function resetForm() {
  state.editingTaskId = "";
  elements.formTitle.textContent = "Add Task";
  elements.taskForm.reset();
  elements.taskIdInput.value = "";
  elements.taskCategoryInput.value = CATEGORY_META[0].id;
  elements.deleteTaskBtn.classList.add("hidden");
}

function render() {
  renderSidebarSummary();
  renderProgress();
  renderBoard();
  renderCalendar();
  renderAgenda();
}

function renderSidebarSummary() {
  const rows = [
    {
      id: "all",
      label: "All Tasks",
      accent: "#9898a8",
      count: state.tasks.filter((task) => task.status !== "completed").length,
    },
    ...CATEGORY_META.map((category) => ({
      id: category.id,
      label: category.label,
      accent: category.accent,
      count: state.tasks.filter((task) => canonicalCategoryId(task.category) === category.id && task.status !== "completed").length,
    })),
  ];

  elements.categorySummaryList.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = `cat ${state.selectedCategoryFilter === row.id ? "on" : ""}`;
    item.innerHTML = `
      <span class="cdot" style="background:${row.accent}"></span>
      <span class="cname">${row.label}</span>
      <span class="ccnt">${row.count}</span>
    `;
    item.addEventListener("click", () => setCategoryFilter(row.id));
    elements.categorySummaryList.appendChild(item);
  });
}

function renderProgress() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.status === "completed").length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  elements.progressCount.textContent = `${completed}/${total}`;
  elements.progressBarFill.style.width = `${percent}%`;
}

function renderBoard() {
  elements.boardView.innerHTML = "";

  const categories = state.selectedCategoryFilter === "all"
    ? CATEGORY_META
    : CATEGORY_META.filter((category) => category.id === state.selectedCategoryFilter);

  const grid = document.createElement("div");
  grid.className = `grid ${categories.length === 1 ? "single-column" : ""}`.trim();

  categories.forEach((category) => {
    const tasks = sortTasks(state.tasks.filter((task) => canonicalCategoryId(task.category) === category.id));
    const openCount = tasks.filter((task) => task.status !== "completed").length;

    const column = document.createElement("article");
    column.className = "col";
    column.innerHTML = `
      <div class="col-head">
        <div class="stripe" style="background:${category.accent}"></div>
        <div>
          <div class="col-title">${category.label}</div>
          <div class="col-sub">${category.shortLabel}</div>
        </div>
        <div class="col-cnt" style="color:${category.accent}">${openCount}</div>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "col-body";

    const list = document.createElement("div");
    list.className = "task-list";

    if (!tasks.length) {
      list.innerHTML = `<div class="empty-state">Nothing here</div>`;
    } else {
      tasks.forEach((task) => list.appendChild(renderTaskRow(task, category)));
    }

    const addButton = document.createElement("button");
    addButton.className = "col-add";
    addButton.type = "button";
    addButton.textContent = "+ Add task";
    addButton.addEventListener("click", () => openTaskModal({ categoryId: category.id }));

    body.append(list, addButton);
    column.appendChild(body);
    grid.appendChild(column);
  });

  elements.boardView.appendChild(grid);
}

function renderTaskRow(task, category) {
  const row = document.createElement("div");
  row.className = `task ${task.status === "completed" ? "done" : ""}`.trim();

  const checkbox = document.createElement("button");
  checkbox.className = `chk ${task.status === "completed" ? "on" : ""}`.trim();
  checkbox.type = "button";
  checkbox.setAttribute("aria-label", task.status === "completed" ? "Mark task open" : "Mark task done");
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleTaskCompletion(task.id);
  });

  const trigger = document.createElement("button");
  trigger.className = "task-button";
  trigger.type = "button";
  trigger.addEventListener("click", () => editTask(task.id));

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title || "Untitled task";
  if (isDraftTask(task)) {
    title.textContent = `${title.textContent} · local draft`;
  }

  trigger.appendChild(title);
  row.append(checkbox, trigger);
  return row;
}

function renderCalendar() {
  elements.calendarMonthLabel.textContent = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(state.calendarCursor);

  const allDays = buildCalendarDays(state.calendarCursor);
  const taskMap = groupTasksByDay(state.tasks);

  elements.calendarGrid.innerHTML = "";

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

    const chips = dayTasks.slice(0, 2).map((task) => {
      const color = categoryById(task.category).accent;
      return `<span class="calendar-task-chip" style="background:${color}22;color:${color}">${escapeHtml(task.title)}</span>`;
    }).join("");

    cell.innerHTML = `
      <div class="calendar-date">
        <span class="day-number">${day.date.getDate()}</span>
        <span>${dayTasks.length ? dayTasks.length : ""}</span>
      </div>
      ${chips}
    `;

    cell.addEventListener("click", () => {
      state.selectedDateKey = key;
      renderCalendar();
      renderAgenda();
      if (day.inCurrentMonth) {
        openTaskModal({ dueValue: isoForSelectedDay(day.date) });
      }
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
    elements.agendaList.appendChild(renderTaskRow(task, categoryById(task.category)));
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
    .filter((task) => task.status !== "completed" && task.dueAt)
    .forEach((task) => {
      const dueAt = new Date(task.dueAt).getTime();
      const reminderKey = `${task.id}:${task.dueAt}`;
      if (!Number.isFinite(dueAt) || dueAt <= Date.now() || sentReminders[reminderKey]) {
        return;
      }

      const timeout = dueAt - Date.now();
      const timerId = window.setTimeout(() => {
        new Notification("Task due now", {
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
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  if (!data.ok) {
    throw new Error(data.error || "Unknown API error");
  }
  return data;
}

function updateConnectionState(kind, message) {
  elements.connectionStatus.textContent = message;
  elements.connectionDot.classList.toggle("connected", kind === "connected");
  showStatusToast(kind, message);
}

function showStatusToast(kind, message) {
  window.clearTimeout(statusToastTimer);
  elements.statusToast.textContent = message;
  elements.statusToast.className = `status-toast ${kind}`;

  if (kind === "connected" || kind === "configured") {
    statusToastTimer = window.setTimeout(() => {
      elements.statusToast.className = "status-toast hidden";
    }, 2800);
  }
}

function upsertTaskInState(task) {
  const index = state.tasks.findIndex((entry) => entry.id === task.id);
  if (index === -1) {
    state.tasks.push(task);
  } else {
    state.tasks[index] = task;
  }
  persistDraftTasks();
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
  return CATEGORY_META.find((category) => category.id === canonicalCategoryId(categoryId)) || CATEGORY_META[0];
}

function canonicalCategoryId(value) {
  const input = String(value || "").trim().toLowerCase();
  const match = CATEGORY_META.find((category) => (
    category.id.toLowerCase() === input
    || category.label.toLowerCase() === input
    || category.optionLabel.toLowerCase() === input
  ));
  return match?.id || CATEGORY_META[0].id;
}

function isDraftTask(task) {
  return Boolean(task?.localOnly) || String(task?.id || "").startsWith("draft-");
}

function createDraftId() {
  return `draft-${Date.now()}`;
}

function loadDraftTasks() {
  const drafts = safeParse(localStorage.getItem(DRAFT_TASKS_KEY), []);
  return Array.isArray(drafts) ? drafts.filter(isDraftTask) : [];
}

function persistDraftTasks() {
  const drafts = state.tasks.filter(isDraftTask);
  localStorage.setItem(DRAFT_TASKS_KEY, JSON.stringify(drafts));
}

function saveDraftTask(task) {
  upsertTaskInState({
    ...task,
    localOnly: true,
  });
}

function removeDraftTask(taskId) {
  const remaining = state.tasks.filter((task) => task.id !== taskId);
  localStorage.setItem(DRAFT_TASKS_KEY, JSON.stringify(remaining.filter(isDraftTask)));
}

function localInputToIso(value) {
  return value ? value.slice(0, 16) : "";
}

function isoToLocalInput(value) {
  if (!value) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isoForSelectedDay(date) {
  const value = new Date(date);
  value.setHours(9, 0, 0, 0);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T09:00`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
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
