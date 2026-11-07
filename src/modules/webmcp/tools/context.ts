// Tools that tell the agent who the user is and let it open dashboard pages.

import { fail, ok } from "../result";
import { run, str } from "./helpers";
import type { ToolDeps, ToolSpec } from "./types";

// Pages the agent may open. Never pass agent-provided URLs to the router.
export const PAGES: Record<string, (id?: string) => string> = {
  peers: () => "/peers",
  peer: (id) => `/peer?id=${encodeURIComponent(id ?? "")}`,
  groups: () => "/groups",
  group: (id) => `/group?id=${encodeURIComponent(id ?? "")}`,
  policies: () => "/access-control",
  posture_checks: () => "/posture-checks",
  networks: () => "/networks",
  network_routes: () => "/network-routes",
  dns_nameservers: () => "/dns/nameservers",
  dns_zones: () => "/dns/zones",
  dns_settings: () => "/dns/settings",
  setup_keys: () => "/setup-keys",
  users: () => "/team/users",
  service_users: () => "/team/service-users",
  audit_events: () => "/events/audit",
  traffic_events: () => "/events/traffic",
  settings: () => "/settings",
  control_center: () => "/control-center",
};

const PAGES_WITH_ID = new Set(["peer", "group"]);

export function contextTools(deps: ToolDeps): ToolSpec[] {
  return [
    {
      tool: {
        name: "netbird_get_current_user",
        title: "Who am I",
        description:
          "Returns the logged-in NetBird dashboard user: name, email, role and account ID.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        execute: () =>
          run(async () => {
            const u = await deps.api.get("/users/current");
            return {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              account_id: u.account_id ?? u.permissions?.account_id,
            };
          }),
      },
    },
    {
      tool: {
        name: "netbird_navigate",
        title: "Open dashboard page",
        description:
          "Opens a page of the NetBird dashboard so the user can see it. Use 'peer' or 'group' with an id to open a detail page.",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "string", enum: Object.keys(PAGES) },
            id: {
              type: "string",
              description: "Required for 'peer' and 'group'",
            },
          },
          required: ["page"],
        },
        annotations: { readOnlyHint: true },
        execute: async ({ page, id }) => {
          const build = PAGES[page as string];
          if (!build) return fail(`Unknown page "${page}"`);
          if (PAGES_WITH_ID.has(page) && !str(id))
            return fail(`Page "${page}" needs an id`);
          const path = build(str(id));
          deps.navigate(path);
          return ok(`Opened ${path}`);
        },
      },
    },
  ];
}
