import type { ToolResult } from "./modelContext";

export const ok = (data: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    },
  ],
});

export const fail = (err: unknown): ToolResult => {
  let message: string;
  if (typeof err === "string") message = err;
  else if (err && typeof err === "object" && "message" in err) {
    const e = err as { code?: number; message?: string };
    message = e.code ? `${e.code}: ${e.message}` : String(e.message);
  } else message = String(err);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
};

export class UserDeclinedError extends Error {
  constructor() {
    super("The user declined this action in the confirmation dialog.");
  }
}
