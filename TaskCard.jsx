import { Check, CheckCheck, Clock3, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { getCategoryById, formatTaskDueLabel, parseDueAt, priorityById, resolveTaskPriority } from "./plannerModel";

function formatCompletedAt(value) {
  const date = parseDueAt(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function TaskCard({ task, categories, now, onToggle, onDelete, onEdit }) {
  const category = getCategoryById(categories, task.categoryId);
  const priority = priorityById(resolveTaskPriority(task, now));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`task-card ${task.completed ? "is-complete" : ""}`}
    >
      <button
        type="button"
        className={`task-card__check ${task.completed ? "is-done" : ""}`}
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? "Mark task active" : "Mark task complete"}
      >
        {task.completed ? <Check size={12} /> : null}
      </button>

      <button type="button" className="task-card__content" onClick={() => onEdit(task)}>
        <p className={`task-card__title ${task.completed ? "is-done" : ""}`}>{task.title}</p>
        {task.description ? <p className="task-card__description">{task.description}</p> : null}
        <div className="task-card__tags">
          <span className="task-chip" style={{ backgroundColor: priority.surface, color: priority.color }}>
            {priority.label}
          </span>
          {category ? (
            <span className="task-chip task-chip--soft">
              <span>{category.emoji}</span>
              <span>{category.name}</span>
            </span>
          ) : null}
          {task.dueAt ? (
            <span className="task-time">
              <Clock3 size={12} />
              {formatTaskDueLabel(task.dueAt)}
            </span>
          ) : null}
          {task.isRolledOver ? (
            <span className="task-chip task-chip--rollover" title={task.failureReason || "Rolled over from a previous day"}>
              ↩ ×{task.rolloverCount}
            </span>
          ) : null}
        </div>
        {task.completed && task.completedAt ? (
          <p className="task-card__completed-at">
            <CheckCheck size={11} />
            {formatCompletedAt(task.completedAt)}
          </p>
        ) : null}
      </button>

      <button type="button" className="task-card__delete" onClick={() => onDelete(task.id)} aria-label="Delete task">
        <Trash2 size={14} />
      </button>
    </motion.article>
  );
}
