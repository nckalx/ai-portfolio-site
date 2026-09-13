const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const availabilityFixture = require("./fixtures/formula-availability.json");
const context = vm.createContext({});
const core = loadFormulaCore(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../extensions/formula-builder/formula-discovery.js"), "utf8"), context);
const find = (query, category) => Array.from(context.FormulaDiscovery.findFormulas(core.catalog, core.categories, query, category), config => config.id);
const visible = Object.entries(availabilityFixture).filter(([, config]) => config.availability.extension).map(([id]) => id);

test("extension discovery preserves order and excludes exactly two formulas without changing the catalog", () => {
  assert.equal(Object.keys(core.catalog).length, 26);
  assert.equal(find().length, 24);
  assert.deepEqual(find(), visible);
  assert.deepEqual(find("Multi-Line Task Assignment Label"), []);
  assert.deepEqual(find("Cross-Sheet First-Match Lookup"), []);
});

test("all five category filters preserve catalog order and combine with search", () => {
  for (const category of core.categories) {
    const expected = visible.filter(id => core.catalog[id].categoryId === category.id);
    assert.deepEqual(find("", category.id), expected);
    assert.deepEqual(find(category.label, category.id), expected);
    assert.deepEqual(find("lookup", category.id), find("lookup").filter(id => expected.includes(id)));
  }
  assert.deepEqual(find("", "unknown"), []);
});

test("discovery searches every canonical keyword with case and whitespace normalization", () => {
  for (const id of visible) {
    for (const keyword of core.catalog[id].keywords) {
      assert.ok(find(`  ${keyword.toUpperCase().replace(/ /g, "  \t")} \n`).includes(id), `${id}: ${keyword}`);
    }
    assert.deepEqual(find(id), [], "internal formula IDs are not search terms");
  }
});

test("empty queries clear search, empty results are deterministic, and filtering does not mutate input", () => {
  const before = JSON.stringify(core);
  assert.deepEqual(find(" \n\t "), visible);
  assert.deepEqual(find("no-such-formula-xyz"), []);
  assert.deepEqual(find("count checkbox"), find("CHECKBOX count"));
  assert.equal(JSON.stringify(core), before);
});

test("synthetic discovery requires explicit true and follows metadata rather than IDs or library", () => {
  const entry = (id, availability) => Object.freeze({
    id, label: "Synthetic formula", explanation: "Synthetic description", categoryId: "synthetic",
    libraryId: "future-library", keywords: Object.freeze(["synthetic"]),
    ...(availability === undefined ? {} : { availability: Object.freeze(availability) })
  });
  const catalog = Object.freeze({
    disabled: entry("appendFinishDateLabel", { extension: false, portfolio: true }),
    missing: entry("missing"),
    missingProperty: entry("missingProperty", { portfolio: true }),
    string: entry("string", { extension: "true" }),
    number: entry("number", { extension: 1 }),
    object: entry("object", { extension: {} }),
    enabled: entry("enabled", { extension: true, portfolio: false }),
    hiddenLabel: entry("multiLineReportLabel", { extension: true }),
    hiddenLookup: entry("rioIdLookup", { extension: true })
  });
  const before = JSON.stringify(catalog);
  const matches = context.FormulaDiscovery.findFormulas(catalog, [{ id: "synthetic", label: "Synthetic" }]);
  assert.deepEqual(Array.from(matches, config => config.id), ["enabled", "multiLineReportLabel", "rioIdLookup"]);
  assert.equal(matches[0], catalog.enabled);
  assert.equal(matches[1], catalog.hiddenLabel);
  assert.equal(matches[2], catalog.hiddenLookup);
  assert.equal(JSON.stringify(catalog), before);
});
