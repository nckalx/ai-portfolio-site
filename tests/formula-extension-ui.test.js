const assert = require("node:assert/strict");
const test = require("node:test");
const { setupExtension } = require("./helpers/formula-extension-dom");
const { generalizedFixtures, currentLegacyFixtures } = require("./helpers/formula-expectations");
const availabilityFixture = require("./fixtures/formula-availability.json");
const { discoveryFixture } = require("./helpers/formula-discovery-fixtures");
const excluded = new Set(["multiLineReportLabel", "rioIdLookup"]);
const tick = () => new Promise(resolve => setImmediate(resolve));

test("polished discovery removes internal branding and exposes named native result buttons", () => {
  const { get, choose, choices } = setupExtension();
  assert.equal(get("find-title").textContent, "Find a formula");
  assert.equal(get("theme-toggle").tagName, "button");
  for (const button of choices()) {
    assert.equal(button.tagName, "button");
    assert.equal(button.type, "button");
    assert.ok(get(button.getAttribute("aria-labelledby")).textContent);
    assert.ok(get(button.getAttribute("aria-describedby")).textContent);
    const chevron = button.children.find(node => node.className === "choice-chevron");
    assert.equal(chevron.getAttribute("aria-hidden"), "true");
  }
  choose("appendFinishDateLabel");
  assert.equal(get("build-view").hidden, false);
  assert.equal(get("find-view").hidden, true);
});

test("panel starts in discovery with canonical categories and exactly 24 choices", () => {
  const { get, core, choices, choose } = setupExtension();
  assert.equal(get("find-view").hidden, false);
  assert.equal(get("build-view").hidden, true);
  assert.equal(get("result-count").textContent, "24 formulas");
  assert.equal(get("clear-filters").disabled, true);
  assert.equal(get("library-selector").hidden, true);
  assert.equal(get("library-advanced").checked, true);
  assert.equal(get("library-common").checked, false);
  assert.equal(core.categories.length, 5);
  const options = get("category").children.filter(child => child.tagName === "option");
  assert.deepEqual(options.map(option => option.value), ["", ...Array.from(core.categories, category => category.id)]);
  assert.equal(choices().length, 24);
  assert.deepEqual(choices().map(button => button.getAttribute("aria-labelledby")),
    Object.entries(availabilityFixture).filter(([, config]) => config.availability.extension).map(([id]) => `choice-${id}`));
  for (const id of excluded) assert.throws(() => choose(id), /not discoverable/);
});

function mixedPanel() {
  return setupExtension({}, {}, core => { Object.assign(core, discoveryFixture()); });
}
const resultIds = panel => panel.choices().map(button => button.getAttribute("aria-labelledby").replace("choice-", ""));
const categoryIds = panel => panel.get("category").children.filter(node => node.tagName === "option").map(node => node.value);
function switchLibrary(panel, library) {
  // Supply the checked change and focus a browser would provide. This double
  // intentionally does not simulate native radio grouping or keyboard behavior.
  const radio = panel.get(`library-${library}`);
  radio.focus();
  radio.checked = true;
  radio.dispatch("change");
}

test("mixed startup exposes labeled native radios, defaults to Advanced, and switches ordered results", async () => {
  const panel = mixedPanel();
  const { get } = panel;
  assert.equal(get("library-selector").hidden, false);
  assert.equal(get("library-selector").tagName, "fieldset");
  assert.equal(get("library-selector").children.find(node => node.tagName === "legend").textContent, "Library");
  for (const id of ["common", "advanced"]) {
    const radio = get(`library-${id}`);
    assert.equal(radio.tagName, "input");
    assert.equal(radio.type, "radio");
    assert.equal(radio.getAttribute("name"), "library");
    assert.equal(radio.value, id);
    assert.equal(radio.parent.tagName, "label");
    assert.equal(radio.parent.getAttribute("for"), radio.id);
    assert.equal(radio.parent.textContent.trim().toLowerCase(), id);
    assert.equal(radio.checked, id === "advanced");
  }
  assert.deepEqual(resultIds(panel), ["advancedRow", "advancedText", "advancedCount"]);
  assert.deepEqual(categoryIds(panel), ["", "text-labels", "counts-calculations", "row-hierarchy"]);
  for (const library of ["common", "advanced"]) {
    switchLibrary(panel, library);
    assert.equal(get(`library-${library}`).checked, true);
    assert.equal(get(`library-${library === "common" ? "advanced" : "common"}`).checked, false);
    assert.equal(panel.document.activeElement, get(`library-${library}`));
    assert.equal(get("result-count").textContent, "3 formulas");
    assert.equal(get("clear-filters").disabled, true);
    assert.deepEqual(resultIds(panel), library === "common"
      ? ["commonCount", "commonText", "commonLogic"] : ["advancedRow", "advancedText", "advancedCount"]);
    assert.deepEqual(categoryIds(panel), ["", "text-labels", "counts-calculations", library === "common" ? "logic-conditions" : "row-hierarchy"]);
  }
  assert.equal(panel.generationCount(), 0);
  await tick();
  assert.deepEqual(panel.storageWrites, []);
});

