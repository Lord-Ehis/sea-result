import type { Prisma } from "@prisma/client";

// Campus scoping for School Admin accounts (spec RT-13). Pure — no database
// or session access — so the rules are unit-tested and every page and action
// builds its queries the same way.
//
// `campusIds === null` means unrestricted (the main School Admin, and every
// account that predates campus admins). An array — even an empty one — means
// restricted to exactly those campuses; empty therefore sees nothing.

export type CampusAccess = { campusIds: string[] | null };

export const isScoped = (access: CampusAccess): access is { campusIds: string[] } => access.campusIds !== null;

export function canAccessCampus(access: CampusAccess, campusId: string | null | undefined): boolean {
  if (access.campusIds === null) return true;
  return !!campusId && access.campusIds.includes(campusId);
}

const campusIn = (access: CampusAccess) => (access.campusIds === null ? undefined : { in: access.campusIds });

/** `where` fragments — each is `{}` for an unrestricted admin, so it can always be spread in. */
export function classWhere(access: CampusAccess): Prisma.ClassWhereInput {
  const c = campusIn(access);
  return c ? { campusId: c } : {};
}

export function studentWhere(access: CampusAccess): Prisma.StudentWhereInput {
  const c = campusIn(access);
  return c ? { campusId: c } : {};
}

// Nested under AND so it can be spread next to a caller's own `id` filter
// (`{ id: requestedCampusId, ...campusWhere(access) }`) without replacing it —
// otherwise "campus A, please" would quietly become "any of my campuses".
export function campusWhere(access: CampusAccess): Prisma.CampusWhereInput {
  return access.campusIds === null ? {} : { AND: [{ id: { in: access.campusIds } }] };
}

/** Batches belong to a class, and a class to a campus. */
export function batchWhere(access: CampusAccess): Prisma.ResultBatchWhereInput {
  const c = campusIn(access);
  return c ? { class: { campusId: c } } : {};
}

/** For rows that point at a student: results, published snapshots, notifications. A row with no student is out of scope. */
export function ofStudentWhere(access: CampusAccess): { student?: Prisma.StudentWhereInput } {
  const c = campusIn(access);
  return c ? { student: { campusId: c } } : {};
}
