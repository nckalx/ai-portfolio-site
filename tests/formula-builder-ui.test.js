const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { currentLegacyFixtures: fixtures, generalizedFixtures } = require("./helpers/formula-expectations");
const { loadFormulaCore, loadFormulaScript } = require("./helpers/load-formula-core");
const { createFormulaDocument } = require("./helpers/formula-dom");

function setup(navigator = {}, configureCore = () => {}) {
  const dom = createFormulaDocument();
  const context = vm.createContext({ document: dom.document, navigator });
  configureCore(loadFormulaCore(context));
  loadFormulaScript(context, "formula-builder-ui");
  return { ...dom, get: id => dom.document.getElementById(id) };
}

function unavailableEntry(id, availability) {
  return {
    id, label: "Unavailable formula",
    ...(availability === undefined ? {} : { availability }),
    get fields() { assert.fail(`Unavailable formula reached field rendering: ${id}`); }
  };
}

test("Phase 4A portfolio retains exact Advanced order and initial formula with structured modules loaded", () => {
  const { get } = setup({}, core => {
    assert.equal(typeof core.primitives.renderOperand, "function");
    assert.deepEqual(Object.keys(core.commonBuilders.registry), []);
  });
  assert.equal(get("formulaType").children.length, 26);
  assert.deepEqual(get("formulaType").children.map(option => option.value), fixtures.catalog.map(entry => entry.id));
  assert.equal(get("formulaType").value, "appendFinishDateLabel");
  assert.equal(get("generatedFormula").textContent, generalizedFixtures.cases[0].expected.formula);
});

for (const [name, availability] of [
  ["false", { portfolio: false, extension: true }],
  ["missing availability", undefined],
  ["missing portfolio", { extension: true }],
  ["string", { portfolio: "true" }],
  ["number", { portfolio: 1 }],
  ["object", { portfolio: {} }]
]) {
  test(`portfolio excludes ${name} before the first formula without rendering its fields`, () => {
    const { get } = setup({}, core => {
      core.catalog = { unavailable: unavailableEntry("unavailable", availability), ...core.catalog };
    });
    assert.deepEqual(get("formulaType").children.map(option => [option.value, option.textContent]), fixtures.catalog.map(entry => [entry.id, entry.label]));
    assert.equal(get("formulaType").value, "appendFinishDateLabel");
    assert.equal(get("generatedFormula").textContent, generalizedFixtures.cases[0].expected.formula);
  });
}

test("portfolio initial selection uses the first enabled entry when the normal first formula is disabled", () => {
  const { get } = setup({}, core => {
    core.catalog.appendFinishDateLabel = unavailableEntry("appendFinishDateLabel", { portfolio: false });
  });
  assert.deepEqual(get("formulaType").children.map(option => option.value), fixtures.catalog.slice(1).map(entry => entry.id));
  assert.equal(get("formulaType").value, "scheduleMovedWorkdays");
  assert.deepEqual(get("formulaInputFields").children.map(wrapper => wrapper.children[1].id), fixtures.catalog[1].fields.map(field => field.id));
  assert.equal(get("generatedFormula").textContent, generalizedFixtures.cases.find(entry => entry.formulaType === "scheduleMovedWorkdays").expected.formula);
});

