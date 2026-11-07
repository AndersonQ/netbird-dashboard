import { describe, expect, it } from "vitest";
import { buildTools } from "./index";
import { makeDeps } from "./testUtils";

describe("webmcp tool registry", () => {
  it("tool names are unique and prefixed", () => {
    const names = buildTools(makeDeps().deps).map((t) => t.tool.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((n) => expect(n).toMatch(/^netbird_[a-z_]+$/));
  });

  it("every write tool needs a permission and is marked consequential", () => {
    buildTools(makeDeps().deps)
      .filter((t) => !t.tool.annotations?.readOnlyHint)
      .forEach((t) => {
        expect(t.permission, t.tool.name).toBeDefined();
        expect(t.tool.annotations?.consequentialHint, t.tool.name).toBe(true);
      });
  });
});
