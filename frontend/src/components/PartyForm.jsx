import Select from "./Select";
import React from "react";
import Field from "./Field";
import { indianStates, unionTerritories } from "../lib/indianStates";

export default function PartyForm({
  title,
  icon: Icon,
  value,
  onChange,
  disabled,
  children,
}) {
  const field = (key, label, options = {}) => (
    <Field
      label={label}
      value={value[key] ?? ""}
      disabled={disabled}
      onChange={(event) =>
        onChange({
          ...value,
          [key]:
            key === "phone"
              ? event.target.value.replace(/[^0-9]/g, "").slice(0, 10)
              : event.target.value,
        })
      }
      {...options}
    />
  );
  return (
    <section className="card party-card">
      <div className="section-title">
        <div>
          <span className="section-icon">
            <Icon size={21} />
          </span>
          <h3>{title}</h3>
        </div>
        {children}
      </div>
      <div className="party-fields">
        {field("name", "Name", {
          required: true,
          className: "horizontal",
          placeholder: "Company or customer name",
        })}
        {field("address1", "Address Line 1", {
          className: "horizontal",
          placeholder: "Street address",
        })}
        {field("address2", "Address Line 2", {
          className: "horizontal",
          placeholder: "Area, building or suite",
        })}
        <div className="field-row location-row">
          {field("city", "City", { placeholder: "City" })}
          {field("district", "District", { placeholder: "District" })}
          <Field label="State" required>
            <Select
              required
              validationMessage="Please select a state."
              aria-label="State"
              value={value.state || ""}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...value, state: event.target.value })
              }
            >
              <option value="">Select state</option>
              {value.state &&
                ![...indianStates, ...unionTerritories].includes(
                  value.state,
                ) && <option value={value.state}>{value.state}</option>}
              <optgroup label="States">
                {indianStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Union Territories">
                {unionTerritories.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
        </div>
        <div className="field-row registration-row">
          {field("pin", "PIN Code", {
            placeholder: "PIN code",
            pattern: "[0-9]{6}",
            maxLength: 6,
          })}
          {field("gst", "GST Number", {
            placeholder: "GST identification number",
            maxLength: 15,
          })}
        </div>
        <div className="field-row contact-row">
          {field("contactName", "Contact Name", { placeholder: "Full name" })}
          {field("phone", "Contact Number", {
            required: true,
            type: "tel",
            inputMode: "numeric",
            maxLength: 10,
            pattern: "[0-9]{10}",
            title: "Enter a 10-digit contact number",
            placeholder: "Phone number",
          })}
          {field("email", "Contact Email", {
            type: "email",
            placeholder: "name@company.com",
          })}
        </div>
      </div>
    </section>
  );
}
