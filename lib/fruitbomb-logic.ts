// Helper functions for Fruitbomb preparation logic

interface FruitbombIngredient {
  sku?: string
  cubeFinished: boolean
  skuUsed: string[]
}

interface StockDeduction {
  sku: string
  quantity: number
}

/**
 * Calculate stock deductions for fruitbomb based on preparation method
 *
 * Logic:
 * 1. If cubeFinished items exist, deduct from those ice cream SKUs
 * 2. Otherwise, use prepared fruitbomb stock (SKU 43)
 * 3. Track which ingredients were used for audit purposes
 */
export function calculateFruitbombStockDeductions(
  ingredients: FruitbombIngredient[],
  preparedFruitbombStock: number,
): {
  deductions: StockDeduction[]
  usePreparedFruitbomb: boolean
  error?: string
} {
  const deductions: StockDeduction[] = []

  // Check if any cubes are finished
  const finishedCubes = ingredients.filter((ing) => ing.cubeFinished && ing.sku)

  if (finishedCubes.length > 0) {
    // Deduct from finished cube ice creams
    finishedCubes.forEach((cube) => {
      if (cube.sku) {
        deductions.push({
          sku: cube.sku,
          quantity: 1, // Each finished cube deducts 1 unit
        })
      }
    })

    return { deductions, usePreparedFruitbomb: false }
  }

  // No finished cubes, use prepared fruitbomb
  if (preparedFruitbombStock === 0) {
    return {
      deductions: [],
      usePreparedFruitbomb: false,
      error: "No prepared fruitbombs available",
    }
  }

  deductions.push({
    sku: "43", // Fruitbomb SKU
    quantity: 1,
  })

  return { deductions, usePreparedFruitbomb: true }
}

/**
 * Prepare fruitbombs in admin panel
 * This function creates prepared fruitbombs by deducting ingredients
 */
export async function prepareFruitbombs(ingredients: { sku: string; quantity: number }[], fruitbombsPrepared: number) {
  // Validate inputs
  if (!ingredients || ingredients.length === 0) {
    throw new Error("No ingredients provided")
  }

  if (fruitbombsPrepared < 1) {
    throw new Error("Invalid fruitbombs quantity")
  }

  // Calculate total ingredient deductions
  const deductions: StockDeduction[] = ingredients.map((ing) => ({
    sku: ing.sku,
    quantity: ing.quantity,
  }))

  return {
    deductions,
    fruitbombsCreated: fruitbombsPrepared,
  }
}
