import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CashAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  diffAmount: number;
  userId?: string;
}

const REASONS = [
  "Wrong payment method on bill",
  "Cash given to staff",
  "Customer overpaid",
  "Cash found",
  "Other",
];

export function CashAdjustmentDialog({ open, onOpenChange, onSuccess, diffAmount, userId }: CashAdjustmentDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reason) return setError("Please select a reason");
    if (!notes.trim()) return setError("Please enter notes");
    setLoading(true);
    try {
      const res = await fetch("/api/finance/cash-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: diffAmount,
          reason,
          notes,
          userId,
        }),
        credentials: "include",
      });

      let data = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Invalid server response");
        }
      }

      if (!res.ok) {
        throw new Error((data && data.error) || `Server error: ${res.status}`);
      }

      if (!data || !data.success) {
        throw new Error((data && data.error) || "Failed to save");
      }

      setReason("");
      setNotes("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cash Adjustment</DialogTitle>
          <DialogDescription>
            {diffAmount < 0 ? (
              <>
                Negative difference detected. Please record the reason for{" "}
                <b>₹{Math.abs(diffAmount)}</b> shortfall.
              </>
            ) : (
              <>
                Positive difference detected. Please record the reason for{" "}
                <b>₹{Math.abs(diffAmount)}</b> excess.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="">Select reason</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              placeholder="Enter details..."
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}