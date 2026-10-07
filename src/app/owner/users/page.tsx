import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { UsersList, type UserRow } from "./UsersList";

const PAGE_SIZE = 50;
const ROLES = ["SCHOOL_ADMIN", "TEACHER", "PARENT"] as const;
type SearchRole = (typeof ROLES)[number];
const ROLE_LABEL: Record<SearchRole, string> = { SCHOOL_ADMIN: "School admins", TEACHER: "Teachers", PARENT: "Parents" };

const fieldClass = "h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary";

export default async function OwnerUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  // This page lists everyone's name and email, so check the role here as well as in the proxy.
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const role = ROLES.find((r) => r === sp.role);

  const where: Prisma.UserWhereInput = {
    role: role ?? { not: "PLATFORM_OWNER" },
    schoolId: { not: null },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { school: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, found] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, school: { select: { id: true, name: true } } },
    }),
  ]);

  const users: UserRow[] = found
    .filter((u): u is typeof u & { school: { id: string; name: string } } => u.school !== null)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as UserRow["role"],
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      schoolId: u.school.id,
      schoolName: u.school.name,
    }));

  const searching = q !== "" || role !== undefined;

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Find a user"
        intro="Look up any school admin, teacher or parent by name, email or school, and help them back in when they are locked out."
      />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-border bg-bg-card p-4">
        <label className="grid min-w-[240px] flex-1 gap-1 text-[10px] text-text-muted">
          Name, email or school
          <span className="flex h-10 items-center gap-2 rounded-md border border-border bg-bg-card px-3">
            <Search size={16} strokeWidth={1.8} className="text-text-muted" />
            <input name="q" defaultValue={q} placeholder="e.g. ada@school.ng or Graceland" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-body text-text-primary outline-none" />
          </span>
        </label>
        <label className="grid gap-1 text-[10px] text-text-muted">
          Role
          <select name="role" defaultValue={role ?? ""} className={fieldClass}>
            <option value="">Everyone</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white">
          Search
        </button>
        {searching && (
          <a href="/owner/users" className="h-10 self-end text-caption leading-10 text-text-muted hover:text-primary">
            Clear
          </a>
        )}
      </form>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No matching accounts" description="Try part of the person's name, their email address, or their school's name." />
      ) : (
        <>
          <p className="mb-3 text-caption text-text-muted">
            {searching ? `${total} ${total === 1 ? "account" : "accounts"} found` : "Newest accounts"}
            {total > users.length ? ` — showing the first ${users.length}. Narrow your search to see the rest.` : ""}
          </p>
          <UsersList users={users} />
        </>
      )}
    </>
  );
}
