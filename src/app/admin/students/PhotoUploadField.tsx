"use client";

import { useRef, useState, useTransition } from "react";
import { uploadStudentPhoto } from "./actions";
import { inputClass } from "./styles";

const MAX_BYTES = 1024 * 1024;

// A URL box with an "Upload photo" button beside it — the same pattern as
// the school profile's logo/signature/stamp fields. Renders its own
// `<input name="photoUrl">`, so it drops straight into the existing
// action-based Add/Edit forms (FormData reads the input's current value at
// submit time either way); the paste-a-link path stays as a fallback.
export function PhotoUploadField({ defaultValue }: { defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    // Same limit the server enforces — checked here first so a big photo is
    // refused instantly instead of after uploading it.
    if (file.size > MAX_BYTES) {
      setError(`That photo is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 1 MB. Shrink it (or save it as a JPG) and try again.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const body = new FormData();
    body.set("file", file);
    startTransition(async () => {
      const result = await uploadStudentPhoto(body);
      if (result.ok) setValue(result.url);
      else setError(result.error);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <input
          name="photoUrl"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://.../photo.jpg"
          aria-label="Photo URL"
          className={`${inputClass} flex-1`}
        />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="h-[38px] flex-none rounded-md border border-border px-3 text-caption font-medium text-text-secondary disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
