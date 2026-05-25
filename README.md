# Vizard

> Generate and refine Excalidraw diagrams from plain-English descriptions — powered by Google Gemini.

Vizard is a CLI tool and MCP server that turns natural-language descriptions into valid `.excalidraw` files. Describe a system, a flow, or an architecture in plain text and get a diagram you can open, edit, and share on [excalidraw.com](https://excalidraw.com) — no drawing required.

---

## Why "Vizard"?

**Vizard** = **Viz** (visualization) + **Wizard** (AI magic).

A vizard is a visualization wizard — you describe a system in plain English and it conjures the diagram for you. No drawing, no diagram syntax, no fiddling with boxes and arrows. Just describe it, and it appears.

There's also an archaic meaning: a *vizard* is a mask or visor — something that gives shape and form to the abstract. That's exactly what this tool does: it takes invisible, conceptual architecture and gives it a visual face.

---

## Features

- **Plain-English input** — describe any system or process, no diagram syntax to learn
- **Three diagram styles** — `flowchart`, `sequence`, and `architecture`
- **Multi-turn refinement** — keep iterating on a diagram in the same session
- **Built-in templates** — pre-written prompts for RAG pipelines, microservices, auth flows, and CI/CD
- **SVG export** — every diagram is saved alongside a `.svg` file
- **Self-healing generation** — validates Excalidraw JSON and retries automatically on errors
- **MCP server** — expose diagram tools to any MCP-compatible client (Claude Code, Cursor, etc.)

---

## Prerequisites

- **Node.js 20+**
- A **Google Gemini API key** — free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Installation

```bash
# Clone and install
git clone https://github.com/your-username/vizard.git
cd vizard
npm install

# Set your API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

To use `vizard` as a global command:

```bash
npm install -g .
```

Or run directly without installing:

```bash
npx tsx src/cli.ts <command>
```

---

## CLI Usage

### Create a diagram

```bash
vizard create "A RAG pipeline: user query → embedding model → vector store → LLM → answer"
```

With a specific style:

```bash
vizard create --style flowchart "user signup and email verification flow"
vizard create --style sequence "client sends request to server, server queries DB, returns response"
vizard create --style architecture "microservices with API gateway and message queue"
```

From a built-in template:

```bash
vizard create --template rag
vizard create --template microservices
vizard create --template auth
vizard create --template cicd
```

After a diagram is created, Vizard enters an interactive refinement loop — describe changes and press Enter to apply them. Press Enter with no input to finish.

```
Refine this diagram? (describe changes or press Enter to finish):
> add a cache layer before the database
> make the auth service a separate box
>
```

### Update an existing diagram

```bash
vizard update ./diagrams/rag-pipeline.excalidraw "add a reranker step between retriever and LLM"
```

### List saved diagrams

```bash
vizard list
```

---

## MCP Server

Vizard exposes three tools over the [Model Context Protocol](https://modelcontextprotocol.io), making it usable from Claude Code, Cursor, or any other MCP-compatible client.

### Start the server

```bash
vizard mcp
# or
npm run mcp:server
```

The server communicates over stdio and registers three tools:

| Tool | Description |
|------|-------------|
| `create_diagram` | Generate a new diagram from a plain-English description |
| `update_diagram` | Modify an existing `.excalidraw` file with plain-English changes |
| `list_diagrams` | List all saved diagrams in the `diagrams/` directory |

### Connect from Claude Code

Add Vizard to your Claude Code MCP config (`~/.claude/mcp.json` or `.claude/mcp.json`):

```json
{
  "mcpServers": {
    "vizard": {
      "command": "node",
      "args": ["/absolute/path/to/vizard/dist/cli.js", "mcp"]
    }
  }
}
```

Once connected, you can ask Claude to draw diagrams and they will be created using Vizard's tools.

---

## Diagram Styles

| Style | Best for |
|-------|----------|
| `architecture` | System components, cloud infrastructure, service topology (default) |
| `flowchart` | Process steps, decision branches, user flows |
| `sequence` | Actor interactions, API request/response, swim lanes |

---

## Example Prompts

| Prompt | What you get |
|--------|-------------|
| `"OAuth2 login flow: user, browser, auth server, resource server"` | 4-actor sequence with token exchange |
| `"CI/CD pipeline: GitHub push → build → test → Docker image → deploy to k8s"` | Left-to-right pipeline with stage labels |
| `"Multi-agent system: orchestrator spawns web, academic, and social agents feeding a synthesizer"` | Hub-and-spoke agent topology |
| `"E-commerce checkout: cart, payment gateway, inventory, order confirmation, email"` | Linear flowchart with parallel branches |
| `"WebSocket chat: client, load balancer, two server nodes, Redis pub/sub, database"` | Infrastructure architecture diagram |

---

## How It Works

```
CLI / MCP client
      │
      ▼
  MCP Server (Node.js, stdio)
      │  registers tools
      ▼
  Gemini (google-generative-ai)
      │  structured JSON output (responseSchema enforced)
      ▼
  Excalidraw JSON validator
      │  checks element IDs and arrow bindings; retries on failure
      ▼
  diagrams/<name>.excalidraw  +  diagrams/<name>.svg
```

Gemini generates structured Excalidraw JSON using a strict `responseSchema` — no markdown fences, no post-processing. The validator checks that all element IDs are unique strings and that arrow bindings reference real elements. If validation fails, the error is fed back to Gemini and generation retries automatically (up to 3 times).

---

## Project Structure

```
src/
├── cli.ts                         # CLI entry point (commander)
├── mcp-server/
│   ├── index.ts                   # MCP server (stdio transport)
│   └── tools/
│       ├── create-diagram.ts      # create_diagram tool
│       ├── update-diagram.ts      # update_diagram tool
│       └── list-diagrams.ts       # list_diagrams tool
├── agent/
│   ├── index.ts                   # Gemini function-calling loop
│   ├── prompts.ts                 # System prompt + few-shot examples
│   └── schema.ts                  # Excalidraw responseSchema for Gemini
└── utils/
    ├── excalidraw.ts              # JSON builder and envelope wrapper
    ├── validate.ts                # Element ID and binding validation
    ├── generate-with-retry.ts     # Retry loop with error feedback
    ├── svg.ts                     # SVG export
    └── templates.ts               # Template loader
examples/                          # Pre-written .prompt template files
diagrams/                          # Output directory (gitignored)
```
