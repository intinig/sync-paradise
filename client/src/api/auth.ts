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
}