for (const emptyCatalog of [false, true]) {
  test(`portfolio handles no available formulas safely (empty catalog: ${emptyCatalog})`, () => {
    const { get, copied } = setup({}, core => {
      core.catalog = emptyCatalog ? {} : {
        disabled: unavailableEntry("disabled", { portfolio: false }),
        missing: unavailableEntry("missing")
      };
      core.generateFormula = () => assert.fail("Empty portfolio must not generate a formula");
    });
    assert.equal(get("formulaType").children.length, 0);
    assert.equal(get("formulaType").value, "");
    assert.equal(get("formulaType").disabled, true);
    assert.equal(get("copyFormulaButton").disabled, true);
    assert.equal(get("formulaInputFields").children.length, 0);
    assert.equal(get("generatedFormula").textContent, "");
    get("formulaType").dispatch("change");
    get("copyFormulaButton").dispatch("click");
    assert.deepEqual(copied, []);
    let prevented = false;
    get("formulaBuilderForm").dispatch("submit", { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  });
}

test("UI initializes catalog options, first formula, labeled fields, and prevents submission", () => {
  const { get } = setup();
  assert.deepEqual(get("formulaType").children.map(option => [option.value, option.textContent]), fixtures.catalog.map(entry => [entry.id, entry.label]));
  assert.equal(get("generatedFormula").textContent, generalizedFixtures.cases[0].expected.formula);
  assert.equal(get("copyFormulaButton").disabled, false);
  let prevented = false;
  get("formulaBuilderForm").dispatch("submit", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  for (const wrapper of get("formulaInputFields").children) {
    assert.equal(wrapper.children[0].attributes.for, wrapper.children[1].id);
    assert.equal(wrapper.children[2].className, "field-help");
  }
});

test("UI renders every baseline result including missing-field precedence and guidance", () => {
  const { get } = setup();
  for (const entry of [...fixtures.cases, ...generalizedFixtures.cases]) {
    get("formulaType").value = entry.formulaType;
    get("formulaType").dispatch("change");
    const fields = fixtures.catalog.find(config => config.id === entry.formulaType).fields;
    for (const field of fields) {
      get(field.id).value = entry.rawValues[field.id];
      get(field.id).dispatch(field.type === "select" ? "change" : "input");
    }
    const expected = entry.expected;
    const display = expected.missingFields.length
      ? `Complete these fields to generate a formula: ${expected.missingFields.map(field => field.label).join(", ")}.`
      : expected.validationErrors.length ? expected.validationErrors.join(" ") : expected.formula;
    assert.equal(get("generatedFormula").textContent, display, entry.name);
    assert.equal(get("formulaExplanation").textContent, expected.explanation);
    assert.equal(get("copyFormulaButton").disabled, expected.formula === null);
    const lists = get("referenceInstructions").children.filter(child => ["ul", "ol"].includes(child.tagName));
    assert.deepEqual(lists[0].children.map(child => child.textContent), expected.setupNotes);
    assert.deepEqual(lists.at(-1).children.map(child => child.textContent), expected.instructions);
    assert.equal(lists.at(-1).tagName, "ol");
    assert.equal(lists.length, expected.references.length ? 3 : 2);
    if (expected.references.length) {
      const formatted = expected.references.map(reference => {
        const cleaned = reference.name.trim().replace(/^\{+/, "").replace(/\}+$/, "").trim();
        return `{${cleaned}}: in "${reference.sheet}", select the "${reference.range}" column.`;
      });
      assert.deepEqual(lists[1].children.map(child => child.textContent), formatted);
    }
  }
});

test("each field event regenerates output, clears copy status, and switching resets defaults", () => {
  const { get } = setup();
  for (const config of fixtures.catalog) {
    get("formulaType").value = config.id;
    get("formulaType").dispatch("change");
    for (const field of config.fields) {
      const input = get(field.id);
      get("copyFormulaStatus").textContent = "Formula copied.";
      input.value = "";
      input.dispatch(field.type === "select" ? "change" : "input");
      assert.equal(get("copyFormulaButton").disabled, true);
      assert.equal(get("copyFormulaStatus").textContent, "");
      input.value = field.defaultValue;
      input.dispatch(field.type === "select" ? "change" : "input");
      assert.equal(get("copyFormulaButton").disabled, false);
    }
  }
  get("rankNumber").value = "9";
  get("formulaType").value = "appendFinishDateLabel";
  get("formulaType").dispatch("change");
  get("formulaType").value = "rankedValue";
  get("formulaType").dispatch("change");
  assert.equal(get("rankNumber").value, "1");
});

test("user-provided markup remains literal text", () => {
  const { get } = setup();
  get("milestoneLabelColumn").value = '<img src=x onerror="alert(1)">';
  get("milestoneLabelColumn").dispatch("input");
  assert.ok(get("generatedFormula").textContent.includes('<img src=x onerror="alert(1)">'));
  assert.equal(get("generatedFormula").children.length, 0);
});

test("clipboard success copies the displayed formula and reports completion", async () => {
  const copied = [];
  const { get } = setup({ clipboard: { writeText: async text => copied.push(text) } });
  get("copyFormulaButton").dispatch("click");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(copied, [get("generatedFormula").textContent]);
  assert.equal(get("copyFormulaStatus").textContent, "Formula copied.");
});

for (const reason of ["unavailable", "rejected"]) {
  test(`clipboard fallback when API is ${reason} removes the temporary textarea`, async () => {
    const navigator = reason === "rejected" ? { clipboard: { writeText: async () => { throw new Error("denied"); } } } : {};
    const { get, document, copied } = setup(navigator);
    get("copyFormulaButton").dispatch("click");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(copied, [get("generatedFormula").textContent]);
    assert.equal(get("copyFormulaStatus").textContent, "Formula copied.");
    assert.ok(document.body.children.every(child => child.tagName !== "textarea"));
  });
}
