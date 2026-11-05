import React from "react";
import {
  FileText,
  ArrowUpRight,
  Search,
  ChevronRight,
  Plus,
} from "lucide-react";
import { currency, quoteValidityDate } from "../lib/quotation";
import { readDate } from "../lib/calendar";
export default function QuotationList({
  quotes,
  search,
  setSearch,
  open,
  newQuote,
}) {
  return (
    <>
      <div className="stats-grid">
        <div className="card stat">
          <span>Total quotations</span>
          <strong>{quotes.length}</strong>
          <FileText size={23} />
        </div>
        <div className="card stat">
          <span>Total quoted value</span>
          <strong>{currency(quotes.reduce((a, b) => a + b.total, 0))}</strong>
          <ArrowUpRight size={23} />
        </div>
      </div>
      <section className="card saved-card">
        <div className="section-title">
          <h2>All quotations</h2>
          <div className="search">
            <Search size={16} />
            <input
              aria-label="Search quotations"
              placeholder="Search customer or quotation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="saved-table">
            <thead>
              <tr>
                <th>QUOTATION</th>
                <th>CUSTOMER</th>
                <th>DATE</th>
                <th>QUOTE VALIDITY</th>
                <th className="align-right">AMOUNT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quotes
                .filter((v) =>
                  `${v.number} ${v.customer}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => open(v.id)}
                      >
                        {v.number}
                      </button>
                    </td>
                    <td>{v.customer}</td>
                    <td>{v.date}</td>
                    <td>
                      {!v.validityUnavailable
                        ? readDate(quoteValidityDate(v))?.toLocaleDateString(
                            "en-GB",
                            { day: "2-digit", month: "short", year: "numeric" },
                          ) || "—"
                        : "—"}
                    </td>
                    <td className="align-right">{currency(v.total)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${v.number}`}
                        onClick={() => open(v.id)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {quotes.length === 0 && (
          <div className="empty">
            <FileText size={32} />
            <h3>Your quotations start here</h3>
            <p>
              Create your first quotation to keep every detail in one place.
            </p>
            <button className="button primary" onClick={newQuote}>
              <Plus size={16} /> Create quotation
            </button>
          </div>
        )}
        {quotes.length > 0 &&
          !quotes.some((v) =>
            `${v.number} ${v.customer}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ) && <div className="empty">No matching quotations.</div>}
      </section>
    </>
  );
}
