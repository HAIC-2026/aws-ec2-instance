# AllReady — AI-supported ESF-6 planning framework for access and functional needs

HAIC 2026 · AI-Developed Planning & Improvement Challenge · Department of Human Services

## 1. The problem, in DHS’s words

Information about people with access and functional needs (AFN), hazard exposure and available resources is scattered across programs, counties, agencies and nonprofits. Counties lead mass care, the State supports, the two do not co-plan, and each county defines “shelter” differently. Needs are estimated ad hoc, per event, often after impact is certain.

## 2. The framework

**Part 1 — Population mapping.** Every Hawaiʻi census tract is scored on four CMIST proxies from CDC/ATSDR SVI 2022 (limited English → Communication; disability → Independence; age 65+/under 18 → Safety and support; no vehicle → Transportation) and ranked against other Hawaiʻi tracts. Medical dependence comes from HHS emPOWER. These sit on the same map as tsunami evacuation zones, FEMA flood zones, fire detections and live NWS alerts, and — aligned to county planning as the brief requires — each county’s own live shelter records. The event itself is live: whatever the National Weather Service has in force, with the census tracts inside that alert’s polygons as the area at risk. A what-if scenario is opt-in and labelled hypothetical.

**Part 2 — Resource identification.** For hurricane, wildfire, tsunami and flood, a transparent model turns the at-risk population into shelter demand, with a low–high range, and then into resources: space, accessible space, wind-hardened space, backup power, generators, cots, water, meals, dialysis sessions, oxygen, interpreters, lift and ambulatory transport runs, companion-animal spaces and staff. Every planning factor is named, sourced, marked as “published standard” or “assumption”, and visible in the app. Demand is compared with what the counties have confirmed. Where a county never published an attribute, the gap is reported as **unknown** and becomes a ranked **data action** (“confirm ADA status for N shelters with agency X”) instead of an invented number.

**Part 3 — Coordinated response.** An event clock per hazard (tsunami in minutes, wildfire in hours, hurricane in days) carries decision points with owner, trigger, communication channel, languages and trusted messenger — County EMA leads, State ESF-6 (HI-EMA with DHS) supports, with DOT, DOH and partners (Red Cross, Salvation Army, VOAD) in named roles. Planners add their own knowledge as map markup (radius, line, area, hazard and help icons, notes, facility contacts, time windows). The result exports as one coordinated needs-and-resources plan.

**The AI.** An assistant running on the planner’s own machine (Ollama by default, so nothing leaves the building) reads a live snapshot of the map — event, area, alerts, shelters, gaps and markup with the residents and shelters inside each shape — and writes overviews, gap triage and markup briefings grounded only in that snapshot. The Insights page adds live metric tiles, an AI-written summary regenerated from the current figures, and a source list linking every feed.

## 3. Goals and metrics (measured in the app, panel “Goals & metrics”)

