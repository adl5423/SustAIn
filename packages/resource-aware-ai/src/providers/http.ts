const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FORBIDDEN_HEADERS = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface EndpointPolicy {
  allowInsecureHttp?: boolean;
  allowPrivateNetwork?: boolean;
  allowedHosts?: string[];
}

export interface SecureJsonRequestOptions extends EndpointPolicy {
  method?: "POST" | "GET";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string, detail: string) {
    super(`Provider request failed with HTTP ${status}: ${detail}`);
    this.name = "ProviderHttpError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export function validateEndpoint(
  endpoint: string,
  policy: EndpointPolicy = {},
): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new TypeError("Provider endpoint must be an absolute HTTP(S) URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Provider endpoint must use HTTPS or HTTP.");
  }
  if (url.username || url.password) {
    throw new TypeError(
      "Provider endpoint must not contain embedded credentials.",
    );
  }
  if (url.hash) {
    throw new TypeError("Provider endpoint must not contain a URL fragment.");
  }

  const hostname = normalizeHostname(url.hostname);
  if (url.protocol === "http:" && policy.allowInsecureHttp !== true) {
    throw new TypeError(
      "Provider endpoints require HTTPS. Set allowInsecureHttp only for a trusted development endpoint.",
    );
  }
  if (isPrivateHost(hostname) && policy.allowPrivateNetwork !== true) {
    throw new TypeError(
      "Private-network provider endpoints require allowPrivateNetwork: true.",
    );
  }

  if (policy.allowedHosts && policy.allowedHosts.length > 0) {
    const allowed = new Set(
      policy.allowedHosts.map((host) => normalizeHostname(host)),
    );
    if (!allowed.has(hostname)) {
      throw new TypeError(
        `Provider host "${hostname}" is not in allowedHosts.`,
      );
    }
  }

  return url;
}

export function sanitizeHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalizedName = name.trim().toLowerCase();
    if (FORBIDDEN_HEADERS.has(normalizedName)) {
      throw new TypeError(`Provider header "${name}" is not allowed.`);
    }
    if (/\r|\n/.test(name) || /\r|\n/.test(value)) {
      throw new TypeError("Provider headers must not contain line breaks.");
    }
    result[name] = value;
  }
  return result;
}

export async function secureFetchJson<T = unknown>(
  endpoint: string,
  options: SecureJsonRequestOptions = {},
): Promise<T> {
  const url = validateEndpoint(endpoint, options);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  assertPositiveInteger(timeoutMs, "timeoutMs");
  assertPositiveInteger(maxResponseBytes, "maxResponseBytes");

  const headers = sanitizeHeaders(options.headers);
  if (options.body !== undefined && !hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }
  if (!hasHeader(headers, "accept")) headers.Accept = "application/json";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "POST",
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Provider request timed out after ${timeoutMs} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const body = await readLimitedText(response, maxResponseBytes);
  if (!response.ok) {
    throw new ProviderHttpError(
      response.status,
      url.origin,
      "The upstream response body was omitted to avoid exposing provider data.",
    );
  }
  if (body.trim() === "") return null as T;

  try {
    return JSON.parse(body) as T;
  } catch (cause) {
    throw new SyntaxError(
      `Provider returned invalid JSON from ${url.origin}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

async function readLimitedText(
  response: Response,
  limit: number,
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > limit) {
    throw new RangeError(`Provider response exceeds the ${limit}-byte limit.`);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new RangeError(
          `Provider response exceeds the ${limit}-byte limit.`,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name);
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname.startsWith("127.")
  );
}

function isPrivateHost(hostname: string): boolean {
  if (isLoopbackHost(hostname)) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal"))
    return true;
  if (hostname === "::" || hostname.startsWith("::ffff:")) return true;
  if (/^(?:fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*$/i.test(hostname)) return true;

  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
    return false;
  const [a, b, c] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function normalizeHostname(hostname: string): string {
  let normalized = hostname.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replace(/\.+$/, "");
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
}
