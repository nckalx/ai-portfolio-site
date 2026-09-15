const assert = require("node:assert/strict");
const test = require("node:test");
const { plain, number, text, pair, config, descriptor, loadValidation } = require("./helpers/formula-structured-fixtures");
const structured = loadValidation().validation.structured;
const validate = (fields, values, builder = descriptor()) => structured.normalizeAndValidate(config(fields), values, builder);
const field = (id, type, extra = {}) => ({ id, type, ...extra });

test("required fields follow schema order; optional omission and Blank stay distinct", () => {
  const fields = [field("value", "typedOperand"), field("otherwise", "outputOperand", { required: false })];
  assert.deepEqual(plain(validate(fields, {}).errors), [{ path: "value", code: "required", message: "Choose value." }]);
  assert.deepEqual(plain(validate(fields, { value: text("") }).values), { value: text("") });
  assert.deepEqual(plain(validate(fields, { value: text(""), otherwise: { type: "blank" } }).values), { value: text(""), otherwise: { type: "blank" } });
  for (const otherwise of [null, undefined, {}, { type: "blank", key: "row1" }]) assert.equal(validate(fields, { value: text(""), otherwise }).values, null);
});
for (const [type, input, expected] of [
  ["number", "0012.500", "12.5"], ["integer", "-0003", "-3"], ["integer", "-0", "0"],
  ["date", "0001-01-01", "0001-01-01"], ["date", "2024-02-29", "2024-02-29"], ["date", "9999-12-31", "9999-12-31"],
  ["text", " spaces ", " spaces "], ["boolean", false, false],
  ["columnName", " Amount ", "Amount"], ["referenceName", "{{ Amounts }}", "Amounts"]
]) test(`normalizes ${type} ${JSON.stringify(input)}`, () => assert.equal(validate([field("value", type)], { value: input }).values.value, expected));

