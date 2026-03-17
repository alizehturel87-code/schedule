import { CalendarDays, FolderKanban, Flag } from "lucide-react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { view: "priority", icon: Flag, label: "Priority" },
  { view: "broad_heads", icon: FolderKanban, label: "Broad Heads" },
  { view: "calendar", icon: CalendarDays, label: "Calendar" },
];

export default function BottomNav({ activeView, onViewChange }) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__inner">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              type="button"
              className={`bottom-nav__item ${isActive ? "is-active" : ""}`}
              onClick={() => onViewChange(view)}
            >
              {isActive ? <motion.span layoutId="active-tab" className="bottom-nav__line" /> : null}
              <Icon size={19} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
