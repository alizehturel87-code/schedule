import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, RefreshCw } from "lucide-react";
import BottomNav from "./BottomNav";
import CalendarView from "./CalendarView";
import CategoryForm from "./CategoryForm";
import CategoryView from "./CategoryView";
import PriorityView from "./PriorityView";
import TaskForm from "./TaskForm";
import { usePlannerApi } from "./plannerApi";
import { getHeaderDateLabel } from "./plannerModel";

export default function App() {
  const [activeView, setActiveView] = useState("priority");
  const [editingTask, setEditingTask] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const {
    tasks,
    categories,
    loading,
    status,
    taskCounts,
    syncPlanner,
    saveTask,
    toggleTask,
    deleteTask,
    addCategory,
    deleteCategory,
  } = usePlannerApi();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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

  return (
    <div className="planner-app">
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
              <button type="button" className="header-icon-btn" onClick={syncPlanner} aria-label="Sync planner">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
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

      {status.message ? <div className={`status-banner status-banner--${status.kind}`}>{status.message}</div> : null}
    </div>
  );
}
