import { GridResultTable } from "@/components/results/GridResultTable";
import { RatingGridTable } from "@/components/results/RatingGridTable";
import { GradingScaleTable } from "@/components/results/GradingScaleTable";
import { AttendanceSummaryBox } from "@/components/results/AttendanceSummaryBox";
import { SignOffBlock } from "@/components/results/SignOffBlock";
import { RatingIndicesLegend } from "@/components/results/RatingIndicesLegend";
import { RemarksBox } from "@/components/results/RemarksBox";
import { GradeAnalysisTable } from "@/components/results/GradeAnalysisTable";
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
  const { school, student, period, template, fields, grids, ratingGrids, performanceSummary, gradeAnalysis, attendance, remarks, signOff, gradingScale, annual, publication } = payload;
  const initials = initialsOf(school.name);
  const studentInitials = initialsOf(student.name);
  const bioData = [
    { label: "Name", value: student.name },
    { label: "Student code", value: student.code },
    { label: "Gender", value: student.gender },
    { label: "Class", value: student.className },
    { label: "Session", value: period.session },
    { label: "Admission No", value: student.admissionNumber },
    { label: "Date of birth", value: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-GB", { timeZone: "UTC" }) : null },
    { label: "Age", value: student.age != null ? `${student.age} yrs` : null },
    { label: "Height", value: student.height },
    { label: "Weight", value: student.weight },
    { label: "Club/Society", value: student.clubOrSociety },
    { label: "Favourite colour", value: student.favouriteColour },
    { label: "Campus", value: student.campusName },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  return (
    <article className="rounded-md border border-border bg-bg-card p-6 text-text-primary print:border-0 print:p-0">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        {school.logoUrl ? (
          <SchoolLogo logoUrl={school.logoUrl} initials={initials} />
        ) : (
          <div className="grid h-10 w-10 flex-none place-items-center rounded bg-primary text-caption font-medium text-white">{initials}</div>
        )}
        <div className="min-w-0 flex-1 text-center">
          <strong className="block text-title font-semibold uppercase tracking-wide">{school.name}</strong>
          {school.address && <span className="block text-caption text-text-muted">{school.address}</span>}
          {(school.phone || school.supportEmail) && (
            <span className="block text-caption text-text-muted">{[school.phone, school.supportEmail].filter(Boolean).join(" · ")}</span>
          )}
        </div>
        <div className="h-10 w-10 flex-none" aria-hidden />
      </header>

      <div className="py-3 text-center">
        <strong className="block text-body font-semibold uppercase tracking-wide">
          {period.term} Student&apos;s Performance Report
        </strong>
        <span className="text-[10px] text-text-muted">{template.name}</span>
      </div>

      <div className="flex items-start gap-3">
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-border p-3 text-caption sm:grid-cols-4">
          {bioData.map((f) => (
            <div key={f.label}>
              <dt className="text-[10px] text-text-muted">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
        {student.photoUrl && <StudentPhoto photoUrl={student.photoUrl} initials={studentInitials} />}
      </div>

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

      {/* Report-card body: subjects on the left; attendance, ratings and the
          rating legend in a narrower column on the right, like the paper form. */}
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {grids.map((g, i) => (
            <GridResultTable key={`${g.fieldName}-${i}`} grid={g} compact />
          ))}
        </div>
        {(attendance || (ratingGrids && ratingGrids.length > 0)) && (
          <div className="grid content-start gap-4">
            {attendance && <AttendanceSummaryBox attendance={attendance} />}
            {ratingGrids?.map((g) => (
              <RatingGridTable key={g.categoryId} grid={g} />
            ))}
            {ratingGrids && <RatingIndicesLegend grids={ratingGrids} />}
          </div>
        )}
      </div>

      {(performanceSummary || (gradingScale && gradingScale.length > 0) || gradeAnalysis) && (
        <div className="mt-4 grid items-start gap-4 md:grid-cols-3 print:grid-cols-3">
          {performanceSummary && <PerformanceSummaryBox summary={performanceSummary} />}
          {gradingScale && gradingScale.length > 0 && <GradingScaleTable bands={gradingScale} />}
          {gradeAnalysis && <GradeAnalysisTable analysis={gradeAnalysis} />}
        </div>
      )}

      {remarks && (
        <div className="mt-4">
          <RemarksBox remarks={remarks} />
        </div>
      )}

      {annual && (
        <div className="mt-5">
          <AnnualSummaryTable annual={annual} />
        </div>
      )}

      {signOff && (
        <div className="mt-5">
          <SignOffBlock signOff={signOff} issuedOn={preview ? null : publication.publishedAt} />
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
