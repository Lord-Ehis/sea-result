"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { registerParent } from "./actions";
import { Logo } from "@/components/ui/Logo";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { TermsConsent } from "@/components/TermsConsent";

export function ParentSignupForm({ schoolName, slug }: { schoolName: string; slug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));
    const confirm = String(formData.get("confirm"));
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const created = await registerParent({
        slug,
        name: String(formData.get("name")),
        email: String(formData.get("email")),
        password,
        acceptedTerms: formData.get("agree") === "on",
      });
      if (!created.ok) {
        setLoading(false);
        setError(created.error);
        return;
      }
    } catch {
      setLoading(false);
      setError("Could not create your account. Please try again.");
      return;
    }

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setError("Account created, but sign-in failed. Try signing in from the login page.");
      return;
    }
    router.push("/parent/link-child");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4">
      <div className="w-full max-w-[440px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7">
          <Logo height={42} />
        </div>
        <h1 className="m-0 mb-1 text-heading font-medium text-text-primary">Create a parent account</h1>
        <p className="m-0 mb-6 text-body text-text-muted">
          For <strong>{schoolName}</strong>. Track results across every term for all your children in one place.
        </p>
        <form onSubmit={onSubmit} className="grid gap-4">
          {error && <p className="rounded-sm border border-danger/30 bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Your full name
            <input
              name="name"
              required
              autoComplete="name"
              className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
            />
          </label>
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
              minLength={8}
              autoComplete="new-password"
              className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Confirm password
            <PasswordInput
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
            />
          </label>
          <TermsConsent />
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-caption text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
