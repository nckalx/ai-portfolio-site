const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaScript } = require("./helpers/load-formula-core");
const context = vm.createContext({ Date: undefined });
loadFormulaScript(context, "formula-primitives");
const p = context.SmartsheetFormulaBuilder.primitives;
const plain = value => JSON.parse(JSON.stringify(value));
const operand = (type, value) => ({ type, value });

for (const [input, expected] of [
  [{ type: "cellRef", column: " Status " }, "[Status]@row"],
  [{ type: "cellRef", column: "A[B]" }, String.raw`[A\[B\]]@row`],
  [{ type: "cellRef", column: String.raw`A\B` }, String.raw`[A\\B]@row`],
  [operand("textLiteral", " spaced text "), '" spaced text "'],
  [operand("textLiteral", 'Say "Ready"'), String.raw`"Say \"Ready\""`],
  [operand("textLiteral", 'C:\\work\\'), String.raw`"C:\\work\\"`],
  [operand("textLiteral", '\\"'), String.raw`"\\\""`],
  [operand("textLiteral", ""), '""'],
  [{ type: "blank" }, '""'],
  [operand("boolean", true), "1"], [operand("boolean", false), "0"],
  [operand("number", "0"), "0"], [operand("number", "-12"), "-12"],
  [operand("number", " 0012.500 "), "12.5"], [operand("number", "-00.000"), "0"],
  [operand("number", "-000.00100"), "-0.001"],
  [operand("number", " 009007199254740991.12345678900 "), "9007199254740991.123456789"],
  [operand("number", "9007199254740992"), "9007199254740992"],
  [operand("number", "-9007199254740992"), "-9007199254740992"],
  [operand("number", "0009007199254740992.000"), "9007199254740992"],
  [operand("number", "-0009007199254740992.000"), "-9007199254740992"],
  [operand("date", "2024-02-29"), "DATE(2024, 2, 29)"],
  [operand("date", "9999-12-31"), "DATE(9999, 12, 31)"],
  [operand("date", "0001-01-01"), "DATE(1, 1, 1)"],
  [operand("date", "1899-12-31"), "DATE(1899, 12, 31)"]
]) test(`operand fixed rendering ${JSON.stringify(input)}`, () => {
  Object.freeze(input);
  assert.deepEqual(plain(p.renderOperand(input)), { expression: expected, references: [] });
  assert.deepEqual(plain(p.renderOperand(input)), plain(p.renderOperand(input)));
});

