import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Infinity, X } from "lucide-react";
import { PRIORITY_ORDER } from "./plannerConstants";
import {
  combineDueAt,
  dueDateFromPriority,
  priorityById,
  priorityFromDueDate,
  resolveTaskPriority,
  splitDueAt,
} from "./plannerModel";

export default function TaskForm({ task, categories, onClose, onSubmit, onDelete }) {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [priority, setPriority] = useState("open");
  const [deadlineMode, setDeadlineMode] = useState(null); // null | "date" | "open"
  const [deadlineError, setDeadlineError] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueDateError, setDueDateError] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [isEvent, setIsEvent] = useState(false);

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
  }, [categories, task]);

  // User picked a date → auto-set priority
  function handleDueDateChange(value) {
    setDueDate(value);
    setDueDateError(false);
    if (value) {
      setPriority(priorityFromDueDate(value, dueTime));
    }
  }

  // User changed time → re-derive priority (urgent threshold depends on time)
  function handleDueTimeChange(value) {
    setDueTime(value);
    if (dueDate) {
      setPriority(priorityFromDueDate(dueDate, value));
    }
  }

  // User picked a priority → auto-set date (or switch to open)
  function handlePriorityChange(id) {
    setPriority(id);
    const autoDate = dueDateFromPriority(id);
    if (autoDate) {
      setDueDate(autoDate);
      setDueDateError(false);
      setDeadlineMode("date");
      setDeadlineError(false);
    } else {
      // open / leisure → clear date, switch to open mode
      setDueDate("");
      setDueTime("");
      setDeadlineMode("open");
      setDeadlineError(false);
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
              rows={3}
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

            {/* Priority — auto-sets deadline */}
            <div className="sheet-form__group">
              <label>
                Priority
                <span className="sheet-form__hint">sets deadline automatically</span>
              </label>
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
            </div>

            {/* Deadline — required, auto-sets priority */}
            <div className="sheet-form__group">
              <label>
                Deadline <span className="sheet-form__required">*</span>
                <span className="sheet-form__hint">sets priority automatically</span>
              </label>

              <div className="deadline-choice-row">
                <button
                  type="button"
                  className={`deadline-choice-btn ${deadlineMode === "date" ? "is-active" : ""}`}
                  onClick={() => handleDeadlineMode("date")}
                >
                  <CalendarDays size={16} />
                  Set a date
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
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="sheet-form__row" style={{ marginTop: 10 }}>
                      <label className="sheet-form__field">
                        <span>
                          Date{dueDateError ? <span className="sheet-form__required"> required</span> : null}
                        </span>
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
