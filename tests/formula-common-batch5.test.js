const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const { deepFreeze } = require("./helpers/formula-discovery-fixtures");
const fixtures = require("./fixtures/formula-common-batch5-cases.json");
const guidance = require("./fixtures/formula-common-guidance.json");
const plain = value => JSON.parse(JSON.stringify(value));
const core = loadFormulaCore();
const ids = ["checkboxWhenValueMatches", "returnTextWhenValueMatches", "flagDuplicateValues", "combineTwoColumns", "ifCondition", "andConditions", "orConditions", "notCondition"];
const expected = entry => ({ formulaType: entry.formulaType,
  explanation: fixtures.formulas.find(config => config.id === entry.formulaType).explanation,
  ...entry.expected, missingFields: [], ...guidance[entry.formulaType] });
const cell = { type: "cellRef", column: "Status" };
const condition = { left: cell, operator: "=", right: { type: "textLiteral", value: "Complete" } };
const incompatible = path => ({ path, code: "incompatibleComparison", message: "Ordered comparisons require numbers or dates of the same kind, or current-row cells containing compatible values." });

test("Batch 5 exact allocation, labels, categories and defaults", () => {
  assert.deepEqual(fixtures.formulas.map(config => config.id), ids);
  assert.deepEqual(Object.keys(core.catalog).slice(-8), ids);
  assert.deepEqual(ids.map(id => core.catalog[id].label), ["Checkbox When Value Matches", "Return Text When Value Matches", "Flag Duplicate Values", "Combine Two Columns with Separator", "IF — Return a Value Based on a Condition", "AND — Check Whether All Conditions Are True", "OR — Check Whether Any Condition Is True", "NOT — Reverse a True/False Condition"]);
  assert.deepEqual(ids.map(id => core.catalog[id].builderKey), ["comparisonReturn", "comparisonReturn", "duplicateFlag", "textCombine", "comparisonReturn", "booleanGroup", "booleanGroup", "booleanGroup"]);
  const entries = Object.values(core.catalog), common = entries.filter(c => c.libraryId === "common");
  assert.equal(entries.length, 62); assert.equal(common.length, 36);
  assert.equal(entries.filter(c => c.availability.extension).length, 60);
  assert.equal(entries.filter(c => c.availability.portfolio).length, 26);
  assert.deepEqual(plain(core.categories.at(-1)), { id: "logic-conditions", label: "Logic & conditions" });
  assert.equal(core.categories.length, 6);
  assert.deepEqual(["text-labels", "dates-status", "counts-calculations", "logic-conditions"].map(id => common.filter(c => c.categoryId === id).length), [11, 3, 15, 7]);
  for (const config of fixtures.formulas) {
    assert.deepEqual(plain(core.catalog[config.id]), { ...config, libraryId: "common", availability: { extension: true, portfolio: false }, inputContract: "structured-v1", guidance: guidance[config.id] });
    const defaults = config.id === "flagDuplicateValues" ? { ignoreBlank: true } : config.id === "combineTwoColumns" ? { separator: " - ", suppressBlank: true } : {};
    assert.deepEqual(plain(core.validation.structured.createDefaultValues(core.catalog[config.id])), defaults);
    assert.equal(core.generateFormula(config.id, defaults).formula, null);
  }
  for (const id of ["andConditions", "orConditions"]) assert.deepEqual(plain(core.catalog[id].fields), [{ id: "conditions", label: "Condition", type: "array", required: true, minItems: 1, items: { type: "condition" } }]);
  assert.equal(new Set(fixtures.cases.map(e => `${e.formulaType}: ${e.name}`)).size, fixtures.cases.length);
});

for (const entry of fixtures.cases) test(`Batch 5 exact fixture: ${entry.formulaType}: ${entry.name}`, () => {
  const raw = deepFreeze(plain(entry.rawValues));
  assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected(entry));
  assert.deepEqual(plain(core.generateFormula(entry.formulaType, raw)), expected(entry));
});

const kinds = ["textLiteral", "number", "boolean", "date", "cellRef", "blank"];
// Explicit approved table, independent of the production predicate.
const orderedPairs = new Set(["number/number", "date/date", "cellRef/cellRef", "number/cellRef", "cellRef/number", "date/cellRef", "cellRef/date"]);
let equalityAccepted = 0, orderedAccepted = 0, orderedRejected = 0;
for (const operator of ["=", "<>", ">", "<", ">=", "<="]) for (const left of kinds) for (const right of kinds) {
  const accepted = ["=", "<>"].includes(operator) || orderedPairs.has(`${left}/${right}`);
  if (["=", "<>"].includes(operator)) equalityAccepted++; else if (accepted) orderedAccepted++; else orderedRejected++;
  test(`Batch 5 relationship matrix: ${left} ${operator} ${right}`, () => {
    const comparison = { left: { type: left }, operator, right: { type: right } };
    for (const mode of ["checkbox", "text", "typed"]) assert.deepEqual(plain(core.commonBuilders.registry.comparisonReturn.validate({ condition: comparison, matchText: "ok" }, { mode })), accepted ? [] : [incompatible("condition")]);
    for (const functionName of ["AND", "OR", "NOT"]) assert.deepEqual(plain(core.commonBuilders.registry.booleanGroup.validate({ condition: comparison, conditions: [comparison] }, { functionName })), accepted ? [] : [incompatible(functionName === "NOT" ? "condition" : "conditions[0]")]);
  });
}
test("compatibility matrix covers 72 equality and 144 ordered cases", () => {
  assert.deepEqual([equalityAccepted, orderedAccepted, orderedRejected], [72, 28, 116]);
});

