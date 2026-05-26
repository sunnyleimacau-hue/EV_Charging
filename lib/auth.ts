import crypto from "crypto";

export const AUTH_COOKIE = "macau_ev_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

function getSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) throw new Error("COOKIE_SECRET is not set");
  return secret;
}

// Constant-time string comparison that does not leak length via early return.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still run a comparison to keep timing roughly constant.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  return safeEqual(input, expected);
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
}

// Builds a signed cookie value of the form "<issuedAt>.<hmac>".
export function createSessionToken(): string {
  const payload = `auth.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

// Verifies the signed cookie value using a constant-time signature compare.
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload.startsWith("auth.")) return false;
  return safeEqual(sig, sign(payload));
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  };
}
