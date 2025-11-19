import type { z } from "zod";

/**
 * Adds a refinement ensuring at least one field is provided. Useful for PATCH payloads.
 */
export const requireAtLeastOneField = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
) =>
  schema.refine(
    (obj: Record<string, unknown>) => Object.values(obj).some((value) => value !== undefined),
    { message: "At least one field must be provided" }
  );

export type RequireAtLeastOneField<T extends z.ZodRawShape> = ReturnType<
  typeof requireAtLeastOneField<T>
>;
