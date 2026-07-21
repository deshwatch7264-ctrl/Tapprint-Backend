-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'owner', 'support');

-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('active', 'paused', 'maintenance', 'disabled');

-- CreateEnum
CREATE TYPE "PrinterStatus" AS ENUM ('online', 'offline', 'busy', 'out_of_paper', 'paper_jam', 'low_toner', 'no_toner', 'error', 'agent_disconnected');

-- CreateEnum
CREATE TYPE "ColorMode" AS ENUM ('bw', 'color');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('created', 'awaiting_payment', 'queued', 'claimed', 'printing', 'retrying', 'completed', 'failed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('uploading', 'uploaded', 'scanning', 'converting', 'ready', 'rejected', 'purged');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('initiated', 'processing', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'owner',
    "phone" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "display_name" TEXT,
    "is_guest" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "StationStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printers" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "system_name" TEXT,
    "supports_color" BOOLEAN NOT NULL DEFAULT false,
    "supports_duplex" BOOLEAN NOT NULL DEFAULT false,
    "paper_sizes" TEXT[] DEFAULT ARRAY['A4']::TEXT[],
    "current_status" "PrinterStatus" NOT NULL DEFAULT 'offline',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "bw_page_price" INTEGER NOT NULL,
    "color_page_price" INTEGER NOT NULL,
    "duplex_discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimum_charge" INTEGER NOT NULL DEFAULT 0,
    "paper_multiplier" JSONB NOT NULL DEFAULT '{"A4":1}',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "station_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "normalized_key" TEXT,
    "page_count" INTEGER,
    "checksum_sha256" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'uploading',
    "reject_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "station_id" TEXT NOT NULL,
    "printer_id" TEXT,
    "file_id" TEXT NOT NULL,
    "pricing_rule_id" TEXT,
    "color" "ColorMode" NOT NULL DEFAULT 'bw',
    "copies" INTEGER NOT NULL DEFAULT 1,
    "page_range" TEXT,
    "pages_to_print" INTEGER NOT NULL,
    "paper_size" TEXT NOT NULL DEFAULT 'A4',
    "duplex" BOOLEAN NOT NULL DEFAULT false,
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "JobStatus" NOT NULL DEFAULT 'created',
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT,
    "failure_reason" TEXT,
    "queued_at" TIMESTAMP(3),
    "printed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" BIGSERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "from_status" "JobStatus",
    "to_status" "JobStatus" NOT NULL,
    "detail" TEXT,
    "actor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT,
    "gateway" TEXT NOT NULL DEFAULT 'razorpay',
    "gateway_order_id" TEXT,
    "gateway_payment_id" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "method" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "webhook_verified" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "gateway_refund_id" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'initiated',
    "initiated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'razorpay',
    "signature" TEXT,
    "payload_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stations_slug_key" ON "stations"("slug");

-- CreateIndex
CREATE INDEX "stations_owner_id_idx" ON "stations"("owner_id");

-- CreateIndex
CREATE INDEX "stations_status_idx" ON "stations"("status");

-- CreateIndex
CREATE INDEX "printers_station_id_idx" ON "printers"("station_id");

-- CreateIndex
CREATE INDEX "printers_current_status_idx" ON "printers"("current_status");

-- CreateIndex
CREATE INDEX "pricing_rules_station_id_idx" ON "pricing_rules"("station_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rules_station_id_version_key" ON "pricing_rules"("station_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_files_storage_key_key" ON "uploaded_files"("storage_key");

-- CreateIndex
CREATE INDEX "uploaded_files_station_id_idx" ON "uploaded_files"("station_id");

-- CreateIndex
CREATE INDEX "uploaded_files_session_id_idx" ON "uploaded_files"("session_id");

-- CreateIndex
CREATE INDEX "uploaded_files_status_idx" ON "uploaded_files"("status");

-- CreateIndex
CREATE UNIQUE INDEX "print_jobs_idempotency_key_key" ON "print_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "print_jobs_station_id_idx" ON "print_jobs"("station_id");

-- CreateIndex
CREATE INDEX "print_jobs_session_id_idx" ON "print_jobs"("session_id");

-- CreateIndex
CREATE INDEX "print_jobs_printer_id_idx" ON "print_jobs"("printer_id");

-- CreateIndex
CREATE INDEX "print_jobs_status_idx" ON "print_jobs"("status");

-- CreateIndex
CREATE INDEX "job_events_job_id_idx" ON "job_events"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_order_id_key" ON "payments"("gateway_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_payment_id_key" ON "payments"("gateway_payment_id");

-- CreateIndex
CREATE INDEX "payments_job_id_idx" ON "payments"("job_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_gateway_refund_id_key" ON "refunds"("gateway_refund_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_job_id_idx" ON "refunds"("job_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events"("event_type");

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "uploaded_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "print_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "print_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "print_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
