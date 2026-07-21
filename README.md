# TapPrint Backend

Production-grade Node.js backend for TapPrint, built with **clean architecture** and the **repository pattern**.

## Stack

- **Node.js + Express + TypeScript**
- **PostgreSQL + Prisma** (ORM)
- **JWT** authentication (admin / customer session / print agent)
- **AWS S3** (or S3-compatible) cloud storage with pre-signed URLs
- **Razorpay** payment gateway with signature-verified webhooks
- **Multer** for multipart upload fallback
- **Zod** validation, **Winston** logging, centralized error handling
- **express-rate-limit**, **helmet**, **compression** for hardening

## Architecture

Each feature is a self-contained module with four layers:

```
modules/<feature>/
├── domain/          # Entities & repository interfaces (no framework deps)
├── application/     # Use cases / services (business logic)
├── infrastructure/  # Repository implementations (Prisma)
└── presentation/    # Controllers, routes, validators (Express)
```

Cross-cutting concerns live outside modules:

```
src/
├── config/          # Env validation (Zod) + typed config
├── shared/          # Errors, logger, HTTP helpers, types, utils
├── infrastructure/  # DB client, TokenService, StorageService, RazorpayService
├── middleware/      # auth, validate, error, rate-limit, upload, requestContext
├── modules/         # feature modules (auth, uploads, jobs, payments, ...)
├── routes/          # API router aggregation
├── app.ts           # Express app assembly
└── server.ts        # Bootstrap + graceful shutdown
```

**Dependency rule:** dependencies point inward. `presentation → application → domain`; `infrastructure` implements `domain` interfaces. Services depend on repository *interfaces*, not Prisma directly, so implementations are swappable and testable.

## Key guarantees

- **Server-derived pricing** — the client never sets an amount; the Pricing Engine computes it from the job spec and the active pricing rule.
- **Payment/print consistency** — a job advances to `queued` only on a signature-verified, amount-reconciled webhook. Webhook handling is idempotent.
- **Exactly-once printing** — `Idempotency-Key` on job creation; job leasing fields on the model.
- **Fail-fast config** — the process refuses to boot with an invalid environment.

## Getting started

```bash
cp .env.example .env          # fill in secrets
npm install
npm run prisma:generate
npm run prisma:migrate        # creates tables
npm run dev                   # http://localhost:4000/v1/health
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Hot-reload dev server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint the source |
| `npm run prisma:migrate` | Create/apply dev migrations |
| `npm run prisma:deploy` | Apply migrations in production |

## Endpoints (prefix `/v1`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | public |
| POST | `/auth/session` | public |
| POST | `/auth/admin/login` | public |
| POST | `/auth/admin/refresh` | public |
| POST | `/uploads` | customer |
| POST | `/uploads/:fileId/complete` | customer |
| GET | `/uploads/:fileId` | customer |
| POST | `/jobs` | customer |
| GET | `/jobs/:jobId` | customer |
| POST | `/jobs/:jobId/cancel` | customer |
| POST | `/payments/order` | customer |
| GET | `/payments/:paymentId` | customer |
| POST | `/payments/webhook` | signature |
| GET | `/stations/:stationId/printers` | customer/admin |
