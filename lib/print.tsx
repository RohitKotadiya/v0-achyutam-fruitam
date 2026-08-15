import { resolveShopInfo, type ShopSettings } from "./shop-info"

// Shop fields come from admin input and are injected into markup, so escape them.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function generatePrintHTML(
  billNo: number,
  billData: any,
  options?: { copies?: number; shop?: ShopSettings | null },
) {
  const shop = resolveShopInfo(options?.shop)
  const { customerName, customerMobile, grandTotal, lineItems, remarks, displayBillNo } = billData
  const discountAmount = Math.max(Number(billData.discountAmount) || 0, 0)
  const discountPercent = Number(billData.discountPercent) || 0
  // Subtotal is derived, not stored: grandTotal is already net of the discount.
  const subtotal = Number(grandTotal) + discountAmount
  const discountLabel = discountPercent > 0 ? `Discount (${discountPercent}%)` : "Discount"
  const displayNo = displayBillNo ?? billNo
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
      <div class="brand">${escapeHtml(shop.name)}</div>
      ${shop.tagline ? `<div class="tagline">${escapeHtml(shop.tagline)}</div>` : ""}
    </div>
    <div class="dash"></div>

    <div class="row"><span>Bill #${displayNo}</span><span>${dateTimeStr}</span></div>
    <div class="row"><span>${customerName}</span>${customerMobile ? `<span>${customerMobile}</span>` : ""}</div>
    <div class="dash"></div>

    <table>
      <thead><tr><th style="width:40%">Item</th><th style="width:35%;text-align:center;white-space:nowrap">Qty×Rate</th><th style="width:25%;text-align:right">Amt</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="total-line">
      ${discountAmount > 0 ? `<div class="row sub"><span>Subtotal</span><span>₹${subtotal.toFixed(0)}</span></div>
      <div class="row sub"><span>${discountLabel}</span><span>-₹${discountAmount.toFixed(0)}</span></div>` : ""}
      <div class="row grand"><span>TOTAL</span><span>₹${grandTotal.toFixed(0)}</span></div>
    </div>
    ${remarks ? `<div class="row" style="font-size:9px;margin-top:2px;"><span>${remarks}</span></div>` : ""}

    <div class="dash"></div>
    <div class="footer center">
      <div class="ty">Thank You! Visit Again!</div>
      ${shop.address ? `<div class="addr">${escapeHtml(shop.address)}</div>` : ""}
    </div>
  </div>`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill #${displayNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:10px;width:45mm;margin:0;padding:1.5mm;box-sizing:border-box;line-height:1.2;}
    @media print{
      @page{size:48mm auto;margin:0;}
      body{font-size:10px;width:45mm;padding:1.5mm;margin:0;box-sizing:border-box;line-height:1.2;}
      .no-print{display:none;}
    }
    .center{text-align:center;}
    .brand{font-size:14px;font-weight:bold;letter-spacing:0.5px;}
    .tagline{font-size:8px;color:#555;margin-top:1px;}
    .dash{border-top:1px dashed #000;margin:3px 0;}
    .row{display:flex;justify-content:space-between;line-height:1.4;}
    table{width:100%;border-collapse:collapse;margin:3px 0;font-size:10px;}
    th{border-top:1px solid #000;border-bottom:1px solid #000;padding:2px 0;text-align:left;}
    th:nth-child(2){text-align:center;white-space:nowrap;}
    th:last-child{text-align:right;}
    td{padding:2px 0;vertical-align:top;font-size:10px;}
    .item-name{width:40%;overflow:hidden;text-overflow:ellipsis;}
    .qty-rate{width:35%;text-align:center;white-space:nowrap;}
    .amt{width:25%;text-align:right;white-space:nowrap;}
    .mix{font-size:8px;color:#666;}
    .total-line{border-top:1px solid #000;margin-top:3px;padding-top:3px;}
    .sub{font-size:10px;margin-bottom:1px;}
    .grand{font-size:15px;font-weight:bold;}
    .footer{font-size:9px;margin-top:4px;}
    .ty{font-weight:bold;font-size:10px;margin-top:2px;}
    .addr{font-size:8px;color:#555;margin-top:2px;line-height:1.25;}
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
