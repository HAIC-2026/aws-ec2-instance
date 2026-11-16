# Architecture

## The system in one picture

```
                       PUBLIC, KEYLESS FEEDS (https)
   county shelter services · api.weather.gov · CDC/ATSDR SVI · HHS emPOWER
   USGS · NASA GIBS/FIRMS · Open-Meteo · Hawaiʻi Statewide GIS · FEMA NFHL
                                   ▲
                                   │ read directly, no credentials, no cookies
┌──────────────────────────────────┴───────────────────────────────────┐
│ BROWSER  (three static pages, vanilla JavaScript, no framework)       │
│   home.html      live island figures over the terrain animation       │
│   index.html     planning map: layers, live event, markup, assistant  │
│   insights.html  metric tiles, gaps, readiness, past-events check     │
│                                                                       │
│   feeds → normalise → model (needs → resources → gaps) → panels       │
│   localStorage: layout, theme, language, markup, manual supply        │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ same origin only:  POST /api/chat   GET /api/health
┌──────────────────────────────────┴───────────────────────────────────┐
│ NODE SERVER  (server/, zero runtime dependencies)                     │
│   static files from dist/ (read-only) + security headers              │
│   /api/chat: validate → rate-limit → add instructions → stream        │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ localhost by default
                          ┌────────┴────────┐
                          │ LANGUAGE MODEL  │  Ollama on the same machine,
                          └─────────────────┘  or a hosted OpenAI-compatible provider
```

There is no database, no user accounts and no stored dataset. Every figure is computed in the browser from feeds read when the page loads.

## Decisions, and why

Each decision records the alternative that was rejected, so a reviewer can disagree with the reasoning and not just the result.

### 1. Read public feeds in the browser, not through a backend

- **Chosen:** the browser queries each public service directly.
- **Rejected:** a backend that fetches, stores and re-serves the data.
- **Why:** every source is public and keyless, so a proxy would protect nothing while adding a server to run, a copy of the data to go stale, and a single point of failure. Reading at the source also means the number on screen is the number the county or agency is publishing now. The cost is dependence on third-party uptime, handled by per-feed error states (the rest of the app keeps working) and noted as a production item below.

### 2. No database

- **Chosen:** no persistence on the server at all.
- **Rejected:** PostgreSQL/PostGIS holding tracts, shelters and plans.
- **Why:** the challenge scope excludes client data and registries, so there is nothing that needs to be stored. No database means no data to breach, no migrations, no backup duty and no hosting cost, which matters for a tool DHS must be able to sustain. An earlier in-browser SQL console was removed for the same reason: it implied a database that does not exist.

### 3. One small server, only for the assistant

- **Chosen:** a zero-dependency Node server whose only dynamic job is `/api/chat`.
- **Rejected:** calling the model from the browser.
- **Why:** a hosted model needs an API key, and a key in a browser is a published key. Putting the model call behind our own endpoint also gives one place to validate input, cap sizes, rate-limit, and fix the system instructions so a client cannot rewrite them. Zero dependencies keeps the server's supply chain to Node itself.

### 4. A local model by default

- **Chosen:** Ollama on the operator's machine, model `llama3.2`.
- **Rejected:** a hosted model as the default.
- **Why:** nothing leaves the building, there is no key to manage and no per-question cost, and it works with the network down. That fits a government planning tool better than a cloud dependency. The trade-off is a smaller, slower model, so the design does not depend on the model being clever: all arithmetic is done in code and the model is asked only to describe figures it is handed. The endpoint is provider-agnostic, so an agency can point it at an approved hosted or in-boundary model by changing three environment variables.

### 5. Numbers from code, words from the model

- **Chosen:** the model never computes, retrieves or stores anything.
- **Why:** a planner has to be able to trace every number. Needs, resources and gaps come from `src/model.js` with named, sourced planning factors. The assistant receives a JSON snapshot of what is on screen and is instructed to use nothing else, to say when something is not published, and never to issue orders or alerts.

### 6. Live by default; what-if is opt-in and labelled

