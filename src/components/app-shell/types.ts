export type IconName =
  | "LayoutGrid"
  | "Building2"
  | "Users"
  | "FileText"
  | "FileCheck"
  | "CreditCard"
  | "UserCog"
  | "Trash2"
  | "Bell"
  | "Globe"
  | "Settings"
  | "BarChart3"
  | "GraduationCap"
  | "UserPlus"
  | "Layers"
  | "BadgeCheck"
  | "ClipboardList";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  count?: number;
};
