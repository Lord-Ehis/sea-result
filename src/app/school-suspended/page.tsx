import type { Metadata } from "next";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = { title: "School suspended", robots: { index: false, follow: false } };

// Where staff of a suspended school land. Parents are never sent here — their
// published results stay available.
export default function SchoolSuspendedPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
      <div className="rounded-md border border-border bg-bg-card p-6 text-center">
        <h1 className="m-0 text-heading font-medium text-text-primary">This school is suspended</h1>
        <p className="mt-2 text-body text-text-secondary">
          Access to the school&apos;s workspace has been switched off by the platform. Result entry, review and publishing are unavailable until it is reactivated.
        </p>
        <p className="mt-2 text-caption text-text-muted">
          Parents can still view results that were already published. To have access restored, contact Sophie Educational Assistant support.
        </p>
        <div className="mt-5">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
