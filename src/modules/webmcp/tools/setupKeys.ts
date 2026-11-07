// Setup key tools: list, create and delete keys used to enroll machines.

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

export function setupKeyTools(deps: ToolDeps): ToolSpec[] {
  const { api } = deps;
  return [
    {
      permission: { module: "setup_keys", op: "read" },
      tool: {
        name: "netbird_list_setup_keys",
        title: "List setup keys",
        description:
          "Lists setup keys (used to enroll new machines). Key secrets are not returned.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () =>
          run(async () =>
            (await api.get<any[]>("/setup-keys")).map((k) => ({
              id: k.id,
              name: k.name,
              type: k.type,
              state: k.state,
              valid: k.valid,
              expires: k.expires,
              used_times: k.used_times,
              usage_limit: k.usage_limit,
              ephemeral: k.ephemeral,
              auto_groups: k.auto_groups,
            })),
          ),
      },
    },
    {
      permission: { module: "setup_keys", op: "create" },
      tool: {
        name: "netbird_create_setup_key",
        title: "Create setup key",
        description:
          "Creates a setup key for enrolling machines. Peers enrolled with it join the given groups. The key secret is returned to the assistant after the user approves.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: {
              type: "string",
              enum: ["one-off", "reusable"],
              default: "one-off",
            },
            expires_in_days: {
              type: "integer",
              minimum: 1,
              maximum: 365,
              default: 7,
            },
            auto_groups: { type: "array", items: idOrName("Group") },
            usage_limit: {
              type: "integer",
              minimum: 0,
              default: 0,
              description: "0 = unlimited (reusable only)",
            },
            ephemeral: { type: "boolean", default: false },
          },
          required: ["name"],
        },
        annotations: { consequentialHint: true },
        execute: (input) =>
          run(async () => {
            const name = str(input.name);
            const type = input.type === "reusable" ? "reusable" : "one-off";
            const days = Number(input.expires_in_days) || 7;
            const auto_groups = await resolveGroupIds(
              deps,
              strArray(input.auto_groups),
            );
            await requireConfirm(
              deps,
              `Create ${type} setup key "${name}"?`,
              `Expires in ${days} day(s). Groups: ${
                strArray(input.auto_groups).join(", ") || "none"
              }.\nThe key will also be visible to the assistant.`,
            );
            const res = await api.post("/setup-keys", {
              name,
              type,
              expires_in: days * 24 * 60 * 60,
              auto_groups,
              usage_limit:
                type === "one-off" ? 1 : Number(input.usage_limit) || 0,
              ephemeral: !!input.ephemeral,
              allow_extra_dns_labels: false,
            });
            deps.refresh(["/setup-keys"]);
            deps.announce(name, "Setup key created by assistant");
            return {
              id: res.id,
              name: res.name,
              key: res.key,
              expires: res.expires,
            };
          }),
      },
    },
    {
      permission: { module: "setup_keys", op: "delete" },
      tool: {
        name: "netbird_delete_setup_key",
        title: "Delete setup key",
        description:
          "Deletes a setup key. Already-enrolled peers are not affected. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: { setup_key: idOrName("Setup key") },
          required: ["setup_key"],
        },
        annotations: { consequentialHint: true, destructiveHint: true },
        execute: ({ setup_key }) =>
          run(async () => {
            const k = findByIdOrName(
              await api.get<any[]>("/setup-keys"),
              str(setup_key),
              "Setup key",
            );
            await requireConfirm(
              deps,
              `Delete setup key "${k.name}"?`,
              "New machines can no longer enroll with it.",
              true,
            );
            await api.del(`/setup-keys/${k.id}`);
            deps.refresh(["/setup-keys"]);
            deps.announce(k.name, "Setup key deleted by assistant");
            return `Deleted setup key ${k.name}`;
          }),
      },
    },
  ];
}
