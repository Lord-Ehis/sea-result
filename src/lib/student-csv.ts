import { parseCsv, toCsv, type ImportError } from "@/lib/score-csv";

// Bulk student enrolment from a spreadsheet. Pure: the browser runs it for an
// instant preview, and the server runs the very same function again against
// its own copy of the campuses, classes and existing codes before anything is
// written, so the server stays the authority.
//
// All or nothing: one bad row stops the whole import, so fixing the file and
// uploading it again never trips over students the first attempt already added.

export const MAX_STUDENT_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_STUDENT_IMPORT_ROWS = 1000;

type ColumnKey =
  | "studentCode"
  | "firstName"
  | "lastName"
  | "campus"
  | "class"
  | "guardianName"
  | "guardianPhone"
  | "guardianEmail"
  | "dateOfBirth"
  | "gender"
  | "admissionNumber";

const COLUMNS: { key: ColumnKey; header: string; aliases: string[] }[] = [
  { key: "studentCode", header: "Student code", aliases: ["student id", "student id/code", "id", "code", "reg no", "registration number"] },
  { key: "firstName", header: "First name", aliases: ["firstname", "first"] },
  { key: "lastName", header: "Last name", aliases: ["lastname", "surname", "last"] },
  { key: "campus", header: "Campus", aliases: ["branch"] },
  { key: "class", header: "Class", aliases: ["classroom", "grade"] },
  { key: "guardianName", header: "Guardian name", aliases: ["parent name", "parent", "guardian"] },
  { key: "guardianPhone", header: "Guardian phone", aliases: ["parent phone", "phone", "guardian phone number", "phone number"] },
  { key: "guardianEmail", header: "Guardian email", aliases: ["parent email", "email"] },
  { key: "dateOfBirth", header: "Date of birth", aliases: ["dob", "birth date", "birthday"] },
  { key: "gender", header: "Gender", aliases: ["sex"] },
  { key: "admissionNumber", header: "Admission number", aliases: ["admission no", "admission"] },
];

const REQUIRED: ColumnKey[] = ["studentCode", "firstName", "lastName"];
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** How a class is identified within a file: its campus and its name, ignoring case and spacing. */
export const classKey = (campusId: string, name: string) => `${campusId}|${norm(name)}`;

export type StudentImportContext = {
  campuses: { id: string; name: string }[];
  classes: { id: string; name: string; campusId: string }[];
  /** Codes already used in this school (compared case-insensitively). */
  existingCodes: Set<string>;
};

export type StudentImportRow = {
  studentCode: string;
  firstName: string;
  lastName: string;
  campusId: string;
  /** An existing class, or null when `newClassName` is set or the student has no class. */
  classId: string | null;
  newClassName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  gender: string | null;
  admissionNumber: string | null;
};

export type StudentImportPreview = {
  rows: StudentImportRow[];
  errors: ImportError[];
  totalRows: number;
  unknownColumns: string[];
  /** Classes that don't exist yet and would be created, as "name (campus)". */
  newClasses: string[];
};

/** Template for the admin to fill in: just the column names (the first three are required). */
export function buildStudentTemplate(): string {
  return "﻿" + toCsv([COLUMNS.map((c) => c.header)]);
}