test("library changes preserve raw search and shared category through singular and zero results", () => {
  const panel = mixedPanel();
  const { get } = panel;
  get("category").value = "text-labels";
  get("category").dispatch("change");
  const raw = "  ShArEd \t CAPtion \n";
  get("search").value = raw;
  get("search").dispatch("input");
  for (const library of ["common", "advanced", "common"]) {
    switchLibrary(panel, library);
    assert.equal(get("search").value, raw);
    assert.equal(get("category").value, "text-labels");
    assert.equal(get("result-count").textContent, "1 formula");
    assert.deepEqual(resultIds(panel), [library + "Text"]);
    assert.equal(panel.document.activeElement, get(`library-${library}`));
  }
  const options = categoryIds(panel);
  get("search").value = "  No Such Result  ";
  get("search").dispatch("input");
  assert.equal(get("result-count").textContent, "0 formulas");
  assert.equal(get("empty-state").hidden, false);
  assert.equal(get("library-selector").hidden, false);
  assert.equal(get("library-common").checked, true);
  assert.deepEqual(categoryIds(panel), options);
  switchLibrary(panel, "advanced");
  assert.equal(get("search").value, "  No Such Result  ");
  assert.equal(get("category").value, "text-labels");
  assert.equal(get("library-selector").hidden, false);
  assert.equal(get("library-advanced").checked, true);
  assert.equal(get("result-count").textContent, "0 formulas");
  assert.equal(panel.generationCount(), 0);
});

test("unavailable category visibly resets and is not remembered on switching back", () => {
  const panel = mixedPanel();
  const { get } = panel;
  get("category").value = "row-hierarchy";
  get("category").dispatch("change");
  assert.deepEqual(resultIds(panel), ["advancedRow"]);
  switchLibrary(panel, "common");
  assert.equal(get("category").value, "");
  assert.equal(get("category").children[0].textContent, "All categories");
  assert.ok(!categoryIds(panel).includes("row-hierarchy"));
  switchLibrary(panel, "advanced");
  assert.equal(get("category").value, "");
  assert.deepEqual(resultIds(panel), ["advancedRow", "advancedText", "advancedCount"]);
  assert.equal(panel.generationCount(), 0);
});

for (const clearId of ["clear-filters", "empty-clear"]) {
  test(`${clearId} clears query/category, retains Common, and focuses search`, () => {
    const panel = mixedPanel();
    const { get } = panel;
    switchLibrary(panel, "common");
    assert.equal(get("clear-filters").disabled, true);
    get("category").value = "text-labels";
    get("category").dispatch("change");
    get("search").value = clearId === "empty-clear" ? "no such result" : "  ShArEd  ";
    get("search").dispatch("input");
    assert.equal(get("clear-filters").disabled, false);
    get(clearId).dispatch("click");
    assert.equal(get("search").value, "");
    assert.equal(get("category").value, "");
    assert.equal(get("library-common").checked, true);
    assert.equal(get("library-advanced").checked, false);
    assert.equal(get("clear-filters").disabled, true);
    assert.equal(get("empty-state").hidden, true);
    assert.equal(get("result-count").textContent, "3 formulas");
    assert.deepEqual(resultIds(panel), ["commonCount", "commonText", "commonLogic"]);
    assert.equal(panel.document.activeElement, get("search"));
    assert.equal(panel.generationCount(), 0);
  });
}

