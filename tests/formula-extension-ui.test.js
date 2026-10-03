const commonGuidance = require("./fixtures/formula-common-guidance.json");
const assert = require("node:assert/strict");
const test = require("node:test");
const { setupExtension } = require("./helpers/formula-extension-dom");
const { generalizedFixtures, currentLegacyFixtures } = require("./helpers/formula-expectations");
const availabilityFixture = require("./fixtures/formula-availability.json");
const batch1 = require("./fixtures/formula-common-batch1-cases.json");
const batch2 = require("./fixtures/formula-common-batch2-cases.json");
const batch3 = require("./fixtures/formula-common-batch3-cases.json");
const batch4 = require("./fixtures/formula-common-batch4-cases.json");
const { discoveryFixture } = require("./helpers/formula-discovery-fixtures");
const excluded = new Set(["multiLineReportLabel", "rioIdLookup"]);
const tick = () => new Promise(resolve => setImmediate(resolve));
const { installStructuredFixtures, descendants, structuredControl, editStructured } = require("./helpers/formula-structured-ui-fixtures");

function structuredPanel(navigator = {}, configureCore = () => {}, beforeEngine = installStructuredFixtures) {
  const panel = setupExtension(navigator, {}, configureCore, beforeEngine);
  switchLibrary(panel, "common");
  return panel;
}

test("structured UI uses real engine dispatch, core defaults once, and semantic-only raw inputs", () => {
  const calls = [], defaults = [];
  const panel = structuredPanel({}, core => {
    const generate = core.generateFormula;
    core.generateFormula = (...args) => { calls.push(JSON.parse(JSON.stringify(args))); return generate(...args); };
    const original = core.validation.structured;
    core.validation.structured = { ...original, createDefaultValues(config) { defaults.push(config.id); return original.createDefaultValues(config); } };
  });
  panel.choose("syntheticStructured");
  assert.equal(panel.document.activeElement, panel.get("build-title"));
  assert.equal(panel.get("formula-output").value, '=COUNTIFS({Statuses}, "Open")');
  assert.deepEqual(defaults, ["syntheticStructured"]);
  assert.equal(calls[0].length, 2);
  assert.deepEqual(Object.keys(calls[0][1]), ["criteria"]);
  const generationBefore = panel.generationCount();
  editStructured(panel, "Value kind", "number");
  editStructured(panel, "Number", "-");
  assert.equal(panel.generationCount(), generationBefore + 2);
  assert.deepEqual(calls.at(-1)[1].criteria[0].criterion.value, { type: "number", value: "-" });
  assert.equal(panel.get("formula-output").value, ""); assert.equal(panel.get("copy").disabled, true);
  assert.doesNotMatch(panel.get("validation").textContent, /\[object Object\]/);
  assert.match(panel.get("validation").textContent, /field error/);
  panel.get("back").dispatch("click"); panel.choose("syntheticStructured");
  assert.equal(structuredControl(panel, "Number").value, "-");
  assert.deepEqual(defaults, ["syntheticStructured"]);
  assert.equal(JSON.stringify(calls).includes("nextKey"), false);
  assert.equal(JSON.stringify(calls).includes('"r1"'), false);
});

test("structured dispatch follows inputContract even on an Advanced-library synthetic entry", () => {
  const panel = setupExtension({}, {}, () => {}, core => {
    installStructuredFixtures(core); core.catalog.syntheticStructured.libraryId = "advanced";
  });
  panel.choose("syntheticStructured");
  assert.equal(panel.get("formula-output").value, '=COUNTIFS({Statuses}, "Open")');
});

test("structured drafts, row keys, Advanced drafts and library switches remain independent", () => {
  const panel = structuredPanel();
  panel.choose("syntheticStructured"); editStructured(panel, "Text", "first");
  descendants(panel.get("fields")).find(node => node.tagName === "button" && node.textContent === "Add Criteria").dispatch("click");
  const rowId = structuredControl(panel, "Range kind", 1).id;
  assert.equal(panel.document.activeElement.id, rowId);
  panel.get("back").dispatch("click"); panel.choose("syntheticSecond");
  assert.equal(structuredControl(panel, "Text").value, "Open"); editStructured(panel, "Text", "second");
  panel.get("back").dispatch("click"); switchLibrary(panel, "advanced"); panel.choose("appendFinishDateLabel");
  assert.equal(panel.get("form-instructions").textContent, "Use your sheet's column names. All fields are required.");
  const advanced = panel.get("field-milestoneLabelColumn"); advanced.value = "Saved Advanced"; advanced.dispatch("input");
  panel.get("back").dispatch("click"); switchLibrary(panel, "common"); panel.choose("syntheticStructured");
  assert.equal(structuredControl(panel, "Text").value, "first");
  assert.equal(structuredControl(panel, "Range kind", 1).id, rowId);
  panel.get("back").dispatch("click"); panel.choose("syntheticSecond"); assert.equal(structuredControl(panel, "Text").value, "second");
  panel.get("back").dispatch("click"); switchLibrary(panel, "advanced"); panel.choose("appendFinishDateLabel");
  assert.equal(panel.get("field-milestoneLabelColumn").value, "Saved Advanced");
});

test("structured normalized reference names display alone and raw spelling survives generation", () => {
  const panel = structuredPanel(); panel.choose("syntheticStructured");
  editStructured(panel, "Reference name", "{{  Named Range  }}");
  assert.equal(panel.get("references").textContent, "{Named Range}");
  assert.doesNotMatch(panel.get("references").textContent, /undefined/);
  assert.equal(structuredControl(panel, "Reference name").value, "{{  Named Range  }}");
  editStructured(panel, "Value kind", "number"); editStructured(panel, "Number", "0001.2300");
  assert.equal(structuredControl(panel, "Number").value, "0001.2300");
  assert.match(panel.get("formula-output").value, /1\.23/);
  panel.get("back").dispatch("click"); panel.choose("syntheticStructured");
  assert.equal(structuredControl(panel, "Number").value, "0001.2300");
});

test("structured Back preserves Find DOM, scroll and return focus and destroys old controls", () => {
  const panel = structuredPanel(); const choices = panel.choices();
  panel.get("results-scroll").scrollTop = 42;
  const button = panel.choose("syntheticStructured"); const old = structuredControl(panel, "Text");
  const count = panel.generationCount(); panel.get("back").dispatch("click");
  assert.equal(panel.document.activeElement, button); assert.deepEqual(panel.choices(), choices);
  assert.equal(panel.get("results-scroll").scrollTop, 42); assert.equal(panel.get("fields").children.length, 0);
  old.value = "detached"; old.dispatch("input"); assert.equal(panel.generationCount(), count);
  panel.choose("syntheticStructured"); assert.equal(structuredControl(panel, "Text").value, "Open");
});

