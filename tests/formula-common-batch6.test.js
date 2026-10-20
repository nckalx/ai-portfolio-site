const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { deepFreeze } = require("./helpers/formula-discovery-fixtures");
const fixtures = require("./fixtures/formula-common-batch6-cases.json");
const guidance = require("./fixtures/formula-common-guidance.json");
const plain = value => JSON.parse(JSON.stringify(value));
const core = loadFormulaCore();
const ids = ["countIf", "countIfs", "sumIf", "averageIf", "percentRowsMatchingValue", "sumIfs"];
const expected = entry => ({ formulaType: entry.formulaType,
  explanation: fixtures.formulas.find(config => config.id === entry.formulaType).explanation,
  ...entry.expected, missingFields: [], ...guidance[entry.formulaType] });

test("Batch 6 approved allocation, counts, fields, labels and no defaults", () => {
  assert.deepEqual(fixtures.formulas.map(config => config.id), ids);
  assert.deepEqual(Object.keys(core.catalog).slice(-6), ids);
  assert.deepEqual(ids.map(id => core.catalog[id].label), ["COUNTIF", "COUNTIFS", "SUMIF", "AVERAGEIF", "Percent of Nonblank Values Matching One Value", "SUMIFS"]);
  assert.deepEqual(ids.map(id => core.catalog[id].builderKey), ["singleCriterionAggregate", "criteriaAggregate", "singleCriterionAggregate", "singleCriterionAggregate", "percentMatch", "criteriaAggregate"]);
  const all = Object.values(core.catalog), common = all.filter(c => c.libraryId === "common");
  assert.equal(all.length, 68); assert.equal(common.length, 42);
  assert.equal(all.filter(c => c.availability.extension).length, 66);
  assert.equal(all.filter(c => c.availability.portfolio).length, 26);
  assert.deepEqual(["text-labels", "dates-status", "counts-calculations", "logic-conditions"].map(id => common.filter(c => c.categoryId === id).length), [11, 3, 21, 7]);
  assert.deepEqual(plain(ids.map(id => core.catalog[id].fields.map(f => f.id))), [["range", "criterion"], ["criteria"], ["range", "criterion", "sumRange"], ["range", "criterion", "averageRange"], ["range", "value"], ["sumRange", "criteria"]]);
  for (const config of fixtures.formulas) {
    assert.deepEqual(plain(core.catalog[config.id]), { ...config, libraryId: "common", availability: { extension: true, portfolio: false }, inputContract: "structured-v1", guidance: guidance[config.id] });
    assert.equal(config.categoryId, "counts-calculations");
    assert.deepEqual(plain(core.validation.structured.createDefaultValues(core.catalog[config.id])), {});
  }
  assert.equal(new Set(fixtures.cases.map(e => `${e.formulaType}: ${e.name}`)).size, fixtures.cases.length);
});

for (const entry of fixtures.cases) test(`Batch 6 exact fixture: ${entry.formulaType}: ${entry.name}`, () => {
  const raw = deepFreeze(plain(entry.rawValues));
  assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected(entry));
  assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected(entry));
});

const invalid = path => ({ path, code: "invalid", message: "Choose a valid value; null and undefined are not omission." });
const dataError = path => ({ path, code: "invalid", message: "Use plain serializable data properties." });
for (const id of ids) for (const [name, makeRaw, error] of [
  ["undefined", () => undefined, invalid("")],
  ["getter", () => ({ get range() { assert.fail("getter executed"); } }), dataError("")],
  ["inherited", () => Object.create({ range: {} }), dataError("")],
  ["nonplain", () => new Date(0), dataError("")],
  ["symbol", () => ({ [Symbol("key")]: 1 }), dataError("")],
  ["nonenumerable", () => Object.defineProperty({}, "range", { value: {} }), dataError("")]
]) test(`Batch 6 JS root rejection: ${id}: ${name}`, () => {
  const result = core.generateFormula(id, makeRaw());
  assert.deepEqual(plain(result.validationErrors), [error]);
  assert.equal(result.formula, null); assert.equal(result.values, null); assert.deepEqual(plain(result.references), []);
});

