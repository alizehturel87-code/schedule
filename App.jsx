import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Maximize, Minimize, Plus, RefreshCw } from "lucide-react";
import BottomNav from "./BottomNav";
import CalendarView from "./CalendarView";
import CategoryForm from "./CategoryForm";
import CategoryView from "./CategoryView";
import AnalysisView from "./AnalysisView";
import JournalEntrySheet from "./JournalEntrySheet";
import JournalView from "./JournalView";
import PriorityView from "./PriorityView";
import TaskForm from "./TaskForm";
import { usePlannerApi } from "./plannerApi";
import { getHeaderDateLabel } from "./plannerModel";

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

export default function App() {
  const [activeView, setActiveView] = useState("priority");
  const [editingTask, setEditingTask] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [journalDate, setJournalDate] = useState(null);
  const [journalEntry, setJournalEntry] = useState(null);
  const [journalSaving, setJournalSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplay());
  const [isWallMode, setIsWallMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("planner-wall-mode") === "1";
  });
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef(null);

  const {
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
    saveJournal,
    loadJournalForDate,
  } = usePlannerApi();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) {
      return;
    }

    try {
      await wakeLockRef.current.release();
    } catch {
      // Ignore browsers that auto-release when hidden.
    } finally {
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!isWallMode || !("wakeLock" in navigator)) {
      setWakeLockActive(false);
      return;
    }

    try {
      const wakeLock = await navigator.wakeLock.request("screen");
      wakeLockRef.current = wakeLock;
      setWakeLockActive(true);
      wakeLock.addEventListener("release", () => {
        if (wakeLockRef.current === wakeLock) {
          wakeLockRef.current = null;
        }
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, [isWallMode]);

  useEffect(() => {
    window.localStorage.setItem("planner-wall-mode", isWallMode ? "1" : "0");
    document.body.classList.toggle("planner-body--wall-mode", isWallMode);

    return () => {
      document.body.classList.remove("planner-body--wall-mode");
    };
  }, [isWallMode]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    const handleStandaloneChange = () => {
      setIsInstalled(isStandaloneDisplay());
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const displayMode = window.matchMedia?.("(display-mode: standalone)");

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("fullscreenchange", handleFullscreenChange);
    displayMode?.addEventListener?.("change", handleStandaloneChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("fullscreenchange", handleFullscreenChange);
      displayMode?.removeEventListener?.("change", handleStandaloneChange);
    };
  }, []);

  useEffect(() => {
    if (!isWallMode) {
      void releaseWakeLock();
      return undefined;
    }

    void requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [isWallMode, releaseWakeLock, requestWakeLock]);

  async function handleTaskSubmit(taskDraft) {
    const existingTask = taskDraft.id ? tasks.find((item) => item.id === taskDraft.id) : null;
    const saved = await saveTask(taskDraft, existingTask || null);
    if (saved) {
      setEditingTask(null);
    }
  }

  async function handleDeleteTask(taskId) {
    const task = tasks.find((item) => item.id === taskId);
    const shouldDelete = window.confirm(`Delete "${task?.title || "this task"}"?`);
    if (!shouldDelete) {
      return;
    }
    const deleted = await deleteTask(taskId);
    if (deleted) {
      setEditingTask(null);
    }
  }

  async function handleAddCategory(draft) {
    const saved = await addCategory(draft);
    if (saved) {
      setShowCategoryForm(false);
    }
  }

  async function handleDeleteCategory(categoryId) {
    const category = categories.find((item) => item.id === categoryId);
    const shouldDelete = window.confirm(`Delete category "${category?.name || "this category"}" and all its tasks?`);
    if (!shouldDelete) {
      return;
    }
    await deleteCategory(categoryId);
  }

  const handleOpenJournal = useCallback(async (date) => {
    setJournalDate(date);
    setJournalEntry(null);
    // Load existing journal if one exists
    const existing = await loadJournalForDate(date);
    setJournalEntry(existing || null);
  }, [loadJournalForDate]);

  function handleCloseJournal() {
    setJournalDate(null);
    setJournalEntry(null);
  }

  async function handleJournalSubmit(date, outcomes, reflection) {
    setJournalSaving(true);
    const saved = await saveJournal(date, outcomes, reflection);
    setJournalSaving(false);
    if (saved) {
      setJournalDate(null);
      setJournalEntry(null);
    }
  }

  async function handleInstallApp() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
    if (choice?.outcome === "accepted") {
      setIsInstalled(true);
    }
  }

  async function handleToggleWallMode() {
    const nextWallMode = !isWallMode;
    setIsWallMode(nextWallMode);

    if (nextWallMode) {
      setActiveView("calendar");
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // Fullscreen can fail if the browser blocks it; wall mode still keeps the wider layout.
        }
      }
      return;
    }

    await releaseWakeLock();

    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore exit failures and leave layout mode toggled off.
      }
    }
  }

  const showDesktopCard = !isInstalled || isWallMode;

  return (
    <div className={`planner-app ${isWallMode ? "is-wall-mode" : ""}`}>
      <header className="planner-header">
        <div className="planner-header__inner">
          <div className="planner-header__top">
            <div>
              <p className="planner-header__date">{getHeaderDateLabel()}</p>
              <h1>My Planner</h1>
              <div className="planner-header__badges">
                <span>{taskCounts.pending} pending</span>
                <span>{taskCounts.completedToday} done today</span>
              </div>
            </div>
            <div className="planner-header__actions">
              <button
                type="button"
                className="header-icon-btn"
                onClick={handleToggleWallMode}
                aria-label={isWallMode ? "Exit wall mode" : "Enter wall mode"}
                title={isWallMode ? "Exit wall mode" : "Enter wall mode"}
              >
                {isWallMode ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
              {!isInstalled && installPrompt ? (
                <button
                  type="button"
                  className="header-icon-btn"
                  onClick={handleInstallApp}
                  aria-label="Install planner app"
                  title="Install planner app"
                >
                  <Download size={18} />
                </button>
              ) : null}
              <button type="button" className="header-icon-btn" onClick={syncPlanner} aria-label="Sync planner">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {showDesktopCard ? (
            <section className="desktop-panel">
              <div className="desktop-panel__copy">
                <p className="desktop-panel__eyebrow">Desktop Planner</p>
                <h2>{isWallMode ? "Wall mode is on" : "Install this planner on your desktop"}</h2>
                <p className="desktop-panel__text">
                  {isInstalled
                    ? wakeLockActive
                      ? "The app is running in wall mode and the screen will stay awake while it stays visible."
                      : "Wall mode uses a fullscreen layout and will keep the display awake when your browser allows it."
                    : "Install this app from Chrome or Edge, then keep it open like a pinned wall planner instead of a browser tab."}
                </p>
                {!isInstalled && !installPrompt ? (
                  <p className="desktop-panel__hint">If you do not see the install button, use the browser menu and choose Install app.</p>
                ) : null}
              </div>

              <div className="desktop-panel__actions">
                {!isInstalled && installPrompt ? (
                  <button type="button" className="btn btn--primary" onClick={handleInstallApp}>
                    <Download size={16} />
                    Install app
                  </button>
                ) : null}
                <button type="button" className="btn btn--secondary" onClick={handleToggleWallMode}>
                  {isWallMode ? <Minimize size={16} /> : <Maximize size={16} />}
                  {isWallMode ? "Exit wall mode" : "Open wall mode"}
                </button>
                <span className="desktop-panel__status">
                  {isFullscreen
                    ? "Fullscreen is active."
                    : isWallMode
                      ? "Layout is pinned wide even if fullscreen is blocked."
                      : "Wall mode switches the app into a desk-friendly fullscreen layout."}
                </span>
              </div>
            </section>
          ) : null}
        </div>
      </header>

      <div className="planner-shell">
        <BottomNav activeView={activeView} onViewChange={setActiveView} />

        <main className="planner-main">
          {loading ? (
            <div className="loading-state">Loading planner...</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
              >
                {activeView === "calendar" ? (
                  <CalendarView
                    tasks={tasks}
                    categories={categories}
                    now={currentTime}
                    onToggle={toggleTask}
                    onDeleteTask={handleDeleteTask}
                    onEditTask={setEditingTask}
                    journalSummaries={journalSummaries}
                    onOpenJournal={handleOpenJournal}
                  />
                ) : null}

                {activeView === "priority" ? (
                  <PriorityView
                    tasks={tasks}
                    categories={categories}
                    now={currentTime}
                    onToggle={toggleTask}
                    onDeleteTask={handleDeleteTask}
                    onEditTask={setEditingTask}
                  />
                ) : null}

                {activeView === "category" ? (
                  <CategoryView
                    tasks={tasks}
                    categories={categories}
                    now={currentTime}
                    onToggle={toggleTask}
                    onDeleteTask={handleDeleteTask}
                    onEditTask={setEditingTask}
                    onDeleteCategory={handleDeleteCategory}
                    onAddCategory={() => setShowCategoryForm(true)}
                  />
                ) : null}

                {activeView === "journal" ? (
                  <JournalView
                    journalSummaries={journalSummaries}
                    journalCache={journalCache}
                    tasks={tasks}
                    onOpenJournal={handleOpenJournal}
                  />
                ) : null}

                {activeView === "analysis" ? (
                  <AnalysisView tasks={tasks} categories={categories} />
                ) : null}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      <button type="button" className="planner-fab" onClick={() => setEditingTask({})} aria-label="Add task">
        <Plus size={24} />
      </button>

      {editingTask !== null ? (
        <TaskForm
          task={editingTask.id ? editingTask : null}
          categories={categories}
          onClose={() => setEditingTask(null)}
          onSubmit={handleTaskSubmit}
          onDelete={handleDeleteTask}
        />
      ) : null}

      {showCategoryForm ? (
        <CategoryForm
          onClose={() => setShowCategoryForm(false)}
          onSubmit={handleAddCategory}
        />
      ) : null}

      {journalDate ? (
        <JournalEntrySheet
          date={journalDate}
          tasks={tasks}
          categories={categories}
          existingJournal={journalEntry}
          onClose={handleCloseJournal}
          onSubmit={handleJournalSubmit}
          saving={journalSaving}
        />
      ) : null}

      {status.message ? <div className={`status-banner status-banner--${status.kind}`}>{status.message}</div> : null}
    </div>
  );
}
