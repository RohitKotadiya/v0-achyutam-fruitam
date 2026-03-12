export interface ProductCategory {
  id: string
  name: string
  displayName: string
  color: string
  icon?: string
}

export interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  category: ProductCategory
  sellingPrice: number
  originalCost: number
  currentStock?: {
    currentStock: number
  }
}
