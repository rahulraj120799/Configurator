import { NextRequest, NextResponse } from "next/server";
import {
  CpqApiError,
  fetchQuotes,
  getAdminCredentials,
} from "@/lib/cpq-api";

const toPositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export async function GET(request: NextRequest) {
  const page = toPositiveInteger(request.nextUrl.searchParams.get("page"), 0);
  const size = Math.min(
    toPositiveInteger(request.nextUrl.searchParams.get("size"), 100),
    100
  );

  try {
    const quotes = await fetchQuotes({ page, size }, getAdminCredentials());
    return NextResponse.json(quotes);
  } catch (error) {
    if (error instanceof CpqApiError) {
      return NextResponse.json(
        {
          error: error.error,
          message: error.message,
          details: error.details,
          requestId: error.requestId,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Unable to load quote history" },
      { status: 500 }
    );
  }
}