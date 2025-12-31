import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-purple-900">Achyutam Fruitam</h1>
        <p className="text-xl text-purple-700">Point of Sale System</p>
        <div className="flex gap-4 justify-center pt-4">
          <Link href="/login">
            <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
              Login
            </Button>
          </Link>
          <Link href="/pos">
            <Button size="lg" variant="outline">
              Go to POS
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
