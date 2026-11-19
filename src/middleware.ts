import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VARIANT_COOKIE = "ql_variant";

const BOT_REGEX = /Googlebot|bingbot|Baiduspider|DuckDuckBot|YandexBot|Sogou|Exabot|facebot|facebookexternalhit|ia_archiver|Slurp/i;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isBot = BOT_REGEX.test(userAgent);

  const forcedVariant = searchParams.get("variant")?.toLowerCase();

  const existingCookieVariant = request.cookies.get(VARIANT_COOKIE)?.value?.toUpperCase();

  const splitPercentB = parseInt(process.env.SPLIT_PERCENT_B || "50", 10);

  let assignedVariant: "A" | "B";

  if (isBot) {
    assignedVariant = "A";
  } else if (forcedVariant === "a" || forcedVariant === "b") {
    assignedVariant = forcedVariant.toUpperCase() as "A" | "B";
  } else if (existingCookieVariant === "A" || existingCookieVariant === "B") {
    if (splitPercentB <= 0) {
      assignedVariant = "A";
    } else if (splitPercentB >= 100) {
      assignedVariant = "B";
    } else {
      assignedVariant = existingCookieVariant;
    }
  } else {
    if (splitPercentB <= 0) {
      assignedVariant = "A";
    } else if (splitPercentB >= 100) {
      assignedVariant = "B";
    } else {
      const roll = Math.random() * 100;
      assignedVariant = roll < splitPercentB ? "B" : "A";
    }
  }

  const response = NextResponse.next();

  response.headers.set("x-funnel-variant", assignedVariant);
  if (!forcedVariant && existingCookieVariant !== assignedVariant) {
    response.cookies.set(VARIANT_COOKIE, assignedVariant, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

