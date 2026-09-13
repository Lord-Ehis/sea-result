import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Building2, Bell } from "lucide-react";
import { HomeNav } from "@/components/home/HomeNav";

const bandItems = [
  { icon: Check, label: "Structured result approvals" },
  { icon: Building2, label: "Multi-campus control" },
  { icon: Bell, label: "Parent notifications" },
];

export default function Home() {
  return (
    <div className="min-h-svh overflow-hidden bg-bg-page">
      <HomeNav />

      <main>
        <section id="how-it-works" className="relative mx-auto max-w-[1440px] px-5 pt-8 pb-16 sm:px-8 md:px-12 lg:pt-14 lg:pb-[72px]">
          <div className="relative grid gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(480px,1.08fr)] lg:items-center lg:gap-20">
            <div className="relative z-[2] max-w-[620px] before:absolute before:top-5 before:left-[-310px] before:hidden before:h-[420px] before:w-[420px] before:rounded-full before:border before:border-[#d9e6eb] before:content-[''] lg:before:block">
              <div className="mb-5 flex items-center gap-2.5 text-[0.78rem] font-medium tracking-[0.08em] text-primary uppercase">
                <span className="h-0.5 w-7 rounded-full bg-primary" />
                Results management, reimagined
              </div>
              <h1 className="m-0 max-w-[760px] text-[clamp(2.7rem,13vw,4.2rem)] leading-[0.98] font-medium tracking-[-0.065em] text-deep sm:text-[clamp(3rem,5.4vw,5.7rem)]">
                School results, handled with <span className="text-primary">clarity.</span>
              </h1>
              <p className="my-7 max-w-[570px] text-[1rem] leading-[1.75] text-[#667b89] sm:text-[clamp(1rem,1.35vw,1.2rem)]">
                SEA gives school leaders, teachers, and families one trusted place to prepare, approve, publish, and access
                student results across every campus.
              </p>
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <Link
                  href="/signup"
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[9px] border border-primary bg-primary px-5 text-[0.92rem] font-medium text-white hover:bg-primary-hover"
                >
                  Set up your school
                  <ArrowRight size={17} strokeWidth={1.8} />
                </Link>
                <Link
                  href="/lookup"
                  className="inline-flex min-h-[50px] items-center justify-center rounded-[9px] border border-[#cedbe1] bg-white px-5 text-[0.92rem] font-medium text-[#173f5c] hover:border-[#aac3d1]"
                >
                  Check a student result
                </Link>
              </div>
              <div className="mt-10 flex items-center gap-4 text-[0.78rem] leading-[1.55] text-[#647b88]">
                <span className="h-px w-[42px] flex-none bg-[#b8c8cf]" />
                <span>
                  Designed around the way <strong className="font-medium text-[#294a5f]">African schools work</strong>
                  —from one campus to many.
                </span>
              </div>
            </div>

            <div className="relative w-full min-h-[425px] sm:min-h-[470px] lg:mx-auto lg:min-h-[600px] lg:max-w-[780px]">
              <div className="absolute inset-0 bottom-9 rounded-[18px_18px_18px_58px] border border-[#d6e1e5] bg-[#dfe9ec] sm:rounded-[22px_22px_22px_90px] lg:right-0 lg:bottom-[50px] lg:left-[45px]">
                <Image
                  src="/images/homepage-hero.png"
                  alt="A teacher and two students in school uniform reviewing results together on a laptop"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 780px"
                  className="rounded-[inherit] object-cover"
                />
              </div>

              <div className="absolute top-[26px] right-[-6px] z-[3] hidden w-[116px] rounded-[13px] bg-deep p-[13px] text-white sm:right-[-22px] sm:top-[52px] sm:block sm:w-[138px] sm:p-4">
                <Building2 size={22} strokeWidth={1.8} className="text-[#87cbb8]" />
                <strong className="mt-5 block text-[0.82rem] font-medium">Multi-campus ready</strong>
                <span className="mt-1.5 block text-[0.65rem] leading-relaxed text-[#adc1cc]">
                  Consistent reporting across every location.
                </span>
              </div>

              <div className="absolute bottom-0 left-0 z-[3] w-[86%] rounded-[14px] border border-[#dce5e9] bg-white p-4 sm:w-[72%] sm:p-[15px] lg:w-[min(330px,60%)] lg:p-5">
                <div className="flex items-center gap-3 border-b border-[#ebeff1] pb-4">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-primary-bg text-[0.75rem] font-medium text-primary">
                    AO
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-[0.82rem] font-medium text-text-primary">Adaeze Okafor</strong>
                    <span className="mt-1 block text-[0.68rem] text-[#8798a1]">JSS 2B · Term 2</span>
                  </span>
                  <span className="ml-auto whitespace-nowrap rounded-full bg-success-bg px-2 py-1 text-[0.63rem] font-medium text-success">
                    Published
                  </span>
                </div>
                <div className="flex items-end justify-between pt-[17px]">
                  <span className="text-[0.7rem] text-[#82939c]">
                    Overall average
                    <strong className="mt-1 block text-[1.75rem] leading-none font-medium tracking-[-0.04em] text-deep">87.4%</strong>
                  </span>
                  <span className="text-right text-[0.7rem] text-[#82939c]">
                    Position
                    <strong className="mt-1 block text-[0.92rem] font-medium text-deep">3rd of 32</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="why-sea" aria-label="SEA benefits" className="bg-deep text-white">
          <div className="mx-auto grid max-w-[1320px] gap-5 px-5 py-8 sm:px-8 md:grid-cols-2 md:px-12 lg:grid-cols-[1.25fr_repeat(3,1fr)] lg:items-center lg:gap-7">
            <p className="m-0 text-[0.76rem] leading-[1.55] text-[#a9bfca] md:col-span-2 lg:col-span-1">
              Everything your school needs to move from result entry to parent access—with less friction.
            </p>
            {bandItems.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-[0.8rem] text-[#dce8ed] sm:text-[0.85rem]">
                <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg border border-[#315873] text-[#80c7b3]">
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
