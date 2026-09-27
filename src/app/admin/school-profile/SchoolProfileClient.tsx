"use client";

import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { updateSchoolProfile } from "./actions";
import { ImageUploadField } from "./ImageUploadField";

export function SchoolProfileClient({
  schoolName,
  logoUrl,
  address,
  phone,
  supportEmail,
  principalName,
  principalSignatureUrl,
  stampUrl,
  nextTermBegins,
}: {
  schoolName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  supportEmail: string | null;
  principalName: string | null;
  principalSignatureUrl: string | null;
  stampUrl: string | null;
  nextTermBegins: string | null;
}) {
  const [fields, setFields] = useState({
    logoUrl: logoUrl ?? "",
    address: address ?? "",
    phone: phone ?? "",
    supportEmail: supportEmail ?? "",
    principalName: principalName ?? "",
    principalSignatureUrl: principalSignatureUrl ?? "",
    stampUrl: stampUrl ?? "",
    nextTermBegins: nextTermBegins ?? "",
  });
  const [logoError, setLogoError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await updateSchoolProfile(fields);
        setMessage("Saved. New results published from now on will show this on their header.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save. Check the fields and try again.");
      }
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="School settings"
        title="School profile"
        intro="Shown on the header of every result you publish from now on — logo, address and contact details."
      />

      {message && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{message}</p>}
      {error && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      <div className="grid max-w-[990px] gap-5 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">Branding & contact</h2>
            <p className="mt-1.5 text-caption text-text-muted">Already-published results keep the details they were printed with — only new ones use these.</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 px-5 py-5">
            <ImageUploadField
              label="Logo image"
              kind="logo"
              value={fields.logoUrl}
              placeholder="https://yourschool.com/logo.png"
              onChange={(url) => {
                set("logoUrl", url);
                setLogoError(false);
              }}
            />
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Address <span className="font-normal text-text-muted">(optional)</span>
              <input
                value={fields.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="14 Dave Cole Crescent, Surulere, Lagos State"
                autoComplete="off"
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
              />
            </label>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Phone <span className="font-normal text-text-muted">(optional)</span>
              <input
                value={fields.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="08115414915, 07064852256"
                autoComplete="off"
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
              />
            </label>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Support email <span className="font-normal text-text-muted">(optional)</span>
              <input
                type="email"
                value={fields.supportEmail}
                onChange={(e) => set("supportEmail", e.target.value)}
                placeholder="school@yourschool.com"
                autoComplete="off"
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
              />
            </label>
            <p className="m-0 border-t border-border pt-4 text-caption font-medium text-text-secondary">Sign-off (bottom of each result)</p>
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Principal&apos;s name <span className="font-normal text-text-muted">(optional)</span>
              <input
                value={fields.principalName}
                onChange={(e) => set("principalName", e.target.value)}
                placeholder="e.g. Mr Owolabi Badmos"
                autoComplete="off"
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
              />
            </label>
            <ImageUploadField
              label="Principal's signature image"
              kind="signature"
              value={fields.principalSignatureUrl}
              placeholder="https://yourschool.com/signature.png"
              onChange={(url) => set("principalSignatureUrl", url)}
            />
            <ImageUploadField
              label="School stamp image"
              kind="stamp"
              value={fields.stampUrl}
              placeholder="https://yourschool.com/stamp.png"
              onChange={(url) => set("stampUrl", url)}
            />
            <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
              Next term begins <span className="font-normal text-text-muted">(update each term)</span>
              <input
                type="date"
                value={fields.nextTermBegins}
                onChange={(e) => set("nextTermBegins", e.target.value)}
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-5">
            <h2 className="m-0 text-heading font-medium text-text-primary">Preview</h2>
            <p className="mt-1.5 text-caption text-text-muted">How this looks on a result header</p>
          </div>
          <div className="p-5">
            <div className="flex items-start gap-3 rounded-md border border-border bg-bg-page p-4">
              {fields.logoUrl && !logoError ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, not an optimizable local asset
                <img
                  src={fields.logoUrl}
                  alt=""
                  onError={() => setLogoError(true)}
                  className="h-10 w-10 flex-none rounded object-contain"
                />
              ) : (
                <div className="grid h-10 w-10 flex-none place-items-center rounded bg-primary text-white">
                  <Building2 size={18} strokeWidth={1.8} />
                </div>
              )}
              <div className="min-w-0">
                <strong className="block truncate text-body font-medium text-text-primary">{schoolName}</strong>
                {fields.address && <span className="block truncate text-caption text-text-muted">{fields.address}</span>}
                {(fields.phone || fields.supportEmail) && (
                  <span className="block truncate text-caption text-text-muted">{[fields.phone, fields.supportEmail].filter(Boolean).join(" · ")}</span>
                )}
              </div>
            </div>
            {fields.logoUrl && logoError && (
              <p className="mt-3 text-caption text-danger">Couldn&apos;t load that image — double-check the URL is a direct link to an image.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
