# QuoteLane – Auto Insurance Lead Generation Funnel

**Live Demo:** https://quotelane.onrender.com  
**GitHub Repository:** https://github.com/rockyhans/-quotelane

QuoteLane is a mobile-first auto insurance lead-generation application designed to capture, validate, and process insurance quote requests from affiliate traffic. It includes a multi-step quote experience, A/B testing, URL-based prepopulation, affiliate tracking, PostgreSQL lead storage, consent capture, and partner webhook integration.

## Features

- **Multi-Step Quote Form:** A streamlined, responsive quote journey with two form variants.
- **A/B Testing:** Configurable traffic distribution between Variant A and Variant B.
- **Sticky Variant Assignment:** Visitors retain their assigned variant through a cookie.
- **URL Parameter Prepopulation:** Automatically fills supported form fields using URL query parameters.
- **Affiliate Tracking:** Preserves click IDs, affiliate IDs, channels, and other attribution parameters.
- **Macro Handling:** Detects and ignores unresolved affiliate macros and invalid prefill values.
- **Server-Side Validation:** Validates ZIP codes, names, email addresses, phone numbers, vehicle information, and consent.
- **Duplicate Lead Prevention:** Checks for submissions using the same email or phone number within 24 hours.
- **Rate Limiting:** Protects the lead submission endpoint against excessive requests.
- **Consent Capture:** Records consent wording, timestamp, IP address, and user-agent information.
- **PostgreSQL Integration:** Stores lead information and partner delivery status.
- **Partner Webhook Integration:** Forwards submitted leads to a configurable external endpoint.
- **PII URL Cleanup:** Removes personal contact information from the browser address bar after prepopulation.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 |
| Language | TypeScript |
| Frontend | React 19 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Database Provider | Supabase |
| Deployment | Render |
| Integration | REST API / JSON Webhook |

## Project Architecture

The application follows a simple full-stack architecture.

1. **Frontend:** Displays the quote form, handles user interactions, and manages form state.
2. **Middleware:** Handles A/B variant assignment, sticky cookies, and forced variant testing.
3. **API Layer:** Validates submissions, checks duplicates, and applies rate limiting.
4. **Database Layer:** Stores lead details, affiliate tracking information, and consent records.
5. **Partner Integration:** Sends accepted lead information to the configured partner webhook.

## A/B Testing

QuoteLane supports two quote form variants.

| Feature | Variant A | Variant B |
|---|---|---|
| ZIP Code | Yes | Yes |
| Vehicle Year | Yes | No |
| Vehicle Make | Yes | No |
| Insurance Status | Yes | Yes |
| Age Range | Yes | No |
| Contact Information | Yes | Yes |

The traffic distribution is controlled through the `SPLIT_PERCENT_B` environment variable.

For example:

- `0` – 100% Variant A
- `50` – 50% Variant A and 50% Variant B
- `100` – 100% Variant B

The `ql_variant` cookie maintains visitor assignment. For testing, variants can also be forced through URL parameters:

- `?variant=a`
- `?variant=b`

## Affiliate Tracking and URL Prepopulation

QuoteLane supports affiliate tracking and prepopulation through URL query parameters.

Example:

```text
https://quotelane.onrender.com/?click_id=12345&aff_id=partner01&channel=email&zip=90210&first_name=John&last_name=Doe&email=john@example.com&insured=yes&year=2022
```

Supported parameters include:

| Parameter | Purpose |
|---|---|
| `click_id` | Affiliate click identifier |
| `aff_id` | Affiliate identifier |
| `channel` | Traffic source |
| `zip` | ZIP code |
| `first_name` / `fname` | First name |
| `last_name` / `lname` | Last name |
| `email` | Email address |
| `phone` | Phone number |
| `year` / `vehicle_year` | Vehicle year |
| `make` / `vehicle_make` | Vehicle make |
| `insured` | Current insurance status |
| `age` / `age_range` | Age range |

