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
import { MarketingPage, CtaBand } from "@/components/home/MarketingPage";

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
        <div className="mx-auto flex w-fit items-center gap-2.5 text-[0.78rem] font-medium tracking-[0.08em] text-primary uppercase">
          <span className="h-0.5 w-7 rounded-full bg-primary" />
          How it works
          <span className="h-0.5 w-7 rounded-full bg-primary" />
        </div>
        <h1 className="mx-auto mt-5 max-w-[760px] text-[clamp(2.4rem,7vw,3.6rem)] leading-[1.04] font-medium tracking-[-0.045em] text-deep">
          From an empty template to a parent&apos;s phone, in six steps.
        </h1>
        <p className="mx-auto mt-6 max-w-[600px] text-[1.02rem] leading-[1.75] text-[#667b89]">
          Every result on SEA follows the same clear path — nothing is published without a teacher entering it and an admin approving
          it first.
        </p>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 md:px-12">
        <div className="hidden items-center justify-center gap-2 rounded-full border border-[#dce5e9] bg-white px-3 py-2.5 md:flex">
          {workflow.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="whitespace-nowrap rounded-full bg-primary-bg px-3.5 py-1.5 text-[0.78rem] font-medium text-primary">
                {label}
              </span>
              {i < workflow.length - 1 && <ArrowRight size={15} strokeWidth={1.8} className="flex-none text-[#aebfc7]" />}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="relative rounded-[16px] border border-[#dce5e9] bg-white p-7">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-[11px] bg-primary-bg text-primary">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="text-[0.72rem] font-medium tracking-[0.1em] text-[#aebfc7] uppercase">Step {i + 1}</span>
              </div>
              <h3 className="m-0 mt-4 text-[1.02rem] font-medium text-deep">{title}</h3>
              <p className="m-0 mt-2.5 text-[0.86rem] leading-relaxed text-[#667b89]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-deep text-white">
        <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 md:px-12">
          <div className="mx-auto max-w-[560px] text-center">
            <p className="m-0 text-[0.78rem] font-medium tracking-[0.08em] text-[#80c7b3] uppercase">Along the way</p>
            <h2 className="m-0 mt-3 text-[1.7rem] font-medium tracking-[-0.03em] sm:text-[2rem]">A few things worth knowing</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-[900px] gap-4 sm:grid-cols-2">
            {[
              "One subscription can cover every campus a school runs, all under the same account.",
              "Schools pay per term or for a full session, in Naira — new schools get a discount on their first payment.",
              "Every approval, publish and correction is logged, so there's always a record of who did what.",
              "A school can bring its own domain, so families reach results at an address the school already uses.",
            ].map((line) => (
              <div key={line} className="flex gap-3 rounded-[14px] border border-[#26445c] bg-[#0f3d61] p-5">
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[#80c7b3]/15 text-[#80c7b3]">
                  <Check size={13} strokeWidth={2} />
                </span>
                <p className="m-0 text-[0.85rem] leading-relaxed text-[#dce8ed]">{line}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-[560px] text-center text-[0.82rem] text-[#a9bfca]">
            Curious what the process looks like for your school specifically?{" "}
            <Link href="/why-sea" className="font-medium text-white underline underline-offset-2">
              See why schools choose SEA
            </Link>
            .
          </p>
        </div>
      </section>

      <CtaBand />
    </MarketingPage>
  );
}
