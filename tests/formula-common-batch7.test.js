const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { deepFreeze } = require("./helpers/formula-discovery-fixtures");
const fixtures = require("./fixtures/formula-common-batch7-cases.json");
const guidance = require("./fixtures/formula-common-guidance.json");
const plain = v => JSON.parse(JSON.stringify(v));
const core = loadFormulaCore();
const ids = ["daysUntilOrSinceDate", "daysBetweenDates", "workdayDate", "flagOverdueRows", "networkDays", "netDays"];
const expected = entry => ({ formulaType: entry.formulaType, explanation: fixtures.formulas.find(c => c.id === entry.formulaType).explanation, ...entry.expected, missingFields: [], ...guidance[entry.formulaType] });

test("Batch 7 exact six-ID metadata, fields, options, visibility and absent defaults", () => {
  assert.deepEqual(fixtures.formulas.map(c => c.id), ids);
  assert.deepEqual(Object.keys(core.catalog).slice(-6), ids);
  assert.deepEqual(ids.map(id => core.catalog[id].label), ["Days Until or Since a Date", "Days Between Two Dates", "WORKDAY", "Flag Overdue Rows", "NETWORKDAYS", "NETDAYS"]);
  assert.deepEqual(ids.map(id => core.catalog[id].builderKey), ["dateDelta", "dateDelta", "workdayCalculation", "overdueFlag", "workdayCalculation", "dateDelta"]);
  assert.deepEqual(plain(ids.map(id => core.catalog[id].builderOptions)), [{ operation: "relativeToToday" }, { operation: "subtract" }, { functionName: "WORKDAY" }, {}, { functionName: "NETWORKDAYS" }, { operation: "netDays" }]);
  assert.deepEqual(plain(ids.map(id => core.catalog[id].fields.map(f => f.id))), [["date", "direction"], ["startDate", "endDate"], ["startDate", "offsetDays", "holidays"], ["dueDate", "completion"], ["startDate", "endDate", "holidays"], ["startDate", "endDate"]]);
  for (const config of fixtures.formulas) {
    assert.equal(config.categoryId, "dates-status");
    assert.deepEqual(plain(core.catalog[config.id]), { ...config, libraryId: "common", availability: { extension: true, portfolio: false }, inputContract: "structured-v1", guidance: guidance[config.id] });
    assert.deepEqual(plain(core.validation.structured.createDefaultValues(core.catalog[config.id])), {});
  }
  const entries = Object.values(core.catalog);
  assert.equal(entries.length, 74);
  assert.equal(entries.filter(c => c.libraryId === "common").length, 48);
  assert.equal(entries.filter(c => c.availability.extension).length, 72);
  assert.equal(entries.filter(c => c.availability.portfolio).length, 26);
  assert.equal(entries.filter(c => c.libraryId === "common" && c.categoryId === "dates-status").length, 9);
  assert.equal(Object.keys(core.commonBuilders.registry).length, 21);
  assert.equal(new Set(fixtures.cases.map(e => e.formulaType + ":" + e.name)).size, fixtures.cases.length);
});
for (const entry of fixtures.cases) test(`Batch 7 static semantic fixture: ${entry.formulaType}: ${entry.name}`, () => {
  const raw = deepFreeze(plain(entry.rawValues)), before = JSON.stringify(raw);
  assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected(entry));
  assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected(entry));
  assert.equal(JSON.stringify(raw), before);
});

