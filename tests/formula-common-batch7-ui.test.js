const assert = require("node:assert/strict");
const test = require("node:test");
const { setupExtension, setupStructuredFields } = require("./helpers/formula-extension-dom");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { descendants, structuredControl, editStructured } = require("./helpers/formula-structured-ui-fixtures");
const fixtures = require("./fixtures/formula-common-batch7-cases.json");
const key = "formulaBuilderWorkspace", tick = () => new Promise(resolve => setImmediate(resolve));
const clone = v => JSON.parse(JSON.stringify(v));
const library = (p, id) => { p.get(`library-${id}`).checked = true; p.get(`library-${id}`).dispatch("change"); };
const choose = (p, id) => { library(p, "common"); p.choose(id); };
const include = (p, name, checked = true) => { const control = structuredControl(p, "Include " + name); control.checked = checked; control.dispatch("change"); return control; };
const column = (p, label, value, index = 0) => { editStructured(p, label + " type", "cellRef"); editStructured(p, "Current-row column", value, index); };
const visibleErrors = p => descendants(p.get("fields")).filter(n => n.className === "field-error" && !n.hidden).map(n => n.textContent).join("\n");
const noPaths = p => assert.doesNotMatch(visibleErrors(p), /completion\.|dueDate|startDate|endDate|offsetDays|holidays\.|\.value|\.type|\[\d+\]/);
const labels = p => descendants(p.get("fields")).filter(n => n.tagName === "label").map(n => n.textContent);

test("Batch 7 all six panels generate exact candidates with Advanced startup and portfolio partition preserved", () => {
  const p = setupExtension();
  assert.equal(p.get("library-advanced").checked, true); assert.equal(p.choices().length, 24);
  library(p, "common"); p.get("category").value = "dates-status"; p.get("category").dispatch("change");
  assert.equal(p.choices().length, 9);
  for (const id of fixtures.formulas.map(c => c.id)) { p.choose(id); assert.equal(p.get("copy").disabled, true); assert.equal(p.get("validation").textContent, ""); p.get("back").dispatch("click"); }
  p.choose("daysUntilOrSinceDate"); column(p, "Date", "Due Date");
  assert.equal(p.get("copy").disabled, true); editStructured(p, "Direction", "until");
  assert.equal(p.get("formula-output").value, '=IF([Due Date]@row = "", "", [Due Date]@row - TODAY())');
  editStructured(p, "Direction", "since"); assert.equal(p.get("formula-output").value, '=IF([Due Date]@row = "", "", TODAY() - [Due Date]@row)');
  p.get("back").dispatch("click");
  for (const [id, expected] of [["daysBetweenDates", '=IF([Start]@row = "", "", DATE(2026, 10, 23) - [Start]@row)'], ["netDays", '=IF([Start]@row = "", "", NETDAYS([Start]@row, DATE(2026, 10, 23)))'], ["networkDays", '=IF([Start]@row = "", "", NETWORKDAYS([Start]@row, DATE(2026, 10, 23)))']]) {
    p.choose(id); column(p, "Start date", "Start"); editStructured(p, "End date type", "date"); editStructured(p, "Date", "2026-10-23");
    assert.equal(p.get("formula-output").value, expected); assert.equal(p.get("copy").disabled, false); p.get("back").dispatch("click");
  }
  p.choose("workdayDate"); editStructured(p, "Start date type", "date"); editStructured(p, "Date", "2026-10-23"); editStructured(p, "Working days offset", "-0003");
  assert.equal(p.get("formula-output").value, '=WORKDAY(DATE(2026, 10, 23), -3)');
  assert.equal(structuredControl(p, "Working days offset").value, "-0003");
  editStructured(p, "Working days offset", "3.0"); assert.equal(p.get("copy").disabled, true); assert.match(visibleErrors(p), /Enter a whole number\./); noPaths(p);
  p.get("back").dispatch("click"); p.choose("flagOverdueRows"); column(p, "Due date", "Due Date");
  assert.equal(p.get("formula-output").value, '=IF([Due Date]@row = "", 0, IF([Due Date]@row < TODAY(), 1, 0))');
});

