import { Check, Clock3, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { getCategoryById, formatTaskDueLabel, priorityById } from "./plannerModel";

export default function TaskCard({ task, categories, onToggle, onDelete, onEdit }) {
  const category = getCategoryById(categories, task.categoryId);
  const priority = priorityById(task.priority);

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
        </div>
      </button>

      <button type="button" className="task-card__delete" onClick={() => onDelete(task.id)} aria-label="Delete task">
        <Trash2 size={14} />
      </button>
    </motion.article>
  );
}
