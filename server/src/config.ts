function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function int(name: string, defaultValue: number): number {
  const v = process.env[name];
  if (!v) return defaultValue;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer, got ${v}`);
  return n;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: int("PORT", 3000),
  baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-secret-32-chars-minimum-xxx",
  countdownSeconds: int("COUNTDOWN_SECONDS", 10),
  cooldownSeconds: int("COOLDOWN_SECONDS", 30),
};

export function assertProductionConfig(): void {
  if (config.nodeEnv !== "production") return;
  required("GOOGLE_CLIENT_ID");
  required("GOOGLE_CLIENT_SECRET");
  required("SESSION_SECRET");
  if (config.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
}
