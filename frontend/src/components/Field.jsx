import React from "react";

export default function Field({
  label,
  children,
  className = "",
  required,
  ...props
}) {
  return (
    <label className={`field ${className}`}>
      <span>
        {label}
        {required && <b className="required"> *</b>}
      </span>
      {children || <input required={required} {...props} />}
    </label>
  );
}
