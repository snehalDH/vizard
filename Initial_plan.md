# Vizard — Build Plan

> **Why "Vizard"?**
> A blend of *visualization* + *wizard*. You describe a system in plain English, and Vizard conjures a
> professional diagram — like magic. Short, memorable, and perfect for a blog series title:
> *"Building Vizard: AI diagrams from plain text."*

---

## What You're Building

A CLI tool + MCP server that takes plain-English descriptions of systems and architectures and outputs
valid `.excalidraw` files — powered by Google Gemini (free tier) instead of Claude.

**Why build this:**
- Learn MCP protocol, AI function calling, structured output, and agent architecture
- Strong GitHub portfolio project (end-to-end, original, has a real use case)
- Rich blog content: you built both sides of the MCP stack — most tutorials only show one

---

## Architecture Overview

```
User (CLI)
    │
    ▼
Gemini Agent (orchestrator)
    │  uses function calling
    ▼
MCP Server (Node.js)
    │  exposes tools
    ▼
Excalidraw JSON Generator
    │  writes file
    ▼
.excalidraw file → opens in browser
```

The original reference project uses Claude Code as the MCP *client*. Vizard builds its own
lightweight MCP client powered by Gemini — more educational because you understand both sides.

---

## Tech Stack

| Layer      | Technology                      | Why                                      |
|------------|---------------------------------|------------------------------------------|
| Runtime    | Node.js 20+                     | LTS, native ESM, strong ecosystem        |
| AI         | `@google/generative-ai`         | Google AI Studio — free tier             |
| MCP        | `@modelcontextprotocol/sdk`     | Official MCP SDK (server + client)       |
| CLI        | `commander` + `inquirer`        | Clean arg parsing + interactive prompts  |
| DX         | `chalk` + `ora`                 | Colored output + spinners                |
| Env        | `dotenv`                        | API key management                       |
| Dev        | `nodemon` + `eslint`            | Fast iteration during development        |

---

## Project Structure

```
Vizard/
├── src/
│   ├── mcp-server/
│   │   ├── index.js                # MCP server entry point (stdio transport)
│   │   └── tools/
│   │       ├── create-diagram.js   # Tool: generate a new diagram
│   │       ├── update-diagram.js   # Tool: refine an existing diagram
│   │       └── list-diagrams.js    # Tool: list saved diagrams
│   ├── agent/
│   │   ├── index.js                # Gemini agent + MCP client wiring
│   │   ├── prompts.js              # System prompt + few-shot examples
│   │   └── schema.js               # Excalidraw JSON schema for Gemini
│   └── utils/
│       ├── excalidraw.js           # Build and validate Excalidraw JSON
│       └── file.js                 # Save files, open in browser
├── diagrams/                       # Output directory (gitignored)
├── examples/                       # Sample prompt → diagram pairs
├── PLAN.md                         # This file
├── cli.js                          # CLI entry point
├── .env.example
├── package.json
└── README.md
```

---

## Phase-by-Phase Build Plan

> **Engineering principle followed here:** Every phase ends with a test gate. Do not move to the
> next phase until the current one passes. Bugs caught early cost 10x less to fix than bugs found
> after 3 layers of code are stacked on top.

---

### Phase 1A — Gemini API Connection (~30 min)

**Goal:** Confirm Gemini is reachable and responding before writing any real logic.

**Steps:**
1. `npm init -y` inside the `Vizard/` folder
2. Install `@google/generative-ai dotenv`
3. Create `.env` with your `GEMINI_API_KEY`
4. Write a minimal `test-connection.js`:
   ```js
   import { GoogleGenerativeAI } from "@google/generative-ai";
   import "dotenv/config";

   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
   const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
   const result = await model.generateContent("Say hello in one sentence.");
   console.log(result.response.text());
   ```

**How to test Phase 1A:**
```bash
node test-connection.js
```
| Check | Expected result |
|-------|----------------|
| No error thrown | API key is valid and quota is active |
| A sentence printed to terminal | Gemini is responding correctly |
| Response is in English | Model is working as expected |

**Common errors:**
- `API_KEY_INVALID` → wrong key in `.env`, or `.env` not loaded (check `dotenv/config` import)
- `PERMISSION_DENIED` → key doesn't have Gemini API access; enable it in Google AI Studio
- `MODULE_NOT_FOUND` → forgot `"type": "module"` in `package.json` for ESM imports

**Do not proceed to Phase 1B until this passes.**

---

### Phase 1B — Excalidraw JSON Generation (~1.5 hrs)

**Goal:** Get Gemini generating *valid, structured* Excalidraw JSON from a text description.

