# Security and privacy

## Submission-form description (under 300 words)

AllReady is built so there is very little to protect. It reads only public, de-identified, area-level data: census-tract SVI, ZIP-level emPOWER, county shelter records, NWS and USGS feeds. It holds no client data, creates no registry of individuals, and has no user accounts and no database. Layouts, markup and optional agency points of contact are stored only in the planner's own browser; contacts are stripped from everything sent to the AI model.

The assistant is the one server-side component. By default it calls a model running on the same machine (Ollama), so prompts never leave the building. The browser reaches it only through our own `/api/chat`, which validates message shape and size, caps the request body, rate-limits each client, refuses cross-origin callers, fixes the system instructions server-side, and returns generic errors. If a hosted model is used, its key lives in a server environment variable, never in the browser or the repository. The model sees only a snapshot of the screen, is told to use nothing else and never to issue orders or alerts, and its output is rendered as plain text, so neither a model nor a pasted note can inject script.

The server sends a strict Content-Security-Policy (scripts from this origin only, no inline, no eval, no framing), HSTS, nosniff and a locked-down permissions policy, serves files read-only and refuses path traversal. Planner-added map layers must be public https services; sign-in services are refused and fields that look like personal data are hidden. Dependencies are audited (0 known vulnerabilities) and eleven automated tests cover these controls on every push.

For State production we would add single sign-on with roles, server-side audit logging, an approved in-boundary model, a WAF, and data-sharing agreements and privacy review before any agency data is introduced.

## What is protected, and what is not there to protect

| Data | Where it lives | Sensitivity |
|---|---|---|
| Census-tract measures, emPOWER counts, shelter records, alerts | Fetched from the publisher into the browser's memory | Public |
| Layout, theme, language, manual supply figures | The planner's browser (`localStorage`) | Low |
| Markup: shapes, titles, notes | The planner's browser; titles and notes are sent to the model when a question is asked | Low; planner-authored |
| Partner commitments (organisation, resource, quantity, date, contact role) | The planner's browser; exported as CSV only on request; text that looks like a phone number, email or personal identifier is refused | Organisation-level |
| Markup points of contact (agency staff) | The planner's browser only; never sent to the server or the model; leaves only by explicit export | Business contact details |
| Model API key (hosted providers only) | Server environment variable | Secret |
| Personal data about residents, DHS client records, health records | **Not collected, not stored, not processed** | Not applicable |

emPOWER counts from 1 to 10 are shown as a range, as HHS publishes them, and ZIP-level counts are never split into smaller areas.

## Threat model

| Threat | Control | Where |
|---|---|---|
| Script injection through model output, feed attributes or a pasted note | All dynamic text is written as text nodes, never as HTML; CSP forbids inline and eval scripts | `src/assistant.js`, `server/security.js` |
| Prompt injection through markup notes or feed text | Instructions are fixed on the server; the model is told that snapshot text is data; it has no tools, no network and no write access, so the worst outcome is a wrong sentence on screen | `server/llm.js` |
| The model inventing figures | All numbers are computed in code; the model is given them and told to quote exactly and to say “not published” when absent; the panels remain the source of truth | `src/model.js`, `server/llm.js` |
| Leaking a provider key | Key is read from the environment on the server only; `.env` is git-ignored; a test asserts the key never appears in a response | `server/llm.js`, `server/api.test.js` |
| Other websites spending the model quota | Same-origin check on `Origin` and `Sec-Fetch-Site`; optional allow-list | `server/llm.js` |
| Flooding the assistant | Per-client rate limit, 120 KB body cap, 24-message and 4,000-character limits, bounded answer length, request and header timeouts | `server/llm.js`, `server/index.js` |
| Personal data arriving from a public source | FEMA's shelter service includes staff contact fields; queries name only facility fields, so contacts never reach the browser | `src/shelters.js` |
| A hostile or malformed markup file | Imports are capped at 2 MB and 2,000 items; every item is rebuilt from an allow-list (known kinds, coordinates in range, bounded text, real colours) and added beside existing markup, never replacing it | `src/markupclean.js`, `src/markupclean.test.js` |
| A secret or repository file left in the web root | Hidden files (anything starting with a dot) are never served, except `/.well-known/security.txt` | `server/static.js`, `server/static.test.js` |
| Visitors' addresses reaching third parties | Fonts are served from the site itself; the only outside requests are the public data feeds a page needs, and none carries cookies or credentials | `public/fonts/`, `src/net.js`, `server/security.js` |
| Formula injection through exported CSV | Cells beginning with = + - @ are prefixed so a spreadsheet treats them as text; imports are size-capped and validated row by row | `src/match.js` |
| Reading files outside the web root | Paths are decoded, normalised and checked against the root; malformed and NUL paths are refused; only GET and HEAD are allowed | `server/static.js`, `server/static.test.js` |
| Clickjacking, MIME sniffing, downgrade | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS | `server/security.js` |
| A malicious or sign-in-protected map service | https only; token-gated services refused; requests carry no credentials; suspect field names hidden | `src/arcgis.js` |
| Compromised dependency | Three runtime packages, pinned by lockfile; the server has none; `npm audit` in CI; Dependabot | `package.json`, `.github/` |
| Error messages revealing internals | Generic errors to the client; upstream bodies and stack traces are never echoed | `server/llm.js`, `server/index.js` |
| A model output mistaken for an official warning | The warning outlook is labelled "not a forecast or warning" in every place it appears, sits apart from the NWS alert list, and only links to a what-if rehearsal; it never triggers a message or a live event | `src/outlook.js`, `src/planner.js`, `src/scenarios.js` |
| Misuse as an alerting or tracking tool | No accounts, no resident-level data, no outbound messaging; it has no way to send anything outward; the home page, the Insights footer and every exported plan state it is not an alert | whole design |

