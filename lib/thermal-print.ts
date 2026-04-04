import { Capacitor } from "@capacitor/core"
import { CapacitorThermalPrinter } from "capacitor-thermal-printer"

type PrintableLineItem = {
  product?: { name?: string | null }
  productName?: string | null
  quantity?: number | string | null
  price?: number | string | null
}

type PrintableBillData = {
  customerName: string
  customerMobile?: string | null
  grandTotal: number
  lineItems: PrintableLineItem[]
  remarks?: string | null
  displayBillNo?: string | null
}

const RECEIPT_WIDTH = 32

function padRight(value: string, width: number) {
  return value.length >= width ? value : value + " ".repeat(width - value.length)
}

function padLeft(value: string, width: number) {
  return value.length >= width ? value : " ".repeat(width - value.length) + value
}

function centerText(value: string, width = RECEIPT_WIDTH) {
  if (value.length >= width) return value
  const left = Math.floor((width - value.length) / 2)
  const right = width - value.length - left
  return `${" ".repeat(left)}${value}${" ".repeat(right)}`
}

function divider() {
  return "-".repeat(RECEIPT_WIDTH)
}

function fitLine(left: string, right: string, width = RECEIPT_WIDTH) {
  const safeLeft = left.slice(0, Math.max(0, width - right.length - 1))
  const space = Math.max(1, width - safeLeft.length - right.length)
  return `${safeLeft}${" ".repeat(space)}${right}`
}

function wrapText(value: string, width: number) {
  if (!value) return [""]
  const words = value.split(/\s+/)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= width) {
      current = next
    } else {
      if (current) lines.push(current)
      if (word.length <= width) {
        current = word
      } else {
        for (let index = 0; index < word.length; index += width) {
          lines.push(word.slice(index, index + width))
        }
        current = ""
      }
    }
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : [""]
}

function formatDateTime() {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yy = String(now.getFullYear()).slice(-2)
  const hours = now.getHours()
  const mins = String(now.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  const h12 = hours % 12 || 12
  return `${dd}/${mm}/${yy} ${h12}:${mins} ${ampm}`
}

export function canUseSilentThermalPrint(settings: Record<string, string>) {
  return Capacitor.isNativePlatform() && settings.enableSilentPrinting === "true" && Boolean(settings.thermalPrinterAddress?.trim())
}

export async function printBillSilently(
  billNo: number,
  billData: PrintableBillData,
  settings: Record<string, string>,
) {
  const address = settings.thermalPrinterAddress?.trim()
  if (!canUseSilentThermalPrint(settings) || !address) {
    return false
  }

  const shopName = settings.shopName?.trim() || "ACHYUTAM FRUITAM"
  const copies = Math.max(1, Math.min(Number(settings.receiptPrintCopies) || 1, 5))
  const dateTimeStr = formatDateTime()

  const isConnected = await CapacitorThermalPrinter.isConnected().catch(() => false)
  if (!isConnected) {
    const connected = await CapacitorThermalPrinter.connect({ address })
    if (!connected) {
      throw new Error("Failed to connect to configured thermal printer")
    }
  }

  let job = CapacitorThermalPrinter.begin()

  for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
    job = job
      .align("center")
      .bold()
      .text(`${shopName}\n`)
      .clearFormatting()
      .text(`${centerText("Receipt")}\n`)
      .text(`${divider()}\n`)
      .align("left")
      .text(`${fitLine(`Bill #${billData.displayBillNo ?? billNo}`, dateTimeStr)}\n`)
      .text(`${billData.customerName}${billData.customerMobile ? ` / ${billData.customerMobile}` : ""}\n`)
      .text(`${divider()}\n`)

    for (const item of billData.lineItems) {
      const name = String(item.product?.name || item.productName || "Item")
      const quantity = Number(item.quantity) || 0
      const price = Number(item.price) || 0
      const total = quantity * price

      for (const line of wrapText(name, RECEIPT_WIDTH)) {
        job = job.text(`${line}\n`)
      }

      job = job.text(`${fitLine(`${quantity} x ${price.toFixed(0)}`, `Rs ${total.toFixed(0)}`)}\n`)
    }

    job = job
      .text(`${divider()}\n`)
      .bold()
      .text(`${fitLine("TOTAL", `Rs ${Number(billData.grandTotal || 0).toFixed(0)}`)}\n`)
      .clearFormatting()

    if (billData.remarks?.trim()) {
      for (const line of wrapText(`Remarks: ${billData.remarks.trim()}`, RECEIPT_WIDTH)) {
        job = job.text(`${line}\n`)
      }
    }

    job = job
      .text(`${divider()}\n`)
      .align("center")
      .text(`Thank You! Visit Again!\n`)
      .align("left")
      .feedCutPaper()
  }

  await job.write()
  return true
}