Invalid values and unresolved macros such as `{sub5}`, `%%email%%`, and `[EMAIL]` are ignored.

Personal contact parameters are removed from the visible URL after they have been processed.

## Lead Submission API

### Endpoint

```http
POST /api/leads
Content-Type: application/json
```

The API validates incoming submissions and checks for duplicate leads before storing them.

### Validation and Protection

- Validates required form fields.
- Requires valid consent information.
- Prevents duplicate email or phone submissions within 24 hours.
- Applies IP-based rate limiting.
- Stores affiliate tracking information.
- Records consent and submission metadata.

### Response Example

Successful submission:

```json
{
  "success": true,
  "leadId": 123,
  "message": "Lead received and processed successfully."
}
```

Duplicate submission:

```json
{
  "error": "A quote request with this email or phone number was already submitted within the last 24 hours.",
  "code": "DUPLICATE_LEAD"
}
```

## Database Design

The application uses PostgreSQL with Drizzle ORM.

The `leads` table stores:

- Lead ID and A/B variant.
- Affiliate click ID, affiliate ID, and channel.
- ZIP code and vehicle information.
- Name, email, and phone number.
- Prefilled field information.
- Consent wording and timestamp.
- IP address and user-agent information.
- Partner delivery status and response details.
- Lead creation timestamp.

## Partner Webhook Integration

QuoteLane supports server-to-server lead forwarding through a configurable webhook URL.

After a lead is successfully stored, the application initiates a JSON POST request to the configured partner endpoint.

The payload includes:

- Lead ID.
- Affiliate tracking information.
- Contact details.
- ZIP code and vehicle information.
- Insurance status.
- A/B variant.
- Submission timestamp.

The current implementation uses request timeouts and a retry when the initial request throws an error or times out. Partner response details are stored in the database.