Residual risks, stated plainly: the app trusts the public feeds it reads (a wrong county record shows as a wrong figure, with its source linked); `connect-src` allows any https host because planners may add any public ArcGIS layer; anyone who can use the planner's browser profile can read its local markup (see "Is storing planner entries in the browser safe enough?" below); and a small local model can still misread a snapshot.

## How to verify

```bash
npm test
```

```bash
npm audit
```

The tests assert the security headers on every response, refusal of traversal, hidden files and non-GET methods, input validation and limits, cross-origin refusal, rate limiting, that the key stays on the server, that hung feeds are cut off, and that imported markup is rebuilt from an allow-list.

```bash
npm run sbom
```

writes the software bill of materials (CycloneDX) to `docs/sbom.cdx.json`. CodeQL scans every push (`.github/workflows/codeql.yml`) and Dependabot watches dependencies. `/.well-known/security.txt` tells anyone who finds a problem where to report it privately.

## The view from each stakeholder

| Who | What they need from the design | How AllReady answers |
|---|---|---|
| Residents with access and functional needs | Never to be identifiable, tracked or listed; to be counted fairly on every island | Area-level public data only; no registry, no accounts, no resident ever entered; every populated tract scored the same way; missing county data shown as missing, never as zero |
| DHS and HI-EMA leadership | Nothing that could be mistaken for an alert or an order; decisions stay with people | No outbound channel exists; live vs what-if labelled everywhere; the model outlook and the assistant are labelled advisory; every figure links to its source |
| County emergency managers | Their shelter data untouched and credited; county lead respected | Read-only queries to the services counties already publish; links back to each; decision points written county-led, State-supported |
| Partner organisations | Commitments recorded about the organisation, not its staff or clients | The form and CSV import refuse phone numbers, emails and ID numbers; commitments stay local until exported |
| ETS / State security office | Something they can host, scan and reason about | Zero-dependency server, three pinned browser libraries, SBOM, CodeQL, strict CSP, no secrets in source, a written threat model and the control map below |
| Developers who maintain it | Safe defaults that are hard to break by accident | All outside requests through one bounded helper (`src/net.js`); all dynamic text written as text; tests for each control |

## Controls in place, control by control (NIST SP 800-53 Rev. 5)

| Control | What is implemented now | Evidence |
|---|---|---|
| AC-4 Information flow enforcement | Points of contact are stripped before any snapshot reaches the model; nothing a planner enters leaves the browser unless exported | `src/annotations.js` snapshot, `src/planner.js` mapContext |
| CM-7 Least functionality | Server answers GET/HEAD for files and two API routes only; hidden files never served | `server/static.js`, `server/static.test.js` |
| SA-11 / SR-3 Developer testing, supply chain | 21 automated tests, dependency audit and CodeQL on every push; SBOM; lockfile-pinned dependencies | `.github/workflows/`, `docs/sbom.cdx.json` |
| SC-5 Denial-of-service protection | Rate limits, body and message caps, bounded model output, request and header timeouts; every outside request has a time limit | `server/llm.js`, `server/index.js`, `src/net.js` |
| SC-8 / SC-23 Transmission and session integrity | HTTPS-only data sources, HSTS, no cookies or credentials sent to any outside service | `server/security.js`, `src/net.js` |
| SC-18 Mobile code | Scripts only from this site; no inline script, no `eval`; fonts self-hosted | CSP in `server/security.js` |
| SI-10 Information input validation | Chat input, CSV import and markup import validated, size-capped and rebuilt from allow-lists | `server/llm.js`, `src/match.js`, `src/markupclean.js` |
| SI-11 Error handling | Generic errors to clients; upstream bodies never echoed; failed feeds reported as unavailable, not as data | `server/llm.js`, `src/shelters.js` |
| SI-12 Information management and retention | Every item kept in the browser listed with its retention and a clear button | Data health → Data in this browser |
| PT-2 / PT-3 Authority and purpose (privacy) | Purpose limited to planning; no personal information processed | Challenge scope; this document |