**Steps:**
1. Write `src/utils/excalidraw.js` — a helper that wraps elements in the Excalidraw file envelope:
   ```js
   // envelope shape Excalidraw expects
   { type: "excalidraw", version: 2, elements: [...], appState: {}, files: {} }
   ```
2. Write `src/agent/prompts.js` — system prompt instructing Gemini to produce Excalidraw JSON.
   Include 2–3 few-shot examples in the prompt (a rectangle, a text label, an arrow between them)
3. Write `src/agent/schema.js` — the `responseSchema` object that enforces JSON structure
4. Write `test-gemini.js` spike script: call Gemini with `responseMimeType: "application/json"`
   and `responseSchema`, save output to `diagrams/test.excalidraw`

**Key learning:** `responseSchema` is non-negotiable. Without it Gemini wraps output in markdown
code fences (` ```json ... ``` `) which will crash your JSON parser every time.

**How to test Phase 1B:**
```bash
node test-gemini.js "simple two-step login flow"
```
| Check | How to verify |
|-------|--------------|
| No JSON parse error | Script exits cleanly |
| File created | `ls diagrams/` shows `test.excalidraw` |
| Valid envelope | Open file in a text editor — must have `type`, `version`, `elements` keys |
| Renders visually | Go to excalidraw.com → Open → upload `test.excalidraw` → diagram appears |
| Elements have string IDs | Check a few elements — `id` must be a string like `"abc-123"`, not a number |

