const assert = require("node:assert/strict");
const test = require("node:test");
const { setupExtension } = require("./helpers/formula-extension-dom");
const { generalizedFixtures, currentLegacyFixtures } = require("./helpers/formula-expectations");
const availabilityFixture = require("./fixtures/formula-availability.json");
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
  const options = get("category").children.filter(child => child.tagName === "option");
  assert.deepEqual(options.map(option => option.value), ["", ...Array.from(core.categories, category => category.id)]);
  assert.equal(choices().length, 24);
  assert.deepEqual(choices().map(button => button.getAttribute("aria-labelledby")),
    Object.entries(availabilityFixture).filter(([, config]) => config.availability.extension).map(([id]) => `choice-${id}`));
  for (const id of excluded) assert.throws(() => choose(id), /not discoverable/);
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
