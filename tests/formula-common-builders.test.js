const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadFormulaScript } = require("./helpers/load-formula-core");
const { descriptor } = require("./helpers/formula-structured-fixtures");
const context = vm.createContext({ Date: undefined });
for (const name of ["formula-primitives", "formula-common-builders"]) loadFormulaScript(context, name);
const builders = context.SmartsheetFormulaBuilder.commonBuilders;
const approved = ["comparisonReturn", "duplicateFlag", "singleCriterionAggregate", "criteriaAggregate", "variadicAggregate", "percentMatch", "todayOffset", "dateDelta", "workdayCalculation", "overdueFlag", "textCombine", "booleanGroup", "booleanTest", "decimalRounding", "multipleRounding", "unaryNumeric", "textSlice", "textUnary", "textSearch", "dateConstructor", "textReplace"];

test("production registry is empty, frozen and has no mutable registration API", () => {
  assert.deepEqual(Array.from(builders.familyKeys), approved);
  assert.equal(Object.getPrototypeOf(builders.registry), null);
  assert.deepEqual(Object.keys(builders.registry), []);
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
  assert.deepEqual(Object.keys(builders.registry), []);
});
for (const key of ["unknown", "toString", "constructor", "__proto__", "CriteriaAggregate", "criteriaAggregate "]) test(`registry rejects unknown exact key ${key}`, () => assert.throws(() => builders.createRegistry({ [key]: descriptor() }), /configuration/));
for (const value of [null, undefined, {}, { validateOptions() {}, validate() {} }, { ...descriptor(), build: "SUM" }, { ...descriptor(), extra: true }]) test(`registry rejects malformed descriptor ${String(value)}`, () => assert.throws(() => builders.createRegistry({ criteriaAggregate: value }), /configuration/));
test("registry rejects inherited and accessor definitions without invoking getters", () => {
  assert.throws(() => builders.createRegistry(Object.create({ criteriaAggregate: descriptor() })), /configuration/);
  assert.throws(() => builders.createRegistry({ get criteriaAggregate() { assert.fail("getter must not run"); } }), /configuration/);
});
