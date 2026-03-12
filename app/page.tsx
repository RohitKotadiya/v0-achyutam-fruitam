"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AdminLoginModal } from "@/components/pos/admin-login-modal"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false)
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-purple-900">Achyutam Fruitam</h1>
        <p className="text-xl text-purple-700">Point of Sale System</p>
        <div className="flex gap-4 justify-center pt-4">
          {/* Login opens modal */}
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => setIsAdminModalOpen(true)}
          >
            Login
          </Button>

          {/* Go to POS as before */}
          <Link href="/pos">
            <Button size="lg" variant="outline">
              Go to POS
            </Button>
          </Link>
        </div>
      </div>

      {/* Reuse same modal behaviour as POS */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={() => {
          setIsAdminModalOpen(false)
          router.push("/admin?from=/")
        }}
      />
    </div>
  )
}
