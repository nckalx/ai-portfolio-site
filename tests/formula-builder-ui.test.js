const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fixtures = require("./fixtures/formula-builder-cases.json");
const { loadFormulaCore, loadFormulaScript } = require("./helpers/load-formula-core");
const { createFormulaDocument } = require("./helpers/formula-dom");

function setup(navigator = {}) {
  const dom = createFormulaDocument();
  const context = vm.createContext({ document: dom.document, navigator });
  loadFormulaCore(context);
  loadFormulaScript(context, "formula-builder-ui");
  return { ...dom, get: id => dom.document.getElementById(id) };
}

test("UI initializes catalog options, first formula, labeled fields, and prevents submission", () => {
  const { get } = setup();
  assert.deepEqual(get("formulaType").children.map(option => [option.value, option.textContent]), fixtures.catalog.map(entry => [entry.id, entry.label]));
  assert.equal(get("generatedFormula").textContent, fixtures.cases[0].expected.formula);
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
  for (const entry of fixtures.cases) {
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
