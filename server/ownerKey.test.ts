import { describe, expect, it } from "vitest";
import { isOwnerPanelKeyValid } from "./ownerKey";

describe("owner panel key", () => {
  it("accepts the configured key through the protected check", () => {
    const configured = "owner-panel-test-key-2026";
    expect(isOwnerPanelKeyValid(configured, configured)).toBe(true);
    expect(isOwnerPanelKeyValid("wrong-key", configured)).toBe(false);
  });
});
