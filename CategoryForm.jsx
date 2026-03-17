import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { CATEGORY_COLOR_CHOICES, CATEGORY_EMOJI_CHOICES } from "./plannerConstants";

export default function CategoryForm({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(CATEGORY_EMOJI_CHOICES[0]);
  const [color, setColor] = useState(CATEGORY_COLOR_CHOICES[0]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    onSubmit({
      name: name.trim(),
      emoji,
      color,
      system: false,
    });
  }

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
          className="sheet-panel"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-panel__header">
            <h2>New Category</h2>
            <button type="button" className="sheet-panel__close" onClick={onClose} aria-label="Close category form">
              <X size={20} />
            </button>
          </div>

          <form className="sheet-form" onSubmit={handleSubmit}>
            <input
              className="sheet-form__input sheet-form__input--title"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Category name"
              autoFocus
            />

            <div className="sheet-form__group">
              <label>Icon</label>
              <div className="emoji-grid">
                {CATEGORY_EMOJI_CHOICES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`emoji-pill ${emoji === item ? "is-active" : ""}`}
                    onClick={() => setEmoji(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-form__group">
              <label>Color</label>
              <div className="color-row">
                {CATEGORY_COLOR_CHOICES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`color-pill ${color === item ? "is-active" : ""}`}
                    style={{ "--swatch": item }}
                    onClick={() => setColor(item)}
                    aria-label={`Choose ${item} color`}
                  />
                ))}
              </div>
            </div>

            <div className="sheet-form__actions">
              <button type="submit" className="btn btn--primary">
                Create Category
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
