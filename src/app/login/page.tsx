import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[400px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-[11px] font-medium text-white">
            SEA
          </span>
          <span className="text-subtitle font-medium tracking-tight text-text-primary">
            Sophie Educational Assistant
          </span>
        </div>
        <h1 className="m-0 mb-1 text-heading font-medium text-text-primary">Sign in</h1>
        <p className="m-0 mb-6 text-body text-text-muted">Enter your details to access your workspace.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-caption text-text-muted">
          <Link href="/forgot-password" className="font-medium text-primary hover:text-primary-hover">
            Forgot password?
          </Link>
        </p>
        <p className="mt-2 text-caption text-text-muted">
          New school?{" "}
          <Link href="/signup" className="font-medium text-primary hover:text-primary-hover">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
