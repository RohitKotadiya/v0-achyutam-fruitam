// types/cash-adjustment.ts
export interface CashAdjustment {
  id: string;
  amount: number;
  reason: string;
  notes: string;
  userId: string;
  createdAt: string;
  registerId?: string | null;
  user?: { name?: string | null; email?: string | null };
}
