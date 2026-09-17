ALTER TABLE "products" ADD COLUMN "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");
CREATE INDEX "analytics_events_visitor_id_created_at_idx" ON "analytics_events"("visitor_id", "created_at");