test("search input clearing only clears query and preserves library/category", () => {
  const panel = mixedPanel();
  const { get } = panel;
  switchLibrary(panel, "common");
  get("category").value = "text-labels";
  get("category").dispatch("change");
  get("search").value = "absent";
  get("search").dispatch("input");
  get("search").value = "";
  get("search").dispatch("input");
  assert.equal(get("category").value, "text-labels");
  assert.equal(get("library-common").checked, true);
  assert.deepEqual(resultIds(panel), ["commonText"]);
  assert.equal(get("clear-filters").disabled, false);
  assert.equal(panel.generationCount(), 0);
});

test("invalid UI selection and changing availability recover visibly without changing raw search", () => {
  const panel = mixedPanel();
  const { get, core } = panel;
  get("search").value = " ShArEd ";
  get("category").value = "unknown";
  get("category").dispatch("change");
  assert.equal(get("category").value, "");
  get("library-common").value = "unknown";
  switchLibrary(panel, "common");
  assert.equal(get("library-advanced").checked, true);
  assert.equal(get("library-common").checked, false);
  assert.deepEqual(resultIds(panel), ["advancedRow", "advancedText", "advancedCount"]);
  get("library-common").value = "common";
  Object.values(core.catalog).forEach(entry => {
    if (entry.libraryId === "advanced") entry.availability.extension = false;
  });
  get("search").dispatch("input");
  assert.equal(get("library-selector").hidden, true);
  assert.equal(get("library-common").checked, true);
  assert.deepEqual(resultIds(panel), ["commonCount", "commonText", "commonLogic"]);
  assert.deepEqual(categoryIds(panel), ["", "text-labels", "counts-calculations", "logic-conditions"]);
  Object.values(core.catalog).forEach(entry => { entry.availability.extension = false; });
  get("search").dispatch("input");
  assert.equal(get("library-selector").hidden, true);
  assert.equal(get("library-common").checked, false);
  assert.equal(get("library-advanced").checked, false);
  assert.deepEqual(categoryIds(panel), [""]);
  assert.equal(get("result-count").textContent, "0 formulas");
  assert.equal(get("search").value, " ShArEd ");
  assert.equal(panel.generationCount(), 0);
});

for (const library of ["common", "advanced", null]) {
  test(`single/empty library startup synchronizes hidden selector: ${library}`, () => {
    const panel = setupExtension({}, {}, core => {
      const fixture = discoveryFixture();
      Object.values(fixture.catalog).forEach(entry => { entry.availability.extension = entry.libraryId === library; });
      fixture.catalog.invalid = { ...fixture.catalog.commonLogic, libraryId: "Common", availability: { extension: true } };
      Object.assign(core, fixture);
    });
    assert.equal(panel.get("library-selector").hidden, true);
    for (const id of ["common", "advanced"]) assert.equal(panel.get(`library-${id}`).checked, id === library);
    assert.equal(panel.choices().length, library ? 3 : 0);
    assert.deepEqual(categoryIds(panel), library
      ? ["", "text-labels", "counts-calculations", library === "common" ? "logic-conditions" : "row-hierarchy"] : [""]);
    assert.equal(panel.generationCount(), 0);
  });
}

test("Advanced Build/Back retains Find DOM, library, raw filters, result focus/scroll, and drafts across library switches", () => {
  const panel = setupExtension({}, {}, core => {
    const { catalog } = discoveryFixture();
    // Keep real Advanced builders for navigation; add only discovery-only Common entries.
    Object.values(catalog).filter(entry => entry.libraryId === "common").forEach(entry => { core.catalog[entry.id] = entry; });
  });
  const { get } = panel;
  switchLibrary(panel, "common");
  const generations = panel.generationCount();
  get("search").value = "caption";
  get("search").dispatch("input");
  assert.deepEqual(resultIds(panel), ["commonText"]);
  assert.equal(panel.generationCount(), generations);
  get("clear-filters").dispatch("click");
  switchLibrary(panel, "advanced");
  get("category").value = "text-labels";
  get("category").dispatch("change");
  const raw = "  APPend  date \t";
  get("search").value = raw;
  get("search").dispatch("input");
  get("results-scroll").scrollTop = 123;
  const findView = get("find-view");
  const results = panel.choices();
  const button = panel.choose("appendFinishDateLabel");
  assert.equal(findView.hidden, true);
  assert.equal(panel.document.activeElement, get("build-title"));
  const input = get("field-milestoneLabelColumn");
  input.value = "  Custom Item  ";
  input.dispatch("input");
  const formula = get("formula-output").value;
  get("back").dispatch("click");
  assert.equal(get("find-view"), findView);
  assert.equal(findView.hidden, false);
  assert.deepEqual(panel.choices(), results);
  assert.equal(panel.document.activeElement, button);
  assert.equal(get("results-scroll").scrollTop, 123);
  assert.equal(get("library-advanced").checked, true);
  assert.equal(get("category").value, "text-labels");
  assert.equal(get("search").value, raw);
  const afterBuild = panel.generationCount();
  switchLibrary(panel, "common");
  switchLibrary(panel, "advanced");
  assert.equal(panel.generationCount(), afterBuild);
  panel.choose("appendFinishDateLabel");
  assert.equal(get("field-milestoneLabelColumn").value, "  Custom Item  ");
  assert.equal(get("formula-output").value, formula);
});

