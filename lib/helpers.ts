import prisma from "./prisma"

// ==================== STOCK CALCULATIONS ====================

/**
 * Calculate and update current stock after inventory purchase or sale
 * @param productId - Product ID to update stock for
 * @returns Updated current stock quantity
 */
export async function calculateStock(productId: string): Promise<number> {
  // Sum all inventory purchases
  const totalPurchased = await prisma.inventoryLog.aggregate({
    where: { productId },
    _sum: { quantity: true },
  })

  // Sum all sales (from bill items)
  const totalSold = await prisma.billItem.aggregate({
    where: { productId },
    _sum: { quantity: true },
  })

  // Sum all damaged/wasted items
  const totalDamaged = await prisma.damageLog.aggregate({
    where: { productId },
    _sum: { quantity: true },
  })

  const purchased = totalPurchased._sum.quantity || 0
  const sold = totalSold._sum.quantity || 0
  const damaged = totalDamaged._sum.quantity || 0

  const currentStock = purchased - sold - damaged

  // Update StockCurrent table
  await prisma.stockCurrent.upsert({
    where: { productId },
    update: { currentStock, updatedAt: new Date() },
    create: {
      productId,
      currentStock,
    },
  })

  return currentStock
}

/**
 * Get low stock products (below threshold)
 * @param threshold - Minimum stock level (default: 10)
 * @returns Array of products with low stock
 */
export async function getLowStockProducts(threshold = 10) {
  return prisma.stockCurrent.findMany({
    where: {
      currentStock: { lte: threshold },
    },
    include: {
      product: true,
    },
    orderBy: {
      currentStock: "asc",
    },
  })
}

// ==================== PROFIT CALCULATIONS ====================

/**
 * Calculate profit for a product
 * @param sellingPrice - Selling price of product
 * @param costPrice - Cost price of product
 * @param quantity - Quantity sold
 * @returns Profit amount
 */
export function calculateProfit(sellingPrice: number, costPrice: number, quantity = 1): number {
  return (sellingPrice - costPrice) * quantity
}

/**
 * Calculate profit margin percentage
 * @param sellingPrice - Selling price of product
 * @param costPrice - Cost price of product
 * @returns Profit margin as percentage
 */
export function calculateProfitMargin(sellingPrice: number, costPrice: number): number {
  if (sellingPrice === 0) return 0
  return ((sellingPrice - costPrice) / sellingPrice) * 100
}

/**
 * Calculate total bill profit
 * @param billId - Bill ID to calculate profit for
 * @returns Total profit amount
 */
export async function calculateBillProfit(billId: string): Promise<number> {
  const billItems = await prisma.billItem.findMany({
    where: { billId },
    include: { product: true },
  })

  return billItems.reduce((total, item) => {
    const profit = calculateProfit(item.sellingPrice, item.product.originalCost, item.quantity)
    return total + profit
  }, 0)
}


// ==================== DATE UTILITIES ====================

/**
 * Get start and end of day in IST
 * @param date - Date to get boundaries for (defaults to today)
 * @returns Object with startOfDay and endOfDay
 */
export function getIndianDayBoundaries(date: Date = new Date()) {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))

  const startOfDay = new Date(istDate)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(istDate)
  endOfDay.setHours(23, 59, 59, 999)

  return { startOfDay, endOfDay }
}

// ==================== VALIDATION UTILITIES ====================
/**
 * Generate bill number
 * @returns Bill number in format BILL-YYYYMMDD-XXXX
 */
export async function generateBillNumber(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "")

  // Get count of bills created today
  const { startOfDay, endOfDay } = getIndianDayBoundaries(today)
  const todayBillsCount = await prisma.bill.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  })

  const sequence = String(todayBillsCount + 1).padStart(4, "0")
  return `BILL-${dateStr}-${sequence}`
}