| DHS goal | How AllReady measures it | Status |
|---|---|---|
| Hazard-specific AFN maps, four hazards, every county, 100% of tracts (432 of 432 populated 2020 tracts; residents inside each hazard's published zone from 2020 Census blocks, shown in the Event planner and Data health) | Tracts scored ÷ Hawaiʻi tracts returned by SVI; hazards modelled; counties covered | All populated tracts scored (unpopulated tracts excluded and counted); 4 of 4 hazards; 4 of 4 counties for population |
| Needs estimates across all five CMIST categories, validated as reasonable within an agreed margin against past events | One row per category naming its live source, plus the past-events check below | 5 of 5 computed. Checked against five published shelter counts; **the margin is for DHS and the counties to agree** |
| Reduce time to a coordinated needs-and-resources plan | Stopwatch from opening the tool to exporting the plan | Baseline proposed: 3 business days (~24 staff-hours), derived from the manual steps DHS describes. Target: under 15 minutes. Baseline needs DHS confirmation |

Shelter supply covers 4 of 4 counties: three county services, and for Maui, which publishes no list of its own, FEMA's National Shelter System (registered sites, labelled as not county-designated). That Maui's only machine-readable list is federal is itself a finding.

### Goal 2: checked against past events

The live shelter formula is run, untuned, over the area each past event affected and set beside the number of people counted in shelters. Each published count was opened and read at its source, which the app links. The table is computed in the browser on the Insights page (“Checked against past events”); these are the values on 16 Nov 2026.

| Event | Area | Published | Model likely (range) | Turnout observed / assumed | Result |
|---|---|---:|---:|---:|---|
| Hurricane Lane, 23 Aug 2018 | Honolulu | 1,114 | 70,707 (28,283–141,414) | 0.11% / 7.0% | model 63× higher; near miss |
| Hurricane Lane, 23 Aug 2018 | Maui County | 381 | 11,534 (4,614–23,068) | 0.23% / 7.0% | model 30× higher; near miss |
| Hurricane Lane, 23 Aug 2018 | Kauaʻi | 17 | 5,146 (2,058–10,292) | 0.023% / 7.0% | model 303× higher; near miss |
| Hurricane Lane, 23 Aug 2018 | Hawaiʻi County | 14 | 14,151 (5,660–28,302) | 0.007% / 7.0% | model 1,011× higher; near miss |
| Maui wildfires, 11 Aug 2023 | West and Upcountry Maui | 1,418 | 9,391 (3,756–18,782) | 3.2% / 21% | model 6.6× higher |

**Reading.** None of the five counts falls inside the range, and all five misses are high: the model never asked for fewer spaces than were used. The hurricane rate describes a direct hit, and Lane weakened and passed offshore, so these rows size a direct hit and do not predict a near miss. The wildfire count covers congregate shelters only (people later housed in hotels are not in it) and its footprint is drawn by this project. The low–high spread (0.4× to 2×) is our assumption. Nothing was adjusted after seeing the results.

**Proposed margin, for DHS and the counties to agree:** for an event that made direct impact, the published count falls inside the model’s range; near misses are reported but not scored. The observed turnout column gives DHS real rates to calibrate against. Two things would make this check stronger: a direct-hit event with a sourced count (Hurricane ʻIniki, 1992), and counties publishing shelter counts after each activation.

## 4. What the data already shows

- Counties publish very different amounts of what a planner needs: Honolulu’s public layer carries status but no capacity, ADA, animal, power or hardening fields; Hawaiʻi County’s is the richest; Kauaʻi’s is partial; Maui’s does not exist as data.
- Most gaps in accessible, powered and wind-hardened shelter space cannot be closed by procurement until those records are filled in. The cheapest high-value action is completing the shelter attributes.

## 5. Privacy, equity, sustainability

- **Privacy:** only public, de-identified, area-level data; no PII, no registry, no tracking. See SECURITY.md.
- **Equity:** every island and tract is scored on the same basis; missing county data is shown rather than hidden so no community silently drops out. Communication decision points name languages and trusted messengers and include reassurance that shelters are safe regardless of immigration status.
- **System resources to sustain it:** one small Node service (or static hosting without the assistant); no database; no licences (MIT, open data, keyless services); an LLM endpoint — local Ollama on one workstation or a State-approved hosted model; roughly 0.1 FTE to keep feed URLs and planning factors current, and county GIS staff time to complete shelter attributes.

## 6. Approach and artifacts

Built iteratively with AI coding assistance against the challenge brief, rules and scoring criteria. No figure comes from a language model: every count and estimate is computed by readable code from the public feeds, and the assistant only describes them. Artifacts: this repository (source, tests, this plan, [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [ACCESSIBILITY.md](ACCESSIBILITY.md)), the running application, exported plan files and printable briefs. Every data source is listed in the README with its refresh behaviour.

## 7. Out of scope, respected

No personally identifiable client data; no individual registries or tracking; no replacement of county or state emergency operations plans or alerting systems; no production deployment into DHS systems.

## 8. Questions for DHS

1. How long does a needs-and-resources plan for one county and one hazard take today, and would one county run a timed tabletop to measure it with and without the tool?
2. Is “the published shelter count falls inside the model’s range, for direct-impact events” an acceptable margin for goal 2, and which past events should count?
3. Would each county publish capacity, accessibility, power and pet attributes for its shelter sites, and would Maui County publish a machine-readable list?
4. Which partners (Red Cross, Salvation Army, VOAD, utilities, health plans) could share counts per area, never records, and under what agreement?
