import { describe, expect, it } from "vitest";

describe("Firebase Web configuration", () => {
  it("reaches Firebase Authentication with the configured public API key", async () => {
    const apiKey = process.env.VITE_FIREBASE_API_KEY;

    expect(apiKey, "VITE_FIREBASE_API_KEY must be configured").toBeTruthy();

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey!)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );

    const body = (await response.json()) as {
      error?: { message?: string };
    };

    // Empty input is intentional and has no side effect. Firebase should
    // recognize the key and reject only the missing token.
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("MISSING_ID_TOKEN");
  });
});