const dataError = path => ({ path, code: "invalid", message: "Use plain serializable data properties." });
for (const id of ids) for (const [name, make, error] of [
  ["undefined", () => undefined, { path: "", code: "invalid", message: "Choose a valid value; null and undefined are not omission." }],
  ["getter", () => ({ get dueDate() { assert.fail("getter executed"); } }), dataError("")],
  ["inherited", () => Object.create({ startDate: {} }), dataError("")],
  ["nonplain", () => new Date(0), dataError("")],
  ["symbol", () => ({ [Symbol("key")]: true }), dataError("")],
  ["hidden", () => Object.defineProperty({}, "startDate", { value: {} }), dataError("")]
]) test(`Batch 7 unsafe root ${id}: ${name}`, () => {
  const result = core.generateFormula(id, make());
  assert.deepEqual(plain(result.validationErrors), [error]);
  assert.equal(result.formula, null); assert.equal(result.values, null); assert.deepEqual(plain(result.references), []);
});
const sample = id => plain(fixtures.cases.find(e => e.formulaType === id && e.expected.formula !== null).rawValues);
for (const id of ids) test(`Batch 7 nested data faults skip getters and relationship validation: ${id}`, () => {
  const field = id === "daysUntilOrSinceDate" ? "date" : id === "flagOverdueRows" ? "dueDate" : "startDate";
  for (const operand of [{ get type() { assert.fail("getter executed"); } }, Object.create({ type: "cellRef" }), Object.defineProperty({}, "type", { value: "cellRef" }), { [Symbol("type")]: true }]) {
    assert.deepEqual(plain(core.generateFormula(id, { ...sample(id), [field]: operand }).validationErrors), [dataError(field)]);
  }
  const cycle = {}; cycle.type = "cellRef"; cycle.column = cycle;
  assert.equal(core.generateFormula(id, { ...sample(id), [field]: cycle }).formula, null);
});
for (const id of ["workdayDate", "networkDays", "flagOverdueRows"]) test(`Batch 7 present undefined optional is not omission: ${id}`, () => {
  const optional = id === "flagOverdueRows" ? "completion" : "holidays";
  assert.equal(Object.hasOwn(core.generateFormula(id, sample(id)).values, optional), false);
  assert.deepEqual(plain(core.generateFormula(id, { ...sample(id), [optional]: undefined }).validationErrors), [{ path: optional, code: "invalid", message: "Choose a valid value; null and undefined are not omission." }]);
  assert.deepEqual(plain(core.generateFormula(id, { ...sample(id), [optional]: { get mode() { assert.fail("getter executed"); } } }).validationErrors), [dataError(optional)]);
});
test("dateDelta allows only exact own operation data options", () => {
  const builder = core.commonBuilders.registry.dateDelta;
  for (const operation of ["relativeToToday", "subtract", "netDays"]) assert.equal(builder.validateOptions({ operation }), undefined);
  for (const options of [undefined, null, [], {}, { operation: "SUBTRACT" }, { operation: "subtract " }, { operation: "NETDAYS" }, { operation: "expression" }, { operation: "subtract", extra: true }, Object.create({ operation: "subtract" }), { get operation() { assert.fail("getter executed"); } }, Object.defineProperty({}, "operation", { value: "subtract" }), { [Symbol("operation")]: "subtract" }]) assert.throws(() => builder.validateOptions(options), /Structured configuration/);
});
test("F0 F1 F2 fixed branch structure encodes the approved date-only truth table without evaluating native data", () => {
  // Blank due -> 0. Non-overdue (today/future) -> 0. Past due -> 1,
  // except a positive configured completion comparison -> 0. Blank completion
  // is intended incomplete; actual blank/equality semantics remain native NOT RUN.
  const dueDate = { type: "cellRef", column: "Due Date" };
  const cases = [
    [{ dueDate }, '=IF([Due Date]@row = "", 0, IF([Due Date]@row < TODAY(), 1, 0))'],
    [{ dueDate, completion: { mode: "checkbox", cell: { type: "cellRef", column: "Completed" } } }, '=IF([Due Date]@row = "", 0, IF([Due Date]@row < TODAY(), IF([Completed]@row = 1, 0, 1), 0))'],
    [{ dueDate, completion: { mode: "status", cell: { type: "cellRef", column: "Status" }, value: "Complete" } }, '=IF([Due Date]@row = "", 0, IF([Due Date]@row < TODAY(), IF([Status]@row = "Complete", 0, 1), 0))']
  ];
  for (const [raw, formula] of cases) assert.equal(core.generateFormula("flagOverdueRows", raw).formula, formula);
});
test("Batch 7 frozen generation is deterministic without browser, network, clock or timers; result data is fresh", () => {
  const context = vm.createContext({ Date: undefined }), isolated = loadFormulaCore(context);
  for (const name of ["document", "window", "chrome", "fetch", "Date", "setTimeout"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  deepFreeze(isolated.catalog);
  for (const entry of fixtures.cases) {
    const raw = deepFreeze(plain(entry.rawValues)), result = isolated.generateFormula(entry.formulaType, raw);
    assert.deepEqual(plain(result), expected(entry));
    result.references.push({ name: "changed" }); result.validationErrors.push({ path: "", code: "changed", message: "changed" }); result.setupNotes.push("changed");
    if (result.values) result.values.changed = true;
    assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, raw)), expected(entry));
  }
});
