"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { weightsAreValid, weightsTotal } from "@/lib/annual-summary";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return { schoolId: session.user.schoolId, userId: session.user.id };
}

const weight = z.number().min(0, "Weights can't be negative.").max(100, "A weight can't exceed 100.");

const settingsSchema = z.object({
  term1Weight: weight,
  term2Weight: weight,
  term3Weight: weight,
  incompleteYearPolicy: z.enum(["BLOCK", "CALCULATE_AVAILABLE"]),
  showAnnualPosition: z.boolean(),
});

// The school-wide rules for how a year is put together. Published results keep
// the weights they were computed with (they're frozen in the snapshot), so
// changing these only affects results published afterwards.
export async function saveAnnualSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const { schoolId, userId } = await requireSchoolAdmin();
  return toResult(async () => {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Those settings aren't valid.");
    const s = parsed.data;

    const weights = { 1: s.term1Weight, 2: s.term2Weight, 3: s.term3Weight };
    if (!weightsAreValid(weights)) {
      throw new UserError(`The three term weights must total 100% — they currently total ${Math.round(weightsTotal(weights) * 100) / 100}%.`);
    }

    const data = {
      term1Weight: s.term1Weight,
      term2Weight: s.term2Weight,
      term3Weight: s.term3Weight,
      incompleteYearPolicy: s.incompleteYearPolicy,
      showAnnualPosition: s.showAnnualPosition,
      updatedByUserId: userId,
    };
    await prisma.annualSummarySettings.upsert({ where: { schoolId }, create: { schoolId, ...data }, update: data });

    revalidatePath("/admin/result-templates");
    return {};
  });
}
