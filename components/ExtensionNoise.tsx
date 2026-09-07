"use client";

import { useEffect } from "react";

/**
 * Browser wallet extensions (MetaMask etc.) inject scripts into every tab and sometimes throw on their own
 * ("MetaMask extension not found"). This app never talks to a browser wallet: signing is server-side.
 * Swallow errors that originate from extension scripts so they cannot surface as ours.
 */
export function ExtensionNoise() {
  useEffect(() => {
    const fromExtension = (s: unknown) => typeof s === "string" && /chrome-extension:\/\/|moz-extension:\/\/|MetaMask/i.test(s);
    const onError = (e: ErrorEvent) => {
      if (fromExtension(e.filename) || fromExtension(e.message) || fromExtension(e.error?.stack)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { stack?: string; message?: string } | undefined;
      if (fromExtension(r?.stack) || fromExtension(r?.message)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);
  return null;
}
