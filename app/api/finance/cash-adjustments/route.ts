import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Save a cash adjustment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, reason, notes, userId } = body;

    if (!amount || !reason || !notes) {
      return NextResponse.json(
        { error: "amount, reason, and notes are required" },
        { status: 400 }
      );
    }

    const adjustment = await prisma.cashAdjustment.create({
      data: {
        amount,
        reason,
        notes,
        ...(userId ? { userId } : {}),
      },
    });

    return NextResponse.json({ success: true, adjustment });
  } catch (error) {
    console.error("CashAdjustment create error:", error);
    return NextResponse.json(
      { error: "Failed to save adjustment" },
      { status: 500 }
    );
  }
}

// GET - List recent cash adjustments (for admin report)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    let sinceDate: Date | undefined;
    if (since) {
      const d = new Date(since);
      if (!isNaN(d.getTime())) sinceDate = d;
    }

    // Only allow sorting by whitelisted fields
    const allowedSortFields = ["createdAt", "amount", "reason", "notes", "userId"];
    const orderBy: any = allowedSortFields.includes(sortField)
      ? { [sortField]: sortDir }
      : { createdAt: "desc" };

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = sinceDate ? { createdAt: { gte: sinceDate } } : {};
    if (searchParams.get("from")) {
      where.createdAt = where.createdAt || {};
      const fromStr = searchParams.get("from")!;
      const [fy, fm, fd] = fromStr.split("-").map(Number);
      where.createdAt.gte = new Date(Date.UTC(fy, fm - 1, fd) - (5 * 60 + 30) * 60 * 1000);
    }
    if (searchParams.get("to")) {
      where.createdAt = where.createdAt || {};
      const toStr = searchParams.get("to")!;
      const [ty, tm, td] = toStr.split("-").map(Number);
      where.createdAt.lte = new Date(Date.UTC(ty, tm - 1, td) - (5 * 60 + 30) * 60 * 1000 + 24 * 3600000 - 1);
    }
    if (searchParams.get("reason") && searchParams.get("reason") !== "all") {
      where.reason = searchParams.get("reason");
    }
    if (searchParams.get("user") && searchParams.get("user") !== "all") {
      where.userId = searchParams.get("user");
    }

    // Get total count for pagination
    const total = await prisma.cashAdjustment.count({ where });

    const adjustments = await prisma.cashAdjustment.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    });

    // Get all unique reasons for filter dropdown
    const allReasons = await prisma.cashAdjustment.findMany({
      select: { reason: true },
      distinct: ['reason'],
      orderBy: { reason: 'asc' },
    });
    const uniqueReasons = allReasons.map(r => r.reason).filter(Boolean);

    return NextResponse.json({ adjustments, total, reasons: uniqueReasons });
  } catch (error) {
    console.error("CashAdjustment fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch adjustments" },
      { status: 500 }
    );
  }
}