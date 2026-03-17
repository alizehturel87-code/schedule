import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function BroadHeadForm({ broadHead, onClose, onSubmit, onDelete }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setTitle(broadHead?.title || "");
    setNotes(broadHead?.notes || "");
  }, [broadHead]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      id: broadHead?.id || "",
      title,
      notes,
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
          className="sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet__header">
            <div>
              <p className="sheet__eyebrow">{broadHead ? "Update broad head" : "Create broad head"}</p>
              <h2>{broadHead ? "Edit Broad Head" : "New Broad Head"}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close broad head form">
              <X size={20} />
            </button>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Broad head title</span>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="For example: Finance, Course Launch, Marketing"
                maxLength={120}
                required
              />
            </label>

            <label className="form-field">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context for this broad head"
                rows={4}
              />
            </label>

            <div className="sheet__actions">
              {broadHead ? (
                <button type="button" className="btn btn--ghost btn--danger" onClick={() => onDelete(broadHead)}>
                  Delete
                </button>
              ) : null}
              <button type="submit" className="btn btn--primary">
                {broadHead ? "Save changes" : "Create broad head"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
