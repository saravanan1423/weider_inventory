// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import Navbar from "../src/components/Navbar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(() => {
  if (root) act(() => root.unmount());
  document.body.innerHTML = "";
});

function render(quotes = []) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const props = { view: "editor", quotes, setView: vi.fn(), newQuote: vi.fn(), openQuote: vi.fn() };
  act(() => root.render(<Navbar {...props}/>));
  return props;
}
function button(text) {
  return [...document.querySelectorAll("button")].find(button => button.textContent.includes(text));
}

test("Sales actions open the existing quotation screens", () => {
  const props = render();
  act(() => button("Sales").click());
  expect(button("Sales").getAttribute("aria-expanded")).toBe("true");
  act(() => button("Create quotation").click());
  expect(props.newQuote).toHaveBeenCalledOnce();
  expect(button("Sales").getAttribute("aria-expanded")).toBe("false");
  act(() => button("Sales").click());
  act(() => button("Current quotation").click());
  expect(props.setView).toHaveBeenCalledWith("editor");
  act(() => button("Dashboard").click());
  expect(props.setView).toHaveBeenCalledWith("list");
});

test("recent quotations are real saved records and open the selected record", () => {
  const props = render([{ id: 7, number: "QT-00007", customer: "Test customer", date: "2026-11-04", total: 1180 }]);
  act(() => button("Recent Quotes").click());
  expect(document.body.textContent).toContain("QT-00007");
  act(() => button("Test customer").click());
  expect(props.openQuote).toHaveBeenCalledWith(7);
});

test("Escape and clicking outside dismiss an open navigation panel", () => {
  render();
  const sales = button("Sales");
  act(() => sales.click());
  const action = button("Create quotation");
  act(() => action.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(sales.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(sales);
  act(() => sales.click());
  act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(sales.getAttribute("aria-expanded")).toBe("false");
});