## Plan of action and milestones for a production deployment

| Gap | Control | Action | Owner | When |
|---|---|---|---|---|
| No sign-in or roles | AC-2, IA-2 | Put the app behind State single sign-on; roles for county EMA, DHS and partner organisations | ETS with DHS | Before any staff pilot |
| Planner entries live only in one browser | SC-28, AU-2 | Move markup, commitments and supply counts to an encrypted State database with an audit log of every change | ETS | Pilot |
| No retention schedule for planner entries | SI-12 | DHS sets retention; automatic expiry of stale entries | DHS records officer | Pilot |
| Accessibility not formally audited | Section 508 | Independent WCAG 2.1 AA audit with screen-reader users, including people with AFN | DHS with DCAB | Before public use |
| Translations are drafts | Title VI, HRS 321C | Native-speaker review through the State Office of Language Access and community partners | DHS | Before public use |
| Assistant model hosting | SA-9 | State-hosted or authorized model so no prompt leaves State systems | ETS | Pilot |
| No formal assessment | CA-2, CA-6 | Security assessment and authorization to operate by ETS | ETS | Before production |

## Laws, standards and policies

This is an engineering mapping to show where the design stands. It is **not legal advice, a certification, or an authorization to operate**. Before adoption it needs review by the Department of the Attorney General, the Office of Enterprise Technology Services (ETS) and the DHS privacy officer.

### Federal

| Requirement | What it asks | Where AllReady stands |
|---|---|---|
| HIPAA Privacy and Security Rules (45 CFR Parts 160, 164) | Safeguard identifiable health information | No protected health information is used. emPOWER is published by HHS already de-identified and aggregated, and is never joined to anything that could re-identify a person. Adding health-plan or DOH data would require a HIPAA review and agreements first. |
| Stafford Act §308 (42 U.S.C. 5151) and FEMA guidance on access and functional needs | Non-discrimination and inclusion in emergency programs | Every populated tract on every island is scored on the same basis; missing county data is shown, not hidden. |
| Title VI of the Civil Rights Act | Meaningful access regardless of national origin, including language | Limited-English population is mapped; the interface is offered in seven languages as drafts pending native-speaker review. |
| ADA Title II and Section 508 of the Rehabilitation Act; WCAG 2.1 AA | Accessible digital services | Keyboard operation, labels, contrast, reduced motion and landmarks are built in and self-audited. **Not yet formally audited or screen-reader tested.** |
| NIST Cybersecurity Framework 2.0 | Govern, Identify, Protect, Detect, Respond, Recover | Identify: data inventory above. Protect: headers, validation, least functionality. Detect and Respond are thin by design (no accounts, no stored data) and would be supplied by State logging and monitoring in production. |
| NIST SP 800-53 Rev. 5 (control families) | Baseline controls for government systems | Addressed in design: SC (boundary and transmission protection, CSP), SI (input validation, error handling), CM (least functionality, pinned dependencies), SA and SR (supply chain), AC-4 (information flow: contacts never leave the browser). To be supplied by the hosting agency: AC and IA (identity), AU (audit), IR, CP. |
| NIST SP 800-218 (Secure Software Development Framework) | Secure development practices | Automated tests and dependency audit in CI, no secrets in source, documented threat model. |
| NIST AI Risk Management Framework 1.0 and its Generative AI Profile | Trustworthy, transparent, accountable AI | The model has no decision authority; inputs and limits are documented; output is grounded in visible data, labelled as an assistant, and checkable against the panels; a human acts on every result. |
| OWASP Top 10 and OWASP Top 10 for LLM Applications | Common web and LLM weaknesses | Injection, access control and misconfiguration are covered in the threat model. The server makes outbound requests only to the configured model address, so there is no server-side request forgery path. For LLMs: prompt injection (fixed instructions, no tools), sensitive information disclosure (contacts stripped, public data only), improper output handling (text-only rendering), excessive agency (none), unbounded consumption (rate and size limits). |
| FedRAMP / GovRAMP | Authorized cloud services for government data | Not applicable to the default local deployment. A hosted model or cloud host for State use should be an authorized service. |

### State of Hawaiʻi

