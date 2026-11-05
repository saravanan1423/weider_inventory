# Aceternity Sidebar integration

The two source files were copied from the supplied attachment. The project had no `components.json`, so the manual installation path was used.

- `frontend/src/components/ui/sidebar.tsx` retains all requested exports and the source Tailwind class lists.
- `frontend/src/components/sidebar-demo.tsx` contains the reference demo, including its placeholder dashboard, Acet Labs branding, links, avatar URL, and 60vh wrapper.
- Light reference demo: http://localhost:5050/?sidebar-demo
- Dark reference demo: http://localhost:5050/?sidebar-demo&theme=dark
- Working quotation application: http://localhost:5050/

## Differences from the supplied source

1. **Project setup:** Added Tailwind CSS v4 through its Vite plugin, TypeScript configuration, Tabler icons, clsx, and tailwind-merge. Motion was already installed. Added the `@/` alias in Vite and TypeScript so the original imports work without rewriting them. The `cn` helper merges Tailwind utilities as requested.
2. **Reduced motion:** The source did not include preference handling. Added `MotionConfig reducedMotion="user"` and zero-duration sidebar transitions when the user requests reduced motion. Normal mobile animation retains the original 0.3-second ease-in-out transition.
3. **Keyboard access:** Replaced the two mouse-only mobile icon controls with labeled buttons while keeping their source styling. Desktop expansion also responds to keyboard focus.
4. **Link prop types:** Extended `SidebarLink` with normal anchor props so application links can receive click handlers, accessible titles, and `aria-current`.
5. **Actual app integration:** Added a separate `WorkspaceSidebar` using the supplied primitives. It uses BizQuote branding, Dashboard, Sales Quotation, New Quotation, and the saved quotation count. Its links open the actual screens. The full-height application keeps the quotation editor rather than the demo's placeholder dashboard. The previous floating navbar is retained in its component file, but is no longer rendered in the application.
6. **Theme and sizing:** Added demo query parameters for light/dark comparison. The main application remains light. Restored a 16px root font size for the reference Tailwind sizing and kept the quotation application's existing 13px base text size within its wrapper. Added only app layout rules for the editor beside the sidebar; the sidebar's source utility values were not replaced with CSS.
7. **Formatting:** Applied the project's existing Prettier formatting.

Browser automation was unavailable in this session, so pixel-level visual comparison and a live browser console check could not be completed. Rendering and navigation are checked through DOM tests, with TypeScript and production-build checks run separately.
