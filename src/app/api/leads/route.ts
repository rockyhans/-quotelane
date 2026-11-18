import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseTables } from "@/db";
import { leads } from "@/db/schema";
import {
  validateZip,
  validateEmail,
  validatePhone,
  validateName,
  validateVehicleYear,
  validateVehicleMake,
  validateAgeRange,
} from "@/lib/prepop";
import { MANDATORY_CONSENT_TEXT } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rateLimit";
import { forwardLeadToPartner } from "@/lib/partner";
import { and, gte, eq, or } from "drizzle-orm";

export async function POST(request: NextRequest) {
  // 1. Extract IP and User Agent strictly from the server request
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // 2. Rate limiting check per IP
  const rateLimit = checkRateLimit(ipAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few moments." },
      { status: 429 }
    );
  }

  // 3. Parse JSON payload
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const {
    variant = "A",
    zip,
    vehicleYear,
    vehicleMake,
    insured,
    ageRange,
    firstName,
    lastName,
    email,
    phone,
    prefilledFields = [],
    consentText,
    tracking = {},
    pageUrl = "",
  } = body;

  // 4. Strict Server-side Validation
  const errors: Record<string, string> = {};

  const cleanZip = validateZip(zip);
  if (!cleanZip) errors.zip = "A valid 5-digit US ZIP code is required.";

  const cleanFirstName = validateName(firstName);
  if (!cleanFirstName) errors.firstName = "Please provide your first name.";

  const cleanLastName = validateName(lastName);
  if (!cleanLastName) errors.lastName = "Please provide your last name.";

  const cleanEmail = validateEmail(email);
  if (!cleanEmail) errors.email = "Please provide a valid email address.";

  const cleanPhone = validatePhone(phone);
  if (!cleanPhone) errors.phone = "Please enter a valid 10-digit US phone number.";

  // Additional validations for Variant A
  let cleanYear: string | null = null;
  let cleanMake: string | null = null;
  let cleanAge: string | null = null;

  if (variant === "A") {
    cleanYear = validateVehicleYear(vehicleYear);
    if (!cleanYear) errors.vehicleYear = "Please select a valid vehicle year.";

    cleanMake = validateVehicleMake(vehicleMake);
    if (!cleanMake) errors.vehicleMake = "Please specify your vehicle make.";

    cleanAge = validateAgeRange(ageRange);
    if (!cleanAge) errors.ageRange = "Please select your age range.";
  }

  // Insured boolean check (required on both A and B)
  if (insured === undefined || insured === null || typeof insured !== "boolean") {
    errors.insured = "Please indicate if you are currently insured.";
  }

  // Consent validation
  if (!consentText || !consentText.includes("By clicking Get My Quotes")) {
    errors.consent = "Valid TCPA consent agreement is mandatory.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 422 });
  }

  // Ensure DB tables exist
  await ensureDatabaseTables();

  // 5. Duplicate Check: same email or phone within 24 hours
  if (db) {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const existingDuplicate = await db
        .select({ id: leads.id, email: leads.email, phone: leads.phone })
        .from(leads)
        .where(
          and(
            gte(leads.createdAt, twentyFourHoursAgo),
            or(eq(leads.email, cleanEmail!), eq(leads.phone, cleanPhone!))
          )
        )
        .limit(1);

      if (existingDuplicate.length > 0) {
        return NextResponse.json(
          {
            error: "A quote request with this email or phone number was already submitted within the last 24 hours.",
            code: "DUPLICATE_LEAD",
          },
          { status: 409 }
        );
      }
    } catch (dbErr) {
      console.error("Duplicate check query failed:", dbErr);
    }
  }

  // 6. Save Lead and Consent Record
  let savedLeadId = Math.floor(Math.random() * 1000000);

  if (db) {
    try {
      const [inserted] = await db
        .insert(leads)
        .values({
          variant,
          clickId: tracking.click_id || null,
          affId: tracking.aff_id || null,
          channel: tracking.channel || null,
          rawQueryParams: tracking,
          zip: cleanZip!,
          vehicleYear: cleanYear || vehicleYear || null,
          vehicleMake: cleanMake || vehicleMake || null,
          insured: !!insured,
          ageRange: cleanAge || ageRange || null,
          firstName: cleanFirstName!,
          lastName: cleanLastName!,
          email: cleanEmail!,
          phone: cleanPhone!,
          prefilledFields: Array.isArray(prefilledFields) ? prefilledFields : [],
          consentText: MANDATORY_CONSENT_TEXT,
          consentGiven: true,
          consentTimestamp: new Date(),
          ipAddress,
          userAgent,
          pageUrl: pageUrl || "https://quotelane.com",
          partnerSent: false,
        })
        .returning({ id: leads.id });

      if (inserted?.id) {
        savedLeadId = inserted.id;
      }
    } catch (insertErr) {
      console.error("Failed to insert lead into database:", insertErr);
      return NextResponse.json(
        { error: "Internal server error saving lead record." },
        { status: 500 }
      );
    }
  }

  // 7. Send Lead to Partner Asynchronously (Requirement: Visitor gets thank-you page fast)
  const partnerPayload = {
    click_id: tracking.click_id,
    aff_id: tracking.aff_id,
    channel: tracking.channel,
    lead_id: savedLeadId,
    zip: cleanZip!,
    first_name: cleanFirstName!,
    last_name: cleanLastName!,
    email: cleanEmail!,
    phone: cleanPhone!,
    insured: insured,
    vehicle_year: cleanYear || vehicleYear || null,
    vehicle_make: cleanMake || vehicleMake || null,
    age_range: cleanAge || ageRange || null,
    variant,
    created_at: new Date().toISOString(),
  };

  // Background dispatch without awaiting so customer response is immediate
  forwardLeadToPartner(savedLeadId, partnerPayload).catch((err) => {
    console.error("Background partner dispatch error:", err);
  });

  return NextResponse.json({
    success: true,
    leadId: savedLeadId,
    message: "Lead received and processed successfully.",
  });
}

