"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";

export function HomeNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-10 px-5 py-4 sm:px-8 md:px-12">
      <nav aria-label="Primary navigation" className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-6">
        <Link href="/" className="flex min-w-0 items-center gap-3 text-text-primary no-underline">
          <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[11px] bg-primary text-[0.72rem] font-medium tracking-tight text-white">
            SEA
          </span>
          <span className="text-[0.92rem] font-medium leading-tight tracking-tight">
            Sophie Educational Assistant
            <small className="mt-1 block text-[0.72rem] font-normal text-[#84949d]">Built for African schools</small>
          </span>
        </Link>

        <div className="hidden items-center gap-2 sm:flex">
          <a href="#why-sea" className="inline-flex h-[42px] items-center rounded-[9px] px-4 text-[0.86rem] font-medium text-[#36556a] hover:bg-[#edf2f4]">
            Why SEA
          </a>
          <a href="#how-it-works" className="inline-flex h-[42px] items-center rounded-[9px] px-4 text-[0.86rem] font-medium text-[#36556a] hover:bg-[#edf2f4]">
            How it works
          </a>
          <Link
            href="/login"
            className="inline-flex h-[42px] items-center rounded-[9px] border border-[#cedbe1] bg-white px-4 text-[0.86rem] font-medium text-[#173f5c] hover:border-[#aac3d1]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-[42px] items-center gap-2 rounded-[9px] border border-primary bg-primary px-4 text-[0.86rem] font-medium text-white hover:bg-primary-hover"
          >
            Set up your school
            <ArrowRight size={17} strokeWidth={1.8} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-lg text-deep sm:hidden"
        >
          {open ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
        </button>
      </nav>

      {open && (
        <div className="mx-auto mt-3 grid max-w-[1320px] gap-2 rounded-xl border border-[#dfe7ea] bg-white p-3 sm:hidden">
          <a href="#why-sea" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-[0.86rem] font-medium text-[#36556a]">
            Why SEA
          </a>
          <a href="#how-it-works" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-[0.86rem] font-medium text-[#36556a]">
            How it works
          </a>
          <Link href="/login" className="rounded-lg border border-[#cedbe1] px-3 py-2.5 text-center text-[0.86rem] font-medium text-[#173f5c]">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg bg-primary px-3 py-2.5 text-center text-[0.86rem] font-medium text-white">
            Set up your school
          </Link>
        </div>
      )}
    </header>
  );
}
