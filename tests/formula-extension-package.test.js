const commonGuidance = require("./fixtures/formula-common-guidance.json");
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { packageExtension, packageFiles } = require("../scripts/package-formula-builder");
const { coreScripts } = require("./helpers/load-formula-core");
const { generalizedFixtures, currentLegacyFixtures } = require("./helpers/formula-expectations");
const batch1 = require("./fixtures/formula-common-batch1-cases.json");
const batch2 = require("./fixtures/formula-common-batch2-cases.json");
const batch3 = require("./fixtures/formula-common-batch3-cases.json");
const batch4 = require("./fixtures/formula-common-batch4-cases.json");
const batch5 = require("./fixtures/formula-common-batch5-cases.json");
const root = path.resolve(__dirname, "..");

test("packaged UI sorts, restores raw work and clears only workspace storage", async t => {
  const { setupExtension } = require("./helpers/formula-extension-dom");
  const { descendants, structuredControl, editStructured } = require("./helpers/formula-structured-ui-fixtures");
  const directory = packageExtension(temporaryPackage(t));
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const p = setupExtension({}, { saved: "dark" }, () => {}, () => {}, { directory, store: { sentinel: "keep" } });
  p.get("library-common").checked = true; p.get("library-common").dispatch("change");
  assert.deepEqual(p.choices().map(b => p.get(b.getAttribute("aria-labelledby")).textContent), ["ABS", "AND — Check Whether All Conditions Are True", "AVG", "CEILING", "Checkbox When Value Matches", "Combine Two Columns with Separator", "CONTAINS", "COUNT", "COUNTM", "DATE", "FIND", "Flag Duplicate Values", "FLOOR", "IF — Return a Value Based on a Condition", "INT", "ISBLANK", "LEFT", "LEN", "LOWER", "MAX", "MEDIAN", "MID", "MIN", "NOT — Reverse a True/False Condition", "OR — Check Whether Any Condition Is True", "REPLACE", "Return Text When Value Matches", "RIGHT", "ROUND", "ROUNDDOWN", "ROUNDUP", "SUBSTITUTE", "SUM", "TODAY", "UPPER", "VALUE"]);
  p.choose("sumValues"); descendants(p.get("fields")).find(n => n.textContent === "Add Value" && n.tagName === "button").dispatch("click");
  editStructured(p, "Value 1 type", "number"); editStructured(p, "Number", "0001.2300"); await tick();
  const q = setupExtension({}, {}, () => {}, () => {}, { directory, store: p.store });
  assert.equal(structuredControl(q, "Number").value, "0001.2300"); assert.equal(q.get("formula-output").value, "=SUM(1.23)");
  q.get("clear-work").dispatch("click"); await tick();
  assert.equal(q.get("library-advanced").checked, true); assert.equal(q.get("build-view").hidden, true);
  assert.deepEqual(q.store, { sentinel: "keep", theme: "dark" });
  assert.deepEqual(q.storageRemovals, ["formulaBuilderWorkspace"]);
});

function temporaryPackage(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "formula-extension-test-"));
  // This exact directory was allocated by this test; never clean user-supplied paths.
  t.after(() => fs.rmSync(directory, { recursive: true }));
  return directory;
}

