const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { deepFreeze } = require("./helpers/formula-discovery-fixtures");
const { currentLegacyFixtures } = require("./helpers/formula-expectations");
const commonGuidance = require("./fixtures/formula-common-guidance.json");
const previous = [1, 2, 3].flatMap(n => require(`./fixtures/formula-common-batch${n}-cases.json`).formulas);
const batch5 = require("./fixtures/formula-common-batch5-cases.json");
const fixtures = require("./fixtures/formula-common-batch4-cases.json");
const plain = value => JSON.parse(JSON.stringify(value));
const core = loadFormulaCore();
const ids = fixtures.formulas.map(config => config.id);
const expectedResult = entry => ({
  formulaType: entry.formulaType,
  explanation: fixtures.formulas.find(config => config.id === entry.formulaType).explanation,
  ...entry.expected, missingFields: [], ...commonGuidance[entry.formulaType]
});

test("Batch 4 appends exactly seven formulas and preserves all surface partitions", () => {
  assert.deepEqual(ids, ["countValues", "sumValues", "averageValues", "minValue", "maxValue", "countMultiSelectValues", "medianValue"]);
  const advancedIds = currentLegacyFixtures.catalog.map(config => config.id);
  const commonIds = [...previous.map(config => config.id), ...ids, ...batch5.formulas.map(config => config.id)];
  const entries = Object.values(core.catalog);
  assert.deepEqual(Object.keys(core.catalog), [...advancedIds, ...commonIds]);
  assert.equal(entries.length, 62);
  assert.deepEqual(entries.filter(config => config.libraryId === "advanced").map(config => config.id), advancedIds);
  assert.deepEqual(entries.filter(config => config.libraryId === "common").map(config => config.id), commonIds);
  assert.equal(commonIds.length, 36);
  assert.equal(entries.filter(config => config.availability.extension).length, 60);
  assert.equal(entries.filter(config => config.libraryId === "advanced" && config.availability.extension).length, 24);
  assert.deepEqual(entries.filter(config => config.libraryId === "common" && config.availability.extension).map(config => config.id), commonIds);
  assert.deepEqual(entries.filter(config => config.availability.portfolio).map(config => config.id), advancedIds);
  assert.equal(entries.filter(config => config.libraryId === "common" && config.availability.portfolio).length, 0);
  assert.deepEqual(Object.keys(commonGuidance), commonIds);
  assert.equal(fixtures.cases.length, 627);
  assert.equal(fixtures.cases.filter(entry => entry.expected.formula !== null).length, 180);
  assert.equal(new Set(fixtures.cases.map(entry => `${entry.formulaType}: ${entry.name}`)).size, fixtures.cases.length);
  assert.deepEqual([...new Set(fixtures.cases.map(entry => entry.formulaType))], ids);
});

for (const expected of fixtures.formulas) {
  test(`Batch 4 exact metadata, restricted schema and absent defaults: ${expected.id}`, () => {
    const config = core.catalog[expected.id];
    assert.deepEqual(plain(config), {
      ...expected, libraryId: "common", availability: { extension: true, portfolio: false },
      categoryId: "counts-calculations", inputContract: "structured-v1", builderOptions: { functionName: expected.label }, guidance: commonGuidance[expected.id]
    });
    assert.deepEqual(plain(config.fields[0].items.allowedTypes), [
      ...(["COUNT", "COUNTM"].includes(expected.label) ? [] : ["number"]), "cellRef", "columnRef", "rangeRef"
    ]);
    assert.equal(Object.hasOwn(config.fields[0], "maxItems"), false);
    assert.equal(Object.hasOwn(config.fields[0], "defaultValue"), false);
    const defaults = core.validation.structured.createDefaultValues(config);
    assert.deepEqual(plain(defaults), {});
    defaults.values = [{}];
    assert.deepEqual(plain(core.validation.structured.createDefaultValues(config)), {});
  });
}

for (const entry of fixtures.cases) {
  test(`Batch 4 exact fixture: ${entry.formulaType}: ${entry.name}`, () => {
    const raw = deepFreeze(plain(entry.rawValues)), before = JSON.stringify(raw);
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
    assert.equal(JSON.stringify(raw), before);
  });
}

