// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import DatePicker from "../src/components/DatePicker";
import { dateKey, monthDays } from "../src/lib/calendar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(() => {
  if (root) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
});

function render(value = "2026-11-04") {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const change = vi.fn();
  act(() => root.render(<DatePicker value={value} onChange={change}/>));
  const trigger = host.querySelector("button");
  trigger.focus();
  act(() => trigger.click());
  return { change, trigger };
}
function clickText(text) {
  const button = [...document.querySelectorAll("button")].find(button => button.textContent === text);
  act(() => button.click());
}

test("a tentative selection is saved only when OK is clicked", () => {
  const { change, trigger } = render();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.activeElement.dataset.date).toBe("2026-11-04");
  act(() => document.querySelector('[data-date="2026-11-20"]').click());
  expect(change).not.toHaveBeenCalled();
  clickText("OK");
  expect(change).toHaveBeenCalledWith("2026-11-20");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("Cancel discards the tentative date", () => {
  const { change, trigger } = render();
  act(() => document.querySelector('[data-date="2026-11-20"]').click());
  clickText("Cancel");
  expect(change).not.toHaveBeenCalled();
  act(() => trigger.click());
  expect(document.querySelector('[data-date="2026-11-04"]').parentElement.getAttribute("aria-selected")).toBe("true");
});

test("the validity date picker has its own label and supports choosing a date", () => {
  const host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  const change = vi.fn();
  act(() => root.render(<DatePicker value="2026-11-20" onChange={change} label="Choose quote validity date" title="Select Validity Date"/>));
  act(() => host.querySelector('[aria-label="Choose quote validity date"]').click());
  expect(document.querySelector('.date-header h2').textContent).toBe('Select Validity Date');
  act(() => document.querySelector('[data-date="2026-11-25"]').click());
  clickText('OK');
  expect(change).toHaveBeenCalledWith('2026-11-25');
});

test("month navigation handles December to January and leap-day selection", () => {
  const { change } = render("2023-12-31");
  act(() => document.querySelector('[aria-label="Next month"]').click());
  expect(document.querySelector('.date-month-nav h3').textContent).toBe("January 2024");
  act(() => document.querySelector('[aria-label="Next month"]').click());
  act(() => document.querySelector('[data-date="2024-02-29"]').click());
  clickText("OK");
  expect(change).toHaveBeenCalledWith("2024-02-29");
  expect(monthDays(new Date(2024, 1, 1)).some(date => dateKey(date) === "2024-02-29")).toBe(true);
});

test("Today picks the local date and Escape dismisses the picker", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 4, 10));
  const { change, trigger } = render("2025-01-01");
  clickText("Use Today's Date");
  clickText("OK");
  expect(change).toHaveBeenCalledWith("2026-11-04");
  change.mockClear();
  act(() => trigger.click());
  act(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(change).not.toHaveBeenCalled();
});