For production-grade reliability, a persistent background job queue and atomic idempotency mechanism would be recommended.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL database
- Supabase account (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/rockyhans/-quotelane.git

cd -quotelane
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root.

```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

SPLIT_PERCENT_B="50"

PARTNER_WEBHOOK_URL="https://webhook.site/YOUR-UNIQUE-TOKEN"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Replace the placeholders with your actual Supabase database credentials and webhook URL.

**Important:** Never commit your actual database password, webhook token, or other secrets to GitHub.

For deployment, configure the environment variables in your hosting provider:

```env
NEXT_PUBLIC_APP_URL="https://quotelane.onrender.com"
```

### 4. Run the Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### 5. Build for Production

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Testing

### Test A/B Variants

```text
http://localhost:3000/?variant=a
http://localhost:3000/?variant=b
```

### Test URL Prepopulation

```text
http://localhost:3000/?click_id=test123&aff_id=affiliate01&channel=email&zip=90210&first_name=John&last_name=Doe&email=john@example.com&insured=yes&year=2022
```

### Test Partner Webhook

1. Open https://webhook.site.
2. Generate a unique webhook URL.
3. Configure it as `PARTNER_WEBHOOK_URL`.
4. Submit a quote request.
5. Inspect the received JSON payload.

### Test Duplicate Prevention

1. Submit a valid quote request.
2. Submit another request using the same email or phone number within 24 hours.
3. Verify that the API returns HTTP `409`.

---

# Part 2 – Written Assessment

### a. What is a click ID, and why does it need to survive the whole journey?

A click ID is a unique identifier associated with an affiliate or advertising click. It connects the original traffic source to the lead or conversion.

It needs to survive the entire form journey so that when a lead is submitted or converted, the system can identify which affiliate generated it. Without this identifier, accurate attribution and commission tracking become difficult.

### b. How does a server-to-server postback let us and the affiliate get credit?

A server-to-server postback allows two backend systems to exchange conversion information directly.

1. A visitor clicks an affiliate link containing a click ID.
2. QuoteLane captures and stores the click ID.
3. The lead is forwarded to the partner.
4. When a conversion occurs, the partner sends a postback containing the relevant lead or transaction identifier.
5. QuoteLane matches the conversion with its stored lead.
6. QuoteLane can then notify the affiliate network using the original click ID.

This allows both systems to track and attribute conversions without relying entirely on browser-based tracking.

### c. What is the difference between a server-to-server postback and a tracking pixel? When would you use each?

A tracking pixel is triggered from the visitor's browser, generally through an image request or JavaScript. It is useful for tracking page views and browser-based events.

A server-to-server postback is an HTTP request sent directly between backend systems. It is more suitable for tracking lead submissions, purchases, and offline conversions.

I would use pixels for browser analytics and server-to-server postbacks for reliable conversion communication between affiliate networks and partners.

### d. An advertiser fires a test conversion but it does not appear in our tracker. What would you check, in order?

1. Verify that the advertiser is sending the postback to the correct endpoint.
2. Check the server logs to confirm whether the request was received.
3. Verify the HTTP response status and request method.
4. Check whether the click ID or transaction ID is present and correctly mapped.
5. Validate parameter names and authentication details.
6. Check database insertion errors and duplicate-conversion handling.
7. Verify timezone settings and reporting delays.

### e. Why should an affiliate's click ID be stored separately from ours?

The affiliate's click ID belongs to the affiliate tracking system, whereas our internal lead ID identifies a record in our database.

Both identifiers have different purposes. Storing them separately prevents conflicts and allows us to match our internal lead with the affiliate's original click when reporting conversions.

---

# Part 3 – Judgment Calls

### f. Kill switch vs. sticky assignment: What happens when SPLIT_PERCENT_B is 0 or 100?

For normal percentages between 1 and 99, visitors retain their assigned variant through the `ql_variant` cookie.

When `SPLIT_PERCENT_B` is set to `0`, all visitors are served Variant A.

When it is set to `100`, all visitors are served Variant B.

These values override existing assignments, making them useful as rollout kill switches when one variant needs to be disabled.

### g. How can we test Variant B in production when it is set to 0% without affecting other visitors or leaving ourselves stuck on B?

We can use the URL parameter:

```text
https://quotelane.onrender.com/?variant=b
```

This forces Variant B for the testing request without changing the normal sticky assignment cookie.

After testing, removing the query parameter returns the visitor to the normal production assignment.

### h. What happens when traffic arrives with channel=sms, but there is no SMS-specific partner setup or ID?

The channel should still be preserved and stored with the lead.

Even if there is no SMS-specific partner configuration, retaining `channel=sms` helps maintain attribution and reporting accuracy.

In the current implementation, QuoteLane uses one configured partner webhook rather than separate channel-specific destinations. A future improvement would be configurable routing based on traffic source, with a fallback queue for unassigned leads.

### i. How would you distinguish two brands that use the same partner and fixed tracking fields?

I would introduce a separate internal brand identifier and store it with every lead.

The brand identifier could be associated with the landing domain or campaign configuration.

If the partner supports an additional tracking field, we could send a brand-specific value through that field while preserving the original affiliate click ID.

This keeps internal reporting accurate without changing the meaning of existing tracking identifiers.

---

## Future Improvements

- Persistent background job processing for partner delivery.
- Exponential backoff and dead-letter handling.
- Atomic idempotency for webhook requests.
- Distributed rate limiting using Redis.
- Automated unit and integration testing.
- Improved analytics and A/B experiment reporting.
- Brand-specific partner routing.
- Monitoring, logging, and delivery failure alerts.
- Database indexes and automated migrations.
- Stronger privacy and data-retention controls.

## Project Links

- **Live Application:** https://quotelane.onrender.com
- **GitHub Repository:** https://github.com/rockyhans/-quotelane
- **Webhook Testing:** https://webhook.site

---

**Built with Next.js, TypeScript, PostgreSQL, and Drizzle ORM.**