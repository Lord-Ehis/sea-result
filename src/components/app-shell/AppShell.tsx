"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AnnouncementBanner } from "./AnnouncementBanner";
import type { NavItem } from "./types";
import type { ActiveAnnouncement } from "@/lib/announcements";

type AppShellProps = {
  navItems: NavItem[];
  workspaceName: string;
  workspaceMeta: string;
  pageTitle: string;
  schoolName?: string;
  termBadge?: string;
  userName: string;
  userRoleLabel: string;
  notificationsHref?: string;
  hasAlerts?: boolean;
  announcement?: ActiveAnnouncement | null;
  children: ReactNode;
};

export function AppShell({
  navItems,
  workspaceName,
  workspaceMeta,
  pageTitle,
  schoolName,
  termBadge,
  userName,
  userRoleLabel,
  notificationsHref,
  hasAlerts,
  announcement,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBanner announcement={announcement ?? null} />
      <div className="flex min-w-0 flex-1">
        <Sidebar
          navItems={navItems}
          workspaceName={workspaceName}
          workspaceMeta={workspaceMeta}
          collapsed={collapsed}
          mobileNavOpen={mobileNavOpen}
          onCloseMobileNav={() => setMobileNavOpen(false)}
        />
        <div className="min-w-0 flex-1">
          <Topbar
            pageTitle={pageTitle}
            schoolName={schoolName}
            termBadge={termBadge}
            userName={userName}
            userRoleLabel={userRoleLabel}
            notificationsHref={notificationsHref}
            hasAlerts={hasAlerts}
            onToggleSidebar={() => setCollapsed((value) => !value)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <main className="mx-auto max-w-[1510px] px-4 py-5 sm:px-6 sm:py-6 lg:px-[43px] lg:py-[38px]">{children}</main>
        </div>
      </div>
    </div>
  );
}
