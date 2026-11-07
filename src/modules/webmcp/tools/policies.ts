// Access control policy tools: list, create, enable/disable and delete.

import { resolveGroupIds } from "./groups";
import {
  findByIdOrName,
  idOrName,
  requireConfirm,
  run,
  str,
  strArray,
} from "./helpers";
import type { ToolDeps, ToolSpec } from "./types";

const projectPolicy = (p: any) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  enabled: p.enabled,
  rules: (p.rules ?? []).map((r: any) => ({
    name: r.name,
    action: r.action,
    protocol: r.protocol,
    ports: r.ports,
    bidirectional: r.bidirectional,
    sources: (r.sources ?? []).map((g: any) => g.name ?? g),
    destinations: (r.destinations ?? []).map((g: any) => g.name ?? g),
  })),
});

async function findPolicy(deps: ToolDeps, ref: string) {
  return findByIdOrName(await deps.api.get<any[]>("/policies"), ref, "Policy");
}

/** GET returns groups and posture checks as objects; PUT wants IDs. */
export const toPolicyRequest = (p: any, enabled: boolean) => ({
  ...p,
  enabled,
  source_posture_checks: (p.source_posture_checks ?? []).map(
    (c: any) => c.id ?? c,
  ),
  rules: (p.rules ?? []).map((r: any) => ({
    ...r,
    sources: r.sources?.map((g: any) => g.id ?? g) ?? null,
    destinations: r.destinations?.map((g: any) => g.id ?? g) ?? null,
  })),
});

export function policyTools(deps: ToolDeps): ToolSpec[] {
  const { api } = deps;
  return [
    {
      permission: { module: "policies", op: "read" },
      tool: {
        name: "netbird_list_policies",
        title: "List access policies",
        description:
          "Lists access control policies: which source groups may reach which destination groups, on which protocol/ports.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () =>
          run(async () =>
            (await api.get<any[]>("/policies")).map(projectPolicy),
          ),
      },
    },
    {
      permission: { module: "policies", op: "create" },
      tool: {
        name: "netbird_create_policy",
        title: "Create access policy",
        description:
          "Creates an access control policy allowing source groups to reach destination groups. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            sources: { type: "array", items: idOrName("Group"), minItems: 1 },
            destinations: {
              type: "array",
              items: idOrName("Group"),
              minItems: 1,
            },
            protocol: {
              type: "string",
              enum: ["all", "tcp", "udp", "icmp"],
              default: "all",
            },
            ports: {
              type: "array",
              items: { type: "string" },
              description: 'Only for tcp/udp, e.g. ["22", "443"]',
            },
            bidirectional: { type: "boolean", default: true },
            enabled: { type: "boolean", default: true },
          },
          required: ["name", "sources", "destinations"],
        },
        annotations: { consequentialHint: true },
        execute: (input) =>
          run(async () => {
            const sources = await resolveGroupIds(
              deps,
              strArray(input.sources),
            );
            const destinations = await resolveGroupIds(
              deps,
              strArray(input.destinations),
            );
            if (!sources.length || !destinations.length)
              throw new Error(
                "sources and destinations need at least one group",
              );
            const protocol = str(input.protocol) || "all";
            const ports =
              protocol === "tcp" || protocol === "udp"
                ? strArray(input.ports)
                : [];
            const bidirectional = input.bidirectional ?? true;
            const name = str(input.name);
            const body = {
              name,
              description: str(input.description),
              enabled: input.enabled ?? true,
              source_posture_checks: [],
              rules: [
                {
                  name,
                  description: str(input.description),
                  enabled: true,
                  action: "accept",
                  bidirectional,
                  protocol,
                  ports,
                  sources,
                  destinations,
                },
              ],
            };
            await requireConfirm(
              deps,
              `Create policy "${name}"?`,
              `${strArray(input.sources).join(", ")} ${
                bidirectional ? "⇄" : "→"
              } ${strArray(input.destinations).join(
                ", ",
              )}\nProtocol: ${protocol}${
                ports.length ? `, ports ${ports.join(", ")}` : ""
              }`,
            );
            const res = await api.post("/policies", body);
            deps.refresh(["/policies"]);
            deps.announce(name, "Policy created by assistant");
            return projectPolicy(res);
          }),
      },
    },
    {
      permission: { module: "policies", op: "update" },
      tool: {
        name: "netbird_set_policy_enabled",
        title: "Enable/disable policy",
        description:
          "Enables or disables an access policy. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: {
            policy: idOrName("Policy"),
            enabled: { type: "boolean" },
          },
          required: ["policy", "enabled"],
        },
        annotations: { consequentialHint: true },
        execute: ({ policy, enabled }) =>
          run(async () => {
            const p = await findPolicy(deps, str(policy));
            await requireConfirm(
              deps,
              `${enabled ? "Enable" : "Disable"} policy "${p.name}"?`,
              enabled
                ? "Traffic allowed by this policy will start flowing."
                : "Traffic allowed only by this policy will be blocked.",
              !enabled,
            );
            const res = await api.put(
              `/policies/${p.id}`,
              toPolicyRequest(p, !!enabled),
            );
            deps.refresh(["/policies"]);
            deps.announce(
              p.name,
              `Policy ${enabled ? "enabled" : "disabled"} by assistant`,
            );
            return projectPolicy(res);
          }),
      },
    },
    {
      permission: { module: "policies", op: "delete" },
      tool: {
        name: "netbird_delete_policy",
        title: "Delete access policy",
        description: "Deletes an access policy. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: { policy: idOrName("Policy") },
          required: ["policy"],
        },
        annotations: { consequentialHint: true, destructiveHint: true },
        execute: ({ policy }) =>
          run(async () => {
            const p = await findPolicy(deps, str(policy));
            await requireConfirm(
              deps,
              `Delete policy "${p.name}"?`,
              "Traffic allowed only by this policy will be blocked.",
              true,
            );
            await api.del(`/policies/${p.id}`);
            deps.refresh(["/policies"]);
            deps.announce(p.name, "Policy deleted by assistant");
            return `Deleted policy ${p.name}`;
          }),
      },
    },
  ];
}
