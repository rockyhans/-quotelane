import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// Re-use connection in serverless/Node environments
declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: postgres.Sql | undefined;
}

function getPostgresClient() {
  if (!connectionString) {
    return null;
  }
  if (!global._postgresClient) {
    global._postgresClient = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: connectionString.includes("localhost") ? false : "require",
    });
  }
  return global._postgresClient;
}

const client = getPostgresClient();
export const db = client ? drizzle(client, { schema }) : null;

/**
 * Migration helper to ensure table exists in Supabase/Postgres
 */
export async function ensureDatabaseTables() {
  if (!client) {
    console.warn("DATABASE_URL not configured. Running in memory / preview mode.");
    return;
  }

  try {
    await client`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        variant VARCHAR(10) NOT NULL,
        click_id TEXT,
        aff_id TEXT,
        channel TEXT,
        raw_query_params JSONB,
        zip VARCHAR(10) NOT NULL,
        vehicle_year VARCHAR(10),
        vehicle_make TEXT,
        insured BOOLEAN,
        age_range VARCHAR(20),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone VARCHAR(20) NOT NULL,
        prefilled_fields JSONB DEFAULT '[]'::jsonb,
        consent_text TEXT NOT NULL,
        consent_given BOOLEAN DEFAULT TRUE NOT NULL,
        consent_timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        page_url TEXT NOT NULL,
        partner_sent BOOLEAN DEFAULT FALSE NOT NULL,
        partner_sent_at TIMESTAMPTZ,
        partner_response_code TEXT,
        partner_response_body TEXT,
        partner_error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `;
    await client`
      CREATE INDEX IF NOT EXISTS idx_leads_email_created ON leads (email, created_at);
    `;
    await client`
      CREATE INDEX IF NOT EXISTS idx_leads_phone_created ON leads (phone, created_at);
    `;
  } catch (error) {
    console.error("Error ensuring database tables:", error);
  }
}

