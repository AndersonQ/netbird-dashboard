import { describe, expect, it } from "vitest";
import { peerTools } from "./peers";
import { findTool, makeDeps } from "./testUtils";

describe("webmcp peer tools", () => {
  it("filters peers by search and status", async () => {
    const { deps } = makeDeps();
    const res = await findTool(peerTools(deps), "netbird_list_peers").execute({
      search: "alice",
      connected: true,
    });
    const out = JSON.parse(res.content[0].text);
    expect(out.map((p: any) => p.id)).toEqual(["p1"]);
  });

  it("deletes a peer only after confirmation", async () => {
    const { deps, api } = makeDeps(true);
    const res = await findTool(peerTools(deps), "netbird_delete_peer").execute({
      peer: "db-1",
    });
    expect(res.isError).toBeFalsy();
    expect(deps.confirm).toHaveBeenCalledOnce();
    expect(api.del).toHaveBeenCalledWith("/peers/p2");
    expect(deps.refresh).toHaveBeenCalled();
  });

  it("does not delete when the user declines", async () => {
    const { deps, api } = makeDeps(false);
    const res = await findTool(peerTools(deps), "netbird_delete_peer").execute({
      peer: "db-1",
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/declined/);
    expect(api.del).not.toHaveBeenCalled();
  });

  it("finds a peer by hostname", async () => {
    const { deps, api } = makeDeps(true);
    await findTool(peerTools(deps), "netbird_delete_peer").execute({
      peer: "ALICE-MBP",
    });
    expect(api.del).toHaveBeenCalledWith("/peers/p1");
  });
});
