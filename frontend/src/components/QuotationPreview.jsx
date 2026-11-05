import React from "react";
import { Printer, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  currency,
  itemTax,
  appliedTaxRate,
  signedCurrency,
  quoteValidityDate,
} from "../lib/quotation";
import { amountInWords } from "../lib/amountInWords";
import { readDate } from "../lib/calendar";

const company = "Weider Weighing & Automations";
const formatDate = (value) =>
  readDate(value)?.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) || value;

function AddressBlock({ title, address }) {
  return (
    <section className="quotation-address">
      <h3>{title}</h3>
      <div>
        <strong>{address.name || "—"}</strong>
        {[
          address.address1,
          address.address2,
          [address.city, address.district, address.state]
            .filter(Boolean)
            .join(", "),
          [address.pin, address.state ? "India" : ""]
            .filter(Boolean)
            .join(", "),
        ]
          .filter(Boolean)
          .map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        {address.contactName && <p>Contact: {address.contactName}</p>}
        {address.phone && <p>Phone: {address.phone}</p>}
        {address.email && <p>Email: {address.email}</p>}
        {address.gst && (
          <p>
            <b>GSTIN:</b> {address.gst}
          </p>
        )}
      </div>
    </section>
  );
}

export default function QuotationPreview({
  q,
  sum,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  loading = false,
  navigationError = "",
  positionLabel = "",
}) {
  const rows = [
    ["Basic Total", sum.subtotal, ""],
    ["Discount", -sum.discount, ""],
    ["Sub Total", sum.taxable, "highlight"],
    ...sum.taxBreakdown.map((row) => [row.label, row.amount, ""]),
    ["Total Tax Amount", sum.tax, "highlight"],
    [`Freight (${q.freight === "paid" ? "Paid" : "To Pay"})`, sum.freight, ""],
    ["Round Off", sum.roundOff, ""],
    ["Grand Total (Including Tax)", sum.total, "grand"],
  ];
  return (
    <div className="modal-backdrop quotation-preview-backdrop">
      <div
        className="preview-modal quotation-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quotation preview"
      >
        <div className="preview-toolbar">
          <strong>Quotation preview</strong>
          <div>
            <div
              className="preview-navigation"
              role="group"
              aria-label="Browse saved quotations"
            >
              <button
                type="button"
                className="button"
                onClick={onPrevious}
                disabled={!hasPrevious || loading}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              {positionLabel && (
                <span className="preview-position" aria-live="polite">
                  {loading ? "Loading…" : positionLabel}
                </span>
              )}
              <button
                type="button"
                className="button"
                onClick={onNext}
                disabled={!hasNext || loading}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
            <button
              type="button"
              className="button primary"
              onClick={() => window.print()}
              disabled={loading}
            >
              <Printer size={16} />
              Print / PDF
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Close preview"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {navigationError && (
          <div className="preview-navigation-error" role="alert">
            {navigationError}
          </div>
        )}
        <div className="quotation-preview-scroll" aria-busy={loading}>
          <article className="quotation-paper">
            <header className="quotation-company-header">
              <div className="quotation-company-identity">
                <img
                  className="quotation-company-logo"
                  src="/weider-logo.png"
                  alt="Weider logo"
                />
                <div className="quotation-company-info">
                  <h1>{company}</h1>
                  <p>
                    Door No.5/162/A, Site No.304, Sri Sakthi Avenue,
                    <br />
                    Nanjundapuram, Kallipalayam Post,
                    <br />
                    Coimbatore - 641107, Tamil Nadu, India
                  </p>
                </div>
              </div>
              <div className="quotation-document-meta">
                <table
                  className="quotation-corner-details"
                  aria-label="Quotation information"
                >
                  <tbody>
                    <tr>
                      <th scope="row">Quotation No.</th>
                      <td>
                        <strong>{q.number || "Draft quotation"}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Quotation Date</th>
                      <td>{formatDate(q.date)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Delivery Time</th>
                      <td>{q.deliveryTime || "—"}</td>
                    </tr>
                    <tr>
                      <th scope="row">Quote Validity</th>
                      <td>{formatDate(quoteValidityDate(q))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </header>
            <div className="quotation-parties">
              <AddressBlock title="Billing Address" address={q.billTo} />
              <AddressBlock title="Shipping Address" address={q.shipTo} />
            </div>
            <table className="quotation-document-items">
              <colgroup>
                <col className="document-col-serial" />
                <col className="document-col-description" />
                <col className="document-col-hsn" />
                <col className="document-col-quantity" />
                <col className="document-col-price" />
                <col className="document-col-discount" />
                <col className="document-col-tax" />
                <col className="document-col-amount" />
              </colgroup>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Description</th>
                  <th>HSN Code</th>
                  <th>Qty / Unit</th>
                  <th>Unit Rate (₹)</th>
                  <th>Disc.</th>
                  <th>Tax</th>
                  <th>
                    Amount (₹)<small>Before tax</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{item.name || "—"}</strong>
                      {item.warranty === "yes" && item.name.trim() && (
                        <small>
                          Warranty: {item.years} year(s),{" "}
                          {item.coverage === "replacement"
                            ? "replacement"
                            : "service"}
                        </small>
                      )}
                    </td>
                    <td>{item.hsn || "—"}</td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>{currency(item.price)}</td>
                    <td>{item.discount}%</td>
                    <td>{appliedTaxRate(item, q.billTo.state)}%</td>
                    <td>{currency(itemTax(item, q.billTo.state).net)}</td>
                  </tr>
                ))}
                {Array.from(
                  { length: Math.max(0, 6 - q.items.length) },
                  (_, index) => (
                    <tr
                      className="quotation-blank-row"
                      aria-hidden="true"
                      key={`blank-${index}`}
                    >
                      {Array.from({ length: 8 }, (_, column) => (
                        <td key={column}>&nbsp;</td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <div className="quotation-calculation-area">
              <section className="quotation-thanks">
                <p>Thank you for your business!</p>
                <span>E. & O.E.</span>
              </section>
              <table
                className="quotation-document-totals"
                aria-label="Quotation totals"
              >
                <tbody>
                  {rows.map(([label, value, style]) => (
                    <tr className={style} key={label}>
                      <th scope="row">{label}</th>
                      <td>
                        {label === "Round Off"
                          ? signedCurrency(value)
                          : currency(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="quotation-document-footer">
              <div className="quotation-words">
                <strong>Amount in Words:</strong>
                <p>{amountInWords(sum.total)}</p>
              </div>
              <div className="quotation-signature">
                <strong>For {company}</strong>
                <span>Authorized Signatory</span>
              </div>
            </footer>
            <div className="quotation-bottom-bar" />
          </article>
        </div>
      </div>
    </div>
  );
}
