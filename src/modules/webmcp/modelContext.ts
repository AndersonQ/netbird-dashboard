// Thin compatibility layer over the WebMCP API.
//
// The spec (https://webmachinelearning.github.io/webmcp/) puts the API on
// `document.modelContext` and unregisters a tool when the AbortSignal passed
// at registration is aborted. Earlier Chrome builds exposed
// `navigator.modelContext` with `registerTool` / `unregisterTool(name)`.
// We support both so the demo works on whichever Chrome build is at hand.

export type JSONSchema = Record<string, unknown>;

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
  destructiveHint?: boolean; // older MCP-style hint; ignored by the spec
};

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type ModelContextTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
  execute: (
    input: Record<string, any>,
    options?: { signal?: AbortSignal },
  ) => Promise<ToolResult>;
};

type ModelContextLike = {
  registerTool: (
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void> | void;
  unregisterTool?: (name: string) => void;
};

export function getModelContext(): ModelContextLike | undefined {
  if (typeof window === "undefined") return undefined;
  const fromDocument = (document as any).modelContext;
  if (fromDocument?.registerTool) return fromDocument;
  const fromNavigator = (navigator as any).modelContext;
  if (fromNavigator?.registerTool) return fromNavigator;
  return undefined;
}

export function isWebMCPSupported(): boolean {
  return !!getModelContext();
}

/**
 * Registers a tool and returns a function that unregisters it. Errors are
 * logged, never thrown: WebMCP is a progressive enhancement.
 */
export function registerTool(tool: ModelContextTool): () => void {
  const ctx = getModelContext();
  if (!ctx) return () => {};

  const controller = new AbortController();
  try {
    const maybePromise = ctx.registerTool(tool, { signal: controller.signal });
    Promise.resolve(maybePromise).catch((e) =>
      console.warn("[webmcp] registerTool failed:", tool.name, e),
    );
  } catch (e) {
    console.warn("[webmcp] registerTool failed:", tool.name, e);
  }

  return () => {
    controller.abort();
    // Older implementations ignore the signal; unregister by name as well.
    try {
      ctx.unregisterTool?.(tool.name);
    } catch {
      // Already gone (the signal removed it) — nothing to do.
    }
  };
}
