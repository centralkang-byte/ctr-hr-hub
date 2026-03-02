-- AddUniqueConstraint: competency_indicators(competency_id, display_order)
CREATE UNIQUE INDEX IF NOT EXISTS "competency_indicators_competency_id_display_order_key"
  ON "competency_indicators"("competency_id", "display_order");
