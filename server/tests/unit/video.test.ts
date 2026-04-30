import { describe, it, expect } from "vitest";
import { VIDEO_ID, VIDEO_DURATION_MS } from "../../src/video.js";

describe("video constants", () => {
  it("uses Coolio's Gangsta's Paradise video id", () => {
    expect(VIDEO_ID).toBe("fPO76Jlnz6c");
  });

  it("VIDEO_DURATION_MS is 4 minutes 16 seconds (256000ms)", () => {
    expect(VIDEO_DURATION_MS).toBe(256_000);
  });
});
