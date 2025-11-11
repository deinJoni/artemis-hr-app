import { z } from "zod";

import { EmploymentStatusEnum } from "../employees";

export const CSVImportPreviewSchema = z.object({
  validRows: z.array(z.record(z.string(), z.any())),
  invalidRows: z.array(
    z.object({
      row: z.number().int().min(1),
      data: z.record(z.string(), z.any()),
      errors: z.array(z.string()),
    })
  ),
  fieldMapping: z.record(z.string(), z.string()),
  totalRows: z.number().int().min(0),
});
export type CSVImportPreview = z.infer<typeof CSVImportPreviewSchema>;

export const CSVImportConfirmSchema = z.object({
  validRows: z.array(z.record(z.string(), z.any())),
  fieldMapping: z.record(z.string(), z.string()),
});
export type CSVImportConfirm = z.infer<typeof CSVImportConfirmSchema>;

export const CSVExportRequestSchema = z.object({
  tenantId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  status: EmploymentStatusEnum.optional(),
  includeSensitive: z.boolean().optional(),
  format: z.enum(["csv", "xlsx"]).optional(),
});
export type CSVExportRequest = z.infer<typeof CSVExportRequestSchema>;

export const CSVImportResultSchema = z.object({
  success: z.boolean(),
  created: z.number(),
  updated: z.number(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type CSVImportResult = z.infer<typeof CSVImportResultSchema>;
