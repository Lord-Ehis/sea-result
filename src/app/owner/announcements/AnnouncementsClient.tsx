"use client";

import { useState, useTransition } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { createAnnouncement, endAnnouncement, type AnnouncementSummary } from "./actions";

const inputClass = "h-10 min-w-0 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary";

export function AnnouncementsClient({ initialAnnouncements }: { initialAnnouncements: AnnouncementSummary[] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"INFO" | "WARNING">("INFO");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const live = announcements.find((a) => a.isActive);

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      const result = await createAnnouncement({ message, tone, linkUrl, linkLabel });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnnouncements((prev) => [
        { id: result.id, message: message.trim(), tone, linkUrl: linkUrl.trim() || null, linkLabel: linkLabel.trim() || null, isActive: true, createdAt: new Date().toISOString() },
        ...prev.map((a) => ({ ...a, isActive: false })),
      ]);
      setMessage("");
      setLinkUrl("");
      setLinkLabel("");
      setTone("INFO");
      setSavedMessage("Posted — every signed-in view now shows this banner.");
      setTimeout(() => setSavedMessage(null), 4000);
    });
  }

  function handleEnd(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await endAnnouncement(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: false } : a)));
    });
  }

  return (
    <div className="grid max-w-[820px] gap-5">
      <section className="rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-5">
          <h2 className="m-0 text-heading font-medium text-text-primary">Post an announcement</h2>
          <p className="mt-1.5 text-caption text-text-muted">Replaces whatever&apos;s currently live — only one banner shows at a time.</p>
        </div>
        <form onSubmit={handlePost} className="grid gap-4 px-5 py-5">
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={3}
              maxLength={500}
              placeholder="e.g. SEA will be briefly unavailable tonight from 11pm–12am WAT for scheduled maintenance."
              className="rounded-md border border-border bg-bg-card p-3 text-body text-text-primary"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr_1fr]">
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Tone
              <select value={tone} onChange={(e) => setTone(e.target.value as "INFO" | "WARNING")} className={inputClass}>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Link <span className="font-normal text-text-muted">(optional)</span>
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." autoComplete="off" className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Link text <span className="font-normal text-text-muted">(optional)</span>
              <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Learn more" autoComplete="off" className={inputClass} />
            </label>
          </div>
          {error && <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          {savedMessage && <p className="m-0 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{savedMessage}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || !message.trim()}
              className="inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white disabled:opacity-60"
            >
              {pending ? "Posting…" : live ? "Replace live banner" : "Post announcement"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-5">
          <h2 className="m-0 text-heading font-medium text-text-primary">History</h2>
          <p className="mt-1.5 text-caption text-text-muted">Past and current banners, most recent first.</p>
        </div>
        {announcements.length === 0 ? (
          <p className="m-0 px-5 py-8 text-center text-caption text-text-muted">Nothing posted yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-0 p-0">
            {announcements.map((a) => (
              <li key={a.id} className="grid gap-2 border-b border-border px-5 py-4 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusPill label={a.isActive ? "Live" : "Ended"} tone={a.isActive ? "success" : "neutral"} />
                    {a.tone === "WARNING" && <StatusPill label="Warning" tone="warning" />}
                    <span className="text-[10px] text-text-muted">{new Date(a.createdAt).toLocaleString("en-GB")}</span>
                  </div>
                  {a.isActive && (
                    <button
                      type="button"
                      onClick={() => handleEnd(a.id)}
                      disabled={pending}
                      className="h-7 rounded-md border border-border px-2.5 text-[10px] font-medium text-text-secondary disabled:opacity-60"
                    >
                      End now
                    </button>
                  )}
                </div>
                <p className="m-0 whitespace-pre-line text-caption text-text-primary">{a.message}</p>
                {a.linkUrl && (
                  <a href={a.linkUrl} target="_blank" rel="noreferrer" className="text-[10px] font-medium text-primary underline">
                    {a.linkLabel || "Link"} — {a.linkUrl}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
