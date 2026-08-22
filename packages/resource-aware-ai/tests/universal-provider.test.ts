import { afterEach, describe, expect, it, vi } from "vitest";
import { validateEndpoint } from "../src/providers/http.js";
import { OllamaProvider } from "../src/providers/ollama.js";
import { UniversalProvider } from "../src/providers/universal.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provider endpoint policy", () => {
  it("requires HTTPS outside loopback", () => {
    expect(() =>
      validateEndpoint("http://example.com/v1/chat/completions"),
    ).toThrow(/HTTPS/);
  });

  it("requires explicit opt-ins for a local development endpoint", () => {
    expect(() => validateEndpoint("http://127.0.0.1:11434/api/chat")).toThrow(
      /HTTPS/,
    );
    expect(
      validateEndpoint("http://127.0.0.1:11434/api/chat", {
        allowInsecureHttp: true,
        allowPrivateNetwork: true,
      }).hostname,
    ).toBe("127.0.0.1");
  });

  it("blocks private-network literals unless explicitly enabled", () => {
    const endpoints = [
      "https://192.168.1.10/v1/chat/completions",
      "https://localhost./admin",
      "https://[fd00::1]/internal",
      "https://[::ffff:127.0.0.1]/admin",
      "https://169.254.169.254/latest/meta-data",
    ];
    for (const endpoint of endpoints) {
      expect(() => validateEndpoint(endpoint)).toThrow(/Private-network/);
    }
  });

  it("enforces an explicit host allowlist", () => {
    expect(() =>
      validateEndpoint("https://models.example.com/v1/responses", {
        allowedHosts: ["api.example.com"],
      }),
    ).toThrow(/allowedHosts/);
  });

  it("requires an explicit private-network policy for a custom Ollama URL", () => {
    expect(
      () => new OllamaProvider({ baseURL: "http://127.0.0.1:11434" }),
    ).toThrow(/Private-network/);
    expect(
      new OllamaProvider({
        baseURL: "http://127.0.0.1:11434",
        allowPrivateNetwork: true,
        allowedHosts: ["127.0.0.1"],
      }),
    ).toBeInstanceOf(OllamaProvider);
  });
});

describe("UniversalProvider", () => {
  it("parses OpenAI Responses output and provider token usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: "measured answer",
          usage: {
            input_tokens: 100,
            output_tokens: 300,
            total_tokens: 400,
            input_tokens_details: { cached_tokens: 20 },
            output_tokens_details: { reasoning_tokens: 50 },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new UniversalProvider({
      endpoint: "https://models.example.com/v1/responses",
      protocol: "openai-responses",
      apiKey: "test-only-token",
      allowedHosts: ["models.example.com"],
    });
    const result = await provider.generate({
      model: "gpt-oss-20b",
      messages: [{ role: "user", content: "Explain PUE." }],
    });

    expect(result.text).toBe("measured answer");
    expect(result.usage).toMatchObject({
      prompt_tokens: 100,
      completion_tokens: 300,
      total_tokens: 400,
      cached_input_tokens: 20,
      reasoning_tokens: 50,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: "error" }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ store: false });
  });

  it("rejects oversized responses before parsing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("0123456789", {
          status: 200,
          headers: { "content-length": "10" },
        }),
      ),
    );
    const provider = new UniversalProvider({
      endpoint: "https://models.example.com/v1/chat/completions",
      maxResponseBytes: 5,
    });

    await expect(
      provider.generate({
        model: "model",
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow(/5-byte limit/);
  });

  it("does not copy an upstream error body into the thrown error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"error":"echoed credential test-secret"}', {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const provider = new UniversalProvider({
      endpoint: "https://models.example.com/v1/chat/completions",
    });

    const error = await provider
      .generate({
        model: "model",
        messages: [{ role: "user", content: "hello" }],
      })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("test-secret");
    expect((error as Error).message).toContain("omitted");
  });
});
