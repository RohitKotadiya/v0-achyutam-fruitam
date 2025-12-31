export function generatePrintHTML(billNo: number, billData: any) {
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

  let itemsHtml = ""
  lineItems.forEach((item: any) => {
    const price = Number.parseFloat(item.price) || 0
    const quantity = Number.parseFloat(item.quantity) || 0
    const itemTotal = price * quantity

    itemsHtml += `<tr>
      <td style="text-align:left; padding:5px 0;">${item.product?.name || item.productName}`

    if (item.isMixDish && item.ingredients && item.ingredients.length > 0) {
      const ingredientNames = item.ingredients.map((ing: any) => ing.name).join(", ")
      itemsHtml += `<br><small style="color:#666;">(Mix: ${ingredientNames})</small>`
    }

    itemsHtml += `</td>
      <td style="text-align:center; padding:5px 10px;">${quantity}</td>
      <td style="text-align:right; padding:5px 10px;">₹${price.toFixed(2)}</td>
      <td style="text-align:right; padding:5px 0;">₹${itemTotal.toFixed(2)}</td>
    </tr>`
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill #${billNo} - AFM</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    @media print {
      body { margin: 0; padding: 10px; }
      .no-print { display: none; }
      @page { size: 80mm auto; margin: 0; }
    }
    .receipt { max-width: 300px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
    .header h2 { margin: 5px 0; font-size: 14px; color: #666; font-weight: normal; }
    .info { margin-bottom: 15px; font-size: 12px; }
    .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
    .info-label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
    th { text-align: left; padding: 5px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; }
    td { padding: 5px 0; }
    .totals { border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
    .total-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: bold; margin-top: 10px; }
    .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; }
    .thank-you { font-weight: bold; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>ACHYUTAM FRUITAM</h1>
      <h2>Ice Cream & Desserts</h2>
    </div>
    
    <div class="info">
      <div class="info-row"><span class="info-label">Bill No:</span><span>#${billNo}</span></div>
      <div class="info-row"><span class="info-label">Date:</span><span>${dateStr}</span></div>
      <div class="info-row"><span class="info-label">Time:</span><span>${timeStr}</span></div>
      <div class="info-row"><span class="info-label">Customer:</span><span>${customerName}</span></div>
      ${customerMobile ? `<div class="info-row"><span class="info-label">Mobile:</span><span>${customerMobile}</span></div>` : ""}
    </div>
    
    <table>
      <thead>
        <tr>
          <th style="width:45%;">Item</th>
          <th style="width:15%; text-align:center;">Qty</th>
          <th style="width:20%; text-align:right;">Price</th>
          <th style="width:20%; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="total-row"><span>Payment Method:</span><span>${paymentMethod}</span></div>
      ${remarks ? `<div class="total-row"><span>Note:</span><span>${remarks}</span></div>` : ""}
      <div class="total-row grand-total"><span>TOTAL:</span><span>₹${grandTotal.toFixed(2)}</span></div>
    </div>
    
    <div class="footer">
      <div class="thank-you">Thank You! Visit Again! 🍦</div>
      <div>Fresh • Delicious • Premium Quality</div>
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`
}
