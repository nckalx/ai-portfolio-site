const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const availabilityFixture = require("./fixtures/formula-availability.json");
const { discoveryFixture, deepFreeze } = require("./helpers/formula-discovery-fixtures");
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

test("synthetic discovery requires explicit true and follows metadata rather than an ID blacklist", () => {
  const entry = (id, availability) => Object.freeze({
    id, label: "Synthetic formula", explanation: "Synthetic description", categoryId: "synthetic",
    libraryId: "advanced", keywords: Object.freeze(["synthetic"]),
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

const ids = entries => Array.from(entries, entry => entry.id);
const discover = (fixture, query = "", category = "", library = "advanced") =>
  context.FormulaDiscovery.findFormulas(fixture.catalog, fixture.categories, query, category, library);
const resolve = (fixture, state) => context.FormulaDiscovery.resolveDiscoveryState(fixture.catalog, fixture.categories, state);
const plain = value => JSON.parse(JSON.stringify(value));

test("production resolver retains Advanced, all five categories, and no Common availability", () => {
  const state = resolve(core);
  assert.equal(state.libraryId, "advanced");
  assert.equal(state.categoryId, "");
  assert.deepEqual(Array.from(state.availableLibraries), ["advanced"]);
  assert.equal(state.availableCategories.length, 5);
  assert.deepEqual(ids(state.availableCategories), ids(core.categories));
});

test("mixed discovery preserves interleaved catalog order and original objects without mutation", () => {
  const fixture = deepFreeze(discoveryFixture());
  const before = JSON.stringify(fixture);
  for (const [library, expected] of [
    ["advanced", ["advancedRow", "advancedText", "advancedCount"]],
    ["common", ["commonCount", "commonText", "commonLogic"]]
  ]) {
    const matches = discover(fixture, "", "", library);
    assert.deepEqual(ids(matches), expected);
    matches.forEach(entry => assert.equal(entry, fixture.catalog[entry.id]));
    assert.deepEqual(ids(discover(fixture, "  SHARED \t example \n", "", library)), expected);
    assert.deepEqual(ids(discover(fixture, "apt", "text-labels", library)), [library + "Text"]);
    for (const id of expected) assert.deepEqual(ids(discover(fixture, id, "", library)), []);
    resolve(fixture, { libraryId: library });
  }
  assert.equal(JSON.stringify(fixture), before);
});

test("surface, library, category, and every query term intersect without ranking", () => {
  const fixture = discoveryFixture();
  fixture.catalog.hidden = { ...fixture.catalog.commonCount, id: "hidden", availability: { extension: false } };
  deepFreeze(fixture);
  assert.deepEqual(ids(discover(fixture, " SHARED  tally counts ", "counts-calculations", "common")), ["commonCount"]);
  assert.deepEqual(ids(discover(fixture, "shared caption", "counts-calculations", "common")), []);
  assert.deepEqual(ids(discover(fixture, "tally", "counts-calculations")), ["advancedCount"]);
});

test("search indexes only label, explanation, category label, and keywords", () => {
  const fixture = discoveryFixture();
  Object.assign(fixture.catalog.commonText, {
    aliases: ["aliasneedle"], functionNames: ["functionneedle"],
    fields: [{ defaultValue: "defaultneedle" }]
  });
  deepFreeze(fixture);
  for (const query of ["aliasneedle", "functionneedle", "defaultneedle", "commonText"]) {
    assert.deepEqual(ids(discover(fixture, query, "", "common")), []);
  }
  for (const query of ["phrase", "discovery", "labels", "caption"]) {
    assert.ok(ids(discover(fixture, query, "", "common")).includes("commonText"));
  }
});

test("resolver preserves canonical category order and ignores searches with zero results", () => {
  const fixture = deepFreeze(discoveryFixture());
  const state = resolve(fixture, { libraryId: "common", categoryId: "text-labels" });
  assert.deepEqual(Array.from(state.availableLibraries), ["advanced", "common"]);
  assert.deepEqual(ids(state.availableCategories), ["text-labels", "counts-calculations", "logic-conditions"]);
  state.availableCategories.forEach(entry => assert.equal(entry, fixture.categories.find(category => category.id === entry.id)));
  assert.deepEqual(ids(discover(fixture, "no-results", state.categoryId, state.libraryId)), []);
  assert.deepEqual(plain(resolve(fixture, state)), plain(state));
  assert.deepEqual(ids(resolve(fixture).availableCategories), ["text-labels", "counts-calculations", "row-hierarchy"]);
});

test("category switches preserve shared categories, reset unavailable ones, and keep no per-library memory", () => {
  const fixture = deepFreeze(discoveryFixture());
  let state = resolve(fixture, { categoryId: "text-labels" });
  state = resolve(fixture, { ...state, libraryId: "common" });
  assert.equal(state.categoryId, "text-labels");
  state = resolve(fixture, { libraryId: "advanced", categoryId: "row-hierarchy" });
  assert.equal(state.categoryId, "row-hierarchy");
  state = resolve(fixture, { ...state, libraryId: "common" });
  assert.equal(state.categoryId, "");
  state = resolve(fixture, { ...state, libraryId: "advanced" });
  assert.equal(state.categoryId, "");
  for (const categoryId of ["unknown", "dates-status", null, 1, {}, " TEXT-LABELS "]) {
    assert.equal(resolve(fixture, { categoryId }).categoryId, "");
  }
});

for (const libraryId of [undefined, null, false, 1, {}, ["advanced"], new String("advanced"), "", "future", "Advanced", " advanced", "common "]) {
  test(`malformed entry library is excluded and invalid selected library recovers: ${String(libraryId)}`, () => {
    const fixture = discoveryFixture();
    const invalid = { ...fixture.catalog.commonLogic, libraryId };
    if (libraryId === undefined) delete invalid.libraryId;
    fixture.catalog = { invalid };
    deepFreeze(fixture);
    assert.deepEqual(ids(discover(fixture)), []);
    assert.deepEqual(ids(discover(fixture, "", "", "common")), []);
    assert.deepEqual(plain(resolve(fixture)), { libraryId: null, categoryId: "", availableLibraries: [], availableCategories: [] });
    const mixed = deepFreeze(discoveryFixture());
    assert.equal(resolve(mixed, { libraryId }).libraryId, "advanced");
    // undefined uses the API's approved default; all explicit invalid values are strict.
    if (libraryId !== undefined) assert.deepEqual(ids(discover(mixed, "", "", libraryId)), []);
  });
}

for (const library of ["advanced", "common"]) {
  test(`${library}-only state recovers from an empty or unknown selection`, () => {
    const fixture = discoveryFixture();
    fixture.catalog = Object.fromEntries(Object.entries(fixture.catalog).filter(([, entry]) => entry.libraryId === library));
    deepFreeze(fixture);
    for (const selected of ["advanced", "common", "unknown", null]) {
      const state = resolve(fixture, { libraryId: selected, categoryId: "text-labels" });
      assert.equal(state.libraryId, library);
      assert.equal(state.categoryId, "text-labels");
      assert.deepEqual(Array.from(state.availableLibraries), [library]);
    }
    assert.deepEqual(ids(discover(fixture, "", "", library === "common" ? "advanced" : "common")), []);
  });
}

test("empty and surface-hidden catalogs contribute no libraries or categories", () => {
  for (const availability of [undefined, null, false, "true", {}, { extension: false }, { extension: "true" }, { extension: 1 }, { extension: {} }]) {
    const fixture = discoveryFixture();
    Object.values(fixture.catalog).forEach(entry => { entry.availability = availability; });
    deepFreeze(fixture);
    for (const library of ["advanced", "common"]) assert.deepEqual(ids(discover(fixture, "", "", library)), []);
    assert.deepEqual(plain(resolve(fixture, { libraryId: "common", categoryId: "text-labels" })),
      { libraryId: null, categoryId: "", availableLibraries: [], availableCategories: [] });
  }
  assert.equal(resolve({ catalog: {}, categories: [] }).libraryId, null);
  const fixture = discoveryFixture();
  Object.values(fixture.catalog).forEach(entry => {
    if (entry.libraryId === "common" || entry.categoryId === "row-hierarchy") entry.availability.extension = false;
  });
  deepFreeze(fixture);
  assert.deepEqual(Array.from(resolve(fixture).availableLibraries), ["advanced"]);
  assert.deepEqual(ids(resolve(fixture).availableCategories), ["text-labels", "counts-calculations"]);
});

test("direct discovery rejects unknown categories even if an entry has that category ID", () => {
  const fixture = discoveryFixture();
  fixture.catalog.commonText.categoryId = "unknown";
  deepFreeze(fixture);
  assert.deepEqual(ids(discover(fixture, "", "unknown", "common")), []);
  assert.equal(resolve(fixture, { libraryId: "common", categoryId: "unknown" }).categoryId, "");
});
