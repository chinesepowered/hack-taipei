"use client";

/** Browser side of lib/demoKey.ts: remember `?key=` once, send it as a header on every mutating call. */
const KEY = "doudou-demo-key";

export function captureDemoKey() {
  try {
    const k = new URLSearchParams(window.location.search).get("key");
    if (k) localStorage.setItem(KEY, k);
  } catch {
    /* ignore */
  }
}

export function demoHeaders(): Record<string, string> {
  try {
    const k = localStorage.getItem(KEY);
    return k ? { "x-demo-key": k } : {};
  } catch {
    return {};
  }
}
