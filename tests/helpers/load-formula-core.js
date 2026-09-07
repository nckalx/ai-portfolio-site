const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const coreScripts = [
  "formula-catalog", "formula-utils", "formula-validation", "formula-guidance", "formula-engine"
];

function loadFormulaScript(context, name) {
  const filename = path.resolve(__dirname, `../../js/formula-builder/${name}.js`);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}

// Each test gets an isolated runtime with no browser globals or require shim.
function loadFormulaCore(context = vm.createContext({})) {
  coreScripts.forEach(name => loadFormulaScript(context, name));
  return context.SmartsheetFormulaBuilder;
}

module.exports = { loadFormulaCore, loadFormulaScript, coreScripts };
