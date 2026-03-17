import { AnimatePresence } from "framer-motion";
import { CATEGORY_META } from "./src/constants";
import { canonicalCategoryId } from "./src/helpers";
import TaskCard from "./src/components/TaskCard";

export default function PriorityView({ tasks, onToggle, onEditTask, onDeleteTask }) {
  const openTasks = tasks.filter((task) => task.status !== "completed");

  return (
    <div className="section-stack">
      {CATEGORY_META.map((category) => {
        const categoryTasks = openTasks.filter((task) => canonicalCategoryId(task.category) === category.id);
        return (
          <section key={category.id} className="view-section">
            <div className="section-header">
              <div>
                <p className="section-kicker" style={{ color: category.accent }}>{category.shortLabel}</p>
                <h2>{category.label}</h2>
              </div>
              <span className="count-badge" style={{ color: category.accent, backgroundColor: category.surface }}>
                {categoryTasks.length}
              </span>
            </div>

            <div className="cards-stack">
              <AnimatePresence>
                {categoryTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    showBroadHead
                  />
                ))}
              </AnimatePresence>
              {categoryTasks.length === 0 ? (
                <p className="empty-copy">No open tasks in this lane.</p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
