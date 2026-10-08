"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { PasswordInput } from "@/components/ui/PasswordInput";

const DASHBOARD_BY_ROLE: Record<string, string> = {
  PLATFORM_OWNER: "/owner/dashboard",
  SCHOOL_ADMIN: "/admin/dashboard",
  TEACHER: "/teacher/classes",
  PARENT: "/parent/dashboard",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set once the password was right for an account that has two-step sign-in on.
  const [needsCode, setNeedsCode] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      code: formData.get("code") ?? "",
      redirect: false,
    });

    if (result?.error) {
      setLoading(false);
      if (result.code === "two_step_required") {
        setNeedsCode(true);
        setError(null);
        return;
      }
      setError(
        result.code === "too_many_attempts"
          ? "Too many failed attempts. Please wait about 15 minutes and try again."
          : result.code === "invalid_two_step_code"
            ? "That code didn't work. Check the code in your authenticator app, or use a recovery code."
            : "Incorrect email or password.",
      );
      if (result.code !== "invalid_two_step_code") setNeedsCode(false);
      return;
    }

    // Only an address inside this site: "//evil.example" and "https://…" would send a signed-in person somewhere else.
    const callbackUrl = searchParams.get("callbackUrl");
    if (callbackUrl && /^\/(?![/\\])/.test(callbackUrl)) {
      router.push(callbackUrl);
      return;
    }

    const session = await getSession();
    setLoading(false);
    router.push(DASHBOARD_BY_ROLE[session?.user.role ?? ""] ?? "/");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {error && (
        <p className="rounded-sm border border-danger/30 bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>
      )}
      <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
        />
      </label>
      <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
        Password
        <PasswordInput
          name="password"
          required
          autoComplete="current-password"
          className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
        />
      </label>
      {needsCode && (
        <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
          Sign-in code
          <input
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="text"
            maxLength={16}
            placeholder="6-digit code"
            className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body tracking-widest text-text-primary outline-none focus:border-primary"
          />
          <span className="font-normal text-text-muted">Open your authenticator app and enter the 6-digit code. Lost your phone? Enter one of your recovery codes instead.</span>
        </label>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
