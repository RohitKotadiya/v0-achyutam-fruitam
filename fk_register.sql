ALTER TABLE "CashAdjustment" ADD CONSTRAINT "CashAdjustment_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;
