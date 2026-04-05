import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST() {
  const results: string[] = []

  try {
    // --- Users ---
    const adminHash = await bcrypt.hash("admin123", 12)
    const staffHash = await bcrypt.hash("staff123", 12)

    await prisma.user.upsert({
      where: { email: "admin@achyutamfruitam.com" },
      update: {},
      create: { email: "admin@achyutamfruitam.com", name: "Admin", password: adminHash, role: "ADMIN" },
    })
    await prisma.user.upsert({
      where: { email: "staff@achyutamfruitam.com" },
      update: {},
      create: { email: "staff@achyutamfruitam.com", name: "Staff", password: staffHash, role: "STAFF" },
    })
    results.push("Users: OK (admin@achyutamfruitam.com / admin123, staff@achyutamfruitam.com / staff123)")

    // --- Categories ---
    const categorySeed = [
      { name: "fruit_bomb", displayName: "Fruit Bomb", description: "Fresh fruit bombs with ice cream", sortOrder: 1, color: "#f59e0b", icon: "🍊" },
      { name: "ice_cream", displayName: "Real Fruit Ice Cream", description: "Premium real fruit ice cream slices", sortOrder: 2, color: "#ec4899", icon: "🍨" },
      { name: "kulfi", displayName: "Kulfi", description: "Traditional Indian kulfi", sortOrder: 3, color: "#8b5cf6", icon: "🍡" },
      { name: "mix_dish", displayName: "Mix Dish", description: "Custom mix dish creations", sortOrder: 4, color: "#10b981", icon: "🍧" },
    ]

    let catCreated = 0
    for (const cat of categorySeed) {
      const existing = await prisma.productCategory.findFirst({ where: { name: cat.name } })
      if (!existing) {
        await prisma.productCategory.create({ data: { ...cat, isActive: true } })
        catCreated++
      }
    }
    results.push(`Categories: ${catCreated} created, ${categorySeed.length - catCreated} already existed`)

    // --- Products ---
    const categories = await prisma.productCategory.findMany()
    const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]))

    const productSeed = [
      // Fruit Bomb
      { sku: "1",  name: "Mango B",        categoryName: "fruit_bomb", originalCost: 162, sellingPrice: 250 },
      { sku: "2",  name: "Dadam B",         categoryName: "fruit_bomb", originalCost: 117, sellingPrice: 190 },
      { sku: "3",  name: "Orange B",        categoryName: "fruit_bomb", originalCost: 117, sellingPrice: 190 },
      { sku: "4",  name: "Apple B",         categoryName: "fruit_bomb", originalCost: 117, sellingPrice: 190 },
      { sku: "5",  name: "Musk Melon B",    categoryName: "fruit_bomb", originalCost: 117, sellingPrice: 190 },
      { sku: "6",  name: "Guava B",         categoryName: "fruit_bomb", originalCost: 117, sellingPrice: 190 },
      // Ice Cream 90
      { sku: "7",  name: "Mulberry",        categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "8",  name: "Custard Apple",   categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "9",  name: "Strawbery",       categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "10", name: "Coconut",         categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "11", name: "Guava",           categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "12", name: "Chocolate",       categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "13", name: "Cookies Cream",   categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "14", name: "Kesar Pista",     categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "15", name: "Kaju Gulkand",    categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "16", name: "Pan Masala",      categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "17", name: "Kaju Katli",      categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "18", name: "Musk Melon",      categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "19", name: "Litchi",          categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "20", name: "Achyutam Sp",     categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      { sku: "30", name: "Biscoff",         categoryName: "ice_cream", originalCost: 45, sellingPrice: 90 },
      // Ice Cream 80
      { sku: "21", name: "Jamun",           categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "22", name: "Kiwi",            categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "23", name: "Imli",            categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "24", name: "Chikoo",          categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "25", name: "Mango",           categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "26", name: "Pineapple",       categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "27", name: "Dadam",           categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "28", name: "Orange",          categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "29", name: "Grapes",          categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      { sku: "31", name: "Kaju Anjeer",     categoryName: "ice_cream", originalCost: 40, sellingPrice: 80 },
      // Ice Cream 120
      { sku: "32", name: "Raspbery",        categoryName: "ice_cream", originalCost: 78, sellingPrice: 120 },
      { sku: "33", name: "Bluebery",        categoryName: "ice_cream", originalCost: 78, sellingPrice: 120 },
      // Kulfi
      { sku: "34", name: "Mango K",         categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      { sku: "35", name: "Chocolate K",     categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      { sku: "36", name: "Strawbery K",     categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      { sku: "37", name: "Mawa Malai K",    categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      { sku: "38", name: "Jamun K",         categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      { sku: "39", name: "Kesar Pista K",   categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      { sku: "40", name: "Chikoo K",        categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      { sku: "41", name: "Orange K",        categoryName: "kulfi", originalCost: 25, sellingPrice: 50 },
      // Mix Dish
      { sku: "42", name: "Mix Dish",        categoryName: "mix_dish", originalCost: 45, sellingPrice: 120 },
    ]

    let prodCreated = 0
    for (const p of productSeed) {
      const existing = await prisma.product.findUnique({ where: { sku: p.sku } })
      if (!existing) {
        const product = await prisma.product.create({
          data: {
            sku: p.sku,
            name: p.name,
            categoryId: catMap[p.categoryName],
            originalCost: p.originalCost,
            sellingPrice: p.sellingPrice,
            active: true,
          },
        })
        await prisma.stockCurrent.upsert({
          where: { productId: product.id },
          update: {},
          create: { productId: product.id, currentStock: 0 },
        })
        prodCreated++
      }
    }
    results.push(`Products: ${prodCreated} created, ${productSeed.length - prodCreated} already existed`)

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error("Seed error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
