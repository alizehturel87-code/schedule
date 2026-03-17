import { Clock3, FolderOpen, Pencil, Square, SquareCheckBig, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { categoryById, formatDateLabel, trimText } from "../helpers";

export default function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  showBroadHead = true,
}) {
  const category = categoryById(task.category);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`task-card ${task.status === "completed" ? "is-complete" : ""}`}
    >
      <button
        type="button"
        className="task-card__toggle"
        onClick={() => onToggle(task.id)}
        aria-label={task.status === "completed" ? "Mark task open" : "Mark task complete"}
      >
        {task.status === "completed" ? <SquareCheckBig size={18} /> : <Square size={18} />}
      </button>

      <button type="button" className="task-card__body" onClick={() => onEdit(task)}>
        <div className="task-card__title-row">
          <h3>{task.title || "Untitled task"}</h3>
          <span className="task-card__pill" style={{ backgroundColor: category.surface, color: category.accent }}>
            {category.shortLabel}
          </span>
        </div>

        <div className="task-card__meta">
          <span>
            <Clock3 size={12} />
            {formatDateLabel(task.dueAt)}
          </span>
          {showBroadHead && task.broadHeadTitle ? (
            <span>
              <FolderOpen size={12} />
              {task.broadHeadTitle}
            </span>
          ) : null}
        </div>

        {task.notes ? <p>{trimText(task.notes, 120)}</p> : null}
      </button>

      <div className="task-card__actions">
        <button type="button" className="task-card__icon-btn" onClick={() => onEdit(task)} aria-label="Edit task">
          <Pencil size={15} />
        </button>
        <button type="button" className="task-card__icon-btn danger" onClick={() => onDelete(task)} aria-label="Delete task">
          <Trash2 size={15} />
        </button>
      </div>
    </motion.article>
  );
}
