export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[400px] rounded-md border border-border bg-bg-card p-8">
        <h1 className="m-0 mb-1 text-heading font-medium text-text-primary">Choose a new password</h1>
        <p className="m-0 mb-6 text-body text-text-muted">Your new password must be at least 8 characters.</p>
        <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
          New password
          <input
            type="password"
            className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
          />
        </label>
        <button
          type="button"
          className="mt-4 w-full rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover"
        >
          Update password
        </button>
      </div>
    </div>
  );
}
