const CATEGORY_META = [
  {
    id: "needs_priority",
    label: "Needs Priority",
    optionLabel: "List now, prioritize later",
    shortLabel: "Backlog",
    accent: "#8f90a6",
    syncsToSheets: true,
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
const REMINDER_LOG_KEY = "orbit_tasks_reminders_v1";
const API_ENDPOINT = "/.netlify/functions/tasks";

const state = {
  tasks: [],
  broadHeads: [],
  profileName: "Operator",
  selectedView: "board",
  selectedDateKey: dateKey(new Date()),
  selectedCategoryFilter: "all",
  selectedBroadHeadFilter: "all",
  calendarCursor: startOfMonth(new Date()),
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
  broadHeadSummaryList: document.getElementById("broadHeadSummaryList"),
  categorySummaryList: document.getElementById("categorySummaryList"),
  progressCount: document.getElementById("progressCount"),
  progressBarFill: document.getElementById("progressBarFill"),
  sidebarAddHeadBtn: document.getElementById("sidebarAddHeadBtn"),
  sidebarAddTaskBtn: document.getElementById("sidebarAddTaskBtn"),
  headModalWrap: document.getElementById("headModalWrap"),
  headFormTitle: document.getElementById("headFormTitle"),
  headForm: document.getElementById("headForm"),
  broadHeadIdInput: document.getElementById("broadHeadIdInput"),
  broadHeadTitleInput: document.getElementById("broadHeadTitleInput"),
  broadHeadNotesInput: document.getElementById("broadHeadNotesInput"),
  clearHeadFormBtn: document.getElementById("clearHeadFormBtn"),
  deleteBroadHeadBtn: document.getElementById("deleteBroadHeadBtn"),
  formTitle: document.getElementById("formTitle"),
  taskModalWrap: document.getElementById("taskModalWrap"),
  deleteTaskBtn: document.getElementById("deleteTaskBtn"),
  taskForm: document.getElementById("taskForm"),
  taskIdInput: document.getElementById("taskIdInput"),
  taskTitleInput: document.getElementById("taskTitleInput"),
  taskBroadHeadInput: document.getElementById("taskBroadHeadInput"),
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
  buildBroadHeadOptions();
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

function buildBroadHeadOptions(selectedId = "") {
  const options = [
    `<option value="">No broad head yet</option>`,
    ...state.broadHeads.map((head) => (
      `<option value="${head.id}">${escapeHtml(head.title)}</option>`
    )),
  ];

  elements.taskBroadHeadInput.innerHTML = options.join("");

  if (selectedId && headById(selectedId)) {
    elements.taskBroadHeadInput.value = selectedId;
    return;
  }

  elements.taskBroadHeadInput.value = "";
}

function bindEvents() {
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
  elements.syncBtn.addEventListener("click", syncTasks);
  elements.notifyBtn.addEventListener("click", enableNotifications);
  elements.sidebarAddHeadBtn.addEventListener("click", () => openHeadModal());
  elements.sidebarAddTaskBtn.addEventListener("click", () => openTaskModal({
    categoryId: state.selectedCategoryFilter !== "all" ? state.selectedCategoryFilter : CATEGORY_META[0].id,
    broadHeadId: state.selectedBroadHeadFilter !== "all" ? state.selectedBroadHeadFilter : "",
  }));
  elements.boardToggle.addEventListener("click", () => setView("board"));
  elements.calendarToggle.addEventListener("click", () => setView("calendar"));
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.clearFormBtn.addEventListener("click", closeTaskModal);
  elements.deleteTaskBtn.addEventListener("click", handleModalDelete);
  elements.headForm.addEventListener("submit", handleBroadHeadSubmit);
  elements.clearHeadFormBtn.addEventListener("click", closeHeadModal);
  elements.deleteBroadHeadBtn.addEventListener("click", handleBroadHeadDelete);
  elements.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  elements.nextMonthBtn.addEventListener("click", () => changeMonth(1));
  elements.todayBtn.addEventListener("click", jumpToToday);
  elements.taskModalWrap.addEventListener("click", handleTaskModalBackdrop);
  elements.headModalWrap.addEventListener("click", handleHeadModalBackdrop);
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

  updateConnectionState("loading", "Syncing workspace from Google Sheets...");

  try {
    const response = await apiRequest("list");
    state.broadHeads = sortBroadHeads((response.broadHeads || []).map(normalizeBroadHeadRecord));
    state.tasks = sortTasks((response.tasks || []).map((task) => normalizeTaskRecord(task, state.broadHeads)));
    normalizeActiveFilters();
    buildBroadHeadOptions(elements.taskBroadHeadInput.value);
    scheduleNotifications();
    render();
    updateConnectionState(
      "connected",
      `${state.broadHeads.length} broad heads and ${state.tasks.length} tasks loaded from Google Sheets.`
    );
  } catch (error) {
    updateConnectionState("error", `Sync failed. ${error.message}`);
  }
}

async function handleBroadHeadSubmit(event) {
  event.preventDefault();

  if (window.location.protocol === "file:") {
    updateConnectionState("error", "Run this app through Netlify or `netlify dev` before creating broad heads.");
    return;
  }

  const payload = {
    id: elements.broadHeadIdInput.value.trim(),
    title: elements.broadHeadTitleInput.value.trim(),
    notes: elements.broadHeadNotesInput.value.trim(),
  };

  if (!payload.title) {
    updateConnectionState("error", "Broad head title is required.");
    return;
  }

  updateConnectionState("loading", payload.id ? "Updating broad head..." : "Saving broad head...");

  try {
    const response = await apiRequest("saveHead", { head: payload });
    upsertBroadHeadInState(response.broadHead);
    buildBroadHeadOptions(response.broadHead.id);
    render();
    closeHeadModal();
    updateConnectionState("connected", "Broad head saved.");
  } catch (error) {
    updateConnectionState("error", `Save failed. ${error.message}`);
  }
}

async function handleBroadHeadDelete() {
  const broadHeadId = elements.broadHeadIdInput.value.trim();
  if (!broadHeadId) {
    return;
  }

  const linkedTasks = state.tasks.filter((task) => task.broadHeadId === broadHeadId);
  if (linkedTasks.length) {
    updateConnectionState("error", "This broad head still has subtasks. Reassign or delete them first.");
    return;
  }

  const broadHead = headById(broadHeadId);
  const shouldDelete = window.confirm(`Delete broad head "${broadHead?.title || "Untitled"}"?`);
  if (!shouldDelete) {
    return;
  }

  try {
    updateConnectionState("loading", "Deleting broad head...");
    await apiRequest("deleteHead", { id: broadHeadId });
    state.broadHeads = state.broadHeads.filter((head) => head.id !== broadHeadId);
    if (state.selectedBroadHeadFilter === broadHeadId) {
      state.selectedBroadHeadFilter = "all";
    }
    buildBroadHeadOptions();
    render();
    closeHeadModal();
    updateConnectionState("connected", "Broad head deleted.");
  } catch (error) {
    updateConnectionState("error", `Delete failed. ${error.message}`);
  }
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  if (window.location.protocol === "file:") {
    updateConnectionState("error", "Run this app through Netlify or `netlify dev` before creating tasks.");
    return;
  }

  const broadHeadId = elements.taskBroadHeadInput.value.trim();
  const broadHead = headById(broadHeadId);
  const existingTask = taskById(elements.taskIdInput.value.trim());
  const payload = {
    id: elements.taskIdInput.value.trim(),
    title: elements.taskTitleInput.value.trim(),
    notes: elements.taskNotesInput.value.trim(),
    category: categoryById(elements.taskCategoryInput.value).label,
    broadHeadId,
    broadHeadTitle: broadHead?.title || "",
    dueAt: localInputToIso(elements.taskDueInput.value),
    status: existingTask?.status === "completed" ? "completed" : "open",
    createdAt: existingTask?.createdAt || "",
    completedAt: existingTask?.completedAt || "",
  };

  if (!payload.title || !payload.dueAt) {
    updateConnectionState("error", "Task title and due time are required.");
    return;
  }

  updateConnectionState("loading", payload.id ? "Updating subtask..." : "Saving subtask...");

  try {
    const response = await apiRequest("save", { task: payload });
    upsertTaskInState(response.task);
    buildBroadHeadOptions(payload.broadHeadId);
    scheduleNotifications();
    render();
    closeTaskModal();
    updateConnectionState("connected", "Subtask saved.");
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
  render();
}

function setBroadHeadFilter(filter) {
  state.selectedBroadHeadFilter = filter;
  render();
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
    broadHeadId = "",
  } = options;

  resetTaskForm();
  elements.taskCategoryInput.value = categoryById(categoryId).id;
  buildBroadHeadOptions(broadHeadId || (state.selectedBroadHeadFilter !== "all" ? state.selectedBroadHeadFilter : ""));
  if (broadHeadId) {
    elements.taskBroadHeadInput.value = broadHeadId;
  }
  if (dueValue) {
    elements.taskDueInput.value = dueValue;
  }

  elements.taskModalWrap.classList.add("on");
  window.setTimeout(() => elements.taskTitleInput.focus(), 20);
}

function closeTaskModal() {
  elements.taskModalWrap.classList.remove("on");
  resetTaskForm();
}

function openHeadModal(headId = "") {
  resetHeadForm();

  if (headId) {
    const head = headById(headId);
    if (!head) {
      return;
    }
    elements.headFormTitle.textContent = "Edit Broad Head";
    elements.broadHeadIdInput.value = head.id;
    elements.broadHeadTitleInput.value = head.title || "";
    elements.broadHeadNotesInput.value = head.notes || "";
    elements.deleteBroadHeadBtn.classList.remove("hidden");
  }

  elements.headModalWrap.classList.add("on");
  window.setTimeout(() => elements.broadHeadTitleInput.focus(), 20);
}

function closeHeadModal() {
  elements.headModalWrap.classList.remove("on");
  resetHeadForm();
}

function handleTaskModalBackdrop(event) {
  if (event.target === elements.taskModalWrap) {
    closeTaskModal();
  }
}

function handleHeadModalBackdrop(event) {
  if (event.target === elements.headModalWrap) {
    closeHeadModal();
  }
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (elements.taskModalWrap.classList.contains("on")) {
    closeTaskModal();
  }

  if (elements.headModalWrap.classList.contains("on")) {
    closeHeadModal();
  }
}

async function toggleTaskCompletion(taskId) {
  const task = taskById(taskId);
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
    scheduleNotifications();
    render();
    updateConnectionState("connected", "Task updated.");
  } catch (error) {
    updateConnectionState("error", `Status change failed. ${error.message}`);
  }
}

async function deleteTask(taskId, options = {}) {
  const { skipConfirm = false, closeModal = false } = options;
  const task = taskById(taskId);
  if (!task) {
    return;
  }

  if (!skipConfirm) {
    const shouldDelete = window.confirm(`Delete "${task.title}"?`);
    if (!shouldDelete) {
      return;
    }
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
  const task = taskById(taskId);
  if (!task) {
    return;
  }

  elements.formTitle.textContent = "Edit Subtask";
  elements.taskIdInput.value = task.id;
  elements.taskTitleInput.value = task.title || "";
  buildBroadHeadOptions(task.broadHeadId || "");
  elements.taskBroadHeadInput.value = task.broadHeadId || "";
  elements.taskCategoryInput.value = canonicalCategoryId(task.category);
  elements.taskDueInput.value = isoToLocalInput(task.dueAt);
  elements.taskNotesInput.value = task.notes || "";
  elements.deleteTaskBtn.classList.remove("hidden");
  elements.taskModalWrap.classList.add("on");
  window.setTimeout(() => elements.taskTitleInput.focus(), 20);
}

function resetTaskForm() {
  elements.formTitle.textContent = "Add Subtask";
  elements.taskForm.reset();
  elements.taskIdInput.value = "";
  elements.taskCategoryInput.value = CATEGORY_META[0].id;
  buildBroadHeadOptions();
  elements.deleteTaskBtn.classList.add("hidden");
}

function resetHeadForm() {
  elements.headFormTitle.textContent = "Add Broad Head";
  elements.headForm.reset();
  elements.broadHeadIdInput.value = "";
  elements.deleteBroadHeadBtn.classList.add("hidden");
}

function render() {
  renderBroadHeadSummary();
  renderSidebarSummary();
  renderProgress();
  renderBoard();
  renderCalendar();
  renderAgenda();
}

function renderBroadHeadSummary() {
  const relevant = state.selectedCategoryFilter === "all"
    ? state.tasks
    : state.tasks.filter((task) => canonicalCategoryId(task.category) === state.selectedCategoryFilter);

  const rows = [
    {
      id: "all",
      title: "All Broad Heads",
      count: relevant.filter((task) => task.status !== "completed").length,
      meta: "Everything",
    },
    ...state.broadHeads.map((head) => ({
      id: head.id,
      title: head.title,
      count: relevant.filter((task) => task.broadHeadId === head.id && task.status !== "completed").length,
      meta: head.notes || "Tap to focus",
    })),
  ];

  elements.broadHeadSummaryList.innerHTML = "";

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = `head-item ${state.selectedBroadHeadFilter === row.id ? "on" : ""}`.trim();

    const main = document.createElement("button");
    main.className = "head-main";
    main.type = "button";
    main.innerHTML = `
      <span class="head-icon"></span>
      <span class="head-copy">
        <span class="head-title">${escapeHtml(row.title)}</span>
        <span class="head-meta">${escapeHtml(trimText(row.meta, 30))}</span>
      </span>
    `;
    main.addEventListener("click", () => setBroadHeadFilter(row.id));

    const edit = document.createElement("button");
    edit.className = "head-edit";
    edit.type = "button";
    edit.textContent = row.id === "all" ? String(row.count) : "Edit";
    if (row.id === "all") {
      edit.disabled = true;
    } else {
      edit.addEventListener("click", () => openHeadModal(row.id));
    }

    item.append(main, edit);
    elements.broadHeadSummaryList.appendChild(item);
  });
}

function renderSidebarSummary() {
  const rows = [
    {
      id: "all",
      label: "All Tasks",
      accent: "#9898a8",
      count: getVisibleTasks().filter((task) => task.status !== "completed").length,
    },
    ...CATEGORY_META.map((category) => ({
      id: category.id,
      label: category.label,
      accent: category.accent,
      count: getVisibleTasks({ categoryOverride: category.id }).filter((task) => task.status !== "completed").length,
    })),
  ];

  elements.categorySummaryList.innerHTML = "";

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = `cat ${state.selectedCategoryFilter === row.id ? "on" : ""}`.trim();
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
  const visibleTasks = getVisibleTasks();
  const total = visibleTasks.length;
  const completed = visibleTasks.filter((task) => task.status === "completed").length;
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
    const tasks = getVisibleTasks({ categoryOverride: category.id });
    const groups = buildTaskGroups(tasks);
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
      groups.forEach((group) => {
        list.appendChild(renderTaskGroup(group, category.id));
      });
    }

    const addButton = document.createElement("button");
    addButton.className = "col-add";
    addButton.type = "button";
    addButton.textContent = "+ Add subtask";
    addButton.addEventListener("click", () => openTaskModal({
      categoryId: category.id,
      broadHeadId: state.selectedBroadHeadFilter !== "all" ? state.selectedBroadHeadFilter : "",
    }));

    body.append(list, addButton);
    column.appendChild(body);
    grid.appendChild(column);
  });

  elements.boardView.appendChild(grid);
}