test("copy-only package has exactly the allowlisted files and byte-identical canonical sources", t => {
  const directory = temporaryPackage(t);
  assert.equal(packageExtension(directory), directory);
  const files = fs.readdirSync(directory, { recursive: true }).filter(file => fs.statSync(path.join(directory, file)).isFile()).map(file => file.replaceAll("\\", "/")).sort();
  const expected = ["manifest.json", "service-worker.js", "sidepanel.html", "sidepanel.css", "sidepanel.js", "formula-discovery.js", "structured-fields.js", "theme.js",
    ...[16, 24, 32, 48, 128].map(size => `icons/icon-${size}.png`), ...coreScripts.map(name => `core/${name}.js`)].sort();
  assert.deepEqual(files, expected);
  assert.equal(files.length, 20);
  assert.ok(!files.some(file => /test|fixture/i.test(file)));
  assert.ok(!files.some(file => file.includes("source/") || file.includes("master")));
  for (const file of packageFiles) {
    assert.ok(fs.readFileSync(path.join(directory, file.target)).equals(fs.readFileSync(path.join(root, file.source))), file.target);
  }
  packageExtension(directory);
  for (const file of packageFiles) assert.ok(fs.readFileSync(path.join(directory, file.target)).equals(fs.readFileSync(path.join(root, file.source))));
  const context = vm.createContext({});
  for (const name of coreScripts) vm.runInContext(fs.readFileSync(path.join(directory, `core/${name}.js`), "utf8"), context);
  assert.equal(Object.keys(context.SmartsheetFormulaBuilder.catalog).length, 62);
  assert.equal(Object.values(context.SmartsheetFormulaBuilder.catalog).filter(config => config.libraryId === "advanced" && !config.inputContract).length, 26);
  assert.ok(Object.isFrozen(context.SmartsheetFormulaBuilder.commonBuilders.registry));
  assert.deepEqual(Object.keys(context.SmartsheetFormulaBuilder.commonBuilders.registry), ["decimalRounding", "multipleRounding", "unaryNumeric", "textSlice", "textUnary", "textSearch", "textReplace", "todayOffset", "dateConstructor", "booleanTest", "variadicAggregate", "comparisonReturn", "duplicateFlag", "textCombine", "booleanGroup"]);
  for (const entry of generalizedFixtures.cases) {
    assert.equal(context.SmartsheetFormulaBuilder.generateFormula(entry.formulaType, entry.rawValues).formula, entry.expected.formula);
    assert.deepEqual(JSON.parse(JSON.stringify(context.SmartsheetFormulaBuilder.generateFormula(entry.formulaType, entry.rawValues))), entry.expected);
  }
  for (const entry of currentLegacyFixtures.cases) {
    assert.deepEqual(JSON.parse(JSON.stringify(context.SmartsheetFormulaBuilder.generateFormula(entry.formulaType, entry.rawValues))), entry.expected);
  }
  assert.deepEqual(Object.values(context.SmartsheetFormulaBuilder.catalog).filter(config => config.libraryId === "common").map(config => config.id), [...batch1.formulas, ...batch2.formulas, ...batch3.formulas, ...batch4.formulas, ...batch5.formulas].map(config => config.id));
  for (const batch of [batch1, batch2, batch3, batch4, batch5]) for (const entry of batch.cases) {
    assert.deepEqual(JSON.parse(JSON.stringify(context.SmartsheetFormulaBuilder.generateFormula(entry.formulaType, entry.rawValues))), {
      formulaType: entry.formulaType, explanation: batch.formulas.find(config => config.id === entry.formulaType).explanation,
      ...entry.expected, missingFields: [], ...commonGuidance[entry.formulaType]
    }, `${entry.formulaType}: ${entry.name}`);
  }
});

test("packager refuses unexpected output entries without deleting or overwriting them", t => {
  const directory = temporaryPackage(t);
  fs.writeFileSync(path.join(directory, "notes.txt"), "keep me");
  assert.throws(() => packageExtension(directory), /Unexpected package entry/);
  assert.equal(fs.readFileSync(path.join(directory, "notes.txt"), "utf8"), "keep me");
  assert.equal(fs.existsSync(path.join(directory, "manifest.json")), false);
});

test("manifest uses only sidePanel and storage permissions and resolves all local resources under the package", t => {
  const directory = packageExtension(temporaryPackage(t));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["sidePanel", "storage"]);
  assert.equal(manifest.minimum_chrome_version, "114");
  assert.deepEqual(Object.keys(manifest).sort(), ["manifest_version", "name", "version", "description", "minimum_chrome_version", "permissions", "background", "action", "side_panel", "icons"].sort());
  assert.deepEqual(manifest.action, {
    default_title: "Open Formula Builder",
    default_icon: {
      "16": "icons/icon-16.png",
      "24": "icons/icon-24.png",
      "32": "icons/icon-32.png"
    }
  });
  assert.deepEqual(manifest.icons, {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  });
  assert.deepEqual(manifest.background, { service_worker: "service-worker.js" });
  assert.deepEqual(manifest.side_panel, { default_path: "sidepanel.html" });
  const html = fs.readFileSync(path.join(directory, manifest.side_panel.default_path), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["theme.js", ...coreScripts.map(name => `core/${name}.js`), "formula-discovery.js", "structured-fields.js", "sidepanel.js"]);
  assert.ok(html.indexOf('<script src="theme.js">') < html.indexOf("<body>"));
  assert.equal((html.match(/<script/g) || []).length, scripts.length);
  assert.doesNotMatch(html, /\son\w+=|<style\b|style=|https?:\/\//i);
  const resources = [...scripts, ...html.matchAll(/href="([^"]+)"/g)].map(value => typeof value === "string" ? value : value[1]);
  resources.push(manifest.background.service_worker, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon));
  for (const resource of resources) {
    assert.ok(!resource.includes("..") && !path.isAbsolute(resource));
    assert.ok(fs.statSync(path.join(directory, resource)).isFile(), resource);
  }
  for (const [size, file] of Object.entries({ ...manifest.icons, ...manifest.action.default_icon })) {
    const png = fs.readFileSync(path.join(directory, file));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
});

for (const rejected of [false, true]) {
  test(`worker configures toolbar side panel and handles rejection: ${rejected}`, async () => {
    const calls = [], errors = [];
    const context = vm.createContext({
      chrome: { sidePanel: { setPanelBehavior(options) { calls.push(options); return rejected ? Promise.reject(new Error("unavailable")) : Promise.resolve(); } } },
      console: { error: (...args) => errors.push(args) }
    });
    vm.runInContext(fs.readFileSync(path.join(root, "extensions/formula-builder/service-worker.js"), "utf8"), context);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ openPanelOnActionClick: true }]);
    assert.equal(errors.length, rejected ? 1 : 0);
  });
}
