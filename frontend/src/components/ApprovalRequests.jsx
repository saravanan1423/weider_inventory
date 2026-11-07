import React from "react";
import { currency } from "../lib/quotation";

export default function ApprovalRequests({ requests, open, approve, busy }) {
  return (
    <section className="card workflow-card">
      <div className="section-title">
        <h2>Quotation approval requests</h2>
        <span>{requests.length} pending</span>
      </div>
      {!requests.length ? (
        <div className="empty">No pending approval requests.</div>
      ) : (
        <div className="table-scroll">
          <table className="saved-table">
            <thead>
              <tr>
                <th>Quotation / Requested by</th>
                <th>Customer</th>
                <th>Products / Unit price</th>
                <th className="align-right">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong>{q.number}</strong>
                    <small className="workflow-subtext">{q.requestedBy}</small>
                  </td>
                  <td>{q.customer}</td>
                  <td>
                    {q.products.map((p, i) => (
                      <div key={i}>
                        {p.name}{" "}
                        <span className="workflow-subtext">
                          {p.quantity} × {currency(p.price)}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="align-right">{currency(q.total)}</td>
                  <td>
                    <div className="workflow-actions">
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => open(q.id, true)}
                      >
                        Review / Edit
                      </button>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => approve(q)}
                      >
                        Approve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
