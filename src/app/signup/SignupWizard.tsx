"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Building2, CreditCard, UserPlus, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { checkSlugAvailable, createSchoolSignup } from "./actions";
import { Logo } from "@/components/ui/Logo";
import { PackageOverview, type PlanSummary } from "@/components/PackageOverview";
import { TermsConsent } from "@/components/TermsConsent";
import { PasswordInput } from "@/components/ui/PasswordInput";

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

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// What a school registering today can start with (worked out on the server).
export type SignupOffer = {
  /** The full-session discount, so the card says what it really saves. */
  savePercent: number;
  term: { key: string; label: string; session: string; listPrice: number; discount: number; amount: number; start: string; end: string } | null;
  session: { session: string; listPrice: number; amount: number; start: string; end: string } | null;
};

export function SignupWizard({ offer }: { offer: SignupOffer }) {
  const [step, setStep] = useState(1);

  const [schoolName, setSchoolName] = useState("");
  const [manualSlug, setManualSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const slug = slugTouched ? manualSlug : slugify(schoolName);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  const [billingCycle, setBillingCycle] = useState<"PER_TERM" | "FULL_SESSION">(offer.term ? "PER_TERM" : "FULL_SESSION");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [agree, setAgree] = useState(false);

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
    if (!agree) return setError("Please agree to the Terms of Use and Privacy Policy.");

    startTransition(async () => {
      try {
        const result = await createSchoolSignup({
          schoolName,
          slug,
          plan: billingCycle === "FULL_SESSION" ? "SESSION" : (offer.term?.key ?? ""),
          session: (billingCycle === "FULL_SESSION" ? offer.session?.session : offer.term?.session) ?? "",
          adminName,
          adminEmail,
          adminPassword,
          acceptedTerms: agree,
        });
        if (!result.ok) return setError(result.error);
        const { authorizationUrl } = result;

        const signedIn = await signIn("credentials", { email: adminEmail, password: adminPassword, redirect: false });
        if (signedIn?.error) {
          setError("Your account was created, but automatic sign-in failed. Sign in manually to complete payment.");
          return;
        }

        window.location.href = authorizationUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create your account.");
      }
    });
  }

  // The plan chosen, described the same way on the plan step and the last step.
  const summary: PlanSummary | null =
    billingCycle === "FULL_SESSION" && offer.session
      ? {
          title: `Full session ${offer.session.session}`,
          covers: `${day(offer.session.start)} – ${day(offer.session.end)}`,
          price: offer.session.amount,
        }
      : offer.term
        ? {
            title: `${offer.term.label} ${offer.term.session}`,
            covers: `${day(offer.term.start)} – ${day(offer.term.end)}`,
            price: offer.term.amount,
            priceNote: offer.term.discount > 0 ? `${naira(offer.term.listPrice)} less ${naira(offer.term.discount)} for registering` : undefined,
          }
        : null;
  const planPrice = summary?.price ?? 0;

  return (
    <div className="grid min-h-screen place-items-center bg-bg-page px-4 py-10">
      <div className="w-full max-w-[560px] rounded-md border border-border bg-bg-card p-8">
        <div className="mb-7">
          <Logo height={42} />
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
                <div className="flex flex-col overflow-hidden rounded-md border border-border focus-within:border-primary sm:flex-row sm:items-center">
                  <span className="whitespace-nowrap bg-bg-page px-3 py-2 text-caption text-text-muted">sea-result.vercel.app/lookup/</span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setManualSlug(slugify(e.target.value));
                    }}
                    required
                    className="h-10 w-full min-w-0 flex-1 border-0 bg-bg-card px-2 text-body text-text-primary outline-none"
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
                {offer.term && (
                  <button
                    type="button"
                    onClick={() => setBillingCycle("PER_TERM")}
                    aria-pressed={billingCycle === "PER_TERM"}
                    className={`rounded-md border p-4 text-left ${billingCycle === "PER_TERM" ? "border-primary bg-primary-bg" : "border-border bg-bg-card"}`}
                  >
                    <div className="text-body font-medium text-text-primary">{offer.term.label} {offer.term.session}</div>
                    <div className="mt-1 text-title font-medium text-text-primary">{naira(offer.term.amount)}</div>
                    <p className="m-0 mt-1 text-caption text-text-muted">
                      {naira(offer.term.listPrice)} less {naira(offer.term.discount)} for registering
                    </p>
                    <p className="m-0 mt-1 text-caption text-text-muted">Covers {day(offer.term.start)} – {day(offer.term.end)}</p>
                  </button>
                )}
                {offer.session && (
                  <button
                    type="button"
                    onClick={() => setBillingCycle("FULL_SESSION")}
                    aria-pressed={billingCycle === "FULL_SESSION"}
                    className={`rounded-md border p-4 text-left ${billingCycle === "FULL_SESSION" ? "border-primary bg-primary-bg" : "border-border bg-bg-card"}`}
                  >
                    <div className="text-body font-medium text-text-primary">Full session {offer.session.session}</div>
                    <div className="mt-1 text-title font-medium text-text-primary">{naira(offer.session.amount)}</div>
                    <p className="m-0 mt-1 text-caption text-text-muted">Save {offer.savePercent}% · every term still to come</p>
                    <p className="m-0 mt-1 text-caption text-text-muted">Covers {day(offer.session.start)} – {day(offer.session.end)}</p>
                  </button>
                )}
              </div>
              <PackageOverview summary={summary} />
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
                  <PasswordInput
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
                  <PasswordInput
                    value={adminConfirm}
                    onChange={(e) => setAdminConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary outline-none focus:border-primary"
                  />
                </label>
              </div>
              <PackageOverview summary={summary} showFeatures={false} />
              <TermsConsent checked={agree} onChange={setAgree} />
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
