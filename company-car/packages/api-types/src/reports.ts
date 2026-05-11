import { z } from 'zod';

export const ReportRangeSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});
export type ReportRangeInput = z.infer<typeof ReportRangeSchema>;

export const ReportFormatEnum = z.enum(['excel', 'pdf']);
export type ReportFormat = z.infer<typeof ReportFormatEnum>;

export const DashboardSummarySchema = z.object({
  vehicles: z.object({
    inUse: z.number().int().min(0),
    available: z.number().int().min(0),
    maintenance: z.number().int().min(0),
  }),
  period: z.object({
    from: z.string().date(),
    to: z.string().date(),
    totalTrips: z.number().int().min(0),
    totalCostByType: z.record(z.string()),
    topPassengers: z.array(
      z.object({
        userId: z.string().uuid(),
        fullName: z.string(),
        tripCount: z.number().int().min(0),
      }),
    ),
  }),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
