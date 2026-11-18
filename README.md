# QuoteLane Auto Insurance Lead Funnel

A high-converting, resilient auto insurance lead generation funnel and backend engine built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Drizzle ORM** (targeting **Supabase Postgres**).

---

## Part 1: Build, Testing, Architecture & Decisions

### 1. How to Run and Test Each Part

#### Prerequisites
- Node.js 18+ (tested on Node v24)
- npm

#### Setup & Environment Configuration
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env.local
   ```
4. Configure your `.env.local`:
   - `DATABASE_URL`: Your Supabase Postgres connection string (e.g. Transaction Pooler or direct URI).
   - `PARTNER_WEBHOOK_URL`: Your lead buyer endpoint. For local verification, obtain a free endpoint at [webhook.site](https://webhook.site).
   - `SPLIT_PERCENT_B`: Percentage (0 to 100) of new visitors allocated to Variant B.

5. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

#### Testing Scenarios

- **Testing Variant A vs Variant B**:
  - Force Variant A: `http://localhost:3000/?variant=a` (full multi-step flow: ZIP, vehicle year, make, insured, age, contact).
  - Force Variant B: `http://localhost:3000/?variant=b` (shortened flow: ZIP, insured, contact).
  - Stickiness test: Visit `http://localhost:3000`. Reload or revisit later without the query string; your assigned variant remains sticky via the `ql_variant` cookie.
- **Testing Prepop (URL Prefilling) & Address Bar Sanitization**:
  - Visit:
    ```
    http://localhost:3000/?click_id=test_123&aff_id=42&channel=email&zip=90210&first_name=Alex&email=alex%40example.com&phone=5551234567&insured=yes&year={sub5}
    ```
  - **Notice**:
    1. Unreplaced macro `{sub5}` is cleanly ignored and dropped.
    2. Since ZIP, insured, and contact are prefilled, the visitor lands directly on the contact step with editable fields.
    3. PII (`first_name`, `email`, `phone`) is immediately stripped from the browser address bar via `window.history.replaceState`, preventing leakage in logs or referrers.
    4. Tracking attributes (`click_id`, `aff_id`, `channel`) survive the entire lifecycle and are saved with the lead.
- **Testing Server Validation & Duplicate Prevention**:
  - Submit a lead with an email and phone.
  - Attempt submitting the same lead again: HTTP 409 Conflict is returned ("A quote request with this email or phone number was already submitted within the last 24 hours").
