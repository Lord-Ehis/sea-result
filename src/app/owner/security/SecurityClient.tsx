"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { confirmTwoStepSetup, disableTwoStep, regenerateRecoveryCodes, startTwoStepSetup } from "./actions";

const inputClass = "h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary";
const primary = "inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white hover:bg-primary-hover disabled:opacity-60";
const secondary = "inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary hover:bg-bg-page disabled:opacity-60";
const danger = "inline-flex h-9 items-center rounded-md border border-danger bg-danger px-3.5 text-caption font-medium text-white disabled:opacity-60";

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RecoveryCodes({ codes, email, onDone }: { codes: string[]; email: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="grid gap-4">
      <p className="m-0 rounded-md bg-warning-bg px-3 py-2 text-caption text-warning">
        Save these recovery codes now. This is the only time they are shown. Each one works once, if you lose your phone. Keep them somewhere safe and away from your computer, like a password manager or a printout.
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 font-mono text-body tracking-wider text-text-primary sm:grid-cols-3">
        {codes.map((c) => (
          <li key={c} className="rounded-md border border-border bg-bg-page px-3 py-2">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={secondary} onClick={() => void navigator.clipboard?.writeText(codes.join("\n"))}>
          Copy codes
        </button>
        <button type="button" className={secondary} onClick={() => download("sea-recovery-codes.txt", `SEA recovery codes for ${email}\r\nEach code works once.\r\n\r\n${codes.join("\r\n")}\r\n`)}>
          Download as a file
        </button>
      </div>
      <label className="flex items-center gap-2 text-caption text-text-secondary">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I have saved these codes somewhere safe
      </label>
      <div>
        <button type="button" disabled={!saved} onClick={onDone} className={primary}>
          Done
        </button>
      </div>
    </div>
  );
}

export function SecurityClient({ enabledAt, recoveryLeft, email }: { enabledAt: string | null; recoveryLeft: number; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"none" | "regenerate" | "disable">("none");

  function begin() {
    setError(null);
    startTransition(async () => {
      const r = await startTwoStepSetup();
      if (r.ok) setSetup({ secret: r.secret, qr: r.qr });
      else setError(r.error);
    });
  }

  function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    setError(null);
    startTransition(async () => {
      const r = await confirmTwoStepSetup(code);
      if (r.ok) {
        setSetup(null);
        setCodes(r.recoveryCodes);
      } else setError(r.error);
    });
  }

  function manage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input = { password: String(data.get("password") ?? ""), code: String(data.get("code") ?? "") };
    setError(null);
    startTransition(async () => {
      if (mode === "disable") {
        const r = await disableTwoStep(input);
        if (r.ok) {
          setMode("none");
          router.refresh();
        } else setError(r.error);
      } else {
        const r = await regenerateRecoveryCodes(input);
        if (r.ok) {
          setMode("none");
          setCodes(r.recoveryCodes);
        } else setError(r.error);
      }
    });
  }

  const finish = () => {
    setCodes(null);
    router.refresh();
  };

  return (
    <section className="rounded-md border border-border bg-bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-heading font-medium text-text-primary">Two-step sign-in</h2>
        {enabledAt || codes ? <StatusPill label="On" tone="success" /> : <StatusPill label="Off" tone="danger" />}
      </div>

      {error && <p className="mb-4 mt-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      {codes ? (
        <RecoveryCodes codes={codes} email={email} onDone={finish} />
      ) : setup ? (
        <div className="grid gap-4">
          <ol className="m-0 grid gap-1.5 pl-5 text-caption text-text-secondary">
            <li>Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy or 1Password).</li>
            <li>In the app, add an account and scan this QR code.</li>
            <li>Type the 6-digit code the app shows to finish.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: image, nothing to optimise */}
            <img src={setup.qr} alt="QR code to scan with your authenticator app" width={220} height={220} className="rounded-md border border-border" />
            <div className="grid gap-1 text-caption text-text-muted">
              Can&apos;t scan? Enter this key in the app instead:
              <code className="break-all rounded-md bg-bg-page px-3 py-2 font-mono text-body tracking-wider text-text-primary">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
            </div>
          </div>
          <form onSubmit={confirm} className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-[10px] text-text-muted">
              6-digit code from the app
              <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" className={`${inputClass} w-40 tracking-widest`} />
            </label>
            <button type="submit" disabled={pending} className={primary}>
              {pending ? "Checking…" : "Turn on two-step"}
            </button>
            <button type="button" onClick={() => setSetup(null)} className={secondary}>
              Cancel
            </button>
          </form>
        </div>
      ) : enabledAt ? (
        <div className="grid gap-4">
          <p className="m-0 text-body text-text-secondary">
            Signing in as {email} asks for a code from your authenticator app. Switched on {new Date(enabledAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
          <p className={`m-0 text-caption ${recoveryLeft <= 3 ? "text-warning" : "text-text-muted"}`}>
            {recoveryLeft} recovery code{recoveryLeft === 1 ? "" : "s"} left.{recoveryLeft <= 3 ? " Make a new set soon." : ""}
          </p>
          {mode === "none" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} onClick={() => setMode("regenerate")}>
                Make new recovery codes
              </button>
              <button type="button" className={secondary} onClick={() => setMode("disable")}>
                Turn off two-step
              </button>
            </div>
          ) : (
            <form onSubmit={manage} className="grid gap-3 rounded-md border border-border bg-bg-page p-4">
              <p className="m-0 text-caption text-text-secondary">
                {mode === "disable" ? "Turning this off makes your account easier to break into. " : "Your old recovery codes stop working. "}
                Enter your password and a current code to continue.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-[10px] text-text-muted">
                  Password
                  <PasswordInput name="password" required autoComplete="current-password" className={`${inputClass} w-56`} />
                </label>
                <label className="grid gap-1 text-[10px] text-text-muted">
                  App code or recovery code
                  <input name="code" required autoComplete="one-time-code" maxLength={16} className={`${inputClass} w-44 tracking-widest`} />
                </label>
                <button type="submit" disabled={pending} className={mode === "disable" ? danger : primary}>
                  {pending ? "Checking…" : mode === "disable" ? "Turn off" : "Make new codes"}
                </button>
                <button type="button" onClick={() => setMode("none")} className={secondary}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="m-0 text-body text-text-secondary">
            It&apos;s off. Anyone who learns your password could sign in and see every school. Setting it up takes about two minutes and needs your phone.
          </p>
          <div>
            <button type="button" onClick={begin} disabled={pending} className={primary}>
              {pending ? "Preparing…" : "Set up two-step sign-in"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
