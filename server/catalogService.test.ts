import { describe, expect, it } from "vitest";
import { getManifest, initialItems } from "./catalogService";

describe("catalog manifest", () => {
  it("defines six distinct initial catalog records", () => {
    expect(initialItems).toHaveLength(6);
    expect(new Set(initialItems.map(item => item.id)).size).toBe(6);
    expect(initialItems.every(item => item.available && !item.archived)).toBe(true);
  });

  it("returns the public manifest shape without administrative fields", async () => {
    const manifest = await getManifest();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.items).toHaveLength(6);
    expect(manifest.items.every(item => item.id && item.name && item.status)).toBe(true);
    expect(manifest.items.every(item => !("privateKey" in item))).toBe(true);
  });
});

