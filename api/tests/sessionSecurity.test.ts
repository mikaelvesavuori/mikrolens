import { SessionSecurity } from "../src/infrastructure/security/SessionSecurity.ts";

describe("SessionSecurity", () => {
  const user = {
    email: "amina@example.com",
    id: "user_amina",
  };

  it("uses Lax cookies for local app and API ports on loopback hosts", () => {
    const security = new SessionSecurity("test-secret", 60, {
      appUrl: "http://127.0.0.1:8000",
      sameSite: "auto",
    });

    const cookie = security.createSessionCookie(user, false, 0, "http://localhost:8000");

    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("uses secure None cookies for genuinely cross-site deployments", () => {
    const security = new SessionSecurity("test-secret", 60, {
      appUrl: "https://app.example.com",
      sameSite: "auto",
    });

    const cookie = security.createSessionCookie(user, false, 0, "https://other.example.net");

    expect(cookie).toContain("SameSite=None");
    expect(cookie).toContain("Secure");
  });
});
