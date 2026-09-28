import type { Metadata } from "next";
import {
  ClipboardCheck,
  ShieldCheck,
  Building2,
  Bell,
  FileSpreadsheet,
  Lock,
  Smartphone,
  Users,
  GraduationCap,
  UserRound,
  Ban,
  Check,
} from "lucide-react";
import { MarketingPage, Eyebrow, CtaBand, GlowBackdrop, WindowCard } from "@/components/home/MarketingPage";

export const metadata: Metadata = {
  title: "Why SEA · Sophie Educational Assistant",
  description: "Why schools move their results process onto SEA — one approval workflow, one source of truth, across every campus.",
};

const oldWay = [
  "Spreadsheets, exercise books, and messaging apps hold different pieces of the same result",
  "A teacher's arithmetic mistake reaches a parent before anyone catches it",
  "Report cards are typed up from scratch, term after term, by hand",
  "Parents call the school office to ask if results are ready yet",
];

const newWay = [
  "One result, one workflow — entered once, checked once, published once",
  "Weighted scores, grades and positions are calculated the same way every time",
  "Each school's own report card format, filled in automatically from entered scores",
  "Parents get an SMS and email the moment a result is published",
];

const roleBenefits = [
  {
    icon: Building2,
    role: "School leaders",
    points: [
      "See every campus's result status — draft, submitted, approved, published — from one dashboard",
      "Nothing reaches a parent without an admin's review and approval first",
      "A full audit trail of who entered, approved, published or corrected each result",
    ],
  },
  {
    icon: GraduationCap,
    role: "Teachers",
    points: [
      "Enter scores by hand or import a whole class from a spreadsheet in one go",
      "The system checks the maths — weighted totals, grades and class positions are computed for you",
      "Submit once and move on; no chasing paper across the staff room",
    ],
  },
  {
    icon: UserRound,
    role: "Parents & students",
    points: [
      "An SMS and email as soon as a result is published — no more calling the school office",
      "A full account for families with more than one child, or a simple code + name lookup for a single result",
      "The exact report card the school designed, not a generic printout",
    ],
  },
];

const features = [
  {
    icon: FileSpreadsheet,
    title: "Your school's own template",
    body: "Build the exact subjects, assessment components and grading scale your school already uses — SEA adapts to your report card, not the other way round.",
  },
  {
    icon: ClipboardCheck,
    title: "Structured approvals",
    body: "Every result moves through the same path: a teacher submits, a school admin reviews and approves, then it publishes. Nothing skips the queue.",
  },
  {
    icon: Building2,
    title: "Multi-campus, one account",
    body: "One subscription can cover every campus a school runs, with consistent templates and reporting across all of them.",
  },
  {
    icon: Bell,
    title: "Automatic parent notifications",
    body: "Publishing a result sends an SMS and email to the family automatically — no separate step, nothing forgotten.",
  },
  {
    icon: Lock,
    title: "Secure, no-login verification",
    body: "Anyone holding a result's verification code can confirm it's genuine, without needing an account — useful for scholarships, admissions and employers.",
  },
  {
    icon: Smartphone,
    title: "Built for how you actually work",
    body: "Nigerian calendar terms, Naira pricing by term or session, and a design that holds up on the phone as well as the office desktop.",
  },
];

const trustPoints = [
  { icon: ShieldCheck, label: "Every school's data is isolated at the database level" },
  { icon: Users, label: "No platform staff can sign in as your school to “help”" },
  { icon: Ban, label: "No permanent deletion without your school's own request" },
];

