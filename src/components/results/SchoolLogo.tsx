"use client";

import { useState } from "react";

// A school's logo can be any URL the school pasted in, hosted anywhere —
// and once a result is published, that URL is frozen into the snapshot
// forever. If the link ever rots, fall back to the initials avatar instead
// of leaving a permanently broken image on an issued document.
export function SchoolLogo({ logoUrl, initials }: { logoUrl: string; initials: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="grid h-10 w-10 flex-none place-items-center rounded bg-primary text-caption font-medium text-white">{initials}</div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL set by the school, not an optimizable local asset
  return <img src={logoUrl} alt="" onError={() => setBroken(true)} className="h-10 w-10 flex-none rounded object-contain" />;
}
