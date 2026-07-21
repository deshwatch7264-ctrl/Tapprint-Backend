import { z } from 'zod';

export const createJobSchema = z.object({
  fileId: z.string().uuid(),
  printerId: z.string().uuid(),
  options: z.object({
    color: z.enum(['bw', 'color']),
    copies: z.number().int().min(1).max(999),
    pageRange: z
      .string()
      .regex(/^(\d+(-\d+)?)(,\d+(-\d+)?)*$/, 'Invalid page range format')
      .optional(),
    paperSize: z.enum(['A4', 'A3', 'A5', 'Letter', 'Legal']),
    duplex: z.boolean().default(false),
    orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  }),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().uuid(),
});
