export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

export interface BaseUrlOptions {
  /** Permit clear-text HTTP for a trusted non-loopback development server. */
  allowInsecureHttp?: boolean;
}

export type RequestOriginOptions = BaseUrlOptions;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _baseUrlOrigin: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;
let _explicitAuthOrigins = new Set<string>();
let _explicitRequestOrigins = new Set<string>();

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(
  url: string | null,
  options: BaseUrlOptions = {},
): void {
  if (!url) {
    _baseUrl = null;
    _baseUrlOrigin = null;
    return;
  }

  const parsed = parseHttpUrl(url, "base URL");
  if (
    parsed.protocol === "http:" &&
    !isLoopbackHostname(parsed.hostname) &&
    options.allowInsecureHttp !== true
  ) {
    throw new TypeError(
      "Base URL must use HTTPS outside loopback. Set allowInsecureHttp only for a trusted development server.",
    );
  }
  _baseUrl = parsed.toString().replace(/\/+$/, "");
  _baseUrlOrigin = parsed.origin;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * Do not use this function in web applications where the browser associates
 * session cookies with API calls.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

/**
 * Allow bearer credentials on additional absolute origins. Same-origin URLs
 * and the configured base URL need no registration.
 */
export function setAuthTokenOrigins(origins: string[]): void {
  _explicitAuthOrigins = new Set(
    origins.map((origin) => parseTrustedOrigin(origin, "auth origin")),
  );
}

/**
 * Allow requests to additional absolute origins. Relative URLs, the configured
 * base URL, the browser's own origin, and explicit auth origins are already
 * allowed. Keep this list static and controlled by application configuration.
 */
export function setRequestOrigins(
  origins: string[],
  options: RequestOriginOptions = {},
): void {
  _explicitRequestOrigins = new Set(
    origins.map((origin) =>
      parseTrustedOrigin(
        origin,
        "request origin",
        options.allowInsecureHttp === true,
      ),
    ),
  );
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(
  input: RequestInfo | URL,
  explicitMethod?: string,
): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Some React Native URL polyfills fail `instanceof URL`, so this check accepts
// the runtime's URL implementation.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function parseHttpUrl(value: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${label} must be an absolute HTTP(S) URL.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TypeError(`${label} must use HTTP or HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new TypeError(`${label} must not contain embedded credentials.`);
  }
  if (parsed.hash)
    throw new TypeError(`${label} must not contain a URL fragment.`);
  return parsed;
}

function parseTrustedOrigin(
  value: string,
  label: string,
  allowInsecureHttp = false,
): string {
  const parsed = parseHttpUrl(value, label);
  if (parsed.pathname !== "/" || parsed.search) {
    throw new TypeError(`${label} must not contain a path or query.`);
  }
  if (
    parsed.protocol === "http:" &&
    !isLoopbackHostname(parsed.hostname) &&
    !allowInsecureHttp
  ) {
    throw new TypeError(`${label} must use HTTPS outside loopback.`);
  }
  return parsed.origin;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.")
  );
}

function resolveRequestOrigin(url: string): string | null {
  if (url.startsWith("/")) {
    if (_baseUrlOrigin) return _baseUrlOrigin;
    if (typeof location !== "undefined" && location.origin)
      return location.origin;
    return null;
  }
  return parseHttpUrl(url, "request URL").origin;
}

function isTrustedAuthDestination(url: string): boolean {
  const origin = resolveRequestOrigin(url);
  if (!origin) return false;
  if (_baseUrlOrigin === origin) return true;
  if (typeof location !== "undefined" && location.origin === origin)
    return true;
  return _explicitAuthOrigins.has(origin);
}

function isAllowedRequestDestination(url: string): boolean {
  const origin = resolveRequestOrigin(url);
  if (!origin) return false;
  if (_baseUrlOrigin === origin) return true;
  if (typeof location !== "undefined" && location.origin === origin)
    return true;
  return (
    _explicitRequestOrigins.has(origin) || _explicitAuthOrigins.has(origin)
  );
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return (
    mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"))
  );
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
    (mediaType.startsWith("text/") ||
      mediaType === "application/xml" ||
      mediaType === "text/xml" ||
      mediaType.endsWith("+xml") ||
      mediaType === "application/x-www-form-urlencoded"),
  );
}

// Browsers use `null` for a response without a body. React Native uses
// `undefined` because ReadableStream is unavailable even when `.text()` or
// `.json()` can read the payload. Strict equality avoids treating every React
// Native response as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} - ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(
  response: Response,
  method: string,
): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function"
      ? response.blob()
      : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            'Use responseType "json" or "text" instead.',
        );
      }
      return response.blob();
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(
    isRequest(input) ? input.headers : undefined,
    headersInit,
  );
  const resolvedRequestUrl = resolveUrl(input);
  const trustedAuthDestination = isTrustedAuthDestination(resolvedRequestUrl);

  if (!isAllowedRequestDestination(resolvedRequestUrl)) {
    throw new TypeError(
      "customFetch refused an untrusted request origin. Register it with setRequestOrigins().",
    );
  }

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  if (headers.has("authorization") && !trustedAuthDestination) {
    throw new TypeError(
      "customFetch refused to send Authorization to an untrusted origin. Register it with setAuthTokenOrigins().",
    );
  }

  if (
    _authTokenGetter &&
    trustedAuthDestination &&
    !headers.has("authorization")
  ) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const requestInfo = { method, url: resolvedRequestUrl };

  const response = await fetch(input, {
    ...init,
    method,
    headers,
    redirect: "error",
  });

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}
