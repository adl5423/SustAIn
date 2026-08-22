import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateTokensFromMessages,
  estimateEnergy,
  estimateEnergyDetailed,
  getEnergyFactor,
  MODEL_ENERGY_FACTORS,
} from "../src/core/estimator.js";

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
    expect(getEnergyFactor("gpt-4o")).toBe(MODEL_ENERGY_FACTORS.large);
  });

  it("returns large factor for claude-3-5-sonnet-20241022", () => {
    expect(getEnergyFactor("claude-3-5-sonnet-20241022")).toBe(
      MODEL_ENERGY_FACTORS.large,
    );
  });

  it("returns medium factor for gpt-4o-mini", () => {
    expect(getEnergyFactor("gpt-4o-mini")).toBe(MODEL_ENERGY_FACTORS.medium);
  });

  it("returns small factor for gemini-2.0-flash-lite", () => {
    expect(getEnergyFactor("gemini-2.0-flash-lite")).toBeCloseTo(0.000465, 9);
  });

  it("infers large for unknown model with 70b in name", () => {
    expect(getEnergyFactor("some-model-70b")).toBe(MODEL_ENERGY_FACTORS.large);
  });

  it("infers small for unknown model with mini in name", () => {
    expect(getEnergyFactor("some-unknown-mini-model")).toBe(
      MODEL_ENERGY_FACTORS.small,
    );
  });
});

describe("estimateEnergy", () => {
  it("uses custom estimator when provided", () => {
    const custom = (tokens: number) => tokens * 0.01;
    expect(estimateEnergy(100, "gpt-4o", custom)).toBe(1);
  });

  it("calculates energy correctly for large model", () => {
    const kwh = estimateEnergy(1000, "gpt-4o");
    expect(kwh).toBeCloseTo(0.00135625, 9);
  });

  it("calculates energy correctly for small model", () => {
    const kwh = estimateEnergy(1000, "gemini-2.0-flash-lite");
    expect(kwh).toBeCloseTo(0.000465, 9);
  });

  it("matches the 0.31 Wh reference workload for a medium model", () => {
    const estimate = estimateEnergyDetailed(
      { prompt_tokens: 100, completion_tokens: 300, total_tokens: 400 },
      "gpt-5.6-terra",
      { tokenSource: "provider" },
    );
    expect(estimate.energy_wh).toBeCloseTo(0.31, 9);
    expect(estimate.low_wh).toBeCloseTo(0.16, 9);
    expect(estimate.high_wh).toBeCloseTo(0.6, 9);
    expect(estimate.token_source).toBe("provider");
  });
});
