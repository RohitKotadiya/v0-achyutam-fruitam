// Helper functions for Mix Dish preparation logic

interface MixDishIngredient {
  sku?: string
  cubeFinished: boolean
  skuUsed: string[]
}

interface StockDeduction {
  sku: string
  quantity: number
}

/**
 * Calculate stock deductions for mix dish based on preparation method
 *
 * Logic:
 * 1. If cubeFinished items exist, deduct from those ice cream SKUs
 * 2. Otherwise, use prepared mix dish stock (SKU 42)
 * 3. Track which ingredients were used for audit purposes
 */
export function calculateMixDishStockDeductions(
  ingredients: MixDishIngredient[],
  preparedMixDishStock: number,
): {
  deductions: StockDeduction[]
  usePreparedMixDish: boolean
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

    return { deductions, usePreparedMixDish: false }
  }

  // No finished cubes, use prepared mix dish
  if (preparedMixDishStock === 0) {
    return {
      deductions: [],
      usePreparedMixDish: false,
      error: "No prepared mix dishes available",
    }
  }

  deductions.push({
    sku: "42", // Mix Dish SKU
    quantity: 1,
  })

  return { deductions, usePreparedMixDish: true }
}

/**
 * Prepare mix dishes in admin panel
 * This function creates prepared mix dishes by deducting ingredients
 */
export async function prepareMixDishes(ingredients: { sku: string; quantity: number }[], mixDishesPrepared: number) {
  // Validate inputs
  if (!ingredients || ingredients.length === 0) {
    throw new Error("No ingredients provided")
  }

  if (mixDishesPrepared < 1) {
    throw new Error("Invalid mix dishes quantity")
  }

  // Calculate total ingredient deductions
  const deductions: StockDeduction[] = ingredients.map((ing) => ({
    sku: ing.sku,
    quantity: ing.quantity,
  }))

  return {
    deductions,
    mixDishesCreated: mixDishesPrepared,
  }
}
