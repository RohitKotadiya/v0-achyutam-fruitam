import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

// GET /api/products/[id]/image
// Serves the product image. For private Vercel Blob, fetches server-side with token and streams bytes.
// For local paths, redirects directly.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = await prisma.product.findUnique({ where: { id }, select: { imageUrl: true } })
    if (!product?.imageUrl) {
      return new NextResponse("Not found", { status: 404 })
    }

    const { imageUrl } = product

    const canReadPrivateBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

    if (canReadPrivateBlob) {
      const { get } = await import("@vercel/blob")

      // Legacy DB values like /products/<file>.webp: try Blob pathname first.
      if (imageUrl.startsWith("/products/")) {
        const byPath = await get(imageUrl.slice(1), {
          access: "private",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })
        if (byPath?.statusCode === 200) {
          return new NextResponse(byPath.stream, {
            status: 200,
            headers: {
              "Content-Type": byPath.blob.contentType,
              "Cache-Control": "public, max-age=3600",
            },
          })
        }
      }

      // Private blob full URL in DB.
      if (imageUrl.includes("blob.vercel-storage.com")) {
        const byUrl = await get(imageUrl, {
          access: "private",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })
        if (byUrl?.statusCode === 200) {
          return new NextResponse(byUrl.stream, {
            status: 200,
            headers: {
              "Content-Type": byUrl.blob.contentType,
              "Cache-Control": "public, max-age=3600",
            },
          })
        }
        return new NextResponse("Not found", { status: 404 })
      }
    }

    // Local path — redirect directly (local dev / existing public files)
    if (imageUrl.startsWith("/")) {
      return NextResponse.redirect(new URL(imageUrl, _req.url))
    }

    // Fallback: redirect to the URL as-is
    return NextResponse.redirect(imageUrl)
  } catch (error) {
    console.error("Error serving image:", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}

// POST /api/products/[id]/image
// Uploads image. Uses Vercel Blob (private) on serverless, local filesystem in dev.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("image") as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Only JPG, PNG, and WebP images are allowed" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "Image must be under 2MB" }, { status: 400 })
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const fileName = `${id}.${ext}`

    let imageUrl: string

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Vercel serverless: upload as private blob (works with both private and public stores)
      const { put } = await import("@vercel/blob")
      const blob = await put(`products/${fileName}`, file, {
        access: "private",
        contentType: file.type,
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      // Store raw blob URL in DB; served via GET /api/products/[id]/image signed redirect
      imageUrl = blob.url
    } else {
      // Local dev: write to public/products
      const uploadDir = path.join(process.cwd(), "public", "products")
      await mkdir(uploadDir, { recursive: true })
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(path.join(uploadDir, fileName), buffer)
      imageUrl = `/products/${fileName}`
    }

    await prisma.product.update({
      where: { id },
      data: { imageUrl },
    })

    // Return the proxy URL so <img src> always works regardless of store type
    const proxyUrl = process.env.BLOB_READ_WRITE_TOKEN
      ? `/api/products/${id}/image`
      : imageUrl

    return NextResponse.json({ success: true, imageUrl: proxyUrl })
  } catch (error) {
    console.error("Error uploading image:", error)
    return NextResponse.json({ success: false, error: "Failed to upload image" }, { status: 500 })
  }
}
