import { AnimatePresence } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import TaskCard from "./TaskCard";

export default function CategoryView({
  tasks,
  categories,
  onToggle,
  onDeleteTask,
  onEditTask,
  onDeleteCategory,
  onAddCategory,
}) {
  return (
    <div className="view-stack">
      {categories.map((category) => {
        const categoryTasks = tasks.filter((task) => task.categoryId === category.id && !task.completed);
        const completedCount = tasks.filter((task) => task.categoryId === category.id && task.completed).length;

        return (
          <section key={category.id} className="view-section">
            <div className="section-header">
              <div>
                <p className="section-header__eyebrow">
                  <span>{category.emoji}</span>
                  <span>{category.name}</span>
                  <span>({categoryTasks.length}{completedCount ? ` + ${completedCount} done` : ""})</span>
                </p>
              </div>
              {!category.system ? (
                <button type="button" className="section-header__icon danger" onClick={() => onDeleteCategory(category.id)} aria-label="Delete category">
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>

            <div className="task-list">
              <AnimatePresence>
                {categoryTasks.map((task) => (
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
              {categoryTasks.length === 0 ? <p className="empty-copy">No tasks</p> : null}
            </div>
          </section>
        );
      })}

      <button type="button" className="add-row-btn" onClick={onAddCategory}>
        <Plus size={16} />
        Add Category
      </button>
    </div>
  );
}
