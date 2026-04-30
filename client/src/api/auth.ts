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
  await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
  // Reload so the WS reconnects without the now-cleared cookie and the
  // React store re-derives `you = null` from a fresh /me. Without this the
  // cookie is gone server-side but the in-memory state still shows the user
  // as logged in until the next manual refresh.
  window.location.reload();
}
