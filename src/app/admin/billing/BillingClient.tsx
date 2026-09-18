"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Tag, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { initializeSubscriptionPayment } from "./actions";
import { defaultSessionLabel, defaultTermLabel } from "@/lib/academic-term";

type Subscription = {
  billingCycle: "PER_TERM" | "FULL_SESSION";
  term: string | null;
  session: string;
  amount: number;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  startDate: string;
  endDate: string;
  discountNote: string | null;
} | null;

type Payment = {
  id: string;
  reference: string;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
  paidAt: string | null;
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

export function BillingClient({
  schoolName,
  subscription,
  payments,
  pricing,
}: {
  schoolName: string;
  subscription: Subscription;
  payments: Payment[];
  pricing: { termPrice: number; newSubscriberPrice: number; sessionPrice: number; isNewSubscriber: boolean };
}) {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [modal, setModal] = useState<"PER_TERM" | "FULL_SESSION" | null>(null);
  const [term, setTerm] = useState(defaultTermLabel());
  const [sessionLabel, setSessionLabel] = useState(defaultSessionLabel());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const perTermPrice = pricing.isNewSubscriber ? pricing.newSubscriberPrice : pricing.termPrice;
  const showFullSessionOffer = !subscription || subscription.billingCycle === "PER_TERM";

  const banner = useMemo(() => {
    if (paymentStatus === "success") return { tone: "success" as const, text: "Payment successful — your subscription is active." };
    if (paymentStatus === "failed") return { tone: "danger" as const, text: "Payment was not successful. You have not been charged." };
    if (paymentStatus === "error" || paymentStatus === "missing")
      return { tone: "danger" as const, text: "We couldn't confirm that payment. Check your payment history below." };
    return null;
  }, [paymentStatus]);

  function openModal(cycle: "PER_TERM" | "FULL_SESSION") {
    setError(null);
    setTerm(defaultTermLabel());
    setSessionLabel(defaultSessionLabel());
    setModal(cycle);
  }

  function handlePay() {
    if (!modal) return;
    setError(null);
    startTransition(async () => {
      try {
        const { authorizationUrl } = await initializeSubscriptionPayment({
          billingCycle: modal,
          term: modal === "PER_TERM" ? term : undefined,
          session: sessionLabel,
        });
        window.location.href = authorizationUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start payment.");
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

  return (
    <>
      <PageHeader eyebrow="Account & payments" title="Billing" intro="Manage your plan and view payment history." />

      {banner && (
        <p
          className={`mb-5 rounded-md px-4 py-3 text-caption ${banner.tone === "success" ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}
        >
          {banner.text}
        </p>
      )}

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
            <div>
              <h2 className="m-0 text-heading font-medium text-text-primary">Current plan</h2>
              <p className="mt-1.5 text-caption text-text-muted">Your subscription at a glance</p>
            </div>
            {subscription && (
              <StatusPill label={subscription.status === "ACTIVE" ? "Active" : subscription.status} tone={subscription.status === "ACTIVE" ? "success" : "neutral"} />
            )}
          </div>
          <div className="p-5">
            {subscription ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-body font-medium text-text-primary">
                      {subscription.billingCycle === "FULL_SESSION" ? "Full-session billing" : "Per-term billing"}
                    </div>
                    <p className="mt-1.5 text-caption text-text-muted">
                      {subscription.billingCycle === "FULL_SESSION"
                        ? "One payment for the full academic session."
                        : "Flexible billing for your school, one term at a time."}
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-title font-medium text-text-primary">{naira(subscription.amount)}</strong>
                    <div className="text-caption text-text-muted">{subscription.billingCycle === "FULL_SESSION" ? "/session" : "/term"}</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4.5">
                  <div>
                    <span className="mb-1.5 block text-[10px] text-text-muted">Renewal date</span>
                    <strong className="text-caption font-medium text-text-secondary">{new Date(subscription.endDate).toLocaleDateString("en-GB")}</strong>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[10px] text-text-muted">Payment frequency</span>
                    <strong className="text-caption font-medium text-text-secondary">
                      {subscription.billingCycle === "FULL_SESSION" ? "Once per session" : "Every term"}
                    </strong>
                  </div>
                </div>
                {subscription.discountNote && (
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-success-bg px-2.5 py-1.5 text-caption text-success">
                    <Tag size={13} strokeWidth={1.8} />
                    {subscription.discountNote}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openModal(subscription.billingCycle)}
                  className="mt-5 inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover"
                >
                  Renew now
                </button>
              </>
            ) : (
              <div>
                <p className="m-0 mb-4 text-body text-text-muted">No active subscription yet. Choose a plan to get started.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openModal("PER_TERM")}
                    className="inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white hover:bg-primary-hover"
                  >
                    Subscribe per term ({naira(perTermPrice)})
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal("FULL_SESSION")}
                    className="inline-flex h-10 items-center rounded-md border border-border bg-bg-card px-4 text-caption font-medium text-primary hover:bg-primary-bg"
                  >
                    Subscribe full session ({naira(pricing.sessionPrice)})
                  </button>
                </div>
                {pricing.isNewSubscriber && (
                  <p className="mt-3 text-caption text-success">New subscriber: {naira(10000)} off your first term applied automatically.</p>
                )}
              </div>
            )}
          </div>
        </section>

        {showFullSessionOffer && (
          <section className="rounded-md border border-[#cbdde9] bg-[#f1f7fb] p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-[#dcecf7] text-primary">
                <Sparkles size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="m-0 mb-1.5 text-body font-medium text-[#234c6c]">Switch to full-session (save 20%)</h2>
                <p className="m-0 text-caption leading-relaxed text-[#607e94]">
                  Pay once for the full academic session and spend less than paying term by term.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-caption font-medium text-[#396989]">
                {naira(pricing.sessionPrice)}/session · save {naira(pricing.termPrice * 3 - pricing.sessionPrice)}
              </span>
              <button
                type="button"
                onClick={() => openModal("FULL_SESSION")}
                className="inline-flex h-8 items-center rounded-md border border-primary bg-primary px-3 text-caption font-medium text-white hover:bg-primary-hover"
              >
                View offer
              </button>
            </div>
          </section>
        )}
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

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "FULL_SESSION" ? "Subscribe · full session" : "Subscribe · per term"}
        description={modal === "FULL_SESSION" ? `${naira(pricing.sessionPrice)} for the full session` : `${naira(perTermPrice)} for one term`}
      >
        <div className="grid gap-4 px-6 pt-5">
          {modal === "PER_TERM" && (
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Term
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. Term 2, 2025/2026"
                required
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
              />
            </label>
          )}
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Academic session
            <input
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="e.g. 2025/2026"
              required
              className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
            />
          </label>
          {modal === "PER_TERM" && pricing.isNewSubscriber && (
            <p className="m-0 rounded-md bg-success-bg px-3 py-2 text-caption text-success">New subscriber discount of ₦10,000 applied.</p>
          )}
        </div>
        {error && <p className="mx-6 mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
        <div className="flex justify-end gap-2 px-6 py-5">
          <button
            type="button"
            onClick={() => setModal(null)}
            className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePay}
            disabled={pending || (modal === "PER_TERM" && !term.trim()) || !sessionLabel.trim()}
            className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
          >
            {pending ? "Redirecting…" : "Pay with Paystack"}
          </button>
        </div>
      </Modal>
    </>
  );
}