for (const [type, input] of [
  ["number", "1e3"], ["number", "NaN"], ["number", 3], ["number", "1,000"],
  ["integer", "1.0"], ["integer", "-2.5"], ["integer", "Infinity"],
  ["date", "0000-02-29"], ["date", "0000-01-01"], ["date", "2023-02-29"], ["date", "2026-13-01"], ["date", "9/14/2026"],
  ["text", "\n"], ["boolean", "true"], ["referenceName", "A{B}C"],
  ["comparisonOperator", "=="], ["comparisonOperator", "contains"]
]) test(`invalid ${type} ${JSON.stringify(input)} remains an error`, () => {
  const result = validate([field("value", type)], { value: input });
  assert.equal(result.values, null);
  assert.equal(result.errors[0].path, "value");
  assert.equal(result.errors[0].code, type);
});
test("enum constraints and exact decimal bounds preserve precision within the platform range", () => {
  assert.equal(validate([field("mode", "enum", { enum: ["one", "two"] })], { mode: "three" }).errors[0].code, "enum");
  const fields = [field("value", "number", { min: "9007199254740991.000000001", max: "9007199254740991.000000003" })];
  assert.equal(validate(fields, { value: "9007199254740991.000000002" }).values.value, "9007199254740991.000000002");
  assert.equal(validate(fields, { value: "9007199254740991.000000000" }).errors[0].code, "min");
  assert.equal(validate(fields, { value: "9007199254740991.000000004" }).errors[0].code, "max");
  for (const [value, code] of [["-4", "min"], ["2", "max"], ["-3", null], ["1", null]]) {
    const result = validate([field("value", "integer", { min: "-3", max: "1" })], { value });
    assert.equal(result.errors[0]?.code || null, code);
  }
});
test("permitted operand types do not claim knowledge of runtime cell types", () => {
  for (const type of ["numericOperand", "dateOperand", "textOperand"]) {
    assert.equal(validate([field("value", type)], { value: { type: "cellRef", column: "Unknown type" } }).errors.length, 0);
    assert.equal(validate([field("value", type)], { value: { type: "boolean", value: true } }).errors[0].path, "value.type");
  }
  assert.equal(validate([field("value", "typedOperand", { allowedTypes: ["number"] })], { value: text("12") }).errors[0].code, "operandType");
  assert.equal(validate([field("value", "numericOperand", { min: "0" })], { value: number("-1") }).errors[0].path, "value.value");
});
test("platform numeric bounds apply to scalar numbers, integers, operands and defaults", () => {
  for (const type of ["number", "integer", "numericOperand", "typedOperand"]) {
    const wrap = value => type.endsWith("Operand") ? number(value) : value;
    const fields = [field("value", type)];
    for (const value of ["9007199254740992", "-9007199254740992"]) {
      assert.deepEqual(plain(validate(fields, { value: wrap(value) }).values), { value: wrap(value) });
    }
    const invalid = ["9007199254740993", "-9007199254740993"];
    if (type !== "integer") invalid.push("9007199254740992.000000001", "-9007199254740992.000000001");
    for (const value of invalid) {
      const result = validate(fields, { value: wrap(value) });
      assert.equal(result.values, null);
      assert.equal(result.errors[0].path, type.endsWith("Operand") ? "value.value" : "value");
      assert.throws(() => structured.createDefaultValues(config([field("value", type, { defaultValue: wrap(value) })])), /Structured configuration: invalid defaults/);
    }
  }
});
test("metadata bounds cannot exceed the platform range, even for omitted optional fields", () => {
  for (const type of ["number", "integer", "numericOperand"]) {
    const fields = [field("value", type, { min: "-9007199254740992", max: "9007199254740992", required: false })];
    assert.deepEqual(plain(validate(fields, {}).values), {});
    for (const key of ["min", "max"]) {
      for (const bound of ["9007199254740993", "-9007199254740993", "9007199254740992.000000001", "-9007199254740992.000000001"]) {
        const invalid = config([field("value", type, { [key]: bound, required: false })]);
        assert.throws(() => structured.normalizeAndValidate(invalid, {}, descriptor()), /Structured configuration: invalid (min|max) bound/);
        assert.throws(() => structured.createDefaultValues(invalid), /Structured configuration: invalid (min|max) bound/);
      }
    }
  }
});
test("criteria schema alias is a configuration error while criterion and criteria[] remain supported", () => {
  const invalid = config([field("rows", "criteria", { required: false })]);
  for (const values of [{}, { rows: [pair()] }]) assert.throws(() => structured.normalizeAndValidate(invalid, values, descriptor()), /Structured configuration: unknown field type criteria\./);
  assert.throws(() => structured.createDefaultValues(invalid), /Structured configuration: unknown field type criteria\./);
  assert.equal(validate([field("value", "criterion")], { value: pair().criterion }).errors.length, 0);
  assert.equal(validate([field("rows", "criteria[]")], { rows: [pair()] }).errors.length, 0);
  assert.equal(validate([field("rows", "criteria[]", { minItems: 0 })], { rows: [] }).errors[0].code, "minItems");
});
test("repeatable criteria report nested paths and incomplete rows in array order", () => {
  const fields = [field("criteria", "criteria[]")];
  const invalid = pair(); delete invalid.criterion.value;
  assert.deepEqual(plain(validate(fields, { criteria: [pair(), invalid, {}] }).errors).map(error => [error.path, error.code]), [
    ["criteria[1].criterion.value", "required"], ["criteria[2].range", "required"], ["criteria[2].criterion", "required"]
  ]);
  assert.equal(validate(fields, { criteria: [] }).errors[0].code, "minItems");
  assert.equal(validate(fields, { criteria: [pair(), pair()] }).errors.length, 0);
  assert.equal(validate([field("criteria", "criteria[]", { minItems: 2 })], { criteria: [pair()] }).errors[0].code, "minItems");
});
test("error order follows declared members, indexes, then lexical unexpected properties", () => {
  const fields = [field("condition", "condition"), field("criteria", "criteria[]")];
  const input = { condition: { right: number("bad"), left: { type: "cellRef", column: "" }, operator: "?", z: 1, a: 2 }, criteria: [{ range: null, criterion: {} }], zebra: 1, alpha: 2 };
  const expected = ["condition.left.column", "condition.operator", "condition.right.value", "condition.a", "condition.z", "criteria[0].range", "criteria[0].criterion.operator", "criteria[0].criterion.value", "alpha", "zebra"];
  for (let i = 0; i < 3; i++) assert.deepEqual(plain(validate(fields, input).errors).map(error => error.path), expected);
});
for (const input of [null, undefined, [], "value", new Date(0), new Map(), () => {}, 1n, Symbol("x")]) {
  test(`malformed top-level parent ${String(input)} has one error`, () => {
    const result = validate([field("criteria", "criteria[]")], input);
    assert.equal(result.values, null); assert.equal(result.errors.length, 1); assert.equal(result.errors[0].path, "");
  });
}
test("malformed nested parents do not cascade into fake missing children", () => {
  const result = validate([field("criteria", "criteria[]")], { criteria: [null, "row", { range: "range", criterion: null }] });
  assert.deepEqual(plain(result.errors).map(error => error.path), ["criteria[0]", "criteria[1]", "criteria[2].range", "criteria[2].criterion"]);
});
test("sparse arrays, undefined rows, accessor properties, symbols and UI keys fail", () => {
  const fields = [field("criteria", "criteria[]")];
  for (const criteria of [Array(1), [undefined], Object.assign([pair()], { rowKey: "1" }), [{ ...pair(), key: "1" }]]) assert.equal(validate(fields, { criteria }).values, null);
  const getter = { get criteria() { assert.fail("must not invoke user accessors"); } };
  assert.equal(validate(fields, getter).values, null);
  assert.equal(validate(fields, { criteria: [pair()], [Symbol("key")]: "x" }).values, null);
  const inherited = Object.create({ criteria: [pair()] });
  assert.equal(validate(fields, inherited).values, null);
});
test("arrays support approved conditions and value-or-range shapes without nested expressions", () => {
  const fields = [field("conditions", "condition[]"), field("values", "valueOrRange[]")];
  const values = { conditions: [{ left: number("1"), operator: "<=", right: number("2") }], values: [number("12"), { type: "columnRef", column: "Amount" }] };
  assert.equal(validate(fields, values).errors.length, 0);
  values.conditions[0].left = { expression: "SUM(1,2)" };
  assert.equal(validate(fields, values).values, null);
});
test("normalization and defaults are deeply independent including aliased repeatable rows", () => {
  const row = pair();
  const fields = [field("criteria", "criteria[]", { defaultValue: [row, row] }), field("otherwise", "outputOperand", { defaultValue: { type: "blank" }, required: false })];
  Object.freeze(row.range); Object.freeze(row.criterion.value); Object.freeze(row.criterion); Object.freeze(row);
  const fixture = config(fields), first = structured.createDefaultValues(fixture), second = structured.createDefaultValues(fixture);
  first.criteria[0].criterion.value.value = "Changed";
  assert.equal(first.criteria[1].criterion.value.value, "Open");
  assert.equal(second.criteria[0].criterion.value.value, "Open");
  assert.equal(row.criterion.value.value, "Open");
  const normalized = validate(fields, { criteria: [row, row] }).values;
  normalized.criteria[0].range.name = "Changed";
  assert.equal(normalized.criteria[1].range.name, "Statuses");
  assert.equal(validate(fields, {}).errors[0].code, "required");
  assert.deepEqual(plain(structured.createDefaultValues(config([field("value", "number")]))), {});
});
test("invalid defaults including UI keys are configuration faults", () => {
  for (const defaultValue of [undefined, null, [{ ...pair(), key: "row" }], Array(1)]) assert.throws(() => structured.createDefaultValues(config([field("criteria", "criteria[]", { defaultValue })])), /configuration/);
});
test("builder relationship validation only runs after generic validation, in rule order", () => {
  const calls = [], builder = descriptor(calls);
  builder.validate = () => { calls.push("relationship"); return [{ path: "value", code: "relationship", message: "First rule." }, { path: "value", code: "relationship", message: "Second rule." }]; };
  const fields = [field("value", "number")];
  validate(fields, { value: "bad" }, builder);
  assert.deepEqual(calls, ["options"]);
  const result = validate(fields, { value: "1" }, builder);
  assert.deepEqual(calls, ["options", "options", "relationship"]);
  assert.equal(result.values, null);
  assert.deepEqual(plain(result.errors).map(error => error.message), ["First rule.", "Second rule."]);
});
test("malformed developer schemas/options and builder errors throw rather than becoming input errors", () => {
  for (const fields of [[field("x", "unknown", { required: false })], [field("x", "integer", { min: "1.5" })], [field("x", "number", { min: "2", max: "1" })], [field("x", "enum")], [field("x", "array")], [field("x", "number"), field("x", "number")]]) assert.throws(() => validate(fields, {}), /configuration/);
  assert.throws(() => structured.normalizeAndValidate(config([], { builderOptions: {} }), {}, descriptor()), /configuration/);
  const builder = descriptor(); builder.validate = () => ["bad"];
  assert.throws(() => validate([], {}, builder), /configuration/);
});

