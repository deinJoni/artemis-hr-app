# Vibe Frontend

A modern React Router v7 app with SSR, Tailwind v4, and shadcn/ui.

## Features

- SSR with React Router v7
- HMR in development
- TypeScript
- Tailwind CSS v4 (design tokens in `app/app.css`)
- shadcn/ui component library (CLI-driven components in `app/components/ui`)

## Prerequisites

- pnpm installed

## Install

```bash
pnpm install
```

## Develop

```bash
pnpm dev
```

App runs at `http://localhost:5173`.

## Routes

Routes are defined in `app/routes.ts` using `@react-router/dev/routes` helpers.

Quick workflow:

1. Create a route component in `app/routes/`
2. Export a default component (and optional `meta`, `loader`, `action`)
3. Register it in `app/routes.ts`

Index route example:

```startLine:endLine:apps/frontend/app/routes.ts
import { type RouteConfig, index } from "@react-router/dev/routes";

export default [index("routes/home.tsx")] satisfies RouteConfig;
```

Static route example (`/about`):

```tsx
// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
```

## Type generation for routes

Generate/upate types (required after adding new routes/files):

```bash
pnpm typecheck
```

This runs `react-router typegen` and `tsc` as configured in `package.json`.

## Build & Run

```bash
pnpm build
pnpm start
```

## Styling

Tailwind v4 is configured via `app/app.css`. Update CSS variables (e.g. `--radius`, `--background`, `--primary`) to theme the app.

## shadcn/ui

Configured via `components.json` with aliases:

- `ui` → `~/components/ui`
- `utils` → `~/lib/utils`

Add components via CLI (outputs to `app/components/ui/*`, utils to `app/lib/*`):

```bash
pnpm dlx shadcn@latest add button
```

More examples:

```bash
pnpm dlx shadcn@latest add input textarea select checkbox dialog dropdown-menu
pnpm dlx shadcn@latest add card badge separator table
pnpm dlx shadcn@latest add alert toast tooltip popover
```

Use components:

```tsx
import { Button } from "~/components/ui/button";

export default function Example() {
  return <Button>Click me</Button>;
}
```

## Shadcn MCP (AI Assistant Integration)

Use the Shadcn MCP server to browse, search, and install components directly from your AI assistant in Cursor and other IDEs. See the official docs: [Shadcn MCP](https://ui.shadcn.com/docs/mcp).

### Cursor Setup

1. Add `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

2. Enable the `shadcn` MCP server in Cursor Settings.
3. Try prompts in Cursor:
   - "Show me all available components in the shadcn registry"
   - "Add the button, dialog and card components to my project"
   - "Create a login form using shadcn components"

### Claude Code (quick init)

```bash
pnpm dlx shadcn@latest mcp init --client claude
```

### VS Code (GitHub Copilot)

Create `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

### Registries

Registries are configured in `components.json` (shadcn/ui works out of the box). Add more registries if needed:

```json
{
  "registries": {
    "@acme": "https://registry.acme.com/{name}.json",
    "@internal": {
      "url": "https://internal.company.com/{name}.json",
      "headers": {
        "Authorization": "Bearer ${REGISTRY_TOKEN}"
      }
    }
  }
}
```

For private registries, set env vars (e.g. `.env.local`):

```bash
REGISTRY_TOKEN=your_token_here
```

### Troubleshooting

- MCP not responding: verify configuration, then restart the IDE.
- No tools or prompts: run `npx clear-npx-cache`, then re-enable the server.
- Installation issues: check `components.json`, target paths, and dependencies.

## Project layout (excerpt)

```
app/
  app.css
  components/
    ui/
      button.tsx
  lib/
    utils.ts
  routes/
    home.tsx
  routes.ts
```

---

Built with ❤️ on React Router v7, Tailwind v4, and shadcn/ui.
