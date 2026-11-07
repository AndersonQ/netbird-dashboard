import { contextTools } from "./context";
import { groupTools } from "./groups";
import { peerTools } from "./peers";
import { policyTools } from "./policies";
import { setupKeyTools } from "./setupKeys";
import type { ToolDeps, ToolSpec } from "./types";

export type { PermissionOp, ToolDeps, ToolSpec } from "./types";

/** All WebMCP tools the dashboard offers, before permission filtering. */
export function buildTools(deps: ToolDeps): ToolSpec[] {
  return [
    ...contextTools(deps),
    ...peerTools(deps),
    ...groupTools(deps),
    ...policyTools(deps),
    ...setupKeyTools(deps),
  ];
}
