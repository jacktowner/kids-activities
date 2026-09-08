"use client";

import { useCallback, useEffect, useState } from "react";

// A purely client-side "save for later" list of activity ids, persisted in a
// plain cookie (no server involvement) so it survives across sessions. The
// cookie is read/written directly via document.cookie; a module-level listener
// set keeps every mounted useShortlist() in sync after a toggle/clear.

const COOKIE = "shortlist";
const MAX_AGE = 60 * 60 * 24 * 365; // one year

function readShortlist(): string[] {
  if (typeof document === "undefined") return [];
  const entry = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!entry) return [];
  const raw = decodeURIComponent(entry.slice(COOKIE.length + 1));
  return raw ? raw.split(",").filter(Boolean) : [];
}

function writeShortlist(ids: string[]) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(ids.join(","));
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

export function toggleShortlist(id: string) {
  const ids = readShortlist();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeShortlist(next);
  notify();
}

export function clearShortlist() {
  writeShortlist([]);
  notify();
}

export function useShortlist() {
  const [ids, setIds] = useState<string[]>([]);

  // Server render (and the first client render) start empty to avoid a hydration
  // mismatch; the real cookie value is pulled in via a deferred sync, then again
  // whenever another component toggles the list or the tab regains focus.
  useEffect(() => {
    const sync = () => setIds(readShortlist());
    Promise.resolve().then(sync);
    listeners.add(sync);
    window.addEventListener("focus", sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => toggleShortlist(id), []);
  const clear = useCallback(() => clearShortlist(), []);
  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, count: ids.length, has, toggle, clear };
}
