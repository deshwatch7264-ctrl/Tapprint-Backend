-- CreateTable
CREATE TABLE "print_agents" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "agent_token_hash" TEXT NOT NULL,
    "version" TEXT,
    "hostname" TEXT,
    "last_heartbeat_at" TIMESTAMP(3),
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "print_agents_station_id_idx" ON "print_agents"("station_id");

-- CreateIndex
CREATE INDEX "print_agents_agent_token_hash_idx" ON "print_agents"("agent_token_hash");

-- AddForeignKey
ALTER TABLE "print_agents" ADD CONSTRAINT "print_agents_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
