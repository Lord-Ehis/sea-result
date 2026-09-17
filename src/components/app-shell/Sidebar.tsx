"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { iconRegistry } from "./icon-registry";
import { Logo, LogoIcon } from "@/components/ui/Logo";
import type { NavItem } from "./types";

type SidebarProps = {
  navItems: NavItem[];
  workspaceName: string;
  workspaceMeta: string;
  collapsed: boolean;
  mobileNavOpen: boolean;
  onCloseMobileNav: () => void;
};

export function Sidebar({ navItems, workspaceName, workspaceMeta, collapsed, mobileNavOpen, onCloseMobileNav }: SidebarProps) {
  const pathname = usePathname();

  // AppShell (and this Sidebar) don't remount on in-section navigation —
  // only `children` swaps — so without this the mobile drawer would stay
  // open after clicking a nav link.
  useEffect(() => {
    onCloseMobileNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCloseMobileNav is a stable setState wrapper
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onCloseMobileNav}
        className={clsx(
          "fixed inset-0 z-30 bg-[#172c3d77] transition-opacity lg:hidden",
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[242px] flex-col bg-bg-card border-r border-border transition-transform duration-200 lg:static lg:z-auto lg:transition-[width] lg:duration-150",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          collapsed ? "lg:w-[70px]" : "lg:w-[242px]",
        )}
      >
        <div
          className={clsx(
            "flex h-[84px] items-center gap-[9px] border-b border-border px-[15px]",
            collapsed && "lg:justify-center lg:px-[18px]",
          )}
        >
          <div className={clsx("min-w-0", collapsed && "lg:hidden")}>
            <Logo height={22} />
            <small className="mt-1.5 block truncate text-[9px] font-normal leading-[1.3] text-text-muted">
              {workspaceName}
            </small>
          </div>
          <div className={clsx("hidden", collapsed && "lg:block")}>
            <LogoIcon height={30} />
          </div>
        </div>

        <div
          className={clsx(
            "px-[25px] pb-3 pt-[29px] text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted",
            collapsed && "lg:hidden",
          )}
        >
          Workspace
        </div>

        <nav className={clsx("grid gap-1 px-3", collapsed && "lg:pt-[22px]")} aria-label="Main navigation">
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
                  collapsed && "lg:justify-center",
                  active ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-page",
                )}
              >
                {active && (
                  <span className={clsx("absolute left-0 h-[23px] w-[3px] rounded-r-[3px] bg-primary", collapsed && "lg:hidden")} />
                )}
                <Icon size={18} strokeWidth={1.8} className="flex-none" />
                <span className={clsx("flex-1", collapsed && "lg:hidden")}>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={clsx(
                      "rounded-[5px] px-1.5 py-0.5 text-[10px]",
                      collapsed && "lg:hidden",
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

        <div
          className={clsx(
            "mt-auto border-t border-border px-5 pb-[22px] pt-[18px] text-[11px] leading-[1.6] text-text-muted",
            collapsed && "lg:hidden",
          )}
        >
          <strong className="mb-1 block text-xs font-medium text-text-secondary">{workspaceName}</strong>
          {workspaceMeta}
        </div>
      </aside>
    </>
  );
}
