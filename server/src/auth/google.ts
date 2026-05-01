import express from "express";
import crypto from "node:crypto";
import { sealData, unsealData } from "iron-session";
import { sealSession, COOKIE_NAME } from "./session.js";

export interface GoogleAuthOptions {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  sessionSecret: string;
  fetchImpl?: typeof fetch;
}

const SCOPE = "openid email profile";
// Window in which a sealed `state` is accepted at the callback. iron-session's
// sealData/unsealData enforces this for us; the same value is also passed in
// case a future caller wants to inspect or refresh.
const STATE_TTL_SEC = 600;

interface SealedState {
  v: string; // PKCE verifier — kept server-secret via the seal
  n: string; // CSRF nonce so two concurrent flows produce different states
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomString(bytes = 32): string {
  return base64url(crypto.randomBytes(bytes));
}
function pkceChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

export function mountGoogleAuth(app: express.Express, opts: GoogleAuthOptions): void {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const isProd = process.env.NODE_ENV === "production";
  const sessionFlags = isProd
    ? `Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
    : `Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;

  app.get("/auth/google", async (_req, res) => {
    const verifier = randomString(32);
    const challenge = pkceChallenge(verifier);
    // The OAuth `state` is a self-contained signed token that carries the
    // PKCE verifier — no cookie has to survive the cross-site round-trip
    // through Google. iOS Safari and in-app browsers drop our cookies
    // surprisingly often during OAuth; keeping the state inline avoids it.
    const payload: SealedState = { v: verifier, n: randomString(8) };
    const sealed = await sealData(payload, {
      password: opts.sessionSecret,
      ttl: STATE_TTL_SEC,
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", opts.clientId);
    url.searchParams.set("redirect_uri", `${opts.baseUrl}/auth/google/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", sealed);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    res.redirect(302, url.toString());
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const stateParam = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !stateParam) {
        res.status(400).send("OAuth state mismatch");
        return;
      }
      let unsealed: SealedState;
      try {
        unsealed = await unsealData<SealedState>(stateParam, {
          password: opts.sessionSecret,
          ttl: STATE_TTL_SEC,
        });
      } catch {
        res.status(400).send("OAuth state mismatch");
        return;
      }
      if (!unsealed?.v) {
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
          code_verifier: unsealed.v,
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
      res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(sealed)}; ${sessionFlags}`);
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