function renderTaskGroup(group, categoryId) {
  const wrap = document.createElement("section");
  wrap.className = "task-group";

  const head = document.createElement("div");
  head.className = "task-group-head";
  head.innerHTML = `
    <div class="task-group-title">${escapeHtml(group.title)}</div>
    <div class="task-group-meta">${group.tasks.filter((task) => task.status !== "completed").length} open</div>
  `;

  const addButton = document.createElement("button");
  addButton.className = "task-group-add";
  addButton.type = "button";
  addButton.textContent = "+ Add";
  addButton.addEventListener("click", () => openTaskModal({
    categoryId,
    broadHeadId: group.id === "ungrouped" ? "" : group.id,
  }));

  head.appendChild(addButton);
  wrap.appendChild(head);

  group.tasks.forEach((task) => {
    wrap.appendChild(renderTaskRow(task, { showHeadBadge: false }));
  });

  return wrap;
}

function renderTaskRow(task, options = {}) {
  const { showHeadBadge = true } = options;
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

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const parts = [];
  if (showHeadBadge && task.broadHeadTitle) {
    parts.push(`<span class="task-head-badge">${escapeHtml(task.broadHeadTitle)}</span>`);
  }
  parts.push(escapeHtml(formatDueLabel(task.dueAt)));
  if (task.notes) {
    parts.push(escapeHtml(trimText(task.notes, 48)));
  }
  meta.innerHTML = parts.join(" ");

  trigger.append(title, meta);
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
    elements.agendaList.appendChild(renderTaskRow(task, { showHeadBadge: true }));
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
  const normalized = normalizeTaskRecord(task, state.broadHeads);
  const index = state.tasks.findIndex((entry) => entry.id === normalized.id);
  if (index === -1) {
    state.tasks.push(normalized);
  } else {
    state.tasks[index] = normalized;
  }
  state.tasks = sortTasks(state.tasks);
}

