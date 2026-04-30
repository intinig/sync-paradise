import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    },
  },
  webServer: {
    command:
      "npm run build && NODE_ENV=test PORT=3000 SESSION_SECRET=0123456789abcdef0123456789abcdef BASE_URL=http://localhost:3000 GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x COUNTDOWN_SECONDS=10 COOLDOWN_SECONDS=10 npm start",
    url: "http://localhost:3000/healthz",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
