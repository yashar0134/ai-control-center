"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CircleDollarSign,
  Cpu,
  LayoutDashboard,
  Menu,
  Plug,
  Settings,
  TerminalSquare,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/providers", label: "Providers", icon: Plug },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/costs", label: "Costs", icon: CircleDollarSign },
  { href: "/system", label: "System", icon: Cpu },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navList = (
    <ul className="space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                active
                  ? "bg-surface-raised font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground"
              }`}
            >
              <Icon
                size={16}
                aria-hidden="true"
                className={active ? "text-accent" : ""}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <TerminalSquare size={18} className="text-accent" aria-hidden="true" />
          AI Control Center
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="cursor-pointer rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </header>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main navigation"
          className="border-b border-border bg-surface px-4 py-3 lg:hidden"
        >
          {navList}
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <TerminalSquare size={18} className="text-accent" aria-hidden="true" />
            AI Control Center
          </Link>
          <p className="mt-1 text-xs text-faint-foreground">local-first · v0.1</p>
        </div>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3">
          {navList}
        </nav>
        <div className="border-t border-border p-4">
          <p className="text-xs leading-relaxed text-faint-foreground">
            All AI usage shown is{" "}
            <span className="font-medium text-demo">demo data</span> until real
            collectors are connected.
          </p>
        </div>
      </aside>
    </>
  );
}
