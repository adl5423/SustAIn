import { afterEach, describe, expect, it, vi } from "vitest";
import {
  customFetch,
  setAuthTokenGetter,
  setAuthTokenOrigins,
  setBaseUrl,
  setRequestOrigins,
} from "./custom-fetch";

afterEach(() => {
  setBaseUrl(null);
  setAuthTokenGetter(null);
  setAuthTokenOrigins([]);
  setRequestOrigins([]);
  vi.unstubAllGlobals();
});

describe("customFetch credential boundaries", () => {
  it("rejects clear-text remote base URLs by default", () => {
    expect(() => setBaseUrl("http://api.example.com")).toThrow(/HTTPS/);
  });

  it("attaches a configured token to the trusted base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setBaseUrl("https://api.example.com");
    setAuthTokenGetter(() => "test-token");

    await customFetch("/v1/health", { responseType: "json" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-token",
    );
    expect(init.redirect).toBe("error");
  });

  it("allows an explicitly registered request origin without attaching a token", async () => {
    const tokenGetter = vi.fn(() => "test-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setBaseUrl("https://api.example.com");
    setRequestOrigins(["https://uploads.example.net"]);
    setAuthTokenGetter(tokenGetter);

    await customFetch("https://uploads.example.net/public");

    expect(tokenGetter).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("authorization")).toBe(false);
    expect(init.redirect).toBe("error");
  });

  it("blocks unlisted local, private, and metadata destinations", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const blocked = [
      "http://127.0.0.1/admin",
      "http://10.0.0.8/internal",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/admin",
    ];

    for (const url of blocked) {
      await expect(customFetch(url)).rejects.toThrow(
        /untrusted request origin/,
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an explicit Authorization header for an untrusted origin", async () => {
    vi.stubGlobal("fetch", vi.fn());
    setBaseUrl("https://api.example.com");
    setRequestOrigins(["https://attacker.example"]);

    await expect(
      customFetch("https://attacker.example/collect", {
        headers: { Authorization: "Bearer should-not-leave" },
      }),
    ).rejects.toThrow(/untrusted origin/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows an explicitly registered credential origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setAuthTokenOrigins(["https://models.example.com"]);
    setAuthTokenGetter(() => "test-token");

    await customFetch("https://models.example.com/v1/models");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-token",
    );
  });

  it("rejects clear-text credential origins outside loopback", () => {
    expect(() => setAuthTokenOrigins(["http://api.example.com"])).toThrow(
      /HTTPS/,
    );
  });
});
