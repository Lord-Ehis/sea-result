"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

// A password box with a button to reveal what was typed. Takes the same props
// as a normal input (name, value, onChange, required, autoComplete…) and the
// same styling classes, so it drops in wherever `type="password"` was used.
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} spellCheck={false} autoCapitalize="none" className={`${className} w-full pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        {visible ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
      </button>
    </div>
  );
}
