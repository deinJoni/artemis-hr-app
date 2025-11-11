import { z } from "zod";

import { LeaveTypeEnum } from "../../common/enums";

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  kind: z.enum(["time_off", "time_entry"]),
  userId: z.string().uuid(),
  leaveType: LeaveTypeEnum.optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarRangeQuerySchema = z.object({
  start: z.string(),
  end: z.string(),
  teamId: z.string().uuid().optional(),
});
export type CalendarRangeQuery = z.infer<typeof CalendarRangeQuerySchema>;

export const CalendarResponseSchema = z.object({
  events: z.array(CalendarEventSchema),
});
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
