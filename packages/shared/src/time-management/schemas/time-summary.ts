import { z } from "zod";

import { TimeEntrySchema } from "./time-entry";

export const TimeSummaryResponseSchema = z.object({
  hoursThisWeek: z.number().nonnegative(),
  targetHours: z.number().positive().default(40),
  activeEntry: TimeEntrySchema.nullable(),
  pto_balance_days: z.number().nonnegative().default(0),
  sick_balance_days: z.number().nonnegative().default(0),
});
export type TimeSummaryResponse = z.infer<typeof TimeSummaryResponseSchema>;
