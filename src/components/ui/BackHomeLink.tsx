import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// A small way out of a standalone, logged-out flow (result lookup, signup)
// back to the marketing home page — these pages otherwise have no nav at
// all, so once someone lands here there was previously no way back except
// the browser's own back button.
export function BackHomeLink() {
  return (
    <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-caption font-medium text-text-muted hover:text-primary">
      <ArrowLeft size={14} strokeWidth={2} />
      Back to home
    </Link>
  );
}
