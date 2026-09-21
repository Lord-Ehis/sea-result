"use client";

import { useState, useTransition } from "react";
import { BadgePercent } from "lucide-react";
import { derivedPrices, validatePricing, type PricingConfig } from "@/lib/billing-pricing";
import { updatePricing } from "./actions";

type Change = { id: string; changedAt: string; changedBy: string; before: PricingConfig; after: PricingConfig };

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Term price ₦50,000 → ₦55,000 · New-school discount ₦10,000 → ₦8,000" — only what changed. */
function describeChange(before: PricingConfig, after: PricingConfig) {
  const parts: string[] = [];
  if (before.termPrice !== after.termPrice) parts.push(`Term price ${naira(before.termPrice)} → ${naira(after.termPrice)}`);
  if (before.registrationDiscount !== after.registrationDiscount) parts.push(`New-school discount ${naira(before.registrationDiscount)} → ${naira(after.registrationDiscount)}`);
  if (before.sessionDiscountPercent !== after.sessionDiscountPercent) parts.push(`Full-session discount ${before.sessionDiscountPercent}% → ${after.sessionDiscountPercent}%`);
  return parts.join(" · ");
}

// The platform-wide subscription prices. A change applies to new payments from
// the moment it is saved; existing coverage, past payments and anyone already
// midway through paying keep what they were shown.
export function PricingSettings({ initial, isDefault, changes }: { initial: PricingConfig; isDefault: boolean; changes: Change[] }) {
  const [termPrice, setTermPrice] = useState(String(initial.termPrice));
  const [discount, setDiscount] = useState(String(initial.registrationDiscount));
  const [percent, setPercent] = useState(String(initial.sessionDiscountPercent));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const numbers = { termPrice: Number(termPrice), registrationDiscount: Number(discount), sessionDiscountPercent: Number(percent) };
  const blank = termPrice.trim() === "" || discount.trim() === "" || percent.trim() === "";
  const checked = blank ? ({ ok: false, error: "Fill in all three fields." } as const) : validatePricing(numbers);
  const prices = checked.ok ? derivedPrices(checked.value) : null;
  const unchanged = checked.ok && checked.value.termPrice === initial.termPrice && checked.value.registrationDiscount === initial.registrationDiscount && checked.value.sessionDiscountPercent === initial.sessionDiscountPercent;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!checked.ok) return;
    setMessage(null);
    startTransition(async () => {
      const result = await updatePricing(checked.value);
      setMessage(result.ok ? { ok: true, text: result.changed ? "Prices saved. New payments use them from now." : "Nothing to change — these are already the current prices." } : { ok: false, text: result.error });
    });
  }

  const field = "h-10 w-full rounded-md border border-border bg-bg-card px-3 text-body text-text-primary tabular-nums";

  return (
    <section className="mb-6 overflow-hidden rounded-md border border-border bg-bg-card" aria-label="Subscription pricing">
      <div className="flex items-start gap-3 border-b border-border px-5 py-5">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-primary-bg text-primary">
          <BadgePercent size={18} strokeWidth={1.8} />
        </span>
        <div>
          <h2 className="m-0 text-heading font-medium text-text-primary">Subscription pricing</h2>
          <p className="mt-1.5 text-caption leading-relaxed text-text-muted">
            What schools pay. A change applies to new payments straight away; existing coverage and payments already made never change, and a school midway through paying keeps the price it was shown.
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <form onSubmit={save} className="grid content-start gap-4">
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Term price (₦)
            <input inputMode="numeric" value={termPrice} onChange={(e) => setTermPrice(e.target.value.trim())} className={field} aria-describedby="pricing-hint" />
            <span className="text-[11px] font-normal text-text-muted">What one term costs every school, for life, after its first payment.</span>
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            New-school discount (₦)
            <input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.trim())} className={field} />
            <span className="text-[11px] font-normal text-text-muted">Taken off a school&apos;s first term, on its registration payment only.</span>
          </label>
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Full-session discount (%)
            <input inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.trim())} className={field} />
            <span className="text-[11px] font-normal text-text-muted">Off the price of the terms still to come when a school pays for the full session.</span>
          </label>

          {!checked.ok && <p id="pricing-hint" className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{checked.error}</p>}
          {message && <p className={`m-0 rounded-md px-3 py-2 text-caption ${message.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{message.text}</p>}

          <div>
            <button
              type="submit"
              disabled={pending || !checked.ok || unchanged}
              className="inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save prices"}
            </button>
          </div>
        </form>

        <div className="grid content-start gap-4">
          <dl className="m-0 grid gap-2 rounded-md bg-bg-page px-4 py-3.5 text-caption text-text-secondary" aria-label="What schools will pay">
            <div className="flex justify-between gap-3">
              <dt>One term</dt>
              <dd className="m-0 font-medium tabular-nums text-text-primary">{prices ? naira(prices.termPrice) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>A new school&apos;s first term</dt>
              <dd className="m-0 font-medium tabular-nums text-text-primary">{prices ? naira(prices.newSchoolTermPrice) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Full session (all 3 terms)</dt>
              <dd className="m-0 font-medium tabular-nums text-text-primary">{prices ? naira(prices.sessionPrice) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 text-text-muted">
              <dt>…which is per term</dt>
              <dd className="m-0 tabular-nums">{prices ? naira(prices.sessionTermPrice) : "—"}</dd>
            </div>
          </dl>

          <div>
            <h3 className="m-0 mb-2 text-caption font-medium text-text-primary">Recent changes</h3>
            {changes.length === 0 ? (
              <p className="m-0 text-caption text-text-muted">{isDefault ? "Prices have never been changed — these are the starting prices." : "No changes recorded."}</p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {changes.map((c) => (
                  <li key={c.id} className="rounded-md border border-border px-3 py-2 text-caption text-text-secondary">
                    <div className="text-text-muted">
                      {day(c.changedAt)} · {c.changedBy}
                    </div>
                    <div>{describeChange(c.before, c.after)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
