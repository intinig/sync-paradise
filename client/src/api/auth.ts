import type { Participant } from "../../../shared/protocol.js";

export async function fetchMe(): Promise<Participant | null> {
  const res = await fetch("/me", { credentials: "same-origin" });
  if (!res.ok) return null;
  return (await res.json()) as Participant | null;
}

export function googleLoginUrl(): string {
  return "/auth/google";
}

export async function logout(): Promise<void> {
  // Reload always runs (try/finally) so a network error doesn't leave the UI
  // stuck on the logged-in lobby. If the request actually failed and the
  // cookie wasn't cleared server-side, the next /me probe will see the user
  // as still logged in — that's a reasonable failure mode (no false logout)
  // and the user can retry. Without the finally, a fetch rejection would
  // skip the reload entirely and the UI would silently be wrong.
  try {
    const res = await fetch("/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) {
      console.warn(`[logout] /auth/logout returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[logout] /auth/logout request failed", err);
  } finally {
    // Reload so the WS reconnects without the now-cleared cookie and the
    // React store re-derives `you = null` from a fresh /me.
    window.location.reload();
  }
}
