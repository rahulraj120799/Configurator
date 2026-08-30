import { NextResponse } from "next/server";
import { CpqApiError, deactivateAdminUser, getAdminCredentials } from "@/lib/cpq-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const id = Number((await params).id);

  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Invalid user id" }, { status: 400 });
  }

  try {
    const result = await deactivateAdminUser(id, getAdminCredentials());
    return result === undefined ? new NextResponse(null, { status: 204 }) : NextResponse.json(result);
  } catch (error) {
    if (error instanceof CpqApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message, details: error.details, requestId: error.requestId },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Unable to deactivate user" },
      { status: 500 }
    );
  }
}