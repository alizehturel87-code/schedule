import { useCallback, useEffect, useMemo, useState } from "react";
import { API_ENDPOINT, DEFAULT_CATEGORIES } from "./plannerConstants";
import {
  combineDueAt,
  getCategoryById,
  parseCategoryRecord,
  parseJournalRecord,
  sortTasks,
  taskToViewModel,
  toDateKey,
} from "./plannerModel";

const IDLE_STATUS = { kind: "configured", message: "" };

async function handleApiResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  if (!data?.ok) {
    throw new Error(data?.error || "Unknown API error");
  }
  return data;
}

async function apiRequest(action, payload = {}) {
  if (action === "list") {
    const response = await fetch(`${API_ENDPOINT}?action=list&ts=${Date.now()}`, { method: "GET" });
    return handleApiResponse(response);
  }

  if (action === "getJournal") {
    const { date } = payload;
    const response = await fetch(`${API_ENDPOINT}?action=getJournal&date=${encodeURIComponent(date)}&ts=${Date.now()}`, { method: "GET" });
    return handleApiResponse(response);
  }

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  return handleApiResponse(response);
}

export function usePlannerApi() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(IDLE_STATUS);
  // Map<dateKey, {doneCount, missedCount}> for calendar indicators
  const [journalSummaries, setJournalSummaries] = useState(new Map());
  // Cache of full journal entries loaded on demand
  const [journalCache, setJournalCache] = useState(new Map());

  const applyRemoteState = useCallback((response) => {
    const nextCategories = (response.broadHeads || []).map(parseCategoryRecord);
    const categoriesToUse = nextCategories.length ? nextCategories : DEFAULT_CATEGORIES;
    const nextTasks = sortTasks((response.tasks || []).map((task) => taskToViewModel(task, categoriesToUse)));
    setCategories(categoriesToUse);
    setTasks(nextTasks);

    if (Array.isArray(response.journalSummaries)) {
      const map = new Map(response.journalSummaries.map((s) => [s.date, s]));
      setJournalSummaries(map);
    }
  }, []);

  const syncPlanner = useCallback(async () => {
    setStatus({ kind: "loading", message: "Syncing planner..." });
    try {
      const response = await apiRequest("list");
      applyRemoteState(response);
      setStatus({ kind: "connected", message: "Planner synced." });
    } catch (error) {
      setStatus({ kind: "error", message: `Sync failed. ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [applyRemoteState]);

  useEffect(() => {
    syncPlanner();
  }, [syncPlanner]);

  useEffect(() => {
    if (!status.message || status.kind === "loading") {
      return undefined;
    }

    const timeoutMs = status.kind === "error" ? 4000 : 2400;
    const timeoutId = window.setTimeout(() => {
      setStatus((current) => (current === status ? IDLE_STATUS : current));
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [status]);

  const saveTask = useCallback(async (draft, existingTask = null) => {
    const category = getCategoryById(categories, draft.categoryId);
    if (!category) {
      setStatus({ kind: "error", message: "Choose a category first." });
      return null;
    }

    const completed = Boolean(draft.completed ?? existingTask?.completed);
    const payload = {
      id: existingTask?.id || draft.id || "",
      title: String(draft.title || "").trim(),
      notes: String(draft.description || "").trim(),
      category: String(draft.priority || "open").trim(),
      broadHeadId: category.id,
      broadHeadTitle: category.name,
      dueAt: combineDueAt(draft.dueDate, draft.dueTime),
      status: completed ? "completed" : "open",
      createdAt: existingTask?.createdAt || draft.createdAt || "",
      completedAt: completed ? existingTask?.completedAt || draft.completedAt || new Date().toISOString() : "",
    };

    if (!payload.title) {
      setStatus({ kind: "error", message: "Task title is required." });
      return null;
    }

    setStatus({ kind: "loading", message: existingTask ? "Updating task..." : "Saving task..." });
    try {
      const response = await apiRequest("save", { task: payload });
      const nextTask = taskToViewModel(response.task, categories);
      setTasks((current) => {
        const index = current.findIndex((item) => item.id === nextTask.id);
        if (index === -1) {
          return sortTasks([nextTask, ...current]);
        }
        const next = [...current];
        next[index] = nextTask;
        return sortTasks(next);
      });
      setStatus({ kind: "connected", message: existingTask ? "Task updated." : "Task added." });
      return nextTask;
    } catch (error) {
      setStatus({ kind: "error", message: `Save failed. ${error.message}` });
      return null;
    }
  }, [categories]);

  const toggleTask = useCallback(async (taskId) => {
    const existingTask = tasks.find((item) => item.id === taskId);
    if (!existingTask) {
      return;
    }

    const nextCompleted = !existingTask.completed;
    const category = getCategoryById(categories, existingTask.categoryId);

    try {
      setStatus({ kind: "loading", message: "Updating task..." });
      const response = await apiRequest("save", {
        task: {
          id: existingTask.id,
          title: existingTask.title,
          notes: existingTask.description,
          category: existingTask.priority,
          broadHeadId: category?.id || "",
          broadHeadTitle: category?.name || "",
          dueAt: existingTask.dueAt,
          status: nextCompleted ? "completed" : "open",
          createdAt: existingTask.createdAt,
          completedAt: nextCompleted ? new Date().toISOString() : "",
        },
      });
      const nextTask = taskToViewModel(response.task, categories);
      setTasks((current) => sortTasks(current.map((item) => (item.id === taskId ? nextTask : item))));
      setStatus({ kind: "connected", message: "Task updated." });
    } catch (error) {
      setStatus({ kind: "error", message: `Update failed. ${error.message}` });
    }
  }, [categories, tasks]);

  const deleteTask = useCallback(async (taskId) => {
    try {
      setStatus({ kind: "loading", message: "Deleting task..." });
      await apiRequest("delete", { id: taskId });
      setTasks((current) => current.filter((item) => item.id !== taskId));
      setStatus({ kind: "connected", message: "Task deleted." });
      return true;
    } catch (error) {
      setStatus({ kind: "error", message: `Delete failed. ${error.message}` });
      return false;
    }
  }, []);

  const addCategory = useCallback(async (draft) => {
    const payload = {
      title: String(draft.name || "").trim(),
      notes: JSON.stringify({
        emoji: String(draft.emoji || "📁").trim(),
        color: String(draft.color || "#4a84d8").trim(),
        system: false,
      }),
    };

    if (!payload.title) {
      setStatus({ kind: "error", message: "Category name is required." });
      return null;
    }

    try {
      setStatus({ kind: "loading", message: "Creating category..." });
      const response = await apiRequest("saveHead", { head: payload });
      const nextCategory = parseCategoryRecord(response.broadHead);
      setCategories((current) => [...current, nextCategory].sort((left, right) => left.name.localeCompare(right.name)));
      setStatus({ kind: "connected", message: "Category created." });
      return nextCategory;
    } catch (error) {
      setStatus({ kind: "error", message: `Save failed. ${error.message}` });
      return null;
    }
  }, []);

  const deleteCategory = useCallback(async (categoryId) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return false;
    }
    if (category.system) {
      setStatus({ kind: "error", message: "Default categories cannot be deleted." });
      return false;
    }

    const tasksToRemove = tasks.filter((task) => task.categoryId === categoryId);

    try {
      setStatus({ kind: "loading", message: "Deleting category..." });
      for (const task of tasksToRemove) {
        await apiRequest("delete", { id: task.id });
      }
      await apiRequest("deleteHead", { id: categoryId });
      setTasks((current) => current.filter((task) => task.categoryId !== categoryId));
      setCategories((current) => current.filter((item) => item.id !== categoryId));
      setStatus({ kind: "connected", message: "Category deleted." });
      return true;
    } catch (error) {
      setStatus({ kind: "error", message: `Delete failed. ${error.message}` });
      return false;
    }
  }, [categories, tasks]);

  const resetPlanner = useCallback(async () => {
    try {
      setStatus({ kind: "loading", message: "Resetting planner data..." });
      const response = await apiRequest("resetPlanner");
      applyRemoteState(response);
      setJournalCache(new Map());
      setStatus({ kind: "connected", message: "Planner reset." });
      return true;
    } catch (error) {
      setStatus({ kind: "error", message: `Reset failed. ${error.message}` });
      return false;
    }
  }, [applyRemoteState]);

  // Load full journal entry for a date (cached)
  const loadJournalForDate = useCallback(async (date) => {
    if (journalCache.has(date)) {
      return journalCache.get(date);
    }

    try {
      const response = await apiRequest("getJournal", { date });
      const journal = response.journal ? parseJournalRecord(response.journal) : null;
      setJournalCache((current) => new Map(current).set(date, journal));
      return journal;
    } catch {
      return null;
    }
  }, [journalCache]);

  const saveJournal = useCallback(async (date, outcomes, reflection) => {
    setStatus({ kind: "loading", message: "Saving journal..." });
    try {
      const response = await apiRequest("saveJournal", {
        journal: { date, reflection, outcomes },
      });

      const savedJournal = parseJournalRecord(response.journal);

      // Update journal cache
      setJournalCache((current) => new Map(current).set(date, savedJournal));

      // Update journal summary for calendar indicators
      setJournalSummaries((current) => {
        const next = new Map(current);
        next.set(date, {
          date,
          doneCount: savedJournal.doneCount,
          missedCount: savedJournal.missedCount,
        });
        return next;
      });

      // Apply rolled-over tasks back into local task state
      if (Array.isArray(response.updatedTasks) && response.updatedTasks.length > 0) {
        setTasks((current) => {
          let next = [...current];
          for (const raw of response.updatedTasks) {
            const updated = taskToViewModel(raw, categories);
            const idx = next.findIndex((t) => t.id === updated.id);
            if (idx !== -1) {
              next[idx] = updated;
            }
          }
          return sortTasks(next);
        });
      }

      setStatus({ kind: "connected", message: "Journal saved." });
      return savedJournal;
    } catch (error) {
      setStatus({ kind: "error", message: `Journal save failed. ${error.message}` });
      return null;
    }
  }, [categories]);

  const taskCounts = useMemo(() => {
    const pending = tasks.filter((task) => !task.completed).length;
    const completed = tasks.length - pending;
    const completedToday = tasks.filter((task) => task.completed && task.completedAt && toDateKey(task.completedAt) === toDateKey(new Date())).length;
    return { pending, completed, completedToday };
  }, [tasks]);

  return {
    tasks,
    categories,
    loading,
    status,
    taskCounts,
    journalSummaries,
    journalCache,
    syncPlanner,
    saveTask,
    toggleTask,
    deleteTask,
    addCategory,
    deleteCategory,
    resetPlanner,
    saveJournal,
    loadJournalForDate,
  };
}
