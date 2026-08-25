import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAdminConfig, updateAdminConfig } from "@/lib/admin-config";
import type {
  AdminFieldConfig,
  AdminRuleConfig,
  AdminTabConfig,
} from "@/lib/schema";

type AdminConfigPayload = {
  tabsJson: AdminTabConfig[];
  fieldsJson: AdminFieldConfig[];
  rulesJson: AdminRuleConfig[];
  updatedBy?: string | null;
};

const isNonEmptyArray = (value: unknown): value is unknown[] => Array.isArray(value);

export async function GET() {
  const config = await getOrCreateAdminConfig();
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Partial<AdminConfigPayload>;

  if (
    !isNonEmptyArray(body.tabsJson) &&
    !Array.isArray(body.tabsJson)
  ) {
    return NextResponse.json(
      { error: "tabsJson must be an array" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.fieldsJson)) {
    return NextResponse.json(
      { error: "fieldsJson must be an array" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.rulesJson)) {
    return NextResponse.json(
      { error: "rulesJson must be an array" },
      { status: 400 }
    );
  }

  const updated = await updateAdminConfig({
    tabsJson: body.tabsJson,
    fieldsJson: body.fieldsJson,
    rulesJson: body.rulesJson,
    updatedBy: body.updatedBy,
  });

  return NextResponse.json(updated);
}