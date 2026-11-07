// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import App from "../src/App";
import { api } from "../src/lib/api";
import { newQuotation } from "../src/lib/quotation";

vi.mock("../src/lib/api", () => ({ api: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("preview moves through saved quotes in order and keeps the editor draft", async () => {
  const saved = [1, 2].map((id) => ({
    ...newQuotation(),
    id,
    number: `QT-0000${id}`,
    billTo: { ...newQuotation().billTo, name: `Customer ${id}` },
  }));
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/quotations")
      return [...saved]
        .reverse()
        .map((quote) => ({
          id: quote.id,
          number: quote.number,
          customer: quote.billTo.name,
          date: quote.date,
          total: 0,
        }));
    if (path === "/quotations/next-number") return { number: "QT-00003" };
    if (path === "/approval-requests") return [];
    return saved.find(
      (quote) =>
        path === `/quotations/${quote.id}` ||
        path === `/quotations/${quote.id}/preview`,
    );
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (text) =>
    [
      ...(host.querySelector(".preview-modal") || host).querySelectorAll(
        "button",
      ),
    ].find((button) => button.textContent.trim() === text);
  const click = async (text) => {
    await act(async () => button(text).click());
  };
  try {
    await act(async () =>
      root.render(
        <App user={{ id: 1, role: "admin", name: "Administrator" }} />,
      ),
    );
    const input = host.querySelector(
      '[placeholder="Company or customer name"]',
    );
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(input, "Unsaved customer");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Preview");
    expect(host.querySelector(".quotation-address strong").textContent).toBe(
      "Unsaved customer",
    );
    expect(button("Next").disabled).toBe(true);
    await click("Previous");
    expect(host.querySelector(".quotation-address strong").textContent).toBe(
      "Customer 2",
    );
    expect(button("Next").disabled).toBe(true);
    await click("Previous");
    expect(host.querySelector(".quotation-address strong").textContent).toBe(
      "Customer 1",
    );
    expect(button("Previous").disabled).toBe(true);
    await click("Next");
    expect(host.querySelector(".quotation-address strong").textContent).toBe(
      "Customer 2",
    );
    act(() => host.querySelector('[aria-label="Close preview"]').click());
    expect(input.value).toBe("Unsaved customer");
    expect(host.querySelector('[aria-label="Quotation number"]').value).toBe(
      "QT-00003",
    );
    await click("Preview");
    expect(host.querySelector(".quotation-address strong").textContent).toBe(
      "Unsaved customer",
    );
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.mocked(api).mockReset();
  }
});

test("main-screen arrow buttons navigate saved quotations and retain edits", async () => {
  const saved = [1, 2].map((id) => ({
    ...newQuotation(),
    id,
    number: `QT-0000${id}`,
    billTo: { ...newQuotation().billTo, name: `Customer ${id}` },
  }));
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/quotations")
      return [...saved]
        .reverse()
        .map((quote) => ({
          id: quote.id,
          number: quote.number,
          customer: quote.billTo.name,
          date: quote.date,
          total: 0,
        }));
    if (path === "/quotations/next-number") return { number: "QT-00003" };
    return saved.find((quote) => path === `/quotations/${quote.id}`);
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const customer = () =>
    host.querySelector('[placeholder="Company or customer name"]');
  const changeName = (value) =>
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(customer(), value);
      customer().dispatchEvent(new Event("input", { bubbles: true }));
    });
  const click = async (label) => {
    await act(async () =>
      host.querySelector(`[aria-label="${label}"]`).click(),
    );
  };
  try {
    await act(async () =>
      root.render(
        <App user={{ id: 1, role: "admin", name: "Administrator" }} />,
      ),
    );
    changeName("Unsaved new customer");
    expect(
      host.querySelector('[aria-label="Previous quotation"] svg'),
    ).not.toBeNull();
    expect(
      host.querySelector('[aria-label="Next quotation"] svg'),
    ).not.toBeNull();
    await click("Previous quotation");
    expect(customer().value).toBe("Customer 2");
    changeName("Edited second customer");
    await click("Previous quotation");
    expect(customer().value).toBe("Customer 1");
    expect(
      host.querySelector('[aria-label="Previous quotation"]').disabled,
    ).toBe(true);
    await click("Next quotation");
    expect(customer().value).toBe("Edited second customer");
    expect(host.querySelector('[aria-label="Next quotation"]').disabled).toBe(
      true,
    );
    const newButton = [...host.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "New Quote",
    );
    await act(async () => newButton.click());
    expect(customer().value).toBe("Unsaved new customer");
    expect(host.querySelector('[aria-label="Quotation number"]').value).toBe(
      "QT-00003",
    );
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.mocked(api).mockReset();
  }
});

test("dashboard shows the actual saved validity date with old and new list responses", async () => {
  for (const includesValidity of [false, true]) {
    const quote = {
      ...newQuotation(),
      id: 1,
      number: "QT-00001",
      date: "2026-11-05",
      validity: "2026-12-10",
    };
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/quotations")
        return [
          {
            id: 1,
            number: quote.number,
            date: quote.date,
            customer: "Test customer",
            total: 0,
            ...(includesValidity ? { validity: quote.validity } : {}),
          },
        ];
      if (path === "/quotations/next-number") return { number: "QT-00002" };
      if (path === "/quotations/1") return quote;
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <App user={{ id: 1, role: "admin", name: "Administrator" }} />,
        ),
      );
      await act(async () => host.querySelector('[title="Dashboard"]').click());
      expect(host.querySelector(".saved-table thead").textContent).toContain(
        "QUOTE VALIDITY",
      );
      expect(
        host.querySelector(".saved-table tbody tr").children[3].textContent,
      ).toBe("10 Dec 2026");
      expect(
        vi.mocked(api).mock.calls.some(([path]) => path === "/quotations/1"),
      ).toBe(!includesValidity);
    } finally {
      act(() => root.unmount());
      host.remove();
      vi.mocked(api).mockReset();
    }
  }
});
