/**
 * Shop identity (name / tagline / address) shared by every bill surface:
 * the HTML receipt, the ESC/POS thermal receipt, both WhatsApp message types
 * and the public digital bill page.
 *
 * Each shop branch runs its own database, so these values differ per branch and
 * must never be hardcoded in a receipt template.
 */

export type ShopSettings = {
  shopName?: string | null
  shopTagline?: string | null
  shopAddress?: string | null
}

/** Used only when a branch has no shopName configured at all. */
export const FALLBACK_SHOP_NAME = "ACHYUTAM FRUITAM"

export type ResolvedShopInfo = {
  name: string
  tagline: string
  address: string
}

/**
 * Blank tagline/address resolve to "" and callers omit the line entirely —
 * matching how the digital bill page already treats them.
 */
export function resolveShopInfo(settings?: ShopSettings | null): ResolvedShopInfo {
  return {
    name: settings?.shopName?.trim() || FALLBACK_SHOP_NAME,
    tagline: settings?.shopTagline?.trim() || "",
    address: settings?.shopAddress?.trim() || "",
  }
}
