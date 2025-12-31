export function generateWhatsAppMessage(billNo: number, billData: any) {
  const { customerName, customerMobile, grandTotal, lineItems, paymentMethod, remarks } = billData

  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  let itemsList = ""
  lineItems.forEach((item: any, index: number) => {
    const price = Number.parseFloat(item.price) || 0
    const quantity = Number.parseFloat(item.quantity) || 0
    const itemTotal = price * quantity

    itemsList += `${index + 1}. ${item.product?.name || item.productName}\n`
    itemsList += `   Qty: ${quantity} x ₹${price.toFixed(2)} = ₹${itemTotal.toFixed(2)}\n`

    if (item.isMixDish && item.ingredients && item.ingredients.length > 0) {
      const ingredientNames = item.ingredients.map((ing: any) => ing.name).join(", ")
      itemsList += `   Mix: ${ingredientNames}\n`
    }
    itemsList += "\n"
  })

  const message = `*ACHYUTAM FRUITAM*
Ice Cream & Desserts
━━━━━━━━━━━━━━━━━━━━

*BILL #${billNo}*
Date: ${dateStr}, ${timeStr}

*Customer:* ${customerName}
*Mobile:* ${customerMobile}

━━━━━━━━━━━━━━━━━━━━
*ORDER DETAILS*

${itemsList}━━━━━━━━━━━━━━━━━━━━
*Payment:* ${paymentMethod}
${remarks ? `*Note:* ${remarks}\n` : ""}
*TOTAL AMOUNT: ₹${grandTotal.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━

✨ Thank you for choosing Achyutam Fruitam! ✨
We hope you enjoyed our ice creams!

📞 Call us for orders & inquiries
🍦 Fresh • Delicious • Premium Quality`

  return message
}

export function getWhatsAppUrl(mobile: string, message: string) {
  const cleanMobile = mobile.replace(/^(\+91|91)/, "").replace(/\s+/g, "")
  return `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(message)}`
}
