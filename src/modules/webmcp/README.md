# WebMCP

Exposes dashboard actions as [WebMCP](https://webmachinelearning.github.io/webmcp/)
tools, so an agent running in the browser can read and change the NetBird
account the user is logged into.

The tools call the management REST API with the user's own token, so the
server's permission checks and audit log apply as usual. Every change asks
the user in the dashboard's confirm dialog first, and deletes use the red
danger variant. If the user declines, the tool returns an error to the agent
and nothing changes.

## Layout

| File | Role |
| --- | --- |
| `modelContext.ts` | Feature detection and register/unregister. Supports `document.modelContext` (spec) and `navigator.modelContext` (early Chrome builds). |
| `result.ts` | Tool result helpers (`ok`, `fail`) and `UserDeclinedError`. |
| `WebMCPProvider.tsx` | Connects tools to `useApiCall`, `useDialog`, SWR `mutate`, the router and `notify`. Registers only tools the user has permission for. Mounted in `DashboardLayout`. |
| `tools/index.ts` | `buildTools(deps)`: the full tool list. |
| `tools/<area>.ts` | One file per area: `context`, `peers`, `groups`, `policies`, `setupKeys`, `networks`, `events`. Plain functions over `ToolDeps`, unit tested with fakes from `tools/testUtils.ts`. |

## Adding a tool

1. Add a `ToolSpec` to the area's file (or a new `tools/<area>.ts` plus a
   line in `tools/index.ts`).
2. Set `permission` to the module and operation the REST endpoint checks.
3. Read-only tools: `annotations: { readOnlyHint: true }`. Add
   `untrustedContentHint: true` when the result contains user-entered text
   such as names or descriptions.
4. Writes: call `requireConfirm(...)` before the request, then
   `deps.refresh([...swrKeys])` and `deps.announce(...)`. Set
   `consequentialHint: true`. The registry test enforces this.
5. Accept IDs **or** names for referenced objects. Use `resolvePeer`,
   `resolveGroupIds` or `findByIdOrName`.

## Try it (Chrome)

1. Chrome ≥ 149: enable `chrome://flags/#enable-webmcp-testing` and relaunch.
2. Install the "WebMCP – Model Context Tool Inspector" extension from the
   Chrome Web Store. Gemini mode needs a Gemini API key.
3. Run the dashboard (`npm run dev`, or `npm run test:dev` against the e2e
   environment) and log in. The console logs
   `[webmcp] registered N tools`.
4. Open the extension side panel to list the tools, run them by hand, or
   prompt Gemini.

## Known sharp edges (hackathon)

- `netbird_create_setup_key` returns the key secret to the agent once the
  user approves.
- List tools fetch everything and filter in the browser.
- There is no on-page indicator that tools are registered.
