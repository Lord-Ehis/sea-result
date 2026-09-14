"use client";

import { useEffect, useState, useTransition } from "react";
import { Globe, Copy } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { addCustomDomain, checkCustomDomainStatus, removeCustomDomain, getDnsInstructions } from "./actions";

export function DomainClient({
  customDomain,
  verified,
  defaultUrl,
}: {
  customDomain: string | null;
  verified: boolean;
  defaultUrl: string;
}) {
  const [input, setInput] = useState(customDomain ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dns, setDns] = useState<{ host: string; target: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!customDomain || verified) {
        if (!cancelled) setDns(null);
        return;
      }
      try {
        const result = await getDnsInstructions(customDomain);
        if (!cancelled) setDns(result);
      } catch {
        if (!cancelled) setDns(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [customDomain, verified]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await addCustomDomain(input);
        setMessage("Domain added. Add the DNS record below, then verify.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add domain.");
      }
    });
  }

  function handleVerify() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const ok = await checkCustomDomainStatus();
        setMessage(ok ? "Domain verified and active." : "Still pending — DNS changes can take time to appear.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not check domain status.");
      }
    });
  }

  function handleRemove() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await removeCustomDomain();
        setInput("");
        setMessage("Domain removed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove domain.");
      }
    });
  }

  function copyValue(value: string) {
    navigator.clipboard?.writeText(value).then(() => setMessage("Copied to clipboard."));
  }

  return (
    <>
      <PageHeader eyebrow="School settings" title="Custom domain" intro="Give families a school-branded link for checking student results." />

      {message && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}
      {error && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      <div className="grid max-w-[990px] gap-5">
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
            <div>
              <h2 className="m-0 text-heading font-medium text-text-primary">Result page domain</h2>
              <p className="mt-1.5 text-caption text-text-muted">Manage the web address used by parents and students</p>
            </div>
            {customDomain && (
              <StatusPill label={verified ? "Verified & active" : "Pending verification"} tone={verified ? "success" : "warning"} />
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3 rounded-md border border-border bg-bg-page px-4 py-4">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-primary-bg text-primary">
                <Globe size={18} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <span className="mb-1 block text-[10px] text-text-muted">Current default link</span>
                <strong className="block truncate text-body font-medium text-text-primary">{defaultUrl}</strong>
              </div>
            </div>

            {customDomain && !verified && (
              <p className="mx-0.5 my-4 text-caption leading-relaxed text-text-secondary">
                Custom domain awaiting verification: <strong className="font-medium text-text-primary">{customDomain}</strong>
              </p>
            )}

            <form onSubmit={handleAdd} className="mt-5 grid gap-2">
              <label htmlFor="domain-input" className="text-caption font-medium text-text-secondary">
                Custom domain
              </label>
              <div className="flex gap-2">
                <input
                  id="domain-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="results.yourschool.com"
                  spellCheck={false}
                  required
                  className="h-[41px] min-w-0 flex-1 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-[41px] items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white disabled:opacity-60"
                >
                  {customDomain ? "Update domain" : "Add domain"}
                </button>
              </div>
              <p className="m-0 text-caption text-text-muted">Enter a subdomain you own, without https:// or a trailing slash.</p>
            </form>

            {customDomain && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary disabled:opacity-60"
                >
                  {pending ? "Checking…" : "Verify domain"}
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-danger disabled:opacity-60"
                >
                  Remove domain
                </button>
              </div>
            )}
          </div>
        </section>

        {customDomain && !verified && (
          <section className="overflow-hidden rounded-md border border-border bg-bg-card">
            <div className="border-b border-border px-5 py-5">
              <h2 className="m-0 text-heading font-medium text-text-primary">DNS setup instructions</h2>
              <p className="mt-1.5 text-caption text-text-muted">Add the record below at your domain registrar, then return here to verify.</p>
            </div>
            <div className="grid gap-4 px-5 py-5">
              <Step n={1} title="Open your DNS settings">
                Sign in to the provider where you manage your domain and open its DNS records.
              </Step>
              <Step n={2} title="Create a CNAME record">
                Use these values for the custom domain shown above.
                <div className="mt-3 grid grid-cols-[95px_1fr_1.6fr_75px] items-end gap-2">
                  <RecordCell label="Type" value="CNAME" />
                  <RecordCell label="Host / name" value={dns?.host ?? "results"} />
                  <RecordCell label="Points to / value" value={dns?.target ?? "cname.vercel-dns.com"} onCopy={copyValue} />
                  <RecordCell label="TTL" value="Auto" />
                </div>
              </Step>
              <Step n={3} title="Verify your domain">
                After saving the DNS record, use the Verify domain button above to check its status.
              </Step>
            </div>
            <div className="border-t border-border px-5 py-3.5 text-caption text-text-muted">
              DNS changes can take time to appear. Your default SEA link remains available while verification is pending.
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-primary-bg text-[10px] font-medium text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-caption text-text-secondary">
        <strong className="block text-body font-medium text-text-primary">{title}</strong>
        <p className="mt-1.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function RecordCell({ label, value, onCopy }: { label: string; value: string; onCopy?: (v: string) => void }) {
  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[10px] text-text-muted">{label}</span>
      <div className="relative">
        <code className="block truncate rounded-md border border-border bg-bg-page px-2.5 py-2.5 text-caption text-text-primary">
          {value}
        </code>
        {onCopy && (
          <button
            type="button"
            onClick={() => onCopy(value)}
            aria-label={`Copy ${label}`}
            className="absolute right-1 top-1 grid h-[27px] w-[29px] place-items-center rounded-md bg-primary-bg text-primary hover:bg-primary/20"
          >
            <Copy size={14} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}