export default function WhySeaPage() {
  return (
    <MarketingPage>
      <section className="relative mx-auto max-w-[1000px] px-5 pt-14 pb-16 text-center sm:px-8 sm:pt-20 md:px-12">
        <GlowBackdrop />
        <div className="flex justify-center">
          <Eyebrow>why_sea.md</Eyebrow>
        </div>
        <h1 className="mx-auto mt-6 max-w-[820px] text-[clamp(2.4rem,7vw,3.6rem)] leading-[1.04] font-medium tracking-[-0.045em] text-deep">
          Results your school can stand behind, every single term.
        </h1>
        <p className="mx-auto mt-6 max-w-[620px] text-[1.02rem] leading-[1.75] text-[#667b89]">
          SEA replaces the scramble of spreadsheets, exercise books and last-minute typing with one place to prepare, approve, publish
          and access results — built specifically around how African schools run their terms.
        </p>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 pb-16 sm:px-8 md:px-12">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[14px] border border-[#dce5e9] bg-white p-7">
            <p className="m-0 font-mono text-[0.7rem] font-medium tracking-[0.06em] text-[#98a7ae]">{"// the old way"}</p>
            <ul className="m-0 mt-4 grid gap-3.5 p-0">
              {oldWay.map((line) => (
                <li key={line} className="flex gap-3 text-[0.88rem] leading-relaxed text-[#6b7d87]">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[#b8c8cf]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[14px] border border-[#123753] bg-deep p-7">
            <p className="m-0 font-mono text-[0.7rem] font-medium tracking-[0.06em] text-[#80c7b3]">{"// with sea"}</p>
            <ul className="m-0 mt-4 grid gap-3.5 p-0">
              {newWay.map((line) => (
                <li key={line} className="flex gap-3 text-[0.88rem] leading-relaxed text-[#dce8ed]">
                  <span className="mt-[3px] grid h-4 w-4 flex-none place-items-center rounded-full bg-[#80c7b3]/15 text-[#80c7b3]">
                    <Check size={10} strokeWidth={2.5} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-[620px] text-center">
          <div className="flex justify-center">
            <Eyebrow>built_for_every_role</Eyebrow>
          </div>
          <h2 className="m-0 mt-4 text-[1.9rem] font-medium tracking-[-0.03em] text-deep sm:text-[2.2rem]">Something for everyone in the process</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {roleBenefits.map(({ icon: Icon, role, points }) => (
            <WindowCard key={role}>
              <div className="p-7">
                <span className="grid h-11 w-11 place-items-center rounded-[11px] bg-primary-bg text-primary">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <h3 className="m-0 mt-5 text-[1.05rem] font-medium text-deep">{role}</h3>
                <ul className="m-0 mt-3 grid gap-2.5 p-0">
                  {points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-[0.84rem] leading-relaxed text-[#667b89]">
                      <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[#aebfc7]" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </WindowCard>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-[620px] text-center">
          <div className="flex justify-center">
            <Eyebrow>whats_included</Eyebrow>
          </div>
          <h2 className="m-0 mt-4 text-[1.9rem] font-medium tracking-[-0.03em] text-deep sm:text-[2.2rem]">Everything a results process needs</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="group relative rounded-[14px] border border-[#dce5e9] bg-white p-6 transition-all duration-200 hover:-translate-y-[3px] hover:border-primary/30 hover:shadow-[0_16px_36px_-16px_rgba(24,95,165,0.28)]"
            >
              <span className="pointer-events-none absolute top-5 right-5 font-mono text-[0.68rem] text-[#cbd6db] transition-colors group-hover:text-primary/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-primary-bg text-primary">
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <h3 className="m-0 mt-4 text-[0.95rem] font-medium text-deep">{title}</h3>
              <p className="m-0 mt-2 text-[0.84rem] leading-relaxed text-[#667b89]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-deep text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
          }}
        />
        <div className="relative mx-auto max-w-[1200px] px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-[560px] text-center">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#2a4a63] bg-[#0f3d61] px-3 py-1.5 font-mono text-[0.7rem] font-medium tracking-wide text-[#80c7b3]">
                <ShieldCheck size={12} strokeWidth={2} />
                trust_and_privacy
              </span>
            </div>
            <h2 className="m-0 mt-4 text-[1.7rem] font-medium tracking-[-0.03em] sm:text-[2rem]">Your school&apos;s data stays your school&apos;s</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-[900px] gap-4 sm:grid-cols-3">
            {trustPoints.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-[14px] border border-[#26445c] bg-[#0f3d61] p-6 text-center transition-colors hover:border-[#3a6280]"
              >
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[#315873] text-[#80c7b3]">
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <p className="m-0 mt-4 text-[0.85rem] leading-relaxed text-[#dce8ed]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </MarketingPage>
  );
}