| Requirement | What it asks | Where AllReady stands |
|---|---|---|
| HRS §346-10 | DHS applicant and recipient records are confidential | No DHS client data is used, by design and by the challenge's scope. |
| HRS ch. 487N (security breach of personal information) | Notify when personal information is breached | The system holds no personal information on any server. |
| HRS ch. 487J (personal information protection) | Protect Social Security numbers and similar identifiers | None are collected; planner-added layers with such field names are flagged and hidden. |
| HRS ch. 487R (destruction of personal information records) | Dispose of personal records securely | Nothing is retained server-side. Local markup can be cleared by the planner. |
| HRS ch. 92F (Uniform Information Practices Act) | Government records are open unless excepted | All inputs are already public records; the Data sources panel links to each. |
| HRS ch. 321C (language access) | Meaningful access to State services for people with limited English | Same position as Title VI above; translations need community review before public use. |
| HRS ch. 127A (emergency management) | Counties and the State hold emergency management authority | The tool is advisory. It issues no alerts or orders and has no channel to send one; the home page, Insights footer and exported plans say it is not an alert. |
| ETS security policies and State AI guidance | Approved hosting, identity, logging and AI use | A State deployment would add single sign-on, audit logging, and an approved or in-boundary model. Local Ollama keeps all prompts on State hardware. |

### County

Counties lead mass care and own their shelter data. AllReady only reads the feature services each county already publishes to the public, changes nothing in them, and links back to each. A county using the tool would apply its own IT security policy to the workstation it runs on. Maui County publishes no list of its own, so Maui sites come from FEMA's public National Shelter System and are labelled as registered sites, not county designations. That service also carries point-of-contact names, phones and emails; AllReady requests only facility fields and never reads them.

## Data governance: what is kept, where, and for how long

AllReady has no accounts, no database and no server-side storage. The only data it keeps is in the planner's own browser, and the **Data in this browser** panel on the Data health page lists every item, what kind of data it is, how long it is kept, and lets the planner clear any of it (or everything) at once.

| Kind of data | Examples | Kept |
|---|---|---|
| Public | Last shelter list per county, weather and forecast caches | Replaced on every read; 30–60 minutes for caches |
| Planner entry (organisations and facilities, never residents) | Map markup and facility points of contact, partner commitments, supply counts | Until the planner deletes it; commitments are flagged for re-confirmation after 30 days |
| Settings | Layers, layout, theme, language, hidden guides | Until changed |

Nothing in the browser is sent anywhere unless the planner exports it. Points of contact are removed before any snapshot reaches the assistant. In a State deployment, planner entries would move behind State single sign-on with the retention schedule DHS sets.

### Is storing planner entries in the browser safe enough?

For this prototype, yes, and here is the honest reasoning rather than a yes on faith.

- **What is at stake is small by design.** Nothing about residents is ever stored: the public figures are area-level, and planner entries are about organisations and facilities. The most sensitive item is a facility or agency point of contact typed into map markup, which is a work contact, and it is stripped before anything reaches the assistant.
- **The main browser risk is script injection, and it is closed.** A script running on the page could read local storage. The Content-Security-Policy allows scripts only from this site, with no inline script and no `eval`; all dynamic text is written as text, never as HTML; imported files are validated.
- **What browser storage cannot do:** it is not encrypted beyond the device's own disk encryption, it has no per-user access control on a shared computer, and it keeps no audit trail. Those are exactly the controls a production deployment needs, so they are listed here rather than claimed.
- **A container is not the answer to this particular question.** Packaging the server in a container hardens and standardises the *server*; it does not change where the browser keeps data. The fix for the limits above is moving planner entries server-side.

**Production plan.** Host AllReady on State infrastructure (ETS) as a hardened container running as a non-root user on a read-only file system, behind State single sign-on. Move markup, partner commitments and supply counts into an encrypted State database with role-based access (county EMA, DHS, partner organisation), an audit log of every change, and a retention schedule set by DHS. Keep the public-data pages reachable without sign-in. Point the assistant at a State-hosted model so no prompt leaves State systems.

## AI safeguards in one place

- The model receives only the on-screen snapshot: public area-level figures plus the planner's markup titles and notes. Never points of contact.
- Instructions are set on the server: use only the snapshot, quote figures exactly, say when data is not published, call what-if figures hypothetical, never issue orders, alerts or evacuation instructions, no personal information.
- The model has no tools, cannot browse, and cannot change anything in the app.
- Output is plain text, bounded in length, and shown beside the panels it describes.
- With the default local model, no prompt leaves the machine.

## Reporting a problem

Open a GitHub issue marked “security”. Do not include secrets or personal data in the issue.