test("structured validation count is concise and inline errors clear without moving focus", () => {
  const panel = structuredPanel(); panel.choose("syntheticStructured");
  editStructured(panel, "Value kind", "number"); const input = editStructured(panel, "Number", "-");
  assert.equal(panel.get("validation").textContent, "1 field error. Review the fields above.");
  assert.equal(panel.document.activeElement, input); assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.ok(descendants(panel.get("fields")).some(node => node.className === "field-error" && !node.hidden));
  editStructured(panel, "Number", "1");
  assert.equal(panel.get("validation").textContent, ""); assert.equal(input.getAttribute("aria-invalid"), "false");
  assert.equal(panel.document.activeElement, input);
});

test("structured valid output uses existing Copy Formula and only theme can write storage", async () => {
  const copied = []; const panel = structuredPanel({ clipboard: { writeText: async value => copied.push(value) } });
  panel.choose("syntheticStructured");
  const expected = panel.get("formula-output").value;
  panel.get("copy").dispatch("click"); await tick();
  assert.deepEqual(copied, [expected]); assert.equal(panel.get("copy-status").textContent, "Formula copied.");
  editStructured(panel, "Text", "changed");
  assert.equal(panel.get("copy-status").textContent, "");
  assert.deepEqual(panel.storageWrites, []);
});

for (const action of ["edit", "back", "switch"]) {
  test(`structured pending copy suppresses stale feedback after ${action}`, async () => {
    let resolve; const panel = structuredPanel({ clipboard: { writeText: () => new Promise(done => { resolve = done; }) } });
    panel.choose("syntheticStructured"); panel.get("copy").dispatch("click");
    if (action === "edit") editStructured(panel, "Text", "new");
    else { panel.get("back").dispatch("click"); if (action === "switch") panel.choose("syntheticSecond"); }
    resolve(); await tick(); assert.notEqual(panel.get("copy-status").textContent, "Formula copied.");
  });
}

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
  assert.equal(get("library-selector").hidden, false);
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
function assertCommonGuidance(panel, id) {
  assert.equal(panel.get("setup-details").hidden, false);
  assert.equal(panel.get("instructions-details").hidden, false);
  assert.deepEqual(panel.get("setup-notes").children.map(node => node.textContent), commonGuidance[id].setupNotes);
  assert.deepEqual(panel.get("instructions").children.map(node => node.textContent), commonGuidance[id].instructions);
}

function switchLibrary(panel, library) {
  // Supply the checked change and focus a browser would provide. This double
  // intentionally does not simulate native radio grouping or keyboard behavior.
  const radio = panel.get(`library-${library}`);
  radio.focus();
  radio.checked = true;
  radio.dispatch("change");
}

test("production Common navigation exposes twenty-eight choices and exact text/date/calculation categories", () => {
  const panel = setupExtension();
  assert.equal(panel.get("library-advanced").checked, true);
  assert.equal(panel.get("library-selector").hidden, false);
  switchLibrary(panel, "common");
  assert.deepEqual(resultIds(panel), [...batch1.formulas, ...batch2.formulas, ...batch3.formulas, ...batch4.formulas].map(config => config.id));
  assert.equal(panel.get("result-count").textContent, "28 formulas");
  assert.deepEqual(categoryIds(panel), ["", "text-labels", "dates-status", "counts-calculations"]);
  panel.get("category").value = "text-labels"; panel.get("category").dispatch("change");
  assert.deepEqual(resultIds(panel), batch2.formulas.map(config => config.id));
  assert.equal(panel.get("result-count").textContent, "10 formulas");
  panel.get("category").value = "dates-status"; panel.get("category").dispatch("change");
  assert.deepEqual(resultIds(panel), ["todayDate", "dateFromParts", "isBlank"]);
  assert.equal(panel.get("result-count").textContent, "3 formulas");
  panel.get("category").value = "counts-calculations"; panel.get("category").dispatch("change");
  assert.equal(panel.get("result-count").textContent, "15 formulas");
  panel.get("search").value = "  NUMBER stored AS TEXT  "; panel.get("search").dispatch("input");
  assert.deepEqual(resultIds(panel), ["textToNumber"]);
  const choices = panel.choices();
  panel.get("results-scroll").scrollTop = 51;
  const button = panel.choose("textToNumber");
  panel.get("back").dispatch("click");
  assert.deepEqual(panel.choices(), choices);
  assert.equal(panel.get("search").value, "  NUMBER stored AS TEXT  ");
  assert.equal(panel.get("results-scroll").scrollTop, 51);
  assert.equal(panel.document.activeElement, button);
  panel.get("clear-filters").dispatch("click");
  assert.deepEqual(resultIds(panel), [...batch1.formulas, ...batch2.formulas, ...batch3.formulas, ...batch4.formulas].map(config => config.id));
  switchLibrary(panel, "advanced");
  assert.equal(panel.get("result-count").textContent, "24 formulas");
});

for (const config of batch1.formulas) {
  test(`production Common literal, cell, copy and Build/Back: ${config.id}`, async () => {
    const copied = [], calls = [];
    const panel = setupExtension({ clipboard: { writeText: async value => copied.push(value) } }, {}, core => {
      const generate = core.generateFormula;
      core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
    });
    switchLibrary(panel, "common");
    const button = panel.choose(config.id);
    assert.deepEqual(calls.at(-1), {});
    assert.equal(panel.get("copy").disabled, true);
    assert.equal(panel.document.activeElement, panel.get("build-title"));
    const text = config.id === "textToNumber";
    const multiple = config.builderKey === "multipleRounding";
    editStructured(panel, text ? "Text kind" : "Number kind", text ? "textLiteral" : "number");
    editStructured(panel, text ? "Text" : "Number", text ? "0012.50" : " 0012.500 ");
    if (multiple) {
      editStructured(panel, "Multiple kind", "number");
      editStructured(panel, "Number", "0.5", 1);
    }
    const expected = text ? '=VALUE("0012.50")' : `=${config.label}(12.5${multiple ? ", 0.5" : ""})`;
    assert.equal(panel.get("formula-output").value, expected);
    assertCommonGuidance(panel, config.id);
    assert.equal(panel.get("reference-notice").hidden, true);
    assert.equal(panel.get("reference-section").hidden, true);
    panel.get("copy").dispatch("click"); await tick();
    assert.deepEqual(copied, [expected]);
    panel.get("back").dispatch("click");
    assert.equal(panel.document.activeElement, button);
    panel.choose(config.id);
    assert.equal(structuredControl(panel, text ? "Text" : "Number").value, text ? "0012.50" : " 0012.500 ");
    editStructured(panel, text ? "Text kind" : "Number kind", "cellRef");
    assert.deepEqual(calls.at(-1).value, { type: "cellRef", column: "" });
    editStructured(panel, "Current-row column", " Amount ");
    if (multiple) {
      editStructured(panel, "Multiple kind", "cellRef");
      assert.deepEqual(calls.at(-1).multiple, { type: "cellRef", column: "" });
      editStructured(panel, "Current-row column", " Increment ", 1);
    }
    assert.equal(panel.get("formula-output").value, `=${config.label}([Amount]@row${multiple ? ", [Increment]@row" : ""})`);
    assert.equal(JSON.stringify(calls).includes("uiState"), false);
    assert.equal(JSON.stringify(calls).includes("nextKey"), false);
    assert.deepEqual(panel.storageWrites, []);
  });
}

