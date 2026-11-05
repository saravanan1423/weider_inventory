import React from "react";

export default function SectionHeading({ id, title, icon: Icon, children }) {
  return (
    <header className="main-section-heading">
      <div>
        {Icon && <Icon size={20} strokeWidth={1.8} />}
        <h2 id={id}>{title}</h2>
      </div>
      {children}
    </header>
  );
}
