// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import App from "../src/App";
import AuthGate from "../src/components/AuthGate";
import { api, setCsrfToken } from "../src/lib/api";
import { newQuotation } from "../src/lib/quotation";

vi.mock("../src/lib/api", () => ({ api: vi.fn(), setCsrfToken: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return {
    host,
    root,
    destroy: () => {
      act(() => root.unmount());
      host.remove();
      vi.clearAllMocks();
    },
  };
}
function button(host, label) {
  return [...host.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
}
function change(input, value) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("user submission stays locked until approval and editing locks preview again", async () => {
  let saved = {
    ...newQuotation(),
    id: 1,
    number: "QT-00001",
    status: "pending",
    revision: 1,
  };
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/quotations" && options?.method === "POST") return saved;
    if (path === "/quotations")
      return [{ ...saved, customer: "Customer", total: 0 }];
    if (path === "/quotations/next-number") return { number: "QT-00002" };
    if (path.startsWith("/quotations/1")) return saved;
    throw new Error("Unexpected request " + path);
  });
  const { host, root, destroy } = mount();
  try {
    await act(async () =>
      root.render(<App user={{ id: 2, name: "Sales User", role: "user" }} />),
    );
    expect(button(host, "Preview").disabled).toBe(true);
    expect(button(host, "Accounts")).toBeUndefined();
    expect(button(host, "Submit for Approval")).toBeDefined();
    await act(async () =>
      host
        .querySelector("form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(host.querySelector(".workflow-banner").textContent).toContain(
      "Pending approval",
    );
    expect(button(host, "Preview").disabled).toBe(true);
    saved = { ...saved, status: "approved" };
    await act(async () => button(host, "Reload saved quotation").click());
    expect(button(host, "Preview").disabled).toBe(false);
    await act(async () => button(host, "Preview").click());
    expect(api).toHaveBeenCalledWith("/quotations/1/preview");
    expect(host.querySelector(".preview-modal")).not.toBeNull();
    expect(button(host, "Print / PDF").disabled).toBe(false);
    act(() => host.querySelector('[aria-label="Close preview"]').click());
    change(
      host.querySelector('[placeholder="Company or customer name"]'),
      "Changed company",
    );
    expect(button(host, "Preview").disabled).toBe(true);
  } finally {
    destroy();
  }
});

test("admin sees request names, products and prices and approves the saved revision", async () => {
  const quote = {
    ...newQuotation(),
    id: 7,
    number: "QT-00007",
    status: "pending",
    revision: 3,
  };
  let pending = [
    {
      id: 7,
      number: quote.number,
      revision: 3,
      requestedBy: "Sales Person",
      customer: "Acme Industries",
      total: 1180,
      products: [{ name: "Platform Scale", quantity: 1, price: 1000 }],
    },
  ];
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/quotations") return [];
    if (path === "/quotations/next-number") return { number: "QT-00008" };
    if (path === "/approval-requests") return pending;
    if (path === "/quotations/7/approve") {
      expect(JSON.parse(options.body)).toEqual({ revision: 3 });
      pending = [];
      return { ...quote, status: "approved" };
    }
    if (path === "/users") return [];
    throw new Error("Unexpected request " + path);
  });
  const { host, root, destroy } = mount();
  try {
    await act(async () =>
      root.render(<App user={{ id: 1, name: "Admin", role: "admin" }} />),
    );
    await act(async () =>
      host.querySelector('[aria-label="Approval requests (1)"]').click(),
    );
    for (const text of [
      "Sales Person",
      "Acme Industries",
      "Platform Scale",
      "1,000.00",
      "1,180.00",
    ])
      expect(host.textContent).toContain(text);
    await act(async () => button(host, "Approve").click());
    expect(host.textContent).toContain("No pending approval requests.");
    await act(async () => button(host, "Accounts").click());
    expect(host.textContent).toContain("Create account");
  } finally {
    destroy();
  }
});

test("sign in restores only authenticated sessions and clears them on expiry", async () => {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") {
      const error = new Error("Please sign in.");
      error.status = 401;
      throw error;
    }
    if (path === "/auth/login")
      return {
        user: { name: "Sales User", role: "user" },
        csrf: "test-csrf",
        userCanPrintApproved: true,
      };
    throw new Error("Unexpected request " + path);
  });
  const { host, root, destroy } = mount();
  try {
    await act(async () =>
      root.render(<AuthGate>{(user) => <p>Welcome {user.name}</p>}</AuthGate>),
    );
    expect(host.textContent).toContain("Sign in to Weider ERP");
    change(host.querySelector('[autocomplete="username"]'), "sales");
    change(host.querySelector('[type="password"]'), "Example-password");
    await act(async () =>
      host
        .querySelector("form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(host.textContent).toContain("Welcome Sales User");
    expect(setCsrfToken).toHaveBeenCalledWith("test-csrf");
    act(() => window.dispatchEvent(new Event("session-expired")));
    expect(host.textContent).toContain("Sign in to Weider ERP");
    expect(setCsrfToken).toHaveBeenCalledWith("");
  } finally {
    destroy();
  }
});
