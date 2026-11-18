import { db, ensureDatabaseTables } from "@/db";
import { leads } from "@/db/schema";
import { eq, or, and, gte } from "drizzle-orm";

interface PartnerPayload {
  click_id?: string;
  aff_id?: string;
  channel?: string;
  lead_id: number;
  zip: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  insured?: boolean | null;
  vehicle_year?: string | null;
  vehicle_make?: string | null;
  age_range?: string | null;
  variant: string;
  created_at: string;
}

/**
 * Sends the lead to the partner webhook with timeout and exactly 1 retry
 * Guarantees that the visitor flow is not blocked by slow or failing partner endpoints
 */
export async function forwardLeadToPartner(leadId: number, payload: PartnerPayload) {
  const partnerUrl = process.env.PARTNER_WEBHOOK_URL;

  if (!partnerUrl) {
    console.warn("PARTNER_WEBHOOK_URL not configured. Skipping partner forwarding.");
    return { success: false, error: "PARTNER_WEBHOOK_URL not set" };
  }

  // Double send guard: ensure we don't send the same lead twice
  if (db) {
    try {
      const existing = await db
        .select({ partnerSent: leads.partnerSent })
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);

      if (existing.length > 0 && existing[0].partnerSent) {
        console.warn(`Lead ${leadId} was already sent to partner. Skipping duplicate dispatch.`);
        return { success: true, message: "Already sent" };
      }
    } catch (e) {
      console.error("Error checking partnerSent flag:", e);
    }
  }

  const sendRequestWithTimeout = async (timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(partnerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "QuoteLane-LeadForwarder/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        body: text.slice(0, 1000), // Cap response body for db storage
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  let partnerSent = false;
  let statusCode = "";
  let responseBody = "";
  let errorMessage = "";

  // Attempt 1 with 3500ms timeout
  try {
    const res1 = await sendRequestWithTimeout(3500);
    statusCode = String(res1.status);
    responseBody = res1.body;
    partnerSent = res1.ok;
    if (!res1.ok) {
      errorMessage = `Partner returned HTTP ${res1.status}`;
    }
  } catch (err1: unknown) {
    errorMessage = (err1 as Error).message || "Attempt 1 failed";
    console.warn(`Partner forward attempt 1 failed for lead ${leadId}: ${errorMessage}. Retrying...`);

    // Retry once if partner fails or times out (Attempt 2 with 4000ms timeout)
    try {
      const res2 = await sendRequestWithTimeout(4000);
      statusCode = String(res2.status);
      responseBody = res2.body;
      partnerSent = res2.ok;
      if (!res2.ok) {
        errorMessage = `Partner retry returned HTTP ${res2.status}`;
      } else {
        errorMessage = ""; // Cleared on retry success
      }
    } catch (err2: unknown) {
      errorMessage = (err2 as Error).message || "Attempt 2 (retry) failed";
      console.error(`Partner forward retry failed for lead ${leadId}: ${errorMessage}`);
    }
  }

  // Update lead status in database
  if (db) {
    try {
      await db
        .update(leads)
        .set({
          partnerSent,
          partnerSentAt: partnerSent ? new Date() : null,
          partnerResponseCode: statusCode || null,
          partnerResponseBody: responseBody || null,
          partnerError: errorMessage || null,
        })
        .where(eq(leads.id, leadId));
    } catch (dbErr) {
      console.error(`Failed to update partner delivery status for lead ${leadId}:`, dbErr);
    }
  }

  return {
    success: partnerSent,
    statusCode,
    error: errorMessage,
  };
}

