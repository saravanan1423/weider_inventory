// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { Sidebar, DesktopSidebar } from "../src/components/ui/sidebar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({
  matches: query.includes("prefers-reduced-motion"), media: query,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
}) });

test("reduced-motion preference changes sidebar width without a timed transition", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<Sidebar open={true}><DesktopSidebar>Content</DesktopSidebar></Sidebar>));
    await act(async () => { await vi.waitFor(() => expect((host.firstElementChild as HTMLElement).style.width).toBe("300px")); });
    act(() => root.render(<Sidebar open={false}><DesktopSidebar>Content</DesktopSidebar></Sidebar>));
    await act(async () => { await vi.waitFor(() => expect((host.firstElementChild as HTMLElement).style.width).toBe("60px")); });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
