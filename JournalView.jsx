import { useMemo } from "react";
import { BookOpen, PenLine } from "lucide-react";
import { fromDateKey, toDateKey } from "./plannerModel";

function formatEntryDate(dateKey) {
  const date = fromDateKey(dateKey);
  const todayKey = toDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = toDateKey(yesterdayDate);

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function JournalCard({ summary, onOpen }) {
  const dateLabel = formatEntryDate(summary.date);
  const allDone = summary.missedCount === 0 && summary.doneCount > 0;
  const hasMissed = summary.missedCount > 0;

  return (
    <button type="button" className="journal-entry-card" onClick={() => onOpen(summary.date)}>
      <div className="journal-entry-card__left">
        <div className={`journal-entry-card__dot ${allDone ? "is-all-done" : hasMissed ? "is-has-missed" : ""}`} />
        <div>
          <p className="journal-entry-card__date">{dateLabel}</p>
          <p className="journal-entry-card__tally">
            <span className="journal-tally journal-tally--done">{summary.doneCount} done</span>
            {hasMissed ? (
              <span className="journal-tally journal-tally--missed">{summary.missedCount} missed</span>
            ) : null}
            {summary.doneCount === 0 && summary.missedCount === 0 ? (
              <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>No tasks</span>
            ) : null}
          </p>
          {summary.reflectionSnippet ? (
            <p className="journal-entry-card__snippet">{summary.reflectionSnippet}</p>
          ) : null}
        </div>
      </div>
      <PenLine size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
    </button>
  );
}

export default function JournalView({ journalSummaries, journalCache, tasks, onOpenJournal }) {
  const todayKey = toDateKey(new Date());
  const hasTodayJournal = journalSummaries.has(todayKey);

  // Sorted list of past journal entries (newest first)
  const entries = useMemo(() => {
    const list = [];
    for (const [date, summary] of journalSummaries) {
      const cachedJournal = journalCache.get(date);
      list.push({
        ...summary,
        reflectionSnippet: cachedJournal?.reflection
          ? cachedJournal.reflection.replace(/\n/g, " ").slice(0, 80) + (cachedJournal.reflection.length > 80 ? "…" : "")
          : null,
      });
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [journalSummaries, journalCache]);

  // Tasks due today (for the CTA)
  const todayTaskCount = useMemo(() => {
    return tasks.filter((t) => {
      const key = t.dueAt ? toDateKey(t.dueAt) : null;
      return key === todayKey && !t.completed;
    }).length;
  }, [tasks, todayKey]);

  return (
    <div className="view-stack">
      {/* Tonight's Review CTA */}
      <section className="view-section">
        <div className="section-header">
          <div>
            <p className="section-header__eyebrow">Journal</p>
            <h2>Evening Review</h2>
          </div>
          <BookOpen size={20} style={{ color: "var(--muted)" }} />
        </div>

        <p className="journal-cta-desc">
          At the end of each day, review what you did and didn't do. Missed tasks roll to tomorrow automatically.
        </p>

        <button
          type="button"
          className={`journal-cta-btn ${hasTodayJournal ? "journal-cta-btn--edit" : ""}`}
          onClick={() => onOpenJournal(todayKey)}
        >
          <PenLine size={18} />
          {hasTodayJournal
            ? "Edit tonight's journal"
            : todayTaskCount > 0
              ? `Review today (${todayTaskCount} pending)`
              : "Write tonight's journal"}
        </button>
      </section>

      {/* Past Entries */}
      <section className="view-section">
        <div className="section-header">
          <div>
            <p className="section-header__eyebrow">Past Entries</p>
          </div>
          <span className="section-header__count">{entries.length}</span>
        </div>

        {entries.length === 0 ? (
          <div className="empty-copy empty-copy--roomy">
            <p>No journal entries yet.</p>
            <p style={{ marginTop: 4 }}>Start your first review tonight.</p>
          </div>
        ) : (
          <div className="journal-entry-list">
            {entries.map((entry) => (
              <JournalCard key={entry.date} summary={entry} onOpen={onOpenJournal} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
