// Audit event tools (read-only): who changed what, when.

import { run } from "./helpers";
import type { ToolDeps, ToolSpec } from "./types";

export function eventTools(deps: ToolDeps): ToolSpec[] {
  const { api } = deps;
  return [
    {
      permission: { module: "events", op: "read" },
      tool: {
        name: "netbird_list_audit_events",
        title: "Recent audit events",
        description:
          "Returns the most recent audit log events (who changed what, when).",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, default: 25 },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ limit }) =>
          run(async () => {
            const events = await api.get<any[]>("/events/audit");
            return events.slice(0, Number(limit) || 25).map((e) => ({
              timestamp: e.timestamp,
              activity: e.activity,
              initiator:
                e.initiator_email || e.initiator_name || e.initiator_id,
              target_id: e.target_id,
              meta: e.meta,
            }));
          }),
      },
    },
  ];
}