test("production TODAY optional offset preserves omission, zero, touched drafts, copy and Configure", async () => {
  const calls = [], copied = [];
  const panel = setupExtension({ clipboard: { writeText: async value => copied.push(value) } }, {}, core => {
    const generate = core.generateFormula;
    core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
  });
  switchLibrary(panel, "common"); const button = panel.choose("todayDate");
  assert.equal(panel.document.activeElement, panel.get("build-title"));
  assert.equal(panel.get("fields-form").hidden, false);
  assert.equal(structuredControl(panel, "Include Days offset").checked, false);
  assert.deepEqual(calls.at(-1), {});
  assert.equal(panel.get("formula-output").value, "=TODAY()");
  assert.equal(panel.get("copy").disabled, false);
  assertCommonGuidance(panel, "todayDate");
  panel.get("copy").dispatch("click"); await tick();
  const include = structuredControl(panel, "Include Days offset");
  include.checked = true; include.dispatch("change");
  assert.deepEqual(calls.at(-1), { offsetDays: "" });
  assert.equal(panel.get("copy").disabled, true);
  assert.deepEqual(visibleStructuredErrors(panel), []);
  const empty = structuredControl(panel, "Days offset"); empty.focus(); empty.dispatch("blur");
  assert.equal(empty.getAttribute("aria-invalid"), "true");
  for (const [raw, formula] of [["7", "=TODAY(7)"], ["-7", "=TODAY(-7)"], ["0", "=TODAY(0)"], [" 007 ", "=TODAY(7)"]]) {
    const input = editStructured(panel, "Days offset", raw);
    assert.equal(input, empty); assert.equal(input.value, raw);
    assert.equal(input.getAttribute("aria-invalid"), "false");
    assert.equal(panel.document.activeElement, input);
    assert.equal(panel.get("formula-output").value, formula);
    assertCommonGuidance(panel, "todayDate");
    panel.get("copy").dispatch("click"); await tick();
  }
  assert.deepEqual(copied, ["=TODAY()", "=TODAY(7)", "=TODAY(-7)", "=TODAY(0)", "=TODAY(7)"]);
  editStructured(panel, "Days offset", "-");
  assert.equal(panel.get("copy").disabled, true);
  assert.equal(visibleStructuredErrors(panel).length, 1);
  assertCommonGuidance(panel, "todayDate");
  panel.get("back").dispatch("click"); assert.equal(panel.document.activeElement, button);
  panel.choose("dateFromParts"); assert.equal(panel.get("fields-form").hidden, false);
  panel.get("back").dispatch("click"); switchLibrary(panel, "advanced"); panel.choose("appendFinishDateLabel");
  assert.equal(panel.get("fields-form").hidden, false);
  assert.equal(panel.get("form-instructions").textContent, "Use your sheet's column names. All fields are required.");
  panel.get("back").dispatch("click"); switchLibrary(panel, "common"); panel.choose("todayDate");
  assert.equal(structuredControl(panel, "Days offset").value, "-");
  assert.equal(visibleStructuredErrors(panel).length, 1);
  const restored = structuredControl(panel, "Include Days offset");
  restored.checked = false; restored.dispatch("change");
  assert.deepEqual(calls.at(-1), {});
  assert.equal(panel.get("formula-output").value, "=TODAY()");
  assert.equal(panel.get("copy").disabled, false);
  assert.deepEqual(visibleStructuredErrors(panel), []);
  restored.checked = true; restored.dispatch("change");
  assert.equal(structuredControl(panel, "Days offset").value, "");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  restored.checked = false; restored.dispatch("change");
  empty.value = "99"; empty.dispatch("input");
  assert.deepEqual(calls.at(-1), {});
  assert.equal(panel.get("formula-output").value, "=TODAY()");
});

test("production DATE retains raw scalar drafts, touched bounds and calendar syntax through Build/Back", async () => {
  const copied = [];
  const panel = setupExtension({ clipboard: { writeText: async value => copied.push(value) } });
  switchLibrary(panel, "common"); panel.choose("dateFromParts");
  assert.equal(descendants(panel.get("fields")).filter(node => node.tagName === "select").length, 0);
  assert.deepEqual(visibleStructuredErrors(panel), []);
  assert.equal(panel.get("copy").disabled, true);
  const year = structuredControl(panel, "Year"); year.focus(); year.dispatch("blur");
  assert.equal(visibleStructuredErrors(panel).length, 1);
  assert.equal(year.getAttribute("aria-required"), "true");
  editStructured(panel, "Year", " 02026 ");
  editStructured(panel, "Month", "013"); editStructured(panel, "Day", "031");
  assert.deepEqual(visibleStructuredErrors(panel), ["Value must be at most 12."]);
  assertCommonGuidance(panel, "dateFromParts");
  panel.get("back").dispatch("click"); panel.choose("dateFromParts");
  assert.equal(structuredControl(panel, "Year").value, " 02026 ");
  assert.equal(structuredControl(panel, "Month").value, "013");
  assert.deepEqual(visibleStructuredErrors(panel), ["Value must be at most 12."]);
  const month = editStructured(panel, "Month", "002");
  assert.equal(month.value, "002"); assert.equal(panel.document.activeElement, month);
  assert.equal(month.getAttribute("aria-invalid"), "false");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  assert.equal(panel.get("formula-output").value, "=DATE(2026, 2, 31)");
  panel.get("copy").dispatch("click"); await tick();
  assert.deepEqual(copied, ["=DATE(2026, 2, 31)"]);
  editStructured(panel, "Year", "999");
  assert.deepEqual(visibleStructuredErrors(panel), ["Value must be at least 1000."]);
  editStructured(panel, "Year", "2026");
  assert.equal(panel.get("copy").disabled, false);
  assertCommonGuidance(panel, "dateFromParts");
});

