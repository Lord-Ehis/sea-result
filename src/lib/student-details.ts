import type { SnapshotStudent } from "@/lib/snapshot";

// Which student details a result template leaves off the printed result.
// Name, student code, class and session are always shown: a result means
// nothing without them. The rest can be switched off per template version, and
// a hidden detail is removed from the frozen published result itself, not only
// hidden on screen. Pure, so each rule is unit-tested.

export const STUDENT_DETAILS = [
  { key: "gender", label: "Gender" },
  { key: "admissionNumber", label: "Admission number" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "age", label: "Age" },
  { key: "height", label: "Height" },
  { key: "weight", label: "Weight" },
  { key: "favouriteColour", label: "Favourite colour" },
  { key: "clubOrSociety", label: "Club or society" },
  { key: "campus", label: "Campus" },
  { key: "photo", label: "Photo" },
] as const;

export type StudentDetailKey = (typeof STUDENT_DETAILS)[number]["key"];
const KNOWN = new Set<string>(STUDENT_DETAILS.map((d) => d.key));

/** Only known details, each once, in the order they are listed. Anything else is dropped. */
export function cleanHiddenDetails(input: unknown): StudentDetailKey[] {
  const wanted = new Set(Array.isArray(input) ? input.filter((x): x is string => typeof x === "string") : []);
  return STUDENT_DETAILS.map((d) => d.key).filter((k) => wanted.has(k) && KNOWN.has(k));
}

/** The student as it should be frozen into a result: hidden details emptied. */
export function hideStudentDetails(student: SnapshotStudent, hidden: readonly string[] | null | undefined): SnapshotStudent {
  const off = new Set(cleanHiddenDetails(hidden ?? []));
  if (off.size === 0) return student;
  return {
    ...student,
    gender: off.has("gender") ? null : student.gender,
    admissionNumber: off.has("admissionNumber") ? null : student.admissionNumber,
    dateOfBirth: off.has("dateOfBirth") ? null : student.dateOfBirth,
    age: off.has("age") ? null : student.age,
    height: off.has("height") ? null : student.height,
    weight: off.has("weight") ? null : student.weight,
    favouriteColour: off.has("favouriteColour") ? null : student.favouriteColour,
    clubOrSociety: off.has("clubOrSociety") ? null : student.clubOrSociety,
    campusName: off.has("campus") ? "" : student.campusName,
    photoUrl: off.has("photo") ? null : student.photoUrl,
  };
}
