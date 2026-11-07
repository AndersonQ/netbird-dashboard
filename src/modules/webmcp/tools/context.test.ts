import { describe, expect, it } from "vitest";
import { contextTools } from "./context";
import { findTool, makeDeps } from "./testUtils";

describe("webmcp context tools", () => {
  it("navigate only accepts known pages", async () => {
    const { deps } = makeDeps();
    const nav = findTool(contextTools(deps), "netbird_navigate");
    expect((await nav.execute({ page: "javascript:alert(1)" })).isError).toBe(
      true,
    );
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it("navigate requires an id for detail pages", async () => {
    const { deps } = makeDeps();
    const nav = findTool(contextTools(deps), "netbird_navigate");
    expect((await nav.execute({ page: "peer" })).isError).toBe(true);
    await nav.execute({ page: "peer", id: "p1" });
    expect(deps.navigate).toHaveBeenCalledWith("/peer?id=p1");
  });
});
