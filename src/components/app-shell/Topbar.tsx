"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, Menu, LogOut, ChevronDown } from "lucide-react";

type TopbarProps = {
  pageTitle: string;
  schoolName?: string;
  termBadge?: string;
  userName: string;
  userRoleLabel: string;
  notificationsHref?: string;
  hasAlerts?: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
};

export function Topbar({
  pageTitle,
  schoolName,
  termBadge,
  userName,
  userRoleLabel,
  notificationsHref,
  hasAlerts,
  onToggleSidebar,
  onOpenMobileNav,
}: TopbarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-[84px] items-center justify-between gap-3 border-b border-border bg-bg-card px-4 sm:gap-5 sm:px-6 lg:px-[43px]">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-[17px]">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="grid place-items-center rounded-[7px] p-1.5 text-text-secondary hover:bg-bg-page lg:hidden"
        >
          <Menu size={19} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="hidden place-items-center rounded-[7px] p-1.5 text-text-secondary hover:bg-bg-page lg:grid"
        >
          <Menu size={19} strokeWidth={1.8} />
        </button>
        <span className="whitespace-nowrap text-xs font-medium text-text-secondary">{pageTitle}</span>
        {schoolName && (
          <>
            <span className="h-[19px] w-px flex-none bg-border" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary">{schoolName}</span>
          </>
        )}
        {termBadge && (
          <>
            <span className="hidden h-[19px] w-px flex-none bg-border md:block" />
            <span className="hidden whitespace-nowrap rounded-md border border-border bg-primary-bg px-2.5 py-1.5 text-[11px] font-medium text-primary md:inline-flex">
              {termBadge}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2.5 sm:gap-[17px]">
        {notificationsHref && (
          <button
            type="button"
            onClick={() => router.push(notificationsHref)}
            aria-label="Notifications"
            className="relative grid place-items-center rounded-[7px] p-1.5 text-text-secondary hover:bg-bg-page"
          >
            <Bell size={19} strokeWidth={1.8} />
            {hasAlerts && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border-2 border-white bg-danger" />}
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-md p-1 hover:bg-bg-page"
          >
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-success-bg text-[11px] font-medium text-success">
              {initials}
            </span>
            <div className="hidden whitespace-nowrap text-left text-xs leading-[1.3] text-text-primary sm:block">
              {userName}
              <small className="block text-[11px] text-text-muted">{userRoleLabel}</small>
            </div>
            <ChevronDown size={15} strokeWidth={1.8} className="text-text-muted" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] z-20 w-44 overflow-hidden rounded-md border border-border bg-bg-card py-1.5 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-caption text-text-secondary hover:bg-bg-page"
                >
                  <LogOut size={15} strokeWidth={1.8} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
