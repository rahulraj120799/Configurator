import { db } from "@/lib/db";
import { trailerConfigs } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const configs = await db
    .select()
    .from(trailerConfigs)
    .orderBy(desc(trailerConfigs.createdAt));
  return NextResponse.json(configs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bodyType, config, totalPrice } = body;

  if (!bodyType || !config) {
    return NextResponse.json(
      { error: "bodyType and config are required" },
      { status: 400 }
    );
  }

  const [saved] = await db
    .insert(trailerConfigs)
    .values({ bodyType, config, totalPrice: String(totalPrice) })
    .returning();

  return NextResponse.json(saved, { status: 201 });
}
