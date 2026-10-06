const assert = require("node:assert/strict");
const test = require("node:test");
const { setupExtension } = require("./helpers/formula-extension-dom");
const { descendants, structuredControl, editStructured, installStructuredFixtures } = require("./helpers/formula-structured-ui-fixtures");
const key = "formulaBuilderWorkspace";
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));
const panel = (options = {}, theme = {}, before = () => {}) => setupExtension({}, theme, () => {}, before, options);
const library = (p, id) => { p.get(`library-${id}`).checked = true; p.get(`library-${id}`).dispatch("change"); };
const search = (p, text) => { p.get("search").value = text; p.get("search").dispatch("input"); };
const button = (p, text) => descendants(p.get("fields")).find(node => node.tagName === "button" && node.textContent === text);
const rawEdit = (p, id, value) => { p.get(`field-${id}`).value = value; p.get(`field-${id}`).dispatch("input"); };
async function savedSum(values = [{ type: "number", value: " 0001.2300 " }, {}]) {
  const p = panel(); library(p, "common"); p.choose("sumValues"); await tick();
  const saved = clone(p.store[key]); saved.drafts.sumValues.values = { values }; return saved;
}
async function restore(saved, options = {}, before) {
  const p = panel({ ...options, get: () => Promise.resolve({ [key]: saved }) }, {}, before); await tick(); return p;
}

const batch5 = require("./fixtures/formula-common-batch5-cases.json");
const batch5Condition = { left: { type: "cellRef", column: "Status" }, operator: "=", right: { type: "textLiteral", value: "Complete" } };
async function savedBatch5(id, values) {
  const p = panel(); library(p, "common");
  p.get("category").value = id === "combineTwoColumns" ? "text-labels" : "logic-conditions"; p.get("category").dispatch("change");
  p.choose(id); await tick();
  const saved = clone(p.store[key]); saved.drafts[id].values = clone(values); return saved;
}
const batch5RoundTrips = batch5.formulas.flatMap(config => {
  const entries = batch5.cases.filter(entry => entry.formulaType === config.id);
  return [entries.find(e => e.name === "representative"), entries.find(e => e.name === "empty input")];
}).map(entry => [entry.formulaType, entry.name, entry.rawValues, entry.expected.formula]);
batch5RoundTrips.push(
  ["ifCondition", "explicit Blank false", { condition: batch5Condition, trueOutput: { type: "boolean", value: false }, falseOutput: { type: "blank" } }, '=IF([Status]@row = "Complete", 0, "")'],
  ["ifCondition", "empty false text", { condition: batch5Condition, trueOutput: { type: "blank" }, falseOutput: { type: "textLiteral", value: "" } }, '=IF([Status]@row = "Complete", "", "")'],
  ["ifCondition", "unfinished included false", { condition: batch5Condition, trueOutput: { type: "blank" }, falseOutput: {} }, null],
  ["returnTextWhenValueMatches", "included empty", { condition: batch5Condition, matchText: " Yes ", noMatchText: "" }, '=IF([Status]@row = "Complete", " Yes ", "")'],
  ["returnTextWhenValueMatches", "included whitespace", { condition: batch5Condition, matchText: "Yes", noMatchText: "  " }, '=IF([Status]@row = "Complete", "Yes", "  ")'],
  ["flagDuplicateValues", "pending setting", { column: { type: "columnRef", column: " Item ID " }, ignoreBlank: "" }, null],
  ["combineTwoColumns", "pending setting", { first: { type: "cellRef", column: "First" }, second: { type: "cellRef", column: "Second" }, separator: "", suppressBlank: "" }, null],
  ["notCondition", "pending operator", { condition: { ...batch5Condition, operator: "" } }, null],
  ["notCondition", "raw invalid number", { condition: { ...batch5Condition, right: { type: "number", value: "  1. " } } }, null],
  ["notCondition", "raw invalid date", { condition: { ...batch5Condition, right: { type: "date", value: "2026-" } } }, null],
  ["checkboxWhenValueMatches", "pending Boolean", { condition: { ...batch5Condition, right: { type: "boolean" } } }, null],
  ["notCondition", "incompatible ordered pair", { condition: { ...batch5Condition, operator: ">" } }, null],
  ["andConditions", "ordered raw rows", { conditions: [batch5Condition, { left: { type: "number", value: "0001.20" }, operator: ">", right: { type: "number", value: "0" } }, batch5Condition] }, '=AND([Status]@row = "Complete", 1.2 > 0, [Status]@row = "Complete")'],
  ["orConditions", "incomplete alternative", { conditions: [batch5Condition, {}] }, null]
);
for (const [id, name, values, formula] of batch5RoundTrips) test(`Batch 5 workspace raw round trip: ${id}: ${name}`, async () => {
  const q = await restore(await savedBatch5(id, values));
  assert.equal(q.get("build-view").hidden, false); assert.equal(q.get("build-title").textContent, batch5.formulas.find(c => c.id === id).label);
  assert.equal(q.get("formula-output").value, formula || ""); assert.equal(q.get("copy").disabled, formula === null);
  assert.equal(q.get("validation").textContent, "");
  assert.ok(descendants(q.get("fields")).every(node => node.getAttribute("aria-invalid") !== "true"));
  q.get("back").dispatch("click"); await tick();
  assert.deepEqual(q.store[key].drafts[id].values, values);
  assert.equal(q.get("category").value, id === "combineTwoColumns" ? "text-labels" : "logic-conditions");
  assert.doesNotMatch(JSON.stringify(q.store[key]), /"touched"|"nextKey"|"rowKey"|"validationErrors"|"references"/);
});

