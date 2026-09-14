"use client";

import { useState } from "react";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Ignored — always show the same generic confirmation below.
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <p className="m-0 rounded-md bg-success-bg px-3.5 py-3 text-caption leading-relaxed text-success">
        If an account exists for {email}, we&apos;ve sent a link to reset the password. It expires in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-sm border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-sm bg-primary px-4 py-2.5 text-body font-medium text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
