import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg-page px-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-sm font-medium text-white">
        SEA
      </span>
      <div>
        <h1 className="m-0 text-title font-medium tracking-tight text-text-primary">
          Sophie Educational Assistant
        </h1>
        <p className="mx-auto mt-2 max-w-md text-body text-text-muted">
          Multi-tenant school results management for African institutions.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-sm border border-border bg-bg-card px-4 py-2.5 text-body font-medium text-text-primary hover:bg-bg-page"
        >
          Set up your school
        </Link>
        <Link href="/lookup" className="px-4 py-2.5 text-body font-medium text-primary hover:text-primary-hover">
          Look up a result
        </Link>
      </div>
    </div>
  );
}
