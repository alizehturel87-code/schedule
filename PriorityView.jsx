import { AnimatePresence } from "framer-motion";
import { PRIORITY_ORDER } from "./plannerConstants";
import { priorityById } from "./plannerModel";
import TaskCard from "./TaskCard";

export default function PriorityView({ tasks, categories, onToggle, onDeleteTask, onEditTask }) {
  const openTasks = tasks.filter((task) => !task.completed);

  return (
    <div className="view-stack">
      {PRIORITY_ORDER.map((priorityId) => {
        const priority = priorityById(priorityId);
        const group = openTasks.filter((task) => task.priority === priorityId);
        if (!group.length) {
          return null;
        }

        return (
          <section key={priorityId} className="view-section">
            <div className="section-header">
              <div>
                <p className="section-header__eyebrow" style={{ color: priority.color }}>
                  {priority.label}
                </p>
              </div>
              <span className="section-header__count" style={{ backgroundColor: priority.surface, color: priority.color }}>
                {group.length}
              </span>
            </div>

            <div className="task-list">
              <AnimatePresence>
                {group.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    categories={categories}
                    onToggle={onToggle}
                    onDelete={onDeleteTask}
                    onEdit={onEditTask}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        );
      })}

      {!openTasks.length ? <p className="empty-copy empty-copy--roomy">All caught up!</p> : null}
    </div>
  );
}
