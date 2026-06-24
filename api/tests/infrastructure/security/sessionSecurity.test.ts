import { SessionSecurity } from "../../../src/infrastructure/security/SessionSecurity.ts";

describe("SessionSecurity", () => {
  it("creates secure session cookies and reads them back from cookie headers", () => {
    const now = Date.parse("2024-01-01T00:00:00.000Z");
    const security = new SessionSecurity("test-session-secret", 60);
    const cookie = security.createSessionCookie(
      {
        email: "sam.person@example.com",
        id: "user_session_1",
      },
      true,
      now,
    );

    expect(cookie).toContain("mikrolens_session=");
    expect(cookie).toContain("Max-Age=60");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(security.readSessionFromCookie([cookie, "theme=dark"], now + 500)).toEqual({
      email: "sam.person@example.com",
      userId: "user_session_1",
    });
  });

  it("rejects tampered or expired session tokens", () => {
    const now = Date.parse("2024-01-01T00:00:00.000Z");
    const security = new SessionSecurity("test-session-secret", 1);
    const cookie = security.createSessionCookie(
      {
        email: "sam.person@example.com",
        id: "user_session_2",
      },
      false,
      now,
    );
    const token = extractCookieValue(cookie);
    const [payload, signature] = token.split(".");

    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();

    const tamperedSignature = `${signature?.slice(0, -1)}${signature?.endsWith("0") ? "1" : "0"}`;
    const tamperedToken = `${payload}.${tamperedSignature}`;

    expect(security.readSession(tamperedToken, now + 500)).toBeNull();
    expect(security.readSession(token, now + 1_500)).toBeNull();
  });

  it("serializes a clearing cookie that expires immediately", () => {
    const security = new SessionSecurity("test-session-secret");
    const cookie = security.clearSessionCookie(true);

    expect(cookie).toContain("mikrolens_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("uses SameSite=None for split frontend and API origins in auto mode", () => {
    const security = new SessionSecurity("test-session-secret", 60, {
      appUrl: "https://app.example.com",
    });
    const cookie = security.createSessionCookie(
      {
        email: "sam.person@example.com",
        id: "user_session_3",
      },
      true,
      Date.parse("2024-01-01T00:00:00.000Z"),
      "https://api.example.com",
    );

    expect(cookie).toContain("SameSite=None");
    expect(cookie).toContain("Secure");
  });
});

function extractCookieValue(cookie: string): string {
  const match = cookie.match(/mikrolens_session=([^;]+)/);

  if (!match?.[1]) {
    throw new Error("Expected a session cookie value.");
  }

  return decodeURIComponent(match[1]);
}
