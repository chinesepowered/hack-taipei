import { NextResponse } from "next/server";

/**
 * Optional shared secret for the two routes that move money or sign as a guardian.
 * Unset (local demo): open. Set (any public deploy): the browser must send `x-demo-key`.
 * The pages learn the key from `?key=...` once and keep it in localStorage, so it never ships in the bundle.
 */
export function requireDemoKey(req: Request): NextResponse | null {
  const expected = process.env.DEMO_KEY;
  if (!expected) return null;
  const got = req.headers.get("x-demo-key") ?? "";
  if (got === expected) return null;
  return NextResponse.json({ status: "error", error: "demo key required" }, { status: 401 });
}
