import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LEGAL_UPDATED, OPERATOR, SUPPORT_EMAIL } from "@/lib/legal";

// The shared frame for the Terms and Privacy pages: readable width, a simple
// header, and links between the two pages and back home.
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-bg-page">
      <header className="border-b border-border bg-bg-card">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Sophie Educational Assistant home">
            <Logo height={34} />
          </Link>
          <nav aria-label="Legal" className="flex gap-4 text-caption">
            <Link href="/terms" className="text-primary hover:text-primary-hover">
              Terms
            </Link>
            <Link href="/privacy" className="text-primary hover:text-primary-hover">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-5 py-10 sm:px-8">
        <h1 className="m-0 text-[1.75rem] font-medium text-text-primary">{title}</h1>
        <p className="mt-2 text-caption text-text-muted">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-5 text-body leading-relaxed text-text-secondary">{intro}</p>
        <div className="mt-8 grid gap-8">{children}</div>
        <p className="mt-12 border-t border-border pt-6 text-caption leading-relaxed text-text-muted">
          {OPERATOR} · Questions about this page: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:text-primary-hover">{SUPPORT_EMAIL}</a>
        </p>
      </main>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="m-0 mb-2.5 text-heading font-medium text-text-primary">{heading}</h2>
      <div className="grid gap-3 text-body leading-relaxed text-text-secondary [&_a]:text-primary [&_li]:ml-5 [&_li]:list-disc [&_ul]:m-0 [&_ul]:grid [&_ul]:gap-1.5 [&_ul]:p-0">{children}</div>
    </section>
  );
}
