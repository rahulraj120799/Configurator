import "server-only";

import { Resend } from "resend";
import type { QuoteDto, SubmitQuotePayload } from "@/lib/cpq-api";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatLabel = (fieldKey: string) =>
  fieldKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());

const formatSelection = (value: unknown) => {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value ?? "");
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);

export async function sendQuoteEmail(
  customer: SubmitQuotePayload["customer"],
  selections: SubmitQuotePayload["config"]["selections"],
  quote: QuoteDto
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "RESEND_API_KEY and RESEND_FROM_EMAIL environment variables are required"
    );
  }
  console.log({ apiKey, from }, "Sending quote email with Resend API");
  console.log("Sending quote email to:", customer.email);

  const selectionRows = Object.entries(selections)
    .filter(([, value]) => value !== "" && value !== null && value !== false)
    .map(
      ([fieldKey, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;">${escapeHtml(
            formatLabel(fieldKey)
          )}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;text-align:right;">${escapeHtml(
            formatSelection(value)
          )}</td>
        </tr>`
    )
    .join("");
    console.log("Selection rows for email:", selectionRows);

  const total = formatMoney(quote.totalPrice, quote.currency);
  console.log("Total price for email:", total);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: customer.email,
    subject: `Your trailer quote ${quote.quoteNumber}`,
    html: `
      <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="background:#1d4ed8;padding:24px;color:#ffffff;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Trailer Configurator</p>
            <h1 style="margin:0;font-size:24px;">Quote ${escapeHtml(
              quote.quoteNumber
            )}</h1>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 20px;">Hi ${escapeHtml(
              customer.fullName
            )},</p>
            <p style="margin:0 0 20px;color:#475569;">Here are the details for your ${escapeHtml(
              quote.bodyType
            )} configuration.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tbody>${selectionRows}</tbody>
            </table>
            <div style="margin-top:24px;padding:18px;background:#eff6ff;border-radius:8px;">
              <span style="color:#475569;">Total price</span>
              <strong style="float:right;font-size:20px;color:#1d4ed8;">${escapeHtml(
                total
              )}</strong>
            </div>
            <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Status: ${escapeHtml(
              quote.status
            )}</p>
          </div>
        </div>
      </div>`,
  });
  console.log("Resend API response:", { error });

  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }
}
