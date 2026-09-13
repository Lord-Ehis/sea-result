import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[480px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-[11px] font-medium text-white">
            SEA
          </span>
          <span className="text-subtitle font-medium tracking-tight text-text-primary">
            Sophie Educational Assistant
          </span>
        </div>
        <h1 className="m-0 mb-1 text-heading font-medium text-text-primary">Set up your school</h1>
        <p className="m-0 mb-6 text-body text-text-muted">
          Self-signup wizard — school details, plan selection, and admin account creation.
        </p>
        <p className="m-0 text-caption text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
