import { contextTools } from "./context";
import type { ToolDeps, ToolSpec } from "./types";

export type { PermissionOp, ToolDeps, ToolSpec } from "./types";

/** All WebMCP tools the dashboard offers, before permission filtering. */
export function buildTools(deps: ToolDeps): ToolSpec[] {
  return [
    ...contextTools(deps),
  ];
}
