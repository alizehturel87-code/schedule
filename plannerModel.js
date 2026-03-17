import { DEFAULT_CATEGORIES, PRIORITY_META } from "./plannerConstants";

export function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function getHeaderDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function canonicalPriority(value) {
  const input = String(value || "").trim().toLowerCase();
  if (PRIORITY_META[input]) {
    return input;
  }

  const match = Object.values(PRIORITY_META).find((priority) => (
    priority.label.toLowerCase() === input || priority.shortLabel.toLowerCase() === input
  ));
  return match ? match.id : "open";
}

export function priorityById(value) {
  return PRIORITY_META[canonicalPriority(value)] || PRIORITY_META.open;
}

export function defaultCategoryForId(categoryId) {
  return DEFAULT_CATEGORIES.find((item) => item.id === categoryId) || null;
}

export function parseCategoryRecord(record) {
  const meta = safeParse(record?.notes, {});
  const fallback = defaultCategoryForId(String(record?.id || "").trim());
  return {
    id: String(record?.id || "").trim(),
    name: String(record?.title || fallback?.name || "Untitled").trim(),
    emoji: String(meta.emoji || fallback?.emoji || "📁").trim(),
    color: String(meta.color || fallback?.color || "#4a84d8").trim(),
    system: Boolean(meta.system ?? fallback?.system ?? false),
  };
}

export function serializeCategoryPayload(category) {
  return {
    id: category.id || "",
    title: String(category.name || "").trim(),
    notes: JSON.stringify({
      emoji: String(category.emoji || "📁").trim(),
      color: String(category.color || "#4a84d8").trim(),
      system: Boolean(category.system),
    }),
  };
}

export function parseDueAt(value) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const [datePart, timePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute);
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function toDateKey(value) {
  const date = value instanceof Date ? value : parseDueAt(value);
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromDateKey(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function buildCalendarDays(monthDate) {
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

export function splitDueAt(value) {
  if (!value) {
    return { dueDate: "", dueTime: "" };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { dueDate: value, dueTime: "" };
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const [dueDate, dueTime] = value.split("T");
    return { dueDate, dueTime };
  }
  const parsed = parseDueAt(value);
  if (!parsed) {
    return { dueDate: "", dueTime: "" };
  }
  const dueDate = toDateKey(parsed);
  const dueTime = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  return { dueDate, dueTime };
}

export function combineDueAt(dueDate, dueTime) {
  if (!dueDate) {
    return "";
  }
  return dueTime ? `${dueDate}T${dueTime}` : dueDate;
}

export function formatTaskDueLabel(value) {
  const parsed = parseDueAt(value);
  if (!parsed) {
    return "No date";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(parsed);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function taskToViewModel(taskRecord, categories) {
  const categoryId = String(taskRecord?.broadHeadId || "").trim();
  const category = categories.find((item) => item.id === categoryId) || defaultCategoryForId(categoryId) || categories[0] || null;
  return {
    id: String(taskRecord?.id || "").trim(),
    title: String(taskRecord?.title || "").trim(),
    description: String(taskRecord?.notes || "").trim(),
    categoryId: category?.id || categoryId || "",
    priority: canonicalPriority(taskRecord?.category),
    dueAt: String(taskRecord?.dueAt || "").trim(),
    completed: taskRecord?.status === "completed",
    createdAt: String(taskRecord?.createdAt || "").trim(),
    completedAt: String(taskRecord?.completedAt || "").trim(),
    categoryName: category?.name || String(taskRecord?.broadHeadTitle || "").trim(),
  };
}

export function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    const leftDue = parseDueAt(left.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightDue = parseDueAt(right.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

export function getCategoryById(categories, categoryId) {
  return categories.find((item) => item.id === categoryId) || defaultCategoryForId(categoryId) || categories[0] || null;
}

export function getCompletedTodayCount(tasks) {
  const todayKey = toDateKey(new Date());
  return tasks.filter((task) => task.completed && task.completedAt && toDateKey(task.completedAt) === todayKey).length;
}
