import { z } from "zod";
import { teamRosterPlanSchema } from "./eos-runtime";

/**
 * Company Mission setup can persist a staged roster before a role graph
 * exists. It remains planning data only, but must already satisfy the same
 * shape Org Studio will enforce when it later maps people to real seats.
 */
export const companyFounderProfileSchema = z.record(z.unknown()).superRefine(
  (profile, context) => {
    if (!Object.hasOwn(profile, "teamRosterPlan")) return;
    const parsed = teamRosterPlanSchema.safeParse(profile.teamRosterPlan);
    if (parsed.success) return;
    for (const issue of parsed.error.issues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamRosterPlan", ...issue.path],
        message: issue.message,
      });
    }
  },
);
