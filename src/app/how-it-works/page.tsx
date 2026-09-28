import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  FileSpreadsheet,
  UploadCloud,
  ClipboardCheck,
  Send,
  Search,
  ArrowRight,
  Check,
} from "lucide-react";
import { MarketingPage, Eyebrow, CtaBand, GlowBackdrop, WindowCard } from "@/components/home/MarketingPage";

export const metadata: Metadata = {
  title: "How it works · Sophie Educational Assistant",
  description: "The path a result takes on SEA, from setting up your school to a parent seeing a published report card.",
};

const steps = [
  {
    icon: Building2,
    title: "Set up your school",
    body: "Register your school, add its campuses, and bring in students and teacher accounts. A guided wizard handles it, or SEA's team can help with a hands-on setup.",
  },
  {
    icon: FileSpreadsheet,
    title: "Build your result template",
    body: "Set up each class's subjects, the assessment components that make up a subject (C.A, exams, practicals — whatever your school uses) and how much each is worth. Draft it, validate it, activate it when it's ready.",
  },
  {
    icon: UploadCloud,
    title: "Teachers enter results",
    body: "Teachers enter scores for their own assigned classes only — by hand, or by importing a class spreadsheet in one go — and submit for review.",
  },
  {
    icon: ClipboardCheck,
    title: "The school admin reviews",
    body: "Submitted results land in one approval queue. An admin checks them, sends anything back to the teacher if it needs fixing, and approves what's ready.",
  },
  {
    icon: Send,
    title: "Publishing notifies families",
    body: "The moment a result is published, an SMS and email go out to the family automatically, and the report card becomes available to view.",
  },
  {
    icon: Search,
    title: "Parents & students view it",
    body: "Families with an account see every child's results on one dashboard. Without an account, anyone with the student's code and name can look a result up directly.",
  },
];

const workflow = ["Teacher submits", "Admin reviews", "Admin approves", "Result publishes", "Family is notified"];

export default function HowItWorksPage() {
  return (
    <MarketingPage>
      <section className="relative mx-auto max-w-[1000px] px-5 pt-14 pb-16 text-center sm:px-8 sm:pt-20 md:px-12">
        <GlowBackdrop />
        <div className="flex justify-center">
          <Eyebrow>pipeline.run()</Eyebrow>
        </div>
        <h1 className="mx-auto mt-6 max-w-[760px] text-[clamp(2.4rem,7vw,3.6rem)] leading-[1.04] font-medium tracking-[-0.045em] text-deep">
          From an empty template to a parent&apos;s phone, in six steps.
        </h1>
        <p className="mx-auto mt-6 max-w-[600px] text-[1.02rem] leading-[1.75] text-[#667b89]">
          Every result on SEA follows the same clear path — nothing is published without a teacher entering it and an admin approving
          it first.
        </p>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 md:px-12">
        <div className="hidden overflow-x-auto rounded-[12px] border border-[#dce5e9] bg-white px-5 py-4 md:block">
          <div className="flex items-center justify-center gap-0">
            {workflow.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-primary font-mono text-[0.6rem] font-medium text-white">
                    {i + 1}
                  </span>
                  <span className="text-[0.8rem] font-medium text-[#36556a]">{label}</span>
                </div>
                {i < workflow.length - 1 && (
                  <span className="mx-4 h-px w-10 flex-none bg-[linear-gradient(to_right,#c3d3da,#c3d3da_50%,transparent_50%,transparent)] bg-[length:6px_1px]" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <WindowCard key={title} className="h-full">
              <div className="p-7">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-[11px] bg-primary-bg text-primary">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="font-mono text-[1.4rem] font-medium leading-none text-[#dbe4e8]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="m-0 mt-4 text-[1.02rem] font-medium text-deep">{title}</h3>
                <p className="m-0 mt-2.5 text-[0.86rem] leading-relaxed text-[#667b89]">{body}</p>
              </div>
            </WindowCard>
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
                notes.md
              </span>
            </div>
            <h2 className="m-0 mt-4 text-[1.7rem] font-medium tracking-[-0.03em] sm:text-[2rem]">A few things worth knowing</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-[900px] gap-4 sm:grid-cols-2">
            {[
              "One subscription can cover every campus a school runs, all under the same account.",
              "Schools pay per term or for a full session, in Naira — new schools get a discount on their first payment.",
              "Every approval, publish and correction is logged, so there's always a record of who did what.",
              "A school can bring its own domain, so families reach results at an address the school already uses.",
            ].map((line) => (
              <div
                key={line}
                className="flex gap-3 rounded-[14px] border border-[#26445c] bg-[#0f3d61] p-5 transition-colors hover:border-[#3a6280]"
              >
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[#80c7b3]/15 text-[#80c7b3]">
                  <Check size={13} strokeWidth={2} />
                </span>
                <p className="m-0 text-[0.85rem] leading-relaxed text-[#dce8ed]">{line}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-[560px] text-center text-[0.82rem] text-[#a9bfca]">
            Curious what the process looks like for your school specifically?{" "}
            <Link href="/why-sea" className="inline-flex items-center gap-1 font-medium text-white underline underline-offset-2">
              See why schools choose SEA
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </p>
        </div>
      </section>

      <CtaBand />
    </MarketingPage>
  );
}
