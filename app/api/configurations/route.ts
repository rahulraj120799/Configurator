import { NextRequest, NextResponse } from "next/server";
import { CpqApiError, submitQuote } from "@/lib/cpq-api";
import { sendQuoteEmail } from "@/lib/quote-email";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bodyType, config, customer } = body;

  if (!bodyType || !config) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "bodyType and config are required" },
      { status: 400 }
    );
  }

  if (!customer?.fullName || !customer?.email) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "customer.fullName and customer.email are required",
      },
      { status: 400 }
    );
  }

  try {
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    const quote = await submitQuote(
      { bodyType, config, customer },
      idempotencyKey
    );

    try {
      await sendQuoteEmail(customer, config.selections, quote);
      return NextResponse.json({ ...quote, emailSent: true }, { status: 201 });
    } catch (emailError) {
      console.error("Quote created, but email delivery failed", emailError);
      return NextResponse.json(
        {
          ...quote,
          emailSent: false,
          emailMessage:
            "Quote created successfully, but the email could not be sent.",
        },
        { status: 201 }
      );
    }
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
      { error: "INTERNAL_ERROR", message: "Unexpected server error" },
      { status: 500 }
    );
  }
}

