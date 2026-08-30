import { describe, expect, it } from "vitest";
import { initialItems, valueOf } from "./firebaseRest";

describe("Firebase REST catalog adapter", () => {
  it("keeps six safe fallback items", () => {
    expect(initialItems).toHaveLength(6);
    expect(new Set(initialItems.map(item => item.id)).size).toBe(6);
    expect(initialItems.every(item => item.fileName.endsWith(".package"))).toBe(true);
  });

  it("converts Firestore REST primitive and map values", () => {
    expect(valueOf({ stringValue: "green" })).toBe("green");
    expect(valueOf({ integerValue: "6" })).toBe(6);
    expect(valueOf({ booleanValue: true })).toBe(true);
    expect(valueOf({ mapValue: { fields: { title: { stringValue: "Aviso" } } } })).toEqual({ title: "Aviso" });
  });
});
