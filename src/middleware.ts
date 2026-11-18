import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VARIANT_COOKIE = "ql_variant";

// Common search engine bot user agents
const BOT_REGEX = /Googlebot|bingbot|Baiduspider|DuckDuckBot|YandexBot|Sogou|Exabot|facebot|facebookexternalhit|ia_archiver|Slurp/i;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Only apply A/B split logic to funnel routes (landing / form)
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isBot = BOT_REGEX.test(userAgent);

  // 1. Forced variant via query param: ?variant=a or ?variant=b
  const forcedVariant = searchParams.get("variant")?.toLowerCase();

  // 2. Existing sticky variant cookie
  const existingCookieVariant = request.cookies.get(VARIANT_COOKIE)?.value?.toUpperCase();

  // 3. Environment configuration: SPLIT_PERCENT_B (0 to 100)
  const splitPercentB = parseInt(process.env.SPLIT_PERCENT_B || "50", 10);

  let assignedVariant: "A" | "B";

  // Bots always get "A" (requirement: "Search engine bots always get A")
  if (isBot) {
    assignedVariant = "A";
  } else if (forcedVariant === "a" || forcedVariant === "b") {
    // ?variant=a or ?variant=b forces a version for testing without overriding sticky user assignments
    assignedVariant = forcedVariant.toUpperCase() as "A" | "B";
  } else if (existingCookieVariant === "A" || existingCookieVariant === "B") {
    // Sticky visitor behavior: "A visitor keeps the same version on every visit (sticky)"
    // "Changing SPLIT_PERCENT_B must not reshuffle people already assigned"
    // EXCEPT when emergency killswitch is applied (0 or 100)
    if (splitPercentB <= 0) {
      assignedVariant = "A";
    } else if (splitPercentB >= 100) {
      assignedVariant = "B";
    } else {
      assignedVariant = existingCookieVariant;
    }
  } else {
    // New visitor assignment based on SPLIT_PERCENT_B
    if (splitPercentB <= 0) {
      assignedVariant = "A";
    } else if (splitPercentB >= 100) {
      assignedVariant = "B";
    } else {
      const roll = Math.random() * 100;
      assignedVariant = roll < splitPercentB ? "B" : "A";
    }
  }

  // Clone response and attach headers & cookie
  const response = NextResponse.next();
  
  // Custom header to communicate variant to server components
  response.headers.set("x-funnel-variant", assignedVariant);

  // Set sticky cookie if not forced by a temporary query param or if new
  // If ?variant= is present, do not overwrite the persistent user cookie so testing doesn't poison future visits
  if (!forcedVariant && existingCookieVariant !== assignedVariant) {
    response.cookies.set(VARIANT_COOKIE, assignedVariant, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year sticky
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