test("completion Include, active controls, mode resets, friendly errors, safe text and invalid Copy", async () => {
  const p = setupExtension(); choose(p, "flagOverdueRows"); column(p, "Due date", " Due [QA] \\ ");
  const dueColumn = structuredControl(p, "Current-row column");
  include(p, "Completion check"); assert.equal(p.get("copy").disabled, true);
  assert.deepEqual(structuredControl(p, "Completion check type").children.map(n => [n.value, n.textContent]), [["", "Choose…"], ["checkbox", "Checkbox"], ["status", "Status text"]]);
  assert.ok(!labels(p).includes("Completion text")); structuredControl(p, "Completion check type").dispatch("blur");
  assert.match(visibleErrors(p), /Choose a completion check type\./); noPaths(p);
  editStructured(p, "Completion check type", "status");
  assert.ok(!labels(p).includes("Include Completion text"));
  const completionText = editStructured(p, "Completion text", "  "); column(p, "Status column", "Status", 1);
  assert.match(visibleErrors(p), /Enter the completion text\./); assert.equal(p.get("copy").disabled, true); noPaths(p);
  editStructured(p, "Completion text", ' Done "QA" \\ [x] <img src=x> ');
  assert.equal(p.get("copy").disabled, false);
  assert.equal(p.get("formula-output").value, '=IF([Due \\[QA\\] \\\\]@row = "", 0, IF([Due \\[QA\\] \\\\]@row < TODAY(), IF([Status]@row = " Done \\"QA\\" \\\\ [x] <img src=x> ", 0, 1), 0))');
  assert.ok(!descendants(p.get("fields")).some(n => n.tagName === "img"));
  const oldColumn = structuredControl(p, "Current-row column", 1);
  editStructured(p, "Completion check type", "checkbox");
  assert.equal(structuredControl(p, "Current-row column"), dueColumn);
  assert.ok(!labels(p).includes("Completion text")); assert.ok(labels(p).includes("Completion checkbox type"));
  assert.equal(p.get("copy").disabled, true); assert.equal(p.get("validation").textContent, "");
  // Detached editors must not mutate the new mode.
  completionText.value = "stale"; completionText.dispatch("input"); oldColumn.value = "stale"; oldColumn.dispatch("input");
  await tick(); assert.deepEqual(p.store[key].drafts.flagOverdueRows.values.completion, { mode: "checkbox", cell: {} });
  column(p, "Completion checkbox", "Completed", 1); assert.equal(p.get("copy").disabled, false);
  editStructured(p, "Completion check type", "status"); await tick();
  assert.deepEqual(p.store[key].drafts.flagOverdueRows.values.completion, { mode: "status", cell: {}, value: "" });
  editStructured(p, "Completion check type", ""); await tick(); assert.deepEqual(p.store[key].drafts.flagOverdueRows.values.completion, {});
  include(p, "Completion check", false); assert.equal(p.get("copy").disabled, false); await tick();
  assert.equal(Object.hasOwn(p.store[key].drafts.flagOverdueRows.values, "completion"), false);
  include(p, "Completion check"); await tick(); assert.deepEqual(p.store[key].drafts.flagOverdueRows.values.completion, {});
});

