import { z } from "zod";

// Centralized enums shared across multiple domains.

export const TimeOffStatusEnum = z.enum(["pending", "approved", "denied", "cancelled"]);
export type TimeOffStatus = z.infer<typeof TimeOffStatusEnum>;

export const LeaveTypeEnum = z.enum(["vacation", "sick", "personal", "unpaid", "other"]);
export type LeaveTypeKind = z.infer<typeof LeaveTypeEnum>;
