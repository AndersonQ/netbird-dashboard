// Group tools: list, create, change membership and delete peer groups.

import {
  findByIdOrName,
  idOrName,
  requireConfirm,
  run,
  str,
  strArray,
} from "./helpers";
import { resolvePeer } from "./peers";
import type { ToolDeps, ToolSpec } from "./types";

type GroupLite = {
  id: string;
  name: string;
  peers?: any[];
  resources?: any[];
};

/** Accepts group IDs or names (case-insensitive) and returns IDs. */
export async function resolveGroupIds(
  deps: ToolDeps,
  refs: string[],
): Promise<string[]> {
  if (refs.length === 0) return [];
  const groups = await deps.api.get<GroupLite[]>("/groups");
  return refs.map((ref) => findByIdOrName(groups, ref, "Group").id);
}

async function resolveGroup(deps: ToolDeps, ref: string): Promise<GroupLite> {
  const [id] = await resolveGroupIds(deps, [ref]);
  return deps.api.get<GroupLite>(`/groups/${id}`);
}

const projectGroup = (g: any) => ({
  id: g.id,
  name: g.name,
  peers_count: g.peers_count,
  resources_count: g.resources_count,
  issued: g.issued,
});

export function groupTools(deps: ToolDeps): ToolSpec[] {
  const { api } = deps;
  return [
    {
      permission: { module: "groups", op: "read" },
      tool: {
        name: "netbird_list_groups",
        title: "List groups",
        description: "Lists peer groups with their peer and resource counts.",
        inputSchema: {
          type: "object",
          properties: { search: { type: "string" } },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ search }) =>
          run(async () => {
            const q = str(search).toLowerCase();
            return (await api.get<any[]>("/groups"))
              .map(projectGroup)
              .filter((g) => !q || g.name.toLowerCase().includes(q));
          }),
      },
    },
    {
      permission: { module: "groups", op: "create" },
      tool: {
        name: "netbird_create_group",
        title: "Create group",
        description:
          "Creates a peer group, optionally with initial peers. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            peers: { type: "array", items: idOrName("Peer") },
          },
          required: ["name"],
        },
        annotations: { consequentialHint: true },
        execute: ({ name, peers }) =>
          run(async () => {
            const groupName = str(name);
            if (!groupName) throw new Error("name is required");
            const resolved = await Promise.all(
              strArray(peers).map((p) => resolvePeer(deps, p)),
            );
            await requireConfirm(
              deps,
              `Create group "${groupName}"?`,
              resolved.length
                ? `With peers: ${resolved.map((p) => p.name).join(", ")}`
                : "The group will be empty.",
            );
            const res = await api.post("/groups", {
              name: groupName,
              peers: resolved.map((p) => p.id),
            });
            deps.refresh(["/groups"]);
            deps.announce(groupName, "Group created by assistant");
            return projectGroup(res);
          }),
      },
    },
    {
      permission: { module: "groups", op: "update" },
      tool: {
        name: "netbird_set_group_membership",
        title: "Add/remove peers in a group",
        description:
          "Adds and/or removes peers in an existing group. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: {
            group: idOrName("Group"),
            add_peers: { type: "array", items: idOrName("Peer") },
            remove_peers: { type: "array", items: idOrName("Peer") },
          },
          required: ["group"],
        },
        annotations: { consequentialHint: true },
        execute: ({ group, add_peers, remove_peers }) =>
          run(async () => {
            const g = await resolveGroup(deps, str(group));
            if (g.name === "All")
              throw new Error('The "All" group is managed by NetBird.');
            const add = await Promise.all(
              strArray(add_peers).map((p) => resolvePeer(deps, p)),
            );
            const remove = await Promise.all(
              strArray(remove_peers).map((p) => resolvePeer(deps, p)),
            );
            const ids = new Set((g.peers ?? []).map((p: any) => p.id ?? p));
            add.forEach((p) => ids.add(p.id));
            remove.forEach((p) => ids.delete(p.id));
            const lines = [
              add.length ? `Add: ${add.map((p) => p.name).join(", ")}` : "",
              remove.length
                ? `Remove: ${remove.map((p) => p.name).join(", ")}`
                : "",
            ].filter(Boolean);
            if (!lines.length) return "Nothing to change.";
            await requireConfirm(
              deps,
              `Change members of group "${g.name}"?`,
              lines.join("\n"),
            );
            const res = await api.put(`/groups/${g.id}`, {
              name: g.name,
              peers: Array.from(ids),
              resources: g.resources ?? [],
            });
            deps.refresh(["/groups", "/peers"]);
            deps.announce(g.name, "Group membership changed by assistant");
            return projectGroup(res);
          }),
      },
    },
    {
      permission: { module: "groups", op: "delete" },
      tool: {
        name: "netbird_delete_group",
        title: "Delete group",
        description:
          "Deletes a group. Fails if policies, routes or setup keys still use it. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: { group: idOrName("Group") },
          required: ["group"],
        },
        annotations: { consequentialHint: true, destructiveHint: true },
        execute: ({ group }) =>
          run(async () => {
            const g = await resolveGroup(deps, str(group));
            await requireConfirm(
              deps,
              `Delete group "${g.name}"?`,
              `The assistant wants to delete the group ${g.name}. Peers stay in the network but lose access granted through this group.`,
              true,
            );
            await api.del(`/groups/${g.id}`);
            deps.refresh(["/groups"]);
            deps.announce(g.name, "Group deleted by assistant");
            return `Deleted group ${g.name}`;
          }),
      },
    },
  ];
}
