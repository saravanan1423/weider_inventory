import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function CollapsibleSection({
  id,
  title,
  icon: Icon,
  className = "",
  trailing,
  children,
}) {
  const [open, setOpen] = useState(true);
  return (
    <details
      className={`quotation-section collapsible-section ${className}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onInvalidCapture={(event) => {
        event.currentTarget.open = true;
        setOpen(true);
      }}
    >
      <summary className="collapsible-heading">
        <h2 id={id}>
          <Icon size={20} strokeWidth={1.8} />
          <span>{title}</span>
          {trailing && <span className="collapsible-trailing">{trailing}</span>}
          <ChevronDown className="section-chevron" size={16} />
        </h2>
      </summary>
      <div className="collapsible-content">{children}</div>
    </details>
  );
}
