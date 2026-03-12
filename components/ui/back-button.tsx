"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

export function BackButton() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const from = searchParams.get("from")

  // Use ?from= param if provided, otherwise default based on current page
  let backHref = from || "/"
  if (!from) {
    if (pathname.startsWith("/bills")) backHref = "/pos"
    else if (pathname.startsWith("/admin")) backHref = "/"
  }

  return (
    <Link href={backHref}>
      <Button variant="outline" size="icon" aria-label="Go back">
        <ArrowLeft className="w-4 h-4" />
      </Button>
    </Link>
  )
}