**Common errors:**
- Diagram renders blank → `elements` array is empty; tweak the system prompt to be more explicit
- Diagram renders but arrows float unconnected → `startBinding`/`endBinding` IDs don't match;
  note this for Phase 5 validation (it's expected at this stage)
- JSON parse error → Gemini ignored `responseSchema`; confirm `responseMimeType` is set correctly

**Do not proceed to Phase 2 until excalidraw.com renders your diagram.**

---

### Phase 2 — MCP Server (~2 hrs)

**Goal:** Wrap the diagram generation into proper MCP tools that any MCP client can call.

**Steps:**
1. Install `@modelcontextprotocol/sdk`
2. Write `src/mcp-server/tools/create-diagram.js`:
   ```
   Tool name : create_diagram
   Input     : { description: string, style?: "flowchart" | "sequence" | "architecture" }
   Output    : { filePath: string, elementCount: number }
   ```
3. Write `src/mcp-server/tools/update-diagram.js`:
   ```
   Tool name : update_diagram
   Input     : { filePath: string, changes: string }
   Output    : { filePath: string }
   ```
4. Write `src/mcp-server/tools/list-diagrams.js`:
   ```
   Tool name : list_diagrams
   Input     : {}
   Output    : { diagrams: string[] }
   ```
5. Wire all tools into `src/mcp-server/index.js` using stdio transport
6. **Critical:** use `console.error` for all debug logs inside the server — never `console.log`
   (stdout is the MCP protocol wire; anything you log there corrupts it)

**Key learning:** MCP separates *tool definition* from *AI logic*. The server knows nothing about
Gemini — it just exposes capabilities. This is how all serious agent frameworks work under the hood.

**How to test Phase 2:**
```bash
npx @modelcontextprotocol/inspector node src/mcp-server/index.js
```
This opens a browser UI at `localhost:5173`. Use it to:

| Check | Action in Inspector UI |
|-------|----------------------|
| Server connects | Status shows "Connected" (not "Error") |
| Tools are listed | Click "Tools" tab — see `create_diagram`, `update_diagram`, `list_diagrams` |
| `list_diagrams` works | Call it with `{}` — returns array (empty is fine) |
| `create_diagram` works | Call it with `{ "description": "two boxes connected by an arrow" }` — returns `filePath` |
| File actually exists | Check `ls diagrams/` in your terminal after calling the tool |
| File renders | Open the returned file path on excalidraw.com |

**Common errors:**
- Inspector shows "Transport error" → MCP server crashed; check `console.error` output in the
  Inspector's "Logs" tab for the actual error
- Tools tab is empty → tools not registered correctly in `index.js`; verify `server.tool()` calls
- `create_diagram` returns but file is empty → Gemini call inside the tool is failing silently;
  add `console.error` logging around the Gemini call

**Do not proceed to Phase 3A until all three tools pass in the Inspector.**

---

### Phase 3A — MCP Client (standalone, ~1 hr)

**Goal:** Write a Node.js MCP client that can connect to your server and list tools — *without*
Gemini involved yet. Isolating this confirms the client↔server plumbing works before adding AI.

**Steps:**
1. Write `test-mcp-client.js`:
   - Spawn `src/mcp-server/index.js` as a child process
   - Connect using `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio`
   - Call `client.listTools()` and print the result
   - Call `client.callTool("list_diagrams", {})` and print the result
   - Gracefully kill the server process on exit

**How to test Phase 3A:**
```bash
node test-mcp-client.js
```
| Check | Expected output |
|-------|----------------|
| No crash on startup | Server spawns silently, client connects |
| Tool list prints | You see `create_diagram`, `update_diagram`, `list_diagrams` with their schemas |
| Tool call works | `list_diagrams` returns `{ diagrams: [] }` or a list of files |
| Clean exit | Process exits without hanging (server is killed correctly) |

**Common errors:**
- Process hangs on exit → server child process not killed; add `process.on('exit', () => child.kill())`
- `ENOENT` error → path to `src/mcp-server/index.js` is wrong in the spawn call
- Empty tool list → client connected but to a different process; verify the spawn command

**Do not proceed to Phase 3B until this script exits cleanly with tools printed.**

---

### Phase 3B — Gemini Agent + Full Agentic Loop (~1.5 hrs)

**Goal:** Connect Gemini's function calling to the MCP client, completing the full agent loop.

**Steps:**
1. Write `src/agent/index.js`:
   - Reuse the MCP client from Phase 3A
   - Convert MCP tool schemas → Gemini `FunctionDeclaration` objects
   - Call Gemini with the `tools` param
   - When Gemini returns a `functionCall`, route it to `client.callTool()`
   - Feed the tool result back to Gemini as a `functionResponse`
   - Loop until Gemini returns plain text (no more function calls) — this is the agentic loop
2. Write `test-agent.js`: call `runAgent("draw a simple login flow")` and print the final response

**Key learning:** This is the exact pattern used by LangChain's `AgentExecutor`, AutoGen,
and CrewAI — just without the abstraction. You now understand what those libraries actually do.

**How to test Phase 3B:**
```bash
node test-agent.js
```
| Check | Expected result |
|-------|----------------|
| Gemini calls a tool | You see a log line like `→ Calling tool: create_diagram` |
| Tool result fed back | Log line like `← Tool result: { filePath: "...", elementCount: 8 }` |
| Loop terminates | Agent prints a final text summary and exits — does NOT loop forever |
| File created | `ls diagrams/` shows a new `.excalidraw` file |
| File renders | Open it on excalidraw.com — diagram appears |

**Common errors:**
- Infinite loop → Gemini keeps calling tools; add a max-iterations guard (e.g. 10 iterations)
- `functionCall` response ignored → you're not checking `response.candidates[0].content.parts`
  for `functionCall` type parts correctly
- Tool call fails silently → wrap `client.callTool()` in try/catch and log the error

**Do not proceed to Phase 4 until the agent loop runs end-to-end and a diagram file is created.**

---

### Phase 4 — CLI (~1 hr)

**Goal:** Replace the test scripts with a clean, user-facing CLI.

**Steps:**
1. Install `commander inquirer chalk ora open`
2. Write `cli.js` wiring `create`, `update`, and `list` subcommands to the agent
3. Add `ora` spinner while Gemini is thinking
4. Add `chalk` for success/error color formatting
5. Auto-open the saved file in browser using `open` package
6. Add `--style` flag: `flowchart`, `sequence`, `architecture`

**How to test Phase 4:**

Run each command manually and verify the output matches expectations:

```bash
# Test 1: help text
node cli.js --help

# Test 2: create
node cli.js create "user login flow with JWT tokens"

# Test 3: list
node cli.js list

# Test 4: update
node cli.js update ./diagrams/<generated-name>.excalidraw "add a forgot password branch"

# Test 5: style flag
node cli.js create --style sequence "client sends request to server, server queries DB, returns response"

# Test 6: bad input (should fail gracefully, not crash)
node cli.js update ./diagrams/nonexistent.excalidraw "add something"
```

| Check | Expected result |
|-------|----------------|
| `--help` | Prints usage with all subcommands and flags listed |
| `create` | Spinner shows, diagram file created, browser opens automatically |
| `list` | Prints table of saved diagrams with timestamps |
| `update` | Existing file is modified, browser re-opens |
| `--style` flag | No error; style is passed through to the MCP tool |
| Bad file path | Prints a friendly error message, does NOT throw a stack trace |

**Do not proceed to Phase 5 until all 6 manual tests pass.**

---

### Phase 5 — Hardening + Blog-Worthy Features (~2 hrs)

**Goal:** Add reliability and stand-out features. Each sub-feature has its own test.

**Step 1 — Diagram validation**

Before saving any file, validate:
- All element `id` values are unique strings
- All arrow `startBinding.elementId` / `endBinding.elementId` reference an existing element ID

Test it:
```bash
# Temporarily break a binding ID in a generated file, then run update on it
# The validator should catch it and print a clear error before overwriting
node cli.js update ./diagrams/test.excalidraw "add a cache layer"
```
Pass: validator runs silently on valid files, prints a specific error on invalid ones.

---

**Step 2 — Self-healing retry loop**

When validation fails, feed the error back to Gemini and retry (max 3 times).

Test it:
```bash
# Add a console.log in the validator to force-fail once, then watch the retry
# You should see "Attempt 1 failed: broken binding on element X. Retrying..."
```
Pass: agent retries automatically and eventually produces a valid file without crashing.

---

**Step 3 — Multi-turn conversation**

After a diagram is created, the user can keep refining it in the same session.

Test it:
```bash
node cli.js create "simple microservices diagram"
# After browser opens, back in terminal:
# Prompt: "add an API gateway in front"
# Prompt: "make the database a cluster"
# Prompt: "done"
```
Pass: each follow-up updates the same file; typing "done" exits cleanly.

---

**Step 4 — Templates**

Pre-written prompts in `examples/` folder. Test each one:
```bash
node cli.js create --template rag
node cli.js create --template microservices
node cli.js create --template auth
node cli.js create --template cicd
```
Pass: each produces a non-empty `.excalidraw` file that renders correctly on excalidraw.com.

---

**Step 5 — SVG export**

Alongside the `.excalidraw` file, also write an `.svg` file to `diagrams/`.

Test it:
```bash
node cli.js create "simple flowchart"
ls diagrams/
# Should show both: flowchart.excalidraw AND flowchart.svg
open diagrams/flowchart.svg   # should open in browser and render correctly
```

---

**Phase 5 overall pass criteria:** Run through all 5 sub-tests above without any crashes or
unhandled errors. The tool should feel solid — bad inputs produce friendly messages, not stack traces.

---

## How to Use Vizard (with Examples)

Once built, Vizard is used entirely from the terminal. Here are the three commands and what happens
end-to-end for each.

---

### 1. `create` — Generate a new diagram from a description

```bash
node cli.js create "A RAG pipeline: user uploads a PDF, it gets chunked, embedded using OpenAI,
stored in Pinecone. At query time, top-k chunks are retrieved and passed to GPT-4 to generate an answer."
```

**What Vizard does internally:**
1. Sends your description to the Gemini agent
2. Gemini calls the `create_diagram` MCP tool
3. MCP server asks Gemini to generate structured Excalidraw JSON
4. JSON is validated (unique IDs, arrow bindings checked)
5. File is saved to `./diagrams/rag-pipeline.excalidraw`
6. File auto-opens in your browser

**Terminal output:**
```
✔ Vizard is thinking...

  ✦ Diagram created successfully
  ─────────────────────────────────────────
  File    : ./diagrams/rag-pipeline.excalidraw
  Elements: 14 (8 shapes, 6 arrows)
  Style   : architecture
  ─────────────────────────────────────────
  Opening in browser...
```

**Result:** A ready-to-edit Excalidraw diagram with boxes for PDF Upload, Chunker, Embedding Model,
Vector Store, Retriever, LLM, and labeled arrows connecting them.

---

### 2. `update` — Refine an existing diagram

```bash
node cli.js update ./diagrams/rag-pipeline.excalidraw "add a reranker step between the retriever
and the LLM. Also add a cache layer before the vector store."
```

**Terminal output:**
```
✔ Vizard is thinking...

  ✦ Diagram updated successfully
  ─────────────────────────────────────────
  File    : ./diagrams/rag-pipeline.excalidraw
  Added   : 2 new elements (Reranker, Cache)
  Total   : 18 elements
  ─────────────────────────────────────────
  Opening in browser...
```

This is the multi-turn power — you iterate on the diagram in plain English without redrawing
anything manually.

---

### 3. `list` — See all saved diagrams

```bash
node cli.js list
```

**Terminal output:**
```
  Saved diagrams (3)
  ─────────────────────────────────────────
  1. rag-pipeline.excalidraw         2 days ago
  2. auth-flow.excalidraw            1 day ago
  3. ci-cd-pipeline.excalidraw       3 hours ago
  ─────────────────────────────────────────
  Run: node cli.js update <filename> "<changes>"
```

---

### 4. Using a template (Phase 5 feature)

```bash
node cli.js create --template rag
node cli.js create --template microservices
node cli.js create --template auth
node cli.js create --template cicd
```

Templates are pre-written prompts stored in `examples/`. They produce consistent, well-structured
diagrams without needing to write a detailed description every time.

---

### 5. Choosing a diagram style

```bash
# Flowchart style — rounded boxes, decision diamonds
node cli.js create --style flowchart "user signup and email verification flow"

# Sequence style — left-to-right swim lanes
node cli.js create --style sequence "API request from mobile app to backend to database"

# Architecture style — cloud/system components (default)
node cli.js create --style architecture "microservices with API gateway and message queue"
```

---

### More Example Prompts to Try

| Prompt | What you get |
|--------|-------------|
| `"OAuth2 login flow: user, browser, auth server, resource server"` | 4-actor sequence diagram with token exchange |
| `"CI/CD pipeline: GitHub push triggers build, test, Docker image, deploy to k8s"` | Left-to-right pipeline with stage labels |
| `"Multi-agent research system: orchestrator spawns web, academic, and social agents that feed a synthesizer"` | Hub-and-spoke agent topology |
| `"E-commerce checkout: cart, payment gateway, inventory check, order confirmation, email notification"` | Linear flowchart with parallel branches |
| `"WebSocket chat app: client, load balancer, two server nodes, Redis pub/sub, database"` | Infrastructure architecture diagram |

---

## Installation Commands (when you start)

```bash
# In the Vizard/ directory
npm init -y
npm install @google/generative-ai @modelcontextprotocol/sdk dotenv commander inquirer chalk ora open
npm install --save-dev nodemon eslint
```

---

## Improvements Over the Original Reference Project

| Original (Claude-only)                  | Vizard                                          |
|-----------------------------------------|-------------------------------------------------|
| Requires Claude Code CLI installed      | Self-contained Node.js app, runs anywhere       |
| Single-turn only                        | Multi-turn conversation for iterative refinement|
| No diagram validation                   | Validates Excalidraw JSON before saving         |
| No templates                            | Reusable `.prompt` template files               |
| Locked to Claude / Anthropic API        | Gemini free tier; provider easily swappable     |
| MCP server is a black box               | You built both sides — deep MCP understanding   |
| No export options                       | Saves `.excalidraw` + optional SVG              |
| No self-healing                         | Retry loop with error feedback to AI            |

---

## Critical Gotchas

1. **Excalidraw element IDs must be unique strings** — use `crypto.randomUUID()`, never integers
2. **Arrow bindings are fragile** — Gemini generates invalid `startBinding`/`endBinding` often.
   Always validate. This is exactly why Phase 5 validation matters.
3. **Gemini JSON mode needs `responseSchema`** — without it, output is wrapped in markdown
   code fences and will break your JSON parser
4. **MCP stdio transport: never `console.log` in the MCP server** — it writes to stdout and
   corrupts the MCP protocol. Use `console.error` for all debug output.
5. **MCP client owns the server process lifecycle** — spawn it, keep it alive, kill it on exit.
   Handle SIGINT/SIGTERM cleanly.

---

## Blog Post Angles (Built-In)

Because you built both sides of the MCP connection, you have material for at least 3 posts:

| Post | Title idea |
|------|------------|
| 1    | "How MCP actually works — building a server and client from scratch in Node.js" |
| 2    | "Getting Gemini to generate valid JSON every time — structured output deep dive" |
| 3    | "Building a self-healing AI agent — retry loops with error feedback" |

These posts teach something real, not just "I followed a tutorial."

---

## Suggested Timeline

| Session      | Phase  | Work                                              | Test gate                          |
|--------------|--------|---------------------------------------------------|------------------------------------|
| Day 1 AM     | 1A     | Gemini API connection                             | `node test-connection.js` responds |
| Day 1 AM     | 1B     | Excalidraw JSON generation                        | Diagram renders on excalidraw.com  |
| Day 1 PM     | 2      | MCP server (all 3 tools)                          | All 3 tools pass in MCP Inspector  |
| Day 2 AM     | 3A     | MCP client standalone                             | Client lists tools and exits clean |
| Day 2 AM     | 3B     | Gemini agent + full agentic loop                  | Agent creates a diagram end-to-end |
| Day 2 PM     | 4      | CLI (`create`, `update`, `list`, `--style`)       | All 6 manual CLI tests pass        |
| Day 3        | 5      | Validation, retry, multi-turn, templates, SVG     | Each sub-feature tested in order   |

---

*Ready to start? Begin with Phase 1: `npm init` inside this folder.*
