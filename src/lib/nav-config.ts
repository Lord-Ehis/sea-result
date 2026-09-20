import type { NavItem } from "@/components/app-shell";

export const ownerNavItems: NavItem[] = [
  { label: "Schools", href: "/owner/schools", icon: "Building2" },
  { label: "Analytics", href: "/owner/analytics", icon: "BarChart3" },
  { label: "Global settings", href: "/owner/settings", icon: "Settings" },
];

export const schoolAdminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutGrid" },
  { label: "Students", href: "/admin/students", icon: "Users" },
  { label: "Classes", href: "/admin/classes", icon: "Layers" },
  { label: "Result templates", href: "/admin/result-templates", icon: "FileText" },
  { label: "Results", href: "/admin/results", icon: "FileCheck" },
  { label: "Published results", href: "/admin/published", icon: "BadgeCheck" },
  { label: "Audit log", href: "/admin/audit", icon: "ClipboardList" },
  { label: "Billing", href: "/admin/billing", icon: "CreditCard" },
  { label: "Teachers", href: "/admin/teachers", icon: "UserCog" },
  { label: "Notifications", href: "/admin/notifications", icon: "Bell" },
  { label: "Custom domain", href: "/admin/domain", icon: "Globe" },
  { label: "Deletion request", href: "/admin/deletion-request", icon: "Trash2" },
];

export const teacherNavItems: NavItem[] = [{ label: "My classes", href: "/teacher/classes", icon: "GraduationCap" }];

export const parentNavItems: NavItem[] = [
  { label: "Dashboard", href: "/parent/dashboard", icon: "LayoutGrid" },
  { label: "Link a child", href: "/parent/link-child", icon: "UserPlus" },
];
