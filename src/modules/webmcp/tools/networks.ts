// Network tools (read-only): networks and the resources they route.

import { run } from "./helpers";
import type { ToolDeps, ToolSpec } from "./types";

export function networkTools(deps: ToolDeps): ToolSpec[] {
  const { api } = deps;
  return [
    {
      permission: { module: "networks", op: "read" },
      tool: {
        name: "netbird_list_networks",
        title: "List networks",
        description:
          "Lists networks (sets of routed resources such as subnets or domains) with their resources.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () =>
          run(async () => {
            const networks = await api.get<any[]>("/networks");
            return Promise.all(
              networks.map(async (n) => ({
                id: n.id,
                name: n.name,
                description: n.description,
                routing_peers_count: n.routing_peers_count,
                resources: (
                  await api
                    .get<any[]>(`/networks/${n.id}/resources`)
                    .catch(() => [])
                ).map((r) => ({
                  name: r.name,
                  address: r.address,
                  enabled: r.enabled,
                })),
              })),
            );
          }),
      },
    },
  ];
}
