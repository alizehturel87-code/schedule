import { Calendar, Flag, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "priority", label: "Priority", icon: Flag },
  { id: "category", label: "Category", icon: LayoutGrid },
];

export default function BottomNav({ activeView, onViewChange }) {
  return (
    <nav className="planner-nav">
      <div className="planner-nav__inner">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`planner-nav__item ${isActive ? "is-active" : ""}`}
              onClick={() => onViewChange(item.id)}
            >
              {isActive ? <motion.span layoutId="nav-line" className="planner-nav__line" /> : null}
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
