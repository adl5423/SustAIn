import { describe, it, expect } from "vitest";
import { estimateTokens, estimateTokensFromMessages, estimateEnergy, getEnergyFactor } from "../src/core/estimator.js";

describe("estimateTokens", () => {
  it("estimates tokens as chars / 4 rounded up", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("Hello World!")).toBe(3);
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("estimateTokensFromMessages", () => {
  it("stringifies and estimates", () => {
    const messages = [{ role: "user", content: "Hello" }];
    const tokens = estimateTokensFromMessages(messages);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe("getEnergyFactor", () => {
  it("returns large factor for gpt-4o", () => {
    expect(getEnergyFactor("gpt-4o")).toBe(0.0025);
  });

  it("returns large factor for claude-3-5-sonnet-20241022", () => {
    expect(getEnergyFactor("claude-3-5-sonnet-20241022")).toBe(0.0025);
  });

  it("returns medium factor for gpt-4o-mini", () => {
    expect(getEnergyFactor("gpt-4o-mini")).toBe(0.0012);
  });

  it("returns small factor for gemini-2.0-flash-lite", () => {
    expect(getEnergyFactor("gemini-2.0-flash-lite")).toBe(0.0004);
  });

  it("infers large for unknown model with 70b in name", () => {
    expect(getEnergyFactor("some-model-70b")).toBe(0.0025);
  });

  it("infers small for unknown model with mini in name", () => {
    expect(getEnergyFactor("some-unknown-mini-model")).toBe(0.0004);
  });
});

describe("estimateEnergy", () => {
  it("uses custom estimator when provided", () => {
    const custom = (tokens: number) => tokens * 0.01;
    expect(estimateEnergy(100, "gpt-4o", custom)).toBe(1);
  });

  it("calculates energy correctly for large model", () => {
    const kwh = estimateEnergy(1000, "gpt-4o");
    expect(kwh).toBeCloseTo(0.0025, 6);
  });

  it("calculates energy correctly for small model", () => {
    const kwh = estimateEnergy(1000, "gemini-2.0-flash-lite");
    expect(kwh).toBeCloseTo(0.0004, 6);
  });
});
