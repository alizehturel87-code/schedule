import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Bell, FolderPlus, PencilLine, Plus, RefreshCw } from "lucide-react";
import BottomNav from "./src/components/BottomNav";
import BroadHeadForm from "./src/components/BroadHeadForm";
import BroadHeadView from "./BroadHeadView";
import CalendarView from "./CalendarView";
import PriorityView from "./PriorityView";
import TaskForm from "./src/components/TaskForm";
import { CATEGORY_META } from "./src/constants";
import {
  dateKey,
  formatHeaderDate,
  getCompletedTodayCount,
  startOfMonth,
} from "./src/helpers";
import { usePlannerApi } from "./src/hooks/usePlannerApi";

export default function App() {
  const [activeView, setActiveView] = useState("priority");
  const [taskDraft, setTaskDraft] = useState(null);
  const [broadHeadDraft, setBroadHeadDraft] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(new Date()));

  const {
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
  } = usePlannerApi();

  const completedToday = useMemo(() => getCompletedTodayCount(tasks), [tasks]);
  const progressPercent = taskCounts.pending + taskCounts.completed
    ? Math.round((taskCounts.completed / (taskCounts.pending + taskCounts.completed)) * 100)
    : 0;

  async function handleTaskSubmit(draft) {
    const existingTask = draft.id ? tasks.find((task) => task.id === draft.id) : null;
    const saved = await saveTask(draft, existingTask);
    if (saved) {
      setTaskDraft(null);
    }
  }

  async function handleTaskDelete(task) {
    const shouldDelete = window.confirm(`Delete "${task.title}"?`);
    if (!shouldDelete) {
      return;
    }
    const deleted = await deleteTask(task.id);
    if (deleted) {
      setTaskDraft(null);
    }
  }

  async function handleBroadHeadSubmit(draft) {
    const existing = draft.id ? broadHeads.find((head) => head.id === draft.id) : null;
    const saved = await saveBroadHead(draft, existing);
    if (saved) {
      setBroadHeadDraft(null);
    }
  }

  async function handleBroadHeadDelete(broadHead) {
    const shouldDelete = window.confirm(`Delete broad head "${broadHead.title}"?`);
    if (!shouldDelete) {
      return;
    }
    const deleted = await deleteBroadHead(broadHead.id);
    if (deleted) {
      setBroadHeadDraft(null);
    }
  }

  function promptForName() {
    const nextName = window.prompt("Workspace name", profileName);
    if (nextName !== null) {
      saveProfileName(nextName);
    }
  }

  function handleMonthChange(offset, explicitDate = null) {
    if (explicitDate) {
      setCurrentMonth(explicitDate);
      return;
    }
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + offset);
    setCurrentMonth(startOfMonth(next));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__top">
          <div>
            <p className="eyebrow">{formatHeaderDate()}</p>
            <h1>Daily Planner Hub</h1>
            <button type="button" className="link-btn" onClick={promptForName}>
              {profileName}
              <PencilLine size={14} />
            </button>
          </div>
          <div className="app-header__actions">
            <button type="button" className="icon-btn" onClick={syncTasks} aria-label="Sync planner">
              <RefreshCw size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={enableNotifications} aria-label="Enable reminders">
              <Bell size={18} />
            </button>
          </div>
        </div>

        <div className="badge-row">
          <span className="badge-chip">{taskCounts.pending} pending</span>
          <span className="badge-chip badge-chip--accent">{completedToday} done today</span>
          <span className={`badge-chip ${notificationPermission === "granted" ? "badge-chip--success" : ""}`}>
            {notificationPermission === "granted" ? "Reminders on" : "Reminders off"}
          </span>
        </div>

        <section className="hero-card">
          <div>
            <p className="hero-card__eyebrow">Overview</p>
            <h2>Your Netlify and Google Sheets backend stays the same. The frontend is fully refreshed.</h2>
          </div>
          <div className="hero-card__stats">
            <div className="stat-card">
              <span>Broad heads</span>
              <strong>{broadHeads.length}</strong>
            </div>
            <div className="stat-card">
              <span>Completion</span>
              <strong>{progressPercent}%</strong>
            </div>
          </div>
        </section>

        <section className="summary-panel">
          {CATEGORY_META.map((category) => (
            <article key={category.id} className="summary-card" style={{ backgroundColor: category.surface }}>
              <div className="summary-card__top">
                <span className="summary-card__dot" style={{ backgroundColor: category.accent }} />
                <span>{category.shortLabel}</span>
              </div>
              <strong style={{ color: category.accent }}>{categoryCounts[category.id] || 0}</strong>
              <p>{category.label}</p>
            </article>
          ))}
        </section>
      </header>

      <main className="app-main">
        {loading ? (
          <section className="view-section">
            <p className="empty-copy">Loading planner data...</p>
          </section>
        ) : activeView === "priority" ? (
          <PriorityView
            tasks={tasks}
            onToggle={toggleTaskCompletion}
            onEditTask={setTaskDraft}
            onDeleteTask={handleTaskDelete}
          />
        ) : activeView === "broad_heads" ? (
          <BroadHeadView
            tasks={tasks}
            broadHeads={broadHeads}
            onToggle={toggleTaskCompletion}
            onEditTask={setTaskDraft}
            onDeleteTask={handleTaskDelete}
            onCreateBroadHead={() => setBroadHeadDraft({})}
            onEditBroadHead={(headId) => setBroadHeadDraft(broadHeads.find((head) => head.id === headId) || null)}
          />
        ) : (
          <CalendarView
            currentMonth={currentMonth}
            selectedDateKey={selectedDateKey}
            tasks={tasks}
            onMonthChange={handleMonthChange}
            onSelectDate={setSelectedDateKey}
            onToggle={toggleTaskCompletion}
            onEditTask={setTaskDraft}
            onDeleteTask={handleTaskDelete}
          />
        )}
      </main>

      <button
        type="button"
        className="fab"
        onClick={() => {
          if (activeView === "broad_heads") {
            setBroadHeadDraft({});
            return;
          }
          setTaskDraft({});
        }}
        aria-label={activeView === "broad_heads" ? "Add broad head" : "Add task"}
      >
        {activeView === "broad_heads" ? <FolderPlus size={24} /> : <Plus size={24} />}
      </button>

      <BottomNav activeView={activeView} onViewChange={setActiveView} />

      <AnimatePresence>
        {taskDraft !== null ? (
          <TaskForm
            broadHeads={broadHeads}
            task={taskDraft.id ? taskDraft : null}
            onClose={() => setTaskDraft(null)}
            onSubmit={handleTaskSubmit}
            onDelete={handleTaskDelete}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {broadHeadDraft !== null ? (
          <BroadHeadForm
            broadHead={broadHeadDraft.id ? broadHeadDraft : null}
            onClose={() => setBroadHeadDraft(null)}
            onSubmit={handleBroadHeadSubmit}
            onDelete={handleBroadHeadDelete}
          />
        ) : null}
      </AnimatePresence>

      <div className={`status-toast status-toast--${status.kind}`}>{status.message}</div>
    </div>
  );
}
