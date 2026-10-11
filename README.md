# Agentic Release Life Cycle

Node.js system that uses **Gemini as an LLM agent with tools** for binary **GO / NO_GO** release decisions and deployment strategy selection (rolling, canary, blue-green, recreate, A/B).

Promotion chain: **Alpha → Beta → Gamma → Prod**

## UI theme

Radiant **golden yellow** accents on a **white** background for high visibility.

## Features

| Capability | Description |
|---|---|
| LLM-as-agent | Gemini calls tools in a loop, then classifies GO vs NO_GO |
| Binary classification | Structured `decision: "GO" \| "NO_GO"` with confidence |
| Multi-signal evidence | Tests, vulnerabilities, OWASP, code quality, performance, change risk |
| Deployment strategies | rolling · canary · blue-green · recreate · a-b |
| Environment-aware gates | Stricter thresholds toward Prod |
| CI-friendly exit codes | `0` = GO, `2` = NO_GO, `1` = error |

## Quick start

```bash
npm install
cp .env.example .env
# Set GEMINI_API_KEY from https://aistudio.google.com/apikey

npm run demo                          # CLI demo
PORT=3847 node src/server/static-server.js   # UI (demo mode)
npm run ui                            # UI with live Gemini (requires express deps)
```

Open **http://localhost:3847**

## Screens

- **Dashboard** — stats, pipeline, quick demos, recent decisions
- **Evaluate Release** — run agent, see GO/NO-GO + strategy + gates
- **Pipeline** — Alpha→Prod stages and deployment strategies
- **History** — session evaluations
- **Thresholds** — environment gates table

## Architecture

```
CLI / Web UI → ReleaseAgent (Gemini + tools) → GO/NO_GO + deploy strategy
Tools: tests, vulns, OWASP, quality, performance, change risk, trigger_deployment
```

## License

MIT
