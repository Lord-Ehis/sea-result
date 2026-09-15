"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Building2, CreditCard, UserPlus, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { checkSlugAvailable, createSchoolSignup } from "./actions";
import { defaultSessionLabel, defaultTermLabel } from "@/lib/academic-term";

const STEPS = [
  { key: 1, label: "School", icon: Building2 },
  { key: 2, label: "Plan", icon: CreditCard },
  { key: 3, label: "Account", icon: UserPlus },
] as const;

const naira = (n: number) => `₦${n.toLocaleString()}`;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Pricing = { perTermPrice: number; termPrice: number; sessionPrice: number };

export function SignupWizard({ pricing }: { pricing: Pricing }) {
  const [step, setStep] = useState(1);

  const [schoolName, setSchoolName] = useState("");
  const [manualSlug, setManualSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const slug = slugTouched ? manualSlug : slugify(schoolName);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  const [billingCycle, setBillingCycle] = useState<"PER_TERM" | "FULL_SESSION">("PER_TERM");
  const [term, setTerm] = useState(defaultTermLabel());
  const [sessionLabel, setSessionLabel] = useState(defaultSessionLabel());

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!slug) {
        if (!cancelled) setSlugStatus("idle");
        return;
      }
      if (!/^[a-z0-9-]{2,}$/.test(slug)) {
        if (!cancelled) setSlugStatus("invalid");
        return;
      }
      if (!cancelled) setSlugStatus("checking");
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (cancelled) return;
      const available = await checkSlugAvailable(slug);
      if (!cancelled) setSlugStatus(available ? "available" : "taken");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function goNext() {
    setError(null);
    if (step === 1) {
      if (!schoolName.trim()) return setError("Enter your school's name.");
      if (slugStatus !== "available") return setError("Choose an available URL before continuing.");
    }
    if (step === 2) {
      if (billingCycle === "PER_TERM" && !term.trim()) return setError("Enter the term this covers.");
      if (!sessionLabel.trim()) return setError("Enter the academic session.");
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (adminPassword !== adminConfirm) return setError("Passwords don't match.");

    startTransition(async () => {
      try {
        const { authorizationUrl } = await createSchoolSignup({
          schoolName,
          slug,
          billingCycle,
          term: billingCycle === "PER_TERM" ? term : undefined,
          session: sessionLabel,
          adminName,
          adminEmail,
          adminPassword,
        });

        const result = await signIn("credentials", { email: adminEmail, password: adminPassword, redirect: false });
        if (result?.error) {
          setError("Your account was created, but automatic sign-in failed. Sign in manually to complete payment.");
          return;
        }

        window.location.href = authorizationUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create your account.");
      }
    });
  }

  const planPrice = billingCycle === "FULL_SESSION" ? pricing.sessionPrice : pricing.perTermPrice;

  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4 py-10">
      <div className="w-full max-w-[560px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-[11px] font-medium text-white">SEA</span>
          <span className="text-subtitle font-medium tracking-tight text-text-primary">Sophie Educational Assistant</span>
        </div>

        <div className="mb-7 flex items-center gap-2">
          {STEPS.map(({ key, label, icon: Icon }, i) => (
            <div key={key} className="flex flex-1 items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-8 w-8 flex-none place-items-center rounded-full text-caption font-medium ${
                    step === key
                      ? "bg-primary text-white"
                      : step > key
                        ? "bg-success-bg text-success"
                        : "bg-bg-page text-text-muted"
                  }`}
                >
                  {step > key ? <Check size={14} strokeWidth={2} /> : <Icon size={14} strokeWidth={1.8} />}
                </span>
                <span className={`hidden text-caption font-medium sm:inline ${step === key ? "text-text-primary" : "text-text-muted"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && <span className={`h-px flex-1 ${step > key ? "bg-success" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="grid gap-4">
              <h1 className="m-0 text-heading font-medium text-text-primary">Set up your school</h1>
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                School name
                <input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Graceland International School"
                  required
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Your result-lookup URL
                <div className="flex items-center overflow-hidden rounded-md border border-border focus-within:border-primary">
                  <span className="whitespace-nowrap bg-bg-page px-3 py-2 text-caption text-text-muted">sea-result.vercel.app/lookup/</span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setManualSlug(slugify(e.target.value));
                    }}
                    required
                    className="h-10 min-w-0 flex-1 border-0 bg-bg-card px-2 text-body text-text-primary outline-none"
                  />
                </div>
                {slugStatus === "checking" && <span className="text-caption text-text-muted">Checking availability…</span>}
                {slugStatus === "available" && <span className="text-caption text-success">Available</span>}
                {slugStatus === "taken" && <span className="text-caption text-danger">Already taken — try something else.</span>}
                {slugStatus === "invalid" && <span className="text-caption text-danger">Lowercase letters, numbers, and hyphens only.</span>}
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <h1 className="m-0 text-heading font-medium text-text-primary">Choose your plan</h1>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBillingCycle("PER_TERM")}
                  className={`rounded-md border p-4 text-left ${billingCycle === "PER_TERM" ? "border-primary bg-primary-bg" : "border-border bg-bg-card"}`}
                >
                  <div className="text-body font-medium text-text-primary">Per term</div>
                  <div className="mt-1 text-title font-medium text-text-primary">{naira(pricing.perTermPrice)}</div>
                  <p className="m-0 mt-1 text-caption text-text-muted">New subscriber rate · billed one term at a time</p>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("FULL_SESSION")}
                  className={`rounded-md border p-4 text-left ${billingCycle === "FULL_SESSION" ? "border-primary bg-primary-bg" : "border-border bg-bg-card"}`}
                >
                  <div className="text-body font-medium text-text-primary">Full session</div>
                  <div className="mt-1 text-title font-medium text-text-primary">{naira(pricing.sessionPrice)}</div>
                  <p className="m-0 mt-1 text-caption text-text-muted">Save 20% · one payment for all 3 terms</p>
                </button>
              </div>
              {billingCycle === "PER_TERM" && (
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  Term
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="e.g. Term 1, 2025/2026"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                  />
                </label>
              )}
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Academic session
                <input
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  placeholder="e.g. 2025/2026"
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <h1 className="m-0 text-heading font-medium text-text-primary">Create your admin account</h1>
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Your name
                <input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                Email
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  Password
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  Confirm password
                  <input
                    type="password"
                    value={adminConfirm}
                    onChange={(e) => setAdminConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                  />
                </label>
              </div>
              <p className="m-0 rounded-md bg-bg-page px-3.5 py-3 text-caption leading-relaxed text-text-secondary">
                You&apos;ll pay {naira(planPrice)} with Paystack right after this to activate {schoolName || "your school"}.
              </p>
            </div>
          )}

          {error && <p className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

          <div className="mt-6 flex items-center justify-between gap-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
              >
                <ArrowLeft size={15} strokeWidth={1.8} />
                Back
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white hover:bg-primary-hover"
              >
                Continue
                <ArrowRight size={15} strokeWidth={1.8} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {pending ? "Creating account…" : "Create account & pay"}
              </button>
            )}
          </div>
        </form>

        <p className="m-0 mt-6 border-t border-border pt-5 text-caption text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
