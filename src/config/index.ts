import { env } from './env';

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  server: {
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    corsOrigin: env.CORS_ORIGIN,
  },
  logger: {
    level: env.LOG_LEVEL,
  },
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
    sessionTtl: env.JWT_SESSION_TTL,
    agentTtl: env.JWT_AGENT_TTL,
  },
  storage: {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT || undefined,
    uploadUrlTtl: env.S3_UPLOAD_URL_TTL,
    downloadUrlTtl: env.S3_DOWNLOAD_URL_TTL,
  },
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  },
  uploads: {
    maxBytes: env.MAX_UPLOAD_BYTES,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
    ] as const,
  },
} as const;

export type Config = typeof config;
