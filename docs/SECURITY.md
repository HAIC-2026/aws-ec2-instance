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
| Partner pledges (organisation, resource, quantity, date, contact role) | The planner's browser; exported as CSV only on request; text that looks like a phone number, email or personal identifier is refused | Organisation-level |
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
| Reading files outside the web root | Paths are decoded, normalised and checked against the root; malformed and NUL paths are refused; only GET and HEAD are allowed | `server/static.js`, `server/static.test.js` |
| Clickjacking, MIME sniffing, downgrade | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS | `server/security.js` |
| A malicious or sign-in-protected map service | https only; token-gated services refused; requests carry no credentials; suspect field names hidden | `src/arcgis.js` |
| Compromised dependency | Three runtime packages, pinned by lockfile; the server has none; `npm audit` in CI; Dependabot | `package.json`, `.github/` |
| Error messages revealing internals | Generic errors to the client; upstream bodies and stack traces are never echoed | `server/llm.js`, `server/index.js` |
| Misuse as an alerting or tracking tool | No accounts, no resident-level data, no outbound messaging; it has no way to send anything outward; the home page, the Insights footer and every exported plan state it is not an alert | whole design |

Residual risks, stated plainly: the app trusts the public feeds it reads (a wrong county record shows as a wrong figure, with its source linked); `connect-src` allows any https host because planners may add any public ArcGIS layer; anyone who can use the planner's browser can read its local markup; and a small local model can still misread a snapshot.

## How to verify

```bash
npm test
```

```bash
npm audit
```

The tests assert the security headers on every response, refusal of traversal and non-GET methods, input validation and limits, cross-origin refusal, rate limiting, and that the key stays on the server.

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

Counties lead mass care and own their shelter data. AllReady only reads the feature services each county already publishes to the public, changes nothing in them, and links back to each. A county using the tool would apply its own IT security policy to the workstation it runs on. Where a county publishes no machine-readable layer (Maui), the app reports the gap and does not substitute another list.

## AI safeguards in one place

- The model receives only the on-screen snapshot: public area-level figures plus the planner's markup titles and notes. Never points of contact.
- Instructions are set on the server: use only the snapshot, quote figures exactly, say when data is not published, call what-if figures hypothetical, never issue orders, alerts or evacuation instructions, no personal information.
- The model has no tools, cannot browse, and cannot change anything in the app.
- Output is plain text, bounded in length, and shown beside the panels it describes.
- With the default local model, no prompt leaves the machine.

## Reporting a problem

Open a GitHub issue marked “security”. Do not include secrets or personal data in the issue.
