import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";

let server: Server;
let baseUrl: string;

before(async () => {
  process.env["NODE_ENV"] = "production";
  process.env["CORS_ORIGINS"] = "https://trusted.example";
  process.env["CORS_ALLOW_CREDENTIALS"] = "false";
  process.env["TRUST_PROXY_HOPS"] = "0";
  const { default: app } = await import("./app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("API security middleware", () => {
  it("returns health data with security headers", async () => {
    const response = await fetch(`${baseUrl}/api/healthz`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-powered-by"), null);
  });

  it("allows an exact configured origin without cookie credentials", async () => {
    const response = await fetch(`${baseUrl}/api/healthz`, {
      headers: { Origin: "https://trusted.example" },
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://trusted.example",
    );
    assert.equal(
      response.headers.get("access-control-allow-credentials"),
      null,
    );
  });

  it("rejects an unlisted origin without reflecting it", async () => {
    const response = await fetch(`${baseUrl}/api/healthz`, {
      headers: { Origin: "https://attacker.example" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(
      ((await response.json()) as { error?: string }).error,
      "FORBIDDEN",
    );
  });

  it("rejects an oversized JSON body with a safe error", async () => {
    const response = await fetch(`${baseUrl}/api/missing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(70_000) }),
    });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: "PAYLOAD_TOO_LARGE",
      message: "The request body exceeds the limit.",
    });
  });

  it("returns a bounded 404 response", async () => {
    const response = await fetch(`${baseUrl}/api/missing`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "NOT_FOUND",
      message: "Route not found.",
    });
  });
});
