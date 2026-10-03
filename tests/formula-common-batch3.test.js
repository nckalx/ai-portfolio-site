const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { currentLegacyFixtures } = require("./helpers/formula-expectations");
const { deepFreeze } = require("./helpers/formula-discovery-fixtures");
const commonGuidance = require("./fixtures/formula-common-guidance.json");
const batch1 = require("./fixtures/formula-common-batch1-cases.json");
const batch2 = require("./fixtures/formula-common-batch2-cases.json");
const batch4 = require("./fixtures/formula-common-batch4-cases.json");
const fixtures = require("./fixtures/formula-common-batch3-cases.json");
const plain = value => JSON.parse(JSON.stringify(value));
const core = loadFormulaCore();
const ids = fixtures.formulas.map(config => config.id);
const expectedResult = entry => ({
  formulaType: entry.formulaType,
  explanation: fixtures.formulas.find(config => config.id === entry.formulaType).explanation,
  ...entry.expected, missingFields: [], ...commonGuidance[entry.formulaType]
});

test("Batch 3 appends exactly three approved formulas and preserves all surface partitions", () => {
  assert.deepEqual(ids, ["todayDate", "dateFromParts", "isBlank"]);
  const advancedIds = currentLegacyFixtures.catalog.map(config => config.id);
  const commonIds = [...batch1.formulas, ...batch2.formulas, ...fixtures.formulas, ...batch4.formulas].map(config => config.id);
  assert.deepEqual(Object.keys(core.catalog), [...advancedIds, ...commonIds]);
  const entries = Object.values(core.catalog);
  assert.equal(entries.length, 54);
  assert.deepEqual(entries.filter(config => config.libraryId === "advanced").map(config => config.id), advancedIds);
  assert.deepEqual(entries.filter(config => config.libraryId === "common").map(config => config.id), commonIds);
  assert.equal(commonIds.length, 28);
  assert.equal(entries.filter(config => config.availability.extension).length, 52);
  assert.equal(entries.filter(config => config.libraryId === "advanced" && config.availability.extension).length, 24);
  assert.deepEqual(entries.filter(config => config.libraryId === "common" && config.availability.extension).map(config => config.id), commonIds);
  assert.deepEqual(entries.filter(config => config.availability.portfolio).map(config => config.id), advancedIds);
  assert.equal(entries.filter(config => config.libraryId === "common" && config.availability.portfolio).length, 0);
  assert.equal(fixtures.cases.length, 129);
  assert.equal(fixtures.cases.filter(entry => entry.expected.formula !== null).length, 22);
  assert.equal(new Set(fixtures.cases.map(entry => `${entry.formulaType}: ${entry.name}`)).size, fixtures.cases.length);
  assert.deepEqual([...new Set(fixtures.cases.map(entry => entry.formulaType))], ids);
});

for (const expected of fixtures.formulas) {
  test(`Batch 3 exact metadata, schema and absent defaults: ${expected.id}`, () => {
    assert.deepEqual(plain(core.catalog[expected.id]), {
      ...expected, libraryId: "common", availability: { extension: true, portfolio: false },
      categoryId: "dates-status", inputContract: "structured-v1", builderOptions: { functionName: expected.label }, guidance: commonGuidance[expected.id]
    });
    const defaults = core.validation.structured.createDefaultValues(core.catalog[expected.id]);
    assert.deepEqual(plain(defaults), {});
    defaults.extra = "changed";
    assert.deepEqual(plain(core.validation.structured.createDefaultValues(core.catalog[expected.id])), {});
    assert.equal(new Set(expected.keywords.map(word => word.toLowerCase())).size, expected.keywords.length);
  });
}

for (const entry of fixtures.cases) {
  test(`Batch 3 exact fixture: ${entry.formulaType}: ${entry.name}`, () => {
    const raw = deepFreeze(plain(entry.rawValues)), before = JSON.stringify(raw);
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
    assert.equal(JSON.stringify(raw), before);
  });
}

const undefinedCases = [
  ["todayDate", undefined, "", "invalid", "Choose a valid value; null and undefined are not omission."],
  ["todayDate", { offsetDays: undefined }, "offsetDays", "invalid", "Choose a valid value; null and undefined are not omission."],
  ["todayDate", { extra: undefined }, "extra", "unexpected", "Remove this unexpected property."],
  ...["year", "month", "day"].map(field => ["dateFromParts", { year: "2026", month: "9", day: "29", [field]: undefined }, field, "invalid", "Choose a valid value; null and undefined are not omission."]),
  ["isBlank", { value: undefined }, "value", "invalid", "Choose a valid value; null and undefined are not omission."],
  ["isBlank", { value: { type: undefined, column: "Task Name" } }, "value.type", "operandType", "Choose a permitted operand type."],
  ["isBlank", { value: { type: "cellRef", column: undefined } }, "value.column", "invalid", "Choose a valid value; null and undefined are not omission."]
];
for (const [formulaType, rawValues, path, code, message] of undefinedCases) {
  test(`Batch 3 present undefined: ${formulaType}.${path}`, () => {
    const entry = { formulaType, expected: { values: null, formula: null, references: [], validationErrors: [{ path, code, message }] } };
    assert.deepEqual(plain(core.generateFormula(formulaType, deepFreeze(rawValues))), expectedResult(entry));
  });
}

test("TODAY omission differs from explicit zero and never receives a default offset", () => {
  const omitted = core.generateFormula("todayDate", {}), zero = core.generateFormula("todayDate", { offsetDays: "0" });
  assert.deepEqual(plain(omitted.values), {});
  assert.deepEqual(plain(zero.values), { offsetDays: "0" });
  assert.equal(omitted.formula, "=TODAY()");
  assert.equal(zero.formula, "=TODAY(0)");
});

test("Batch 3 results never share semantic values, errors, references or guidance across calls", () => {
  for (const entry of fixtures.cases) {
    const raw = deepFreeze(plain(entry.rawValues)), first = core.generateFormula(entry.formulaType, raw);
    if (first.values) {
      first.values.extra = "changed";
      if (first.values.value) first.values.value.column = "changed";
    }
    if (first.validationErrors.length) first.validationErrors[0].message = "changed";
    first.validationErrors.push({ path: "", code: "changed", message: "changed" });
    first.references.push({ name: "changed" });
    first.setupNotes[0] = "changed"; first.instructions.push("changed");
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
  }
});

test("Batch 3 generation is independent of discovery metadata", () => {
  const isolated = loadFormulaCore();
  for (const id of ids) {
    isolated.catalog[id].availability = { extension: false, portfolio: false };
    isolated.catalog[id].libraryId = "advanced";
  }
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
  for (const id of ids) { delete isolated.catalog[id].availability; delete isolated.catalog[id].libraryId; }
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
});

test("Batch 3 remains deterministic without browser, clock, timers or network", () => {
  const context = vm.createContext({ Date: undefined }), isolated = loadFormulaCore(context);
  for (const name of ["window", "document", "navigator", "chrome", "fetch", "Date", "setTimeout"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  const before = JSON.stringify(isolated.catalog);
  deepFreeze(isolated.catalog);
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
  assert.equal(JSON.stringify(isolated.catalog), before);
});