test("production ISBLANK restricts kind, clears stale cells and preserves local references and Copy", async () => {
  const calls = [], copied = [];
  const panel = setupExtension({ clipboard: { writeText: async value => copied.push(value) } }, {}, core => {
    const generate = core.generateFormula;
    core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
  });
  switchLibrary(panel, "common"); panel.choose("isBlank");
  assert.deepEqual(structuredControl(panel, "Cell to check kind").children.map(option => option.value), ["", "cellRef"]);
  assert.equal(panel.get("copy").disabled, true);
  assert.deepEqual(visibleStructuredErrors(panel), []);
  editStructured(panel, "Cell to check kind", "cellRef");
  const input = editStructured(panel, "Current-row column", "  {Statuses}  ");
  assert.equal(input.value, "  {Statuses}  ");
  assert.equal(panel.get("formula-output").value, "=ISBLANK([{Statuses}]@row)");
  assert.equal(panel.get("reference-section").hidden, true);
  assert.equal(panel.get("reference-notice").hidden, true);
  assertCommonGuidance(panel, "isBlank");
  panel.get("copy").dispatch("click"); await tick();
  assert.deepEqual(copied, ["=ISBLANK([{Statuses}]@row)"]);
  panel.get("back").dispatch("click"); panel.choose("isBlank");
  assert.equal(structuredControl(panel, "Current-row column").value, "  {Statuses}  ");
  editStructured(panel, "Current-row column", "Task\nName");
  assert.deepEqual(visibleStructuredErrors(panel), ["Expected text without control characters."]);
  assertCommonGuidance(panel, "isBlank");
  editStructured(panel, "Cell to check kind", "");
  assert.deepEqual(calls.at(-1), { value: {} });
  editStructured(panel, "Cell to check kind", "cellRef");
  assert.deepEqual(calls.at(-1), { value: { type: "cellRef", column: "" } });
  assert.equal(structuredControl(panel, "Current-row column").value, "");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  editStructured(panel, "Current-row column", "Task Name");
  assert.equal(panel.get("formula-output").value, "=ISBLANK([Task Name]@row)");
  assert.equal(panel.get("copy").disabled, false);
  assert.equal(JSON.stringify(calls).includes("uiState"), false);
});

test("production ROUND preserves raw incomplete drafts, precision presence and independent formula drafts", () => {
  const calls = [];
  const panel = setupExtension({}, {}, core => {
    const generate = core.generateFormula;
    core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
  });
  switchLibrary(panel, "common"); panel.choose("roundValue");
  editStructured(panel, "Number kind", "number");
  for (const raw of ["-", "1."]) {
    const input = editStructured(panel, "Number", raw);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.ok(input.getAttribute("aria-describedby"));
    assert.equal(panel.document.activeElement, input);
    assert.equal(panel.get("copy").disabled, true);
    panel.get("back").dispatch("click"); panel.choose("absoluteValue");
    editStructured(panel, "Number kind", "number"); editStructured(panel, "Number", "99");
    panel.get("back").dispatch("click"); switchLibrary(panel, "advanced"); panel.choose("appendFinishDateLabel");
    panel.get("back").dispatch("click"); switchLibrary(panel, "common"); panel.choose("roundValue");
    assert.equal(structuredControl(panel, "Number").value, raw);
  }
  const input = editStructured(panel, "Number", " 0012.500 ");
  assert.equal(input.getAttribute("aria-invalid"), "false");
  assert.equal(panel.get("validation").textContent, "");
  assert.equal(panel.get("formula-output").value, "=ROUND(12.5)");
  const include = structuredControl(panel, "Include Decimal places");
  include.checked = true; include.dispatch("change");
  assert.equal(calls.at(-1).decimalPlaces, "");
  assert.equal(panel.get("copy").disabled, true);
  const digits = editStructured(panel, "Decimal places", "0");
  assert.equal(panel.document.activeElement, digits);
  assert.equal(panel.get("formula-output").value, "=ROUND(12.5, 0)");
  editStructured(panel, "Decimal places", "-01");
  assert.equal(panel.get("formula-output").value, "=ROUND(12.5, -1)");
  panel.get("back").dispatch("click"); panel.choose("roundValue");
  assert.equal(structuredControl(panel, "Decimal places").value, "-01");
  assert.equal(structuredControl(panel, "Number").value, " 0012.500 ");
  const restored = structuredControl(panel, "Include Decimal places");
  restored.checked = false; restored.dispatch("change");
  assert.equal(Object.hasOwn(calls.at(-1), "decimalPlaces"), false);
  assert.equal(panel.get("formula-output").value, "=ROUND(12.5)");
  editStructured(panel, "Number kind", "cellRef");
  editStructured(panel, "Current-row column", "Amount");
  editStructured(panel, "Number kind", "number");
  assert.deepEqual(calls.at(-1).value, { type: "number", value: "" });
});

test("production VALUE shows requiredText errors, preserves literal text and handles copy failure", async () => {
  const panel = setupExtension({ clipboard: { writeText: async () => { throw new Error("unavailable"); } } });
  switchLibrary(panel, "common"); panel.choose("textToNumber");
  editStructured(panel, "Text kind", "textLiteral");
  for (const raw of ["", "   ", "\u00a0"]) {
    const input = editStructured(panel, "Text", raw);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(panel.get("copy").disabled, true);
    assert.ok(descendants(panel.get("fields")).some(node => node.className === "field-error" && !node.hidden && node.textContent === "Enter text that represents a number."));
  }
  const input = editStructured(panel, "Text", " 0012.50 ");
  assert.equal(input.value, " 0012.50 ");
  assert.equal(input.getAttribute("aria-invalid"), "false");
  assert.equal(panel.get("formula-output").value, '=VALUE(" 0012.50 ")');
  assert.equal(panel.get("validation").textContent, "");
  panel.get("copy").dispatch("click"); await tick();
  assert.match(panel.get("copy-status").textContent, /Could not copy/);
  assert.equal(panel.document.activeElement, panel.get("formula-output"));
  assert.equal(panel.get("formula-output").selected, true);
  assert.equal(panel.get("copy").disabled, false);
  editStructured(panel, "Text kind", "cellRef"); editStructured(panel, "Current-row column", "Text");
  assert.equal(panel.get("formula-output").value, "=VALUE([Text]@row)");
});

