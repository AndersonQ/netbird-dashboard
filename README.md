# NetBird Dashboard + WebMCP

> **NetBird hackathon project.** This is a fork of
> [netbirdio/dashboard](https://github.com/netbirdio/dashboard) that lets an
> AI agent in the browser operate the NetBird dashboard through
> [WebMCP](https://webmachinelearning.github.io/webmcp/). For the original
> dashboard README, see the
> [upstream repository](https://github.com/netbirdio/dashboard#readme).

## What it does

When you are logged into the dashboard, the page registers **19 tools** with
the browser: list peers, create groups, write access policies, delete setup
keys and more. An agent running in the browser can discover and call them.
You can ask:

- *"Which of my peers are offline?"*
- *"Create a group `databases` with db-1 and db-2."*
- *"Let the devs group reach databases on TCP 5432."*
- *"Delete peer old-laptop."*

What makes it safe:

- **Same user, same rules.** Every tool calls the existing management REST
  API with the logged-in user's token. Server-side permission checks and the
  audit log apply unchanged, so the agent can't do anything the user couldn't
  do by clicking.
- **A human approves every change.** Each create, update or delete opens the
  dashboard's own confirmation dialog, red for deletes. If you click
  **Decline**, nothing is sent to the server.
- **Only what you may use.** Tools are registered only when your role allows
  them. An auditor never sees `netbird_delete_peer`.
- **No backend changes.** All code is in this repository, under
  [`src/modules/webmcp/`](src/modules/webmcp/).

## How it works

📖 **[How WebMCP works, explained through this project](docs/webmcp-how-it-works.md)**
is a walkthrough for developers, mostly backend. It covers:

- what WebMCP is and how it differs from MCP servers and browser automation
- the architecture, and the life of one tool call (sequence diagram)
- what the backend sees, the security model, and tips for designing tools
  for an LLM

🎬 **[WebMCP explained (video)](00.WebMCP_Explained.mp4)** is an explainer
video made with NotebookLM from
[`docs/webmcp-how-it-works.md`](docs/webmcp-how-it-works.md).

The module README, [`src/modules/webmcp/README.md`](src/modules/webmcp/README.md),
covers the code layout and how to add a tool.

In short:

```text
AI agent ──► document.modelContext ──► tool.execute() ──► confirm dialog ──► REST /api/* (user's token)
             (browser tool registry)   (in the dashboard tab)                  └► RBAC, audit log
```

## Tools

| Area | Read | Change (asks you to confirm) |
| --- | --- | --- |
| Context | `netbird_get_current_user`, `netbird_navigate` | |
| Peers | `netbird_list_peers`, `netbird_get_peer` | `netbird_update_peer`, `netbird_delete_peer` |
| Groups | `netbird_list_groups` | `netbird_create_group`, `netbird_set_group_membership`, `netbird_delete_group` |
| Access policies | `netbird_list_policies` | `netbird_create_policy`, `netbird_set_policy_enabled`, `netbird_delete_policy` |
| Setup keys | `netbird_list_setup_keys` | `netbird_create_setup_key`, `netbird_delete_setup_key` |
| Networks | `netbird_list_networks` | |
| Audit log | `netbird_list_audit_events` | |

Tools take peers, groups, policies and setup keys **by name or ID**.

## Test the WebMCP tools

### 1. Requirements

- **Google Chrome ≥ 149** (tested on 157). Open
  `chrome://flags/#enable-webmcp-testing`, set it to **Enabled**, and
  relaunch.
- **Node.js ≥ 24.**
- **A NetBird management server** to log into (next step).

### 2. Run a NetBird backend

Any NetBird management server works. To run one locally, use the
**combined** server from the
[netbird repository](https://github.com/netbirdio/netbird). It includes
management, signal, relay and an embedded identity provider in one binary:

```bash
cd netbird/combined
cp config.yaml.example config.yaml
# edit config.yaml:
#   server.listenAddress: ":8042"
#   server.auth.issuer:   "http://localhost:8042/oauth2"
#   server.auth.dashboardRedirectURIs:
#     - "http://localhost:3000/nb-auth"
#     - "http://localhost:3000/nb-silent-auth"
#   server.auth.dashboardPostLogoutRedirectURIs:
#     - "http://localhost:3000/"
#   and fill in the secrets / encryption keys
go run . --config config.yaml
```

To have peers to manage, connect a few machines or VMs with the NetBird
client.

### 3. Run the dashboard

Create `.local-config.json` in this repository (it is git-ignored) pointing
at the backend:

```json
{
  "auth0Auth": "false",
  "authAuthority": "http://localhost:8042/oauth2",
  "authClientId": "netbird-dashboard",
  "authAudience": "netbird-dashboard",
  "authScopesSupported": "openid profile email groups",
  "apiOrigin": "http://localhost:8042",
  "grpcApiOrigin": "http://localhost:8042",
  "redirectURI": "/nb-auth",
  "silentRedirectURI": "/nb-silent-auth",
  "tokenSource": "accessToken"
}
```

Then:

```bash
npm ci
npm run dev
```

Open http://localhost:3000 and log in. WebMCP needs a secure context;
`localhost` counts as one, but any other host needs HTTPS.

### 4. Check that the tools are registered

Open DevTools → **Console**. You should see:

```text
[webmcp] registered 19 tools: ['netbird_get_current_user', 'netbird_navigate', ...]
```

If you see `[webmcp] document.modelContext not available` instead, the
Chrome flag is off or Chrome needs a relaunch. Fewer than 19 tools means your
role doesn't allow some of them, which is expected for non-admin users.

### 5. Run tools by hand: DevTools (no agent, no API key)

1. DevTools → **Application** → **WebMCP**, in the sidebar.
2. Under **Available tools**, click `netbird_list_peers`, set the input to
   `{}`, and click **Run tool**. Your peers appear as Output.
3. Click `netbird_delete_peer` and run it with `{"peer": "<a peer name>"}`.
   The red confirmation dialog appears in the page. Click **Decline**, and the
   Output shows `Error: The user declined this action…`.

The **Invoked tools** log keeps every call with its input and output.

### 6. Talk to it: Model Context Tool Inspector (Gemini API key)

1. Install
   [WebMCP – Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd),
   by Google Chrome Labs.
2. On the dashboard tab, open the extension's side panel. It lists all
   tools.
3. **Manual mode:** pick a tool, edit **Input Arguments**, then click
   **Execute Tool**.
   > ⚠️ The extension pre-fills every field with placeholders such as
   > `"example_string"`. For `netbird_list_peers` those placeholders filter
   > everything out and you get `[]`. Replace them with `{}`, or with the
   > filters you want.
4. **Agent mode:** click **Set Gemini API key** (from
   https://aistudio.google.com/apikey), type a prompt under **User Prompt**,
   and click **Send**.

### 7. Optional: Chrome's on-device model (no API key)

Google's
[example agentic extension](https://github.com/GoogleChromeLabs/webmcp-extension/)
can call WebMCP tools with Chrome's built-in model (Prompt API, Gemini Nano):

1. Also enable `chrome://flags/#prompt-api-tool-use` and relaunch.
2. `git clone https://github.com/GoogleChromeLabs/webmcp-extension.git && cd webmcp-extension && npm install && npm run build`
3. In `chrome://extensions`, turn on **Developer mode**, click **Load
   unpacked**, and select `dist/`.
4. In its side panel, go to **Settings → Model → On-device model**. The
   model downloads on first use.
   [Hardware requirements](https://developer.chrome.com/docs/ai/prompt-api):
   22 GB free disk, and either a GPU with more than 4 GB VRAM or 16 GB RAM
   with 4+ cores.

The on-device model is small, so expect weaker tool selection than with
Gemini.

> **What about Gemini in Chrome?** Chrome's built-in assistant doesn't call
> WebMCP tools yet. Google has announced support as
> ["coming soon"](https://developer.chrome.com/blog/chrome-at-io26). These
> tools use only the standard API, so they should work there unchanged once
> it ships.

### 8. Example scenario: let two peers talk to each other

Run these in order (DevTools **Run tool** or Inspector **Execute Tool**) and
approve each dialog. Replace `peer-a` and `peer-b` with your peer names from
`netbird_list_peers`.

1. `netbird_create_group`
   ```json
   { "name": "a-b", "peers": ["peer-a", "peer-b"] }
   ```
2. `netbird_create_policy`
   ```json
   {
     "name": "a-b",
     "description": "Allow peer-a and peer-b to talk to each other",
     "sources": ["a-b"],
     "destinations": ["a-b"],
     "protocol": "all",
     "bidirectional": true
   }
   ```
3. `netbird_get_peer` with `{ "peer": "peer-a" }`: `accessible_peers`
   includes `peer-b`.

A new account's **Default** policy (`All` ⇄ `All`) already lets every peer
reach every other. To see the new policy take effect on its own, run
`netbird_set_policy_enabled` with `{ "policy": "Default", "enabled": false }`.
⚠️ That cuts off every peer that isn't covered by another policy. Undo it
with `"enabled": true`.

### 9. Unit tests

```bash
npx vitest run src/modules/webmcp
```

They cover:

- a delete happens only after you confirm, and nothing is sent if you decline
- names resolve to IDs
- group membership changes keep the existing members
- navigation is limited to a fixed list of pages
- every write tool requires a permission and is marked as consequential

## Known limitations (hackathon build)

- Works only in Chromium browsers with WebMCP enabled. Elsewhere the
  dashboard behaves exactly as before.
- Production use needs a WebMCP
  [origin-trial token](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241)
  for each origin, so every self-hosted deployment would need its own.
- `netbird_create_setup_key` returns the key secret to the agent after you
  approve.
- List tools fetch everything and filter in the browser.
- Tool results include user-entered names, which are a prompt-injection
  risk. They are marked `untrustedContentHint`, and every write still needs
  your click.

## How it was built

The commit history on branch `webmcp` adds the feature one step at a time:
the browser API adapter, then the provider that registers tools, then one
commit per tool area.

```bash
git log --reverse --oneline main..webmcp
```

## License

Same as the upstream project; see [LICENSE](LICENSE).
