import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { PRIORITY_ORDER } from "./plannerConstants";
import { combineDueAt, priorityById, splitDueAt } from "./plannerModel";

export default function TaskForm({ task, categories, onClose, onSubmit, onDelete }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [priority, setPriority] = useState("open");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [isEvent, setIsEvent] = useState(false);

  useEffect(() => {
    if (!task) {
      setTitle("");
      setDescription("");
      setCategoryId(categories[0]?.id || "");
      setPriority("open");
      setDueDate("");
      setDueTime("");
      setIsEvent(false);
      return;
    }

    const due = splitDueAt(task.dueAt);
    setTitle(task.title || "");
    setDescription(task.description || "");
    setCategoryId(task.categoryId || categories[0]?.id || "");
    setPriority(task.priority || "open");
    setDueDate(due.dueDate);
    setDueTime(due.dueTime);
    setIsEvent(task.categoryId === "events");
  }, [categories, task]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    onSubmit({
      id: task?.id || "",
      title: title.trim(),
      description: description.trim(),
      categoryId,
      priority,
      dueDate,
      dueTime,
      dueAt: combineDueAt(dueDate, dueTime),
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
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-panel__header">
            <h2>{task ? "Edit Task" : "New Task"}</h2>
            <button type="button" className="sheet-panel__close" onClick={onClose} aria-label="Close task form">
              <X size={20} />
            </button>
          </div>

          <form className="sheet-form" onSubmit={handleSubmit}>
            <input
              className="sheet-form__input sheet-form__input--title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />

            <textarea
              className="sheet-form__textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
                    onClick={() => {
                      setCategoryId(category.id);
                      setIsEvent(category.id === "events");
                    }}
                  >
                    <span>{category.emoji}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

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
                      onClick={() => setPriority(priorityId)}
                      style={priority === priorityId ? { backgroundColor: meta.color, borderColor: meta.color } : undefined}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sheet-form__row">
              <label className="sheet-form__field">
                <span>Due date</span>
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
              {(isEvent || dueDate) ? (
                <label className="sheet-form__field">
                  <span>Time</span>
                  <input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
                </label>
              ) : null}
            </div>

            <label className="sheet-form__toggle">
              <input type="checkbox" checked={isEvent} onChange={(event) => setIsEvent(event.target.checked)} />
              <span>This is an event or meeting</span>
            </label>

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
