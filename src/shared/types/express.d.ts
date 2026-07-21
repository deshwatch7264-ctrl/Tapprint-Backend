import { Principal } from './auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
      requestId: string;
      /** Raw request body buffer, captured for webhook signature verification. */
      rawBody?: Buffer;
    }
  }
}

export {};
