import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { CATEGORY_META } from "../constants";
import { canonicalCategoryId, isoToLocalInput } from "../helpers";

export default function TaskForm({
  broadHeads,
  task,
  onClose,
  onSubmit,
  onDelete,
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState(CATEGORY_META[0].id);
  const [broadHeadId, setBroadHeadId] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (!task) {
      setTitle("");
      setNotes("");
      setCategory(CATEGORY_META[0].id);
      setBroadHeadId("");
      setDueAt("");
      return;
    }

    setTitle(task.title || "");
    setNotes(task.notes || "");
    setCategory(canonicalCategoryId(task.category));
    setBroadHeadId(task.broadHeadId || "");
    setDueAt(isoToLocalInput(task.dueAt));
  }, [task]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      id: task?.id || "",
      title,
      notes,
      category,
      broadHeadId,
      dueAt,
      status: task?.status || "open",
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
          className="sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet__header">
            <div>
              <p className="sheet__eyebrow">{task ? "Update task" : "Create task"}</p>
              <h2>{task ? "Edit Task" : "New Task"}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close task form">
              <X size={20} />
            </button>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Task title</span>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to get done?"
                maxLength={120}
                required
              />
            </label>

            <label className="form-field">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional details"
                rows={4}
              />
            </label>

            <div className="form-field">
              <span>Category</span>
              <div className="chip-grid">
                {CATEGORY_META.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`choice-chip ${category === item.id ? "is-active" : ""}`}
                    onClick={() => setCategory(item.id)}
                    style={category === item.id ? { backgroundColor: item.accent, borderColor: item.accent } : undefined}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="form-field">
              <span>Broad head</span>
              <select value={broadHeadId} onChange={(event) => setBroadHeadId(event.target.value)}>
                <option value="">No broad head</option>
                {broadHeads.map((head) => (
                  <option key={head.id} value={head.id}>
                    {head.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Due date and time</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                required
              />
            </label>

            <div className="sheet__actions">
              {task ? (
                <button type="button" className="btn btn--ghost btn--danger" onClick={() => onDelete(task)}>
                  Delete
                </button>
              ) : null}
              <button type="submit" className="btn btn--primary">
                {task ? "Save changes" : "Add task"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