test("generic validation precedes all relationship checks", () => {
  const raw = { condition: { left: cell, operator: ">", right: { type: "blank" } }, matchText: 0 };
  assert.deepEqual(plain(core.generateFormula("returnTextWhenValueMatches", raw).validationErrors), [{ path: "matchText", code: "text", message: "Expected text without control characters." }]);
});

const invalid = path => ({ path, code: "invalid", message: "Choose a valid value; null and undefined are not omission." });
const dataError = path => ({ path, code: "invalid", message: "Use plain serializable data properties." });
for (const id of ids) for (const [name, makeRaw, error] of [
  ["undefined root", () => undefined, invalid("")],
  ["accessor root", () => ({ get condition() { assert.fail("getter executed"); } }), dataError("")],
  ["inherited root", () => Object.create({ condition }), dataError("")],
  ["nonplain root", () => new Date(0), dataError("")],
  ["symbol root", () => ({ [Symbol("key")]: 1 }), dataError("")]
]) test(`Batch 5 JS rejection: ${id}: ${name}`, () => {
  const result = core.generateFormula(id, makeRaw());
  assert.deepEqual(plain(result.validationErrors), [error]);
  assert.equal(result.values, null); assert.equal(result.formula, null);
  assert.deepEqual(plain(result.references), []); assert.deepEqual(plain(result.missingFields), []);
});
for (const id of ["andConditions", "orConditions"]) for (const [name, makeRows, errors] of [
  ["sparse", () => Array(1), [{ path: "conditions[0]", code: "required", message: "Choose conditions[0]." }]],
  ["undefined", () => [undefined], [invalid("conditions[0]")]],
  ["array accessor", () => Object.defineProperty([condition], "0", { enumerable: true, get() { assert.fail("getter executed"); } }), [dataError("conditions")]],
  ["cycle", () => { const rows = []; rows.push(rows); return rows; }, [{ path: "conditions[0]", code: "invalid", message: "Use plain serializable data without cycles." }]],
  ["extra array property", () => Object.assign([condition], { rowKey: "r1" }), [{ path: "conditions.rowKey", code: "unexpected", message: "Remove this unexpected array property." }]]
]) test(`Batch 5 repeatable JS rejection: ${id}: ${name}`, () => {
  assert.deepEqual(plain(core.generateFormula(id, { conditions: makeRows() }).validationErrors), errors);
});
test("undefined optional output is invalid and absence remains absent", () => {
  const raw = { condition, trueOutput: { type: "boolean", value: false } };
  const omitted = core.generateFormula("ifCondition", raw);
  assert.equal(omitted.formula, '=IF([Status]@row = "Complete", 0)');
  assert.equal(Object.hasOwn(omitted.values, "falseOutput"), false);
  assert.deepEqual(plain(core.generateFormula("ifCondition", { ...raw, falseOutput: undefined }).validationErrors), [invalid("falseOutput")]);
});

test("Batch 5 escaping reuses exact structured column and text conventions", () => {
  const column = 'A[1]\\x', escaped = '[A\\[1\\]\\\\x]';
  const result = core.generateFormula("flagDuplicateValues", { column: { type: "columnRef", column }, ignoreBlank: true });
  assert.equal(result.formula, `=IF(${escaped}@row = "", 0, IF(COUNTIF(${escaped}:${escaped}, ${escaped}@row) > 1, 1, 0))`);
  assert.equal(core.generateFormula("combineTwoColumns", { first: { type: "cellRef", column }, second: cell, separator: '"\\', suppressBlank: false }).formula, `=${escaped}@row + "\\"\\\\" + [Status]@row`);
});

test("Batch 5 accepted literal comparisons preserve the existing date range and exact numeric bounds", () => {
  for (const [operand, expression] of [[{ type: "date", value: "0001-01-01" }, "DATE(1, 1, 1)"], [{ type: "date", value: "9999-12-31" }, "DATE(9999, 12, 31)"], [{ type: "number", value: "9007199254740992" }, "9007199254740992"], [{ type: "number", value: "-9007199254740992" }, "-9007199254740992"]]) {
    const raw = { condition: { left: operand, operator: "<=", right: operand } };
    assert.equal(core.generateFormula("notCondition", raw).formula, `=NOT(${expression} <= ${expression})`);
  }
});

test("Batch 5 generation is deterministic with frozen catalog and no browser, timers, clock or network", () => {
  const context = vm.createContext({ Date: undefined }), isolated = loadFormulaCore(context);
  for (const name of ["document", "window", "chrome", "fetch", "Date", "setTimeout"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  deepFreeze(isolated.catalog);
  for (const entry of fixtures.cases) {
    const result = isolated.generateFormula(entry.formulaType, deepFreeze(plain(entry.rawValues)));
    assert.deepEqual(plain(result), expected(entry));
    if (result.values) Object.keys(result.values).forEach(key => { result.values[key] = "changed"; });
    result.validationErrors.push({ path: "", code: "changed", message: "changed" });
    result.references.push({ name: "changed" }); result.setupNotes.push("changed"); result.instructions.push("changed");
    assert.deepEqual(plain(isolated.generateFormula(entry.formulaType, entry.rawValues)), expected(entry));
  }
});
