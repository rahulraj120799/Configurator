import { NextRequest, NextResponse } from "next/server";
import {
  CpqApiError,
  fetchCatalog,
  getAdminCredentials,
  getEmployeeCredentials,
  updateCatalog,
} from "@/lib/cpq-api";
import type {
  AdminFieldConfig,
  AdminRuleConfig,
  AdminTabConfig,
} from "@/lib/schema";

type AdminConfigPayload = {
  tabsJson: AdminTabConfig[];
  fieldsJson: AdminFieldConfig[];
  rulesJson: AdminRuleConfig[];
  configName?: string;
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
    { error: "INTERNAL_ERROR", message: "Unexpected server error" },
    { status: 500 }
  );
};

export async function GET() {
  try {
    const catalog = await fetchCatalog(getEmployeeCredentials());
    return NextResponse.json(catalog);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Partial<AdminConfigPayload>;

  if (!Array.isArray(body.tabsJson)) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "tabsJson must be an array" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.fieldsJson)) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "fieldsJson must be an array" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.rulesJson)) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "rulesJson must be an array" },
      { status: 400 }
    );
  }

  try {
    const updated = await updateCatalog(
      {
        configName: body.configName,
        tabsJson: body.tabsJson,
        fieldsJson: body.fieldsJson,
        rulesJson: body.rulesJson,
      },
      getAdminCredentials()
    );
    return NextResponse.json(updated);
  } catch (error) {
    return toErrorResponse(error);
  }
}