function upsertBroadHeadInState(head) {
  const normalized = normalizeBroadHeadRecord(head);
  const index = state.broadHeads.findIndex((entry) => entry.id === normalized.id);
  if (index === -1) {
    state.broadHeads.push(normalized);
  } else {
    state.broadHeads[index] = normalized;
  }
  state.broadHeads = sortBroadHeads(state.broadHeads);
  state.tasks = state.tasks.map((task) => (
    task.broadHeadId === normalized.id
      ? { ...task, broadHeadTitle: normalized.title }
      : task
  ));
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

function buildTaskGroups(tasks) {
  const grouped = new Map();

  tasks.forEach((task) => {
    const id = task.broadHeadId || "ungrouped";
    const title = task.broadHeadTitle || "Without Broad Head";
    const bucket = grouped.get(id) || { id, title, tasks: [] };
    bucket.tasks.push(task);
    grouped.set(id, bucket);
  });

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      tasks: sortTasks(group.tasks),
    }))
    .sort((left, right) => {
      if (left.id === "ungrouped") {
        return 1;
      }
      if (right.id === "ungrouped") {
        return -1;
      }
      return left.title.localeCompare(right.title);
    });
}

function getVisibleTasks(options = {}) {
  const { categoryOverride = null, broadHeadOverride = null } = options;
  const activeCategory = categoryOverride || state.selectedCategoryFilter;
  const activeBroadHead = broadHeadOverride || state.selectedBroadHeadFilter;

  return state.tasks.filter((task) => {
    if (activeCategory !== "all" && canonicalCategoryId(task.category) !== activeCategory) {
      return false;
    }
    if (activeBroadHead !== "all" && task.broadHeadId !== activeBroadHead) {
      return false;
    }
    return true;
  });
}