function unformula(value: string): string {
  return /^'[=+@\-]/.test(value) ? value.slice(1) : value;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Accepts 2014-09-30 or 30/09/2014 (the way Excel shows it in Nigeria); returns ISO or null if not a real date. */
export function normaliseDate(raw: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
  const [y, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : dmy ? [+dmy[3], +dmy[2], +dmy[1]] : [0, 0, 0];
  if (!y) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1950 || date.getTime() > Date.now()) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseStudentSheet(text: string, ctx: StudentImportContext): StudentImportPreview {
  const empty: StudentImportPreview = { rows: [], errors: [], totalRows: 0, unknownColumns: [], newClasses: [] };
  const fatal = (message: string): StudentImportPreview => ({ ...empty, errors: [{ row: 1, studentCode: "", column: "", message }] });

  const sheet = parseCsv(text);
  if (sheet.length === 0) return fatal("The file is empty.");
  if (sheet.length - 1 > MAX_STUDENT_IMPORT_ROWS) return fatal(`The file has more than ${MAX_STUDENT_IMPORT_ROWS} students. Split it into smaller files.`);

  const header = sheet[0].map((h) => unformula(h.trim()));
  const index = new Map<ColumnKey, number>();
  const unknownColumns: string[] = [];
  header.forEach((h, i) => {
    if (h === "") return;
    const col = COLUMNS.find((c) => norm(c.header) === norm(h) || c.aliases.includes(norm(h)));
    if (col && !index.has(col.key)) index.set(col.key, i);
    else unknownColumns.push(h);
  });
  const missing = REQUIRED.filter((k) => !index.has(k)).map((k) => COLUMNS.find((c) => c.key === k)!.header);
  if (missing.length > 0) return fatal(`The first row must include these columns: ${missing.join(", ")}. Download the template and fill that in.`);

  const campusByName = new Map(ctx.campuses.map((c) => [norm(c.name), c]));
  const classByKey = new Map(ctx.classes.map((c) => [classKey(c.campusId, c.name), c]));
  const onlyCampus = ctx.campuses.length === 1 ? ctx.campuses[0] : null;

  const result: StudentImportPreview = { ...empty, unknownColumns, totalRows: sheet.length - 1 };
  const seen = new Map<string, number>(); // code -> first row
  const newClasses = new Map<string, { name: string; campus: string }>(); // campus|class -> first spelling used

  sheet.slice(1).forEach((cells, i) => {
    const rowNumber = i + 2; // spreadsheet row: the header is row 1
    const get = (key: ColumnKey) => {
      const at = index.get(key);
      return at === undefined ? "" : unformula((cells[at] ?? "").trim());
    };
    const code = get("studentCode");
    const errors: ImportError[] = [];
    const bad = (column: ColumnKey, message: string) => errors.push({ row: rowNumber, studentCode: code, column: COLUMNS.find((c) => c.key === column)!.header, message });

    if (!code) bad("studentCode", "Student code is blank.");
    else if (code.length > 50) bad("studentCode", "Student code is too long (50 characters at most).");
    else if (ctx.existingCodes.has(code.toLowerCase())) bad("studentCode", "A student with this code already exists in your school.");
    else if (seen.has(code.toLowerCase())) bad("studentCode", `This code is already used on row ${seen.get(code.toLowerCase())} of the file.`);
    if (code && !seen.has(code.toLowerCase())) seen.set(code.toLowerCase(), rowNumber);

    const firstName = get("firstName");
    const lastName = get("lastName");
    if (!firstName) bad("firstName", "First name is blank.");
    if (!lastName) bad("lastName", "Last name is blank.");
    if (firstName.length > 100) bad("firstName", "First name is too long.");
    if (lastName.length > 100) bad("lastName", "Last name is too long.");

    // Campus: named, or implied when the admin has only one.
    const campusName = get("campus");
    let campus = onlyCampus;
    if (campusName) {
      campus = campusByName.get(norm(campusName)) ?? null;
      if (!campus) bad("campus", `No campus called "${campusName}" that you can add students to.`);
    } else if (!onlyCampus) {
      bad("campus", "Campus is blank. Use one of: " + ctx.campuses.map((c) => c.name).join(", ") + ".");
    }

    // Class: matched by name within the campus; one that doesn't exist yet is created.
    const className = get("class");
    let classId: string | null = null;
    let newClassName: string | null = null;
    if (className && campus) {
      if (className.length > 100) bad("class", "Class name is too long.");
      const found = classByKey.get(classKey(campus.id, className));
      if (found) classId = found.id;
      else {
        const key = classKey(campus.id, className);
        if (!newClasses.has(key)) newClasses.set(key, { name: className, campus: campus.name });
        newClassName = newClasses.get(key)!.name;
      }
    }

    const email = get("guardianEmail");
    if (email && !EMAIL.test(email)) bad("guardianEmail", "Not a valid email address.");
    const phone = get("guardianPhone");
    if (phone && (phone.length > 30 || !/^[+\d][\d\s()\-.]*$/.test(phone))) bad("guardianPhone", "Not a valid phone number.");
    if (get("guardianName").length > 100) bad("guardianName", "Guardian name is too long.");

    const dobRaw = get("dateOfBirth");
    const dob = dobRaw ? normaliseDate(dobRaw) : null;
    if (dobRaw && !dob) bad("dateOfBirth", "Use a real past date, like 2014-09-30 or 30/09/2014.");
    if (get("gender").length > 30) bad("gender", "Gender is too long.");
    if (get("admissionNumber").length > 50) bad("admissionNumber", "Admission number is too long.");

    if (errors.length > 0 || !campus) {
      result.errors.push(...errors);
      return;
    }
    result.rows.push({
      studentCode: code,
      firstName,
      lastName,
      campusId: campus.id,
      classId,
      newClassName,
      guardianName: get("guardianName") || null,
      guardianPhone: phone || null,
      guardianEmail: email || null,
      dateOfBirth: dob,
      gender: get("gender") || null,
      admissionNumber: get("admissionNumber") || null,
    });
  });

  result.newClasses = [...newClasses.values()].map((c) => (ctx.campuses.length > 1 ? `${c.name} (${c.campus})` : c.name));
  // A file with any problem imports nothing, so there are no "ready" rows to promise.
  if (result.errors.length > 0) result.rows = [];
  return result;
}
