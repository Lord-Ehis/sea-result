import {
  LayoutGrid,
  Building2,
  Users,
  FileText,
  FileCheck,
  CreditCard,
  UserCog,
  Trash2,
  Bell,
  Globe,
  Settings,
  BarChart3,
  GraduationCap,
  UserPlus,
  Layers,
  BadgeCheck,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "./types";

// Nav items are built in Server Components and passed as props into the
// client-side Sidebar — component references (functions) can't cross that
// boundary, so nav-config stores icon *names* and this registry resolves
// them to the actual component on the client side.
export const iconRegistry: Record<IconName, LucideIcon> = {
  LayoutGrid,
  Building2,
  Users,
  FileText,
  FileCheck,
  CreditCard,
  UserCog,
  Trash2,
  Bell,
  Globe,
  Settings,
  BarChart3,
  GraduationCap,
  UserPlus,
  Layers,
  BadgeCheck,
  ClipboardList,
};
