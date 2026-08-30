import type {
  AdminFieldConfig,
  AdminRuleConfig,
  AdminTabConfig,
} from "@/lib/schema";

export type CatalogConfigDto = {
  id: number;
  configName: string;
  schemaVersion: number;
  tabsJson: AdminTabConfig[];
  fieldsJson: AdminFieldConfig[];
  rulesJson: AdminRuleConfig[];
  isActive: boolean;
  updatedBy: string | null;
  updatedAt: string;
};

export type CatalogConfigInput = {
  configName?: string;
  tabsJson: AdminTabConfig[];
  fieldsJson: AdminFieldConfig[];
  rulesJson: AdminRuleConfig[];
};

export type QuoteCustomer = {
  fullName: string;
  email: string;
};

export type SubmitQuotePayload = {
  bodyType: string;
  config: {
    schemaVersion: number | null;
    selections: Record<string, unknown>;
  };
  customer: QuoteCustomer;
};

export type QuoteDto = {
  id: number;
  quoteNumber: string;
  bodyType: string;
  config: unknown;
  totalPrice: number;
  currency: string;
  status: string;
};

export type PagedQuotes = {
  content: QuoteHistoryItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type UserRole = "ADMIN" | "EMPLOYEE" | "SALESPERSON";

export type AdminUserDto = {
  id: number;
  email: string;
  role: UserRole;
  fullName: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
};

export type PagedAdminUsers = {
  content: AdminUserDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type CreateAdminUserInput = {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
};

export type UpdateAdminUserInput = {
  email?: string;
  fullName?: string;
};

export type QuoteHistoryItem = {
  id: number;
  quoteNumber: string;
  customerEmail: string;
  customerName: string;
  productSlug: string;
  productName: string;
  basePrice: number;
  discount: number;
  totalPrice: number;
  currency: string;
  status: string;
  submission: SubmitQuotePayload;
  createdAt: string;
};

type BasicAuthCredentials = {
  username: string;
  password: string;
};

export class CpqApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly details: string[];
  readonly requestId: string | undefined;

  constructor(
    status: number,
    error: string,
    message: string,
    details: string[] = [],
    requestId?: string
  ) {
    super(message);
    this.name = "CpqApiError";
    this.status = status;
    this.error = error;
    this.details = details;
    this.requestId = requestId;
  }
}

const getBaseUrl = () => {
  const baseUrl = process.env.CPQ_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("CPQ_API_BASE_URL environment variable is not set");
  }

  return baseUrl.replace(/\/$/, "");
};

const buildAuthHeader = (credentials: BasicAuthCredentials): string =>
  `Basic ${Buffer.from(
    `${credentials.username}:${credentials.password}`
  ).toString("base64")}`;

export const getEmployeeCredentials = (): BasicAuthCredentials => {
  const username = process.env.CPQ_EMPLOYEE_USERNAME;
  const password = process.env.CPQ_EMPLOYEE_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "CPQ_EMPLOYEE_USERNAME / CPQ_EMPLOYEE_PASSWORD environment variables are not set"
    );
  }

  return { username, password };
};

export const getAdminCredentials = (): BasicAuthCredentials => {
  const username = process.env.CPQ_ADMIN_USERNAME;
  const password = process.env.CPQ_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "CPQ_ADMIN_USERNAME / CPQ_ADMIN_PASSWORD environment variables are not set"
    );
  }

  return { username, password };
};

type CpqFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  credentials?: BasicAuthCredentials;
  headers?: Record<string, string>;
};

/** Reusable low-level client for the CPQ Java backend; throws CpqApiError on non-2xx responses. */
async function cpqFetch<T>(
  path: string,
  { method = "GET", body, credentials, headers }: CpqFetchOptions = {}
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (credentials) {
    requestHeaders.Authorization = buildAuthHeader(credentials);
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const shape = payload as {
      error?: string;
      message?: string;
      details?: string[];
      requestId?: string;
    } | null;

    throw new CpqApiError(
      response.status,
      shape?.error ?? "UNKNOWN_ERROR",
      shape?.message ?? "The CPQ API request failed",
      shape?.details ?? [],
      shape?.requestId
    );
  }

  return payload as T;
}