for (const id of ["workdayDate", "networkDays"]) test(`Batch 7 optional holiday scope/type cleanup, width errors and references: ${id}`, async () => {
  const p = setupExtension(); choose(p, id); column(p, "Start date", "Start Date");
  if (id === "workdayDate") editStructured(p, "Working days offset", "0");
  else { editStructured(p, "End date type", "date"); editStructured(p, "Date", "2026-10-23"); }
  const omitted = p.get("formula-output").value; assert.equal(p.get("copy").disabled, false);
  include(p, "Holiday dates"); assert.equal(p.get("copy").disabled, true);
  editStructured(p, "Holiday dates type", "rangeRef"); editStructured(p, "Holiday dates scope", "currentSheet");
  const oldStart = editStructured(p, "Start column", "A"); editStructured(p, "End column", "B");
  assert.match(visibleErrors(p), /Choose one holiday date column\./); noPaths(p);
  editStructured(p, "End column", "A"); assert.equal(p.get("copy").disabled, false);
  editStructured(p, "Holiday dates scope", "crossSheet");
  assert.equal(p.get("validation").textContent, ""); assert.equal(p.get("copy").disabled, true);
  editStructured(p, "Reference name", "{{ Holiday Dates }}");
  assert.match(p.get("formula-output").value, /, \{Holiday Dates\}\)/);
  assert.match(p.get("references").textContent, /Holiday Dates/);
  oldStart.value = "stale"; oldStart.dispatch("input"); await tick();
  assert.deepEqual(p.store[key].drafts[id].values.holidays, { type: "rangeRef", scope: "crossSheet", name: "{{ Holiday Dates }}" });
  editStructured(p, "Holiday dates type", "columnRef"); await tick(); assert.deepEqual(p.store[key].drafts[id].values.holidays, { type: "columnRef", column: "" });
  editStructured(p, "Whole column", "Holidays"); assert.equal(p.get("copy").disabled, false);
  include(p, "Holiday dates", false); assert.equal(p.get("formula-output").value, omitted); await tick();
  assert.equal(Object.hasOwn(p.store[key].drafts[id].values, "holidays"), false);
});

async function saved(id, values) {
  const p = setupExtension(); choose(p, id); await tick(); const store = clone(p.store);
  store[key].drafts[id].values = clone(values); return store;
}
const roundTrips = fixtures.formulas.flatMap(config => {
  const entries = fixtures.cases.filter(e => e.formulaType === config.id);
  return [entries.find(e => e.expected.formula !== null), entries.find(e => e.name === "empty input")];
});
const dueDate = { type: "cellRef", column: " Due Date " };
for (const [name, raw] of [
  ["checkbox", { dueDate, completion: { mode: "checkbox", cell: { type: "cellRef", column: " Completed " } } }],
  ["status", { dueDate, completion: { mode: "status", cell: { type: "cellRef", column: " Status " }, value: " Complete " } }],
  ["partial status", { dueDate, completion: { mode: "status", cell: {}, value: " " } }],
  ["included empty", { dueDate, completion: {} }],
  ["stale checkbox text", { dueDate, completion: { mode: "checkbox", cell: { type: "cellRef", column: "Completed" }, value: "old" } }]
]) roundTrips.push({ formulaType: "flagOverdueRows", name, rawValues: raw });
roundTrips.push(
  { formulaType: "workdayDate", name: "partial raw offset and named holiday", rawValues: { startDate: { type: "date", value: "2026-" }, offsetDays: "-0003", holidays: { type: "rangeRef", scope: "crossSheet", name: "{{ Holiday Dates }}" } } },
  { formulaType: "networkDays", name: "present empty holiday", rawValues: { startDate: { type: "cellRef", column: "Start" }, endDate: { type: "date", value: "2026-10-23" }, holidays: {} } },
  { formulaType: "workdayDate", name: "JS numeric invalid draft retained", rawValues: { startDate: { type: "date", value: "2026-10-23" }, offsetDays: 3 } }
);
for (const entry of roundTrips) test(`Batch 7 raw workspace round trip: ${entry.formulaType}: ${entry.name}`, async () => {
  const store = await saved(entry.formulaType, entry.rawValues), p = setupExtension({}, {}, () => {}, () => {}, { store }); await tick();
  const result = entry.expected || p.core.generateFormula(entry.formulaType, entry.rawValues);
  assert.equal(p.get("formula-output").value, result.formula || ""); assert.equal(p.get("copy").disabled, result.formula === null);
  assert.equal(p.get("validation").textContent, ""); assert.ok(descendants(p.get("fields")).every(n => n.getAttribute("aria-invalid") !== "true"));
  p.get("back").dispatch("click"); await tick(); assert.deepEqual(p.store[key].drafts[entry.formulaType].values, entry.rawValues);
  assert.doesNotMatch(JSON.stringify(p.store[key]), /"uiState"|"touched"|"references"|"validationErrors"/);
  if (entry.name === "stale checkbox text") {
    p.choose(entry.formulaType); structuredControl(p, "Completion checkbox type").dispatch("blur");
    assert.match(visibleErrors(p), /Remove the completion text/); noPaths(p);
    include(p, "Completion check", false); assert.equal(p.get("copy").disabled, false);
  }
});