const batch2UiCases = [
  ["leftText", '=LEFT(" abc ")', '=LEFT([Column 1]@row)', '=LEFT("")'],
  ["rightText", '=RIGHT(" abc ")', '=RIGHT([Column 1]@row)', '=RIGHT("")'],
  ["midText", '=MID(" abc ", 1, 2)', '=MID([Column 1]@row, 1, 2)', '=MID("", 1, 2)'],
  ["textLength", '=LEN(" abc ")', '=LEN([Column 1]@row)', '=LEN("")'],
  ["findTextPosition", '=FIND(" abc ", " abc ")', '=FIND([Column 1]@row, [Column 2]@row)', '=FIND("", "")'],
  ["containsText", '=CONTAINS(" abc ", [Target]@row)', '=CONTAINS([Column 1]@row, [Target]@row)', '=CONTAINS("", [Target]@row)'],
  ["lowerText", '=LOWER(" abc ")', '=LOWER([Column 1]@row)', '=LOWER("")'],
  ["upperText", '=UPPER(" abc ")', '=UPPER([Column 1]@row)', '=UPPER("")'],
  ["substituteText", '=SUBSTITUTE(" abc ", " abc ", " abc ")', '=SUBSTITUTE([Column 1]@row, [Column 2]@row, [Column 3]@row)', '=SUBSTITUTE("", "", "")'],
  ["replaceTextByPosition", '=REPLACE(" abc ", 1, 2, " abc ")', '=REPLACE([Column 1]@row, 1, 2, [Column 2]@row)', '=REPLACE("", 1, 2, "")']
];

function fillBatch2Text(panel, config, text = " abc ") {
  const fields = config.fields.filter(field => field.type === "textOperand");
  for (const field of fields) editStructured(panel, `${field.label} kind`, "textLiteral");
  fields.forEach((field, index) => editStructured(panel, "Text", text, index));
  for (const field of config.fields.filter(field => field.type === "integer" && field.required)) {
    editStructured(panel, field.label, field.id === "startPosition" ? "1" : "2");
  }
  if (config.id === "containsText") {
    editStructured(panel, "Cell or range to search kind", "cellRef");
    editStructured(panel, "Current-row column", "Target");
  }
}

const visibleStructuredErrors = panel => descendants(panel.get("fields"))
  .filter(node => node.className === "field-error" && !node.hidden).map(node => node.textContent);

for (const config of batch4.formulas) {
  test(`Batch 4 production repeatable startup, examples, Copy and Build/Back: ${config.id}`, async () => {
    const copied = [], calls = [];
    const panel = setupExtension({ clipboard: { writeText: async text => copied.push(text) } }, {}, core => {
      const generate = core.generateFormula;
      core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
    });
    switchLibrary(panel, "common"); panel.choose(config.id);
    const add = () => descendants(panel.get("fields")).find(node => node.tagName === "button" && node.textContent === "Add Value");
    const remove = index => descendants(panel.get("fields")).find(node => node.getAttribute("aria-label") === `Remove Value ${index}`);
    assert.deepEqual(calls.at(-1), {});
    assert.equal(descendants(panel.get("fields")).filter(node => node.tagName === "select").length, 0);
    assert.ok(add()); assert.equal(panel.get("copy").disabled, true);
    assert.deepEqual(visibleStructuredErrors(panel), []); assertCommonGuidance(panel, config.id);
    const example = batch4.cases.find(entry => entry.formulaType === config.id && entry.name === "approved example");
    for (const [index, value] of example.rawValues.values.entries()) {
      add().dispatch("click");
      assert.deepEqual(calls.at(-1).values.at(-1), {});
      assert.equal(panel.get("copy").disabled, true);
      const kind = `Value ${index + 1} kind`;
      const selector = structuredControl(panel, kind);
      assert.equal(panel.document.activeElement, selector);
      assert.deepEqual(selector.children.map(option => option.value), ["", ...config.fields[0].items.allowedTypes]);
      if (index === 0) {
        assert.equal(remove(1).disabled, true);
        const count = panel.generationCount(); remove(1).dispatch("click");
        assert.equal(panel.generationCount(), count);
      }
      editStructured(panel, kind, value.type);
      if (value.type === "number") editStructured(panel, "Number", value.value, index);
      else if (value.type === "cellRef") editStructured(panel, "Current-row column", value.column);
      else if (value.type === "columnRef") editStructured(panel, "Whole column", value.column);
      else {
        const scope = `Value ${index + 1} scope`;
        assert.deepEqual(structuredControl(panel, scope).children.map(option => option.value), ["", "currentSheet", "crossSheet"]);
        editStructured(panel, scope, "crossSheet"); editStructured(panel, "Reference name", value.name);
      }
    }
    assert.equal(panel.get("formula-output").value, example.expected.formula);
    assert.equal(panel.get("copy").disabled, false);
    panel.get("copy").dispatch("click"); await tick();
    assert.deepEqual(copied, [example.expected.formula]);
    assertCommonGuidance(panel, config.id);
    // An incomplete appended row must invalidate output while preserving earlier rows.
    add().dispatch("click");
    const extraIndex = example.rawValues.values.length + 1;
    const extra = structuredControl(panel, `Value ${extraIndex} kind`);
    extra.dispatch("blur");
    assert.equal(panel.get("formula-output").value, ""); assert.equal(panel.get("copy").disabled, true);
    assert.ok(visibleStructuredErrors(panel).length);
    const firstId = structuredControl(panel, "Value 1 kind").id;
    panel.get("back").dispatch("click"); panel.choose(config.id);
    assert.equal(structuredControl(panel, "Value 1 kind").id, firstId);
    assert.equal(structuredControl(panel, `Value ${extraIndex} kind`).id, extra.id);
    assert.ok(visibleStructuredErrors(panel).length);
    remove(extraIndex).dispatch("click");
    assert.equal(panel.get("formula-output").value, example.expected.formula);
    assert.deepEqual(visibleStructuredErrors(panel), []);
    // Switch the first row through both reference scopes, clearing obsolete members.
    editStructured(panel, "Value 1 kind", "rangeRef");
    editStructured(panel, "Value 1 scope", "currentSheet");
    editStructured(panel, "Start column", " Low "); editStructured(panel, "End column", " High ");
    assert.deepEqual(calls.at(-1).values[0], { type: "rangeRef", scope: "currentSheet", startColumn: " Low ", endColumn: " High " });
    assert.ok(panel.get("formula-output").value.startsWith(`=${config.label}([Low]:[High]`));
    editStructured(panel, "Value 1 scope", "crossSheet");
    assert.deepEqual(calls.at(-1).values[0], { type: "rangeRef", scope: "crossSheet", name: "" });
    editStructured(panel, "Reference name", "{{ Costs }}");
    assert.ok(panel.get("formula-output").value.startsWith(`=${config.label}({Costs}`));
    if (config.fields[0].items.allowedTypes.includes("number")) {
      editStructured(panel, "Value 1 kind", "number"); editStructured(panel, "Number", "-");
      assert.equal(panel.get("copy").disabled, true);
      assert.deepEqual(calls.at(-1).values[0], { type: "number", value: "-" });
      editStructured(panel, "Number", " 0012.500 ");
      assert.ok(panel.get("formula-output").value.startsWith(`=${config.label}(12.5`));
      panel.get("back").dispatch("click"); panel.choose(config.id);
      assert.equal(structuredControl(panel, "Number").value, " 0012.500 ");
    } else {
      panel.get("back").dispatch("click"); panel.choose(config.id);
      assert.equal(structuredControl(panel, "Reference name").value, "{{ Costs }}");
    }
    assert.equal(panel.get("copy").disabled, false);
    assert.equal(structuredControl(panel, "Value 1 kind").id, firstId);
    assert.doesNotMatch(JSON.stringify(calls), /"rowKey"|"uiState"|"nextKey"|"touched"|"r\d+"/);
    assert.deepEqual(panel.storageWrites, []);
  });
}

