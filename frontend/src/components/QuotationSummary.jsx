import React from "react";
import { currency, signedCurrency } from "../lib/quotation";

export default function QuotationSummary({
  sum,
  freightCharges,
  onFreightChange,
  freight,
  onFreightTypeChange,
}) {
  const row = (label, amount, className = "", signed = false) => (
    <tr className={className} key={label}>
      <th scope="row" colSpan={8}>
        {label}
      </th>
      <td colSpan={2}>{signed ? signedCurrency(amount) : currency(amount)}</td>
    </tr>
  );
  return (
    <tfoot className="quotation-totals">
      {row("Basic Total", sum.subtotal)}
      {row("Discount", -sum.discount)}
      {row("Sub Total", sum.taxable, "totals-subtotal")}
      {sum.taxBreakdown.map((tax) => row(tax.label, tax.amount))}
      {row("Total Tax Amount", sum.tax, "totals-tax-total")}
      {row("Round Off", sum.roundOff, "", true)}
      <tr>
        <th scope="row" colSpan={8}>
          <div className="freight-table-options">
            <label htmlFor="freight-amount">Freight (₹)</label>
            <div
              className="freight-payment-options"
              role="radiogroup"
              aria-label="Freight payment"
            >
              {[
                ["to_pay", "To Pay"],
                ["paid", "Paid"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="freight"
                    value={value}
                    checked={freight === value}
                    onChange={() => onFreightTypeChange(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </th>
        <td colSpan={2}>
          <input
            id="freight-amount"
            className="freight-amount-input"
            type="number"
            min="0"
            step="0.01"
            required
            value={freightCharges}
            onChange={(event) => onFreightChange(event.target.value)}
          />
        </td>
      </tr>
      {row("Grand Total", sum.total, "totals-grand-total")}
    </tfoot>
  );
}
