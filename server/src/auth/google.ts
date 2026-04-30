import express from "express";
import crypto from "node:crypto";
import { sealSession, COOKIE_NAME } from "./session.js";

export interface GoogleAuthOptions {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  sessionSecret: string;
  fetchImpl?: typeof fetch;
}

const SCOPE = "openid email profile";
const STATE_COOKIE = "oauth_state";
const PKCE_COOKIE = "oauth_pkce";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomString(bytes = 32): string {
  return base64url(crypto.randomBytes(bytes));
}
function pkceChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}
function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((s) => {
      const [k, ...rest] = s.trim().split("=");
      return [k, decodeURIComponent(rest.join("="))];
    }),
  );
}

export function mountGoogleAuth(app: express.Express, opts: GoogleAuthOptions): void {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const isProd = process.env.NODE_ENV === "production";
  const cookieFlags = (maxAgeSec: number) =>
    `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isProd ? "; Secure" : ""}`;
  const sessionFlags = isProd
    ? `Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
    : `Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;

  app.get("/auth/google", (_req, res) => {
    const state = randomString(16);
    const verifier = randomString(32);
    const challenge = pkceChallenge(verifier);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", opts.clientId);
    url.searchParams.set("redirect_uri", `${opts.baseUrl}/auth/google/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    res.setHeader("Set-Cookie", [
      `${STATE_COOKIE}=${encodeURIComponent(state)}; ${cookieFlags(600)}`,
      `${PKCE_COOKIE}=${encodeURIComponent(verifier)}; ${cookieFlags(600)}`,
    ]);
    res.redirect(302, url.toString());
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const stateCookie = cookies[STATE_COOKIE];
      const verifier = cookies[PKCE_COOKIE];
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!stateCookie || !verifier || !code || !state || state !== stateCookie) {
        res.status(400).send("OAuth state mismatch");
        return;
      }
      const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: opts.clientId,
          client_secret: opts.clientSecret,
          code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: `${opts.baseUrl}/auth/google/callback`,
        }).toString(),
      });
      if (!tokenRes.ok) {
        res.status(502).send("Token exchange failed");
        return;
      }
      const token = (await tokenRes.json()) as { access_token: string };
      const userRes = await fetchImpl("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!userRes.ok) {
        res.status(502).send("Userinfo failed");
        return;
      }
      const user = (await userRes.json()) as { sub: string; name: string; picture: string };
      const sealed = await sealSession(
        { id: user.sub, name: user.name, picture: user.picture },
        opts.sessionSecret,
      );
      res.setHeader("Set-Cookie", [
        `${COOKIE_NAME}=${encodeURIComponent(sealed)}; ${sessionFlags}`,
        `${STATE_COOKIE}=; ${cookieFlags(0)}`,
        `${PKCE_COOKIE}=; ${cookieFlags(0)}`,
      ]);
      res.redirect(302, "/");
    } catch (err) {
      console.error("[oauth] callback error", err);
      res.status(500).send("OAuth callback error");
    }
  });

  app.post("/auth/logout", (_req, res) => {
    const cleared = isProd
      ? `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`
      : `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    res.setHeader("Set-Cookie", cleared);
    res.status(204).end();
  });
}
