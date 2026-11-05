// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import Select from "../src/components/Select";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(() => {
  if (root) act(() => root.unmount());
  document.body.innerHTML = "";
});

function render(props = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Select aria-label="State" value="Karnataka" {...props}>
    <option value="">Select state</option>
    <optgroup label="States"><option value="Karnataka">Karnataka</option><option value="Kerala">Kerala</option></optgroup>
    <optgroup label="Union Territories"><option value="Delhi">Delhi</option></optgroup>
  </Select>));
  return host.querySelector('[role="combobox"]');
}
function key(button, value) {
  act(() => button.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
}

test("a required dropdown prevents form submission until a state is selected", () => {
  const host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
  function Form() {
    const [value, setValue] = React.useState("");
    return <form><Select aria-label="State" required value={value} onChange={event => setValue(event.target.value)}><option value="">Select state</option><option value="Tamil Nadu">Tamil Nadu</option></Select></form>;
  }
  act(() => root.render(<Form/>));
  const form = host.querySelector("form");
  let valid;
  act(() => { valid = form.checkValidity(); });
  expect(valid).toBe(false);
  expect(host.querySelector('[role="combobox"]').getAttribute("aria-invalid")).toBe("true");
  act(() => host.querySelector('[role="combobox"]').click());
  const option = [...document.querySelectorAll('[role="option"]')].find(option => option.textContent === "Tamil Nadu");
  act(() => option.click());
  expect(form.checkValidity()).toBe(true);
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

test("menu is portaled outside its container and selecting an option updates the value", () => {
  const change = vi.fn();
  const button = render({ onChange: change });
  act(() => button.click());
  const menu = document.querySelector('[role="listbox"]');
  expect(menu.parentElement).toBe(document.body);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  const option = [...menu.querySelectorAll('[role="option"]')].find(option => option.textContent === "Kerala");
  act(() => option.click());
  expect(change).toHaveBeenCalledWith({ target: { value: "Kerala" } });
  expect(document.querySelector('[role="listbox"]')).toBeNull();
});

test("keyboard selects the next option and Escape closes without changing the value", () => {
  const change = vi.fn();
  const button = render({ onChange: change });
  key(button, "ArrowDown");
  key(button, "ArrowDown");
  key(button, "Enter");
  expect(change).toHaveBeenCalledWith({ target: { value: "Kerala" } });
  change.mockClear();
  key(button, "Enter");
  key(button, "Escape");
  expect(change).not.toHaveBeenCalled();
  expect(button.getAttribute("aria-expanded")).toBe("false");
});

test("typing finds a state and clicking outside closes the menu", () => {
  const change = vi.fn();
  const button = render({ onChange: change });
  key(button, "d");
  key(button, "Enter");
  expect(change).toHaveBeenCalledWith({ target: { value: "Delhi" } });
  act(() => button.click());
  act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(button.getAttribute("aria-expanded")).toBe("false");
});

test("a disabled dropdown cannot be opened", () => {
  const button = render({ disabled: true });
  act(() => button.click());
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  expect(button.disabled).toBe(true);
});
