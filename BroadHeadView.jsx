import { AnimatePresence } from "framer-motion";
import { FolderOpen, Pencil } from "lucide-react";
import TaskCard from "./src/components/TaskCard";

function buildGroups(tasks, broadHeads) {
  const groups = broadHeads.map((head) => ({
    id: head.id,
    title: head.title,
    notes: head.notes,
    tasks: tasks.filter((task) => task.broadHeadId === head.id),
    isUngrouped: false,
  }));

  const ungrouped = tasks.filter((task) => !task.broadHeadId);
  if (ungrouped.length) {
    groups.push({
      id: "ungrouped",
      title: "Without Broad Head",
      notes: "Tasks that are not assigned yet.",
      tasks: ungrouped,
      isUngrouped: true,
    });
  }

  return groups;
}

export default function BroadHeadView({
  tasks,
  broadHeads,
  onToggle,
  onEditTask,
  onDeleteTask,
  onCreateBroadHead,
  onEditBroadHead,
}) {
  const groups = buildGroups(tasks, broadHeads);

  return (
    <div className="section-stack">
      <section className="hero-card hero-card--compact">
        <div>
          <p className="hero-card__eyebrow">Project structure</p>
          <h2>Broad heads keep your tasks grouped without changing your backend.</h2>
        </div>
        <button type="button" className="btn btn--secondary" onClick={onCreateBroadHead}>
          Add broad head
        </button>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="view-section">
          <div className="section-header">
            <div className="section-header__title">
              <div className="section-header__icon">
                <FolderOpen size={18} />
              </div>
              <div>
                <h2>{group.title}</h2>
                <p className="section-subcopy">{group.notes || "No notes yet."}</p>
              </div>
            </div>
            {!group.isUngrouped ? (
              <button type="button" className="icon-btn" onClick={() => onEditBroadHead(group.id)} aria-label="Edit broad head">
                <Pencil size={16} />
              </button>
            ) : null}
          </div>

          <div className="cards-stack">
            <AnimatePresence>
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  showBroadHead={false}
                />
              ))}
            </AnimatePresence>
            {group.tasks.length === 0 ? <p className="empty-copy">No tasks in this broad head.</p> : null}
          </div>
        </section>
      ))}

      {groups.length === 0 ? (
        <section className="view-section">
          <p className="empty-copy">Create a broad head to start grouping your tasks.</p>
        </section>
      ) : null}
    </div>
  );
}
