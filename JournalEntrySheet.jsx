import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { fromDateKey, toDateKey } from "./plannerModel";

function formatJournalDate(dateKey) {
  const date = fromDateKey(dateKey);
  const todayKey = toDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = toDateKey(yesterdayDate);

  if (dateKey === todayKey) {
    return "Today";
  }
  if (dateKey === yesterdayKey) {
    return "Yesterday";
  }
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function OutcomeRow({ task, outcome, onToggleDone, onReasonChange, categoryEmoji }) {
  const [showReason, setShowReason] = useState(false);

  useEffect(() => {
    if (outcome.done) {
      setShowReason(false);
    }
  }, [outcome.done]);

  return (
    <div className={`journal-outcome-row ${outcome.done ? "is-done" : "is-missed"}`}>
      <div className="journal-outcome-row__main">
        <button
          type="button"
          className={`journal-outcome-row__toggle ${outcome.done ? "is-done" : ""}`}
          onClick={() => onToggleDone(task.id)}
          aria-label={outcome.done ? "Mark as missed" : "Mark as done"}
        >
          {outcome.done ? <Check size={13} strokeWidth={3} /> : null}
        </button>
        <div className="journal-outcome-row__body">
          <span className="journal-outcome-row__emoji">{categoryEmoji}</span>
          <span className={`journal-outcome-row__title ${outcome.done ? "is-done" : ""}`}>
            {task.title}
          </span>
        </div>
        {!outcome.done ? (
          <button
            type="button"
            className="journal-outcome-row__expand"
            onClick={() => setShowReason((v) => !v)}
            aria-label="Add reason"
          >
            {showReason ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        ) : null}
      </div>

      {task.isRolledOver && task.originalDueAt ? (
        <p className="journal-rollover-badge">
          ↩ rolled from {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(fromDateKey(task.originalDueAt))}
          {task.rolloverCount > 1 ? ` (×${task.rolloverCount})` : ""}
        </p>
      ) : null}

      <AnimatePresence>
        {showReason && !outcome.done ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <input
              className="journal-outcome-row__reason"
              type="text"
              value={outcome.reason}
              onChange={(e) => onReasonChange(task.id, e.target.value)}
              placeholder="Why didn't this happen? (optional)"
              autoFocus
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function JournalEntrySheet({
  date,
  tasks,
  categories,
  existingJournal,
  onClose,
  onSubmit,
  saving,
}) {
  // outcomes: Map-like object { [taskId]: { done, reason } }
  const [outcomes, setOutcomes] = useState({});
  const [reflection, setReflection] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Tasks due on this date (current schedule) plus tasks originally due here that were rolled
  const tasksForDate = useMemo(() => {
    return tasks.filter((task) => {
      const dueDateKey = task.dueAt ? toDateKey(task.dueAt) : null;
      const originalKey = task.originalDueAt ? toDateKey(task.originalDueAt) : null;
      return dueDateKey === date || originalKey === date;
    });
  }, [tasks, date]);

  // Rolled-over tasks that came FROM previous days and are now due on this date
  const rolledInTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.isRolledOver) return false;
      const dueDateKey = task.dueAt ? toDateKey(task.dueAt) : null;
      return dueDateKey === date;
    });
  }, [tasks, date]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    if (existingJournal) {
      // Pre-populate from saved journal
      const map = {};
      for (const o of existingJournal.taskOutcomes) {
        map[o.taskId] = { done: Boolean(o.done), reason: o.reason || "" };
      }
      // Fill in any tasks not in the stored outcomes (newly added tasks)
      for (const task of tasksForDate) {
        if (!map[task.id]) {
          map[task.id] = { done: task.completed, reason: "" };
        }
      }
      setOutcomes(map);
      setReflection(existingJournal.reflection || "");
    } else {
      // New journal — auto-initialize outcomes based on task completion state
      const map = {};
      for (const task of tasksForDate) {
        map[task.id] = { done: task.completed, reason: "" };
      }
      setOutcomes(map);

      // Auto-populate reflection with rolled-in tasks as a prompt
      if (rolledInTasks.length > 0) {
        const lines = rolledInTasks.map((t) => `• ${t.title}`).join("\n");
        setReflection(`Carried over from previous days:\n${lines}\n\n`);
      }
    }
  }, [existingJournal, tasksForDate, rolledInTasks, initialized]);

  function toggleDone(taskId) {
    setOutcomes((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], done: !prev[taskId]?.done, reason: prev[taskId]?.reason || "" },
    }));
  }

  function setReason(taskId, reason) {
    setOutcomes((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], reason },
    }));
  }

  function handleSubmit() {
    const outcomesList = tasksForDate.map((task) => ({
      taskId: task.id,
      title: task.title,
      categoryId: task.categoryId,
      done: outcomes[task.id]?.done ?? false,
      reason: outcomes[task.id]?.reason ?? "",
    }));
    onSubmit(date, outcomesList, reflection);
  }

  const doneCount = tasksForDate.filter((t) => outcomes[t.id]?.done).length;
  const missedCount = tasksForDate.length - doneCount;
  const dateLabel = formatJournalDate(date);

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
          className="sheet-panel journal-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sheet-panel__header">
            <div>
              <p className="section-header__eyebrow">Evening Review</p>
              <h2>{dateLabel}</h2>
            </div>
            <button type="button" className="sheet-panel__close" onClick={onClose} aria-label="Close journal">
              <X size={20} />
            </button>
          </div>

          {/* Task Outcomes */}
          <div className="journal-section">
            <div className="journal-section__header">
              <span className="journal-section__label">Tasks</span>
              <span className="journal-section__tally">
                <span className="journal-tally journal-tally--done">{doneCount} done</span>
                {missedCount > 0 ? (
                  <span className="journal-tally journal-tally--missed">{missedCount} missed</span>
                ) : null}
              </span>
            </div>

            {tasksForDate.length === 0 ? (
              <p className="empty-copy" style={{ padding: "20px 0 8px" }}>No tasks were scheduled for this day.</p>
            ) : (
              <div className="journal-outcome-list">
                {tasksForDate.map((task) => (
                  <OutcomeRow
                    key={task.id}
                    task={task}
                    outcome={outcomes[task.id] || { done: false, reason: "" }}
                    onToggleDone={toggleDone}
                    onReasonChange={setReason}
                    categoryEmoji={categoryMap.get(task.categoryId)?.emoji || "📋"}
                  />
                ))}
              </div>
            )}

            {missedCount > 0 ? (
              <p className="journal-rollover-note">
                {missedCount} missed task{missedCount !== 1 ? "s" : ""} will roll to tomorrow automatically.
              </p>
            ) : null}
          </div>

          {/* Reflection */}
          <div className="journal-section">
            <div className="journal-section__header">
              <span className="journal-section__label">Reflection</span>
            </div>
            <textarea
              className="journal-reflection"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="How did your day go? What would you do differently? Any wins to note?"
              rows={5}
            />
          </div>

          <div className="sheet-form__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={saving}
              style={{ width: "100%" }}
            >
              {saving ? "Saving..." : existingJournal ? "Update Journal" : "Save Journal"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