function normalizeActiveFilters() {
  if (state.selectedBroadHeadFilter !== "all" && !headById(state.selectedBroadHeadFilter)) {
    state.selectedBroadHeadFilter = "all";
  }
}
function normalizeTaskRecord(task, broadHeads) {
  const broadHeadId = String(task?.broadHeadId || "").trim();
  const linkedHead = broadHeads.find((head) => head.id === broadHeadId);
  return {
    id: String(task?.id || "").trim(),
    title: String(task?.title || "").trim(),
    notes: String(task?.notes || "").trim(),
    category: String(task?.category || CATEGORY_META[0].label).trim(),
    broadHeadId,
    broadHeadTitle: String(linkedHead?.title || task?.broadHeadTitle || "").trim(),
    status: task?.status === "completed" ? "completed" : "open",
    dueAt: String(task?.dueAt || "").trim(),
    createdAt: String(task?.createdAt || "").trim(),
    updatedAt: String(task?.updatedAt || "").trim(),
    completedAt: String(task?.completedAt || "").trim(),
  };
}

function normalizeBroadHeadRecord(head) {
  return {
    id: String(head?.id || "").trim(),
    title: String(head?.title || "").trim(),
    notes: String(head?.notes || "").trim(),
    createdAt: String(head?.createdAt || "").trim(),
    updatedAt: String(head?.updatedAt || "").trim(),
  };
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "completed" ? 1 : -1;
    }
    return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  });
}

function sortBroadHeads(heads) {
  return [...heads].sort((left, right) => left.title.localeCompare(right.title));
}

function headById(headId) {
  return state.broadHeads.find((head) => head.id === headId) || null;
}

function taskById(taskId) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

function categoryById(categoryId) {
  return CATEGORY_META.find((category) => canonicalCategoryId(categoryId) === category.id) || CATEGORY_META[0];
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

function formatDueLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "No due time";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function trimText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}...`;
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
