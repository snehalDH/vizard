# Vizard Distribution Plan

## Goal
Make vizard usable from other repos in two ways:
1. As a global bash command (`vizard create "..."`)
2. As an MCP server configured in another repo's Claude Code settings

---

## Phase 1 — Bash Command

### Context
Currently `dist/cli.js` has no shebang line and is not executable. There's also no `prepare` script, so `npx github:snehalDH/vizard` fails because TypeScript is never compiled during install. This phase makes vizard installable and runnable as a global CLI from any directory.

### Changes

#### 1. `package.json` — add `prepare` and `postbuild` scripts

```json
"prepare": "npm run build",
"postbuild": "node -e \"const fs=require('fs');const f='dist/cli.js';let c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c);fs.chmodSync(f,'755');\""
```

- `prepare`: npm runs this automatically during `npm install`, so `npx github:snehalDH/vizard` compiles TypeScript before running — no need to commit `dist/`
- `postbuild`: adds `#!/usr/bin/env node` shebang + sets executable bit on `dist/cli.js`

#### 2. `src/mcp-server/tools/create-diagram.ts` — `OUTPUT_DIR` support

Replace hardcoded `"diagrams"` with:
```ts
import path from 'path';
const outputDir = process.env.OUTPUT_DIR ?? path.join(process.cwd(), 'diagrams');
```
Use `outputDir` in `mkdir`, `filePath`, and `svgPath` construction.

#### 3. `src/mcp-server/tools/list-diagrams.ts` — `OUTPUT_DIR` support

Same pattern:
```ts
import path from 'path';
const outputDir = process.env.OUTPUT_DIR ?? path.join(process.cwd(), 'diagrams');
```
Use `outputDir` in `mkdir`, `readdir`, and the `path.join(outputDir, f)` map.

(`update-diagram.ts` needs no change — it receives `filePath` from the caller, no hardcoded directory.)

### How users run it after Phase 1

```bash
# Zero-install, one-off use:
GEMINI_API_KEY=your_key npx github:snehalDH/vizard create "React + Node + Postgres architecture"

# OR install globally once:
npm install -g github:snehalDH/vizard
# Then from any repo:
GEMINI_API_KEY=your_key vizard create "describe your diagram"
vizard list
vizard update diagrams/my-diagram.excalidraw "add a Redis cache layer"
```

### Phase 1 Validation

Run these checks before moving to Phase 2:

```bash
# 1. Build succeeds
npm run build

# 2. Shebang was added and file is executable
head -1 dist/cli.js          # should print: #!/usr/bin/env node
ls -la dist/cli.js           # should show -rwxr-xr-x

# 3. CLI runs directly
GEMINI_API_KEY=your_key node dist/cli.js create "simple two-box diagram"
# Expected: creates diagrams/<slug>.excalidraw and diagrams/<slug>.svg

# 4. OUTPUT_DIR override works
OUTPUT_DIR=/tmp/viz-test GEMINI_API_KEY=your_key node dist/cli.js create "test diagram"
ls /tmp/viz-test/            # should contain .excalidraw and .svg files

# 5. npx from GitHub works (requires repo to be public)
GEMINI_API_KEY=your_key npx github:snehalDH/vizard create "test via npx"
```

**Stop here. Verify all 5 checks pass before starting Phase 2.**

---

## Phase 2 — MCP Server

### Context
The MCP server currently has only top-level startup code with no exported function. The CLI has no `mcp` subcommand. This phase adds a `vizard mcp` subcommand so Claude Code in another repo can spawn vizard as an MCP server over stdio, giving Claude access to `create_diagram`, `update_diagram`, and `list_diagrams` tools inline — no context switching needed.

### Changes

#### 1. `src/mcp-server/index.ts` — export `startMcpServer()`

Wrap the existing top-level server code in an exported async function. Add ESM main-detection so the file still works when invoked directly via `npm run mcp:server`.

```ts
import { fileURLToPath } from 'url';

export async function startMcpServer() {
  // ...existing McpServer setup, registerTool calls, and transport.connect()...
}

// Direct invocation guard (npm run mcp:server)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startMcpServer();
}
```

#### 2. `src/cli.ts` — add `mcp` subcommand

```ts
program
  .command('mcp')
  .description('Start vizard as an MCP server over stdio')
  .action(async () => {
    const { startMcpServer } = await import('./mcp-server/index.js');
    await startMcpServer();
  });
```

This makes `vizard mcp` the MCP entry point that repo A's settings.json will invoke.

### How users configure it in repo A

Create or update repo A's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "vizard": {
      "command": "npx",
      "args": ["-y", "github:snehalDH/vizard", "mcp"],
      "env": {
        "GEMINI_API_KEY": "your_key_here"
      }
    }
  }
}
```

Claude in repo A can then call `create_diagram`, `update_diagram`, and `list_diagrams` tools directly in the same session. Diagrams are written to `diagrams/` inside repo A (or wherever `OUTPUT_DIR` points).

### Phase 2 Validation

```bash
# 1. Build succeeds after changes
npm run build

# 2. Direct MCP server invocation works
node dist/cli.js mcp
# Expected output to stderr: [vizard-mcp] server started on stdio
# (hangs waiting for MCP protocol input — Ctrl+C to exit)

# 3. Legacy direct invocation still works
npm run mcp:server
# Expected: same [vizard-mcp] server started on stdio

# 4. Configure in a test repo and verify Claude sees the tools
#    a. Create /tmp/test-repo/.claude/settings.json with the mcpServers config above
#    b. Open Claude Code in /tmp/test-repo
#    c. Run: /mcp  — vizard should appear as a connected server
#    d. Ask Claude: "use vizard to create a diagram of a simple login flow"
#    e. Claude should call create_diagram and return a file path
#    f. Check that diagrams/ was created inside /tmp/test-repo
```

**All 4 checks passing = implementation complete.**

---

## File Change Summary

| File | Phase | Change |
|---|---|---|
| `package.json` | 1 | Add `prepare` + `postbuild` scripts |
| `src/mcp-server/tools/create-diagram.ts` | 1 | `OUTPUT_DIR` env var support |
| `src/mcp-server/tools/list-diagrams.ts` | 1 | `OUTPUT_DIR` env var support |
| `src/mcp-server/index.ts` | 2 | Export `startMcpServer()`, add ESM main guard |
| `src/cli.ts` | 2 | Add `mcp` subcommand |
