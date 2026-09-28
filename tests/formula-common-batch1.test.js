const commonGuidance = require("./fixtures/formula-common-guidance.json");
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { currentLegacyFixtures } = require("./helpers/formula-expectations");
const fixtures = require("./fixtures/formula-common-batch1-cases.json");
const { deepFreeze } = require("./helpers/formula-discovery-fixtures");
const plain = value => JSON.parse(JSON.stringify(value));
const core = loadFormulaCore();
const commonIds = fixtures.formulas.map(config => config.id);

test("Batch 1 has exactly eight approved entries after the unchanged Advanced catalog", () => {
  assert.deepEqual(commonIds, ["roundValue", "absoluteValue", "textToNumber", "ceilingValue", "floorValue", "roundUpValue", "roundDownValue", "integerPortion"]);
  assert.deepEqual(Object.keys(core.catalog).slice(0, 34), [...currentLegacyFixtures.catalog.map(config => config.id), ...commonIds]);
  assert.deepEqual(Object.keys(core.commonBuilders.registry).slice(0, 3), ["decimalRounding", "multipleRounding", "unaryNumeric"]);
  assert.equal(fixtures.cases.length, 144);
  assert.equal(fixtures.cases.filter(entry => entry.expected.formula !== null).length, 67);
  assert.equal(new Set(fixtures.cases.map(entry => `${entry.formulaType}: ${entry.name}`)).size, fixtures.cases.length);
  assert.deepEqual([...new Set(fixtures.cases.map(entry => entry.formulaType))].sort(), [...commonIds].sort());
});

for (const expected of fixtures.formulas) {
  test(`Batch 1 exact metadata and schema: ${expected.id}`, () => {
    const config = core.catalog[expected.id];
    const fields = [{ id: "value", label: expected.id === "textToNumber" ? "Text" : "Number", type: expected.id === "textToNumber" ? "textOperand" : "numericOperand", required: true }];
    if (expected.builderKey === "decimalRounding") fields.push({ id: "decimalPlaces", label: "Decimal places", type: "integer", required: false });
    if (expected.builderKey === "multipleRounding") fields.push({ id: "multiple", label: "Multiple", type: "numericOperand", required: true });
    assert.deepEqual(plain({ ...config, fields: config.fields.map(({ help, ...field }) => field) }), {
      id: expected.id, label: expected.label, explanation: expected.explanation, keywords: expected.keywords,
      libraryId: "common", availability: { extension: true, portfolio: false }, categoryId: "counts-calculations",
      inputContract: "structured-v1", builderKey: expected.builderKey, builderOptions: { functionName: expected.label }, fields, guidance: commonGuidance[expected.id]
    });
    for (const field of config.fields) assert.ok(typeof field.help === "string" && field.help.trim());
    const first = core.validation.structured.createDefaultValues(config);
    assert.deepEqual(plain(first), {});
    first.value = { type: "number", value: "12" };
    assert.deepEqual(plain(core.validation.structured.createDefaultValues(config)), {});
  });
}

for (const entry of fixtures.cases) {
  test(`Batch 1 exact fixture: ${entry.formulaType}: ${entry.name}`, () => {
    const raw = deepFreeze(plain(entry.rawValues));
    const before = JSON.stringify(raw);
    const expected = {
      formulaType: entry.formulaType,
      explanation: fixtures.formulas.find(config => config.id === entry.formulaType).explanation,
      ...entry.expected, missingFields: [], ...commonGuidance[entry.formulaType]
    };
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected);
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected);
    assert.equal(JSON.stringify(raw), before);
  });
}

test("production Common dispatch ignores discovery permissions and library labels", () => {
  const isolated = loadFormulaCore();
  for (const config of Object.values(isolated.catalog).filter(config => commonIds.includes(config.id))) {
    config.availability = { extension: false, portfolio: false };
    config.libraryId = "advanced";
  }
  for (const entry of fixtures.cases.filter(entry => entry.expected.formula !== null)) {
    assert.equal(isolated.generateFormula(entry.formulaType, entry.rawValues).formula, entry.expected.formula);
  }
  for (const id of commonIds) { delete isolated.catalog[id].availability; delete isolated.catalog[id].libraryId; }
  for (const entry of fixtures.cases.filter(entry => entry.expected.formula !== null)) {
    assert.equal(isolated.generateFormula(entry.formulaType, entry.rawValues).formula, entry.expected.formula);
  }
});

for (const id of ["roundValue", "roundUpValue", "roundDownValue"]) {
  test(`present undefined precision is not omission: ${id}`, () => {
    const result = core.generateFormula(id, { value: { type: "number", value: "12" }, decimalPlaces: undefined });
    assert.deepEqual(plain(result), {
      formulaType: id, explanation: fixtures.formulas.find(config => config.id === id).explanation,
      values: null, formula: null, missingFields: [], references: [], ...commonGuidance[id],
      validationErrors: [{ path: "decimalPlaces", code: "invalid", message: "Choose a valid value; null and undefined are not omission." }]
    });
  });
}

test("production Common remains deterministic without browser, clock, timer or network globals", () => {
  const context = vm.createContext({ Date: undefined });
  const isolated = loadFormulaCore(context);
  for (const name of ["window", "document", "navigator", "chrome", "fetch", "Date", "setTimeout"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  const before = JSON.stringify(isolated.catalog);
  deepFreeze(isolated.catalog);
  for (const entry of fixtures.cases) assert.equal(isolated.generateFormula(entry.formulaType, entry.rawValues).formula, entry.expected.formula);
  assert.equal(JSON.stringify(isolated.catalog), before);
});
