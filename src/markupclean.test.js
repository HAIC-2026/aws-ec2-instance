/* Imported markup is untrusted: only well-formed items survive, rebuilt from an allow-list. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMarkup } from "./markupclean.js";

let n = 0; const id = () => "new" + n++;
const ICONS = { shelter: {}, note: {} };

test("keeps a valid area and drops fields the editor would never create", () => {
  const o = cleanMarkup({ id: "a1", kind: "area", coords: [[-156.6, 20.9], [-156.5, 20.9], [-156.5, 21]], color: "#ff6a5c", title: "Lahaina", evil: "<script>", onload: "x" }, id, ICONS);
  assert.equal(o.kind, "area"); assert.equal(o.coords.length, 3); assert.equal(o.color, "#ff6a5c");
  assert.equal(o.evil, undefined); assert.equal(o.onload, undefined);
});

test("rejects unknown kinds, bad coordinates and non-objects", () => {
  assert.equal(cleanMarkup({ id: "x", kind: "script" }, id, ICONS), null);
  assert.equal(cleanMarkup({ id: "x", kind: "icon", at: [999, 20] }, id, ICONS), null);
  assert.equal(cleanMarkup({ id: "x", kind: "line", coords: [[1, 1]] }, id, ICONS), null);
  assert.equal(cleanMarkup("nope", id, ICONS), null);
});

test("cleans colours, ids, text length, icon names and statuses", () => {
  const o = cleanMarkup({ id: "../../etc", kind: "icon", at: [-157.8, 21.3], icon: "__proto__", color: "red;background:url(x)", title: "t".repeat(500), status: "official", contact: { name: "A", phone: 5 } }, id, ICONS);
  assert.match(o.id, /^new\d+$/);
  assert.equal(o.icon, "note"); assert.equal(o.color, "#ffffff"); assert.equal(o.title.length, 200);
  assert.equal(o.status, "plan"); assert.equal(o.contact.phone, "");
});
