import { describe, it, expect } from "vitest";
import { sealSession, unsealSession, COOKIE_NAME } from "../../src/auth/session.js";

const SECRET = "0123456789abcdef0123456789abcdef"; // 32 chars

describe("session", () => {
  it("COOKIE_NAME is a non-empty string", () => {
    expect(typeof COOKIE_NAME).toBe("string");
    expect(COOKIE_NAME.length).toBeGreaterThan(0);
  });

  it("seals and unseals a user round-trip", async () => {
    const user = { id: "u-1", name: "Alice", picture: "p.jpg" };
    const cookie = await sealSession(user, SECRET);
    expect(typeof cookie).toBe("string");
    expect(cookie.length).toBeGreaterThan(20);
    const round = await unsealSession(cookie, SECRET);
    expect(round).toEqual(user);
  });

  it("returns null for tampered cookie", async () => {
    const user = { id: "u-1", name: "Alice", picture: "p.jpg" };
    const cookie = await sealSession(user, SECRET);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
    const result = await unsealSession(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for empty cookie", async () => {
    expect(await unsealSession("", SECRET)).toBeNull();
  });
});
