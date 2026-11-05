import Select from "./Select";
import React from "react";
import CollapsibleSection from "./CollapsibleSection";
import QuotationSummary from "./QuotationSummary";
import { ShoppingCart, Plus, Trash2 } from "lucide-react";
import {
  currency,
  lineTotal,
  newItem,
  appliedTaxRate,
  taxMode,
} from "../lib/quotation";

export default function ItemsTable({
  items,
  onChange,
  billState,
  sum,
  freightCharges,
  onFreightChange,
  freight,
  onFreightTypeChange,
}) {
  const update = (index, key, value) =>
    onChange(
      items.map((item, n) => (n === index ? { ...item, [key]: value } : item)),
    );
  return (
    <CollapsibleSection
      id="item-details-heading"
      title="Item Details"
      icon={ShoppingCart}
      trailing={
        <span className="item-count">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      }
    >
      <div className="card items-card">
        <div className="table-scroll">
          <table className="items-table">
            <colgroup>
              <col className="col-serial" />
              <col className="col-name" />
              <col className="col-hsn" />
              <col className="col-qty" />
              <col className="col-unit" />
              <col className="col-price" />
              <col className="col-discount" />
              <col className="col-tax" />
              <col className="col-total" />
              <col className="col-remove" />
            </colgroup>
            <thead>
              <tr>
                <th>S.No</th>
                <th>
                  Item Name <b>*</b>
                </th>
                <th>HSN Code</th>
                <th>
                  Qty <b>*</b>
                </th>
                <th>Unit</th>
                <th>
                  Unit Price (₹) <b>*</b>
                </th>
                <th>Disc. %</th>
                <th>Tax</th>
                <th className="align-right">Total Price (₹)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="serial">{index + 1}</td>
                  <td>
                    <input
                      aria-label={`Item ${index + 1} name`}
                      placeholder="Enter item name"
                      value={item.name}
                      required
                      onChange={(e) => update(index, "name", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Item ${index + 1} HSN code`}
                      placeholder="HSN code"
                      value={item.hsn}
                      onChange={(e) => update(index, "hsn", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Item ${index + 1} quantity`}
                      type="number"
                      min="0.001"
                      step="any"
                      required
                      value={item.quantity}
                      onChange={(e) =>
                        update(index, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <Select
                      aria-label={`Item ${index + 1} unit`}
                      value={item.unit}
                      onChange={(e) => update(index, "unit", e.target.value)}
                    >
                      {["No's", "kg", "m"].map((unit) => (
                        <option key={unit}>{unit}</option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <input
                      aria-label={`Item ${index + 1} unit price`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      required
                      value={item.price}
                      onChange={(e) => update(index, "price", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Item ${index + 1} discount`}
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={item.discount}
                      onChange={(e) =>
                        update(index, "discount", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <Select
                      aria-label={`Item ${index + 1} tax`}
                      value={appliedTaxRate(item, billState)}
                      disabled={taxMode(billState) === "inter"}
                      onChange={(e) => update(index, "tax", e.target.value)}
                    >
                      {[0, 0.1, 5, 12, 18].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="line-total">
                    {currency(lineTotal(item, billState))}
                  </td>
                  <td>
                    <button
                      className="icon-button delete"
                      type="button"
                      disabled={items.length === 1}
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() =>
                        onChange(items.filter((_, n) => n !== index))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="item-add-row">
                <td colSpan={10}>
                  {" "}
                  <div className="add-item-bar">
                    <button
                      className="button add-button"
                      type="button"
                      onClick={() => onChange([...items, newItem()])}
                    >
                      <Plus size={15} />
                      Add Item
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
            <QuotationSummary
              freight={freight}
              onFreightTypeChange={onFreightTypeChange}
              sum={sum}
              freightCharges={freightCharges}
              onFreightChange={onFreightChange}
            />
          </table>
        </div>
      </div>
    </CollapsibleSection>
  );
}
