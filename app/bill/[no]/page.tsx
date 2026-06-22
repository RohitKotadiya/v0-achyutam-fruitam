import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

type Props = { params: Promise<{ no: string }> }

async function getBill(no: string) {
  let bill = await prisma.bill.findFirst({
    where: { displayBillNo: no },
    include: { lineItems: true },
  })
  if (!bill) {
    const numeric = parseInt(no)
    if (!isNaN(numeric)) {
      bill = await prisma.bill.findUnique({
        where: { billNo: numeric },
        include: { lineItems: true },
      })
    }
  }
  return bill
}

async function getShopName() {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: "shopName" } })
  return cfg?.value || "Achyutam Fruitam"
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date))
}

function formatPayment(method: string) {
  const map: Record<string, string> = { CASH: "Cash", ONLINE: "Online", PENDING: "Pending", SPLIT: "Split" }
  return map[method] || method
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { no } = await params
  const bill = await getBill(no)
  if (!bill) return { title: "Bill Not Found" }

  const shopName = await getShopName()
  const displayNo = bill.displayBillNo ?? bill.billNo
  const total = `₹${Number(bill.grandTotal).toFixed(0)}`

  return {
    title: `Bill #${displayNo} · ${total} — ${shopName}`,
    description: `${total} · ${formatPayment(bill.paymentMethod)} · Tap to view your receipt`,
    openGraph: {
      title: `Your Bill from ${shopName}`,
      description: `Bill #${displayNo} · ${total} · ${formatPayment(bill.paymentMethod)}`,
      type: "website",
    },
    robots: { index: false, follow: false },
  }
}

export default async function BillPage({ params }: Props) {
  const { no } = await params
  const [bill, shopName] = await Promise.all([getBill(no), getShopName()])

  if (!bill) notFound()

  const displayNo = bill.displayBillNo ?? bill.billNo

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f3ff", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: "420px", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 2px 12px rgba(139,92,246,0.12)", overflow: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* Header */}
        <div style={{ backgroundColor: "#8b5cf6", padding: "24px 20px", textAlign: "center" }}>
          <div style={{ color: "#fff", fontSize: "22px", fontWeight: "700", letterSpacing: "0.5px" }}>{shopName}</div>
          <div style={{ color: "#ede9fe", fontSize: "13px", marginTop: "4px" }}>Digital Receipt</div>
        </div>

        {/* Bill Meta */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "13px", color: "#6b7280" }}>Bill No</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#111" }}>#{displayNo}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13px", color: "#6b7280" }}>Date</div>
            <div style={{ fontSize: "13px", fontWeight: "500", color: "#374151" }}>{formatDate(bill.dateTime)}</div>
          </div>
        </div>

        {/* Customer */}
        {bill.customerName && bill.customerName !== "Walk-in-Cust" && (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>Customer: </span>
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>{bill.customerName}</span>
          </div>
        )}

        {/* Items */}
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {bill.lineItems.map((item, i) => {
              const qty = Number(item.quantity)
              const price = Number(item.price)
              const total = qty * price
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "#111" }}>{item.productName}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                      {qty % 1 === 0 ? qty : qty.toFixed(2)} × ₹{price % 1 === 0 ? price : price.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#111", marginLeft: "12px" }}>
                    ₹{total % 1 === 0 ? total.toFixed(0) : total.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ margin: "0 20px", borderTop: "2px dashed #e5e7eb" }} />

        {/* Total */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>Total</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#7c3aed" }}>₹{Number(bill.grandTotal).toFixed(0)}</div>
        </div>

        {/* Payment */}
        <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>Payment</div>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{formatPayment(bill.paymentMethod)}</div>
        </div>

        {/* Split amounts */}
        {bill.paymentMethod === "SPLIT" && (
          <div style={{ padding: "0 20px 12px", display: "flex", gap: "16px" }}>
            {bill.cashAmount != null && (
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Cash: <strong>₹{Number(bill.cashAmount).toFixed(0)}</strong></div>
            )}
            {bill.onlineAmount != null && (
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Online: <strong>₹{Number(bill.onlineAmount).toFixed(0)}</strong></div>
            )}
          </div>
        )}

        {/* Remarks */}
        {bill.remarks?.trim() && (
          <div style={{ margin: "0 20px 16px", backgroundColor: "#f9fafb", borderRadius: "8px", padding: "10px 12px" }}>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>Note</div>
            <div style={{ fontSize: "13px", color: "#374151", marginTop: "2px" }}>{bill.remarks}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ backgroundColor: "#f5f3ff", padding: "16px 20px", textAlign: "center", borderTop: "1px solid #ede9fe" }}>
          <div style={{ fontSize: "15px", color: "#7c3aed", fontWeight: "600" }}>Thank you! 🙏</div>
          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>Visit us again</div>
        </div>

      </div>
    </div>
  )
}