for (const id of ["andConditions", "orConditions"]) test(`Batch 5 restored condition keys replace gaps and errors start untouched: ${id}`, async () => {
  const p = await restore(await savedBatch5(id, { conditions: [batch5Condition, {}, {}] }));
  const third = structuredControl(p, "First value type", 2);
  third.dispatch("blur"); assert.notEqual(p.get("validation").textContent, "");
  descendants(p.get("fields")).filter(node => node.tagName === "button" && node.textContent === "Remove")[1].dispatch("click");
  assert.equal(structuredControl(p, "First value type", 1), third); await tick();
  assert.deepEqual(p.store[key].drafts[id].values.conditions, [batch5Condition, {}]);
  const q = await restore(p.store[key]);
  assert.notEqual(structuredControl(q, "First value type", 1).id, third.id);
  assert.equal(q.get("validation").textContent, ""); assert.equal(q.get("copy").disabled, true);
});

test("Batch 5 Logic category persists in Common and resolves away in Advanced", async () => {
  const p = await restore(await savedBatch5("notCondition", { condition: batch5Condition }));
  p.get("back").dispatch("click"); search(p, "  CONDITION "); await tick();
  const q = await restore(p.store[key]);
  assert.equal(q.get("search").value, "  CONDITION "); assert.equal(q.get("category").value, "logic-conditions");
  library(q, "advanced"); assert.equal(q.get("category").value, "");
  assert.ok(q.get("category").children.every(node => node.value !== "logic-conditions"));
});

test("Clear work removes all eight Batch 5 drafts alongside prior Common and Advanced work", async () => {
  const p = panel({ store: { sentinel: "keep" }, confirm: () => true }, { saved: "dark" });
  p.choose("appendFinishDateLabel"); rawEdit(p, "milestoneLabelColumn", "Saved"); p.get("back").dispatch("click"); library(p, "common");
  for (const id of ["roundValue", "leftText", "todayDate", "sumValues", ...batch5.formulas.map(c => c.id)]) { p.choose(id); p.get("back").dispatch("click"); }
  await tick(); assert.equal(Object.keys(p.store[key].drafts).length, 13);
  p.get("clear-work").dispatch("click"); await tick();
  assert.equal(p.store[key], undefined); assert.equal(p.store.theme, "dark"); assert.equal(p.store.sentinel, "keep");
  assert.equal(p.get("library-advanced").checked, true); assert.equal(p.get("category").value, ""); assert.equal(p.get("search").value, "");
  library(p, "common"); p.choose("ifCondition"); assert.equal(p.get("formula-output").value, ""); assert.equal(p.get("copy").disabled, true);
});

test("empty store hydrates without writing and retains fresh Advanced discovery", async () => {
  const p = panel({ get: async () => ({}) });
  assert.equal(p.get("workspace").inert, true); assert.equal(p.get("clear-work").disabled, true);
  assert.equal(p.get("workspace-status").textContent, "Loading saved work…");
  p.choices()[0].dispatch("click"); assert.equal(p.get("build-view").hidden, true);
  await tick();
  assert.equal(p.get("workspace").inert, false); assert.equal(p.get("workspace").getAttribute("aria-busy"), "false");
  assert.equal(p.get("library-advanced").checked, true); assert.equal(p.get("search").value, "");
  assert.equal(p.get("category").value, ""); assert.equal(p.get("build-view").hidden, true);
  assert.deepEqual(p.storageWrites, []); assert.deepEqual(p.storageReads.sort(), [key, "theme"].sort());
});

