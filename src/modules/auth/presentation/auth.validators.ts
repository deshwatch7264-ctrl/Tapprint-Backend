import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z
    .string()
    .regex(/^[0-9]{6}$/)
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const sessionSchema = z.object({
  stationSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
});
