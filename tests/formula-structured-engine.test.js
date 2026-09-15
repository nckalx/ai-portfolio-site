const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { plain, text, pair, config, descriptor, loadStructured } = require("./helpers/formula-structured-fixtures");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const fields = [{ id: "criteria", type: "criteria[]", defaultValue: [pair()] }];
const setup = (extra = {}, builder = descriptor()) => loadStructured(config(fields, extra), { criteriaAggregate: builder });

test("public structured dispatch returns exact formula, normalized values and fragment references", () => {
  const calls = [], { core } = setup({}, descriptor(calls));
  const result = core.generateFormula("syntheticStructured", { criteria: [pair("{{ Statuses }}"), pair("Statuses", "Closed"), pair("Other", "{Not a reference}")] });
  assert.deepEqual(plain(result), {
    formulaType: "syntheticStructured", values: { criteria: [pair("Statuses"), pair("Statuses", "Closed"), pair("Other", "{Not a reference}")] }, explanation: "Test fixture",
    formula: '=COUNTIFS({Statuses}, "Open", {Statuses}, "Closed", {Other}, "{Not a reference}")',
    missingFields: [], validationErrors: [], references: [{ name: "Statuses" }, { name: "Other" }], setupNotes: [], instructions: []
  });
  assert.deepEqual(calls, ["options", "validate", "build"]);
});
test("invalid input and omitted required values never reach rendering or receive catalog defaults", () => {
  const calls = [], { core } = setup({}, descriptor(calls));
  for (const values of [{}, { criteria: [] }, { criteria: [pair()], builderKey: "todayOffset" }, { criteria: [pair()], expression: "TODAY()" }]) {
    const result = core.generateFormula("syntheticStructured", values);
    assert.equal(result.formula, null); assert.equal(result.values, null); assert.ok(result.validationErrors.length);
    assert.deepEqual(plain(result.references), []);
  }
  assert.deepEqual(calls, ["options", "options", "options", "options"]);
});
test("builder relationship errors prevent rendering", () => {
  const builder = descriptor();
  builder.validate = () => [{ path: "criteria", code: "relationship", message: "Fixture rule." }];
  builder.build = () => assert.fail("must not render");
  const { core } = setup({}, builder);
  assert.equal(core.generateFormula("syntheticStructured", { criteria: [pair()] }).validationErrors[0].code, "relationship");
});
test("out-of-range numeric literals and year zero are rejected before builder rendering", () => {
  const calls = [], { core } = setup({}, descriptor(calls));
  for (const value of [
    { type: "number", value: "9007199254740993" },
    { type: "number", value: "-9007199254740992.000000001" },
    { type: "date", value: "0000-02-29" }
  ]) {
    const row = pair(); row.criterion.value = value;
    const result = core.generateFormula("syntheticStructured", { criteria: [row] });
    assert.equal(result.formula, null);
    assert.equal(result.values, null);
    assert.equal(result.validationErrors[0].path, "criteria[0].criterion.value.value");
  }
  assert.deepEqual(calls, ["options", "options", "options"]);
});
for (const extra of [{ libraryId: "advanced", availability: { extension: false, portfolio: false } }, { libraryId: "common", availability: { extension: true, portfolio: true } }, { libraryId: "unknown" }, { categoryId: "missing", keywords: [] }]) {
  test(`discovery metadata never authorizes structured engine use ${JSON.stringify(extra)}`, () => {
    const { core } = setup(extra);
    assert.equal(core.generateFormula("syntheticStructured", { criteria: [pair()] }).formula, '=COUNTIFS({Statuses}, "Open")');
  });
}
test("library and availability do not opt a formula into structured dispatch", () => {
  const fixture = config(fields, { libraryId: "common", availability: { extension: true, portfolio: true } }); delete fixture.inputContract;
  const calls = [], { core } = loadStructured(fixture, { criteriaAggregate: descriptor(calls) });
  assert.throws(() => core.generateFormula(fixture.id, { criteria: [pair()] }));
  assert.deepEqual(calls, []);
});
for (const builderKey of ["unknown", "toString", "constructor", "__proto__", "todayOffset"]) test(`unknown or unimplemented builder fails clearly ${builderKey}`, () => {
  const { core } = setup({ builderKey });
  assert.throws(() => core.generateFormula("syntheticStructured", { criteria: [pair()] }), /Structured configuration: (unknown|unimplemented) builder family/);
});
for (const inputContract of ["structured-v2", "structured", "", undefined, null]) test(`unsupported explicit contract is a configuration fault ${String(inputContract)}`, () => {
  const { core } = setup({ inputContract });
  assert.throws(() => core.generateFormula("syntheticStructured", { criteria: [pair()] }), /unsupported input contract/);
});
test("invalid builder options are developer faults even with invalid user input", () => {
  const { core } = setup({ builderOptions: { functionName: "SUM" } });
  assert.throws(() => core.generateFormula("syntheticStructured", {}), /configuration/);
});
for (const rendered of [null, { expression: "=SUM(1)", references: [] }, { expression: "", references: [] }, { expression: "SUM(1)" }, { expression: "SUM(1)", references: [], instructions: [] }]) {
  test(`invalid builder fragment fails ${JSON.stringify(rendered)}`, () => {
    const builder = descriptor(); builder.build = () => rendered;
    const { core } = setup({}, builder);
    assert.throws(() => core.generateFormula("syntheticStructured", { criteria: [pair()] }));
  });
}
test("synthetic optional IF argument proves omission, Blank and empty text semantics", () => {
  const fixture = config([{ id: "otherwise", type: "outputOperand", required: false }]);
  const builder = descriptor();
  builder.build = (values, options, p) => p.renderFunctionCall("IF", [p.renderOperand({ type: "boolean", value: true }), p.renderOperand(text("Ready")), ...(Object.hasOwn(values, "otherwise") ? [p.renderOperand(values.otherwise)] : [])]);
  const { core } = loadStructured(fixture, { criteriaAggregate: builder });
  assert.equal(core.generateFormula(fixture.id, {}).formula, '=IF(1, "Ready")');
  assert.equal(core.generateFormula(fixture.id, { otherwise: { type: "blank" } }).formula, '=IF(1, "Ready", "")');
  assert.equal(core.generateFormula(fixture.id, { otherwise: text("") }).values.otherwise.type, "textLiteral");
  assert.equal(core.generateFormula(fixture.id, { otherwise: undefined }).formula, null);
});
test("structured core runs without DOM, browser clock, network or timers and is deterministic", () => {
  const { core, context } = setup();
  for (const name of ["document", "window", "chrome", "fetch", "Date", "setTimeout", "navigator"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  const values = { criteria: [pair()] }, before = JSON.stringify(values);
  assert.deepEqual(plain(core.generateFormula("syntheticStructured", values)), plain(core.generateFormula("syntheticStructured", values)));
  assert.equal(JSON.stringify(values), before);
});
test("fixtures do not mutate production catalog; Advanced malformed-input exceptions survive", () => {
  const core = loadFormulaCore(), before = JSON.stringify(core.catalog);
  setup();
  assert.equal(JSON.stringify(core.catalog), before);
  assert.equal(Object.keys(core.catalog).length, 26);
  assert.ok(Object.values(core.catalog).every(entry => entry.libraryId === "advanced" && !Object.hasOwn(entry, "inputContract")));
  assert.throws(() => core.generateFormula("unknown", {}));
  for (const raw of [null, {}, { finishDateColumn: 1, milestoneLabelColumn: "Task" }]) assert.throws(() => core.generateFormula("appendFinishDateLabel", raw));
});
