import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join } from "node:path";
import {
  type RecordActor,
  resolveRecordAccessPolicy,
} from "../../application/policies/recordAccess.ts";
import type { MikroLensRepository } from "../../application/ports/MikroLensRepository.ts";
import type { OAuthProviderGateway } from "../../application/ports/OAuth.ts";
import type { MagicLinkService } from "../../application/services/MagicLinkService.ts";
import { hashApiIdentityToken } from "../../application/usecases/apiIdentities/apiIdentityTokens.ts";
import { recordApiIdentityUsage } from "../../application/usecases/apiIdentities/recordApiIdentityUsage.ts";
import { getBootstrapSnapshot } from "../../application/usecases/snapshots/getBootstrapSnapshot.ts";
import { getPlanSnapshot } from "../../application/usecases/snapshots/getPlanSnapshot.ts";
import { getUnderstandSnapshot } from "../../application/usecases/snapshots/getUnderstandSnapshot.ts";
import type { ApiIdentityDTO } from "../../domain/ApiIdentity.ts";
import { hasUserPermission, MIKROLENS_PERMISSIONS } from "../../domain/Authorization.ts";
import type { UserDTO } from "../../domain/User.ts";
import { MikroLensError, RateLimitError } from "../../errors/MikroLensError.ts";
import openApiSchemaTemplate from "../../openapi/schema.json" with { type: "json" };
import type { MikroLensAuthGateway } from "../auth/MikroLensAuth.ts";
import type { DocumentCollaborationHub } from "../collaboration/DocumentCollaborationHub.ts";
import type { OAuthSecurity } from "../security/OAuthSecurity.ts";
import { RateLimiter } from "../security/RateLimiter.ts";
import type { SessionSecurity } from "../security/SessionSecurity.ts";
import { buildAuthRedirect } from "./authRedirect.ts";
import { handleConfigurationRoutesHttp } from "./configurationRoutesHttp.ts";
import {
  getRequestOrigin,
  sendError,
  sendJson,
  sendNoContent,
  serveStaticFile,
} from "./httpUtils.ts";
import { handleMagicLinkAuthHttp } from "./magicLinkAuthHttp.ts";
import { handleOAuthAuthHttp } from "./oauthAuthHttp.ts";
import { handleRecordRoutesHttp } from "./recordRoutesHttp.ts";

export interface AppHealthSnapshot {
  checks?: Record<string, string>;
  details?: Record<string, unknown>;
  status?: "degraded" | "healthy" | "unhealthy";
}

export interface AppServerOptions {
  allowedOrigins?: string[];
  appUrl?: string;
  auth: MikroLensAuthGateway;
  collaborationHub: DocumentCollaborationHub;
  demoLoginEnabled?: boolean;
  host: string;
  healthCheck?: () => AppHealthSnapshot;
  magicLinkService: MagicLinkService;
  oauthProviders?: OAuthProviderGateway[];
  oauthSecurity?: OAuthSecurity;
  port: number;
  repository: MikroLensRepository;
  sessionSecurity: SessionSecurity;
  staticRoot: string;
}

/**
 * @description Minimal HTTP server exposing MikroLens's API and static app shell.
 */
export class AppServer {
  private readonly allowedOrigins: Set<string>;
  private readonly appUrl: string;
  private readonly auth: MikroLensAuthGateway;
  private readonly authRateLimiter = new RateLimiter();
  private readonly collaborationHub: DocumentCollaborationHub;
  private readonly demoLoginEnabled: boolean;
  private readonly healthCheck: (() => AppHealthSnapshot) | null;
  private readonly host: string;
  private readonly magicLinkService: MagicLinkService;
  private readonly oauthProviders: Map<string, OAuthProviderGateway>;
  private readonly oauthSecurity: OAuthSecurity | null;
  private readonly port: number;
  private readonly repository: MikroLensRepository;
  private readonly sessionSecurity: SessionSecurity;
  private readonly staticRoot: string;
  private listeningPort: number;
  private server: Server | null = null;
  private stopping: Promise<void> | null = null;

