import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[400px] rounded-md border border-border bg-bg-card p-8">
        <h1 className="m-0 mb-1 text-heading font-medium text-text-primary">Reset your password</h1>
        <p className="m-0 mb-6 text-body text-text-muted">
          Enter the email on your account and we&apos;ll send a reset link.
        </p>
        <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
          Email
          <input
            type="email"
            className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
          />
        </label>
        <button
          type="button"
          className="mt-4 w-full rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover"
        >
          Send reset link
        </button>
        <p className="mt-6 text-caption text-text-muted">
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