test("discovery rendering follows changed availability metadata and can select a normally hidden ID", () => {
  const { get, core, choices, choose } = setupExtension();
  core.catalog.appendFinishDateLabel.availability = { extension: false, portfolio: true };
  delete core.catalog.scheduleMovedWorkdays.availability;
  core.catalog.checkboxMatch.availability = { extension: "true", portfolio: true };
  core.catalog.rioIdLookup.availability = { extension: true, portfolio: true };
  get("search").dispatch("input");
  const expectedIds = currentLegacyFixtures.catalog.map(config => config.id).filter(id =>
    !["appendFinishDateLabel", "scheduleMovedWorkdays", "checkboxMatch", "multiLineReportLabel"].includes(id));
  assert.deepEqual(choices().map(button => button.getAttribute("aria-labelledby")), expectedIds.map(id => `choice-${id}`));
  assert.equal(get("result-count").textContent, "22 formulas");
  for (const id of ["appendFinishDateLabel", "scheduleMovedWorkdays", "checkboxMatch", "multiLineReportLabel"]) {
    assert.throws(() => choose(id), /not discoverable/);
  }
  choose("rioIdLookup");
  assert.equal(get("build-title").textContent, core.catalog.rioIdLookup.label);
  assert.equal(get("formula-output").value, generalizedFixtures.cases.find(entry => entry.formulaType === "rioIdLookup").expected.formula);
  assert.equal(get("copy").disabled, false);
});

test("search/category events update results, and both clear actions reset filters and focus", () => {
  const { get, document, choices } = setupExtension();
  get("category").value = "row-hierarchy";
  get("category").dispatch("change");
  assert.equal(choices().length, 3);
  get("search").value = "unknown xyz";
  get("search").dispatch("input");
  assert.equal(get("result-count").textContent, "0 formulas");
  assert.equal(get("empty-state").hidden, false);
  get("empty-clear").dispatch("click");
  assert.equal(get("category").value, "");
  assert.equal(get("search").value, "");
  assert.equal(get("empty-state").hidden, true);
  assert.equal(choices().length, 24);
  assert.equal(document.activeElement, get("search"));
  get("search").value = "  NTH highest  ";
  get("search").dispatch("input");
  assert.equal(get("result-count").textContent, "1 formula");
  get("clear-filters").dispatch("click");
  assert.equal(choices().length, 24);
});

