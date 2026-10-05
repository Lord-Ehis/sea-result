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
          <span className="font-mono text-[11px] tracking-tight">
            © {new Date().getFullYear()} Unisoft Technologies · Sophie Educational Assistant
          </span>
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

// A "system status" style tag — a live dot + monospace label — used in
// place of a plain text eyebrow to read more like product UI chrome than
// marketing copy.
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary-bg px-3 py-1.5 font-mono text-[0.7rem] font-medium tracking-wide text-primary">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      {children}
    </div>
  );
}

// A large, low-opacity blurred gradient pair — the "glow" behind a hero
// section that reads as digital-product rather than flat marketing white.
export function GlowBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute top-[-180px] left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(24,95,165,0.16),transparent)] blur-2xl" />
      <div className="absolute top-[60px] right-[-120px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(closest-side,rgba(15,110,86,0.14),transparent)] blur-2xl" />
      <div
        className="absolute inset-x-0 top-0 h-[560px] opacity-[0.55]"
        style={{
          backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 60% 70% at 50% 15%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 50% 15%, black 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

// A card styled like a small app window — hairline border, a muted
// window-chrome dot bar, and a hover lift — the recurring "this is
// software, not a brochure" motif used across both marketing pages.
export function WindowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`group overflow-hidden rounded-[14px] border border-[#dce5e9] bg-white transition-all duration-200 hover:-translate-y-[3px] hover:border-primary/30 hover:shadow-[0_16px_36px_-16px_rgba(24,95,165,0.28)] ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-[#eef1f2] bg-[#fafbfc] px-4 py-2.5">
        <span className="h-[7px] w-[7px] rounded-full bg-[#e7d78a]" />
        <span className="h-[7px] w-[7px] rounded-full bg-[#9bcfae]" />
        <span className="h-[7px] w-[7px] rounded-full bg-[#dce5e9]" />
      </div>
      {children}
    </div>
  );
}

// The dark CTA band reused at the bottom of every marketing page.
export function CtaBand() {
  return (
    <section className="relative overflow-hidden bg-deep text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 60% 100% at 20% 50%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 100% at 20% 50%, black 0%, transparent 75%)",
        }}
      />
      <div className="relative mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center md:px-12">
        <div>
          <p className="m-0 font-mono text-[0.72rem] tracking-wide text-[#80c7b3]">{"// ready when you are"}</p>
          <h2 className="m-0 mt-2 text-[1.6rem] font-medium tracking-[-0.03em] sm:text-[1.9rem]">Ready to see it on your own results?</h2>
          <p className="mt-2 max-w-[480px] text-[0.92rem] leading-relaxed text-[#a9bfca]">
            Set up your school in minutes, or check a student result if you were sent a verification code.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[9px] border border-primary bg-primary px-5 text-[0.9rem] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Set up your school
          </Link>
          <Link
            href="/lookup"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[9px] border border-[#3a5b71] bg-transparent px-5 text-[0.9rem] font-medium text-white transition-colors hover:border-[#5a7d92]"
          >
            Check a student result
          </Link>
        </div>
      </div>
    </section>
  );
}
