export function generateWhatsAppMessage(billNo: number, billData: any) {
  const { customerName, grandTotal, lineItems, remarks } = billData

  let itemsList = ""
  lineItems.forEach((item: any, index: number) => {
    const price = Number.parseFloat(item.price) || 0
    const quantity = Number.parseFloat(item.quantity) || 0
    const itemTotal = price * quantity

    const itemName = item.product?.name || item.productName || "Item"
    itemsList += `${index + 1}. *${itemName}*    ${quantity}x${price.toFixed(0)} = ${itemTotal.toFixed(0)}\n`
  })

  const message = `*ACHYUTAM FRUITAM*
Hello, ${customerName}

*Bill #${billNo}*

${itemsList}
*Grand Total: ₹${grandTotal.toFixed(0)}*
${remarks ? `Note: ${remarks}\n` : ""}
Thank you! Visit Again!`

  return message
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
