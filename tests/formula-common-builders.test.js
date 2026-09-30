const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaScript } = require("./helpers/load-formula-core");
const { descriptor } = require("./helpers/formula-structured-fixtures");
const context = vm.createContext({ Date: undefined });
for (const name of ["formula-primitives", "formula-common-builders"]) loadFormulaScript(context, name);
const builders = context.SmartsheetFormulaBuilder.commonBuilders;
const approved = ["comparisonReturn", "duplicateFlag", "singleCriterionAggregate", "criteriaAggregate", "variadicAggregate", "percentMatch", "todayOffset", "dateDelta", "workdayCalculation", "overdueFlag", "textCombine", "booleanGroup", "booleanTest", "decimalRounding", "multipleRounding", "unaryNumeric", "textSlice", "textUnary", "textSearch", "dateConstructor", "textReplace"];

test("production registry contains exactly Batch 1, Batch 2 and Batch 3 families, is frozen and has no mutable registration API", () => {
  assert.deepEqual(Array.from(builders.familyKeys), approved);
  assert.equal(Object.getPrototypeOf(builders.registry), null);
  assert.deepEqual(Object.keys(builders.registry), ["decimalRounding", "multipleRounding", "unaryNumeric", "textSlice", "textUnary", "textSearch", "textReplace", "todayOffset", "dateConstructor", "booleanTest"]);
  assert.ok(Object.isFrozen(builders)); assert.ok(Object.isFrozen(builders.familyKeys)); assert.ok(Object.isFrozen(builders.registry));
  assert.deepEqual(Object.keys(builders), ["familyKeys", "createRegistry", "registry"]);
});
for (const key of approved) test(`isolated registry recognizes ${key}`, () => {
  const source = descriptor(), definitions = { [key]: source };
  const registry = builders.createRegistry(definitions);
  const validate = registry[key].validate;
  source.validate = () => ["changed"]; delete definitions[key];
  assert.equal(registry[key].validate, validate);
  assert.ok(Object.isFrozen(registry)); assert.ok(Object.isFrozen(registry[key]));
  assert.equal(Object.hasOwn(registry, key), true);
  assert.equal(Object.hasOwn(registry, "toString"), false);
  assert.deepEqual(Object.keys(builders.registry), ["decimalRounding", "multipleRounding", "unaryNumeric", "textSlice", "textUnary", "textSearch", "textReplace", "todayOffset", "dateConstructor", "booleanTest"]);
});
for (const key of ["unknown", "toString", "constructor", "__proto__", "CriteriaAggregate", "criteriaAggregate "]) test(`registry rejects unknown exact key ${key}`, () => assert.throws(() => builders.createRegistry({ [key]: descriptor() }), /configuration/));
for (const value of [null, undefined, {}, { validateOptions() {}, validate() {} }, { ...descriptor(), build: "SUM" }, { ...descriptor(), extra: true }]) test(`registry rejects malformed descriptor ${String(value)}`, () => assert.throws(() => builders.createRegistry({ criteriaAggregate: value }), /configuration/));
test("registry rejects inherited and accessor definitions without invoking getters", () => {
  assert.throws(() => builders.createRegistry(Object.create({ criteriaAggregate: descriptor() })), /configuration/);
  assert.throws(() => builders.createRegistry({ get criteriaAggregate() { assert.fail("getter must not run"); } }), /configuration/);
});

for (const [key, names] of Object.entries({
  decimalRounding: ["ROUND", "ROUNDUP", "ROUNDDOWN"],
  multipleRounding: ["CEILING", "FLOOR"],
  unaryNumeric: ["ABS", "VALUE", "INT"],
  textSlice: ["LEFT", "RIGHT", "MID"],
  textUnary: ["LEN", "LOWER", "UPPER"],
  textSearch: ["FIND", "CONTAINS"],
  textReplace: ["SUBSTITUTE", "REPLACE"],
  todayOffset: ["TODAY"],
  dateConstructor: ["DATE"],
  booleanTest: ["ISBLANK"]
})) {
  test(`production ${key} accepts only exact own functionName options`, () => {
    const builder = builders.registry[key];
    assert.ok(Object.isFrozen(builder));
    for (const functionName of names) assert.equal(builder.validateOptions({ functionName }), undefined);
    for (const functionName of ["SUM", names[0].toLowerCase(), `${names[0]} `, `${names[0]}(1)`, ...["ROUND", "CEILING", "ABS", "LEFT", "RIGHT", "MID", "LEN", "LOWER", "UPPER", "FIND", "CONTAINS", "SUBSTITUTE", "REPLACE", "TODAY", "DATE", "ISBLANK"].filter(name => !names.includes(name))]) {
      assert.throws(() => builder.validateOptions({ functionName }), /Structured configuration/);
    }
    for (const options of [undefined, null, {}, [], { functionName: names[0], extra: true }, Object.create({ functionName: names[0] }), { get functionName() { assert.fail("must not invoke getter"); } }]) {
      assert.throws(() => builder.validateOptions(options), /Structured configuration/);
    }
  });
}
