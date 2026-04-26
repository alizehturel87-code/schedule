import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Infinity, X } from "lucide-react";
import { PRIORITY_ORDER } from "./plannerConstants";
import {
  combineDueAt,
  dueDateFromPriority,
  formatTaskDueLabel,
  parseDueAt,
  priorityById,
  priorityFromDueDate,
  resolveTaskPriority,
  splitDueAt,
} from "./plannerModel";

function formatAutoHintDate(dateKey) {
  if (!dateKey) return null;
  const date = parseDueAt(dateKey);
  if (!date) return null;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
}

export default function TaskForm({ task, categories, onClose, onSubmit, onDelete }) {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [priority, setPriority] = useState("open");
  const [deadlineMode, setDeadlineMode] = useState(null);
  const [deadlineError, setDeadlineError] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueDateError, setDueDateError] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [isEvent, setIsEvent] = useState(false);

  // Inline sync hints
  const [priorityAutoHint, setPriorityAutoHint] = useState(""); // shown under priority when date sets it
  const [deadlineAutoHint, setDeadlineAutoHint] = useState(""); // shown under deadline when priority sets it
  const hintTimerRef = useRef(null);

  function showDeadlineAutoHint(dateKey, mode) {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (mode === "open") {
      setDeadlineAutoHint("Switched to Keep open");
    } else {
      const label = formatAutoHintDate(dateKey);
      setDeadlineAutoHint(label ? `Deadline set to ${label}` : "");
    }
    hintTimerRef.current = setTimeout(() => setDeadlineAutoHint(""), 3000);
  }

  function showPriorityAutoHint(priorityId) {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    const meta = priorityById(priorityId);
    setPriorityAutoHint(`Priority set to ${meta.shortLabel}`);
    hintTimerRef.current = setTimeout(() => setPriorityAutoHint(""), 3000);
  }

  useEffect(() => {
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!task) {
      setTitle(""); setTitleError(false);
      setDescription("");
      setCategoryId(categories[0]?.id || "");
      setPriority("open");
      setDeadlineMode(null); setDeadlineError(false);
      setDueDate(""); setDueDateError(false);
      setDueTime("");
      setIsEvent(false);
      setPriorityAutoHint(""); setDeadlineAutoHint("");
      return;
    }

    const due = splitDueAt(task.dueAt);
    setTitle(task.title || ""); setTitleError(false);
    setDescription(task.description || "");
    setCategoryId(task.categoryId || categories[0]?.id || "");
    setPriority(resolveTaskPriority(task));
    setDeadlineMode(task.dueAt ? "date" : "open"); setDeadlineError(false);
    setDueDate(due.dueDate); setDueDateError(false);
    setDueTime(due.dueTime);
    setIsEvent(task.categoryId === "events");
    setPriorityAutoHint(""); setDeadlineAutoHint("");
  }, [categories, task]);

  // User picked a date → auto-set priority
  function handleDueDateChange(value) {
    setDueDate(value);
    setDueDateError(false);
    if (value) {
      const autoPriority = priorityFromDueDate(value, dueTime);
      setPriority(autoPriority);
      showPriorityAutoHint(autoPriority);
    }
  }

  // User changed time → re-derive priority
  function handleDueTimeChange(value) {
    setDueTime(value);
    if (dueDate) {
      const autoPriority = priorityFromDueDate(dueDate, value);
      setPriority(autoPriority);
      showPriorityAutoHint(autoPriority);
    }
  }

  // User picked a priority → auto-set deadline
  function handlePriorityChange(id) {
    setPriority(id);
    const autoDate = dueDateFromPriority(id);
    if (autoDate) {
      setDueDate(autoDate);
      setDueDateError(false);
      setDeadlineMode("date");
      setDeadlineError(false);
      showDeadlineAutoHint(autoDate, "date");
    } else {
      setDueDate("");
      setDueTime("");
      setDeadlineMode("open");
      setDeadlineError(false);
      showDeadlineAutoHint("", "open");
    }
  }

  function handleDeadlineMode(mode) {
    setDeadlineMode(mode);
    setDeadlineError(false);
    if (mode === "open") {
      setDueDate("");
      setDueTime("");
      setDueDateError(false);
      setPriority("open");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    let hasError = false;
    if (!title.trim()) { setTitleError(true); hasError = true; }
    if (deadlineMode === null) { setDeadlineError(true); hasError = true; }
    if (deadlineMode === "date" && !dueDate) { setDueDateError(true); hasError = true; }
    if (hasError) return;

    onSubmit({
      id: task?.id || "",
      title: title.trim(),
      description: description.trim(),
      categoryId,
      priority,
      dueDate: deadlineMode === "date" ? dueDate : "",
      dueTime: deadlineMode === "date" ? dueTime : "",
      dueAt: deadlineMode === "date" ? combineDueAt(dueDate, dueTime) : "",
      completed: task?.completed || false,
      createdAt: task?.createdAt || "",
      completedAt: task?.completedAt || "",
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="sheet-panel"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sheet-panel__header">
            <h2>{task ? "Edit Task" : "New Task"}</h2>
            <button type="button" className="sheet-panel__close" onClick={onClose} aria-label="Close task form">
              <X size={20} />
            </button>
          </div>

          <form className="sheet-form" onSubmit={handleSubmit}>
            <div>
              <input
                className={`sheet-form__input sheet-form__input--title ${titleError ? "has-error" : ""}`}
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
                placeholder="What needs to be done?"
                autoFocus
              />
              {titleError ? <p className="sheet-form__error">Please enter a task name.</p> : null}
            </div>

            <textarea
              className="sheet-form__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
            />

            <div className="sheet-form__group">
              <label>Category</label>
              <div className="choice-row">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`choice-pill ${categoryId === category.id ? "is-active" : ""}`}
                    onClick={() => { setCategoryId(category.id); setIsEvent(category.id === "events"); }}
                  >
                    <span>{category.emoji}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Deadline — shown FIRST so priority change below is visible */}
            <div className="sheet-form__group">
              <label>
                Deadline <span className="sheet-form__required">*</span>
              </label>

              <div className="deadline-choice-row">
                <button
                  type="button"
                  className={`deadline-choice-btn ${deadlineMode === "date" ? "is-active" : ""}`}
                  onClick={() => handleDeadlineMode("date")}
                >
                  <CalendarDays size={16} />
                  {deadlineMode === "date" && dueDate
                    ? formatAutoHintDate(dueDate) || "Set a date"
                    : "Set a date"}
                </button>
                <button
                  type="button"
                  className={`deadline-choice-btn ${deadlineMode === "open" ? "is-active is-open" : ""}`}
                  onClick={() => handleDeadlineMode("open")}
                >
                  <Infinity size={16} />
                  Keep open
                </button>
              </div>

              {deadlineError ? (
                <p className="sheet-form__error">Please set a deadline or choose "Keep open".</p>
              ) : null}

              <AnimatePresence>
                {deadlineMode === "date" ? (
                  <motion.div
                    key="date-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="sheet-form__row" style={{ marginTop: 10 }}>
                      <label className="sheet-form__field">
                        <span>Date{dueDateError ? <span className="sheet-form__required"> required</span> : null}</span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => handleDueDateChange(e.target.value)}
                          className={dueDateError ? "has-error" : ""}
                        />
                      </label>
                      <label className="sheet-form__field">
                        <span>Time (optional)</span>
                        <input
                          type="time"
                          value={dueTime}
                          onChange={(e) => handleDueTimeChange(e.target.value)}
                        />
                      </label>
                    </div>
                    <label className="sheet-form__toggle" style={{ marginTop: 10 }}>
                      <input
                        type="checkbox"
                        checked={isEvent}
                        onChange={(e) => setIsEvent(e.target.checked)}
                      />
                      <span>This is an event or meeting</span>
                    </label>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {priorityAutoHint ? (
                  <motion.p
                    key="priority-hint"
                    className="sheet-form__auto-hint"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ✓ {priorityAutoHint}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Priority — auto-sets deadline, hint confirms what changed */}
            <div className="sheet-form__group">
              <label>Priority</label>
              <div className="priority-grid">
                {PRIORITY_ORDER.map((priorityId) => {
                  const meta = priorityById(priorityId);
                  return (
                    <button
                      key={priorityId}
                      type="button"
                      className={`priority-pill ${priority === priorityId ? "is-active" : ""}`}
                      onClick={() => handlePriorityChange(priorityId)}
                      style={priority === priorityId ? { backgroundColor: meta.color, borderColor: meta.color } : undefined}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {deadlineAutoHint ? (
                  <motion.p
                    key="deadline-hint"
                    className="sheet-form__auto-hint"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ✓ {deadlineAutoHint}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="sheet-form__actions">
              {task ? (
                <button type="button" className="btn btn--secondary btn--danger" onClick={() => onDelete(task.id)}>
                  Delete
                </button>
              ) : null}
              <button type="submit" className="btn btn--primary">
                {task ? "Save Task" : "Add Task"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
