import { z } from 'zod';

const printerStatus = z.enum([
  'online',
  'offline',
  'busy',
  'out_of_paper',
  'paper_jam',
  'low_toner',
  'no_toner',
  'error',
  'agent_disconnected',
]);

export const heartbeatSchema = z.object({
  agentVersion: z.string().default('unknown'),
  printers: z
    .array(
      z.object({
        systemName: z.string(),
        status: printerStatus,
        capabilities: z.object({
          color: z.boolean(),
          duplex: z.boolean(),
          paperSizes: z.array(z.string()),
        }),
      }),
    )
    .default([]),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().uuid(),
});

export const reportStatusSchema = z.object({
  leaseId: z.string().optional(),
  status: z.enum(['printing', 'completed', 'failed']),
  pagesPrinted: z.number().int().min(0).optional(),
  failureReason: z.string().max(500).optional(),
});
