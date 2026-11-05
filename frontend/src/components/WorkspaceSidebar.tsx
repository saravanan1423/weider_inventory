import React, { useState } from "react";
import { FileText, LayoutDashboard, Plus } from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";

interface WorkspaceSidebarProps {
  view: string;
  count: number;
  setView: (view: string) => void;
  newQuote: () => void;
}

export default function WorkspaceSidebar({
  view,
  count,
  setView,
  newQuote,
}: WorkspaceSidebarProps) {
  const [open, setOpen] = useState(false);
  const iconClass = "h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200";
  const links = [
    {
      label: "Dashboard",
      href: "#dashboard",
      icon: <LayoutDashboard className={iconClass} />,
      action: () => setView("list"),
      active: view === "list",
    },
    {
      label: "Sales Quotation",
      href: "#quotation",
      icon: <FileText className={iconClass} />,
      action: () => setView("editor"),
      active: view === "editor",
    },
    {
      label: "New Quotation",
      href: "#new-quotation",
      icon: <Plus className={iconClass} />,
      action: newQuote,
      active: false,
    },
  ];
  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <a
            href="#quotation"
            aria-label="Weider ERP home"
            onClick={(event) => {
              event.preventDefault();
              setView("editor");
            }}
            className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
          >
            <img
              src="/weider-logo.png"
              alt="Weider logo"
              className={`${open ? "h-10 w-10" : "h-7 w-7"} shrink-0 rounded-sm object-contain`}
            />
            {open && (
              <span className="font-medium whitespace-pre text-black dark:text-white">
                Weider ERP
              </span>
            )}
          </a>
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link) => (
              <SidebarLink
                key={link.href}
                link={link}
                title={link.label}
                aria-current={link.active ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  link.action();
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
        <div>
          <SidebarLink
            title={`${count} saved quotations`}
            link={{
              label: `${count} saved quotations`,
              href: "#dashboard",
              icon: (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                  WE
                </span>
              ),
            }}
            onClick={(event) => {
              event.preventDefault();
              setView("list");
              setOpen(false);
            }}
          />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