export function fetchCatalog(
  credentials: BasicAuthCredentials
): Promise<CatalogConfigDto> {
  return cpqFetch<CatalogConfigDto>("/api/admin/catalog", { credentials });
}

export function updateCatalog(
  payload: CatalogConfigInput,
  credentials: BasicAuthCredentials
): Promise<CatalogConfigDto> {
  return cpqFetch<CatalogConfigDto>("/api/admin/catalog", {
    method: "PUT",
    body: payload,
    credentials,
  });
}

export async function uploadOptionModel(
  fieldKey: string,
  optionValue: string,
  file: File,
  credentials: BasicAuthCredentials
): Promise<CatalogConfigDto> {
  const url = `${getBaseUrl()}/api/admin/catalog/fields/${encodeURIComponent(
    fieldKey
  )}/options/${encodeURIComponent(optionValue)}/model`;

  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: buildAuthHeader(credentials),
    },
    body: formData,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const shape = payload as {
      error?: string;
      message?: string;
      details?: string[];
      requestId?: string;
    } | null;

    throw new CpqApiError(
      response.status,
      shape?.error ?? "UNKNOWN_ERROR",
      shape?.message ?? "Failed to upload the model file",
      shape?.details ?? [],
      shape?.requestId
    );
  }

  return payload as CatalogConfigDto;
}

export function submitQuote(
  payload: SubmitQuotePayload,
  idempotencyKey?: string
): Promise<QuoteDto> {
  return cpqFetch<QuoteDto>("/api/quotes", {
    method: "POST",
    body: payload,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function fetchQuotes(
  { page = 0, size = 20 }: { page?: number; size?: number },
  credentials: BasicAuthCredentials
): Promise<PagedQuotes> {
  return cpqFetch<PagedQuotes>(
    `/api/admin/quotes?page=${page}&size=${size}`,
    { credentials }
  );
}

export function fetchAdminUsers(
  { page = 0, size = 100 }: { page?: number; size?: number },
  credentials: BasicAuthCredentials
): Promise<PagedAdminUsers> {
  return cpqFetch<PagedAdminUsers>(
    `/api/admin/users?page=${page}&size=${size}`,
    { credentials }
  );
}

export function createAdminUser(
  payload: CreateAdminUserInput,
  credentials: BasicAuthCredentials
): Promise<AdminUserDto> {
  return cpqFetch<AdminUserDto>("/api/admin/users", {
    method: "POST",
    body: payload,
    credentials,
  });
}

export function updateAdminUser(
  id: number,
  payload: UpdateAdminUserInput,
  credentials: BasicAuthCredentials
): Promise<AdminUserDto> {
  return cpqFetch<AdminUserDto>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: payload,
    credentials,
  });
}

export function updateAdminUserRole(
  id: number,
  role: UserRole,
  credentials: BasicAuthCredentials
): Promise<AdminUserDto> {
  return cpqFetch<AdminUserDto>(`/api/admin/users/${id}/role`, {
    method: "PUT",
    body: { role },
    credentials,
  });
}

export function deactivateAdminUser(
  id: number,
  credentials: BasicAuthCredentials
): Promise<AdminUserDto> {
  return cpqFetch<AdminUserDto>(`/api/admin/users/${id}/deactivate`, {
    method: "POST",
    credentials,
  });
}

export function activateAdminUser(
  id: number,
  credentials: BasicAuthCredentials
): Promise<AdminUserDto> {
  return cpqFetch<AdminUserDto>(`/api/admin/users/${id}/activate`, {
    method: "POST",
    credentials,
  });
}