- **Testing Partner Webhook Forwarding**:
  - Check your [webhook.site](https://webhook.site) URL. Upon submission, the JSON payload containing contact info, vehicle details, tracking params (`click_id`, `aff_id`, `channel`), and timestamps arrives.
  - Delivery is asynchronous with timeouts (3.5s) and a single retry, ensuring the consumer immediately sees the thank-you screen without latency.

---

### 2. Design Decisions & Trade-Offs

- **Drizzle ORM vs. Heavy Engines (like Prisma)**:
  - *Decision*: Adopted Drizzle ORM over Prisma.
  - *Reasoning*: Prisma requires external Rust engine binaries that often fail in restricted environments, Windows PowerShell, or edge deployments. Drizzle is zero-binary, pure TypeScript, produces zero runtime overhead, and communicates with Supabase/Postgres natively.
- **Asynchronous Partner Dispatch**:
  - *Decision*: Leads are recorded and validated first in the database, returning an instant response to the client while partner delivery executes in the background.
  - *Trade-off*: The customer never suffers from slow third-party partner response times. If the partner times out or fails twice, the failure reason is preserved in the database for batch reconciliation.
- **Double-Submit & Idempotency Safeguards**:
  - *Decision*: A submission lock and database check prevent duplicate partner dispatches on double clicks.
- **Mobile-First Touch Target Design**:
  - *Decision*: Large selection tiles (for vehicle years, popular makes, and insurance status) ensure high conversion on mobile devices where typing is friction-heavy.

---

### 3. Prepop Sanitation & PII Leakage Protection

- **Macro Rejection**: Unreplaced tracking macros such as `{sub5}`, `{aff_sub5}`, `[EMAIL]`, `%%email%%`, and `{replace_it}` are caught using regular expression pattern matching and discarded.
- **Normalization**: URL-encoded values (`sam%40example.com`), spaced numbers (`+1 (555) 123-4567`), and padded inputs are decoded, trimmed, and formatted into clean 10-digit US phone numbers and valid emails.
- **Browser History Sanitation**: As soon as the client reads URL query parameters into state, `window.history.replaceState` purges `first_name`, `email`, and `phone` from `window.location.search`. This prevents PII from leaking into:
  - Browser history
  - Subsequent third-party analytics tracking tags (e.g. Google Analytics / Meta Pixel)
  - `Referer` request headers when clicking external links.
- **Distinction Between Prefilled and Typed Data**: The `prefilled_fields` JSON column logs exactly which values came prefilled from the link versus those entered by the user.

---

### 4. What Would Change Before Sending Real Traffic (Production Hardening)

1. **Distributed Rate Limiting with Redis / Upstash**: Replace the in-memory sliding-window limiter with an Upstash Redis store so limits apply across distributed serverless edge regions.
2. **Persistent Job Queue (e.g. BullMQ / QStash)**: Forwarding leads to partners through a durable message queue guarantees at-least-once delivery with exponential backoff and dead-letter queues.
3. **Lookup APIs for VIN / Vehicle Data**: Integrate NHTSA or Edmunds APIs to validate exact Make/Model/Trim according to year.
4. **Phone & Address Verification APIs**: Integrate services like Twilio Lookup or USPS Address API to check line type (wireless vs landline) and physical address validity before dispatching.
5. **Enhanced Consent Auditing (Jornaya / TrustedForm)**: Include TCPA lead certificates (e.g., Jornaya LeadID or ActiveProspect TrustedForm tokens) to provide compliance proof.

---

## Part 2: Short Written Answers

### a. What is a click ID, and why does it need to survive the whole journey?
A click ID is a unique pseudorandom token generated by an ad network or affiliate tracking system (e.g., Google `gclid`, Facebook `fbclid`, or affiliate network `click_id`) when a user clicks an ad. It must survive the entire funnel journey because when that visitor converts, the click ID is passed back to the partner or tracking platform in the conversion postback. Without it, the source cannot attribute which campaign, keyword, or affiliate generated the conversion, resulting in lost revenue attribution and unoptimized ad spend.

### b. How a server-to-server postback lets us and the affiliate get credit step-by-step
1. **Click & Capture**: A visitor clicks an affiliate link with affiliate tracking parameters (e.g. `aff_id=42&click_id=abc123`). We assign an internal transaction ID and store both with the lead.
2. **Lead Dispatch**: We forward the lead along with our tracking ID to the buyer/partner via server-to-server API.
3. **Downstream Sale**: The buyer closes the insurance policy days or weeks later in their CRM.
4. **Partner Postback**: The buyer's server triggers an HTTP GET/POST webhook (postback) to our server containing our internal transaction ID and sale payout amount.
5. **Affiliate Credit**: Our server looks up the original lead, matches `aff_id=42` and `click_id=abc123`, records the conversion, and automatically fires an outbound server-to-server postback to that affiliate network's postback URL crediting them for the commission.

### c. Difference between a server-to-server postback and a tracking pixel? When to use each?
- **Tracking Pixel**: An image tag or JavaScript snippet loaded client-side in the user's browser (e.g., Meta Pixel). It relies on browser cookies and third-party context.
  - *Use Case*: Immediate front-end actions like page views, add-to-cart, or retargeting audiences.
  - *Weakness*: Vulnerable to ad blockers, browser tracking prevention (Safari ITP), and user cookie clearing.
- **Server-to-Server (S2S) Postback**: A direct backend HTTP call between two servers transferring conversion data with a click ID.
  - *Use Case*: Downstream sales, offline conversions, subscription rebills, financial transactions, and affiliate networks.
  - *Advantage*: 100% immune to ad blockers, cookie policies, and browser closures.

### d. An advertiser fires a test conversion but it doesn't show up in our tracker. What to check in order:
1. **Server Logs & Ingress Webhook**: Check application access logs and reverse proxy logs (Vercel/Cloudflare) to see if the HTTP request actually reached our server or was blocked by firewall/WAF.
2. **HTTP Response Status**: Check what HTTP status code our server returned to the advertiser (e.g., 200 OK vs 400 Bad Request, 404, or 422).
3. **Payload Structure & Parameter Names**: Verify that the advertiser passed the expected query or JSON parameters (e.g., `click_id` vs `clickid` or `sub_id`).
4. **Click ID Validity in Database**: Check whether the click ID provided by the advertiser exists in our database or if it was truncated, invalid, or expired.
5. **Deduplication / Idempotency Filters**: Check if our tracker rejected the conversion because that transaction or click ID was already marked as converted.
6. **Timezone & Reporting Delay**: Check if the reporting dashboard has an asynchronous ingestion delay or timezone filter discrepancy.

### e. Why does an affiliate's own click ID need to be stored separately from ours?
An affiliate network assigns its own internal tracking token (the affiliate click ID) to correlate clicks with their own publishers and sub-affiliates. We also generate our own unique internal transaction/lead ID to index and track the lead within our database and partner dispatch pipelines. 
Storing them separately prevents namespace collisions, enables bidirectional postbacks (allowing us to report back to the affiliate using their key while querying our internal records with our key), and supports integrations with multiple aggregators simultaneously.

---

## Part 3: Judgment Calls

### f. Kill switch vs sticky: SPLIT_PERCENT_B is set to 0 (or 100). Should visitors keep their version or follow the new setting?
- **Decision**: 
  - When `SPLIT_PERCENT_B` is between `1` and `99`, visitor stickiness is strictly preserved (existing cookies retain their variant).
  - When `SPLIT_PERCENT_B` is set to `0` or `100`, it acts as an **authoritative kill-switch or rollout winner**: our middleware overrides existing sticky cookies and routes **everyone** to the chosen variant.
- **Why & Trade-off**: If an experiment concludes or Variant B exhibits a critical bug in production, preserving stickiness would leave affected returning users stuck on a broken or deprecated form. The trade-off is that in-flight A/B test purity is sacrificed during a hard reset, which is the correct business decision when stability or decisive rollouts are required.

### g. Testing on production: seeing Variant B without affecting anyone else or getting stuck on B
- **Decision**: The middleware supports forced overrides using `?variant=b` (or `?variant=a`). When the forced query parameter is detected:
  - The middleware routes the request directly to that variant for that single request.
  - **Crucially, the middleware does NOT write or update the persistent `ql_variant` cookie when `?variant=` is present.**
- **Why & Trade-off**: QA engineers, partners, and internal testers can inspect either variant in production without modifying their personal persistent cookies and without polluting the baseline split ratio for real visitors.

### h. Missing config: traffic arrives with channel=sms, but there's no SMS-specific partner setup or ID configured
- **Decision**: The lead is **not blocked or dropped**. The visitor completes the standard funnel, and the lead is saved to the database with `channel=sms` intact alongside all tracking parameters. The lead is routed to the default auto insurance partner endpoint or placed in an unassigned partner queue.
- **Why & Trade-off**: The primary directive in performance marketing is never to throw away paid user intent. Traffic acquisition money was already spent. Preserving the lead in the database allows ad-ops and business development to monetize the lead via secondary distribution or backfills, while retaining granular channel reporting.

### i. Two brands, one partner: launching a second brand with the same partner account and fixed tracking fields
- **Decision**:
  - **In our internal database**: We store `brand="BrandA"` vs `brand="BrandB"` in a dedicated column along with the respective landing domain and consent record.
  - **In the partner's fixed fields**: If the partner only accepts a fixed set of tracking parameters (e.g. `aff_id` and `sub_id`), we use namespaced prefixes or composite identifiers (e.g. `aff_id="BRAND1_42"` vs `aff_id="BRAND2_42"`, or prefixing `channel` / `sub_id` with `b1_` and `b2_`). Alternatively, if a campaign/creative ID field is available, we map the brand ID there.
- **Why & Trade-off**: We preserve end-to-end reporting transparency internally while remaining fully compliant with the partner's strict API schema.
