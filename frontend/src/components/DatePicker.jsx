import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react";
import { dateKey, monthDays, readDate, shiftMonth } from "../lib/calendar";
import "./DatePicker.css";

const fullDate = (date) =>
  date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function CalendarDialog({ value, onChange, onClose, title }) {
  const [draft, setDraft] = useState(() => readDate(value) || new Date());
  const [month, setMonth] = useState(() => readDate(value) || new Date());
  const dialog = useRef(null);
  const titleId = useId();
  const today = dateKey(new Date());
  const cells = monthDays(month);
  const inMonth = (date) =>
    date.getMonth() === month.getMonth() &&
    date.getFullYear() === month.getFullYear();
  const focusDate = inMonth(draft)
    ? dateKey(draft)
    : dateKey(new Date(month.getFullYear(), month.getMonth(), 1, 12));

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const app = document.getElementById("root");
    const previousInert = app?.inert;
    if (app) app.inert = true;
    document.body.style.overflow = "hidden";
    dialog.current.querySelector('[data-calendar-focus="true"]')?.focus();
    return () => {
      if (app) app.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function handleDialogKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    if (event.key !== "Tab") return;
    const buttons = [
      ...dialog.current.querySelectorAll("button:not(:disabled)"),
    ].filter((button) => button.tabIndex >= 0);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function keyboardDate(event, date) {
    let next;
    const offsets = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -date.getDay(),
      End: 6 - date.getDay(),
    };
    if (Object.hasOwn(offsets, event.key)) {
      next = new Date(date);
      next.setDate(next.getDate() + offsets[event.key]);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      next = shiftMonth(
        date,
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1),
      );
    } else return;
    event.preventDefault();
    setDraft(next);
    setMonth(next);
    requestAnimationFrame(() =>
      dialog.current?.querySelector(`[data-date="${dateKey(next)}"]`)?.focus(),
    );
  }

  return createPortal(
    <div
      className="date-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="date-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKey}
      >
        <aside className="date-sidebar">
          <div className="date-summary">
            <span className="date-summary-icon">
              <CalendarDays size={23} />
            </span>
            <span className="date-caption">DATE</span>
            <strong aria-live="polite">
              {draft.toLocaleDateString("en-GB", { weekday: "long" })},{" "}
              {draft.getDate()}
              <br />
              {draft.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </strong>
          </div>
          <button
            type="button"
            className="date-today"
            onClick={() => {
              const now = new Date();
              setDraft(now);
              setMonth(now);
            }}
          >
            <RefreshCw size={17} />
            Use Today&apos;s Date
          </button>
        </aside>
        <div className="date-content">
          <header className="date-header">
            <h2 id={titleId}>{title}</h2>
            <button
              type="button"
              className="date-close"
              aria-label="Close date picker"
              onClick={onClose}
            >
              <X size={21} />
            </button>
          </header>
          <div className="date-month-nav">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <h3 aria-live="polite">
              {month.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div
            className="date-calendar"
            role="grid"
            aria-label={month.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          >
            <div className="date-week" role="row">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} role="columnheader">
                  {day}
                </span>
              ))}
            </div>
            {Array.from({ length: cells.length / 7 }, (_, week) => (
              <div className="date-week" role="row" key={week}>
                {cells.slice(week * 7, week * 7 + 7).map((date) => {
                  const key = dateKey(date);
                  const selected = key === dateKey(draft);
                  return (
                    <div role="gridcell" aria-selected={selected} key={key}>
                      <button
                        type="button"
                        data-date={key}
                        data-calendar-focus={key === focusDate}
                        tabIndex={key === focusDate ? 0 : -1}
                        aria-label={fullDate(date)}
                        aria-current={key === today ? "date" : undefined}
                        className={`date-day${!inMonth(date) ? " outside-month" : ""}${selected ? " selected" : ""}${key === today ? " today" : ""}`}
                        onClick={() => {
                          setDraft(date);
                          if (!inMonth(date)) setMonth(date);
                        }}
                        onKeyDown={(event) => keyboardDate(event, date)}
                      >
                        {date.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <footer className="date-actions">
            <button type="button" className="date-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="date-confirm"
              onClick={() => {
                onChange(dateKey(draft));
                onClose();
              }}
            >
              OK
            </button>
          </footer>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default function DatePicker({
  value,
  onChange,
  label = "Choose quotation date",
  title = "Select Date",
}) {
  const [open, setOpen] = useState(false);
  const date = readDate(value);
  return (
    <>
      <button
        type="button"
        className="date-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>
          {date
            ? date
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                .replaceAll(" ", "-")
            : "Select date"}
        </span>
        <CalendarDays size={17} />
      </button>
      {open && (
        <CalendarDialog
          title={title}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
