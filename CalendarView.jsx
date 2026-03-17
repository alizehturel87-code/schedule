import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import {
  buildCalendarDays,
  dateKey,
  parseDateKey,
  startOfMonth,
} from "./src/helpers";
import TaskCard from "./src/components/TaskCard";

export default function CalendarView({
  currentMonth,
  selectedDateKey,
  tasks,
  onMonthChange,
  onSelectDate,
  onToggle,
  onEditTask,
  onDeleteTask,
}) {
  const days = buildCalendarDays(currentMonth);
  const selectedDate = parseDateKey(selectedDateKey);
  const dayTasks = tasks.filter((task) => dateKey(new Date(task.dueAt)) === selectedDateKey);

  return (
    <div className="section-stack">
      <section className="view-section">
        <div className="calendar-nav">
          <button type="button" className="icon-btn" onClick={() => onMonthChange(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="section-kicker">Timeline</p>
            <h2>
              {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(currentMonth)}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => onMonthChange(1)} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-grid calendar-grid--labels">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {days.map((day) => {
            const key = dateKey(day.date);
            const count = tasks.filter((task) => dateKey(new Date(task.dueAt)) === key).length;
            const isSelected = key === selectedDateKey;
            const isToday = key === dateKey(new Date());

            return (
              <button
                key={key}
                type="button"
                className={[
                  "calendar-cell",
                  day.inCurrentMonth ? "" : "is-muted",
                  isSelected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelectDate(key)}
              >
                <span className="calendar-cell__number">{day.date.getDate()}</span>
                {count ? <span className="calendar-cell__count">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="calendar-footer">
          <button type="button" className="btn btn--ghost" onClick={() => {
            const today = new Date();
            onSelectDate(dateKey(today));
            onMonthChange(0, startOfMonth(today));
          }}>
            Jump to today
          </button>
        </div>
      </section>

      <section className="view-section">
        <div className="section-header">
          <div>
            <p className="section-kicker">Selected day</p>
            <h2>
              {new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(selectedDate)}
            </h2>
          </div>
          <span className="count-badge">{dayTasks.length}</span>
        </div>

        <div className="cards-stack">
          <AnimatePresence>
            {dayTasks.map((task) => (
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
          {dayTasks.length === 0 ? <p className="empty-copy">No tasks scheduled for this day.</p> : null}
        </div>
      </section>
    </div>
  );
}
