import type { ModelContextTool } from "../modelContext";

export type PermissionOp = "read" | "create" | "update" | "delete";

/**
 * Everything a tool needs from the dashboard. WebMCPProvider supplies the
 * real implementations; unit tests pass fakes.
 */
export type ToolDeps = {
  api: {
    get: <T = any>(path: string) => Promise<T>;
    post: <T = any>(path: string, body: unknown) => Promise<T>;
    put: <T = any>(path: string, body: unknown) => Promise<T>;
    del: <T = any>(path: string) => Promise<T>;
  };
  /** Shows the dashboard's confirm dialog. Resolves true if the user approves. */
  confirm: (opts: {
    title: string;
    description: string;
    danger?: boolean;
  }) => Promise<boolean>;
  /** Revalidates SWR keys so visible tables pick up the change. */
  refresh: (keys: string[]) => void;
  navigate: (path: string) => void;
  /** Toast so the user sees what the assistant did. */
  announce: (title: string, description: string) => void;
};

export type ToolSpec = {
  /** Permission module + operation required to expose this tool. */
  permission?: { module: string; op: PermissionOp };
  tool: ModelContextTool;
};