for (const value of ["1e3", "1,000", "$12", "NaN", "Infinity", "", ".5", "1.", "+1", "1 2", 12, null, undefined]) {
  test(`reject malformed number ${String(value)}`, () => assert.throws(() => p.renderOperand(operand("number", value))));
}
for (const value of ["0000-02-29", "0000-01-01", "2023-02-29", "1900-02-29", "2024-04-31", "2024-00-10", "2024-13-01", "2024-01-00", "09/14/2026", "2026-9-14"]) {
  test(`reject invalid date ${value}`, () => assert.throws(() => p.renderOperand(operand("date", value))));
}
for (const value of ["9007199254740993", "-9007199254740993", "9007199254740992.000000001", "-9007199254740992.000000001", "10000000000000000", "-10000000000000000"]) {
  test(`reject unsupported numeric magnitude ${value}`, () => assert.throws(() => p.renderOperand(operand("number", value)), /from -9007199254740992 through 9007199254740992/));
}
for (const input of [null, undefined, {}, { expression: "TODAY()" }, { type: "blank", value: "" }, { type: "cellRef", column: "" }, operand("boolean", 1), operand("textLiteral", "a\nb"), operand("textLiteral", "a\tb"), operand("textLiteral", "\0"), operand("textLiteral", "\u007f")]) {
  test(`reject malformed operand ${JSON.stringify(input)}`, () => assert.throws(() => p.renderOperand(input)));
}
for (const [input, expected] of [
  [{ type: "columnRef", column: "Amount" }, "[Amount]:[Amount]"],
  [{ type: "rangeRef", scope: "currentSheet", startColumn: "Start", endColumn: "End" }, "[Start]:[End]"],
  ...["Amounts", "{Amounts}", "{{ Amounts }}"].map(name => [{ type: "rangeRef", scope: "crossSheet", name }, "{Amounts}"])
]) test(`range rendering ${JSON.stringify(input)}`, () => assert.equal(p.renderRange(Object.freeze(input)).expression, expected));
for (const name of ["", "{}", "{{}}", "{Amounts", "Amounts}", "{{Amounts}", "A{B}C", "{A}{B}", "A\nB"]) {
  test(`reject malformed reference ${name}`, () => assert.throws(() => p.renderRange({ type: "rangeRef", scope: "crossSheet", name })));
}
for (const operator of ["=", "<>", ">", "<", ">=", "<="]) test(`operator ${operator}`, () => {
  assert.equal(p.renderCondition({ left: { type: "cellRef", column: "Amount" }, operator, right: operand("number", "100") }).expression, `[Amount]@row ${operator} 100`);
  assert.equal(p.renderCriterion({ operator, value: operand("textLiteral", "Open") }).expression, `${operator === "=" ? "" : operator}"Open"`);
});
test("unsupported operators and expression nodes never fall back", () => {
  for (const operator of ["==", "!=", "contains", "", null]) assert.throws(() => p.renderCriterion({ operator, value: operand("number", "1") }));
  assert.throws(() => p.renderCondition({ left: { expression: "X" }, operator: "=", right: { type: "blank" } }));
});
test("criteria pairs preserve order and reject incomplete rows", () => {
  const pair = { range: { type: "rangeRef", scope: "crossSheet", name: "Statuses" }, criterion: { operator: "=", value: operand("textLiteral", "Open") } };
  assert.equal(p.renderFunctionCall("COUNTIFS", p.renderCriteriaPairs([pair])).expression, 'COUNTIFS({Statuses}, "Open")');
  assert.equal(p.renderFunctionCall("COUNTIFS", p.renderCriteriaPairs([pair, pair])).expression, 'COUNTIFS({Statuses}, "Open", {Statuses}, "Open")');
  for (const rows of [[], [pair, {}], [pair, null], [pair, undefined], Array(1), [{ ...pair, key: "row1" }]]) assert.throws(() => p.renderCriteriaPairs(rows));
});
test("function assembly preserves omission, explicit Blank, and rejects positional holes", () => {
  assert.equal(p.renderFunctionCall("TODAY", []).expression, "TODAY()");
  const args = [p.renderOperand(operand("boolean", true)), p.renderOperand(operand("number", "5"))];
  assert.equal(p.renderFunctionCall("IF", args).expression, "IF(1, 5)");
  assert.equal(p.renderFunctionCall("IF", [...args, p.renderOperand({ type: "blank" })]).expression, 'IF(1, 5, "")');
  for (const values of [[...args, undefined], [args[0], , args[1]], [null], [{ expression: "", references: [] }], [{ expression: "=TODAY()", references: [] }]]) assert.throws(() => p.renderFunctionCall("IF", values));
  for (const name of ["sum", "SUM()", " SUM", "X, Y", null]) assert.throws(() => p.renderFunctionCall(name, []));
});
test("references are normalized, fresh, exact-case deduplicated and never scanned from text", () => {
  const range = name => p.renderRange({ type: "rangeRef", scope: "crossSheet", name });
  const fragments = [range("{{ B }}"), p.renderOperand(operand("textLiteral", "{Fake}")), range("A"), range("B"), range("b")];
  const before = JSON.stringify(fragments);
  const result = p.collectReferences(fragments);
  assert.deepEqual(plain(result), [{ name: "B" }, { name: "A" }, { name: "b" }]);
  result[0].name = "changed";
  assert.equal(JSON.stringify(fragments), before);
  assert.equal(p.collectReferences(fragments)[0].name, "B");
  assert.throws(() => p.collectReferences([{ type: "rangeRef", scope: "crossSheet", name: "B" }]));
});
test("semantic accessors and inherited tags never reach primitive rendering", () => {
  let reads = 0;
  assert.throws(() => p.renderOperand({ get type() { reads++; return "textLiteral"; }, value: "x" }));
  assert.throws(() => p.renderRange({ type: "rangeRef", get scope() { reads++; return "crossSheet"; } }));
  assert.equal(reads, 0);
  assert.throws(() => p.renderOperand(Object.create({ type: "blank" })));
});
test("column bracket edges and reference punctuation remain literal", () => {
  assert.equal(p.renderOperand({ type: "cellRef", column: "[" }).expression, String.raw`[\[]@row`);
  assert.equal(p.renderOperand({ type: "cellRef", column: "]" }).expression, String.raw`[\]]@row`);
  const result = p.renderRange({ type: "rangeRef", scope: "crossSheet", name: ' {{ Team [A] "Ready" }} ' });
  assert.equal(result.expression, '{Team [A] "Ready"}');
  assert.deepEqual(plain(result.references), [{ name: 'Team [A] "Ready"' }]);
  assert.equal(p.renderRange({ type: "rangeRef", scope: "crossSheet", name: 'Team\\' }).expression, '{Team\\\\}');
});
test("frozen nested criteria remain unchanged across repeated rendering", () => {
  const pair = Object.freeze({ range: Object.freeze({ type: "rangeRef", scope: "crossSheet", name: "{{ Source }}" }), criterion: Object.freeze({ operator: "<>", value: Object.freeze({ type: "blank" }) }) });
  const rows = Object.freeze([pair]);
  const before = JSON.stringify(rows);
  const first = p.renderCriteriaPairs(rows), second = p.renderCriteriaPairs(rows);
  assert.deepEqual(plain(first), plain(second));
  assert.notEqual(first, second); assert.notEqual(first[0].references, second[0].references);
  assert.equal(JSON.stringify(rows), before);
});