test("builder renders every discoverable default, option combination, and customized fixture exactly", () => {
  const { get, choose, core } = setupExtension();
  const entries = [...generalizedFixtures.cases, ...currentLegacyFixtures.cases.filter(entry => entry.kind === "custom")];
  const visited = new Set();
  let defaults = 0;
  for (const entry of entries.filter(entry => !excluded.has(entry.formulaType))) {
    choose(entry.formulaType);
    const config = core.catalog[entry.formulaType];
    assert.equal(get("build-title").textContent, config.label);
    assert.equal(get("explanation").textContent, entry.expected.explanation);
    assert.equal(get("fields").children.length, config.fields.length);
    if (!visited.has(config.id)) {
      for (const field of config.fields) assert.equal(get(`field-${field.id}`).value, field.defaultValue);
      const baseline = generalizedFixtures.cases.find(candidate => candidate.formulaType === config.id &&
        config.fields.every(field => candidate.rawValues[field.id] === field.defaultValue));
      assert.equal(get("formula-output").value, baseline.expected.formula);
      visited.add(config.id);
    }
    for (const field of config.fields) {
      const input = get(`field-${field.id}`);
      assert.equal(input.tagName, field.type === "select" ? "select" : "input");
      assert.equal(input.parent.children[0].attributes.for, input.id);
      assert.equal(input.attributes["aria-required"], "true");
      if (field.options) assert.deepEqual(input.children.map(option => [option.value, option.textContent]), Array.from(field.options, option => [option.value, option.label]));
      assert.equal(input.parent.children.at(-1).children.at(-1).textContent, field.help);
      input.value = entry.rawValues[field.id];
      input.dispatch(field.type === "select" ? "change" : "input");
    }
    assert.equal(get("formula-output").value, entry.expected.formula, entry.name);
    assert.equal(get("copy").disabled, false);
    assert.deepEqual(get("setup-notes").children.map(node => node.textContent), entry.expected.setupNotes);
    assert.deepEqual(get("instructions").children.map(node => node.textContent), entry.expected.instructions);
    assert.deepEqual(get("references").children.map(node => node.textContent), entry.expected.references.map(reference =>
      `${core.utils.sheetReference(reference.name)}: in "${reference.sheet}", select the "${reference.range}" column.`));
    get("back").dispatch("click");
    if (generalizedFixtures.cases.includes(entry)) defaults++;
  }
  assert.equal(defaults, 42);
  assert.equal(visited.size, 24);
});

test("blank drafts remain invalid across navigation and cannot copy a previously valid result", async () => {
  const copied = [];
  const { get, choose, core } = setupExtension({ clipboard: { writeText: async text => copied.push(text) } });
  choose("twoCriteriaLookup");
  for (const field of core.catalog.twoCriteriaLookup.fields) {
    const input = get(`field-${field.id}`);
    input.value = " "; input.dispatch("input");
    assert.equal(input.attributes["aria-invalid"], "true");
  }
  get("back").dispatch("click");
  choose("twoCriteriaLookup");
  assert.equal(get("formula-output").value, "");
  assert.equal(get("copy").disabled, true);
  get("copy").dispatch("click"); await tick();
  assert.deepEqual(copied, []);
  for (const field of core.catalog.twoCriteriaLookup.fields) {
    assert.equal(get(`field-${field.id}`).value, " ");
    assert.equal(get(`field-${field.id}`).attributes["aria-invalid"], "true");
  }
});

test("navigation retains raw drafts, filters, result scroll, and returns focus to the chosen formula", () => {
  const { get, choose, document } = setupExtension();
  get("category").value = "text-labels";
  get("category").dispatch("change");
  get("results-scroll").scrollTop = 123;
  const button = choose("appendFinishDateLabel");
  assert.equal(document.activeElement, get("build-title"));
  const input = get("field-milestoneLabelColumn");
  input.value = "  Custom Item  "; input.dispatch("input");
  const formula = get("formula-output").value;
  get("back").dispatch("click");
  assert.equal(document.activeElement, button);
  assert.equal(get("results-scroll").scrollTop, 123);
  assert.equal(get("category").value, "text-labels");
  choose("buildMilestoneId");
  get("back").dispatch("click");
  choose("appendFinishDateLabel");
  assert.equal(get("field-milestoneLabelColumn").value, "  Custom Item  ");
  assert.equal(get("formula-output").value, formula);
  const fresh = setupExtension();
  fresh.choose("appendFinishDateLabel");
  assert.equal(fresh.get("field-milestoneLabelColumn").value, "Item Name");
});

test("live updates keep the input node, focus, and disclosures, while clearing stale copy feedback", () => {
  const { get, choose, document } = setupExtension();
  choose("appendFinishDateLabel");
  const input = get("field-milestoneLabelColumn");
  input.focus();
  get("explanation-details").open = true;
  input.parent.children.at(-1).open = true;
  get("copy-status").textContent = "Formula copied.";
  input.value = "New Column"; input.dispatch("input");
  assert.equal(get("field-milestoneLabelColumn"), input);
  assert.equal(document.activeElement, input);
  assert.equal(get("explanation-details").open, true);
  assert.equal(input.parent.children.at(-1).open, true);
  assert.match(get("formula-output").value, /\[New Column\]@row/);
  assert.equal(get("copy-status").textContent, "");
});

