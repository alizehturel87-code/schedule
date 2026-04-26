import { useMemo } from "react";
import { fromDateKey, parseDueAt, toDateKey } from "./plannerModel";

function classifyTask(task) {
  if (!task.completed) return "pending";
  if (!task.dueAt || !task.completedAt) return "noDeadline";
  const due = parseDueAt(task.dueAt);
  const done = parseDueAt(task.completedAt);
  if (!due || !done) return "noDeadline";
  return done.getTime() <= due.getTime() ? "onTime" : "late";
}

function formatShortDate(dateKey) {
  const date = fromDateKey(dateKey);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatDayLabel(dateKey) {
  const date = fromDateKey(dateKey);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function RateBar({ onTime, late, total }) {
  const onTimePct = total > 0 ? (onTime / total) * 100 : 0;
  const latePct = total > 0 ? (late / total) * 100 : 0;

  return (
    <div className="analysis-rate-bar">
      <div className="analysis-rate-bar__fill analysis-rate-bar__fill--on-time" style={{ width: `${onTimePct}%` }} />
      <div className="analysis-rate-bar__fill analysis-rate-bar__fill--late" style={{ width: `${latePct}%` }} />
    </div>
  );
}

export default function AnalysisView({ tasks, categories }) {
  const stats = useMemo(() => {
    const completed = tasks.filter((t) => t.completed);
    const pending = tasks.filter((t) => !t.completed);

    let onTime = 0, late = 0, noDeadline = 0;
    for (const task of completed) {
      const cls = classifyTask(task);
      if (cls === "onTime") onTime++;
      else if (cls === "late") late++;
      else noDeadline++;
    }

    const withDeadline = onTime + late;
    const onTimeRate = withDeadline > 0 ? Math.round((onTime / withDeadline) * 100) : null;

    // Last 14 days timeline
    const today = new Date();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (13 - i));
      return toDateKey(d);
    });

    const timeline = days.map((dateKey) => {
      const dayCompleted = completed.filter(
        (t) => t.completedAt && toDateKey(parseDueAt(t.completedAt)) === dateKey
      );
      const dayOnTime = dayCompleted.filter((t) => classifyTask(t) === "onTime").length;
      const dayLate = dayCompleted.filter((t) => classifyTask(t) === "late").length;
      return { dateKey, total: dayCompleted.length, onTime: dayOnTime, late: dayLate };
    });

    const maxDay = Math.max(...timeline.map((d) => d.total), 1);

    // By category
    const byCategory = categories
      .map((cat) => {
        const catTasks = tasks.filter((t) => t.categoryId === cat.id);
        if (catTasks.length === 0) return null;
        const catCompleted = catTasks.filter((t) => t.completed);
        const catOnTime = catCompleted.filter((t) => classifyTask(t) === "onTime").length;
        const catLate = catCompleted.filter((t) => classifyTask(t) === "late").length;
        return {
          ...cat,
          total: catTasks.length,
          completed: catCompleted.length,
          pending: catTasks.filter((t) => !t.completed).length,
          onTime: catOnTime,
          late: catLate,
        };
      })
      .filter(Boolean);

    // Rolled-over tasks still pending
    const rolledOver = tasks
      .filter((t) => !t.completed && t.rolloverCount > 0)
      .sort((a, b) => b.rolloverCount - a.rolloverCount)
      .slice(0, 8);

    // Late completed tasks (most recently completed first)
    const lateTasks = completed
      .filter((t) => classifyTask(t) === "late")
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
      .slice(0, 8);

    return {
      total: tasks.length,
      completedTotal: completed.length,
      pendingTotal: pending.length,
      onTime,
      late,
      noDeadline,
      onTimeRate,
      withDeadline,
      timeline,
      maxDay,
      byCategory,
      rolledOver,
      lateTasks,
    };
  }, [tasks, categories]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <div className="view-stack">

      {/* Overview */}
      <section className="view-section">
        <div className="section-header">
          <div>
            <p className="section-header__eyebrow">Analysis</p>
            <h2>Overview</h2>
          </div>
        </div>

        <div className="analysis-stat-row">
          <div className="analysis-stat">
            <span className="analysis-stat__value">{stats.total}</span>
            <span className="analysis-stat__label">Total tasks</span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat__value analysis-stat__value--done">{stats.completedTotal}</span>
            <span className="analysis-stat__label">Completed</span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat__value analysis-stat__value--pending">{stats.pendingTotal}</span>
            <span className="analysis-stat__label">Pending</span>
          </div>
        </div>

        {stats.withDeadline > 0 ? (
          <div className="analysis-rate-block">
            <div className="analysis-rate-block__header">
              <span className="analysis-rate-block__label">On-time completion rate</span>
              <span
                className="analysis-rate-block__pct"
                style={{ color: stats.onTimeRate >= 70 ? "#2f9b74" : stats.onTimeRate >= 40 ? "#d97a28" : "#d45555" }}
              >
                {stats.onTimeRate}%
              </span>
            </div>
            <RateBar onTime={stats.onTime} late={stats.late} total={stats.withDeadline} />
            <div className="analysis-rate-block__legend">
              <span className="analysis-legend analysis-legend--on-time">✓ {stats.onTime} on time</span>
              <span className="analysis-legend analysis-legend--late">✗ {stats.late} late</span>
              {stats.noDeadline > 0 ? (
                <span className="analysis-legend analysis-legend--open">∞ {stats.noDeadline} open</span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="empty-copy" style={{ padding: "16px 0 4px" }}>
            Complete some tasks with deadlines to see your on-time rate.
          </p>
        )}
      </section>

      {/* 14-day timeline */}
      <section className="view-section">
        <div className="section-header">
          <div>
            <p className="section-header__eyebrow">Last 14 Days</p>
            <h2>Completions</h2>
          </div>
          <span className="section-header__count">{stats.completedTotal}</span>
        </div>

        <div className="analysis-timeline">
          {stats.timeline.map(({ dateKey, total, onTime, late }) => {
            const heightPct = (total / stats.maxDay) * 100;
            const onTimePct = total > 0 ? (onTime / total) * 100 : 0;
            const isToday = dateKey === toDateKey(new Date());
            return (
              <div key={dateKey} className={`analysis-day ${isToday ? "is-today" : ""}`}>
                <div className="analysis-day__bar-wrap">
                  {total > 0 ? (
                    <div className="analysis-day__bar" style={{ height: `${heightPct}%` }}>
                      <div
                        className="analysis-day__bar-on-time"
                        style={{ height: `${onTimePct}%` }}
                      />
                    </div>
                  ) : (
                    <div className="analysis-day__bar analysis-day__bar--empty" />
                  )}
                </div>
                {total > 0 ? <span className="analysis-day__count">{total}</span> : null}
                <span className="analysis-day__label">{formatDayLabel(dateKey)}</span>
                {isToday ? <span className="analysis-day__today-dot" /> : null}
              </div>
            );
          })}
        </div>

        <div className="analysis-timeline-legend">
          <span className="analysis-legend analysis-legend--on-time">On time</span>
          <span className="analysis-legend analysis-legend--late">Late</span>
        </div>
      </section>

      {/* By category */}
      {stats.byCategory.length > 0 ? (
        <section className="view-section">
          <div className="section-header">
            <div>
              <p className="section-header__eyebrow">Breakdown</p>
              <h2>By Category</h2>
            </div>
          </div>

          <div className="analysis-category-list">
            {stats.byCategory.map((cat) => {
              const catTotal = cat.onTime + cat.late;
              const catRate = catTotal > 0 ? Math.round((cat.onTime / catTotal) * 100) : null;
              return (
                <div key={cat.id} className="analysis-category-row">
                  <div className="analysis-category-row__meta">
                    <span className="analysis-category-row__emoji">{cat.emoji}</span>
                    <span className="analysis-category-row__name">{cat.name}</span>
                    <span className="analysis-category-row__counts">
                      {cat.completed}/{cat.total} done
                      {catRate !== null ? (
                        <span
                          className="analysis-category-row__rate"
                          style={{ color: catRate >= 70 ? "#2f9b74" : catRate >= 40 ? "#d97a28" : "#d45555" }}
                        >
                          {catRate}% on time
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {catTotal > 0 ? (
                    <RateBar onTime={cat.onTime} late={cat.late} total={catTotal} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Rolled-over tasks */}
      {stats.rolledOver.length > 0 ? (
        <section className="view-section">
          <div className="section-header">
            <div>
              <p className="section-header__eyebrow">Needs Attention</p>
              <h2>Kept Rolling Over</h2>
            </div>
            <span className="section-header__count">{stats.rolledOver.length}</span>
          </div>

          <div className="analysis-rolled-list">
            {stats.rolledOver.map((task) => {
              const cat = categoryMap.get(task.categoryId);
              return (
                <div key={task.id} className="analysis-rolled-row">
                  <div className="analysis-rolled-row__left">
                    <span>{cat?.emoji || "📋"}</span>
                    <div>
                      <p className="analysis-rolled-row__title">{task.title}</p>
                      {task.originalDueAt ? (
                        <p className="analysis-rolled-row__origin">
                          Originally due {formatShortDate(task.originalDueAt)}
                        </p>
                      ) : null}
                      {task.failureReason ? (
                        <p className="analysis-rolled-row__reason">"{task.failureReason}"</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="task-chip task-chip--rollover">↩ ×{task.rolloverCount}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Recently completed late */}
      {stats.lateTasks.length > 0 ? (
        <section className="view-section">
          <div className="section-header">
            <div>
              <p className="section-header__eyebrow">Completed Late</p>
              <h2>Past the Deadline</h2>
            </div>
            <span className="section-header__count">{stats.late}</span>
          </div>

          <div className="analysis-rolled-list">
            {stats.lateTasks.map((task) => {
              const cat = categoryMap.get(task.categoryId);
              const due = parseDueAt(task.dueAt);
              const done = parseDueAt(task.completedAt);
              const diffMs = done && due ? done.getTime() - due.getTime() : 0;
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              return (
                <div key={task.id} className="analysis-rolled-row">
                  <div className="analysis-rolled-row__left">
                    <span>{cat?.emoji || "📋"}</span>
                    <div>
                      <p className="analysis-rolled-row__title">{task.title}</p>
                      <p className="analysis-rolled-row__origin">
                        Due {due ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(due) : "—"}
                        {" · "}
                        Done {done ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(done) : "—"}
                      </p>
                    </div>
                  </div>
                  <span className="analysis-late-badge">
                    +{diffDays}d late
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

    </div>
  );
}