- **Chosen:** the event is the NWS alert in force; the people at risk are the census tracts inside that alert's polygons (`src/live.js`).
- **Rejected:** opening on a demonstration scenario.
- **Why:** a dashboard that opens on “Hurricane warning, T−2 days” when no hurricane exists teaches people not to trust it. With no relevant alert the app shows no needs and no gaps, only what is real: residents, AFN measures and shelter inventory. A what-if scenario must be chosen deliberately and is marked hypothetical in the header chip, the panels, the export and the assistant's instructions.

### 7. Unknown stays unknown

- **Chosen:** shelter attributes are tri-state: `true`, `false`, or `null` for “the county never published this”.
- **Rejected:** defaulting missing values to `false` or `0`.
- **Why:** “not accessible” and “nobody told us” lead to different actions. Treating them alike either hides a real gap or invents one. Unknowns surface as data actions (“confirm ADA status for N sites with agency X”), which is the cheapest high-value work the tool can point at.

### 8. Vanilla JavaScript and MapLibre, not a framework or a proprietary SDK

- **Chosen:** ES modules, Vite for bundling, MapLibre GL for the map. Three runtime dependencies in total (`maplibre-gl`, `three`, `lucide`).
- **Rejected:** React or similar; the ArcGIS Maps SDK.
- **Why:** fewer dependencies means a smaller audit surface and a codebase a State developer can read without learning a framework. MapLibre is open source with no licence key, and it reads ArcGIS REST services directly, so every Esri-hosted State and county layer still works, including any public layer a planner pastes in.

### 9. One definition of each thing

The AFN measures live in `src/svi.js`, planning factors in `src/model.js`, the source list in `src/sources.js`, the event phases in `src/scenario.js`. Both pages import them, so the map and Insights cannot disagree.

## Data flow for one question

1. Browser reads feeds → `shelters.js`, `svi.js`, `empower.js` normalise them.
2. `live.js` derives the event from NWS alerts (or the planner picks a what-if).
3. `model.js` computes needs, resources and gaps for the tracts in the event area.
4. The planner asks the assistant. `planner.js` builds a snapshot: mode, event, area totals, needs, gaps, shelter readiness by county, alerts, and markup with what falls inside each shape. Points of contact are stripped first.
5. `POST /api/chat` validates, rate-limits, prepends the fixed instructions and streams the model's text back.
6. The browser renders the answer as text nodes only.

Slow-changing facts are placed first in the snapshot so a local model reuses what it has already read; a follow-up question pays only for what changed.

## Refresh cadence

| Data | Re-read |
|---|---|
| NWS alerts, county shelter feeds | every 5 minutes |
| Census tracts, emPOWER, weather grid | every 30 minutes, and on the refresh button |
| Alert history, hazard-zone layers | on demand |

## Failure behaviour

| If this fails | The app does this |
|---|---|
| One county's shelter service | Marks that county unavailable; other counties and all other panels continue |
| NWS alerts | Says the feed is unavailable; does not assume “no event” silently |
| Weather grid (rate limit) | Keeps showing the last reading, dated, and says why |
| The model or Ollama | Assistant panel explains what to start; everything else works |
| The whole server (static hosting) | All pages work; assistant reports it is offline |
| WebGL unavailable | Map page shows a message; Insights and Home still work |

## What it costs to run

One small Node process, or static hosting without the assistant. No database, no licences, no API keys. A model endpoint: one workstation with 8 GB of RAM running Ollama, or a State-approved hosted model. Upkeep is roughly keeping feed addresses and planning factors current.

## Known debt and next steps

1. `src/planner.js` is about 1,300 lines and should be split into layers, panels and assistant context before long-term maintenance.
2. Browser reads depend on third-party uptime and rate limits; a State deployment may want a small caching proxy for resilience and offline use.
3. Planning factors and the Goal 3 baseline need validation with DHS and county emergency management agencies.
4. No formal WCAG 2.1 AA audit or screen-reader test has been done.
5. Resident-facing multilingual messages are described in decision points but not generated; translations need community review.
6. Maui County has no machine-readable shelter feed; the app can only report the gap.
7. For State use: single sign-on, server-side audit logging and an approved model endpoint (see [SECURITY.md](SECURITY.md)).
