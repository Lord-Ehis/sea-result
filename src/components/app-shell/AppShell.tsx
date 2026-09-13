"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { NavItem } from "./types";

type AppShellProps = {
  navItems: NavItem[];
  workspaceName: string;
  workspaceMeta: string;
  pageTitle: string;
  schoolName?: string;
  termBadge?: string;
  userName: string;
  userRoleLabel: string;
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
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        navItems={navItems}
        workspaceName={workspaceName}
        workspaceMeta={workspaceMeta}
        collapsed={collapsed}
      />
      <div className="min-w-0 flex-1">
        <Topbar
          pageTitle={pageTitle}
          schoolName={schoolName}
          termBadge={termBadge}
          userName={userName}
          userRoleLabel={userRoleLabel}
          onToggleSidebar={() => setCollapsed((value) => !value)}
        />
        <main className="mx-auto max-w-[1510px] px-[43px] py-[38px]">{children}</main>
      </div>
    </div>
  );
}
