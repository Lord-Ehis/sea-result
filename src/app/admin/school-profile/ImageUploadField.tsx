"use client";

import { useRef, useState, useTransition } from "react";
import { uploadSchoolImage } from "./actions";

const MAX_BYTES = 1024 * 1024;

// A URL box with an "Upload image" button beside it. The paste-a-link path
// stays as a fallback; uploading fills the same box, and the page's normal
// Save button stores it.
export function ImageUploadField({
  label,
  kind,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  kind: "logo" | "signature" | "stamp";
  value: string;
  placeholder: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    // Same limit the server enforces — checked here first so a big photo is
    // refused instantly instead of after uploading it.
    if (file.size > MAX_BYTES) {
      setError(`That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 1 MB. Shrink it (or save it as a JPG) and try again.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);
    startTransition(async () => {
      const result = await uploadSchoolImage(body);
      if (result.ok) onChange(result.url);
      else setError(result.error);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="grid gap-1.5 text-caption font-medium text-text-secondary">
      <span>
        {label} <span className="font-normal text-text-muted">(optional)</span>
      </span>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={label}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
        />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="h-10 flex-none rounded-md border border-border px-3 text-caption font-medium text-text-secondary disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload image"}
        </button>
      </div>
      {error ? (
        <span className="font-normal text-danger">{error}</span>
      ) : (
        <span className="font-normal text-text-muted">PNG, JPG or WebP, up to 1 MB. Or paste a direct link to an image.</span>
      )}
    </div>
  );
}
