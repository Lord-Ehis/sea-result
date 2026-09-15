"use client";

import { useState, useTransition } from "react";
import { CreditCard, MessageSquare, Mail, KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { savePaystackConfig, saveTermiiConfig, saveResendConfig, clearProvider } from "./actions";

type ProviderStatus = { configured: boolean; updatedAt: string | null; envFallback: boolean };
type Providers = { PAYSTACK: ProviderStatus; SMS_TERMII: ProviderStatus; EMAIL_RESEND: ProviderStatus };
type ProviderKey = keyof Providers;

const CARDS: { key: ProviderKey; title: string; description: string; icon: typeof CreditCard }[] = [
  { key: "PAYSTACK", title: "Paystack", description: "Subscription billing and payment processing", icon: CreditCard },
  { key: "SMS_TERMII", title: "SMS (Termii)", description: "Result-published alerts sent to guardians", icon: MessageSquare },
  { key: "EMAIL_RESEND", title: "Email (Resend)", description: "Account, password reset, and result alerts", icon: Mail },
];

function statusFor(status: ProviderStatus) {
  if (status.configured) return { label: "Using saved key", tone: "success" as const };
  if (status.envFallback) return { label: "Using environment default", tone: "neutral" as const };
  return { label: "Not configured", tone: "danger" as const };
}

export function SettingsClient({ providers }: { providers: Providers }) {
  const [modal, setModal] = useState<ProviderKey | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal(key: ProviderKey) {
    setModal(key);
    setFields({});
    setError(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        if (modal === "PAYSTACK") {
          await savePaystackConfig({ secretKey: fields.secretKey ?? "", publicKey: fields.publicKey });
        } else if (modal === "SMS_TERMII") {
          await saveTermiiConfig({ apiKey: fields.apiKey ?? "", baseUrl: fields.baseUrl ?? "", senderId: fields.senderId ?? "" });
        } else {
          await saveResendConfig({ apiKey: fields.apiKey ?? "", from: fields.from ?? "" });
        }
        setMessage(`${CARDS.find((c) => c.key === modal)?.title} key saved.`);
        setModal(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this key.");
      }
    });
  }

  function handleClear(key: ProviderKey) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await clearProvider(key);
        setMessage(`${CARDS.find((c) => c.key === key)?.title} reverted to the environment default.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove this key.");
      }
    });
  }

  return (
    <>
      {message && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}
      {error && !modal && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        {CARDS.map(({ key, title, description, icon: Icon }) => {
          const status = providers[key];
          const pill = statusFor(status);
          return (
            <section key={key} className="flex flex-col justify-between rounded-md border border-border bg-bg-card p-5">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-primary-bg text-primary">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <StatusPill label={pill.label} tone={pill.tone} />
                </div>
                <h2 className="m-0 text-body font-medium text-text-primary">{title}</h2>
                <p className="mt-1.5 text-caption leading-relaxed text-text-muted">{description}</p>
                {status.configured && status.updatedAt && (
                  <p className="mt-3 text-caption text-text-muted">Updated {new Date(status.updatedAt).toLocaleDateString("en-GB")}</p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => openModal(key)}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-primary bg-primary px-3 text-caption font-medium text-white hover:bg-primary-hover"
                >
                  <KeyRound size={13} strokeWidth={1.8} />
                  {status.configured ? "Update key" : "Add key"}
                </button>
                {status.configured && (
                  <button
                    type="button"
                    onClick={() => handleClear(key)}
                    disabled={pending}
                    className="inline-flex h-8 items-center rounded-md border border-border bg-bg-card px-3 text-caption font-medium text-text-secondary disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal ? `${CARDS.find((c) => c.key === modal)?.title} key` : ""}
        description="Stored encrypted. Overrides the environment default for every school on the platform."
      >
        <form onSubmit={handleSave} className="contents">
          <div className="grid gap-4 px-6 pt-5">
            {modal === "PAYSTACK" && (
              <>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  Secret key
                  <input
                    type="password"
                    value={fields.secretKey ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, secretKey: e.target.value }))}
                    placeholder="sk_live_…"
                    required
                    autoComplete="off"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                  />
                </label>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  Public key <span className="font-normal text-text-muted">(optional)</span>
                  <input
                    value={fields.publicKey ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, publicKey: e.target.value }))}
                    placeholder="pk_live_…"
                    autoComplete="off"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                  />
                </label>
              </>
            )}
            {modal === "SMS_TERMII" && (
              <>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  API key
                  <input
                    type="password"
                    value={fields.apiKey ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, apiKey: e.target.value }))}
                    required
                    autoComplete="off"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                  />
                </label>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  Base URL
                  <input
                    value={fields.baseUrl ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, baseUrl: e.target.value }))}
                    placeholder="https://v4.api.termii.com/"
                    required
                    autoComplete="off"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                  />
                </label>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  Sender ID
                  <input
                    value={fields.senderId ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, senderId: e.target.value }))}
                    placeholder="SEA"
                    required
                    autoComplete="off"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                  />
                </label>
              </>
            )}
            {modal === "EMAIL_RESEND" && (
              <>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  API key
                  <input
                    type="password"
                    value={fields.apiKey ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, apiKey: e.target.value }))}
                    required
                    autoComplete="off"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                  />
                </label>
                <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
                  From address
                  <input
                    type="email"
                    value={fields.from ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, from: e.target.value }))}
                    placeholder="notifications@sophie-ea.app"
                    required
                    autoComplete="off"
                    className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
                  />
                </label>
              </>
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
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save key"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