test("all production Common formulas validate immediately but initially display no inline errors", () => {
  const panel = setupExtension();
  switchLibrary(panel, "common");
  for (const config of [...batch1.formulas, ...batch2.formulas, ...batch3.formulas, ...batch4.formulas]) {
    panel.choose(config.id);
    assert.equal(panel.core.generateFormula(config.id, {}).validationErrors.length > 0, config.id !== "todayDate");
    assertCommonGuidance(panel, config.id);
    assert.equal(panel.get("copy").disabled, config.id !== "todayDate");
    assert.equal(panel.get("formula-output").value, config.id === "todayDate" ? "=TODAY()" : "");
    assert.deepEqual(visibleStructuredErrors(panel), []);
    assert.equal(panel.get("validation").textContent, "");
    assert.ok(descendants(panel.get("fields")).every(node => node.getAttribute("aria-invalid") !== "true"));
    panel.get("back").dispatch("click");
    panel.choose(config.id);
    assert.deepEqual(visibleStructuredErrors(panel), []);
    panel.get("back").dispatch("click");
  }
});

test("required blur reveals only that Common field and deliberately restores touched drafts", () => {
  const calls = [];
  const panel = setupExtension({}, {}, core => {
    const generate = core.generateFormula;
    core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
  });
  switchLibrary(panel, "common"); panel.choose("midText");
  const start = structuredControl(panel, "Start position");
  start.focus();
  assert.deepEqual(visibleStructuredErrors(panel), []);
  start.dispatch("blur");
  assert.deepEqual(visibleStructuredErrors(panel), ["Choose Start position."]);
  assert.equal(start.getAttribute("aria-invalid"), "true");
  assert.equal(structuredControl(panel, "Number of characters").getAttribute("aria-invalid"), "false");
  assert.equal(structuredControl(panel, "Text kind").getAttribute("aria-invalid"), "false");
  assert.deepEqual(calls.at(-1), {});
  editStructured(panel, "Start position", "-");
  assert.equal(start.getAttribute("aria-invalid"), "true");
  panel.get("back").dispatch("click"); panel.choose("midText");
  assert.equal(structuredControl(panel, "Start position").value, "-");
  assert.equal(structuredControl(panel, "Start position").getAttribute("aria-invalid"), "true");
  assert.equal(structuredControl(panel, "Number of characters").getAttribute("aria-invalid"), "false");
  editStructured(panel, "Start position", " 003 ");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  assert.equal(panel.get("copy").disabled, true);
  const kind = structuredControl(panel, "Text kind"); kind.focus(); kind.dispatch("blur");
  assert.deepEqual(visibleStructuredErrors(panel), ["Choose Text."]);
  editStructured(panel, "Text kind", "cellRef");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  const column = structuredControl(panel, "Current-row column"); column.focus(); column.dispatch("blur");
  assert.equal(column.getAttribute("aria-invalid"), "true");
  editStructured(panel, "Current-row column", "Name");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  assert.equal(JSON.stringify(calls).includes("touched"), false);
});

test("optional inclusion stays clean until interaction and exclusion resets touched state", () => {
  const panel = setupExtension();
  switchLibrary(panel, "common"); panel.choose("rightText");
  editStructured(panel, "Text kind", "textLiteral");
  assert.equal(panel.get("copy").disabled, false);
  const include = structuredControl(panel, "Include Number of characters");
  include.checked = true; include.dispatch("change");
  assert.equal(panel.get("copy").disabled, true);
  assert.deepEqual(visibleStructuredErrors(panel), []);
  panel.get("back").dispatch("click"); panel.choose("rightText");
  const count = structuredControl(panel, "Number of characters");
  assert.equal(count.getAttribute("aria-invalid"), "false");
  count.focus(); count.dispatch("blur");
  assert.equal(count.getAttribute("aria-invalid"), "true");
  assert.equal(visibleStructuredErrors(panel).length, 1);
  editStructured(panel, "Number of characters", "0");
  assert.equal(count.getAttribute("aria-invalid"), "false");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  assert.equal(panel.get("copy").disabled, false);
  editStructured(panel, "Number of characters", "-");
  const restored = structuredControl(panel, "Include Number of characters");
  restored.checked = false; restored.dispatch("change");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  assert.equal(panel.get("copy").disabled, false);
  restored.checked = true; restored.dispatch("change");
  assert.equal(structuredControl(panel, "Number of characters").getAttribute("aria-invalid"), "false");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  count.dispatch("blur");
  assert.deepEqual(visibleStructuredErrors(panel), []);
});

test("interacted Common text and reference inputs retain exact validation and immediate correction", () => {
  const panel = setupExtension();
  switchLibrary(panel, "common"); panel.choose("containsText");
  editStructured(panel, "Text to find kind", "textLiteral");
  editStructured(panel, "Text", "\t");
  assert.deepEqual(visibleStructuredErrors(panel), ["Expected text without control characters."]);
  editStructured(panel, "Text", "x");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  editStructured(panel, "Cell or range to search kind", "rangeRef");
  editStructured(panel, "Cell or range to search scope", "crossSheet");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  const reference = editStructured(panel, "Reference name", "{Broken");
  assert.equal(reference.getAttribute("aria-invalid"), "true");
  assert.deepEqual(visibleStructuredErrors(panel), ["Choose a balanced, nonempty reference name without internal braces."]);
  editStructured(panel, "Reference name", "Source");
  assert.equal(reference.getAttribute("aria-invalid"), "false");
  assert.deepEqual(visibleStructuredErrors(panel), []);
  assert.equal(panel.get("copy").disabled, false);
});

