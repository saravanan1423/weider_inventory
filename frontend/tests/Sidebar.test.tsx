// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "../src/components/ui/sidebar";
import SidebarDemo from "../src/components/sidebar-demo";
import WorkspaceSidebar from "../src/components/WorkspaceSidebar";
import { cn } from "../src/lib/utils";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(() => { if (root) act(() => root.unmount()); document.body.innerHTML = ""; });
function render(content: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(content));
  return host;
}
function State() { const { open } = useSidebar(); return <span data-open={String(open)}>Sidebar state</span>; }

test("the mobile sidebar opens and closes through accessible controls", () => {
  const host = render(<Sidebar><SidebarBody><State/><SidebarLink link={{ label: "Dashboard", href: "#dashboard", icon: <span/> }}/></SidebarBody></Sidebar>);
  expect(host.querySelector('[data-open="false"]')).not.toBeNull();
  act(() => (host.querySelector('[aria-label="Open sidebar"]') as HTMLButtonElement).click());
  expect(host.querySelector('[aria-label="Open sidebar"]')?.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector('[data-open="true"]')).not.toBeNull();
  act(() => (host.querySelector('[aria-label="Close sidebar"]') as HTMLButtonElement).click());
  expect(host.querySelector('[aria-label="Open sidebar"]')?.getAttribute("aria-expanded")).toBe("false");
});

test("workspace sidebar actions reach the quotation screens", () => {
  const setView = vi.fn(); const newQuote = vi.fn();
  const host = render(<WorkspaceSidebar view="editor" count={3} setView={setView} newQuote={newQuote}/>);
  act(() => (host.querySelector('[title="Dashboard"]') as HTMLAnchorElement).click());
  expect(setView).toHaveBeenCalledWith("list");
  act(() => (host.querySelector('[title="New Quotation"]') as HTMLAnchorElement).click());
  expect(newQuote).toHaveBeenCalledOnce();
  expect(host.querySelector('[aria-current="page"]')?.textContent).toContain("Sales Quotation");
});

test("the supplied demo renders without console errors in light and dark themes", () => {
  const error = vi.spyOn(console, "error");
  const host = render(<SidebarDemo/>);
  expect(host.textContent).toContain("Dashboard");
  expect(host.querySelector('img')?.getAttribute('src')).toBe("https://assets.aceternity.com/manu.png");
  document.documentElement.classList.add("dark");
  act(() => root.render(<SidebarDemo/>));
  expect(host.textContent).toContain("Settings");
  document.documentElement.classList.remove("dark");
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
  expect(cn("w-[300px]", "w-[240px]")).toBe("w-[240px]");
});
