function formatBillDateTime(value?: string) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const datePart = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date)

  const timePart = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, " ")
    .toLowerCase()

  return `${datePart}, ${timePart}`
}

function formatPaymentMethod(value?: string) {
  switch (String(value || "").toUpperCase()) {
    case "ONLINE":
      return "Online"
    case "SPLIT":
      return "Split"
    case "PENDING":
      return "Pending"
    case "CASH":
    default:
      return "Cash"
  }
}

export function generateWhatsAppMessage(billNo: number, billData: any) {
  const { customerName, grandTotal, lineItems, paymentMethod, remarks, billDate, displayBillNo } = billData
  const displayNo = displayBillNo ?? billNo
  const lines: string[] = []

  lines.push("*ACHYUTAM FRUITAM*")

  const billStamp = formatBillDateTime(billDate)
  lines.push(billStamp ? `Bill #${displayNo} | ${billStamp}` : `Bill #${displayNo}`)
  lines.push(`Customer: ${customerName || "Walk-in Customer"}`)
  lines.push("─────────────────")

  lineItems.forEach((item: any, index: number) => {
    const price = Number.parseFloat(item.price) || 0
    const quantity = Number.parseFloat(item.quantity) || 0
    const itemTotal = price * quantity
    const itemName = item.product?.name || item.productName || "Item"

    lines.push(`${index + 1}. ${itemName}`)
    lines.push(`   ${quantity} x ₹${price.toFixed(0)} = ₹${itemTotal.toFixed(0)}`)
  })

  lines.push("─────────────────")
  lines.push(`*Total: ₹${Number(grandTotal || 0).toFixed(0)}*`)
  lines.push(`Paid: ${formatPaymentMethod(paymentMethod)}`)

  if (remarks?.trim()) {
    lines.push("")
    lines.push(`Note: ${remarks.trim()}`)
  }

  lines.push("")
  lines.push("Thank you!")

  return lines.join("\n")
}

export function generateBillLinkMessage(
  billNo: number,
  billData: { customerName?: string; grandTotal: number; paymentMethod?: string; displayBillNo?: string | null },
  shopName = "Achyutam Fruitam",
): string {
  const { customerName, grandTotal, paymentMethod, displayBillNo } = billData
  const displayNo = displayBillNo ?? billNo
  const appUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "")
  const name = customerName && customerName !== "Walk-in-Cust" ? `Hi ${customerName}! ` : ""
  const payment = paymentMethod === "ONLINE" ? "Online" : paymentMethod === "SPLIT" ? "Split" : paymentMethod === "PENDING" ? "Pending" : "Cash"

  return [
    ...(name ? [name.trim(), ``] : []),
    `Your bill from *${shopName}* is ready.`,
    `Bill #${displayNo} · ₹${Number(grandTotal).toFixed(0)} · ${payment}`,
    ``,
    `${appUrl}/bill/${displayNo}`,
    ``,
    `Thank you for shopping with us! 🙏`,
  ].join("\n")
}

export async function sendWhatsAppViaAPI(mobile: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: mobile, message }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function getWhatsAppUrl(mobile: string, message: string) {
  const cleanMobile = mobile.replace(/^(\+91|91)/, "").replace(/\s+/g, "")
  return `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(message)}`
}

export function openWhatsAppWithFallback(
  mobile: string,
  message: string,
  options?: {
    fallbackDelayMs?: number
    enableWebFallback?: boolean
    keepPageOpen?: boolean
    onFallback?: () => void
  },
) {
  const cleanMobile = mobile.replace(/^(\+91|91)/, "").replace(/\s+/g, "")
  const encodedMessage = encodeURIComponent(message)
  const appUrl = `whatsapp://send?phone=91${cleanMobile}&text=${encodedMessage}`
  const webUrl = `https://wa.me/91${cleanMobile}?text=${encodedMessage}`
  const fallbackDelayMs = options?.fallbackDelayMs ?? 1200
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const shouldUseWebFallback = options?.enableWebFallback ?? isMobileDevice
  const keepPageOpen = options?.keepPageOpen === true

  const openAppLink = () => {
    if (!keepPageOpen) {
      window.location.assign(appUrl)
      return
    }

    const iframe = document.createElement("iframe")
    iframe.style.display = "none"
    iframe.setAttribute("aria-hidden", "true")
    iframe.src = appUrl
    document.body.appendChild(iframe)
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
    }, 1000)
  }

  if (!shouldUseWebFallback) {
    openAppLink()
    return
  }

  let switchedToApp = false
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      switchedToApp = true
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange)
  openAppLink()

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange)
    if (!switchedToApp) {
      options?.onFallback?.()
      if (keepPageOpen) {
        window.open(webUrl, "_blank", "noopener,noreferrer")
      } else {
        window.location.assign(webUrl)
      }
    }
  }, fallbackDelayMs)
}
