import type { ToolResult } from "../modelContext";
import { fail, ok, UserDeclinedError } from "../result";
import type { ToolDeps } from "./types";

/** Runs a tool body and turns its return value or error into a ToolResult. */
export const run = async (fn: () => Promise<unknown>): Promise<ToolResult> => {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(e);
  }
};

/** Asks the user through the confirm dialog; throws if they decline. */
export const requireConfirm = async (
  deps: ToolDeps,
  title: string,
  description: string,
  danger = false,
) => {
  const approved = await deps.confirm({ title, description, danger });
  if (!approved) throw new UserDeclinedError();
};

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

export const idOrName = (what: string) => ({
  type: "string",
  description: `${what} ID or exact name`,
});

/** Finds an item by ID, then by case-insensitive name. */
export function findByIdOrName<T extends { id: string; name: string }>(
  items: T[],
  ref: string,
  what: string,
): T {
  const found =
    items.find((x) => x.id === ref) ??
    items.find((x) => x.name.toLowerCase() === ref.toLowerCase());
  if (!found) throw new Error(`${what} not found: "${ref}"`);
  return found;
}
