"use client"

import { Suspense, useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

function LoginForm() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (status === "authenticated") {
      const callbackUrl = searchParams?.get("callbackUrl") || "/"
      router.replace(callbackUrl)
    }
  }, [status, router, searchParams])

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    setIsLoading(false)

    if (result?.error) {
      toast({ title: "Login Failed", description: "Invalid email or password.", variant: "destructive" })
    } else {
      const callbackUrl = searchParams?.get("callbackUrl") || "/"
      router.push(callbackUrl)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-lg space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-purple-900">Achyutam Fruitam</h1>
          <p className="text-sm text-purple-600 mt-1">Sign in to continue</p>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            DB: {process.env.NEXT_PUBLIC_DB_HINT ?? "unknown"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  )
}
