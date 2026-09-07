const assert = require("node:assert/strict");
const test = require("node:test");
const fixtures = require("./fixtures/formula-builder-cases.json");
const { loadFormulaCore } = require("./helpers/load-formula-core");

const core = loadFormulaCore();
const plain = (value) => JSON.parse(JSON.stringify(value));

test("characterization includes all 26 types and 44 selectable combinations", () => {
  assert.equal(fixtures.catalog.length, 26);
  assert.equal(fixtures.cases.filter(entry => entry.kind === "default").length, 44);
  assert.deepEqual(Object.keys(core.catalog), fixtures.catalog.map(entry => entry.id));
});

for (const entry of fixtures.cases) {
  test(`characterization: ${entry.name}`, () => {
    const input = { ...entry.rawValues };
    const original = { ...input };
    const result = core.generateFormula(entry.formulaType, input);
    assert.deepEqual(plain(result), entry.expected);
    assert.deepEqual(plain(core.generateFormula(entry.formulaType, input)), entry.expected);
    assert.deepEqual(input, original);
  });
}