test("Common restore keeps raw rows, regenerates keys, starts untouched and generates fresh", async () => {
  const saved = await savedSum();
  const p = await restore(saved);
  assert.equal(p.get("library-common").checked, true); assert.equal(p.get("build-title").textContent, "SUM");
  assert.equal(structuredControl(p, "Number").value, " 0001.2300 ");
  assert.equal(p.get("validation").textContent, ""); assert.equal(p.get("copy").disabled, true);
  assert.equal(p.generationCount(), 1); assert.deepEqual(p.workspaceWrites, []);
  assert.equal(structuredControl(p, "Value 2 type").value, "");
  button(p, "Add Value").dispatch("click");
  editStructured(p, "Value 3 type", "number"); editStructured(p, "Number", "-", 1);
  const removes = descendants(p.get("fields")).filter(node => node.tagName === "button" && node.textContent === "Remove");
  removes[1].dispatch("click"); await tick();
  assert.deepEqual(p.store[key].drafts.sumValues.values.values, [saved.drafts.sumValues.values.values[0], { type: "number", value: "-" }]);
  assert.doesNotMatch(JSON.stringify(p.store[key]), /touched|nextKey|"rows"|"r\d+"|validationErrors|references|formula-output/);
});

test("fresh row sidecars replace prior gaps while same-document keys remain stable", async () => {
  const p = await restore(await savedSum([{}, {}, {}]));
  const third = structuredControl(p, "Value 3 type").id;
  descendants(p.get("fields")).filter(node => node.tagName === "button" && node.textContent === "Remove")[1].dispatch("click");
  assert.equal(structuredControl(p, "Value 2 type").id, third); await tick();
  const reopened = await restore(p.store[key]);
  assert.notEqual(structuredControl(reopened, "Value 2 type").id, third);
});

for (const raw of ["-", "1.", "000.00", "  +001.2300  ", "bad\nnumber"]) {
  test(`raw number draft round trip: ${JSON.stringify(raw)}`, async () => {
    const p = await restore(await savedSum([{ type: "number", value: raw }]));
    assert.equal(structuredControl(p, "Number").value, raw);
    const expected = p.core.generateFormula("sumValues", { values: [{ type: "number", value: raw }] });
    assert.equal(p.get("formula-output").value, expected.formula || "");
    assert.equal(p.get("copy").disabled, expected.formula === null);
    assert.equal(p.get("validation").textContent, "");
  });
}

test("multiple Common and Advanced drafts survive discovery view, filters and reopen", async () => {
  const p = panel(); p.choose("appendFinishDateLabel"); rawEdit(p, "milestoneLabelColumn", "  Raw Advanced  ");
  p.get("back").dispatch("click"); library(p, "common"); p.choose("sumValues");
  button(p, "Add Value").dispatch("click"); editStructured(p, "Value 1 type", "number"); editStructured(p, "Number", "0002.00");
  p.get("back").dispatch("click"); p.choose("averageValues"); p.get("back").dispatch("click");
  p.get("category").value = "counts-calculations"; p.get("category").dispatch("change"); search(p, "  SuM \t"); await tick();
  assert.equal(p.store[key].view, "discovery"); assert.equal(p.store[key].formulaId, null);
  const q = await restore(p.store[key]);
  assert.equal(q.get("build-view").hidden, true); assert.equal(q.get("search").value, "  SuM \t");
  assert.equal(q.get("category").value, "counts-calculations");
  q.get("clear-filters").dispatch("click"); q.choose("sumValues"); assert.equal(structuredControl(q, "Number").value, "0002.00");
  q.get("back").dispatch("click"); library(q, "advanced"); q.choose("appendFinishDateLabel");
  assert.equal(q.get("field-milestoneLabelColumn").value, "  Raw Advanced  "); await tick();
  assert.deepEqual(Object.keys(q.store[key].drafts).sort(), ["appendFinishDateLabel", "averageValues", "sumValues"]);
});

