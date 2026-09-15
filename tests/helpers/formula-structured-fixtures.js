// Isolated test data only. Never imported by runtime code or the packager.
const vm = require("node:vm");
const { loadFormulaScript } = require("./load-formula-core");
const plain = value => JSON.parse(JSON.stringify(value));
const number = value => ({ type: "number", value });
const text = value => ({ type: "textLiteral", value });
const range = name => ({ type: "rangeRef", scope: "crossSheet", name });
const pair = (name = "Statuses", value = "Open") => ({ range: range(name), criterion: { operator: "=", value: text(value) } });
function config(fields, extra = {}) {
  return { id: "syntheticStructured", inputContract: "structured-v1", builderKey: "criteriaAggregate", builderOptions: { functionName: "COUNTIFS" }, explanation: "Test fixture", fields, ...extra };
}
function descriptor(calls = []) {
  return {
    validateOptions(options) {
      calls.push("options");
      if (!options || options.functionName !== "COUNTIFS" || Object.keys(options).length !== 1) throw new TypeError("Fixture configuration: COUNTIFS required.");
    },
    validate() { calls.push("validate"); return []; },
    build(values, options, primitives) {
      calls.push("build");
      return primitives.renderFunctionCall(options.functionName, primitives.renderCriteriaPairs(values.criteria));
    }
  };
}
function loadValidation() {
  const context = vm.createContext({ Date: undefined });
  for (const name of ["formula-primitives", "formula-validation"]) loadFormulaScript(context, name);
  return context.SmartsheetFormulaBuilder;
}
function loadStructured(fixture, definitions) {
  const context = vm.createContext({ Date: undefined });
  for (const name of ["formula-catalog", "formula-utils", "formula-primitives", "formula-validation", "formula-guidance", "formula-common-builders"]) loadFormulaScript(context, name);
  const core = context.SmartsheetFormulaBuilder;
  // Dependency replacement is confined to this private VM before engine loading.
  core.catalog = { ...core.catalog, [fixture.id]: fixture };
  core.commonBuilders = { ...core.commonBuilders, registry: core.commonBuilders.createRegistry(definitions) };
  loadFormulaScript(context, "formula-engine");
  return { core, context };
}
module.exports = { plain, number, text, range, pair, config, descriptor, loadValidation, loadStructured };
