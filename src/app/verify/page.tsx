import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isSnapshotIntact, normalizeVerificationCode, type SnapshotPayload } from "@/lib/snapshot";
import { callerId, hit, waitMessage } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Verify a result", robots: { index: false, follow: false } };

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(" ");
}

// Public authenticity check for a printed or shared result. Deliberately
// tells the person only what's needed to confirm a document is genuine —
// school, term, class, publication date and the student's initials.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code: raw } = await searchParams;
  const code = raw ? normalizeVerificationCode(raw) : "";

  // Codes are 32^8 apart, but a public check should still not be scriptable.
  const limit = code ? await hit(`verify:${await callerId()}`, 30, 600) : null;
  const limited = limit !== null && !limit.allowed;

  const snapshot = code && !limited ? await prisma.publishedResultSnapshot.findUnique({ where: { verificationCode: code } }) : null;
  const payload = snapshot ? (snapshot.payload as unknown as SnapshotPayload) : null;
  const intact = snapshot ? isSnapshotIntact(snapshot) : false;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="m-0 text-title font-medium tracking-tight text-text-primary">Verify a result</h1>
      <p className="mt-2 text-body text-text-secondary">Enter the verification code printed on a result to confirm it was issued by the school.</p>

      <form action="/verify" method="get" className="mt-5 flex gap-2">
        <input
          name="code"
          defaultValue={raw ?? ""}
          placeholder="e.g. R7K4-P2M9"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg-card px-3 font-mono text-body uppercase text-text-primary"
        />
        <button type="submit" className="h-10 rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white">
          Verify
        </button>
      </form>

      {limited && limit && (
        <p className="mt-5 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-caption text-warning">{waitMessage(limit.retryAfterSec)}</p>
      )}

      {code && !limited && !snapshot && (
        <p className="mt-5 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-caption text-danger">
          No result matches that code. Check it and try again — a document without a matching code should not be trusted.
        </p>
      )}

      {snapshot && payload && !intact && (
        <p className="mt-5 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-caption text-warning">
          This code exists, but the record failed an integrity check. Please contact the school before relying on it.
        </p>
      )}

      {snapshot && payload && intact && snapshot.supersededAt && (
        <p className="mt-5 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-caption text-warning">
          This code was genuinely issued by {payload.school.name}, but that version was superseded by a corrected result on{" "}
          {new Date(snapshot.supersededAt).toLocaleDateString("en-GB")}. Ask the school or the parent portal for the current version.
        </p>
      )}

      {snapshot && payload && intact && !snapshot.supersededAt && (
        <div className="mt-5 rounded-md border border-success/30 bg-success-bg px-4 py-4">
          <strong className="block text-body font-medium text-success">Verified — issued by {payload.school.name}</strong>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-caption">
            <div>
              <dt className="text-[10px] text-text-muted">Term</dt>
              <dd className="font-medium text-text-primary">{payload.period.term}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-text-muted">Session</dt>
              <dd className="font-medium text-text-primary">{payload.period.session}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-text-muted">Class</dt>
              <dd className="font-medium text-text-primary">{payload.student.className}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-text-muted">Student</dt>
              <dd className="font-medium text-text-primary">{initialsOf(payload.student.name)}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-text-muted">Published</dt>
              <dd className="font-medium text-text-primary">{new Date(snapshot.publishedAt).toLocaleDateString("en-GB")}</dd>
            </div>
          </dl>
        </div>
      )}
    </main>
  );
}
