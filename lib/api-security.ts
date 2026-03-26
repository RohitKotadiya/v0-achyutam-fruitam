export function isMaintenanceKeyValid(request: Request) {
  const expectedKey = process.env.MAINTENANCE_API_KEY
  if (!expectedKey) return false

  const providedKey = request.headers.get("x-maintenance-key")
  return providedKey === expectedKey
}
