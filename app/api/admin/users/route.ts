import { NextRequest, NextResponse } from "next/server";
import {
  CpqApiError,
  createAdminUser,
  deactivateAdminUser,
  fetchAdminUsers,
  getAdminCredentials,
  updateAdminUser,
  updateAdminUserRole,
  type CreateAdminUserInput,
  type UpdateAdminUserInput,
  type UserRole,
} from "@/lib/cpq-api";

const roles: UserRole[] = ["ADMIN", "EMPLOYEE", "SALESPERSON"];

const toPositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const toErrorResponse = (error: unknown) => {
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
    { error: "INTERNAL_ERROR", message: "Unable to manage users" },
    { status: 500 }
  );
};

export async function GET(request: NextRequest) {
  const page = toPositiveInteger(request.nextUrl.searchParams.get("page"), 0);
  const size = Math.min(
    Math.max(toPositiveInteger(request.nextUrl.searchParams.get("size"), 100), 1),
    100
  );

  try {
    return NextResponse.json(
      await fetchAdminUsers({ page, size }, getAdminCredentials())
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateAdminUserInput;

  try {
    return NextResponse.json(
      await createAdminUser(body, getAdminCredentials()),
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as UpdateAdminUserInput & {
    id?: number;
    role?: UserRole;
  };
  const id = Number(body.id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "A valid user id is required" },
      { status: 400 }
    );
  }

  const payload: UpdateAdminUserInput = {
    email: body.email,
    fullName: body.fullName,
  };
  const nextRole = body.role;

  if (!payload.email && !payload.fullName && !nextRole) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Provide an email, full name, or role" },
      { status: 400 }
    );
  }

  if (nextRole && !roles.includes(nextRole)) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Invalid role" },
      { status: 400 }
    );
  }

  try {
    const credentials = getAdminCredentials();
    let updated =
      payload.email || payload.fullName
        ? await updateAdminUser(id, payload, credentials)
        : null;

    if (nextRole) {
      updated = await updateAdminUserRole(id, nextRole, credentials);
    }

    return NextResponse.json(updated);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "A valid user id is required" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await deactivateAdminUser(id, getAdminCredentials())
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}