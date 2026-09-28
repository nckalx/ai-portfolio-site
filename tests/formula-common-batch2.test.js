const commonGuidance = require("./fixtures/formula-common-guidance.json");
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { currentLegacyFixtures } = require("./helpers/formula-expectations");
const { deepFreeze } = require("./helpers/formula-discovery-fixtures");
const batch1 = require("./fixtures/formula-common-batch1-cases.json");
const fixtures = require("./fixtures/formula-common-batch2-cases.json");
const plain = value => JSON.parse(JSON.stringify(value));
const core = loadFormulaCore();
const ids = fixtures.formulas.map(config => config.id);
const expectedResult = entry => ({
  formulaType: entry.formulaType,
  explanation: fixtures.formulas.find(config => config.id === entry.formulaType).explanation,
  ...entry.expected, missingFields: [], ...commonGuidance[entry.formulaType]
});

test("Batch 2 appends exactly ten approved entries and preserves all surface partitions", () => {
  assert.deepEqual(ids, ["leftText", "rightText", "midText", "textLength", "findTextPosition", "containsText", "lowerText", "upperText", "substituteText", "replaceTextByPosition"]);
  const advancedIds = currentLegacyFixtures.catalog.map(config => config.id);
  const commonIds = [...batch1.formulas.map(config => config.id), ...ids];
  assert.deepEqual(Object.keys(core.catalog), [...advancedIds, ...commonIds]);
  const entries = Object.values(core.catalog);
  assert.equal(entries.length, 44);
  assert.deepEqual(entries.filter(config => config.libraryId === "advanced").map(config => config.id), advancedIds);
  assert.deepEqual(entries.filter(config => config.libraryId === "common").map(config => config.id), commonIds);
  assert.equal(commonIds.length, 18);
  assert.equal(entries.filter(config => config.availability.extension).length, 42);
  assert.equal(entries.filter(config => config.libraryId === "advanced" && config.availability.extension).length, 24);
  assert.deepEqual(entries.filter(config => config.libraryId === "common" && config.availability.extension).map(config => config.id), commonIds);
  assert.deepEqual(entries.filter(config => config.availability.portfolio).map(config => config.id), advancedIds);
  assert.equal(entries.filter(config => config.libraryId === "common" && config.availability.portfolio).length, 0);
  assert.equal(fixtures.cases.length, 360);
  assert.equal(fixtures.cases.filter(entry => entry.expected.formula !== null).length, 69);
  assert.equal(new Set(fixtures.cases.map(entry => `${entry.formulaType}: ${entry.name}`)).size, fixtures.cases.length);
  assert.deepEqual([...new Set(fixtures.cases.map(entry => entry.formulaType))], ids);
});

for (const expected of fixtures.formulas) {
  test(`Batch 2 exact metadata and schema: ${expected.id}`, () => {
    const config = core.catalog[expected.id];
    const { fields, ...metadata } = expected;
    assert.deepEqual(plain({ ...config, fields: config.fields.map(({ help, ...field }) => field) }), {
      ...metadata, fields, libraryId: "common", availability: { extension: true, portfolio: false },
      categoryId: "text-labels", inputContract: "structured-v1", builderOptions: { functionName: expected.label }, guidance: commonGuidance[expected.id]
    });
    for (const field of config.fields) assert.ok(typeof field.help === "string" && field.help.trim());
    assert.equal(new Set(config.keywords.map(word => word.toLowerCase())).size, config.keywords.length);
    const defaults = core.validation.structured.createDefaultValues(config);
    assert.deepEqual(plain(defaults), {});
    defaults.text = { type: "textLiteral", value: "changed" };
    assert.deepEqual(plain(core.validation.structured.createDefaultValues(config)), {});
  });
}

for (const entry of fixtures.cases) {
  test(`Batch 2 exact fixture: ${entry.formulaType}: ${entry.name}`, () => {
    const raw = deepFreeze(plain(entry.rawValues)), before = JSON.stringify(raw);
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
    assert.equal(JSON.stringify(raw), before);
  });
}

for (const config of fixtures.formulas) {
  for (const field of config.fields.filter(field => field.type === "integer")) {
    test(`Batch 2 present undefined is not omission: ${config.id}.${field.id}`, () => {
      const entry = fixtures.cases.find(entry => entry.formulaType === config.id && entry.expected.formula !== null);
      const raw = { ...plain(entry.rawValues), [field.id]: undefined };
      assert.deepEqual(plain(core.generateFormula(config.id, raw)), {
        formulaType: config.id, explanation: config.explanation, values: null, formula: null,
        missingFields: [], references: [], ...commonGuidance[config.id],
        validationErrors: [{ path: field.id, code: "invalid", message: "Choose a valid value; null and undefined are not omission." }]
      });
    });
  }
}

test("Batch 2 generation uses structured dispatch independently of discovery metadata", () => {
  const isolated = loadFormulaCore();
  for (const id of ids) {
    isolated.catalog[id].availability = { extension: false, portfolio: false };
    isolated.catalog[id].libraryId = "advanced";
  }
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
  for (const id of ids) { delete isolated.catalog[id].availability; delete isolated.catalog[id].libraryId; }
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
});

test("Batch 2 remains deterministic without browser, clock, timer or network globals", () => {
  const context = vm.createContext({ Date: undefined }), isolated = loadFormulaCore(context);
  for (const name of ["window", "document", "navigator", "chrome", "fetch", "Date", "setTimeout"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  const before = JSON.stringify(isolated.catalog);
  deepFreeze(isolated.catalog);
  for (const entry of fixtures.cases) assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expectedResult(entry));
  assert.equal(JSON.stringify(isolated.catalog), before);
});

test("Batch 2 result values and reference records are independent across calls", () => {
  const entry = fixtures.cases.find(entry => entry.expected.references.length);
  const raw = deepFreeze(plain(entry.rawValues));
  const result = core.generateFormula(entry.formulaType, raw);
  result.values.range.name = "changed";
  result.references[0].name = "changed";
  assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expectedResult(entry));
});
