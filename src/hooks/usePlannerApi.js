import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_ENDPOINT, REMINDER_LOG_KEY, SETTINGS_KEY } from "../constants";
import {
  canonicalCategoryId,
  categoryById,
  normalizeBroadHeadRecord,
  normalizeTaskRecord,
  safeParse,
  sortBroadHeads,
  sortTasks,
} from "../helpers";

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

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });

  return handleApiResponse(response);
}

export function usePlannerApi() {
  const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), {});
  const [tasks, setTasks] = useState([]);
  const [broadHeads, setBroadHeads] = useState([]);
  const [profileName, setProfileName] = useState(savedSettings.profileName || "Operator");
  const [status, setStatus] = useState({
    kind: "configured",
    message: "Planner ready.",
  });
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const reminderTimers = useRef(new Map());

  const applyRemoteState = useCallback((response) => {
    const nextBroadHeads = sortBroadHeads((response.broadHeads || []).map(normalizeBroadHeadRecord));
    const nextTasks = sortTasks(
      (response.tasks || []).map((task) => normalizeTaskRecord(task, nextBroadHeads))
    );
    setBroadHeads(nextBroadHeads);
    setTasks(nextTasks);
  }, []);

  const syncTasks = useCallback(async () => {
    if (window.location.protocol === "file:") {
      setStatus({
        kind: "error",
        message: "Run this app with Netlify or Vite. Serverless sync is not available from a file URL.",
      });
      setLoading(false);
      return;
    }

    setStatus({
      kind: "loading",
      message: "Syncing planner from Google Sheets...",
    });

    try {
      const response = await apiRequest("list");
      applyRemoteState(response);
      setStatus({
        kind: "connected",
        message: `${response.broadHeads?.length || 0} broad heads and ${response.tasks?.length || 0} tasks loaded.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Sync failed. ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [applyRemoteState]);

  useEffect(() => {
    syncTasks();
  }, [syncTasks]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ profileName }));
  }, [profileName]);

  useEffect(() => {
    reminderTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    reminderTimers.current.clear();

    if (!("Notification" in window) || notificationPermission !== "granted") {
      return undefined;
    }

    const sentReminders = safeParse(localStorage.getItem(REMINDER_LOG_KEY), {});

    tasks
      .filter((task) => task.status !== "completed" && task.dueAt)
      .forEach((task) => {
        const dueAt = new Date(task.dueAt).getTime();
        const reminderKey = `${task.id}:${task.dueAt}`;
        if (!Number.isFinite(dueAt) || dueAt <= Date.now() || sentReminders[reminderKey]) {
          return;
        }

        const timerId = window.setTimeout(() => {
          new Notification("Task due now", {
            body: `${task.title} - ${categoryById(task.category).label}`,
          });
          sentReminders[reminderKey] = true;
          localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(sentReminders));
        }, dueAt - Date.now());

        reminderTimers.current.set(reminderKey, timerId);
      });

    return () => {
      reminderTimers.current.forEach((timerId) => window.clearTimeout(timerId));
      reminderTimers.current.clear();
    };
  }, [notificationPermission, tasks]);

  const saveProfileName = useCallback((nextName) => {
    setProfileName(String(nextName || "Operator").trim() || "Operator");
    setStatus({
      kind: "configured",
      message: "Workspace name saved.",
    });
  }, []);

  const saveTask = useCallback(async (draft, existingTask = null) => {
    if (window.location.protocol === "file:") {
      setStatus({
        kind: "error",
        message: "Run this app with Netlify or Vite before changing tasks.",
      });
      return null;
    }

    const payload = {
      id: existingTask?.id || draft.id || "",
      title: String(draft.title || "").trim(),
      notes: String(draft.notes || "").trim(),
      category: categoryById(draft.category || draft.categoryId).label,
      broadHeadId: String(draft.broadHeadId || "").trim(),
      dueAt: String(draft.dueAt || "").trim(),
      status: existingTask?.status === "completed" ? "completed" : draft.status === "completed" ? "completed" : "open",
      createdAt: existingTask?.createdAt || draft.createdAt || "",
      completedAt: existingTask?.status === "completed" ? existingTask.completedAt : draft.status === "completed" ? draft.completedAt || "" : "",
    };

    if (!payload.title || !payload.dueAt) {
      setStatus({
        kind: "error",
        message: "Task title and due date are required.",
      });
      return null;
    }

    setStatus({
      kind: "loading",
      message: existingTask ? "Updating task..." : "Saving task...",
    });

    try {
      const response = await apiRequest("save", { task: payload });
      const nextTask = normalizeTaskRecord(response.task, broadHeads);
      setTasks((current) => {
        const index = current.findIndex((item) => item.id === nextTask.id);
        if (index === -1) {
          return sortTasks([...current, nextTask]);
        }
        const next = [...current];
        next[index] = nextTask;
        return sortTasks(next);
      });
      setStatus({
        kind: "connected",
        message: existingTask ? "Task updated." : "Task created.",
      });
      return response.task;
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Save failed. ${error.message}`,
      });
      return null;
    }
  }, [broadHeads]);

  const toggleTaskCompletion = useCallback(async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const nextStatus = task.status === "completed" ? "open" : "completed";
    setStatus({
      kind: "loading",
      message: "Updating task status...",
    });

    try {
      const response = await apiRequest("save", {
        task: {
          ...task,
          category: categoryById(task.category).label,
          status: nextStatus,
          completedAt: nextStatus === "completed" ? new Date().toISOString() : "",
        },
      });
      const nextTask = normalizeTaskRecord(response.task, broadHeads);
      setTasks((current) => sortTasks(current.map((item) => (
        item.id === taskId ? nextTask : item
      ))));
      setStatus({
        kind: "connected",
        message: "Task updated.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Status change failed. ${error.message}`,
      });
    }
  }, [broadHeads, tasks]);

  const deleteTask = useCallback(async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return false;
    }

    setStatus({
      kind: "loading",
      message: "Deleting task...",
    });

    try {
      await apiRequest("delete", { id: taskId });
      setTasks((current) => current.filter((item) => item.id !== taskId));
      setStatus({
        kind: "connected",
        message: "Task deleted.",
      });
      return true;
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Delete failed. ${error.message}`,
      });
      return false;
    }
  }, [tasks]);

  const saveBroadHead = useCallback(async (draft, existingHead = null) => {
    if (window.location.protocol === "file:") {
      setStatus({
        kind: "error",
        message: "Run this app with Netlify or Vite before changing broad heads.",
      });
      return null;
    }

    const payload = {
      id: existingHead?.id || draft.id || "",
      title: String(draft.title || "").trim(),
      notes: String(draft.notes || "").trim(),
    };

    if (!payload.title) {
      setStatus({
        kind: "error",
        message: "Broad head title is required.",
      });
      return null;
    }

    setStatus({
      kind: "loading",
      message: existingHead ? "Updating broad head..." : "Saving broad head...",
    });

    try {
      const response = await apiRequest("saveHead", { head: payload });
      const nextHead = normalizeBroadHeadRecord(response.broadHead);
      setBroadHeads((current) => {
        const index = current.findIndex((item) => item.id === nextHead.id);
        const next = [...current];
        if (index === -1) {
          next.push(nextHead);
        } else {
          next[index] = nextHead;
        }
        return sortBroadHeads(next);
      });
      setTasks((current) => current.map((task) => (
        task.broadHeadId === nextHead.id
          ? { ...task, broadHeadTitle: nextHead.title }
          : task
      )));
      setStatus({
        kind: "connected",
        message: "Broad head saved.",
      });
      return response.broadHead;
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Save failed. ${error.message}`,
      });
      return null;
    }
  }, []);

  const deleteBroadHead = useCallback(async (headId) => {
    const linkedTasks = tasks.filter((task) => task.broadHeadId === headId);
    if (linkedTasks.length) {
      setStatus({
        kind: "error",
        message: "This broad head still has tasks. Reassign or delete them first.",
      });
      return false;
    }

    setStatus({
      kind: "loading",
      message: "Deleting broad head...",
    });

    try {
      await apiRequest("deleteHead", { id: headId });
      setBroadHeads((current) => current.filter((item) => item.id !== headId));
      setStatus({
        kind: "connected",
        message: "Broad head deleted.",
      });
      return true;
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Delete failed. ${error.message}`,
      });
      return false;
    }
  }, [tasks]);

  const enableNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setStatus({
        kind: "error",
        message: "This browser does not support notifications.",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setStatus({
      kind: permission === "granted" ? "connected" : "configured",
      message: permission === "granted"
        ? "Reminders enabled."
        : permission === "denied"
          ? "Notifications are blocked in the browser."
          : "Notifications are not enabled yet.",
    });
  }, []);

  const taskCounts = useMemo(() => ({
    pending: tasks.filter((task) => task.status !== "completed").length,
    completed: tasks.filter((task) => task.status === "completed").length,
  }), [tasks]);

  const categoryCounts = useMemo(() => {
    return tasks.reduce((accumulator, task) => {
      const key = canonicalCategoryId(task.category);
      accumulator[key] = (accumulator[key] || 0) + (task.status === "completed" ? 0 : 1);
      return accumulator;
    }, {});
  }, [tasks]);

  return {
    tasks,
    broadHeads,
    profileName,
    loading,
    status,
    notificationPermission,
    taskCounts,
    categoryCounts,
    syncTasks,
    saveProfileName,
    saveTask,
    toggleTaskCompletion,
    deleteTask,
    saveBroadHead,
    deleteBroadHead,
    enableNotifications,
  };
}
