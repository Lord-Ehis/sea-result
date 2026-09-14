import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[400px] rounded-md border border-border bg-bg-card p-8">
        <h1 className="m-0 mb-1 text-heading font-medium text-text-primary">Choose a new password</h1>
        <p className="m-0 mb-6 text-body text-text-muted">Your new password must be at least 8 characters.</p>
        <ResetPasswordForm token={token ?? null} />
      </div>
    </div>
  );
}
