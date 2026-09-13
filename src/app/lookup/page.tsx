import Link from "next/link";

export default function ResultLookupPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[420px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-[11px] font-medium text-white">
            SEA
          </span>
          <span className="text-subtitle font-medium tracking-tight text-text-primary">Result lookup</span>
        </div>
        <p className="m-0 mb-6 text-body text-text-muted">
          Enter the student code and full name to view a result — no account required.
        </p>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Student code
            <input className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary" />
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Student full name
            <input className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary" />
          </label>
          <button
            type="button"
            className="rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover"
          >
            View result
          </button>
        </div>
        <p className="mt-6 text-caption text-text-muted">
          Have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