test("defaults preserve declared spelling while generation normalizes independent copies", () => {
  const fixture = config([{ id: "value", type: "typedOperand", defaultValue: number("0012.500") }]);
  const defaults = structured.createDefaultValues(fixture);
  assert.equal(defaults.value.value, "0012.500");
  assert.equal(structured.normalizeAndValidate(fixture, defaults, descriptor()).values.value.value, "12.5");
  assert.equal(defaults.value.value, "0012.500");
});
test("cyclic data and non-serializable leaf values are rejected", () => {
  const input = {}; input.member = input;
  assert.equal(validate([field("member", "object", { fields: [] })], input).errors[0].path, "member");
  for (const value of [NaN, Infinity, () => {}, Symbol("x"), 1n]) assert.equal(validate([field("value", "typedOperand")], { value: { type: "textLiteral", value } }).values, null);
});
test("nested object and repeatable item metadata preserve custom paths and errors", () => {
  const fields = [field("rows", "array", { minItems: 1, items: { type: "object", fields: [field("count", "integer", { min: "1", requiredMessage: "Choose a count." }), field("optional", "text", { required: false })] } })];
  assert.deepEqual(plain(validate(fields, { rows: [{}] }).errors), [{ path: "rows[0].count", code: "required", message: "Choose a count." }]);
  assert.deepEqual(plain(validate(fields, { rows: [{ count: "002" }] }).values), { rows: [{ count: "2" }] });
});
