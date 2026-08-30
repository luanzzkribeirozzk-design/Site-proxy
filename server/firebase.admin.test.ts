import { createSign } from "node:crypto";
import { describe, expect, it } from "vitest";

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("Firebase Admin service account", () => {
  it("authenticates with the complete official JSON without mutating data", async () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    expect(raw, "FIREBASE_SERVICE_ACCOUNT_JSON must be configured").toBeTruthy();

    let credentials: {
      type?: string;
      client_email?: string;
      private_key?: string;
      token_uri?: string;
    };
    try {
      credentials = JSON.parse(raw!) as typeof credentials;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }

    expect(credentials.type).toBe("service_account");
    expect(credentials.client_email).toMatch(/@.*\.iam\.gserviceaccount\.com$/);
    expect(credentials.private_key).toContain("BEGIN PRIVATE KEY");

    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64Url(
      JSON.stringify({
        iss: credentials.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: credentials.token_uri ?? "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 300,
      }),
    );
    const unsigned = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${base64Url(signer.sign(credentials.private_key!))}`;

    const response = await fetch(
      credentials.token_uri ?? "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      },
    );

    const body = (await response.json()) as { access_token?: string };
    expect(response.status).toBe(200);
    expect(body.access_token).toBeTruthy();
  });
});

