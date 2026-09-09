const assert = require("node:assert/strict");
const test = require("node:test");
const { legacyFixtures, generalizedFixtures, currentLegacyFixtures } = require("./helpers/formula-expectations");
const { loadFormulaCore } = require("./helpers/load-formula-core");
const core = loadFormulaCore();
const plain = value => JSON.parse(JSON.stringify(value));

test("generalization preserves every legacy explicit-input formula and validation result", () => {
  assert.equal(legacyFixtures.cases.length, 217);
  for (const entry of legacyFixtures.cases) {
    const actual = core.generateFormula(entry.formulaType, entry.rawValues);
    assert.equal(actual.formula, entry.expected.formula, entry.name);
    assert.deepEqual(plain(actual.values), entry.expected.values, entry.name);
    assert.deepEqual(plain(actual.references), entry.expected.references, entry.name);
    assert.deepEqual(plain(actual.validationErrors), entry.expected.validationErrors, entry.name);
    assert.deepEqual(Array.from(actual.missingFields, field => field.id), entry.expected.missingFields.map(field => field.id), entry.name);
  }
  for (const changes of Object.values(generalizedFixtures.legacyGuidance)) {
    assert.ok(Object.keys(changes).every(key => ["setupNotes", "instructions"].includes(key)));
  }
  assert.deepEqual(currentLegacyFixtures.cases.map(entry => entry.rawValues), legacyFixtures.cases.map(entry => entry.rawValues));
  assert.deepEqual(currentLegacyFixtures.cases.map(entry => entry.expected.formula), legacyFixtures.cases.map(entry => entry.expected.formula));
});

test("all formula IDs, field order and types, option values, and formula configuration remain unchanged", () => {
  assert.deepEqual(Object.keys(core.catalog), legacyFixtures.catalog.map(config => config.id));
  const contract = config => config.fields.map(field => ({id: field.id, type: field.type || "text", options: field.options?.map(option => option.value)}));
  for (const config of legacyFixtures.catalog) {
    assert.deepEqual(plain(contract(core.catalog[config.id])), plain(contract(config)), config.id);
  }
  assert.equal(core.configuration.maxLocationWordsToCheck, 6);
  assert.deepEqual(Array.from(core.configuration.monthNameSortValues, month => month.name), [
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
  ]);
  assert.deepEqual(Array.from(core.configuration.monthNameSortValues, month => month.value), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("reviewed new defaults cover exactly all 44 selectable combinations across 26 types", () => {
  const combinations = [];
  for (const config of Object.values(core.catalog)) {
    let values = [Object.fromEntries(config.fields.map(field => [field.id, field.defaultValue]))];
    for (const field of config.fields.filter(field => field.options)) {
      values = values.flatMap(value => Array.from(field.options, option => ({...value, [field.id]: option.value})));
    }
    combinations.push(...values.map(rawValues => ({formulaType: config.id, rawValues})));
  }
  assert.equal(generalizedFixtures.cases.length, 44);
  assert.equal(new Set(generalizedFixtures.cases.map(entry => entry.formulaType)).size, 26);
  assert.deepEqual(combinations, generalizedFixtures.cases.map(({formulaType, rawValues}) => ({formulaType, rawValues})));
  const changed = Object.values(core.catalog).filter(config => {
    const old = legacyFixtures.catalog.find(old => old.id === config.id);
    return config.fields.some((field, index) => field.defaultValue !== old.fields[index].defaultValue);
  }).map(config => config.id);
  assert.deepEqual(changed, [
    "appendFinishDateLabel", "twoCriteriaLookup", "checkboxMatch", "rioIdLookup", "buildMilestoneId",
    "shortenLocationName", "countCheckboxValues", "monthNameSortNumber", "spendDateAttribute",
    "countRowsMultipleCriteria", "sumValuesMultipleCriteria", "averageValuesMultipleCriteria", "uniqueCountCriteria"
  ]);
});

test("five approved categories cover the catalog with capability-oriented search keywords", () => {
  assert.deepEqual(plain(core.categories), generalizedFixtures.categories);
  assert.deepEqual(Array.from(core.categories, category => category.label), [
    "Text & labels", "Dates & status", "Lookups & matching", "Counts & calculations", "Row hierarchy"
  ]);
  assert.equal(new Set(core.categories.map(category => category.id)).size, 5);
  const ids = new Set(core.categories.map(category => category.id));
  const formulaIds = Object.keys(core.catalog);
  for (const config of Object.values(core.catalog)) {
    assert.ok(ids.has(config.categoryId), config.id);
    assert.ok(config.keywords.length > 0);
    assert.equal(new Set(config.keywords.map(keyword => keyword.toLowerCase())).size, config.keywords.length);
    for (const keyword of config.keywords) {
      assert.ok(keyword.trim());
      assert.ok(!formulaIds.some(id => keyword.toLowerCase().includes(id.toLowerCase())));
    }
  }
  assert.deepEqual(Array.from(core.categories, category => Object.values(core.catalog).filter(config => config.categoryId === category.id).length), [6, 5, 6, 6, 3]);
});

test("default user-facing copy and search metadata contain no organization-specific terminology", () => {
  const prohibited = /\brio\b|risk,? issue,? (?:or|and) opportunity|hold kick-off|first month budgeted|renovation|master schedule|project.controls? teams|project-control helper/i;
  for (const config of Object.values(core.catalog)) {
    const strings = [config.label, config.explanation, ...config.keywords];
    for (const field of config.fields) strings.push(field.label, field.defaultValue, field.help, ...(field.options || []).map(option => option.label));
    const values = Object.fromEntries(config.fields.map(field => [field.id, field.defaultValue]));
    const guidance = core.guidance.getGuidance(config.id, values);
    strings.push(...guidance.setupNotes, ...guidance.instructions, ...guidance.references.flatMap(reference => [reference.name, reference.sheet, reference.range]));
    for (const text of strings) assert.doesNotMatch(text, prohibited, config.id);
  }
});

test("specialized templates disclose existing limits and retain their fixed behavior", () => {
  assert.equal(core.catalog.rioIdLookup.label, "Cross-Sheet First-Match Lookup");
  assert.equal(core.catalog.buildMilestoneId.label, "Combine Three Columns into Text");
  assert.match(core.catalog.shortenLocationName.label, /First 6 Words/);
  assert.match(core.catalog.shortenLocationName.explanation, /longest word.*first six/);
  assert.match(core.catalog.shortenLocationName.explanation, /earliest/);
  assert.match(core.catalog.multiLineReportLabel.explanation, /Task Lead:.*Task Second:.*Task Third:/);
  const taskCase = generalizedFixtures.cases.find(entry => entry.formulaType === "multiLineReportLabel");
  const oldTaskCase = legacyFixtures.cases.find(entry => entry.formulaType === "multiLineReportLabel");
  assert.equal(taskCase.expected.formula, oldTaskCase.expected.formula);
  assert.match(taskCase.expected.setupNotes.join(" "), /All five column names are required/);
  assert.match(core.catalog.spendDateAttribute.explanation, /checked rows.*preferred date.*fallback date/i);
  assert.match(core.catalog.readyToStartBasedOnPredecessors.explanation, /does not calculate predecessor relationships/);
});