const invalid = path => ({ path, code: "invalid", message: "Choose a valid value; null and undefined are not omission." });
const dataError = path => ({ path, code: "invalid", message: "Use plain serializable data properties." });
const cell = { type: "cellRef", column: "Task" };
const jsCases = [
  ["undefined root", () => undefined, invalid("")],
  ["undefined list", () => ({ values: undefined }), invalid("values")],
  ["undefined row", () => ({ values: [undefined] }), invalid("values[0]")],
  ["undefined member", () => ({ values: [{ ...cell, column: undefined }] }), invalid("values[0].column")],
  ["undefined discriminator", () => ({ values: [{ type: undefined }] }), { path: "values[0].type", code: "operandType", message: "Choose a permitted operand type." }],
  ["sparse array", () => ({ values: Array(1) }), { path: "values[0]", code: "required", message: "Choose values[0]." }],
  ["extra array property", () => ({ values: Object.assign([cell], { extra: true }) }), { path: "values.extra", code: "unexpected", message: "Remove this unexpected array property." }],
  ["root accessor", () => ({ get values() { assert.fail("getter must not run"); } }), dataError("")],
  ["row accessor", () => ({ values: [{ get type() { assert.fail("getter must not run"); } }] }), dataError("values[0]")],
  ["array accessor", () => ({ values: Object.defineProperty([cell], "0", { enumerable: true, get() { assert.fail("getter must not run"); } }) }), dataError("values")],
  ["nonplain row", () => ({ values: [new Date(0)] }), dataError("values[0]")],
  ["inherited operand", () => ({ values: [Object.create(cell)] }), dataError("values[0]")],
  ["cycle to root", () => { const raw = { values: [] }; raw.values.push(raw); return raw; }, { path: "values[0]", code: "invalid", message: "Use plain serializable data without cycles." }],
  ["cycle to list", () => { const values = []; values.push(values); return { values }; }, { path: "values[0]", code: "invalid", message: "Use plain serializable data without cycles." }]
];
for (const id of ids) for (const [name, makeRaw, error] of jsCases) {
  test(`Batch 4 JavaScript-only complete rejection: ${id}: ${name}`, () => {
    const expected = expectedResult({ formulaType: id, expected: { values: null, formula: null, references: [], validationErrors: [error] } });
    assert.deepEqual(plain(core.generateFormula(id, makeRaw())), expected);
  });
}

test("Batch 4 result objects, nested values, errors, references and guidance are independent", () => {
  for (const entry of fixtures.cases) {
    const raw = deepFreeze(plain(entry.rawValues)), first = core.generateFormula(entry.formulaType, raw);
    if (first.values) { first.values.values[0].type = "changed"; first.values.values.push({ type: "blank" }); }
    if (first.validationErrors.length) first.validationErrors[0].message = "changed";
    first.validationErrors.push({ path: "", code: "changed", message: "changed" });
    if (first.references.length) first.references[0].name = "changed";
    first.references.push({ name: "changed" });
    first.setupNotes[0] = "changed"; first.instructions.push("changed");
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
  }
});

test("Batch 4 generation remains deterministic without browser, clock, timers or network", () => {
  const context = vm.createContext({ Date: undefined }), isolated = loadFormulaCore(context);
  for (const name of ["window", "document", "navigator", "chrome", "fetch", "Date", "setTimeout"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  const before = JSON.stringify(isolated.catalog);
  deepFreeze(isolated.catalog);
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
  assert.equal(JSON.stringify(isolated.catalog), before);
});

test("Batch 4 generation is independent of discovery metadata", () => {
  const isolated = loadFormulaCore();
  for (const id of ids) { isolated.catalog[id].availability = { extension: false, portfolio: false }; isolated.catalog[id].libraryId = "advanced"; }
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
});

test("variadicAggregate delegates ordered rendering and returns a fragment without evaluating", () => {
  const builder = core.commonBuilders.registry.variadicAggregate;
  assert.deepEqual(Object.keys(builder), ["validateOptions", "validate", "build"]);
  assert.deepEqual(plain(builder.validate()), []);
  const rows = [{ type: "number", value: "3" }, cell, { type: "columnRef", column: "Cost" }, { type: "rangeRef", scope: "crossSheet", name: "Costs" }];
  for (const functionName of ["COUNT", "SUM", "AVG", "MIN", "MAX", "COUNTM", "MEDIAN"]) {
    const calls = [], result = { expression: "fragment", references: [] };
    const p = {
      renderOperand(value) { calls.push(["operand", value]); return { expression: "operand", references: [] }; },
      renderRange(value) { calls.push(["range", value]); return { expression: "range", references: [] }; },
      renderFunctionCall(name, args) { calls.push([name, args]); return result; }
    };
    assert.equal(builder.build({ values: rows }, { functionName }, p), result);
    assert.deepEqual(calls.slice(0, 4), [["operand", rows[0]], ["operand", rows[1]], ["range", rows[2]], ["range", rows[3]]]);
    assert.equal(calls[4][0], functionName);
    assert.deepEqual(plain(calls[4][1]).map(arg => arg.expression), ["operand", "operand", "range", "range"]);
  }
});

test("variadicAggregate preserves exact configuration errors for malformed and unsupported options", () => {
  const builder = core.commonBuilders.registry.variadicAggregate;
  const malformed = "Structured configuration: expected only functionName in builder options.";
  const unsupported = "Structured configuration: unsupported function for builder family.";
  for (const options of [undefined, null, [], "COUNT", {}, { functionName: undefined }, { functionName: "COUNT", extra: true },
    Object.create({ functionName: "COUNT" }), { get functionName() { assert.fail("getter must not run"); } }]) {
    assert.throws(() => builder.validateOptions(options), { name: "TypeError", message: malformed });
  }
  for (const functionName of ["", "AVERAGE", "COUNTA", "COUNT(1);SUM(2)", 1, null, ...fixtures.formulas.flatMap(config => [config.label.toLowerCase(), ` ${config.label}`, `${config.label} `])]) {
    assert.throws(() => builder.validateOptions({ functionName }), { name: "TypeError", message: unsupported });
  }
});
