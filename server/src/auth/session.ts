import { sealData, unsealData } from "iron-session";
import type { Participant } from "../../../shared/protocol.js";

export const COOKIE_NAME = "__Host-session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function sealSession(user: Participant, secret: string): Promise<string> {
  return await sealData(user, { password: secret, ttl: TTL_SECONDS });
}

export async function unsealSession(
  cookieValue: string,
  secret: string,
): Promise<Participant | null> {
  if (!cookieValue) return null;
  try {
    const data = (await unsealData(cookieValue, { password: secret, ttl: TTL_SECONDS })) as Participant;
    if (!data || typeof data.id !== "string") return null;
    return data;
  } catch {
    return null;
  }
}
