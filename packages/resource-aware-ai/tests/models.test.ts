import { describe, expect, it } from "vitest";
import { getModelProfile, listModels } from "../src/core/models.js";

describe("getModelProfile", () => {
  it("returns the current OpenAI profiles and limits", () => {
    expect(getModelProfile("gpt-5.6-sol")).toMatchObject({
      provider: "openai",
      class: "large",
      contextWindow: 1_050_000,
      maxOutputTokens: 128_000,
      status: "current",
      verifiedAsOf: "2026-08-21",
    });
    expect(getModelProfile("gpt-5.6-luna")).toMatchObject({
      class: "small",
      contextWindow: 400_000,
    });
  });

  it("records the current Anthropic output limits", () => {
    expect(getModelProfile("claude-opus-5").maxOutputTokens).toBe(128_000);
    expect(getModelProfile("claude-haiku-4-5-20251001").maxOutputTokens).toBe(
      64_000,
    );
  });

  it("records the current Gemini 3.7 Flash limits", () => {
    expect(getModelProfile("gemini-3.7-flash")).toMatchObject({
      provider: "gemini",
      contextWindow: 1_048_576,
      maxOutputTokens: 65_536,
    });
  });

  it("uses the versioned Mistral Medium 3.5 identifier", () => {
    expect(getModelProfile("mistral-medium-3-5")).toMatchObject({
      provider: "mistral",
      class: "medium",
      status: "current",
    });
  });

  it("separates total and active parameters for Command A+", () => {
    expect(getModelProfile("command-a-plus-05-2026")).toMatchObject({
      provider: "cohere",
      parametersBillions: 218,
      activeParametersBillions: 25,
      contextWindow: 128_000,
      maxOutputTokens: 64_000,
      deployment: "open-weight",
    });
  });

  it("includes current DeepSeek V4 profiles", () => {
    expect(getModelProfile("deepseek-v4-pro")).toMatchObject({
      provider: "deepseek",
      status: "current",
    });
    expect(getModelProfile("deepseek-v4-flash").class).toBe("medium");
  });

  it("keeps retired profiles explicitly marked as legacy", () => {
    expect(getModelProfile("gpt-4o").status).toBe("legacy");
    expect(getModelProfile("deepseek-r1").status).toBe("legacy");
  });

  it("infers a class for an unknown model name", () => {
    expect(getModelProfile("custom-70b-instruct").class).toBe("large");
    expect(getModelProfile("my-mini-model").class).toBe("small");
    expect(getModelProfile("vendor-new-model").provider).toBe("unknown");
  });
});

describe("listModels", () => {
  it("returns defensive copies of the registry", () => {
    const first = listModels();
    const second = listModels();
    expect(first.length).toBeGreaterThan(40);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });

  it.each([
    "openai",
    "anthropic",
    "gemini",
    "mistral",
    "cohere",
    "deepseek",
    "ollama",
  ])("filters the %s provider", (provider) => {
    const models = listModels(provider);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.provider === provider)).toBe(true);
  });

  it("covers hosted and open-weight deployment paths", () => {
    const deployments = new Set(listModels().map((model) => model.deployment));
    expect(deployments.has("hosted")).toBe(true);
    expect(deployments.has("open-weight")).toBe(true);
  });
});
