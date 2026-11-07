import { describe, expect, it } from "vitest";
import { policyTools } from "./policies";
import { findTool, makeDeps } from "./testUtils";

describe("webmcp policy tools", () => {
  it("creates a policy with group names resolved to IDs", async () => {
    const { deps, api } = makeDeps(true);
    await findTool(policyTools(deps), "netbird_create_policy").execute({
      name: "devs-ssh",
      sources: ["devs"],
      destinations: ["All"],
      protocol: "tcp",
      ports: ["22"],
    });
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/policies");
    expect(body.rules[0]).toMatchObject({
      sources: ["g2"],
      destinations: ["g1"],
      protocol: "tcp",
      ports: ["22"],
    });
  });

  it("disables a policy sending group IDs, not objects", async () => {
    const { deps, api } = makeDeps(true);
    await findTool(policyTools(deps), "netbird_set_policy_enabled").execute({
      policy: "devs-to-all",
      enabled: false,
    });
    const [path, body] = api.put.mock.calls[0];
    expect(path).toBe("/policies/pol1");
    expect(body.enabled).toBe(false);
    expect(body.rules[0].sources).toEqual(["g2"]);
  });

  it("does not delete when the user declines", async () => {
    const { deps, api } = makeDeps(false);
    const res = await findTool(
      policyTools(deps),
      "netbird_delete_policy",
    ).execute({ policy: "devs-to-all" });
    expect(res.isError).toBe(true);
    expect(api.del).not.toHaveBeenCalled();
  });
});