test("validation retains existing missing-field precedence and positive-whole-number rank rule", () => {
  const { get, choose } = setupExtension();
  choose("rankedValue");
  const input = get("field-rankNumber");
  for (const value of ["", "  ", "0", "1.5", "01", "-1"]) {
    input.value = value; input.dispatch("input");
    assert.equal(get("copy").disabled, true);
    assert.equal(get("formula-output").value, "");
    assert.equal(input.attributes["aria-invalid"], "true");
    assert.equal(get("field-rankNumber-error").hidden, false);
    assert.match(get("validation").textContent, value.trim() ? /Rank number must be a positive whole number/ : /Complete these fields/);
  }
  input.value = " 3 "; input.dispatch("input");
  assert.equal(input.attributes["aria-invalid"], "false");
  assert.equal(get("field-rankNumber-error").hidden, true);
  assert.equal(get("copy").disabled, false);
  let prevented = false;
  get("fields-form").dispatch("submit", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});

test("cross-sheet notice opens setup and focuses its summary; user text stays literal", () => {
  const { get, choose, core, document } = setupExtension();
  choose("twoCriteriaLookup");
  assert.equal(get("reference-notice").hidden, false);
  assert.equal(get("setup-details").open, false);
  get("reference-notice").dispatch("click");
  assert.equal(get("setup-details").open, true);
  assert.equal(document.activeElement, get("setup-summary"));
  const field = core.catalog.twoCriteriaLookup.fields.find(field => field.id === "lookupSourceSheetName");
  get(`field-${field.id}`).value = '<img src=x onerror="bad()">';
  get(`field-${field.id}`).dispatch("input");
  assert.match(get("references").textContent, /<img src=x/);
  assert.equal(get("references").children[0].children.length, 0);
  get("back").dispatch("click");
  choose("appendFinishDateLabel");
  assert.equal(get("reference-notice").hidden, true);
});

test("clipboard is invoked synchronously with exact output and success waits for resolution", async () => {
  const copied = [];
  let resolve;
  const { get, choose } = setupExtension({ clipboard: { writeText(text) { copied.push(text); return new Promise(done => { resolve = done; }); } } });
  choose("shortenLocationName");
  const formula = get("formula-output").value;
  get("copy").dispatch("click");
  assert.deepEqual(copied, [formula]);
  assert.equal(get("copy-status").textContent, "Copying…");
  assert.equal(get("copy").disabled, true);
  resolve(); await tick();
  assert.equal(get("copy-status").textContent, "Formula copied.");
  assert.equal(get("copy").disabled, false);
});

for (const reason of ["rejected", "unavailable", "throws"]) {
  test(`clipboard ${reason} selects output for manual copy without a legacy API`, async () => {
    const navigator = reason === "unavailable" ? {} : { clipboard: { writeText() {
      if (reason === "throws") throw new Error("denied");
      return Promise.reject(new Error("denied"));
    } } };
    const { get, choose, document } = setupExtension(navigator);
    choose("appendFinishDateLabel");
    const formula = get("formula-output").value;
    get("copy").dispatch("click"); await tick();
    assert.match(get("copy-status").textContent, /Could not copy.*Ctrl\+C/);
    assert.equal(get("formula-output").value, formula);
    assert.equal(get("formula-output").selected, true);
    assert.equal(document.activeElement, get("formula-output"));
    assert.equal(get("copy").disabled, false);
  });
}

test("pending clipboard completion cannot report success for an edited formula or another view", async () => {
  const pending = [];
  const { get, choose } = setupExtension({ clipboard: { writeText: () => new Promise(resolve => pending.push(resolve)) } });
  choose("appendFinishDateLabel");
  get("copy").dispatch("click");
  get("field-milestoneLabelColumn").value = "Changed";
  get("field-milestoneLabelColumn").dispatch("input");
  pending.shift()(); await tick();
  assert.equal(get("copy-status").textContent, "");
  get("copy").dispatch("click");
  get("back").dispatch("click");
  choose("rankedValue");
  pending.shift()(); await tick();
  assert.equal(get("copy-status").textContent, "");
  assert.equal(get("copy").disabled, false);
});
