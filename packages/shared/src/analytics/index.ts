import { z } from "zod";

export const ExampleChartPointSchema = z.object({
  month: z.string(),
  users: z.number().finite().nonnegative(),
});
export type ExampleChartPoint = z.infer<typeof ExampleChartPointSchema>;

export const ExampleChartResponseSchema = z.object({
  chartData: z.array(ExampleChartPointSchema),
});
export type ExampleChartResponse = z.infer<typeof ExampleChartResponseSchema>;

export const ExamplePlanSchema = z.enum(["Starter", "Pro", "Business"]);
export type ExamplePlan = z.infer<typeof ExamplePlanSchema>;

export const ExampleTableRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  plan: ExamplePlanSchema,
});
export type ExampleTableRow = z.infer<typeof ExampleTableRowSchema>;

export const ExampleTableResponseSchema = z.object({
  tableData: z.array(ExampleTableRowSchema),
});
export type ExampleTableResponse = z.infer<typeof ExampleTableResponseSchema>;