test("Advanced restored raw values use exactly the fresh legacy validation presentation", async () => {
  const p = panel(); p.choose("appendFinishDateLabel"); rawEdit(p, "milestoneLabelColumn", "  "); await tick();
  const q = await restore(p.store[key]);
  assert.equal(q.get("field-milestoneLabelColumn").value, "  ");
  for (const id of ["validation", "field-milestoneLabelColumn-error"]) assert.equal(q.get(id).textContent, p.get(id).textContent);
  assert.equal(q.get("field-milestoneLabelColumn").getAttribute("aria-invalid"), "true");
  assert.equal(q.get("copy").disabled, true); assert.equal(q.generationCount(), 1);
});

for (const values of [{}, { offsetDays: "" }, { offsetDays: "0" }, { offsetDays: 0 }, { offsetDays: "-" }]) {
  test(`optional omission/included raw TODAY survives: ${JSON.stringify(values)}`, async () => {
    const p = panel(); library(p, "common"); p.choose("todayDate"); await tick();
    const saved = clone(p.store[key]); saved.drafts.todayDate.values = values;
    const q = await restore(saved);
    assert.equal(q.get("build-title").textContent, "TODAY");
    q.get("back").dispatch("click"); await tick(); assert.deepEqual(q.store[key].drafts.todayDate.values, values);
  });
}

test("current-sheet and cross-sheet raw drafts preserve row order and wrappers", async () => {
  const values = [{ type: "rangeRef", scope: "currentSheet", startColumn: " [Start] ", endColumn: "End" }, { type: "rangeRef", scope: "crossSheet", name: " {{ Totals }} " }, {}];
  const q = await restore(await savedSum(values));
  assert.equal(structuredControl(q, "Start column").value, " [Start] "); assert.equal(structuredControl(q, "Reference name").value, " {{ Totals }} ");
  editStructured(q, "Value 1 scope", "crossSheet"); editStructured(q, "Reference name", " {{ New }} ");
  editStructured(q, "Value 2 type", "number"); editStructured(q, "Number", "12"); await tick();
  assert.deepEqual(q.store[key].drafts.sumValues.values.values, [{ type: "rangeRef", scope: "crossSheet", name: " {{ New }} " }, { type: "number", value: "12" }, {}]);
  const reopened = await restore(q.store[key]); assert.equal(structuredControl(reopened, "Reference name").value, " {{ New }} ");
});

test("synthetic nested criteria, optional text and raw date drafts survive without normalization", async () => {
  const p = panel({}, {}, installStructuredFixtures); library(p, "common"); p.choose("syntheticStructured");
  editStructured(p, "Value type", "date"); editStructured(p, "Date", "2026-");
  const include = structuredControl(p, "Include Note"); include.checked = true; include.dispatch("change");
  editStructured(p, "Note", "  raw text  "); await tick();
  const q = await restore(p.store[key], {}, installStructuredFixtures);
  assert.equal(structuredControl(q, "Date").value, "2026-"); assert.equal(structuredControl(q, "Note").value, "  raw text  ");
});

for (const [label, mutate] of [
  ["unknown selected ID", s => { s.formulaId = "gone"; }],
  ["stale schema", s => { s.drafts.sumValues.schema[0].minItems = 5; }],
  ["wrong contract", s => { s.drafts.sumValues.contract = "legacy"; }],
  ["wrong values container", s => { s.drafts.sumValues.values = []; }],
  ["unknown value property", s => { s.drafts.sumValues.values.extra = "bad"; }],
  ["stale operand members", s => { s.drafts.sumValues.values.values[0].name = "bad"; }],
  ["unsupported operand", s => { s.drafts.sumValues.values.values[0].type = "textLiteral"; }],
  ["wrong branch container", s => { s.drafts.sumValues.values.values[0] = []; }],
  ["function", s => { s.drafts.sumValues.values.values[0].value = () => 1; }],
  ["symbol", s => { s.drafts.sumValues.values.values[0].value = Symbol("bad"); }],
  ["accessor", s => { Object.defineProperty(s.drafts.sumValues.values.values[0], "value", { enumerable: true, get() { throw new Error("accessor invoked"); } }); }],
  ["cycle", s => { s.drafts.sumValues.values.values.push(s.drafts.sumValues.values); }],
  ["non-plain", s => { s.drafts.sumValues.values = new Date(); }],
  ["sparse array", s => { delete s.drafts.sumValues.values.values[0]; }],
  ["extra array member", s => { s.drafts.sumValues.values.values.extra = 1; }]
]) {
  test(`drops bad selection/draft independently: ${label}`, async () => {
    const saved = await savedSum();
    saved.drafts.averageValues = clone(saved.drafts.sumValues); mutate(saved);
    const q = await restore(saved);
    assert.equal(q.get("build-view").hidden, true); q.choose("averageValues");
    assert.equal(structuredControl(q, "Number").value, " 0001.2300 ");
  });
}

