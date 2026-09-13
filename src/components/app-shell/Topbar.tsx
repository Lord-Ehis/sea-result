"use client";

import { Bell, Menu } from "lucide-react";

type TopbarProps = {
  pageTitle: string;
  schoolName?: string;
  termBadge?: string;
  userName: string;
  userRoleLabel: string;
  onToggleSidebar: () => void;
};

export function Topbar({
  pageTitle,
  schoolName,
  termBadge,
  userName,
  userRoleLabel,
  onToggleSidebar,
}: TopbarProps) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-[84px] items-center justify-between gap-5 border-b border-border bg-bg-card px-[43px]">
      <div className="flex min-w-0 items-center gap-[17px]">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="grid place-items-center rounded-[7px] p-1.5 text-text-secondary hover:bg-bg-page"
        >
          <Menu size={19} strokeWidth={1.8} />
        </button>
        <span className="whitespace-nowrap text-xs font-medium text-text-secondary">{pageTitle}</span>
        {schoolName && (
          <>
            <span className="h-[19px] w-px flex-none bg-border" />
            <span className="truncate text-[13px] font-medium text-text-primary">{schoolName}</span>
          </>
        )}
        {termBadge && (
          <>
            <span className="h-[19px] w-px flex-none bg-border" />
            <span className="inline-flex whitespace-nowrap rounded-md border border-border bg-primary-bg px-2.5 py-1.5 text-[11px] font-medium text-primary">
              {termBadge}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-[17px]">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid place-items-center p-1.5 text-text-secondary"
        >
          <Bell size={19} strokeWidth={1.8} />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border-2 border-white bg-danger" />
        </button>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-success-bg text-[11px] font-medium text-success">
          {initials}
        </span>
        <div className="whitespace-nowrap text-xs leading-[1.3] text-text-primary">
          {userName}
          <small className="block text-[11px] text-text-muted">{userRoleLabel}</small>
        </div>
      </div>
    </header>
  );
}
