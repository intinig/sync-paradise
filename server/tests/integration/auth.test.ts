import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import { mountGoogleAuth } from "../../src/auth/google.js";
import { COOKIE_NAME, unsealSession } from "../../src/auth/session.js";

interface Server {
  app: express.Express;
  server: http.Server;
  port: number;
  fetchCalls: { url: string; init?: RequestInit }[];
}

async function makeServer(): Promise<Server> {
  const app = express();
  const fetchCalls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    fetchCalls.push({ url, init });
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({ access_token: "fake-access", id_token: "fake-id", token_type: "Bearer" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
      return new Response(
        JSON.stringify({ sub: "google-1234", name: "Alice Tester", picture: "https://x/y.png" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };
  mountGoogleAuth(app, {
    clientId: "fake-client",
    clientSecret: "fake-secret",
    baseUrl: "http://localhost:0",
    sessionSecret: "0123456789abcdef0123456789abcdef",
    fetchImpl: fakeFetch,
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({ app, server, port, fetchCalls });
    });
  });
}

describe("Google OAuth", () => {
  let s: Server;
  beforeAll(async () => {
    s = await makeServer();
  });
  afterAll(() => {
    s.server.close();
  });

  it("GET /auth/google redirects to accounts.google.com with PKCE and a sealed state, no cookies", async () => {
    const res = await fetch(`http://localhost:${s.port}/auth/google`, { redirect: "manual" });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc).toContain("code_challenge=");
    expect(loc).toContain("state=");
    // The OAuth state now carries everything we need; no cookies are set on
    // /auth/google so we don't depend on them surviving the round-trip.
    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies).toEqual([]);
  });

  it("GET /auth/google/callback exchanges code, sets session cookie, redirects /", async () => {
    const startRes = await fetch(`http://localhost:${s.port}/auth/google`, { redirect: "manual" });
    const loc = startRes.headers.get("location") ?? "";
    const stateValue = new URL(loc).searchParams.get("state") ?? "";
    expect(stateValue.length).toBeGreaterThan(0);

    const cbRes = await fetch(
      `http://localhost:${s.port}/auth/google/callback?code=fake-code&state=${encodeURIComponent(stateValue)}`,
      { redirect: "manual" },
    );
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("location")).toBe("/");
    const cbCookies = cbRes.headers.getSetCookie?.() ?? [];
    const sessionCookie = cbCookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    const sealed = sessionCookie!.split(";")[0].split("=").slice(1).join("=");
    const decoded = decodeURIComponent(sealed);
    const user = await unsealSession(decoded, "0123456789abcdef0123456789abcdef");
    expect(user).toEqual({ id: "google-1234", name: "Alice Tester", picture: "https://x/y.png" });
  });

  it("GET /auth/google/callback rejects an unsealable state", async () => {
    const res = await fetch(`http://localhost:${s.port}/auth/google/callback?code=x&state=wrong`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);
  });
});
