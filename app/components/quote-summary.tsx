"use client";

import { ArrowLeft, Check, CircleAlert, X } from "lucide-react";

export type QuoteLineItem = {
  fieldKey: string;
  label: string;
  value: string;
  price?: number;
};

export type QuoteGroup = {
  groupKey: string;
  label: string;
  items: QuoteLineItem[];
};

export type QuoteSummaryProps = {
  bodyType?: string;
  totalPrice: number;
  groups: QuoteGroup[];
  quoteNumber?: string;
  customerName?: string;
  recipientEmail?: string;
  createdAt?: string;
  status?: string;
  emailSent?: boolean;
  emailMessage?: string;
  onBack?: () => void;
  onClose?: () => void;
};

const formatCurrency = (value: number): string =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function QuoteSummary({
  bodyType,
  totalPrice,
  groups,
  quoteNumber,
  customerName,
  recipientEmail,
  createdAt,
  status,
  emailSent,
  emailMessage,
  onBack,
  onClose,
}: QuoteSummaryProps) {
  const hasSelections = groups.some((group) => group.items.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
              aria-label="Back to configurator"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quote Details</h1>
            <p className="text-sm text-gray-500">
              {quoteNumber
                ? `${quoteNumber} · ${customerName || recipientEmail || "Customer"}`
                : "Review the configuration you selected below."}
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            aria-label="Close quote"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {typeof emailSent === "boolean" ? (
        <div
          className={`mb-8 flex items-center gap-4 rounded-2xl border px-6 py-5 shadow-sm ${
            emailSent === false
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
            emailSent === false
              ? "bg-amber-500 shadow-[0_8px_18px_rgba(245,158,11,0.3)]"
              : "bg-emerald-500 shadow-[0_8px_18px_rgba(16,185,129,0.35)]"
          }`}
        >
          {emailSent === false ? (
            <CircleAlert className="h-5 w-5" />
          ) : (
            <Check className="h-5 w-5" />
          )}
        </span>
        <div>
          <p
            className={`text-sm font-semibold ${
              emailSent === false ? "text-amber-800" : "text-emerald-800"
            }`}
          >
            {emailSent === false
              ? "Quote created, but email delivery failed"
              : "Quote created and emailed successfully"}
          </p>
          <p
            className={`text-xs ${
              emailSent === false ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {emailSent === false
              ? emailMessage ?? "You can still review your quote below."
              : recipientEmail
              ? `A copy was sent to ${recipientEmail}.`
              : bodyType
              ? `Your ${bodyType} configuration is ready to review.`
              : "Your configuration is ready to review."}
          </p>
        </div>
        </div>
      ) : quoteNumber ? (
        <div className="mb-8 grid gap-4 border-y border-gray-200 bg-white px-1 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Customer</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{customerName || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Email</p>
            <p className="mt-1 break-all text-sm font-semibold text-gray-900">{recipientEmail || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Created</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {createdAt ? new Date(createdAt).toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Status</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{status || "—"}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {hasSelections ? (
            groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div
                  key={group.groupKey}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
                      {group.label}
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.items.map((item) => (
                      <div
                        key={item.fieldKey}
                        className="flex items-center justify-between px-5 py-3.5"
                      >
                        <span className="text-sm text-gray-600">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            {item.value}
                          </span>
                          {item.price ? (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              +{formatCurrency(item.price)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-gray-500">
                No selections were made for this configuration.
              </p>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-blue-900/10 bg-[linear-gradient(160deg,#0b2344_0%,#123c72_45%,#1f5fa8_100%)] p-6 text-white shadow-[0_20px_48px_rgba(15,23,42,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">
              Estimated Total
            </p>
            <p className="mt-3 text-4xl font-bold">
              {formatCurrency(totalPrice)}
            </p>
            {bodyType ? (
              <p className="mt-3 text-xs text-blue-100/75">
                Body Type: <span className="font-semibold">{bodyType}</span>
              </p>
            ) : null}
          </div>

          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Back to Configurator
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
