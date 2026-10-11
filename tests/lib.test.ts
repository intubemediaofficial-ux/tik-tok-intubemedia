import { createHmac } from "node:crypto";
import { describe, expect, it, beforeEach } from "vitest";
import { extractTagsAndMentions, signupSchema, usernameSchema, zodMessage } from "@/lib/validation";
import { compact, duration, daysAgo } from "@/lib/format";
import { FILTERS, SPEED_OPTIONS } from "@/lib/filters";
import { razorpayEnabled, verifyRazorpaySignature } from "@/lib/razorpay";
import { hashToken } from "@/lib/security";
import { absFromUrl, datedPath, uploadRoot } from "@/lib/media";

describe("validation", () => {
  it("normalises and validates usernames", () => {
    expect(usernameSchema.parse("  Riya.Dance ")).toBe("riya.dance");
    expect(() => usernameSchema.parse("ab")).toThrow();
    expect(() => usernameSchema.parse("bad name!")).toThrow();
  });
  it("rejects short passwords with a friendly message", () => {
    const r = signupSchema.safeParse({ email: "a@b.co", name: "A", username: "abc", password: "123" });
    expect(r.success).toBe(false);
    expect(zodMessage(r.error)).toMatch(/at least 8/);
  });
  it("extracts unique hashtags and mentions", () => {
    const { hashtags, mentions } = extractTagsAndMentions("Hello #Dance #dance #नाच @Riya.Dance email@x.com @ab");
    expect(hashtags).toEqual(["dance", "नाच"]);
    expect(mentions).toEqual(["riya.dance"]);
  });
});

describe("format", () => {
  it("compacts numbers", () => {
    expect(compact(999)).toBe("999");
    expect(compact(1500)).toBe("1.5K");
    expect(compact(25_000)).toBe("25K");
    expect(compact(3_200_000)).toBe("3.2M");
  });
  it("formats durations", () => {
    expect(duration(65)).toBe("1:05");
    expect(duration(null)).toBe("0:00");
  });
  it("computes past dates", () => {
    expect(Date.now() - daysAgo(2).getTime()).toBeGreaterThanOrEqual(2 * 864e5 - 5);
  });
});

describe("filters", () => {
  it("has a none filter and sane speeds", () => {
    expect(FILTERS.none).toBeDefined();
    expect(SPEED_OPTIONS).toContain(1);
    for (const f of Object.values(FILTERS)) expect(typeof f.label).toBe("string");
  });
});

describe("razorpay", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
  });
  it("verifies signatures with constant-time compare", () => {
    expect(razorpayEnabled()).toBe(true);
    const sig = createHmac("sha256", "secret123").update("order_1|pay_1").digest("hex");
    expect(verifyRazorpaySignature("order_1", "pay_1", sig)).toBe(true);
    expect(verifyRazorpaySignature("order_1", "pay_2", sig)).toBe(false);
    expect(verifyRazorpaySignature("order_1", "pay_1", "short")).toBe(false);
  });
});

describe("security & media paths", () => {
  it("hashes session tokens deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe("abc");
  });
  it("blocks path traversal for media urls", () => {
    const p = datedPath("mp4");
    expect(absFromUrl(p.url)).toBe(p.absolute);
    expect(absFromUrl("/media/../../etc/passwd")).toBeNull();
    expect(absFromUrl("https://evil.com/x.mp4")).toBeNull();
    expect(p.absolute.startsWith(uploadRoot)).toBe(true);
  });
});