for (const saved of [null, [], {}, { version: 2 }, "bad", { get version() { throw new Error("must not invoke"); } }]) {
  test(`malformed root/version falls back safely: ${typeof saved}/${Array.isArray(saved)}`, async () => {
    const p = await restore(saved);
    assert.equal(p.get("build-view").hidden, true); assert.equal(p.get("library-advanced").checked, true);
    assert.match(p.get("workspace-status").textContent, /Could not load/); assert.equal(p.get("clear-work").disabled, false);
    assert.deepEqual(p.workspaceWrites, []);
  });
}

test("stale library/category resolve normally and presentation metadata does not invalidate schema", async () => {
  const saved = await savedSum(); saved.activeLibrary = "gone"; saved.categoryId = "gone";
  const p = await restore(saved); assert.equal(p.get("library-advanced").checked, true); assert.equal(p.get("category").value, "");
  assert.equal(p.get("build-view").hidden, true); library(p, "common"); p.choose("sumValues");
  assert.equal(structuredControl(p, "Number").value, " 0001.2300 ");
  const q = setupExtension({}, {}, core => { core.catalog.sumValues.fields[0].label = "Reworded"; core.catalog.sumValues.fields[0].help = "New guidance"; }, () => {}, { store: { [key]: { ...saved, activeLibrary: "common" } } });
  assert.equal(q.get("build-view").hidden, false);
});

test("legacy select option incompatibility drops only that draft", async () => {
  const p = panel(); const config = Object.values(p.core.catalog).find(c => c.availability.extension && !c.inputContract && c.fields.some(f => f.type === "select"));
  p.choose(config.id); await tick(); const saved = clone(p.store[key]);
  saved.drafts[config.id].values[config.fields.find(f => f.type === "select").id] = "removed-option";
  const q = await restore(saved); assert.equal(q.get("build-view").hidden, true);
});

test("accessors at root, draft and nested values are never evaluated; valid siblings survive", async () => {
  for (const location of ["root", "draft", "value"]) {
    let calls = 0;
    const saved = await savedSum(); saved.drafts.averageValues = clone(saved.drafts.sumValues);
    const target = location === "root" ? saved : location === "draft" ? saved.drafts : saved.drafts.sumValues.values.values[0];
    const property = location === "root" ? "searchText" : location === "draft" ? "sumValues" : "value";
    Object.defineProperty(target, property, { enumerable: true, get() { calls++; return "unexpected"; } });
    const p = await restore(saved); assert.equal(calls, 0); assert.equal(p.get("build-view").hidden, true);
    if (location !== "root") { p.choose("averageValues"); assert.equal(structuredControl(p, "Number").value, " 0001.2300 "); }
  }
});

test("empty arrays and absent values survive while obsolete range-scope members are rejected", async () => {
  const saved = await savedSum([]); const p = await restore(saved);
  assert.equal(p.get("build-view").hidden, false); assert.equal(p.get("copy").disabled, true);
  p.get("back").dispatch("click"); await tick(); assert.deepEqual(p.store[key].drafts.sumValues.values, { values: [] });
  const stale = await savedSum([{ type: "rangeRef", scope: "crossSheet", name: "Range", startColumn: "old" }]);
  const q = await restore(stale); assert.equal(q.get("build-view").hidden, true);
});

test("read rejection and missing API preserve usable startup", async () => {
  for (const options of [{ get: async () => { throw new Error("private content"); } }, { noStorage: true }]) {
    const p = panel(options); await tick();
    assert.match(p.get("workspace-status").textContent, /Could not load saved work/);
    p.choose("appendFinishDateLabel"); assert.equal(p.get("build-view").hidden, false);
    assert.doesNotMatch(p.get("workspace-status").textContent, /private content/);
  }
});

