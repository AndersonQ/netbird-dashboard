import { describe, expect, it } from "vitest";
import { groupTools, resolveGroupIds } from "./groups";
import { findTool, makeDeps } from "./testUtils";

describe("webmcp group tools", () => {
  it("resolves group names case-insensitively and fails on unknown", async () => {
    const { deps } = makeDeps();
    await expect(resolveGroupIds(deps, ["DEVS", "g1"])).resolves.toEqual([
      "g2",
      "g1",
    ]);
    await expect(resolveGroupIds(deps, ["nope"])).rejects.toThrow(/not found/);
  });

  it("adds a peer to a group keeping existing members", async () => {
    const { deps, api } = makeDeps(true);
    await findTool(groupTools(deps), "netbird_set_group_membership").execute({
      group: "devs",
      add_peers: ["db-1"],
    });
    expect(api.put).toHaveBeenCalledWith("/groups/g2", {
      name: "devs",
      peers: ["p1", "p2"],
      resources: [],
    });
  });

  it("refuses to change the All group", async () => {
    const { deps, api } = makeDeps(true);
    const res = await findTool(
      groupTools(deps),
      "netbird_set_group_membership",
    ).execute({ group: "All", remove_peers: ["db-1"] });
    expect(res.isError).toBe(true);
    expect(api.put).not.toHaveBeenCalled();
  });
});
