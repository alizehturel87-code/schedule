import { useMemo } from "react";
import { fromDateKey, parseDueAt, toDateKey } from "./plannerModel";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = [
  { key: "morning",   label: "Morning",   emoji: "🌅", desc: "5 am – 12 pm" },
  { key: "afternoon", label: "Afternoon", emoji: "☀️",  desc: "12 pm – 5 pm" },
  { key: "evening",   label: "Evening",   emoji: "🌆", desc: "5 pm – 10 pm" },
  { key: "night",     label: "Night",     emoji: "🌙", desc: "10 pm – 5 am" },
];

function classifyTask(task) {
  if (!task.completed) return "pending";
  if (!task.dueAt || !task.completedAt) return "noDeadline";
  const due = parseDueAt(task.dueAt);
  const done = parseDueAt(task.completedAt);
  if (!due || !done) return "noDeadline";
  return done.getTime() <= due.getTime() ? "onTime" : "late";
}

function rateColor(rate) {
  if (rate === null) return "var(--muted)";
  if (rate >= 70) return "#2f9b74";
  if (rate >= 40) return "#d97a28";
  return "#d45555";
}

// SVG donut chart for on-time rate
function DonutChart({ rate }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.max(0, Math.min(100, rate ?? 0)) / 100) * circ;
  const color = rateColor(rate);

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" aria-label={`${rate ?? 0}% on-time rate`}>
      <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--secondary)" strokeWidth="14" />
      {rate !== null ? (
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
      ) : null}
      <text x="70" y="65" textAnchor="middle" fontSize="26" fontWeight="700"
        fill={color} fontFamily="DM Serif Display, serif">
        {rate !== null ? `${rate}%` : "—"}
      </text>
      <text x="70" y="84" textAnchor="middle" fontSize="11" fill="var(--muted)"
        fontFamily="DM Sans, sans-serif" fontWeight="600">
        on time
      </text>
    </svg>
  );
}

function HBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="analysis-hbar">
      <div className="analysis-hbar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function AnalysisView({ tasks, categories }) {
  const stats = useMemo(() => {
    const completed = tasks.filter((t) => t.completed);
    const pending   = tasks.filter((t) => !t.completed);

    let onTime = 0, late = 0, noDeadline = 0;
    for (const task of completed) {
      const cls = classifyTask(task);
      if (cls === "onTime") onTime++;
      else if (cls === "late") late++;
      else noDeadline++;
    }
    const withDeadline = onTime + late;
    const onTimeRate = withDeadline > 0 ? Math.round((onTime / withDeadline) * 100) : null;

    // Avg days late
    const lateList = completed.filter((t) => classifyTask(t) === "late");
    const avgLateDays = lateList.length > 0
      ? Math.round(lateList.reduce((sum, t) => {
          const due = parseDueAt(t.dueAt), done = parseDueAt(t.completedAt);
          return sum + (due && done ? (done - due) / 86400000 : 0);
        }, 0) / lateList.length)
      : 0;

    // Current streak (consecutive days with ≥1 completion)
    const completionDays = new Set(
      completed.filter((t) => t.completedAt)
        .map((t) => { const d = parseDueAt(t.completedAt); return d ? toDateKey(d) : null; })
        .filter(Boolean)
    );
    const todayKey = toDateKey(new Date());
    const startOffset = completionDays.has(todayKey) ? 0 : 1;
    let streak = 0;
    for (let i = startOffset; i < 366; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (completionDays.has(toDateKey(d))) streak++;
      else break;
    }

    // 14-day timeline
    const today = new Date();
    const timelineDays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (13 - i));
      return toDateKey(d);
    });
    const timeline = timelineDays.map((dateKey) => {
      const dayDone = completed.filter((t) => t.completedAt && toDateKey(parseDueAt(t.completedAt)) === dateKey);
      const dayOnTime = dayDone.filter((t) => classifyTask(t) === "onTime").length;
      const dayLate   = dayDone.filter((t) => classifyTask(t) === "late").length;
      return { dateKey, total: dayDone.length, onTime: dayOnTime, late: dayLate };
    });
    const maxDay = Math.max(...timeline.map((d) => d.total), 1);

    // Day of week
    const byDow = DOW_LABELS.map((label, dow) => ({
      label,
      count: completed.filter((t) => {
        if (!t.completedAt) return false;
        const d = parseDueAt(t.completedAt);
        return d && d.getDay() === dow;
      }).length,
    }));
    const maxDow = Math.max(...byDow.map((d) => d.count), 1);

    // Time of day
    const byTime = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const task of completed) {
      if (!task.completedAt) continue;
      const d = parseDueAt(task.completedAt);
      if (!d) continue;
      const h = d.getHours();
      if (h >= 5 && h < 12) byTime.morning++;
      else if (h >= 12 && h < 17) byTime.afternoon++;
      else if (h >= 17 && h < 22) byTime.evening++;
      else byTime.night++;
    }
    const maxTime = Math.max(...Object.values(byTime), 1);

    // By category
    const byCategory = categories.map((cat) => {
      const catTasks     = tasks.filter((t) => t.categoryId === cat.id);
      const catCompleted = catTasks.filter((t) => t.completed);
      const catOnTime    = catCompleted.filter((t) => classifyTask(t) === "onTime").length;
      const catLate      = catCompleted.filter((t) => classifyTask(t) === "late").length;
      const catDeadline  = catOnTime + catLate;
      return {
        ...cat,
        total: catTasks.length,
        completed: catCompleted.length,
        pending: catTasks.filter((t) => !t.completed).length,
        onTime: catOnTime,
        late: catLate,
        rate: catDeadline > 0 ? Math.round((catOnTime / catDeadline) * 100) : null,
      };
    }).filter((c) => c.total > 0).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    // Rolled-over (pending)
    const rolledOver = tasks
      .filter((t) => !t.completed && t.rolloverCount > 0)
      .sort((a, b) => b.rolloverCount - a.rolloverCount)
      .slice(0, 8);

    // Recent completions (newest first)
    const recentCompletions = [...completed]
      .filter((t) => t.completedAt)
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
      .slice(0, 15);

    return {
      total: tasks.length, completedTotal: completed.length, pendingTotal: pending.length,
      onTime, late, noDeadline, withDeadline, onTimeRate, avgLateDays, streak,
      timeline, maxDay, byDow, maxDow, byTime, maxTime,
      byCategory, rolledOver, recentCompletions,
    };
  }, [tasks, categories]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const todayKey = toDateKey(new Date());

  return (
    <div className="view-stack">

      {/* ── 1. Hero: rate + key numbers ── */}
      <section className="view-section">
        <p className="section-header__eyebrow" style={{ marginBottom: 14 }}>Your Performance</p>

        <div className="analysis-hero">
          <DonutChart rate={stats.onTimeRate} />
          <div className="analysis-hero__metrics">
            <div className="analysis-hero__metric">
              <span className="analysis-hero__metric-val" style={{ color: "#2f9b74" }}>{stats.onTime}</span>
              <span className="analysis-hero__metric-label">On time</span>
            </div>
            <div className="analysis-hero__metric">
              <span className="analysis-hero__metric-val" style={{ color: "#d45555" }}>{stats.late}</span>
              <span className="analysis-hero__metric-label">Late</span>
            </div>
            <div className="analysis-hero__metric">
              <span className="analysis-hero__metric-val" style={{ color: "var(--primary)" }}>{stats.pendingTotal}</span>
              <span className="analysis-hero__metric-label">Pending</span>
            </div>
            <div className="analysis-hero__metric">
              <span className="analysis-hero__metric-val">{stats.noDeadline}</span>
              <span className="analysis-hero__metric-label">Open</span>
            </div>
          </div>
        </div>

        <div className="analysis-hero__footer">
          {stats.streak > 0 ? (
            <span className="analysis-badge analysis-badge--streak">
              🔥 {stats.streak} day streak
            </span>
          ) : null}
          {stats.avgLateDays > 0 ? (
            <span className="analysis-badge analysis-badge--late">
              ⏱ Avg {stats.avgLateDays}d late when missed
            </span>
          ) : null}
          {stats.withDeadline === 0 ? (
            <span className="analysis-badge">Complete tasks with deadlines to see your rate</span>
          ) : null}
        </div>
      </section>

      {/* ── 2. 14-day activity timeline ── */}
      <section className="view-section">
        <div className="section-header">
          <div>
            <p className="section-header__eyebrow">Activity</p>
            <h2>Last 14 Days</h2>
          </div>
          <span className="section-header__count">{stats.completedTotal}</span>
        </div>

        <div className="analysis-timeline2">
          {stats.timeline.map(({ dateKey, total, onTime, late }, i) => {
            const heightPct = (total / stats.maxDay) * 100;
            const onTimePct = total > 0 ? (onTime / total) * 100 : 0;
            const isToday   = dateKey === todayKey;
            const showDate  = i === 0 || i === 6 || i === 13 || isToday;
            return (
              <div key={dateKey} className={`analysis-day2 ${isToday ? "is-today" : ""}`}>
                <div className="analysis-day2__bar-wrap">
                  {total > 0 ? (
                    <div className="analysis-day2__bar" style={{ height: `${heightPct}%` }}>
                      <div className="analysis-day2__bar-late"   style={{ height: `${100 - onTimePct}%` }} />
                      <div className="analysis-day2__bar-ontime" style={{ height: `${onTimePct}%` }} />
                    </div>
                  ) : (
                    <div className="analysis-day2__empty" />
                  )}
                </div>
                {total > 0 ? <span className="analysis-day2__count">{total}</span> : null}
                <span className="analysis-day2__label">
                  {showDate
                    ? new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(fromDateKey(dateKey))
                    : new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(fromDateKey(dateKey))}
                </span>
              </div>
            );
          })}
        </div>

        <div className="analysis-timeline-legend">
          <span className="analysis-legend analysis-legend--on-time">■ On time</span>
          <span className="analysis-legend analysis-legend--late">■ Late</span>
        </div>
      </section>

      {/* ── 3. Patterns: day of week + time of day ── */}
      <section className="view-section">
        <div className="section-header" style={{ marginBottom: 18 }}>
          <div>
            <p className="section-header__eyebrow">Patterns</p>
            <h2>When You Work</h2>
          </div>
        </div>

        <p className="analysis-sub-label">Day of week</p>
        <div className="analysis-dow-list">
          {stats.byDow.map(({ label, count }) => (
            <div key={label} className="analysis-dow-row">
              <span className="analysis-dow-row__label">{label}</span>
              <div className="analysis-dow-row__bar-wrap">
                <HBar value={count} max={stats.maxDow} color="#4a84d8" />
              </div>
              <span className="analysis-dow-row__count">{count}</span>
            </div>
          ))}
        </div>

        <p className="analysis-sub-label" style={{ marginTop: 20 }}>Time of day</p>
        <div className="analysis-time-grid">
          {TIME_SLOTS.map((slot) => {
            const count = stats.byTime[slot.key];
            const pct   = stats.maxTime > 0 ? Math.round((count / stats.maxTime) * 100) : 0;
            return (
              <div key={slot.key} className="analysis-time-card">
                <span className="analysis-time-card__emoji">{slot.emoji}</span>
                <span className="analysis-time-card__label">{slot.label}</span>
                <span className="analysis-time-card__count">{count}</span>
                <div className="analysis-time-card__bar">
                  <div className="analysis-time-card__bar-fill" style={{ height: `${pct}%` }} />
                </div>
                <span className="analysis-time-card__desc">{slot.desc}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. By category ── */}
      {stats.byCategory.length > 0 ? (
        <section className="view-section">
          <div className="section-header">
            <div>
              <p className="section-header__eyebrow">Breakdown</p>
              <h2>By Category</h2>
            </div>
          </div>
          <div className="analysis-cat-list">
            {stats.byCategory.map((cat) => (
              <div key={cat.id} className="analysis-cat-row">
                <div className="analysis-cat-row__left">
                  <span className="analysis-cat-row__emoji">{cat.emoji}</span>
                  <div>
                    <p className="analysis-cat-row__name">{cat.name}</p>
                    <p className="analysis-cat-row__sub">
                      {cat.completed} done · {cat.pending} pending
                      {cat.late > 0 ? ` · ${cat.late} late` : ""}
                    </p>
                  </div>
                </div>
                <div className="analysis-cat-row__right">
                  {cat.rate !== null ? (
                    <>
                      <span className="analysis-cat-row__rate" style={{ color: rateColor(cat.rate) }}>
                        {cat.rate}%
                      </span>
                      <span className="analysis-cat-row__rate-label">on time</span>
                    </>
                  ) : (
                    <span className="analysis-cat-row__rate" style={{ color: "var(--muted)" }}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── 5. Recent completions ── */}
      {stats.recentCompletions.length > 0 ? (
        <section className="view-section">
          <div className="section-header">
            <div>
              <p className="section-header__eyebrow">History</p>
              <h2>Recent Completions</h2>
            </div>
            <span className="section-header__count">{stats.completedTotal}</span>
          </div>
          <div className="analysis-feed">
            {stats.recentCompletions.map((task) => {
              const cat  = categoryMap.get(task.categoryId);
              const cls  = classifyTask(task);
              const done = parseDueAt(task.completedAt);
              const due  = parseDueAt(task.dueAt);
              const diffDays = due && done
                ? Math.ceil((done.getTime() - due.getTime()) / 86400000)
                : null;

              return (
                <div key={task.id} className="analysis-feed-row">
                  <span className="analysis-feed-row__emoji">{cat?.emoji || "📋"}</span>
                  <div className="analysis-feed-row__body">
                    <p className="analysis-feed-row__title">{task.title}</p>
                    <p className="analysis-feed-row__date">
                      {done ? new Intl.DateTimeFormat(undefined, {
                        month: "short", day: "numeric",
                        hour: "numeric", minute: "2-digit",
                      }).format(done) : "—"}
                      {due ? ` · due ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(due)}` : ""}
                    </p>
                  </div>
                  <span className={`analysis-feed-badge analysis-feed-badge--${cls === "onTime" ? "on-time" : cls === "late" ? "late" : "open"}`}>
                    {cls === "onTime"
                      ? diffDays !== null && diffDays < 0
                        ? `${Math.abs(diffDays)}d early`
                        : "On time"
                      : cls === "late" && diffDays !== null
                        ? `+${diffDays}d`
                        : "Open"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── 6. Rolled-over watch list ── */}
      {stats.rolledOver.length > 0 ? (
        <section className="view-section">
          <div className="section-header">
            <div>
              <p className="section-header__eyebrow">Watch List</p>
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
                    <span style={{ fontSize: "1.1rem" }}>{task.rolloverCount >= 3 ? "🔴" : task.rolloverCount >= 2 ? "🟠" : "🟡"}</span>
                    <div>
                      <p className="analysis-rolled-row__title">
                        {cat?.emoji || ""} {task.title}
                      </p>
                      {task.originalDueAt ? (
                        <p className="analysis-rolled-row__origin">
                          Originally due {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(fromDateKey(task.originalDueAt))}
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

    </div>
  );
}
