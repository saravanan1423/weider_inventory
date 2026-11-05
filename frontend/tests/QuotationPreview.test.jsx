// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import QuotationPreview from "../src/components/QuotationPreview";
import { newQuotation, totals, currency } from "../src/lib/quotation";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("preview uses the Weider letterhead and current quotation data and totals", () => {
  const quote = newQuotation();
  quote.number = "QT-00007";
  quote.date = "2026-11-04";
  quote.validity = "2026-11-19";
  quote.billTo = { ...quote.billTo, name: "Billing Customer", address1: "Customer street", city: "Coimbatore", district: "Coimbatore", state: "Tamil Nadu", pin: "641107", gst: "33TESTGST1234567", phone: "9876543210" };
  quote.shipTo = { ...quote.shipTo, name: "Shipping Warehouse" };
  quote.items[0] = { ...quote.items[0], name: "Platform Scale", hsn: "8423", price: 1000, discount: 10, warranty: "yes", years: 2, coverage: "service" };
  const sum = totals(quote);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const close = vi.fn();
  const error = vi.spyOn(console, "error");
  try {
    act(() => root.render(<QuotationPreview q={quote} sum={sum} onClose={close}/>));
    expect(host.querySelector("h1").textContent).toBe("Weider Weighing & Automations");
    expect(host.querySelector(".quotation-company-info").textContent).toContain("Door No.5/162/A, Site No.304, Sri Sakthi Avenue");
    expect(host.querySelector(".quotation-company-logo").getAttribute("src")).toBe("/weider-logo.png");
    expect(host.textContent).toContain("Billing Customer");
    expect(host.textContent).toContain("Shipping Warehouse");
    expect(host.textContent).toContain("QT-00007");
    expect(host.querySelector('.quotation-corner-details').textContent).toContain('19 Nov 2026');
    expect(host.querySelector(".quotation-document-items tbody tr td:last-child").textContent).toBe(currency(900));
    expect(host.querySelector(".quotation-document-totals .grand td").textContent).toBe(currency(sum.total));
    expect(host.textContent).toContain("CGST @ 9%");
    expect(host.textContent).toContain("SGST @ 9%");
    expect(host.textContent).toContain("One Thousand Sixty Two Rupees Only");
    act(() => host.querySelector('[aria-label="Close preview"]').click());
    expect(close).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount()); host.remove(); error.mockRestore();
  }
});