  constructor(options: AppServerOptions) {
    this.appUrl = options.appUrl?.trim() ?? "";
    this.auth = options.auth;
    this.demoLoginEnabled = options.demoLoginEnabled ?? false;
    this.allowedOrigins = new Set(
      [this.appUrl, ...(options.allowedOrigins ?? [])]
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean),
    );
    this.collaborationHub = options.collaborationHub;
    this.healthCheck = options.healthCheck ?? null;
    this.host = options.host;
    this.magicLinkService = options.magicLinkService;
    this.listeningPort = options.port;
    this.oauthProviders = new Map(
      (options.oauthProviders ?? []).map((provider) => [provider.getPublicInfo().id, provider]),
    );
    this.oauthSecurity = options.oauthSecurity ?? null;
    this.port = options.port;
    this.repository = options.repository;
    this.sessionSecurity = options.sessionSecurity;
    this.staticRoot = options.staticRoot;
  }

  /**
   * @description Start listening for API and app requests.
   */
  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.port, this.host, () => {
        const address = this.server?.address();

        if (address && typeof address === "object") {
          this.listeningPort = address.port;
        }

        resolve();
      });
    });
  }

  /**
   * @description Stop the server if it is currently running.
   */
  async stop(): Promise<void> {
    if (this.stopping) {
      return this.stopping;
    }

    this.oauthSecurity?.shutdown();

    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;

    this.stopping = new Promise<void>((resolve, reject) => {
      server.close((error) => {
        this.stopping = null;

        if (error) {
          reject(error);
          return;
        }

        resolve();
      });

      // Browser keep-alive and collaboration streams can otherwise leave shutdown hanging.
      server.closeIdleConnections();
      server.closeAllConnections();
    });

    await this.stopping;
  }

  /**
   * @description Return the address used by the server for user-facing logs.
   */
  getBaseUrl(): string {
    return `http://${this.host}:${this.listeningPort}`;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!request.url || !request.method) {
      sendError(response, 400, "Invalid request.");
      return;
    }

    this.applyCorsHeaders(request, response);
    this.applySecurityHeaders(request, response);

    if (request.method === "OPTIONS") {
      sendNoContent(response);
      return;
    }

    const url = new URL(request.url, this.getBaseUrl());
    const pathname = url.pathname;
    const currentUser = this.getAuthenticatedUser(request, url);
    const apiIdentityAuthentication = currentUser
      ? {
          apiIdentity: null,
          error: null,
        }
      : this.authenticateApiIdentityIfPresent(request, url, pathname);
    const currentActor = this.resolveCurrentRecordActor(
      currentUser,
      apiIdentityAuthentication.apiIdentity,
    );

    if (apiIdentityAuthentication.error) {
      sendError(
        response,
        apiIdentityAuthentication.error.statusCode,
        apiIdentityAuthentication.error.message,
      );
      return;
    }

    try {
      if (await this.handleSystemRoutes(request, response, url, pathname, currentActor)) {
        return;
      }

      if (await this.handleAuthRoutes(request, response, url, pathname, currentUser)) {
        return;
      }

      if (
        await this.handleConfigurationRoutes(
          request,
          response,
          url,
          pathname,
          currentActor,
          currentUser,
        )
      ) {
        return;
      }

      if (await this.handleRecordRoutes(request, response, url, pathname, currentActor)) {
        return;
      }

      if (await this.handleStaticRequest(response, pathname)) {
        return;
      }

      sendError(response, 404, "Not found.");
    } catch (error) {
      if (error instanceof MikroLensError) {
        if (error instanceof RateLimitError) {
          response.setHeader("Retry-After", String(error.retryAfterSeconds));
        }

        sendError(response, error.statusCode, error.message);
        return;
      }

      sendError(response, 500, "Unexpected server error.");
    }
  }

  private async handleSystemRoutes(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    pathname: string,
    currentActor: RecordActor | null,
  ): Promise<boolean> {
    if (request.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
      const snapshot = this.healthCheck?.() ?? {};
      const status = snapshot.status ?? "healthy";

      sendJson(response, status === "unhealthy" ? 503 : 200, {
        checks: snapshot.checks ?? {},
        service: "mikrolens-api",
        status,
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    if (request.method === "GET" && pathname === "/openapi.json") {
      sendJson(response, 200, buildOpenApiSchema(this.getPublicApiUrl(request)));
      return true;
    }

    if (request.method === "GET" && pathname === "/api/bootstrap") {
      const recordAccessPolicy = resolveRecordAccessPolicy(this.repository, currentActor);
      sendJson(
        response,
        200,
        getBootstrapSnapshot(this.repository, url.searchParams.get("spaceId") ?? undefined, {
          includeAdministration:
            currentActor?.kind === "user" &&
            hasUserPermission(currentActor.user, MIKROLENS_PERMISSIONS.settings.read),
          recordAccessPolicy,
        }),
      );
      return true;
    }

    if (request.method === "GET" && pathname === "/api/understand") {
      const recordAccessPolicy = resolveRecordAccessPolicy(this.repository, currentActor);
      sendJson(
        response,
        200,
        getUnderstandSnapshot(
          this.repository,
          url.searchParams.get("spaceId") ?? undefined,
          recordAccessPolicy,
        ),
      );
      return true;
    }

    if (request.method === "GET" && pathname === "/api/plan") {
      const recordAccessPolicy = resolveRecordAccessPolicy(this.repository, currentActor);
      sendJson(
        response,
        200,
        getPlanSnapshot(
          this.repository,
          url.searchParams.get("spaceId") ?? undefined,
          recordAccessPolicy,
        ),
      );
      return true;
    }

    return false;
  }

  private async handleAuthRoutes(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    pathname: string,
    currentUser: UserDTO | null,
  ): Promise<boolean> {
    const appUrl = this.getAppUrl(request);
    const apiUrl = this.getPublicApiUrl(request);

    if (
      await handleOAuthAuthHttp({
        buildAuthRedirect: (status, message, email = "") =>
          buildAuthRedirect(appUrl, status, message, email),
        oauthProviders: this.oauthProviders,
        oauthSecurity: this.oauthSecurity,
        pathname,
        repository: this.repository,
        request,
        response,
        auth: this.auth,
        sessionSecurity: this.sessionSecurity,
        url,
      })
    ) {
      return true;
    }

    return handleMagicLinkAuthHttp({
      apiUrl,
      appUrl,
      buildAuthRedirect: (status, message, email = "") =>
        buildAuthRedirect(appUrl, status, message, email),
      currentUser,
      auth: this.auth,
      demoLoginEnabled: this.demoLoginEnabled,
      magicLinkService: this.magicLinkService,
      pathname,
      rateLimiter: this.authRateLimiter,
      repository: this.repository,
      request,
      response,
      sessionSecurity: this.sessionSecurity,
      url,
    });
  }

  private async handleConfigurationRoutes(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    pathname: string,
    currentActor: RecordActor | null,
    currentUser: UserDTO | null,
  ): Promise<boolean> {
    return handleConfigurationRoutesHttp({
      apiUrl: this.getPublicApiUrl(request),
      currentActor,
      currentUser,
      magicLinkService: this.magicLinkService,
      pathname,
      repository: this.repository,
      request,
      response,
      url,
    });
  }

  private async handleRecordRoutes(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    pathname: string,
    currentActor: RecordActor | null,
  ): Promise<boolean> {
    return handleRecordRoutesHttp({
      baseUrl: this.getPublicApiUrl(request),
      collaborationHub: this.collaborationHub,
      currentActor,
      pathname,
      repository: this.repository,
      request,
      response,
      url,
    });
  }

  private async handleStaticRequest(response: ServerResponse, pathname: string): Promise<boolean> {
    if (pathname !== "/" && !extname(pathname) && pathname.startsWith("/api")) {
      return false;
    }

    if (pathname === "/" || !extname(pathname)) {
      return serveStaticFile(response, this.staticRoot, join("/", "index.html"));
    }

    const served = await serveStaticFile(response, this.staticRoot, pathname);

    if (served) {
      return true;
    }

    return serveStaticFile(response, this.staticRoot, join("/", "index.html"));
  }

  private getAppUrl(request: IncomingMessage): string {
    return this.appUrl || this.getPublicApiUrl(request);
  }

  private getPublicApiUrl(request: IncomingMessage): string {
    return getRequestOrigin(request, this.getBaseUrl());
  }

  private getAuthenticatedUser(request: IncomingMessage, url: URL): UserDTO | null {
    const token = readBearerToken(request, url);

    if (token) {
      const user = this.getAuthenticatedUserFromToken(token);

      if (user) {
        return user;
      }
    }

    const session = this.sessionSecurity.readSessionFromCookie(request.headers.cookie);

    if (!session) {
      return null;
    }

    const user = this.repository.getUser(session.userId);

    if (!user || user.email !== session.email) {
      return null;
    }

    return user;
  }

  private getAuthenticatedUserFromToken(token: string): UserDTO | null {
    try {
      const payload = this.auth.verify(token);
      const email = String(payload.email ?? payload.sub ?? "")
        .trim()
        .toLowerCase();

      if (!email) {
        return null;
      }

      const user = this.repository.getUserByEmail(email);

      return user?.status === "Active" ? user : null;
    } catch {
      return null;
    }
  }

  private authenticateApiIdentityIfPresent(
    request: IncomingMessage,
    url: URL,
    pathname: string,
  ): {
    apiIdentity: ApiIdentityDTO | null;
    error: { message: string; statusCode: number } | null;
  } {
    if (!pathname.startsWith("/api")) {
      return {
        apiIdentity: null,
        error: null,
      };
    }

    const authorization = request.headers.authorization;
    const queryToken = url.searchParams.get("access_token") ?? "";

    if (!authorization && !queryToken) {
      return {
        apiIdentity: null,
        error: null,
      };
    }

    const [scheme, headerToken] = authorization?.split(" ") ?? [];
    const token = queryToken || headerToken;

    if (!queryToken && (scheme !== "Bearer" || !token)) {
      return {
        apiIdentity: null,
        error: {
          message: "Authorization must use the Bearer scheme.",
          statusCode: 401,
        },
      };
    }

    const apiIdentity = this.repository.findApiIdentityByTokenHash(hashApiIdentityToken(token));

    if (!apiIdentity) {
      return {
        apiIdentity: null,
        error: {
          message: "Invalid API identity token.",
          statusCode: 401,
        },
      };
    }

    if (apiIdentity.status !== "Active") {
      return {
        apiIdentity: null,
        error: {
          message: `API identity is ${apiIdentity.status.toLowerCase()}.`,
          statusCode: 403,
        },
      };
    }

    recordApiIdentityUsage(this.repository, apiIdentity, new Date().toISOString());

    return {
      apiIdentity,
      error: null,
    };
  }

  private resolveCurrentRecordActor(
    currentUser: UserDTO | null,
    currentApiIdentity: ApiIdentityDTO | null,
  ): RecordActor | null {
    if (currentApiIdentity) {
      return {
        identity: currentApiIdentity,
        kind: "api-identity",
      };
    }

    if (currentUser) {
      return {
        kind: "user",
        user: currentUser,
      };
    }

    return null;
  }

  private applyCorsHeaders(request: IncomingMessage, response: ServerResponse): void {
    const origin = normalizeOrigin(readOriginHeader(request));
    const apiOrigin = normalizeOrigin(this.getPublicApiUrl(request));

    if (!origin) {
      return;
    }

    if (origin !== apiOrigin && !this.allowedOrigins.has(origin)) {
      return;
    }

    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", appendVaryValue(response.getHeader("Vary"), "Origin"));
  }

  private applySecurityHeaders(request: IncomingMessage, response: ServerResponse): void {
    response.setHeader(
      "Content-Security-Policy",
      buildContentSecurityPolicy(this.getPublicApiUrl(request)),
    );
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
  }
}

function buildContentSecurityPolicy(apiOrigin: string): string {
  const connectOrigins = [
    "'self'",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https:",
    normalizeOrigin(apiOrigin),
  ].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src ${Array.from(new Set(connectOrigins)).join(" ")}`,
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join("; ");
}

function readOriginHeader(request: IncomingMessage): string {
  const origin = request.headers.origin;

  if (Array.isArray(origin)) {
    return origin[0] ?? "";
  }

  return origin ?? "";
}

function normalizeOrigin(value: string): string {
  if (!value.trim()) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function readBearerToken(request: IncomingMessage, url: URL): string {
  const queryToken = url.searchParams.get("access_token") ?? "";

  if (queryToken.trim()) {
    return queryToken.trim();
  }

  const authorization = request.headers.authorization;

  if (!authorization) {
    return "";
  }

  const [scheme, token] = authorization.split(" ");

  return scheme === "Bearer" && token ? token.trim() : "";
}

function appendVaryValue(
  currentValue: number | string | string[] | undefined,
  nextValue: string,
): string {
  const values = new Set(
    (Array.isArray(currentValue) ? currentValue.join(",") : `${currentValue ?? ""}`)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  values.add(nextValue);

  return [...values].join(", ");
}

function buildOpenApiSchema(origin: string): unknown {
  const schema = structuredClone(openApiSchemaTemplate) as {
    servers?: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(schema.servers)) {
    return schema;
  }

  schema.servers = schema.servers.map((server) => ({
    ...server,
    url: server.url === "__MIKROLENS_BASE_URL__" ? origin : server.url,
  }));

  return schema;
}
