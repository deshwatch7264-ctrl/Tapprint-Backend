import winston from 'winston';
import { config } from '../../config';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${stack || message}${metaStr}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: config.logger.level,
  format: config.isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'tapprint-backend' },
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

export type Logger = typeof logger;