test("delayed hydration leaves theme usable and prevents workspace edits", async () => {
  let resolve; const saved = await savedSum();
  const p = panel({ get: () => new Promise(done => { resolve = done; }) });
  p.get("theme-toggle").dispatch("click"); await tick(); assert.equal(p.themeWrites.length, 1);
  p.get("library-common").dispatch("change"); p.get("clear-work").dispatch("click");
  assert.equal(p.workspaceWrites.length, 0); assert.equal(p.storageRemovals.length, 0);
  resolve({ [key]: saved }); await tick(); assert.equal(p.get("build-title").textContent, "SUM");
});

test("two-second timeout releases workspace and ignores late read after edits", async () => {
  let timeout, resolve;
  const p = panel({ get: () => new Promise(done => { resolve = done; }), setTimeout(callback, ms) { assert.equal(ms, 2000); timeout = callback; return 1; }, clearTimeout() {} });
  timeout(); assert.equal(p.get("workspace").inert, false);
  p.choose("appendFinishDateLabel"); rawEdit(p, "milestoneLabelColumn", "newer");
  resolve({ [key]: await savedSum() }); await tick();
  assert.equal(p.get("field-milestoneLabelColumn").value, "newer"); assert.equal(p.get("library-advanced").checked, true);
});

test("write failure preserves work and retries on next meaningful event without touched-only saves", async () => {
  let fail = true; const p = panel({ set: async () => { if (fail) throw new Error("private draft"); } });
  library(p, "common"); p.choose("sumValues"); button(p, "Add Value").dispatch("click"); editStructured(p, "Value 1 type", "number"); editStructured(p, "Number", "-"); await tick();
  assert.match(p.get("workspace-status").textContent, /could not be saved/);
  assert.equal(structuredControl(p, "Number").value, "-"); const count = p.workspaceWrites.length;
  structuredControl(p, "Number").dispatch("blur"); await tick(); assert.equal(p.workspaceWrites.length, count);
  fail = false; editStructured(p, "Number", "2"); await tick();
  assert.equal(p.get("workspace-status").textContent, ""); assert.equal(p.store[key].drafts.sumValues.values.values[0].value, "2");
});

test("one in-flight immutable save and only newest pending snapshot wins", async () => {
  const pending = []; let active = 0, maxActive = 0;
  const p = panel({ set: value => new Promise(resolve => { active++; maxActive = Math.max(maxActive, active); pending.push({ value, resolve: () => { active--; resolve(); } }); }) });
  search(p, "first"); search(p, "second"); search(p, "third");
  assert.equal(pending.length, 1); assert.equal(pending[0].value[key].searchText, "first");
  pending[0].resolve(); await tick(); assert.equal(pending.length, 2); assert.equal(pending[1].value[key].searchText, "third");
  pending[1].resolve(); await tick(); assert.equal(p.store[key].searchText, "third"); assert.equal(maxActive, 1);
  search(p, "third"); await tick(); assert.equal(pending.length, 2);
});

test("Copy, focus, scroll, theme, guidance and touched-only blur do not save workspace", async () => {
  const p = setupExtension({ clipboard: { writeText: async () => {} } }); p.choose("appendFinishDateLabel"); await tick();
  const count = p.workspaceWrites.length;
  p.get("copy").dispatch("click"); p.get("search").focus(); p.get("builder-scroll").scrollTop = 40;
  p.get("explanation-details").open = true; p.get("explanation-details").dispatch("toggle"); p.get("theme-toggle").dispatch("click"); await tick();
  assert.equal(p.workspaceWrites.length, count); assert.deepEqual(p.themeWrites, [{ theme: "dark" }]);
  p.get("back").dispatch("click"); library(p, "common"); p.choose("sumValues"); button(p, "Add Value").dispatch("click"); await tick();
  const before = p.workspaceWrites.length; structuredControl(p, "Value 1 type").dispatch("blur"); await tick(); assert.equal(p.workspaceWrites.length, before);
});

test("Clear work is a native named button left of theme in the shared action row", () => {
  const p = panel(); const clear = p.get("clear-work");
  assert.equal(clear.tagName, "button"); assert.equal(clear.type, "button"); assert.equal(clear.textContent, "Clear work");
  assert.equal(clear.getAttribute("title"), "Clear all formula drafts and return to Find a formula. Theme is kept.");
  assert.equal(clear.parent, p.get("theme-toggle").parent);
  assert.deepEqual(clear.parent.children.filter(n => n.tagName === "button").map(n => n.id), ["clear-work", "theme-toggle"]);
});