test("completion renderer prunes touched descendants, preserves due interaction, accessibility and mode focus", () => {
  const core = loadFormulaCore(), config = core.catalog.flagOverdueRows, ui = setupStructuredFields();
  let snapshot = { values: { dueDate: { type: "cellRef", column: "Due Date" } } }; snapshot.uiState = ui.renderer.createUiState({ config, values: snapshot.values });
  const controller = ui.renderer.mount({ container: ui.container, config, ...snapshot, onChange(next) { snapshot = next; } });
  const at = address => { assert.equal(controller.focus(address), true, address); return ui.document.activeElement; };
  const set = (address, value) => { const node = at(address); node.value = value; node.dispatch(node.tagName === "select" ? "change" : "input"); return node; };
  at("dueDate.column").dispatch("blur"); const toggle = at("completion:include"); toggle.checked = true; toggle.dispatch("change");
  set("completion.mode", "status"); set("completion.cell.type", "cellRef"); set("completion.cell.column", "Status"); set("completion.value", " ");
  controller.update({ validationErrors: clone(core.generateFormula("flagOverdueRows", snapshot.values).validationErrors) });
  const value = at("completion.value"); assert.equal(value.getAttribute("aria-invalid"), "true");
  assert.equal(value.getAttribute("aria-required"), "true"); assert.ok(value.getAttribute("aria-describedby"));
  set("completion.mode", "checkbox");
  assert.deepEqual(clone(snapshot.uiState.touched), { "dueDate.column": true, "completion.mode": true });
  assert.deepEqual(clone(snapshot.values), { dueDate: { type: "cellRef", column: "Due Date" }, completion: { mode: "checkbox", cell: {} } });
  assert.equal(ui.document.activeElement.value, "checkbox"); assert.equal(ui.document.activeElement.getAttribute("aria-required"), "true"); assert.equal(controller.focus("completion.value"), false);
  controller.destroy(); value.value = "stale"; value.dispatch("input"); assert.equal(ui.container.children.length, 0);
});

test("Batch 7 drafts stay independent of prior work; Clear work preserves unrelated storage and theme", async () => {
  const p = setupExtension({}, { saved: "dark" }, () => {}, () => {}, { store: { sentinel: "keep" } });
  p.choose("appendFinishDateLabel"); p.get("field-milestoneLabelColumn").value = "Prior Advanced"; p.get("field-milestoneLabelColumn").dispatch("input"); p.get("back").dispatch("click");
  library(p, "common"); p.choose("todayDate"); p.get("back").dispatch("click");
  for (const config of fixtures.formulas) { p.choose(config.id); p.get("back").dispatch("click"); }
  p.choose("flagOverdueRows"); column(p, "Due date", "Only this draft"); p.get("back").dispatch("click"); p.choose("daysUntilOrSinceDate");
  assert.equal(structuredControl(p, "Date type").value, ""); await tick();
  assert.equal(Object.keys(p.store[key].drafts).length, 8);
  assert.equal(p.store[key].drafts.appendFinishDateLabel.values.milestoneLabelColumn, "Prior Advanced");
  p.get("clear-work").dispatch("click"); await tick(); assert.deepEqual(p.store, { sentinel: "keep", theme: "dark" });
  assert.deepEqual(p.storageRemovals, [key]); assert.equal(p.get("library-advanced").checked, true);
});
