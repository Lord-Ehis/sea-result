"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }

    router.push(searchParams.get("callbackUrl") ?? "/");
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
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
        />
      </label>
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
