"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Tag, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { PackageOverview } from "@/components/PackageOverview";
import { initializeSubscriptionPayment } from "./actions";

export type QuoteView =
  | { ok: true; amount: number; listPrice: number; registrationDiscount: number; credit: number; pastTermsDiscount: number; startDate: string; endDate: string }
  | { ok: false; reason: string };

type Grid = { session: string; plans: { key: string; label: string; quote: QuoteView }[] }[];

type Held = {
  id: string;
  label: string;
  session: string;
  amount: number;
  creditApplied: number;
  discountNote: string | null;
  isComplimentary: boolean;
  startDate: string;
  endDate: string;
  phase: "CURRENT" | "UPCOMING" | "ENDED";
};

type Payment = {
  id: string;
  reference: string;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  isRegistration: boolean;
  createdAt: string;
  paidAt: string | null;
};

type Access = { state: "ACTIVE" | "GRACE" | "LAPSED" | "SUSPENDED"; coverageEndsAt: string | null; graceEndsAt: string | null };

const naira = (n: number) => `₦${n.toLocaleString()}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const PHASE_LABEL = { CURRENT: "Current", UPCOMING: "Up next", ENDED: "Ended" } as const;
const PHASE_TONE = { CURRENT: "success", UPCOMING: "warning", ENDED: "neutral" } as const;

export function BillingClient({
  schoolName,
  access,
  subscriptions,
  payments,
  grid,
  registration,
}: {
  schoolName: string;
  access: Access;
  subscriptions: Held[];
  payments: Payment[];
  grid: Grid;
  registration: boolean;
}) {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [modalOpen, setModalOpen] = useState(false);
  const [session, setSession] = useState(grid[0].session);
  const [planKey, setPlanKey] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const banner = useMemo(() => {
    if (paymentStatus === "success") return { tone: "success" as const, text: "Payment successful — your subscription is active." };
    if (paymentStatus === "failed") return { tone: "danger" as const, text: "Payment was not successful. You have not been charged." };
    if (paymentStatus === "error" || paymentStatus === "missing")
      return { tone: "danger" as const, text: "We couldn't confirm that payment. Check your payment history below." };
    return null;
  }, [paymentStatus]);

  const sessionPlans = grid.find((g) => g.session === session)?.plans ?? [];
  const selected = sessionPlans.find((p) => p.key === planKey);

  // Someone who paid for terms and could finish the session for less than a fresh full session.
  const upgrade = grid
    .map((g) => ({ session: g.session, quote: g.plans.find((p) => p.key === "SESSION")?.quote }))
    .find((g): g is { session: string; quote: Extract<QuoteView, { ok: true }> } => !!g.quote && g.quote.ok && g.quote.credit > 0);
  // The first term on offer and the first full-session offer, across the sessions a school can pay for.
  const firstTerm = grid.flatMap((g) => g.plans).find((p) => p.key !== "SESSION" && p.quote.ok);
  const sessionOffer = grid.flatMap((g) => g.plans.map((p) => ({ session: g.session, ...p }))).find((p) => p.key === "SESSION" && p.quote.ok);
  const firstOfferSession = grid.find((g) => g.plans.some((p) => p.quote.ok))?.session ?? grid[0].session;

  function open(forSession: string = firstOfferSession, preferred?: string) {
    const plans = grid.find((g) => g.session === forSession)?.plans ?? [];
    const pick = (preferred && plans.find((p) => p.key === preferred && p.quote.ok)) || plans.find((p) => p.quote.ok);
    setError(null);
    setSession(forSession);
    setPlanKey(pick?.key ?? "");
    setModalOpen(true);
  }

  function changeSession(next: string) {
    const plans = grid.find((g) => g.session === next)?.plans ?? [];
    setSession(next);
    setPlanKey(plans.find((p) => p.quote.ok)?.key ?? "");
  }

  function handlePay() {
    if (!selected?.quote.ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await initializeSubscriptionPayment({ plan: planKey, session });
        if (!result.ok) return setError(result.error);
        window.location.href = result.authorizationUrl;
      } catch {
        setError("Could not start payment. Please try again.");
      }
    });
  }

  function downloadReceipt(p: Payment) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${p.reference}</title><style>body{font-family:Arial,sans-serif;color:#263844;margin:55px auto;max-width:620px;padding:20px}h1{font-size:24px;font-weight:normal;color:#185fa5}h2{font-size:16px;font-weight:normal}table{width:100%;border-collapse:collapse;margin:35px 0}td{padding:12px 0;border-bottom:1px solid #dde5e9}td:last-child{text-align:right}.total{font-size:20px}small{color:#7b8c97}</style></head><body><h1>Sophie Educational Assistant</h1><h2>Payment receipt</h2><p>${schoolName}</p><table><tr><td>Reference</td><td>${p.reference}</td></tr><tr><td>Date</td><td>${new Date(p.createdAt).toLocaleDateString("en-GB")}</td></tr><tr><td>Status</td><td>${p.status}</td></tr><tr class="total"><td>Amount</td><td>${naira(p.amount)}</td></tr></table><small>Generated from the SEA billing dashboard.</small></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${p.reference}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const statusLine =
    access.state === "ACTIVE" && access.coverageEndsAt
      ? { tone: "success" as const, label: "Active", text: `Covered until ${day(access.coverageEndsAt)}.` }
      : access.state === "GRACE" && access.coverageEndsAt && access.graceEndsAt
        ? { tone: "warning" as const, label: "Ended", text: `Ended on ${day(access.coverageEndsAt)}. Everything keeps working until ${day(access.graceEndsAt)} — renew before then.` }
        : { tone: "danger" as const, label: "Ended", text: access.coverageEndsAt ? `Ended on ${day(access.coverageEndsAt)}. Renew to restore access for your teachers and staff.` : "No subscription yet. Choose a plan to get started." };

  return (
    <>
      <PageHeader eyebrow="Account & payments" title="Billing" intro="Manage your plan and view payment history." />

      {banner && (
        <p className={`mb-5 rounded-md px-4 py-3 text-caption ${banner.tone === "success" ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{banner.text}</p>
      )}
      {access.state === "LAPSED" && !banner && (
        <p className="mb-5 rounded-md bg-danger-bg px-4 py-3 text-caption text-danger">Renew to restore access for your teachers and staff.</p>
      )}

      {registration && (
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-success bg-success-bg px-5 py-4">
          <div>
            <h2 className="m-0 text-body font-medium text-success">Finish your registration payment</h2>
            <p className="mt-1 text-caption text-success">
              Your first term is {firstTerm?.quote.ok ? naira(firstTerm.quote.amount) : "discounted"} — {naira(10000)} off for registering. This price is for the registration payment only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => open()}
            className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover"
          >
            Finish registration payment
          </button>
        </section>
      )}

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
            <div>
              <h2 className="m-0 text-heading font-medium text-text-primary">Your coverage</h2>
              <p className="mt-1.5 text-caption text-text-muted">{statusLine.text}</p>
            </div>
            <StatusPill label={statusLine.label} tone={statusLine.tone} />
          </div>
          <div className="p-5">
            {subscriptions.length > 0 ? (
              <ul className="m-0 grid list-none gap-2.5 p-0">
                {subscriptions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3.5 py-3">
                    <div>
                      <div className="text-body font-medium text-text-primary">
                        {s.label}
                        {!s.isComplimentary && <span className="font-normal text-text-muted"> · {s.session}</span>}
                      </div>
                      <div className="mt-0.5 text-caption text-text-muted">
                        {day(s.startDate)} – {day(s.endDate)}
                        {!s.isComplimentary && ` · ${naira(s.amount)}`}
                      </div>
                      {s.discountNote && (
                        <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-success-bg px-2 py-1 text-caption text-success">
                          <Tag size={12} strokeWidth={1.8} />
                          {s.discountNote}
                        </span>
                      )}
                    </div>
                    <StatusPill label={PHASE_LABEL[s.phase]} tone={PHASE_TONE[s.phase]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mb-1 text-body text-text-muted">Nothing here yet. Choose a plan to get started.</p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => open()}
                className="inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white hover:bg-primary-hover"
              >
                {subscriptions.length === 0 ? "Choose a plan" : "Add coverage"}
              </button>
              <span className="text-caption text-text-muted">Terms end when the school term ends (Dec, Apr, Aug). New coverage starts when your current coverage ends, so paying early loses nothing.</span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-[#cbdde9] bg-[#f1f7fb] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-[#dcecf7] text-primary">
              <Sparkles size={18} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="m-0 mb-1.5 text-body font-medium text-[#234c6c]">{upgrade ? "Complete the full session" : "Full session (save 20%)"}</h2>
              <p className="m-0 text-caption leading-relaxed text-[#607e94]">
                {upgrade
                  ? `You've paid ${naira(upgrade.quote.credit)} for ${upgrade.session} terms already. Pay the rest and you're covered to ${day(upgrade.quote.endDate)}.`
                  : "Pay once for the terms still to come and spend less than paying term by term. Offered while at least two terms of the session remain."}
              </p>
            </div>
          </div>
          {(upgrade || sessionOffer) && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-caption font-medium text-[#396989]">
                {upgrade ? `${naira(upgrade.quote.amount)} to pay` : sessionOffer?.quote.ok ? `${naira(sessionOffer.quote.amount)} · ${sessionOffer.session}` : ""}
              </span>
              <button
                type="button"
                onClick={() => open(upgrade ? upgrade.session : sessionOffer!.session, "SESSION")}
                className="inline-flex h-8 items-center rounded-md border border-primary bg-primary px-3 text-caption font-medium text-white hover:bg-primary-hover"
              >
                {upgrade ? "Upgrade" : "View offer"}
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Payment history</h2>
            <p className="mt-1.5 text-caption text-text-muted">Past payments and downloadable receipts</p>
          </div>
          <span className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-caption text-text-secondary">
            {payments.length} {payments.length === 1 ? "payment" : "payments"}
          </span>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fafbfb]">
              <tr>
                {["Date", "Reference", "Amount", "Status", "Receipt"].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-body text-text-muted">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-[#f0f2f3] last:border-0">
                    <td className="px-4 py-4 pl-5 text-body text-text-secondary">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-4 text-body text-text-secondary">{p.reference}</td>
                    <td className="px-4 py-4 text-body font-medium tabular-nums text-text-primary">{naira(p.amount)}</td>
                    <td className="px-4 py-4">
                      <StatusPill
                        label={p.status === "SUCCESS" ? "Paid" : p.status === "PENDING" ? "Pending" : "Failed"}
                        tone={p.status === "SUCCESS" ? "success" : p.status === "PENDING" ? "warning" : "danger"}
                      />
                    </td>
                    <td className="px-4 py-4">
                      {p.status === "SUCCESS" && (
                        <button
                          type="button"
                          onClick={() => downloadReceipt(p)}
                          aria-label={`Download receipt for ${p.reference}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-primary hover:bg-primary-bg"
                        >
                          <Download size={16} strokeWidth={1.8} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {payments.length === 0 ? (
            <div className="rounded-md border border-border px-5 py-10 text-center text-body text-text-muted">No payments yet.</div>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="rounded-md border border-border bg-bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption text-text-secondary">{new Date(p.createdAt).toLocaleDateString("en-GB")}</span>
                  <StatusPill
                    label={p.status === "SUCCESS" ? "Paid" : p.status === "PENDING" ? "Pending" : "Failed"}
                    tone={p.status === "SUCCESS" ? "success" : p.status === "PENDING" ? "warning" : "danger"}
                  />
                </div>
                <dl className="mt-3 grid gap-2 border-t border-[#f0f2f3] pt-3 text-caption">
                  <div>
                    <dt className="text-[10px] text-text-muted">Reference</dt>
                    <dd className="text-text-secondary">{p.reference}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-text-muted">Amount</dt>
                    <dd className="font-medium tabular-nums text-text-primary">{naira(p.amount)}</dd>
                  </div>
                </dl>
                {p.status === "SUCCESS" && (
                  <button
                    type="button"
                    onClick={() => downloadReceipt(p)}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#cbdde9] bg-bg-card text-caption font-medium text-primary hover:bg-primary-bg"
                  >
                    <Download size={14} strokeWidth={1.8} />
                    Download receipt
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Choose a plan" description="Terms end with the school term: 1st Dec, 2nd Apr, 3rd Aug.">
        <div className="grid gap-4 px-6 pt-5">
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Academic session
            <select
              value={session}
              onChange={(e) => changeSession(e.target.value)}
              className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
            >
              {grid.map((g) => (
                <option key={g.session} value={g.session}>
                  {g.session}
                </option>
              ))}
            </select>
          </label>

          <div role="radiogroup" aria-label="Plan" className="grid gap-2">
            {sessionPlans.map((p) => {
              const available = p.quote.ok;
              return (
                <label
                  key={p.key}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3.5 py-3 ${
                    planKey === p.key ? "border-primary bg-primary-bg" : "border-border bg-bg-card"
                  } ${available ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                >
                  <span className="flex items-center gap-3">
                    <input type="radio" name="plan" value={p.key} checked={planKey === p.key} disabled={!available} onChange={() => setPlanKey(p.key)} />
                    <span>
                      <span className="block text-body font-medium text-text-primary">{p.label}</span>
                      <span className="block text-caption text-text-muted">
                        {p.quote.ok ? `${day(p.quote.startDate)} – ${day(p.quote.endDate)}` : p.quote.reason}
                      </span>
                    </span>
                  </span>
                  {p.quote.ok && <span className="text-body font-medium tabular-nums text-text-primary">{naira(p.quote.amount)}</span>}
                </label>
              );
            })}
          </div>

          {selected?.quote.ok && (
            <dl className="m-0 grid gap-1.5 rounded-md bg-bg-page px-3.5 py-3 text-caption text-text-secondary">
              <div className="flex justify-between">
                <dt>{selected.label} price</dt>
                <dd className="tabular-nums">{naira(selected.quote.listPrice)}</dd>
              </div>
              {selected.quote.registrationDiscount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Registration discount</dt>
                  <dd className="tabular-nums">−{naira(selected.quote.registrationDiscount)}</dd>
                </div>
              )}
              {selected.quote.pastTermsDiscount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Terms already over</dt>
                  <dd className="tabular-nums">−{naira(selected.quote.pastTermsDiscount)}</dd>
                </div>
              )}
              {selected.quote.credit > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Already paid for {session} terms</dt>
                  <dd className="tabular-nums">−{naira(selected.quote.credit)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 text-body font-medium text-text-primary">
                <dt>You pay</dt>
                <dd className="tabular-nums">{naira(selected.quote.amount)}</dd>
              </div>
              <div className="flex justify-between pt-0.5 text-text-muted">
                <dt>Covers</dt>
                <dd>
                  {day(selected.quote.startDate)} – {day(selected.quote.endDate)}
                </dd>
              </div>
            </dl>
          )}

          <details className="rounded-md border border-border">
            <summary className="cursor-pointer px-3.5 py-2.5 text-caption font-medium text-primary">What&apos;s included</summary>
            <div className="px-3.5 pb-3.5">
              <PackageOverview />
            </div>
          </details>
        </div>
        {error && <p className="mx-6 mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
        <div className="flex justify-end gap-2 px-6 py-5">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePay}
            disabled={pending || !selected?.quote.ok}
            className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
          >
            {pending ? "Redirecting…" : "Pay with Paystack"}
          </button>
        </div>
      </Modal>
    </>
  );
}