test("cancel changes nothing; confirmed clear removes every draft and preserves theme and unrelated keys", async () => {
  const confirmations = []; let accepted = false;
  const p = panel({ store: { sentinel: "keep" }, confirm: text => { confirmations.push(text); return accepted; } }, { saved: "dark" });
  p.choose("appendFinishDateLabel"); rawEdit(p, "milestoneLabelColumn", "my draft"); p.get("back").dispatch("click");
  library(p, "common"); p.choose("sumValues"); button(p, "Add Value").dispatch("click"); await tick();
  const before = clone(p.store); const nodes = descendants(p.get("fields"));
  p.get("clear-work").dispatch("click"); await tick(); assert.deepEqual(p.store, before); assert.deepEqual(descendants(p.get("fields")), nodes);
  assert.equal(confirmations[0], "Clear all saved formula work? This removes every formula draft and returns to Find a formula. Your theme preference will be kept.");
  accepted = true; p.get("clear-work").dispatch("click"); await tick();
  assert.deepEqual(p.store, { sentinel: "keep", theme: "dark" }); assert.deepEqual(p.storageRemovals, [key]);
  assert.equal(p.document.documentElement.getAttribute("data-theme"), "dark"); assert.equal(p.get("library-advanced").checked, true);
  assert.equal(p.get("build-view").hidden, true); assert.equal(p.get("search").value, ""); assert.equal(p.get("category").value, "");
  assert.equal(p.get("formula-output").value, ""); assert.equal(p.get("copy").disabled, true); assert.equal(p.get("fields").children.length, 0);
  assert.equal(p.document.activeElement, p.get("search"));
  const q = panel({ store: p.store }); assert.equal(q.get("build-view").hidden, true); assert.equal(q.get("library-advanced").checked, true);
  library(p, "common"); p.choose("sumValues"); assert.equal(button(p, "Add Value").textContent, "Add Value");
  assert.equal(descendants(p.get("fields")).filter(n => n.tagName === "button" && n.textContent === "Remove").length, 0);
});

test("clear waits for old in-flight write and discards its pending successor", async () => {
  let resolve; const p = panel({ set: () => new Promise(done => { resolve = done; }) });
  search(p, "old"); search(p, "pending"); p.get("clear-work").dispatch("click");
  assert.equal(p.storageRemovals.length, 0); assert.equal(p.get("search").value, "");
  resolve(); await tick(); assert.deepEqual(p.storageRemovals, [key]); assert.equal(p.store[key], undefined); assert.equal(p.workspaceWrites.length, 1);
});

test("new editing after clear replaces pending removal with only the new workspace", async () => {
  let resolve; let first = true;
  const p = panel({ set: () => first ? (first = false, new Promise(done => { resolve = done; })) : Promise.resolve() });
  p.choose("appendFinishDateLabel"); p.get("clear-work").dispatch("click"); search(p, "new work"); resolve(); await tick();
  assert.equal(p.store[key].searchText, "new work"); assert.deepEqual(p.store[key].drafts, {});
});

test("failed removal leaves UI cleared with warning and clean retry skips confirmation", async () => {
  let fail = true, confirmations = 0;
  const p = panel({ confirm: () => { confirmations++; return true; }, remove: async () => { if (fail) throw new Error("remove failed"); } });
  search(p, "draft"); await tick(); p.get("clear-work").dispatch("click"); await tick();
  assert.equal(p.get("search").value, ""); assert.match(p.get("workspace-status").textContent, /It may return when you reopen/);
  assert.equal(p.store[key].searchText, "draft"); fail = false;
  p.get("clear-work").dispatch("click"); await tick(); assert.equal(confirmations, 1); assert.equal(p.store[key], undefined); assert.equal(p.get("workspace-status").textContent, "");
});

test("workspace and theme errors stay separate, and clear does not cancel theme writes", async () => {
  let finishTheme;
  const p = panel({ set: async () => { throw new Error("save"); } }, { set: () => new Promise(resolve => { finishTheme = resolve; }) });
  p.get("theme-toggle").dispatch("click"); search(p, "saved?"); await tick();
  assert.match(p.get("workspace-status").textContent, /could not be saved/); assert.equal(p.get("theme-status").textContent, "");
  p.get("clear-work").dispatch("click"); finishTheme(); await tick();
  assert.equal(p.store.theme, "dark"); assert.equal(p.store[key], undefined);
});
