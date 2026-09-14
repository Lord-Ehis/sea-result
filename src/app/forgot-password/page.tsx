import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[400px] rounded-md border border-border bg-bg-card p-8">
        <h1 className="m-0 mb-1 text-heading font-medium text-text-primary">Reset your password</h1>
        <p className="m-0 mb-6 text-body text-text-muted">
          Enter the email on your account and we&apos;ll send a reset link.
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 text-caption text-text-muted">
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