for (const [id, literalFormula, cellFormula, emptyFormula] of batch2UiCases) {
  test(`production Batch 2 literal/cell/empty, copy and Build/Back: ${id}`, async () => {
    const copied = [], calls = [];
    const panel = setupExtension({ clipboard: { writeText: async value => copied.push(value) } }, {}, core => {
      const generate = core.generateFormula;
      core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
    });
    const config = batch2.formulas.find(config => config.id === id);
    switchLibrary(panel, "common"); const button = panel.choose(id);
    assert.deepEqual(calls.at(-1), {});
    assert.equal(panel.get("copy").disabled, true);
    assert.equal(panel.document.activeElement, panel.get("build-title"));
    fillBatch2Text(panel, config);
    assert.equal(panel.get("formula-output").value, literalFormula);
    assertCommonGuidance(panel, id);
    assert.equal(panel.get("copy").disabled, false);
    assert.equal(panel.get("setup-details").hidden, false);
    assert.equal(panel.get("instructions-details").hidden, false);
    panel.get("copy").dispatch("click"); await tick();
    assert.deepEqual(copied, [literalFormula]);
    panel.get("back").dispatch("click");
    assert.equal(panel.document.activeElement, button);
    panel.choose(id);
    assert.equal(structuredControl(panel, "Text").value, " abc ");
    const fields = config.fields.filter(field => field.type === "textOperand");
    for (const field of fields) {
      editStructured(panel, `${field.label} kind`, "cellRef");
      assert.deepEqual(calls.at(-1)[field.id], { type: "cellRef", column: "" });
    }
    fields.forEach((field, index) => editStructured(panel, "Current-row column", ` Column ${index + 1} `, index));
    assert.equal(panel.get("formula-output").value, cellFormula);
    assert.equal(panel.get("validation").textContent, "");
    assert.equal(panel.get("reference-notice").hidden, true);
    panel.get("copy").dispatch("click"); await tick();
    assert.deepEqual(copied, [literalFormula, cellFormula]);
    for (const field of fields) {
      editStructured(panel, `${field.label} kind`, "textLiteral");
      assert.deepEqual(calls.at(-1)[field.id], { type: "textLiteral", value: "" });
    }
    assert.equal(panel.get("formula-output").value, emptyFormula);
    assert.equal(panel.get("copy").disabled, false);
    assert.equal(panel.get("setup-details").hidden, false);
    assert.equal(panel.get("instructions-details").hidden, false);
    assert.equal(panel.get("validation").textContent, "");
    assert.equal(JSON.stringify(calls).includes("uiState"), false);
    assert.equal(JSON.stringify(calls).includes("nextKey"), false);
    assert.deepEqual(panel.storageWrites, []);
  });
}

for (const [id, fieldId, label, omitted, included] of [
  ["leftText", "numChars", "Number of characters", '=LEFT(" abc ")', '=LEFT(" abc ", 3)'],
  ["rightText", "numChars", "Number of characters", '=RIGHT(" abc ")', '=RIGHT(" abc ", 3)'],
  ["findTextPosition", "startPosition", "Start position", '=FIND(" abc ", " abc ")', '=FIND(" abc ", " abc ", 3)'],
  ["substituteText", "instanceNumber", "Occurrence number", '=SUBSTITUTE(" abc ", " abc ", " abc ")', '=SUBSTITUTE(" abc ", " abc ", " abc ", 3)']
]) {
  test(`production Batch 2 optional integer raw drafts, omission and cleanup: ${id}`, () => {
    const calls = [];
    const panel = setupExtension({}, {}, core => {
      const generate = core.generateFormula;
      core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
    });
    switchLibrary(panel, "common"); panel.choose(id);
    fillBatch2Text(panel, batch2.formulas.find(config => config.id === id));
    assert.equal(panel.get("formula-output").value, omitted);
    const include = structuredControl(panel, `Include ${label}`);
    include.checked = true; include.dispatch("change");
    assert.equal(calls.at(-1)[fieldId], "");
    assert.equal(panel.get("copy").disabled, true);
    for (const raw of ["-", "1.", "-1"]) {
      const input = editStructured(panel, label, raw);
      assert.equal(input.getAttribute("aria-invalid"), "true");
      assert.ok(input.getAttribute("aria-describedby"));
      assert.equal(panel.document.activeElement, input);
      assert.equal(panel.get("copy").disabled, true);
      panel.get("back").dispatch("click"); panel.choose("textLength");
      fillBatch2Text(panel, batch2.formulas.find(config => config.id === "textLength"), "other draft");
      panel.get("back").dispatch("click"); switchLibrary(panel, "advanced");
      panel.choose("appendFinishDateLabel"); panel.get("back").dispatch("click");
      switchLibrary(panel, "common"); panel.choose(id);
      assert.equal(structuredControl(panel, label).value, raw);
    }
    const input = editStructured(panel, label, " 003 ");
    assert.equal(input.value, " 003 ");
    assert.equal(input.getAttribute("aria-invalid"), "false");
    assert.equal(panel.get("formula-output").value, included);
    assert.equal(panel.get("validation").textContent, "");
    panel.get("back").dispatch("click"); panel.choose(id);
    assert.equal(structuredControl(panel, label).value, " 003 ");
    const restored = structuredControl(panel, `Include ${label}`);
    restored.checked = false; restored.dispatch("change");
    assert.equal(Object.hasOwn(calls.at(-1), fieldId), false);
    assert.equal(panel.get("formula-output").value, omitted);
    restored.checked = true; restored.dispatch("change");
    assert.equal(calls.at(-1)[fieldId], "");
    assert.equal(panel.get("copy").disabled, true);
    restored.checked = false; restored.dispatch("change");
    assert.equal(panel.get("validation").textContent, "");
    assert.equal(panel.get("copy").disabled, false);
  });
}

