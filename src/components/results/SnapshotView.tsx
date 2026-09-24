import { GridResultTable } from "@/components/results/GridResultTable";
import { RatingGridTable } from "@/components/results/RatingGridTable";
import { GradingScaleTable } from "@/components/results/GradingScaleTable";
import { PerformanceSummaryBox } from "@/components/results/PerformanceSummaryBox";
import { AnnualSummaryTable } from "@/components/results/AnnualSummaryTable";
import { SchoolLogo } from "@/components/results/SchoolLogo";
import { StudentPhoto } from "@/components/results/StudentPhoto";
import type { SnapshotPayload } from "@/lib/snapshot";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

// One published result, rendered purely from its frozen snapshot. Shared by
// the printable page, the admin's "preview as parent" and anywhere else a
// whole result is shown, so they can never drift from each other. Safe to
// render on the server or the client.
export function SnapshotView({ payload, preview = false }: { payload: SnapshotPayload; preview?: boolean }) {
  const { school, student, period, template, fields, grids, ratingGrids, performanceSummary, gradingScale, annual, publication } = payload;
  const initials = initialsOf(school.name);
  const studentInitials = initialsOf(student.name);
  const bioData = [
    { label: "Gender", value: student.gender },
    { label: "Admission No", value: student.admissionNumber },
    { label: "Date of birth", value: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-GB") : null },
    { label: "Age", value: student.age != null ? `${student.age} yrs` : null },
    { label: "Height", value: student.height },
    { label: "Weight", value: student.weight },
    { label: "Favourite colour", value: student.favouriteColour },
    { label: "Club/Society", value: student.clubOrSociety },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  return (
    <article className="rounded-md border border-border bg-bg-card p-6 text-text-primary print:border-0 print:p-0">
      <header className="flex items-start gap-3 border-b border-border pb-4">
        {school.logoUrl ? (
          <SchoolLogo logoUrl={school.logoUrl} initials={initials} />
        ) : (
          <div className="grid h-10 w-10 flex-none place-items-center rounded bg-primary text-caption font-medium text-white">{initials}</div>
        )}
        <div className="min-w-0">
          <strong className="block text-heading font-medium">{school.name}</strong>
          {school.address && <span className="block text-caption text-text-muted">{school.address}</span>}
          {(school.phone || school.supportEmail) && (
            <span className="block text-caption text-text-muted">{[school.phone, school.supportEmail].filter(Boolean).join(" · ")}</span>
          )}
          <span className="text-caption text-text-muted">{template.name}</span>
        </div>
      </header>

      <div className="py-4 text-center">
        <strong className="block text-heading font-medium">Student result sheet</strong>
        <span className="mt-1 block text-caption text-text-muted">
          {period.term} · {period.session}
        </span>
      </div>

      <div className="flex items-start gap-3">
        {student.photoUrl && <StudentPhoto photoUrl={student.photoUrl} initials={studentInitials} />}
        <dl className="grid flex-1 grid-cols-2 gap-3 rounded-md bg-bg-page p-3 text-caption sm:grid-cols-4">
          <div>
            <dt className="text-[10px] text-text-muted">Student</dt>
            <dd className="font-medium">{student.name}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-text-muted">Student code</dt>
            <dd className="font-medium">{student.code}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-text-muted">Class</dt>
            <dd className="font-medium">{student.className}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-text-muted">Campus</dt>
            <dd className="font-medium">{student.campusName}</dd>
          </div>
        </dl>
      </div>

      {bioData.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-caption sm:grid-cols-4">
          {bioData.map((f) => (
            <div key={f.label}>
              <dt className="text-[10px] text-text-muted">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {fields.length > 0 && (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {fields.map((f, i) => (
            <div key={`${f.name}-${i}`} className="rounded-md border border-border px-3 py-2">
              <dt className="text-[10px] text-text-muted">{f.name}</dt>
              <dd className="whitespace-pre-line text-caption font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {grids.length > 0 && (
        <div className="mt-4 grid gap-4">
          {grids.map((g, i) => (
            <GridResultTable key={`${g.fieldName}-${i}`} grid={g} />
          ))}
        </div>
      )}

      {performanceSummary && (
        <div className="mt-4">
          <PerformanceSummaryBox summary={performanceSummary} />
        </div>
      )}

      {ratingGrids && ratingGrids.length > 0 && (
        <div className="mt-4 grid gap-4">
          {ratingGrids.map((g) => (
            <RatingGridTable key={g.categoryId} grid={g} />
          ))}
        </div>
      )}

      {gradingScale && gradingScale.length > 0 && (
        <div className="mt-4">
          <GradingScaleTable bands={gradingScale} />
        </div>
      )}

      {annual && (
        <div className="mt-5">
          <AnnualSummaryTable annual={annual} />
        </div>
      )}

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[10px] text-text-muted">
        {preview ? (
          <span>Preview — not yet published</span>
        ) : (
          <>
            <span>
              Published {new Date(publication.publishedAt).toLocaleDateString("en-GB")}
              {publication.version > 1
                ? ` · corrected${publication.amendedAt ? ` ${new Date(publication.amendedAt).toLocaleDateString("en-GB")}` : ""} · version ${publication.version}`
                : ""}
            </span>
            <span>
              Verification code <strong className="font-mono text-text-secondary">{publication.verificationCode}</strong>
            </span>
          </>
        )}
      </footer>
    </article>
  );
}
