import { NextRequest, NextResponse } from "next/server";
import { CpqApiError, getAdminCredentials, uploadOptionModel } from "@/lib/cpq-api";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const runtime = "nodejs";

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
    { error: "INTERNAL_ERROR", message: "Unable to upload the model file" },
    { status: 500 }
  );
};

export async function POST(request: NextRequest) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Expected multipart/form-data body" },
      { status: 400 }
    );
  }

  const fieldKey = String(formData.get("fieldKey") ?? "").trim();
  const optionValue = String(formData.get("optionValue") ?? "").trim();

  if (!fieldKey || !optionValue) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "fieldKey and optionValue are required" },
      { status: 400 }
    );
  }

  const entry = formData.get("file");
  const file = entry instanceof File ? entry : null;

  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "A .glb file is required" },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith(".glb")) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Only .glb files are supported" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "File exceeds the 100MB limit" },
      { status: 400 }
    );
  }

  try {
    const catalog = await uploadOptionModel(
      fieldKey,
      optionValue,
      file,
      getAdminCredentials()
    );
    return NextResponse.json(catalog);
  } catch (error) {
    return toErrorResponse(error);
  }
}
