import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDay } from "@/lib/owner-audit";
import { PLAN_LABEL, toCsv } from "@/lib/owner-revenue";
import { isTermNumber, termLabel } from "@/lib/term-number";

// A CSV of paid payments for the accountant. Platform owner only: a route is
// reachable by URL, so it checks the role itself rather than relying on the proxy.
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") return new Response("Not authorized.", { status: 401 });

  const params = new URL(req.url).searchParams;
  const from = parseDay(params.get("from") ?? undefined, false);
  const to = parseDay(params.get("to") ?? undefined, true);

  const payments = await prisma.payment.findMany({
    where: { status: "SUCCESS", paidAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
    orderBy: { paidAt: "asc" },
    take: 50_000,
    include: { school: { select: { name: true } } },
  });

  const csv = toCsv(
    ["Date paid (UTC)", "School", "Reference", "Amount", "Currency", "Plan", "Session", "Term", "First payment"],
    payments.map((p) => [
      p.paidAt ? p.paidAt.toISOString().slice(0, 10) : "",
      p.school.name,
      p.paystackReference,
      p.amount.toNumber(),
      p.currency,
      p.billingCycle ? PLAN_LABEL[p.billingCycle] : "",
      p.session ?? "",
      p.billingCycle === "FULL_SESSION" ? "Full session" : isTermNumber(p.termNumber) ? termLabel(p.termNumber) : "",
      p.isRegistration ? "Yes" : "No",
    ]),
  );

  const name = `sea-payments-${from ? from.toISOString().slice(0, 10) : "all"}-to-${to ? to.toISOString().slice(0, 10) : "today"}.csv`;
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
