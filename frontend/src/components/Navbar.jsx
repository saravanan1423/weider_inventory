import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Box,
  ChevronDown,
  LayoutDashboard,
  FileText,
  Plus,
  ArrowUpRight,
  Clock3,
  ArrowRight,
} from "lucide-react";
import { currency } from "../lib/quotation";

// Floating navigation and shared spring transitions inspired by Aceternity Navbar Menu:
// https://ui.aceternity.com/components/navbar-menu
export default function Navbar({ view, quotes, setView, newQuote, openQuote }) {
  const [active, setActive] = useState(null);
  const container = useRef(null);
  const triggers = useRef({});
  const id = useId();
  const spring = { type: "spring", mass: 0.5, damping: 20, stiffness: 180 };

  useEffect(() => {
    function outside(event) {
      if (!container.current?.contains(event.target)) setActive(null);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  function act(action) {
    setActive(null);
    action();
  }
  function keyboard(event, name) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(name);
      requestAnimationFrame(() =>
        container.current?.querySelector(".navbar-panel button")?.focus(),
      );
    }
  }

  return (
    <header className="erp-navigation">
      <a className="navbar-brand" href="/" aria-label="Weider ERP home">
        <span className="navbar-logo">
          <img
            src="/weider-logo.png"
            alt="Weider logo"
            className="h-full w-full object-contain"
          />
        </span>
        <span>
          Weider <strong>ERP</strong>
        </span>
      </a>
      <div
        className="navbar-shell"
        ref={container}
        onMouseLeave={() => setActive(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setActive(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && active) {
            event.preventDefault();
            triggers.current[active]?.focus();
            setActive(null);
          }
        }}
      >
        <nav className="navbar-pill" aria-label="Main navigation">
          <button
            type="button"
            className={`navbar-link${view === "list" ? " current" : ""}`}
            aria-current={view === "list" ? "page" : undefined}
            onMouseEnter={() => setActive(null)}
            onFocus={() => setActive(null)}
            onClick={() => act(() => setView("list"))}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          {[
            ["sales", "Sales", FileText],
            ["recent", "Recent Quotes", Clock3],
          ].map(([name, label, Icon]) => (
            <button
              key={name}
              ref={(element) => {
                triggers.current[name] = element;
              }}
              type="button"
              className={`navbar-link${active === name ? " expanded" : ""}${name === "sales" && view === "editor" ? " current" : ""}`}
              aria-expanded={active === name}
              aria-controls={active === name ? `${id}-panel` : undefined}
              onMouseEnter={() => setActive(name)}
              onClick={() => setActive(active === name ? null : name)}
              onKeyDown={(event) => keyboard(event, name)}
            >
              <Icon size={16} />
              <span>{label}</span>
              <ChevronDown
                size={13}
                className={active === name ? "turned" : ""}
              />
            </button>
          ))}
        </nav>
        <AnimatePresence>
          {active && (
            <motion.div
              className="navbar-dropdown"
              key="menu"
              initial={{ opacity: 0, y: 9, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              transition={spring}
            >
              <motion.div
                layout
                className="navbar-panel"
                id={`${id}-panel`}
                transition={spring}
                aria-label={
                  active === "sales" ? "Sales navigation" : "Recent quotations"
                }
              >
                {active === "sales" ? (
                  <motion.div
                    key="sales"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="navbar-panel-heading">
                      <span>SALES WORKSPACE</span>
                      <span className="navbar-counter">
                        {quotes.length} saved
                      </span>
                    </div>
                    <div className="navbar-sales-grid">
                      <button
                        type="button"
                        className="navbar-feature"
                        onClick={() => act(newQuote)}
                      >
                        <span className="navbar-feature-icon">
                          <Plus size={22} />
                        </span>
                        <strong>
                          Create quotation <ArrowUpRight size={16} />
                        </strong>
                        <span>Prepare a new customer quotation.</span>
                      </button>
                      <div className="navbar-shortcuts">
                        <button
                          type="button"
                          onClick={() => act(() => setView("editor"))}
                        >
                          <FileText size={18} />
                          <span>
                            <strong>Current quotation</strong>
                            <small>Return to your quotation</small>
                          </span>
                          <ArrowRight size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => act(() => setView("list"))}
                        >
                          <LayoutDashboard size={18} />
                          <span>
                            <strong>All quotations</strong>
                            <small>View and search saved quotes</small>
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="recent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="navbar-panel-heading">
                      <span>RECENT QUOTATIONS</span>
                      <span className="navbar-counter">
                        {quotes.length} saved
                      </span>
                    </div>
                    {quotes.length ? (
                      <div className="navbar-recent-list">
                        {quotes.slice(0, 4).map((quote) => (
                          <button
                            type="button"
                            key={quote.id}
                            onClick={() => act(() => openQuote(quote.id))}
                          >
                            <span className="navbar-recent-icon">
                              <FileText size={18} />
                            </span>
                            <span className="navbar-recent-customer">
                              <strong>{quote.customer}</strong>
                              <small>
                                {quote.number} · {quote.date}
                              </small>
                            </span>
                            <span className="navbar-recent-total">
                              {currency(quote.total)}
                            </span>
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="navbar-empty">
                        <FileText size={25} />
                        <strong>No saved quotations yet</strong>
                        <span>Your saved quotations will appear here.</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="navbar-browse"
                      onClick={() => act(() => setView("list"))}
                    >
                      View all quotations
                      <ArrowRight size={15} />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="navbar-workspace">
        <span className="navbar-connection" />
        <span>Sales workspace</span>
        <span className="navbar-avatar">WE</span>
      </div>
    </header>
  );
}
