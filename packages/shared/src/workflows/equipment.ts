import { z } from "zod";

export const EquipmentTypeEnum = z.enum([
  "laptop",
  "monitor",
  "keyboard",
  "mouse",
  "mobile_device",
  "badge",
  "access_card",
  "other",
]);
export type EquipmentType = z.infer<typeof EquipmentTypeEnum>;

export const EquipmentStatusEnum = z.enum([
  "available",
  "assigned",
  "returned",
  "maintenance",
  "retired",
]);
export type EquipmentStatus = z.infer<typeof EquipmentStatusEnum>;

export const EquipmentItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid().nullable(),
  type: EquipmentTypeEnum,
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  status: EquipmentStatusEnum,
  assigned_at: z.string().nullable(),
  returned_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type EquipmentItem = z.infer<typeof EquipmentItemSchema>;

export const EquipmentAssignInputSchema = z.object({
  employee_id: z.string().uuid(),
  type: EquipmentTypeEnum,
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  notes: z.string().optional(),
});
export type EquipmentAssignInput = z.infer<typeof EquipmentAssignInputSchema>;

export const EquipmentListResponseSchema = z.object({
  equipment: z.array(EquipmentItemSchema),
});
export type EquipmentListResponse = z.infer<typeof EquipmentListResponseSchema>;

