"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { iconRegistry } from "./icon-registry";
import type { NavItem } from "./types";

type SidebarProps = {
  navItems: NavItem[];
  workspaceName: string;
  workspaceMeta: string;
  collapsed: boolean;
};

export function Sidebar({ navItems, workspaceName, workspaceMeta, collapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        "flex flex-none flex-col bg-bg-card border-r border-border transition-[width] duration-150",
        collapsed ? "w-[70px]" : "w-[242px]",
      )}
    >
      <div className={clsx("flex h-[84px] items-center gap-[9px] border-b border-border", collapsed ? "px-[18px]" : "px-[15px]")}>
        <span className="grid h-[37px] w-[37px] flex-none place-items-center rounded-[9px] bg-primary text-[10px] font-medium tracking-tight text-white">
          SEA
        </span>
        {!collapsed && (
          <span className="text-[11px] font-medium leading-[1.25] tracking-tight text-text-primary">
            Sophie Educational Assistant
            <small className="mt-1 block text-[9px] font-normal leading-[1.3] text-text-muted">
              {workspaceName}
            </small>
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="px-[25px] pb-3 pt-[29px] text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Workspace
        </div>
      )}

      <nav className={clsx("grid gap-1", collapsed ? "px-3 pt-[22px]" : "px-3")} aria-label="Main navigation">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = iconRegistry[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex items-center gap-[13px] whitespace-nowrap rounded-lg px-[13px] py-3 text-xs font-medium",
                collapsed && "justify-center px-[13px]",
                active ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-page",
              )}
            >
              {active && !collapsed && (
                <span className="absolute left-0 h-[23px] w-[3px] rounded-r-[3px] bg-primary" />
              )}
              <Icon size={18} strokeWidth={1.8} className="flex-none" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.count !== undefined && item.count > 0 && (
                <span
                  className={clsx(
                    "rounded-[5px] px-1.5 py-0.5 text-[10px]",
                    active ? "bg-primary/20 text-primary" : "bg-bg-page text-text-secondary",
                  )}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="mt-auto border-t border-border px-5 pb-[22px] pt-[18px] text-[11px] leading-[1.6] text-text-muted">
          <strong className="mb-1 block text-xs font-medium text-text-secondary">{workspaceName}</strong>
          {workspaceMeta}
        </div>
      )}
    </aside>
  );
}
