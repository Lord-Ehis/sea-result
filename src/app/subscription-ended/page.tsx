import type { Metadata } from "next";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = { title: "Subscription ended", robots: { index: false, follow: false } };

// Where a teacher of a school whose subscription has lapsed lands (an admin is
// sent to Billing instead, so they can renew).
export default function SubscriptionEndedPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
      <div className="rounded-md border border-border bg-bg-card p-6 text-center">
        <h1 className="m-0 text-heading font-medium text-text-primary">Your school&apos;s subscription has ended</h1>
        <p className="mt-2 text-body text-text-secondary">
          Result entry is paused until the school renews its subscription. Please ask your school&apos;s administrator to renew — nothing you entered has been lost.
        </p>
        <div className="mt-5">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
