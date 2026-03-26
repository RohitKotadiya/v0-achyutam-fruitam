import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const DEFAULT_SETTINGS: Record<string, string> = {
  showProductImages: "false",
  showProductSKU: "false",
  shopName: "Achyutam Fruitam",
  shopAddress: "",
  shopMobile: "",
  shopGST: "",
  taxRate: "0",
  lowStockThreshold: "10",
  mixPreparationTargetCategoryId: "",
  enableMixDishPrep: "true",
  enableMixDishPopup: "true",
  enableStockTransfer: "true",
  receiptPrintCopies: "1",
  enableSilentPrinting: "false",
  thermalPrinterAddress: "",
  businessDayCutoffHour: "0",
}

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany()

    // Merge DB values with defaults
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS }
    for (const config of configs) {
      settings[config.key] = config.value
    }

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { settings } = body as { settings: Record<string, string> }

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ success: false, error: "Invalid settings" }, { status: 400 })
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving settings:", error)
    return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 })
  }
}
