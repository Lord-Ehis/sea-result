"use client";

import { useState } from "react";

// Same reasoning as SchoolLogo: the URL is pasted by an admin and frozen into
// the snapshot forever, so a dead link falls back to initials instead of a
// permanently broken image on an issued result.
export function StudentPhoto({ photoUrl, initials }: { photoUrl: string; initials: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="grid h-14 w-14 flex-none place-items-center rounded-full bg-primary-bg text-caption font-medium text-primary">{initials}</div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL set by the school, not an optimizable local asset
  return <img src={photoUrl} alt="" onError={() => setBroken(true)} className="h-14 w-14 flex-none rounded-full object-cover" />;
}