test("production CONTAINS restricts targets and discards stale kind/scope members and errors", async () => {
  const calls = [], copied = [];
  const panel = setupExtension({ clipboard: { writeText: async value => copied.push(value) } }, {}, core => {
    const generate = core.generateFormula;
    core.generateFormula = (id, values) => { calls.push(JSON.parse(JSON.stringify(values))); return generate(id, values); };
  });
  await tick();
  switchLibrary(panel, "common"); panel.choose("containsText");
  editStructured(panel, "Text to find kind", "textLiteral");
  editStructured(panel, "Text", "{Reference}");
  const kindLabel = "Cell or range to search kind";
  assert.deepEqual(structuredControl(panel, kindLabel).children.map(option => option.value), ["", "cellRef", "columnRef", "rangeRef"]);
  editStructured(panel, kindLabel, "columnRef"); editStructured(panel, "Whole column", " Notes ");
  assert.equal(panel.get("formula-output").value, '=CONTAINS("{Reference}", [Notes]:[Notes])');
  assert.equal(panel.get("reference-section").hidden, true);
  assert.equal(panel.get("setup-details").hidden, false);
  assert.equal(panel.get("instructions-details").hidden, false);
  editStructured(panel, kindLabel, "rangeRef");
  assert.deepEqual(calls.at(-1).range, { type: "rangeRef" });
  assert.equal(panel.get("copy").disabled, true);
  editStructured(panel, "Cell or range to search scope", "currentSheet");
  assert.deepEqual(calls.at(-1).range, { type: "rangeRef", scope: "currentSheet", startColumn: "", endColumn: "" });
  editStructured(panel, "Start column", "Description"); editStructured(panel, "End column", "Notes");
  assert.equal(panel.get("formula-output").value, '=CONTAINS("{Reference}", [Description]:[Notes])');
  editStructured(panel, "Cell or range to search scope", "crossSheet");
  assert.deepEqual(calls.at(-1).range, { type: "rangeRef", scope: "crossSheet", name: "" });
  const invalid = editStructured(panel, "Reference name", "{Broken");
  assert.equal(invalid.getAttribute("aria-invalid"), "true");
  assert.equal(panel.get("copy").disabled, true);
  const input = editStructured(panel, "Reference name", " {{ Source Text }} ");
  assert.equal(input.value, " {{ Source Text }} ");
  assert.equal(input.getAttribute("aria-invalid"), "false");
  assert.equal(panel.get("validation").textContent, "");
  const formula = '=CONTAINS("{Reference}", {Source Text})';
  assert.equal(panel.get("formula-output").value, formula);
  assert.equal(panel.get("reference-notice").hidden, false);
  assert.equal(panel.get("reference-notice").textContent, "Setup required: 1 cross-sheet reference");
  assert.deepEqual(panel.get("references").children.map(node => node.textContent), ["{Source Text}"]);
  assert.equal(panel.get("setup-details").hidden, false);
  assert.equal(panel.get("instructions-details").hidden, false);
  panel.get("reference-notice").dispatch("click");
  assert.equal(panel.get("setup-details").open, true);
  assert.equal(panel.document.activeElement, panel.get("setup-summary"));
  panel.get("copy").dispatch("click"); await tick();
  assert.deepEqual(copied, [formula]);
  panel.get("theme-toggle").focus(); panel.get("theme-toggle").dispatch("click"); await tick();
  assert.equal(panel.get("formula-output").value, formula);
  assert.equal(structuredControl(panel, "Reference name"), input);
  assert.deepEqual(panel.storageWrites, [{ theme: "dark" }]);
  panel.get("back").dispatch("click"); panel.choose("containsText");
  assert.equal(structuredControl(panel, "Reference name").value, " {{ Source Text }} ");
  editStructured(panel, "Cell or range to search scope", "currentSheet");
  assert.deepEqual(calls.at(-1).range, { type: "rangeRef", scope: "currentSheet", startColumn: "", endColumn: "" });
  editStructured(panel, kindLabel, "cellRef");
  assert.deepEqual(calls.at(-1).range, { type: "cellRef", column: "" });
  editStructured(panel, "Current-row column", "Text");
  assert.equal(panel.get("formula-output").value, '=CONTAINS("{Reference}", [Text]@row)');
  assert.equal(panel.get("reference-notice").hidden, true);
  assert.equal(panel.get("reference-section").hidden, true);
  assert.equal(panel.get("validation").textContent, "");
  assert.equal(panel.get("setup-details").hidden, false);
  assert.equal(panel.get("instructions-details").hidden, false);
  assert.equal(descendants(panel.get("fields")).filter(node => node.className === "field-error" && !node.hidden).length, 0);
  assert.equal(JSON.stringify(calls).includes("uiState"), false);
});

test("empty guidance fallback survives structured/Advanced navigation and contextual references", () => {
  const panel = structuredPanel({}, core => {
    core.catalog.syntheticStructured.fields[0].defaultValue[0].range = { type: "columnRef", column: "Status" };
  });
  panel.choose("syntheticStructured");
  assert.equal(panel.get("setup-details").hidden, true);
  assert.equal(panel.get("instructions-details").hidden, true);
  editStructured(panel, "Range kind", "rangeRef");
  editStructured(panel, "Range scope", "crossSheet");
  editStructured(panel, "Reference name", "Source");
  assert.equal(panel.get("setup-details").hidden, false);
  assert.equal(panel.get("instructions-details").hidden, true);
  assert.deepEqual(panel.get("references").children.map(node => node.textContent), ["{Source}"]);
  editStructured(panel, "Range kind", "columnRef"); editStructured(panel, "Whole column", "Status");
  assert.equal(panel.get("setup-details").hidden, true);
  panel.get("back").dispatch("click"); switchLibrary(panel, "advanced");
  panel.choose("appendFinishDateLabel");
  const config = panel.core.catalog.appendFinishDateLabel;
  const expected = generalizedFixtures.cases.find(entry => entry.formulaType === config.id &&
    config.fields.every(field => entry.rawValues[field.id] === field.defaultValue)).expected;
  assert.equal(panel.get("setup-details").hidden, false);
  assert.equal(panel.get("instructions-details").hidden, false);
  assert.deepEqual(panel.get("setup-notes").children.map(node => node.textContent), expected.setupNotes);
  assert.deepEqual(panel.get("instructions").children.map(node => node.textContent), expected.instructions);
  panel.get("back").dispatch("click"); switchLibrary(panel, "common"); panel.choose("syntheticStructured");
  assert.equal(panel.get("setup-details").hidden, true);
  assert.equal(panel.get("instructions-details").hidden, true);
  assert.equal(panel.get("setup-notes").children.length, 0);
  assert.equal(panel.get("instructions").children.length, 0);
});

test("production FIND empty search stays valid through clipboard failure and text escaping", async () => {
  const panel = setupExtension({ clipboard: { writeText: async () => { throw new Error("unavailable"); } } });
  switchLibrary(panel, "common"); panel.choose("findTextPosition");
  editStructured(panel, "Text to find kind", "textLiteral");
  editStructured(panel, "Text to search kind", "textLiteral");
  editStructured(panel, "Text", "abc", 1);
  assert.equal(panel.get("formula-output").value, '=FIND("", "abc")');
  assert.equal(panel.get("copy").disabled, false);
  panel.get("copy").dispatch("click"); await tick();
  assert.match(panel.get("copy-status").textContent, /Could not copy/);
  assert.equal(panel.document.activeElement, panel.get("formula-output"));
  assert.equal(panel.get("formula-output").selected, true);
  const input = editStructured(panel, "Text", '"\\');
  assert.equal(input.value, '"\\');
  assert.equal(panel.get("formula-output").value, String.raw`=FIND("\"\\", "abc")`);
  assert.equal(panel.get("copy-status").textContent, "");
  editStructured(panel, "Text", "\t");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(panel.get("copy").disabled, true);
  editStructured(panel, "Text", " ");
  assert.equal(input.getAttribute("aria-invalid"), "false");
  assert.equal(panel.get("formula-output").value, '=FIND(" ", "abc")');
});

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
    assert.equal(get("setup-details").hidden, false);
    assert.equal(get("instructions-details").hidden, false);
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
