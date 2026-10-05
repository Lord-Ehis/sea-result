"use client";

import { useState } from "react";
import type { SnapshotSignOff } from "@/lib/snapshot";

// A pasted image URL can rot after a result is frozen; a dead signature or
// stamp is simply left out rather than shown as a broken image.
function SignOffImage({ src, className }: { src: string; className: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL set by the school, not an optimizable local asset
  return <img src={src} alt="" onError={() => setBroken(true)} className={className} />;
}

// Teacher and principal (with signature lines), the school stamp, and when
// the next term begins — the foot of a report card.
export function SignOffBlock({ signOff, issuedOn }: { signOff: SnapshotSignOff; issuedOn?: string | null }) {
  const issued = issuedOn ? new Date(issuedOn).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  const nextTerm = signOff.nextTermBegins ? new Date(signOff.nextTermBegins).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const signers = [
    { role: "Teacher", name: signOff.teacherName, signature: null },
    { role: "Principal", name: signOff.principalName, signature: signOff.principalSignatureUrl },
  ].filter((s) => s.name || s.signature);

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {signers.length > 0 && (
        <div className="grid gap-4 p-3 sm:grid-cols-2">
          {signers.map((s) => (
            <div key={s.role} className="text-caption">
              <span className="block text-[10px] text-text-muted">{s.role}</span>
              <span className="block font-medium">{s.name ?? "—"}</span>
              <div className="mt-2 flex h-12 items-end border-b border-text-muted/50">
                {s.signature && <SignOffImage src={s.signature} className="max-h-12 object-contain" />}
              </div>
              <span className="mt-0.5 flex justify-between text-[10px] text-text-muted">
                <span>Signature</span>
                {issued && <span>Date: {issued}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {(signOff.stampUrl || nextTerm) && (
        <div className="flex items-center justify-between gap-3 border-t border-border p-3 text-caption">
          <span>
            {nextTerm && (
              <>
                <span className="block text-[10px] text-text-muted">Next term begins</span>
                <span className="font-medium">{nextTerm}</span>
              </>
            )}
          </span>
          {signOff.stampUrl && <SignOffImage src={signOff.stampUrl} className="max-h-16 object-contain" />}
        </div>
      )}
    </div>
  );
}
