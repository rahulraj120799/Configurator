import { NextRequest, NextResponse } from "next/server";
import {
  CpqApiError,
  getAdminCredentials,
  updateAdminUser,
  type UpdateAdminUserInput,
} from "@/lib/cpq-api";

type RouteContext = { params: Promise<{ id: string }> };

const toErrorResponse = (error: unknown) => {
  if (error instanceof CpqApiError) {
    return NextResponse.json(
      { error: error.error, message: error.message, details: error.details, requestId: error.requestId },
      { status: error.status }
    );
  }

  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Unable to update user" },
    { status: 500 }
  );
};

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const id = Number((await params).id);
  const body = (await request.json()) as UpdateAdminUserInput;
  const payload: UpdateAdminUserInput = {};

  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Invalid user id" }, { status: 400 });
  }

  if (typeof body.email === "string" && body.email.trim()) {
    payload.email = body.email.trim();
  }

  if (typeof body.fullName === "string" && body.fullName.trim()) {
    payload.fullName = body.fullName.trim();
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Provide an email or full name to update" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await updateAdminUser(id, payload, getAdminCredentials()));
  } catch (error) {
    return toErrorResponse(error);
  }
}