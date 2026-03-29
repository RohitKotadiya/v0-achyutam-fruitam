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
      where.createdAt.gte = new Date(searchParams.get("from")!);
    }
    if (searchParams.get("to")) {
      where.createdAt = where.createdAt || {};
      // Set to end of day
      const toDate = new Date(searchParams.get("to")!);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
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

    return NextResponse.json({ adjustments, total });
  } catch (error) {
    console.error("CashAdjustment fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch adjustments" },
      { status: 500 }
    );
  }
}