export function generatePrintHTML(billNo: number, billData: any, options?: { copies?: number }) {
  const { customerName, customerMobile, grandTotal, lineItems, remarks } = billData
  const copies = Math.max(1, Math.min(Number(options?.copies) || 1, 5))

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yy = String(now.getFullYear()).slice(-2)
  const hours = now.getHours()
  const mins = String(now.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  const h12 = hours % 12 || 12
  const dateTimeStr = `${dd}/${mm}/${yy} ${h12}:${mins} ${ampm}`

  let itemsHtml = ""
  lineItems.forEach((item: any) => {
    const price = Number.parseFloat(item.price) || 0
    const quantity = Number.parseFloat(item.quantity) || 0
    const itemTotal = price * quantity

    itemsHtml += `<tr>
      <td class="item-name">${item.product?.name || item.productName}`

    if (item.isMixDish && item.ingredients && item.ingredients.length > 0) {
      const ingredientNames = item.ingredients.map((ing: any) => ing.name).join(", ")
      itemsHtml += `<br><span class="mix">(${ingredientNames})</span>`
    }

    itemsHtml += `</td>
      <td class="qty-rate">${quantity}x${price.toFixed(0)}</td>
      <td class="amt">₹${itemTotal.toFixed(0)}</td>
    </tr>`
  })

  const receiptHtml = `
  <div class="receipt-copy">
    <div class="center">
      <div class="brand">ACHYUTAM FRUITAM</div>
      <div class="tagline">Pure &bull; Fresh &bull; Premium</div>
    </div>
    <div class="dash"></div>

    <div class="row"><span>Bill #${billNo}</span><span>${dateTimeStr}</span></div>
    <div class="row"><span>${customerName}</span>${customerMobile ? `<span>${customerMobile}</span>` : ""}</div>
    <div class="dash"></div>

    <table>
      <thead><tr><th>Item</th><th>Qty×Rate</th><th>Amt</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="total-line">
      <div class="row grand"><span>TOTAL</span><span>₹${grandTotal.toFixed(0)}</span></div>
    </div>
    ${remarks ? `<div class="row" style="font-size:9px;margin-top:2px;"><span>${remarks}</span></div>` : ""}

    <div class="dash"></div>
    <div class="footer center">
      <div class="ty">Thank You! Visit Again!</div>
    </div>
  </div>`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill #${billNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Arial Narrow',Arial,sans-serif;font-size:11px;width:46mm;margin:0 auto;padding:0;}
    @media print{
      @page{size:48mm auto;margin:0;}
      body{width:46mm;padding:0;margin:0 auto;}
      .no-print{display:none;}
    }
    .center{text-align:center;}
    .brand{font-size:14px;font-weight:bold;letter-spacing:0.5px;}
    .tagline{font-size:8px;color:#555;margin-top:1px;}
    .dash{border-top:1px dashed #000;margin:3px 0;}
    .row{display:flex;justify-content:space-between;line-height:1.4;}
    table{width:100%;border-collapse:collapse;margin:2px 0;table-layout:fixed;}
    th{font-size:10px;border-bottom:1px solid #000;padding:2px 0;text-align:left;}
    th:nth-child(2){text-align:center;white-space:nowrap;}
    th:last-child{text-align:right;}
    td{padding:1px 0;vertical-align:top;font-size:11px;}
    .item-name{width:22mm;max-width:22mm;overflow:hidden;text-overflow:ellipsis;}
    .qty-rate{text-align:center;white-space:nowrap;padding:1px 2px;}
    .amt{text-align:right;white-space:nowrap;}
    .mix{font-size:8px;color:#666;}
    .total-line{border-top:1px solid #000;margin-top:3px;padding-top:3px;}
    .grand{font-size:15px;font-weight:bold;}
    .footer{font-size:9px;margin-top:4px;}
    .ty{font-weight:bold;font-size:10px;margin-top:2px;}
    .receipt-copy{page-break-after:always;break-after:page;}
    .receipt-copy:last-child{page-break-after:auto;break-after:auto;}
  </style>
</head>
<body>
  ${Array.from({ length: copies }, () => receiptHtml).join("")}

  <script>window.onload=function(){window.print();};</script>
</body>
</html>`
}
