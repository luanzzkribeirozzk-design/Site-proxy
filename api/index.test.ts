import { describe, expect, it } from "vitest";
import handler from "./index";

describe("owner verification endpoint", () => {
  it("authorizes only the configured key", async () => {
    const previous = process.env.OWNER_PANEL_KEY;
    process.env.OWNER_PANEL_KEY = "owner-panel-test-key-2026";
    try {
      const responses: unknown[] = [];
      const response = {
        status: () => response,
        json: (value: unknown) => { responses.push(value); return response; },
      } as never;
      await handler({ url: "/api/owner/verify", body: { key: "owner-panel-test-key-2026" } } as never, response);
      expect(responses).toEqual([{ authorized: true }]);
    } finally {
      process.env.OWNER_PANEL_KEY = previous;
    }
  });
});
