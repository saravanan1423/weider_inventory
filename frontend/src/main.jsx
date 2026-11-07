import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SidebarDemo from "./components/sidebar-demo";
import AuthGate from "./components/AuthGate";
import "./tailwind.css";
import "./styles.css";
import "./components/QuotationPreview.css";

const params = new URLSearchParams(window.location.search);
const isSidebarDemo = params.has("sidebar-demo");
document.documentElement.classList.toggle(
  "dark",
  isSidebarDemo && params.get("theme") === "dark",
);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isSidebarDemo ? (
      <SidebarDemo />
    ) : (
      <AuthGate>
        {(user, userCanPrintApproved, onLogout) => (
          <App
            key={user.id}
            user={user}
            userCanPrintApproved={userCanPrintApproved}
            onLogout={onLogout}
          />
        )}
      </AuthGate>
    )}
  </React.StrictMode>,
);
