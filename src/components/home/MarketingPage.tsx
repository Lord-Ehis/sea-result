import Link from "next/link";
import { HomeNav } from "@/components/home/HomeNav";

// The shared frame for standalone marketing pages reached from the home
// nav ("Why SEA", "How it works") — same nav and footer as the home page
// itself, so navigating to one feels like a continuation of it rather than
// a different, stripped-down site.
export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh overflow-hidden bg-bg-page">
      <HomeNav />
      <main>{children}</main>
      <footer className="border-t border-border bg-bg-card">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-caption text-text-muted sm:px-8 md:px-12">
          <span>© {new Date().getFullYear()} Unisoft Technologies · Sophie Educational Assistant</span>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/terms" className="text-primary hover:text-primary-hover">
              Terms of Use
            </Link>
            <Link href="/privacy" className="text-primary hover:text-primary-hover">
              Privacy Policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// A short uppercase kicker label, matching the home page hero's
// "Results management, reimagined" treatment.
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-2.5 text-[0.78rem] font-medium tracking-[0.08em] text-primary uppercase">
      <span className="h-0.5 w-7 rounded-full bg-primary" />
      {children}
    </div>
  );
}

// The dark CTA band reused at the bottom of every marketing page.
export function CtaBand() {
  return (
    <section className="bg-deep text-white">
      <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center md:px-12">
        <div>
          <h2 className="m-0 text-[1.6rem] font-medium tracking-[-0.03em] sm:text-[1.9rem]">Ready to see it on your own results?</h2>
          <p className="mt-2 max-w-[480px] text-[0.92rem] leading-relaxed text-[#a9bfca]">
            Set up your school in minutes, or check a student result if you were sent a verification code.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[9px] border border-primary bg-primary px-5 text-[0.9rem] font-medium text-white hover:bg-primary-hover"
          >
            Set up your school
          </Link>
          <Link
            href="/lookup"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[9px] border border-[#3a5b71] bg-transparent px-5 text-[0.9rem] font-medium text-white hover:border-[#5a7d92]"
          >
            Check a student result
          </Link>
        </div>
      </div>
    </section>
  );
}
