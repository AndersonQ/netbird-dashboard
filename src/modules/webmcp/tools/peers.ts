// Peer tools: list, inspect, update and delete machines in the network.

import { idOrName, requireConfirm, run, str } from "./helpers";
import type { ToolDeps, ToolSpec } from "./types";

type PeerLite = { id: string; name: string; [k: string]: any };

/** Accepts a peer ID, name or hostname (case-insensitive) and returns the peer. */
export async function resolvePeer(
  deps: ToolDeps,
  ref: string,
): Promise<PeerLite> {
  const peers = await deps.api.get<PeerLite[]>("/peers");
  const lower = ref.toLowerCase();
  const p =
    peers.find((x) => x.id === ref) ??
    peers.find((x) => x.name.toLowerCase() === lower) ??
    peers.find((x) => x.hostname?.toLowerCase() === lower);
  if (!p) throw new Error(`Peer not found: "${ref}"`);
  return p;
}

/** Trims a peer to the fields an agent needs (fewer tokens, less PII). */
export const projectPeer = (p: any) => ({
  id: p.id,
  name: p.name,
  hostname: p.hostname,
  ip: p.ip,
  dns_label: p.dns_label,
  connected: p.connected,
  last_seen: p.last_seen,
  os: p.os,
  version: p.version,
  user: p.user?.email ?? p.user_id,
  groups: (p.groups ?? []).map((g: any) => g.name),
  ssh_enabled: p.ssh_enabled,
  login_expiration_enabled: p.login_expiration_enabled,
  login_expired: p.login_expired,
  approval_required: p.approval_required,
  country_code: p.country_code,
});

export function peerTools(deps: ToolDeps): ToolSpec[] {
  const { api } = deps;
  return [
    {
      permission: { module: "peers", op: "read" },
      tool: {
        name: "netbird_list_peers",
        title: "List peers",
        description:
          "Lists NetBird peers (machines in the network) with IP, OS, online status, owner and groups. Optional filters narrow the result.",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description:
                "Case-insensitive substring of name, hostname, IP or DNS label",
            },
            connected: {
              type: "boolean",
              description: "Only online (true) or offline (false) peers",
            },
            group: {
              type: "string",
              description: "Only peers in this group (name)",
            },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ search, connected, group }) =>
          run(async () => {
            const peers = (await api.get<any[]>("/peers")).map(projectPeer);
            const q = str(search).toLowerCase();
            const g = str(group).toLowerCase();
            return peers.filter(
              (p) =>
                (!q ||
                  [p.name, p.hostname, p.ip, p.dns_label].some((f) =>
                    String(f ?? "")
                      .toLowerCase()
                      .includes(q),
                  )) &&
                (typeof connected !== "boolean" || p.connected === connected) &&
                (!g || p.groups.some((n: string) => n.toLowerCase() === g)),
            );
          }),
      },
    },
    {
      permission: { module: "peers", op: "read" },
      tool: {
        name: "netbird_get_peer",
        title: "Get peer details",
        description:
          "Returns details of one peer, including which peers it can reach.",
        inputSchema: {
          type: "object",
          properties: { peer: idOrName("Peer") },
          required: ["peer"],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ peer }) =>
          run(async () => {
            const p = await resolvePeer(deps, str(peer));
            const full = await api.get(`/peers/${p.id}`);
            const accessible = await api
              .get<any[]>(`/peers/${p.id}/accessible-peers`)
              .catch(() => []);
            return {
              ...projectPeer(full),
              accessible_peers: accessible.map((a) => ({
                name: a.name,
                ip: a.ip,
              })),
            };
          }),
      },
    },
    {
      permission: { module: "peers", op: "update" },
      tool: {
        name: "netbird_update_peer",
        title: "Update peer",
        description:
          "Renames a peer or toggles its SSH server, login expiration or inactivity expiration. Only the given fields change. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: {
            peer: idOrName("Peer"),
            name: { type: "string", description: "New name" },
            ssh_enabled: { type: "boolean" },
            login_expiration_enabled: { type: "boolean" },
            inactivity_expiration_enabled: { type: "boolean" },
          },
          required: ["peer"],
        },
        annotations: { consequentialHint: true },
        execute: (input) =>
          run(async () => {
            const p = await resolvePeer(deps, str(input.peer));
            const current = await api.get(`/peers/${p.id}`);
            const body = {
              name: str(input.name) || current.name,
              ssh_enabled: input.ssh_enabled ?? current.ssh_enabled,
              login_expiration_enabled:
                input.login_expiration_enabled ??
                current.login_expiration_enabled,
              inactivity_expiration_enabled:
                input.inactivity_expiration_enabled ??
                current.inactivity_expiration_enabled,
              approval_required: current.approval_required,
            };
            const changes = Object.entries(body)
              .filter(([k, v]) => current[k] !== v)
              .map(([k, v]) => `${k}: ${current[k]} → ${v}`);
            if (changes.length === 0) return "Nothing to change.";
            await requireConfirm(
              deps,
              `Update peer "${current.name}"?`,
              `The assistant wants to change:\n${changes.join("\n")}`,
            );
            const res = await api.put(`/peers/${p.id}`, body);
            deps.refresh(["/peers", `/peers/${p.id}`]);
            deps.announce(current.name, "Peer updated by assistant");
            return projectPeer(res);
          }),
      },
    },
    {
      permission: { module: "peers", op: "delete" },
      tool: {
        name: "netbird_delete_peer",
        title: "Delete peer",
        description:
          "Removes a peer from the network. The machine loses access until it is re-registered. Asks the user to confirm.",
        inputSchema: {
          type: "object",
          properties: { peer: idOrName("Peer") },
          required: ["peer"],
        },
        annotations: { consequentialHint: true, destructiveHint: true },
        execute: ({ peer }) =>
          run(async () => {
            const p = await resolvePeer(deps, str(peer));
            await requireConfirm(
              deps,
              `Delete peer "${p.name}"?`,
              `The assistant wants to delete ${p.name} (${p.ip}). The machine will be disconnected from the network.`,
              true,
            );
            await api.del(`/peers/${p.id}`);
            deps.refresh(["/peers", "/groups"]);
            deps.announce(p.name, "Peer deleted by assistant");
            return `Deleted peer ${p.name}`;
          }),
      },
    },
  ];
}
