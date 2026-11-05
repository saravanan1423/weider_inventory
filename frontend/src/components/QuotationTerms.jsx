import Select from "./Select";
import React from "react";
import { ShieldCheck } from "lucide-react";
import Field from "./Field";
import CollapsibleSection from "./CollapsibleSection";

export default function QuotationTerms({ quote, updateItem }) {
  const namedItems = quote.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.name.trim());
  return (
    <div className="terms-grid">
      <CollapsibleSection
        id="warranty-heading"
        title="Warranty & Service"
        icon={ShieldCheck}
      >
        <div className="card warranty-card">
          <div className="warranty-fields">
            {namedItems.length === 0 && (
              <p className="warranty-empty">No item for warranty.</p>
            )}
            {namedItems.map(({ item, index }) => (
              <div className="warranty-entry" key={index}>
                <div className="warranty-item-name">
                  {index + 1}. {item.name}
                </div>
                <div className="radio-line">
                  <span>
                    Warranty <b className="required">*</b>
                  </span>
                  {["yes", "no"].map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={`warranty-${index}`}
                        value={option}
                        checked={item.warranty === option}
                        onChange={() => updateItem(index, "warranty", option)}
                      />
                      {option === "yes" ? "Yes" : "No"}
                    </label>
                  ))}
                </div>
                {item.warranty === "yes" && (
                  <div className="field-row warranty-detail">
                    <Field
                      label="Years"
                      required
                      type="number"
                      min="0.1"
                      step="any"
                      value={item.years}
                      onChange={(e) =>
                        updateItem(index, "years", e.target.value)
                      }
                    />
                    <Field label="Service / Replacement">
                      <Select
                        value={item.coverage}
                        aria-label={`Item ${index + 1} warranty coverage`}
                        onChange={(e) =>
                          updateItem(index, "coverage", e.target.value)
                        }
                      >
                        <option value="service">Service</option>
                        <option value="replacement">Replacement</option>
                      </Select>
                    </Field>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
