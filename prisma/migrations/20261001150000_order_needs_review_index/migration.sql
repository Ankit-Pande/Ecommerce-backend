-- Admin dashboard and the "needs review" order filter.
CREATE INDEX "Order_needsReview_createdAt_idx" ON "Order"("needsReview", "createdAt");
