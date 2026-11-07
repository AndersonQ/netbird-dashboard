import { vi } from "vitest";
import type { ToolDeps, ToolSpec } from "./types";

export const peers = [
  {
    id: "p1",
    name: "laptop",
    hostname: "alice-mbp",
    ip: "100.64.0.1",
    connected: true,
    groups: [{ name: "devs" }],
  },
  {
    id: "p2",
    name: "db-1",
    hostname: "db-1",
    ip: "100.64.0.2",
    connected: false,
    groups: [],
  },
];

export const groups = [
  { id: "g1", name: "All", peers: [{ id: "p1" }, { id: "p2" }], resources: [] },
  { id: "g2", name: "devs", peers: [{ id: "p1" }], resources: [] },
];

export const policies = [
  {
    id: "pol1",
    name: "devs-to-all",
    description: "",
    enabled: true,
    source_posture_checks: [],
    rules: [
      {
        name: "devs-to-all",
        action: "accept",
        protocol: "all",
        bidirectional: true,
        ports: [],
        sources: [{ id: "g2", name: "devs" }],
        destinations: [{ id: "g1", name: "All" }],
      },
    ],
  },
];

/** Fake dependencies backed by the fixtures above. */
export function makeDeps(confirmResult = true) {
  const api = {
    get: vi.fn(async (path: string): Promise<any> => {
      if (path === "/peers") return peers;
      if (path.startsWith("/peers/"))
        return peers.find((p) => path.endsWith(p.id));
      if (path === "/groups") return groups;
      if (path.startsWith("/groups/"))
        return groups.find((g) => path.endsWith(g.id));
      if (path === "/policies") return policies;
      throw { code: 404, message: "not found" };
    }),
    post: vi.fn(async (_p: string, body: any) => ({ id: "new", ...body })),
    put: vi.fn(async (_p: string, body: any) => body),
    del: vi.fn(async () => ({})),
  };
  const deps: ToolDeps = {
    api: api as unknown as ToolDeps["api"],
    confirm: vi.fn(async () => confirmResult),
    refresh: vi.fn(),
    navigate: vi.fn(),
    announce: vi.fn(),
  };
  return { deps, api };
}

export const findTool = (specs: ToolSpec[], name: string) => {
  const spec = specs.find((t) => t.tool.name === name);
  if (!spec) throw new Error(`tool ${name} not found`);
  return spec.tool;
};
