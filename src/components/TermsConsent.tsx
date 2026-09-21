import Link from "next/link";

// The "I agree" box on sign-up. It is a plain checkbox (works inside a normal
// form via its `name`, or controlled with checked/onChange), required so the
// browser stops the submit, and the server refuses to create the account
// without it as well. The links open in a new tab so nobody loses their form.
export function TermsConsent({ checked, onChange, name = "agree" }: { checked?: boolean; onChange?: (checked: boolean) => void; name?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-caption leading-relaxed text-text-secondary">
      <input
        type="checkbox"
        name={name}
        required
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 h-4 w-4 flex-none accent-primary"
      />
      <span>
        I agree to the{" "}
        <Link href="/terms" target="_blank" className="font-medium text-primary hover:text-primary-hover">
          Terms of Use
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" target="_blank" className="font-medium text-primary hover:text-primary-hover">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}
