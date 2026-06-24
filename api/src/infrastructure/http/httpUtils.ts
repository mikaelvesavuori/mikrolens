import { readFile } from "node:fs/promises";
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { PayloadTooLargeError, ValidationError } from "../../errors/MikroLensError.ts";

const defaultMaxJsonBodyBytes = 1024 * 1024;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

/**
 * @description Read a JSON request body or return an empty object when nothing was sent.
 */
export async function readJsonBody<T>(
  request: IncomingMessage,
  maxBytes = defaultMaxJsonBodyBytes,
): Promise<T> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > maxBytes) {
      throw new PayloadTooLargeError("JSON body is too large.");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  const payload = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(payload) as T;
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }
}

/**
 * @description Return a JSON response with CORS headers suitable for the static app.
 */
export function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders: OutgoingHttpHeaders = {},
): void {
  response.writeHead(
    statusCode,
    mergeResponseHeaders(response, {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    }),
  );
  response.end(JSON.stringify(payload));
}

/**
 * @description Return an empty success response.
 */
export function sendNoContent(
  response: ServerResponse,
  extraHeaders: OutgoingHttpHeaders = {},
): void {
  response.writeHead(
    204,
    mergeResponseHeaders(response, {
      ...extraHeaders,
    }),
  );
  response.end();
}

/**
 * @description Redirect the browser to a different location.
 */
export function sendRedirect(
  response: ServerResponse,
  location: string,
  statusCode = 302,
  extraHeaders: OutgoingHttpHeaders = {},
): void {
  response.writeHead(
    statusCode,
    mergeResponseHeaders(response, {
      Location: location,
      ...extraHeaders,
    }),
  );
  response.end();
}

/**
 * @description Return a consistent API error payload.
 */
export function sendError(response: ServerResponse, statusCode: number, message: string): void {
  sendJson(response, statusCode, { error: message });
}

/**
 * @description Resolve the user-facing request origin, honoring proxy headers when present.
 */
export function getRequestOrigin(request: IncomingMessage, fallbackOrigin: string): string {
  const forwardedHost = getFirstHeaderValue(request.headers["x-forwarded-host"]);
  const forwardedProto = getFirstHeaderValue(request.headers["x-forwarded-proto"]);
  const host = forwardedHost || getFirstHeaderValue(request.headers.host);

  if (!host) {
    return fallbackOrigin;
  }

  const protocol =
    forwardedProto || ((request.socket as { encrypted?: boolean }).encrypted ? "https" : "http");

  return `${protocol}://${host}`;
}

/**
 * @description Parse a boolean-like query parameter from a URL.
 */
export function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

/**
 * @description Serve a static file from the app directory with a safe resolved path.
 */
export async function serveStaticFile(
  response: ServerResponse,
  staticRoot: string,
  requestPath: string,
): Promise<boolean> {
  const candidatePath = requestPath === "/" ? "/index.html" : requestPath;
  const resolvedPath = resolve(join(staticRoot, normalize(candidatePath)));

  if (!resolvedPath.startsWith(resolve(staticRoot))) {
    return false;
  }

  try {
    const body = await readFile(resolvedPath);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(resolvedPath)) ?? "application/octet-stream",
    });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

function getFirstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.split(",")[0]?.trim() ?? "";
  }

  return value?.split(",")[0]?.trim() ?? "";
}

function mergeResponseHeaders(
  response: ServerResponse,
  extraHeaders: OutgoingHttpHeaders,
): OutgoingHttpHeaders {
  return {
    ...response.getHeaders(),
    ...extraHeaders,
  };
}
