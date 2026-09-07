const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fixtures = require("./fixtures/formula-builder-cases.json");
const { loadFormulaCore, loadFormulaScript, coreScripts } = require("./helpers/load-formula-core");
const plain = value => JSON.parse(JSON.stringify(value));
const core = loadFormulaCore();

test("catalog preserves all original metadata and valid defaults in dropdown order", () => {
  assert.deepEqual(plain(Object.values(core.catalog).map(({ validationRule, ...entry }) => entry)), fixtures.catalog);
  const fieldIds = new Set();
  let combinations = 0;
  for (const [id, config] of Object.entries(core.catalog)) {
    assert.equal(config.id, id);
    combinations += config.fields.reduce((count, field) => count * (field.options?.length || 1), 1);
    for (const field of config.fields) {
      assert.ok(!fieldIds.has(field.id), `Duplicate field ID: ${field.id}`);
      fieldIds.add(field.id);
      assert.equal(typeof field.defaultValue, "string");
      if (field.options) {
        assert.ok(field.options.some(option => option.value === field.defaultValue));
        assert.equal(new Set(field.options.map(option => option.value)).size, field.options.length);
      }
    }
  }
  assert.equal(combinations, 44);
  assert.deepEqual(Object.values(core.catalog).filter(config => config.validationRule).map(config => config.id), ["rankedValue"]);
});

test("core loads and generates without browser globals, timers, or network access", () => {
  const context = vm.createContext({});
  const isolated = loadFormulaCore(context);
  for (const name of ["window", "document", "navigator", "chrome", "fetch", "setTimeout"]) {
    assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
  }
  for (const entry of fixtures.cases.filter(entry => entry.kind === "default")) {
    assert.equal(isolated.generateFormula(entry.formulaType, entry.rawValues).formula, entry.expected.formula);
  }
});

test("utilities load independently of catalog and receive the location word limit explicitly", () => {
  const context = vm.createContext({});
  loadFormulaScript(context, "formula-utils");
  const { utils, catalog } = context.SmartsheetFormulaBuilder;
  assert.equal(catalog, undefined);
  assert.equal(utils.rowColumn("  Task Name  "), "[Task Name]@row");
  assert.equal(utils.sheetReference("  {{{ Source Range }}}  "), "{Source Range}");
  assert.equal(utils.sheetReference("{}"), "{}");
  assert.equal(utils.sheetReference("A{B}C"), "{A{B}C}");
  assert.equal(utils.smartsheetText('Owner "North"'), '"Owner ""North"""');
  assert.equal(utils.smartsheetText(" spaced "), '" spaced "');
  assert.equal(utils.nestedEqualsFormula("X", [{ match: "A", result: "1" }, { match: "B", result: "2" }], '""'), 'IF(X = "A", 1, IF(X = "B", 2, ""))');
  assert.equal(utils.nestedEqualsFormula("X", [], "0"), "0");
  assert.equal(utils.locationWordFormula("X", 1), 'TRIM(MID(SUBSTITUTE(X, " ", REPT(" ", LEN(X))), 1, LEN(X)))');
  assert.equal(utils.locationWordFormula("X", 2), 'TRIM(MID(SUBSTITUTE(X, " ", REPT(" ", LEN(X))), 1 * LEN(X) + 1, LEN(X)))');
  const first = utils.locationWordFormula("TRIM([Location]@row)", 1);
  const second = utils.locationWordFormula("TRIM([Location]@row)", 2);
  assert.equal(utils.longestLocationWordFormula("Location", 1), first);
  assert.equal(utils.longestLocationWordFormula("Location", 2), `IF(LEN(${first}) = MAX(LEN(${first}), LEN(${second})), ${first}, ${second})`);
});

test("normalization trims every field without filling blanks or modifying inputs", () => {
  for (const config of Object.values(core.catalog)) {
    const raw = Object.freeze(Object.fromEntries(config.fields.map(field => [field.id, "  value  "])));
    const normalized = core.validation.normalizeValues(config, raw);
    assert.ok(Object.values(normalized).every(value => value === "value"));
    assert.ok(Object.values(raw).every(value => value === "  value  "));
    const empty = Object.fromEntries(config.fields.map(field => [field.id, " \n "]));
    assert.deepEqual(plain(core.validation.getMissingFields(config, core.validation.normalizeValues(config, empty))), plain(config.fields));
  }
});

test("rank validation retains the existing string rule and exact error", () => {
  for (const value of ["1", "3", "999999999999999999999999999999"]) {
    assert.equal(core.validation.isPositiveWholeNumber(value), true);
  }
  for (const value of ["", "0", "-1", "1.5", "01", "+1", "1e2", "abc", " 1 "]) {
    assert.equal(core.validation.isPositiveWholeNumber(value), false);
  }
  assert.deepEqual(plain(core.validation.getValidationErrors(core.catalog.rankedValue, { rankNumber: "0" })), ["Rank number must be a positive whole number."]);
  assert.deepEqual(plain(core.validation.getValidationErrors(core.catalog.appendFinishDateLabel, {})), []);
});

test("guidance independently preserves references, explicit notes, fallbacks, and instructions", () => {
  for (const entry of fixtures.cases) {
    const expected = entry.expected;
    assert.deepEqual(plain(core.guidance.getGuidance(entry.formulaType, expected.values)), {
      references: expected.references, setupNotes: expected.setupNotes, instructions: expected.instructions
    });
  }
});

test("generation leaves frozen catalog, configuration, and supplied values unchanged", () => {
  const isolated = loadFormulaCore();
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  }
  const before = JSON.stringify({ catalog: isolated.catalog, configuration: isolated.configuration });
  freeze(isolated.catalog);
  freeze(isolated.configuration);
  for (const entry of fixtures.cases) isolated.generateFormula(entry.formulaType, Object.freeze({ ...entry.rawValues }));
  assert.equal(JSON.stringify({ catalog: isolated.catalog, configuration: isolated.configuration }), before);
});

test("HTML loads classic scripts in dependency order and has no duplicated formula options", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
  assert.match(html, /<select id="formulaType"><\/select>/);
  let previous = -1;
  for (const name of [...coreScripts, "formula-builder-ui"]) {
    const tag = `<script src="js/formula-builder/${name}.js"></script>`;
    const position = html.indexOf(tag);
    assert.ok(position > previous, `${name} must load after its dependencies`);
    assert.equal(html.indexOf(tag, position + tag.length), -1);
    previous = position;
  }
});
