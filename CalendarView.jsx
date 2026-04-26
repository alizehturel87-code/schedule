import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { buildCalendarDays, fromDateKey, startOfMonth, toDateKey } from "./plannerModel";
import TaskCard from "./TaskCard";

export default function CalendarView({
  tasks,
  categories,
  now,
  onToggle,
  onDeleteTask,
  onEditTask,
  journalSummaries,
  onOpenJournal,
}) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));

  const days = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

  const taskDates = useMemo(() => {
    const dateMap = new Map();
    tasks.forEach((task) => {
      const key = task.dueAt ? toDateKey(task.dueAt) : toDateKey(new Date());
      if (!key) return;
      dateMap.set(key, (dateMap.get(key) || 0) + 1);
    });
    return dateMap;
  }, [tasks]);

  const tasksForDate = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.dueAt) {
        return selectedDateKey === toDateKey(new Date());
      }
      return toDateKey(task.dueAt) === selectedDateKey;
    });
  }, [selectedDateKey, tasks]);

  const selectedDate = fromDateKey(selectedDateKey);
  const todayKey = toDateKey(new Date());
  const isSelectedPastOrToday = selectedDateKey <= todayKey;
  const selectedJournal = journalSummaries?.get(selectedDateKey);

  return (
    <div className="view-stack">
      <section className="view-section">
        <div className="calendar-header">
          <button
            type="button"
            className="section-header__icon"
            onClick={() => setCurrentMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="calendar-header__copy">
            <p className="section-header__eyebrow">Calendar</p>
            <h2>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(currentMonth)}</h2>
          </div>
          <button
            type="button"
            className="section-header__icon"
            onClick={() => setCurrentMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-grid calendar-grid--labels">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {days.map((day) => {
            const key = toDateKey(day.date);
            const count = taskDates.get(key) || 0;
            const isSelected = key === selectedDateKey;
            const isToday = key === todayKey;
            const journal = journalSummaries?.get(key);
            const journalClass = journal
              ? journal.missedCount === 0
                ? "has-journal-done"
                : "has-journal-missed"
              : "";

            return (
              <button
                key={key}
                type="button"
                className={[
                  "calendar-cell",
                  !day.inCurrentMonth ? "is-muted" : "",
                  isSelected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                  journalClass,
                ].filter(Boolean).join(" ")}
                onClick={() => setSelectedDateKey(key)}
              >
                <span className="calendar-cell__day">{day.date.getDate()}</span>
                {count ? <span className="calendar-cell__dot">{count}</span> : null}
                {journal ? (
                  <span className={`calendar-cell__journal-dot ${journal.missedCount === 0 ? "is-done" : "is-missed"}`} />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="view-section">
        <div className="section-header">
          <div>
            <p className="section-header__eyebrow">
              {selectedDateKey === todayKey
                ? "Today"
                : new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(selectedDate)}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isSelectedPastOrToday && onOpenJournal ? (
              <button
                type="button"
                className={`calendar-journal-btn ${selectedJournal ? "has-journal" : ""}`}
                onClick={() => onOpenJournal(selectedDateKey)}
                aria-label={selectedJournal ? "View journal entry" : "Write journal entry"}
              >
                <PenLine size={14} />
                {selectedJournal ? "Journal" : "Review"}
              </button>
            ) : null}
            <span className="section-header__count">{tasksForDate.length}</span>
          </div>
        </div>

        {selectedJournal ? (
          <div className={`calendar-journal-summary ${selectedJournal.missedCount === 0 ? "is-all-done" : "is-has-missed"}`}>
            <span className="journal-tally journal-tally--done">{selectedJournal.doneCount} done</span>
            {selectedJournal.missedCount > 0 ? (
              <span className="journal-tally journal-tally--missed">{selectedJournal.missedCount} missed</span>
            ) : null}
          </div>
        ) : null}

        <div className="task-list">
          <AnimatePresence>
            {tasksForDate.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                categories={categories}
                now={now}
                onToggle={onToggle}
                onDelete={onDeleteTask}
                onEdit={onEditTask}
              />
            ))}
          </AnimatePresence>
          {tasksForDate.length === 0 ? <p className="empty-copy empty-copy--roomy">No tasks for this day</p> : null}
        </div>
      </section>
    </div>
  );
}
