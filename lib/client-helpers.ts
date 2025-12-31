// ==================== CURRENCY FORMATTING ====================

/**
 * Format number as Indian Rupee currency
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "₹1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format number with Indian numbering system (lakhs/crores)
 * @param amount - Amount to format
 * @returns Formatted number string (e.g., "1,23,456")
 */
export function formatIndianNumber(amount: number): string {
  return new Intl.NumberFormat("en-IN").format(amount)
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

/**
 * Format date as Indian format (DD/MM/YYYY)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatIndianDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

/**
 * Format date with time (DD/MM/YYYY HH:MM AM/PM)
 * @param date - Date to format
 * @returns Formatted date-time string
 */
export function formatIndianDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

/**
 * Get date range for reports
 * @param rangeType - Type of range ('today', 'week', 'month', 'year')
 * @returns Object with startDate and endDate
 */
export function getDateRange(rangeType: "today" | "week" | "month" | "year") {
  const now = new Date()
  const { startOfDay } = getIndianDayBoundaries(now)

  const startDate = new Date(startOfDay)
  const endDate = new Date()

  switch (rangeType) {
    case "today":
      break
    case "week":
      startDate.setDate(startDate.getDate() - 7)
      break
    case "month":
      startDate.setMonth(startDate.getMonth() - 1)
      break
    case "year":
      startDate.setFullYear(startDate.getFullYear() - 1)
      break
  }

  return { startDate, endDate }
}

// ==================== VALIDATION UTILITIES ====================

/**
 * Validate phone number (Indian format)
 * @param phone - Phone number to validate
 * @returns true if valid
 */
export function isValidIndianPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/
  return phoneRegex.test(phone.replace(/\s+/g, ""))
}

/**
 * Validate email
 * @param email - Email to validate
 * @returns true if valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ==================== PROFIT CALCULATIONS (Client-safe) ====================

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