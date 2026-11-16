# Accessibility

AllReady is a tool about access and functional needs, so it should not shut out the people it is about. This is what was checked, what was fixed, and what is still open. It is a self-audit against WCAG 2.1 AA, not a certification.

## Checked and passing (15–16 Nov 2026, all three pages)

| Check | Result |
|---|---|
| Every button, link, input and select has an accessible name | Pass — automated scan found none unnamed |
| Page language is declared and follows the language picker | Pass (`<html lang>` updates) |
| Landmarks and a skip link on every page | Pass (`header`, `main`, “Skip to…”) |
| Text contrast | Fixed — secondary text was about 3.3:1 on dark; raised to meet 4.5:1 in both themes |
| Keyboard: navigation rail, panels, timeline, event clock, Insights widgets (arrow keys move, Shift+arrows resize) | Operable |
| Focus is always visible | Pass (2px ring) |
| Controls that appeared only on mouse hover | Fixed — they now also appear on keyboard focus |
| A panel could scroll out of reach with no way back | Fixed |
| Reduced-motion preference | Respected: animation, smooth scrolling and playback are disabled |
| Light and dark themes; follows the system setting | Pass |
| Status changes announced (data read, live status) | `role="status"` on those lines |
| Colour is never the only signal | Gaps carry text (“short”, “unknown”); status dots have labels |
| Seven languages across the whole interface | Pass — switching verified on every page |
| Home page headline hidden under the header on laptop-height screens | Fixed |

## Known gaps

1. **Not tested with a screen reader** (VoiceOver, NVDA, JAWS) or with users who rely on one. This is the most important open item.
2. **The map itself is visual.** Drawing shapes and dragging icons need a pointer. Everything the map shows about needs, shelters and gaps is also available as text in the panels and on Insights, but there is no keyboard way to draw markup yet.
3. **Translations are partial for live text.** Interface labels are translated; sentences built from live data, place names, source names and AI-written text stay in English.
4. **No Hawaiian, Ilocano, Samoan, Chuukese or Marshallese yet.** They need native-speaker review before being offered.
5. **Dense layout.** The map workspace is built for desktop planners; on a phone it is usable but cramped. The home page and Insights reflow properly.
6. **Reading level** of the interface has not been reviewed for plain language.

## Before public or State use

A formal WCAG 2.1 AA audit, screen-reader testing, and review by people with disabilities and by community language partners.
