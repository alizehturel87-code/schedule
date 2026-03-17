import { CATEGORY_META } from "./constants";

export function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function canonicalCategoryId(value) {
  const input = String(value || "").trim().toLowerCase();
  const match = CATEGORY_META.find((category) => (
    category.id.toLowerCase() === input
    || category.label.toLowerCase() === input
  ));
  return match ? match.id : CATEGORY_META[0].id;
}

export function categoryById(value) {
  return CATEGORY_META.find((category) => category.id === canonicalCategoryId(value)) || CATEGORY_META[0];
}

export function normalizeBroadHeadRecord(head) {
  return {
    id: String(head?.id || "").trim(),
    title: String(head?.title || "").trim(),
    notes: String(head?.notes || "").trim(),
    createdAt: String(head?.createdAt || "").trim(),
    updatedAt: String(head?.updatedAt || "").trim(),
  };
}

export function normalizeTaskRecord(task, broadHeads) {
  const broadHeadId = String(task?.broadHeadId || "").trim();
  const broadHead = broadHeads.find((item) => item.id === broadHeadId);
  return {
    id: String(task?.id || "").trim(),
    title: String(task?.title || "").trim(),
    notes: String(task?.notes || "").trim(),
    category: String(task?.category || CATEGORY_META[0].label).trim(),
    broadHeadId,
    broadHeadTitle: String(broadHead?.title || task?.broadHeadTitle || "").trim(),
    status: task?.status === "completed" ? "completed" : "open",
    dueAt: String(task?.dueAt || "").trim(),
    createdAt: String(task?.createdAt || "").trim(),
    updatedAt: String(task?.updatedAt || "").trim(),
    completedAt: String(task?.completedAt || "").trim(),
  };
}

export function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "completed" ? 1 : -1;
    }
    return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  });
}

export function sortBroadHeads(heads) {
  return [...heads].sort((left, right) => left.title.localeCompare(right.title));
}

export function formatDateLabel(value) {
  if (!value) {
    return "No due date";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "No due date";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatHeaderDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(value) {
  const [year, month, day] = value.split("-").map((item) => Number(item));
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

export function isoToLocalInput(value) {
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

export function getCompletedTodayCount(tasks) {
  const today = dateKey(new Date());
  return tasks.filter((task) => (
    task.status === "completed" && task.completedAt && dateKey(new Date(task.completedAt)) === today
  )).length;
}

export function trimText(value, limit) {
  const text = String(value || "").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3)}...`;
}