const sample = id => plain(fixtures.cases.find(e => e.formulaType === id && e.name === "representative").rawValues);
for (const [id, output] of [["sumIf", "sumRange"], ["averageIf", "averageRange"]]) test(`Batch 6 optional undefined is not omission: ${id}`, () => {
  const raw = sample(id);
  assert.equal(Object.hasOwn(core.generateFormula(id, raw).values, output), false);
  assert.deepEqual(plain(core.generateFormula(id, { ...raw, [output]: undefined }).validationErrors), [invalid(output)]);
});
for (const id of ["countIfs", "sumIfs"]) for (const [name, rows, errors] of [
  ["sparse", () => Array(1), [{ path: "criteria[0]", code: "required", message: "Choose criteria[0]." }]],
  ["undefined", () => [undefined], [invalid("criteria[0]")]],
  ["getter", () => Object.defineProperty([{}], "0", { enumerable: true, get() { assert.fail("getter executed"); } }), [dataError("criteria")]],
  ["cycle", () => { const a = []; a.push(a); return a; }, [{ path: "criteria[0]", code: "invalid", message: "Use plain serializable data without cycles." }]],
  ["UI key", () => Object.assign(sample(id).criteria, { rowKey: "r1" }), [{ path: "criteria.rowKey", code: "unexpected", message: "Remove this unexpected array property." }]]
]) test(`Batch 6 JS repeatable rejection: ${id}: ${name}`, () => {
  assert.deepEqual(plain(core.generateFormula(id, { ...sample(id), criteria: rows() }).validationErrors), errors);
});

test("Batch 6 nested accessors and nonenumerable operands never execute", () => {
  for (const id of ids) {
    for (const operand of [{ get type() { assert.fail("getter executed"); } }, Object.defineProperty({}, "type", { value: "blank" }), Object.create({ type: "blank" }), { [Symbol("type")]: "blank" }]) {
      const raw = sample(id);
      const path = id === "percentRowsMatchingValue" ? "value" : raw.criteria ? "criteria[0].criterion.value" : "criterion.value";
      if (raw.criteria) raw.criteria[0].criterion.value = operand;
      else if (raw.criterion) raw.criterion.value = operand;
      else raw.value = operand;
      assert.deepEqual(plain(core.generateFormula(id, raw).validationErrors), [dataError(path)]);
    }
  }
});

test("Batch 6 generic faults precede relationship checks and no arbitrary pair cap is imposed", () => {
  const raw = sample("countIf"); raw.criterion.operator = ">"; raw.range = null;
  assert.deepEqual(plain(core.generateFormula("countIf", raw).validationErrors), [invalid("range")]);
  const many = Array.from({ length: 80 }, () => sample("countIfs").criteria[0]);
  const result = core.generateFormula("countIfs", { criteria: many });
  assert.equal(result.formula, `=COUNTIFS(${Array(80).fill('[Status]:[Status], "Open"').join(", ")})`);
});

test("Batch 6 generation is deterministic with frozen catalog and no browser, network, clock or timers", () => {
  const context = vm.createContext({ Date: undefined }), isolated = loadFormulaCore(context);
  for (const name of ["document", "window", "chrome", "fetch", "Date", "setTimeout"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  deepFreeze(isolated.catalog);
  for (const entry of fixtures.cases) {
    const raw = deepFreeze(plain(entry.rawValues));
    const result = isolated.generateFormula(entry.formulaType, raw);
    assert.deepEqual(plain(result), expected(entry));
    result.validationErrors.push({ path: "", code: "changed", message: "changed" });
    result.references.push({ name: "changed" }); result.setupNotes.push("changed");
    assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, raw)), expected(entry));
  }
});
