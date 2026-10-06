const assert = require("node:assert/strict");
const test = require("node:test");
const { setupStructuredFields } = require("./helpers/formula-extension-dom");
const { plain, config, loadValidation, pair } = require("./helpers/formula-structured-fixtures");
const validator = loadValidation().validation.structured;
const builder = { validateOptions() {}, validate() { return []; } };
const batch4 = require("./fixtures/formula-common-batch4-cases.json");
const validate = (fields, values) => plain(validator.normalizeAndValidate(config(fields), values, builder));
const walk = node => [node, ...node.children.flatMap(walk)];
const controls = node => walk(node).filter(node => ["input", "select", "button"].includes(node.tagName));
const helperText = (ui, control) => control.getAttribute("aria-describedby").split(" ").map(id => ui.document.getElementById(id).textContent).join(" ");
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function mount(fields, values = {}, formulaId = "test") {
  const dom = setupStructuredFields(), metadata = freeze(config(fields, { id: formulaId }));
  const changes = [];
  let snapshot = { values: freeze(values), uiState: freeze(dom.renderer.createUiState({ config: metadata, values })) };
  const controller = dom.renderer.mount({ container: dom.container, config: metadata, ...snapshot,
    onChange(change) { snapshot = change; changes.push(change); } });
  const at = address => { assert.ok(controller.focus(address), address); return dom.document.activeElement; };
  const set = (address, value) => {
    const input = at(address); input.value = value;
    input.dispatch(input.tagName === "select" ? "change" : "input"); return input;
  };
  return { ...dom, controller, changes, at, set, snapshot: () => plain(snapshot), metadata };
}

test("number and integer helpers keep exact wording, help/bounds order and input modes", () => {
  const ui = mount([{ id: "n", type: "number", help: "Specific guidance.", min: "0", max: "9" }, { id: "i", type: "integer" }]);
  assert.equal(helperText(ui, ui.at("n")), "Specific guidance. Enter a number. Minimum: 0. Maximum: 9.");
  assert.equal(helperText(ui, ui.at("i")), "Enter a whole number.");
  assert.equal(ui.at("n").getAttribute("inputmode"), "decimal"); assert.equal(ui.at("i").getAttribute("inputmode"), "numeric");
  ui.set("n", "0001.20"); ui.set("i", "2");
  assert.deepEqual(validate(ui.metadata.fields, ui.snapshot().values).values, { n: "1.2", i: "2" });
});

test("nested/repeatable Number helper is Enter a number", () => {
  const ui = mount([{ id: "nested", type: "object", fields: [{ id: "rows", type: "array", items: { type: "numericOperand" } }] }], { nested: { rows: [{ type: "number", value: "-" }] } });
  assert.equal(helperText(ui, ui.at("nested.rows[r1].value")), "Enter a number.");
});

test("comparison labels and choices use plain language without changing semantic paths or defaults", () => {
  const ui = mount([{ id: "condition", type: "condition", label: "Condition" }, { id: "trueOutput", type: "outputOperand", label: "True output" }, { id: "falseOutput", type: "outputOperand", label: "False output", required: false }]);
  const labels = () => walk(ui.container).filter(node => node.tagName === "label").map(node => node.textContent);
  assert.ok(labels().includes("First value type")); assert.ok(labels().includes("Second value type"));
  assert.ok(labels().includes("Comparison")); assert.ok(labels().includes("True output type"));
  assert.ok(walk(ui.container).some(node => node.tagName === "legend" && node.textContent === "First value"));
  assert.ok(walk(ui.container).some(node => node.tagName === "legend" && node.textContent === "Second value"));
  assert.deepEqual(ui.snapshot().values, {});
  const first = ui.at("condition.left.type"), id = first.id;
  assert.equal(first.value, "");
  assert.deepEqual(first.children.map(node => [node.value, node.textContent]), [["", "Choose…"], ["textLiteral", "Specific text string"], ["number", "Number"], ["boolean", "Boolean"], ["date", "Date"], ["cellRef", "Cell in this row"], ["blank", "Blank"]]);
  const include = ui.at("falseOutput:include"); include.checked = true; include.dispatch("change");
  assert.ok(labels().includes("False output type"));
  assert.ok(labels().every(label => !/Left operand|Right operand|\bOperator\b|\bkind\b/.test(label)));
  ui.set("condition.left.type", "cellRef");
  assert.deepEqual(ui.snapshot().values.condition.left, { type: "cellRef", column: "" });
  assert.equal(ui.at("condition.left.type").id, id);
  assert.equal(ui.snapshot().uiState.touched["condition.left.type"], true);
});

test("condition required errors use mapped labels while retaining exact engine records and ordering", () => {
  const ui = mount([{ id: "conditions", label: "Condition", type: "array", minItems: 1, items: { type: "condition" } }], { conditions: [{}, {}] });
  const errors = freeze(validate(ui.metadata.fields, ui.snapshot().values).errors);
  const before = JSON.stringify(errors);
  const visible = () => walk(ui.container).filter(node => node.className === "field-error" && !node.hidden).map(node => node.textContent);
  ui.controller.update({ validationErrors: errors }); assert.deepEqual(visible(), []);
  ui.at("conditions[r1].left.type").dispatch("blur");
  ui.at("conditions[r1].operator").dispatch("blur");
  ui.at("conditions[r1].right.type").dispatch("blur");
  ui.at("conditions[r2].left.type").dispatch("blur");
  assert.deepEqual(visible(), ["Choose a first value type.", "Choose a comparison.", "Choose a second value type.", "Choose a first value type."]);
  assert.deepEqual(errors.map(error => [error.path, error.code]), [
    ["conditions[0].left", "required"], ["conditions[0].operator", "required"], ["conditions[0].right", "required"],
    ["conditions[1].left", "required"], ["conditions[1].operator", "required"], ["conditions[1].right", "required"]
  ]);
  const survivor = ui.at("conditions[r2].left.type");
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Condition 1").dispatch("click");
  const reindexed = validate(ui.metadata.fields, ui.snapshot().values).errors;
  ui.controller.update({ validationErrors: reindexed });
  assert.equal(ui.at("conditions[r2].left.type"), survivor);
  assert.equal(reindexed[0].path, "conditions[0].left");
  assert.deepEqual(visible(), ["Choose a first value type."]);
  assert.doesNotMatch(visible().join(" "), /conditions\[|\.left|\.right/);
  assert.equal(JSON.stringify(errors), before);
});

test("nested condition arrays and empty collections get friendly reusable errors", () => {
  const fields = [{ id: "nested", type: "object", fields: [{ id: "checks", label: "Condition", type: "condition[]" }] }];
  const ui = mount(fields, { nested: { checks: [] } });
  ui.at("nested.checks:add").dispatch("blur");
  ui.controller.update({ validationErrors: validate(fields, ui.snapshot().values).errors });
  assert.ok(walk(ui.container).some(node => node.className === "field-error" && !node.hidden && node.textContent === "Add at least one condition."));
  ui.at("nested.checks:add").dispatch("click");
  ui.at("nested.checks[r1].right.type").dispatch("blur");
  ui.controller.update({ validationErrors: validate(fields, ui.snapshot().values).errors });
  assert.ok(walk(ui.container).some(node => node.className === "field-error" && !node.hidden && node.textContent === "Choose a second value type."));
});

test("numeric presentation translates only ordinary decimal syntax and retains specific constraints", () => {
  const fields = [{ id: "n", label: "Number", type: "number", min: "0", max: "9" }, { id: "i", label: "Count", type: "integer" }, { id: "name", label: "Name", type: "text", requiredMessage: "Choose the source name first." }];
  const ui = mount(fields);
  const refresh = () => { const result = validate(fields, ui.snapshot().values); ui.controller.update({ validationErrors: result.errors }); return result; };
  const number = ui.set("n", "j"), result = refresh();
  assert.equal(result.errors[0].message, "Use decimal syntax.");
  assert.equal(number.value, "j"); assert.match(helperText(ui, number), /Enter a number\./);
  assert.doesNotMatch(helperText(ui, number), /decimal syntax/);
  ui.set("i", "1.2"); refresh(); assert.match(helperText(ui, ui.at("i")), /Use integer syntax\./);
  ui.set("n", "10"); refresh(); assert.match(helperText(ui, number), /Value must be at most 9\./);
  ui.set("n", "-1"); refresh(); assert.match(helperText(ui, number), /Value must be at least 0\./);
  ui.set("n", "9007199254740993"); refresh(); assert.match(helperText(ui, number), /Use a number from -9007199254740992 through 9007199254740992\./);
  ui.at("name").dispatch("blur"); refresh(); assert.match(helperText(ui, ui.at("name")), /Choose the source name first\./);
});

for (const batch of [require("./fixtures/formula-common-batch1-cases.json"), batch4]) for (const formula of batch.formulas) {
  test(`production numeric helper policy: ${formula.id}`, () => {
    const fields = require("./helpers/load-formula-core").loadFormulaCore().catalog[formula.id].fields;
    const ui = mount(fields);
    const numeric = fields.find(field => field.type === "numericOperand");
    if (numeric) {
      ui.set(`${numeric.id}.type`, "number");
      assert.equal(helperText(ui, ui.at(`${numeric.id}.value`)), "Enter a number.");
    } else if (fields[0].type === "array") {
      ui.at("values:add").dispatch("click");
      if (fields[0].items.allowedTypes.includes("number")) {
        ui.set("values[r1].type", "number");
        assert.equal(helperText(ui, ui.at("values[r1].value")), "Enter a number.");
      } else {
        ui.set("values[r1].type", "cellRef");
        assert.doesNotMatch(ui.container.textContent, /Enter a number\./);
      }
    }
    assert.doesNotMatch(ui.container.textContent, /Enter a decimal number\./);
  });
}

for (const [type, raw] of [["text", "<b>literal</b>"], ["number", "-"], ["number", "1."], ["number", "0001.230000000000001"], ["integer", "-"], ["date", "2026-"], ["columnName", " Status "], ["referenceName", "{{ Statuses }}"]]) {
  test(`${type} preserves raw ${JSON.stringify(raw)} and the focused input node`, () => {
    const ui = mount([{ id: "value", type, label: "Value" }]);
    const input = ui.set("value", raw);
    assert.equal(input.type, "text");
    assert.equal(ui.snapshot().values.value, raw);
    assert.equal(ui.at("value"), input);
    const result = validate(ui.metadata.fields, ui.snapshot().values);
    ui.controller.update({ ...ui.snapshot(), validationErrors: result.errors });
    assert.equal(ui.document.activeElement, input);
    assert.equal(ui.at("value"), input);
    assert.equal(ui.changes.length, 1);
  });
}

test("Boolean starts absent and optional Include uses incomplete text, never false", () => {
  const ui = mount([{ id: "required", type: "boolean" }, { id: "optional", type: "boolean", required: false }]);
  assert.equal(ui.at("required").value, "");
  assert.deepEqual(ui.snapshot().values, {});
  const include = ui.at("optional:include"); include.checked = true; include.dispatch("change");
  assert.deepEqual(ui.snapshot().values, { optional: "" });
  assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 2);
  ui.set("required", "false"); ui.set("optional", "true");
  assert.deepEqual(ui.snapshot().values, { required: false, optional: true });
  assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0);
  include.checked = false; include.dispatch("change");
  assert.deepEqual(ui.snapshot().values, { required: false });
});

for (const type of ["text", "number", "integer", "date", "boolean", "object", "array", "typedOperand"]) {
  test(`optional ${type} Include constructs a fresh starter and deletion is omission`, () => {
    const field = { id: "value", type, required: false, ...(type === "object" ? { fields: [{ id: "child", type: "text" }] } : {}), ...(type === "array" ? { items: { type: "boolean" }, minItems: 2 } : {}) };
    const ui = mount([field]);
    const include = ui.at("value:include"); include.checked = true; include.dispatch("change");
    const expected = type === "array" ? [] : ["object", "typedOperand"].includes(type) ? {} : "";
    assert.deepEqual(ui.snapshot().values, { value: expected });
    const detached = controls(ui.container).filter(control => control !== include);
    include.checked = false; include.dispatch("change");
    assert.deepEqual(ui.snapshot().values, {});
    for (const control of detached) { control.value = "ignored"; control.dispatch("input"); control.dispatch("change"); control.dispatch("click"); }
    assert.equal(ui.changes.length, 2);
    include.checked = true; include.dispatch("change");
    assert.deepEqual(ui.snapshot().values, { value: expected });
  });
}

const scalarOrder = ["textLiteral", "number", "boolean", "date", "cellRef", "blank"];
const familyChoices = {
  typedOperand: scalarOrder, valueOperand: scalarOrder, outputOperand: scalarOrder,
  numericOperand: ["number", "cellRef"], dateOperand: ["date", "cellRef"], textOperand: ["textLiteral", "cellRef"],
  valueOrRange: [...scalarOrder, "columnRef", "rangeRef"], range: ["columnRef", "rangeRef"],
  cellRef: ["cellRef"], columnRef: ["columnRef"], rangeRef: ["rangeRef"]
};
const validOperands = {
  textLiteral: { type: "textLiteral", value: "" }, number: { type: "number", value: "12" }, boolean: { type: "boolean", value: false },
  date: { type: "date", value: "2026-09-15" }, cellRef: { type: "cellRef", column: "Status" }, blank: { type: "blank" },
  columnRef: { type: "columnRef", column: "Amount" }, rangeRef: { type: "rangeRef", scope: "crossSheet", name: "Amounts" }
};
for (const [type, expected] of Object.entries(familyChoices)) {
  test(`${type} choices match exactly the real core accepted union in fixed order`, () => {
    const fields = [{ id: "value", type }], ui = mount(fields);
    assert.equal(ui.at("value.type").value, "");
    assert.deepEqual(ui.at("value.type").children.map(option => option.value), ["", ...expected]);
    for (const [kind, operand] of Object.entries(validOperands)) {
      assert.equal(validate(fields, { value: operand }).errors.length === 0, expected.includes(kind), kind);
    }
    for (const kind of expected) {
      const selector = ui.set("value.type", kind);
      assert.equal(ui.document.activeElement, selector);
      assert.equal(ui.snapshot().values.value.type, kind);
      const data = validOperands[kind];
      if (kind === "rangeRef") ui.set("value.scope", "crossSheet");
      for (const [key, value] of Object.entries(data)) if (!["type", "scope"].includes(key)) ui.set(`value.${key}`, String(value));
      assert.deepEqual(ui.snapshot().values.value, data);
      assert.equal(validate(fields, ui.snapshot().values).errors.length, 0);
    }
  });
}

test("allowedTypes preserves declared order and rejects unsupported type sets in the core", () => {
  const fields = [{ id: "value", type: "outputOperand", allowedTypes: ["blank", "number", "textLiteral"] }];
  const ui = mount(fields);
  assert.deepEqual(ui.at("value.type").children.map(option => option.value), ["", "blank", "number", "textLiteral"]);
  for (const [type, value] of Object.entries(validOperands)) assert.equal(validate(fields, { value }).errors.length === 0, fields[0].allowedTypes.includes(type));
  assert.throws(() => validator.createDefaultValues(config([{ id: "value", type: "numericOperand", allowedTypes: ["blank"] }])), /configuration/);
});

test("type switching discards data, has no cache, and detaches old listeners", () => {
  const ui = mount([{ id: "value", type: "typedOperand" }]);
  const typeNode = ui.set("value.type", "number"); const old = ui.set("value.value", "-");
  ui.set("value.type", "boolean");
  assert.deepEqual(ui.snapshot().values.value, { type: "boolean" });
  assert.equal(ui.at("value.value").value, "");
  const count = ui.changes.length; old.value = "1"; old.dispatch("input"); assert.equal(ui.changes.length, count);
  ui.set("value.type", "blank"); assert.deepEqual(ui.snapshot().values.value, { type: "blank" });
  ui.set("value.type", "number"); assert.deepEqual(ui.snapshot().values.value, { type: "number", value: "" });
  assert.equal(ui.at("value.type"), typeNode);
});

test("range kind and scope switching discard obsolete members and preserve selector focus", () => {
  const ui = mount([{ id: "value", type: "range" }]);
  ui.set("value.type", "rangeRef"); assert.deepEqual(ui.snapshot().values.value, { type: "rangeRef" });
  const scope = ui.set("value.scope", "currentSheet");
  ui.set("value.startColumn", "Start"); const old = ui.set("value.endColumn", "End");
  assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0);
  ui.set("value.scope", "crossSheet"); assert.equal(ui.document.activeElement, scope);
  assert.deepEqual(ui.snapshot().values.value, { type: "rangeRef", scope: "crossSheet", name: "" });
  ui.set("value.name", "{{ Named }}"); assert.equal(ui.snapshot().values.value.name, "{{ Named }}");
  const count = ui.changes.length; old.dispatch("input"); assert.equal(ui.changes.length, count);
  ui.set("value.type", "columnRef"); assert.deepEqual(ui.snapshot().values.value, { type: "columnRef", column: "" });
  scope.dispatch("change"); assert.equal(ui.changes.length, count + 1);
});

test("comparison operators are exact, with enum narrowing and native labels", () => {
  for (const choices of [["=", "<>", ">", "<", ">=", "<="], ["=", "<>"]]) {
    const ui = mount([{ id: "operator", type: "comparisonOperator", enum: choices }]);
    const input = ui.at("operator");
    assert.equal(input.tagName, "select");
    assert.deepEqual(input.children.map(node => node.value), ["", ...choices]);
    choices.forEach(value => { ui.set("operator", value); assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0); });
  }
});

for (const type of ["condition", "criterion", "object"]) {
  test(`${type} constructs accepted composite member paths without defaults`, () => {
    const schema = { id: "group", type, ...(type === "object" ? { fields: [{ id: "nested", type: "text", required: false }] } : {}) };
    const ui = mount([schema]); assert.deepEqual(ui.snapshot().values, {});
    if (type === "object") { const include = ui.at("group.nested:include"); include.checked = true; include.dispatch("change"); }
    else {
      if (type === "condition") ui.set("group.left.type", "blank");
      ui.set("group.operator", "="); ui.set(type === "condition" ? "group.right.type" : "group.value.type", "blank");
    }
    assert.equal(validate([schema], ui.snapshot().values).errors.length, 0);
    assert.ok(walk(ui.container).some(node => node.tagName === "fieldset"));
    assert.ok(walk(ui.container).some(node => node.tagName === "legend"));
  });
}

for (const [type, minimum] of [["criteria[]", 1], ["condition[]", 1], ["valueOrRange[]", 1], ["array", 0], ["array", 2]]) {
  test(`${type} minimum ${minimum}: no silent rows, fresh starters, explicit Add and removal guard`, () => {
    const schema = { id: "rows", label: "Rows", type, minItems: minimum, ...(type === "array" ? { items: { type: "boolean" } } : {}) };
    const ui = mount([schema]); assert.deepEqual(ui.snapshot().values, {});
    assert.deepEqual(ui.snapshot().uiState, { nextKey: 1, rows: {}, touched: {} });
    ui.at("rows:add").dispatch("click");
    assert.deepEqual(ui.snapshot().values.rows, [type === "array" ? "" : {}]);
    assert.deepEqual(ui.snapshot().uiState, { nextKey: 2, rows: { rows: ["r1"] }, touched: { rows: true } });
    assert.equal(ui.document.activeElement, ui.at("rows[r1]"));
    assert.ok(validate([schema], ui.snapshot().values).errors.length);
    const remove = walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Rows 1");
    assert.equal(remove.disabled, minimum > 0);
    const count = ui.changes.length; remove.dispatch("click");
    assert.equal(ui.changes.length, count + (minimum === 0 ? 1 : 0));
    if (minimum === 0) { assert.deepEqual(ui.snapshot().values.rows, []); assert.equal(ui.document.activeElement, ui.at("rows:add")); }
  });
}

for (const [removeIndex, expectedKey] of [[0, "r2"], [1, "r3"], [2, "r2"]]) {
  test(`remove row ${removeIndex + 1} retains other nodes, keys, dense values, focus and current index edits`, () => {
    const ui = mount([{ id: "rows", label: "Rows", type: "array", items: { type: "text" } }], { rows: ["a", "b", "c"] });
    const before = ["r1", "r2", "r3"].map(key => ui.at(`rows[${key}]`));
    const removed = before[removeIndex];
    walk(ui.container).find(node => node.getAttribute("aria-label") === `Remove Rows ${removeIndex + 1}`).dispatch("click");
    assert.equal(ui.document.activeElement, before[["r1", "r2", "r3"].indexOf(expectedKey)]);
    const expectedKeys = ["r1", "r2", "r3"].filter((_, index) => index !== removeIndex);
    assert.deepEqual(ui.snapshot().uiState.rows.rows, expectedKeys);
    expectedKeys.forEach(key => assert.equal(ui.at(`rows[${key}]`), before[["r1", "r2", "r3"].indexOf(key)]));
    const count = ui.changes.length; removed.dispatch("input"); assert.equal(ui.changes.length, count);
    ui.set(`rows[${expectedKey}]`, "changed");
    assert.equal(ui.snapshot().values.rows[expectedKeys.indexOf(expectedKey)], "changed");
    assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0);
    ui.at("rows:add").dispatch("click");
    assert.equal(ui.snapshot().uiState.rows.rows.at(-1), "r4");
  });
}

test("removal to minimum focuses an editor, never the newly disabled Remove", () => {
  const ui = mount([{ id: "rows", label: "Rows", type: "array", minItems: 2, items: { type: "text" } }], { rows: ["a", "b", "c"] });
  const next = ui.at("rows[r2]");
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Rows 1").dispatch("click");
  assert.equal(ui.document.activeElement, next);
  assert.ok(walk(ui.container).filter(node => node.textContent === "Remove").every(node => node.disabled));
});

test("nested repeatables remove descendant keys and preserve sibling state and snapshots", () => {
  const fields = [{ id: "groups", type: "array", items: { type: "object", fields: [{ id: "rows", type: "array", items: { type: "text" } }] } }];
  const original = { groups: [{ rows: ["a"] }, { rows: ["b"] }] };
  const ui = mount(fields, original);
  assert.deepEqual(ui.snapshot().uiState, { nextKey: 5, rows: { groups: ["r1", "r2"], "groups[r1].rows": ["r3"], "groups[r2].rows": ["r4"] }, touched: {} });
  const sibling = ui.at("groups[r2].rows[r4]");
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove groups 1").dispatch("click");
  assert.deepEqual(ui.snapshot().uiState.rows, { groups: ["r2"], "groups[r2].rows": ["r4"] });
  assert.equal(ui.at("groups[r2].rows[r4]"), sibling);
  const first = ui.changes[0]; ui.set("groups[r2].rows[r4]", "second");
  assert.equal(first.values.groups[0].rows[0], "b");
  first.values.groups[0].rows[0] = "external mutation";
  assert.equal(ui.snapshot().values.groups[0].rows[0], "second");
  assert.equal(original.groups[1].rows[0], "b");
  assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0);
});

test("declared defaults, aliased siblings and formulas are deeply independent", () => {
  const shared = pair(); const fields = freeze([{ id: "criteria", type: "criteria[]", defaultValue: [shared, shared] }]);
  const first = mount(fields, validator.createDefaultValues(config(fields)), "first");
  const second = mount(fields, validator.createDefaultValues(config(fields)), "second");
  first.set("criteria[r1].criterion.value.value", "changed");
  assert.equal(first.snapshot().values.criteria[1].criterion.value.value, "Open");
  assert.equal(second.snapshot().values.criteria[0].criterion.value.value, "Open");
  assert.equal(shared.criterion.value.value, "Open");
  assert.notEqual(first.at("criteria[r1].criterion.value.value").id, second.at("criteria[r1].criterion.value.value").id);
  assert.equal(JSON.stringify(first.snapshot().values).includes("r1"), false);
});

test("destroy removes every listener and owned DOM, update never emits", () => {
  const ui = mount([{ id: "rows", type: "criteria[]" }], { rows: [pair(), pair()] });
  const detached = controls(ui.container);
  ui.controller.update(ui.snapshot()); assert.equal(ui.changes.length, 0);
  ui.controller.destroy(); ui.controller.destroy();
  detached.forEach(node => { node.dispatch("input"); node.dispatch("change"); node.dispatch("click"); node.dispatch("blur"); });
  assert.equal(ui.changes.length, 0); assert.equal(ui.container.children.length, 0);
  assert.equal(ui.controller.focus("rows"), false);
});

test("errors resolve exact, group, row, array, ancestor and form paths in order as literal text", () => {
  const ui = mount([{ id: "criteria", type: "criteria[]" }], { criteria: [pair(), pair()] });
  const focus = ui.at("criteria[r1].criterion.value.value");
  focus.dispatch("blur");
  const paths = ["criteria[0].criterion.value.value", "criteria[0].criterion.value", "criteria[0]", "criteria", "criteria[0].criterion.missing", "", "unmatched"];
  const errors = paths.map((path, index) => ({ path, code: "test", message: `<b>${index}</b>` }));
  errors.push({ path: paths[0], code: "second", message: "second" });
  ui.controller.update({ validationErrors: errors });
  assert.equal(ui.document.activeElement, focus);
  assert.equal(focus.getAttribute("aria-invalid"), "true");
  const error = ui.document.getElementById(focus.getAttribute("aria-describedby").split(" ").at(-1));
  assert.equal(error.textContent, "<b>0</b>\nsecond"); assert.equal(error.children.length, 0);
  const shown = walk(ui.container).filter(node => node.className === "field-error" && !node.hidden);
  assert.equal(shown.length, 6);
  assert.ok(shown.some(node => node.textContent === "<b>5</b>\n<b>6</b>"));
  ui.controller.update({ validationErrors: [] });
  assert.ok(walk(ui.container).filter(node => node.className === "field-error").every(node => node.hidden));
  assert.equal(focus.getAttribute("aria-invalid"), "false");
  assert.equal(ui.changes.length, 1);
});

test("error paths reindex after removal while DOM and error IDs remain stable", () => {
  const ui = mount([{ id: "rows", label: "Rows", type: "array", items: { type: "number" } }], { rows: ["1", "-"] });
  const input = ui.at("rows[r2]");
  input.dispatch("blur");
  ui.controller.update({ validationErrors: validate(ui.metadata.fields, ui.snapshot().values).errors });
  const errorId = input.getAttribute("aria-describedby").split(" ").at(-1);
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Rows 1").dispatch("click");
  ui.controller.update({ validationErrors: validate(ui.metadata.fields, ui.snapshot().values).errors });
  assert.equal(ui.at("rows[r2]"), input);
  assert.equal(input.getAttribute("aria-describedby").split(" ").at(-1), errorId);
  assert.equal(input.getAttribute("aria-invalid"), "true");
  const ids = walk(ui.container).filter(node => node.id).map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const label of walk(ui.container).filter(node => node.tagName === "label")) assert.ok(ui.document.getElementById(label.getAttribute("for")));
  for (const node of walk(ui.container)) for (const id of (node.getAttribute("aria-describedby") || "").split(" ").filter(Boolean)) assert.ok(ui.document.getElementById(id));
});

test("empty-object row focuses the group fallback instead of Remove", () => {
  const ui = mount([{ id: "rows", type: "array", items: { type: "object", fields: [] } }]);
  ui.at("rows:add").dispatch("click");
  assert.equal(ui.document.activeElement.tagName, "fieldset");
  assert.equal(ui.document.activeElement.getAttribute("tabindex"), "-1");
});

test("generic arrays default to zero and shorthand minItems zero still requires one", () => {
  for (const type of ["array", "criteria[]", "condition[]", "valueOrRange[]"]) {
    const field = { id: "rows", type, ...(type === "array" ? { items: { type: "text" } } : { minItems: 0 }) };
    const ui = mount([field], { rows: [] });
    assert.equal(validate([field], ui.snapshot().values).errors.length, type === "array" ? 0 : 1);
    assert.deepEqual(ui.snapshot().values, { rows: [] });
    ui.at("rows:add").dispatch("click");
    const remove = walk(ui.container).find(node => node.textContent === "Remove");
    assert.equal(remove.disabled, type !== "array");
  }
});

test("explicit nested Include removes descendant row state and never reuses keys", () => {
  const fields = [{ id: "group", type: "object", fields: [{ id: "rows", type: "array", required: false, items: { type: "text" } }] }];
  const ui = mount(fields, { group: { rows: ["first"] } });
  const include = ui.at("group.rows:include"); include.checked = false; include.dispatch("change");
  assert.deepEqual(ui.snapshot().values, { group: {} });
  assert.deepEqual(ui.snapshot().uiState, { nextKey: 2, rows: {}, touched: {} });
  include.checked = true; include.dispatch("change"); ui.at("group.rows:add").dispatch("click");
  assert.deepEqual(ui.snapshot().uiState, { nextKey: 3, rows: { "group.rows": ["r2"] }, touched: { "group.rows": true } });
});

test("repeatable rows emit complete validator-compatible criteria, conditions and values", () => {
  for (const type of ["criteria[]", "condition[]", "valueOrRange[]"]) {
    const ui = mount([{ id: "rows", type }]); ui.at("rows:add").dispatch("click");
    if (type === "criteria[]") {
      ui.set("rows[r1].range.type", "columnRef"); ui.set("rows[r1].range.column", "Status");
      ui.set("rows[r1].criterion.operator", "="); ui.set("rows[r1].criterion.value.type", "blank");
    } else if (type === "condition[]") {
      ui.set("rows[r1].left.type", "blank"); ui.set("rows[r1].operator", "="); ui.set("rows[r1].right.type", "blank");
    } else ui.set("rows[r1].type", "blank");
    assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0);
    const first = plain(ui.changes.at(-1)); ui.at("rows:add").dispatch("click");
    assert.deepEqual(ui.snapshot().values.rows, [first.values.rows[0], {}]);
  }
});

test("Boolean repeatable starter requires an explicit choice and respects false", () => {
  const ui = mount([{ id: "rows", type: "array", items: { type: "boolean", defaultValue: true } }]);
  ui.at("rows:add").dispatch("click"); assert.deepEqual(ui.snapshot().values.rows, [""]);
  ui.set("rows[r1]", "false"); assert.deepEqual(ui.snapshot().values.rows, [false]);
  assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0);
  ui.at("rows:add").dispatch("click"); assert.deepEqual(ui.snapshot().values.rows, [false, ""]);
});

test("standalone enum keeps declared choices and selected string", () => {
  const ui = mount([{ id: "choice", type: "enum", enum: ["B", "A"] }]);
  assert.deepEqual(ui.at("choice").children.map(node => node.value), ["", "B", "A"]);
  ui.set("choice", "A"); assert.deepEqual(ui.snapshot().values, { choice: "A" });
  assert.equal(validate(ui.metadata.fields, ui.snapshot().values).errors.length, 0);
});

test("row labels reindex along with Remove names without replacing inputs", () => {
  const ui = mount([{ id: "rows", label: "Rows", type: "array", items: { type: "number" } }], { rows: ["1", "2"] });
  const input = ui.at("rows[r2]");
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Rows 1").dispatch("click");
  const label = walk(ui.container).find(node => node.getAttribute("for") === input.id);
  assert.equal(label.textContent, "Rows 1");
  assert.equal(walk(ui.container).find(node => node.textContent === "Remove").getAttribute("aria-label"), "Remove Rows 1");
});

test("unrecognized builder path syntax reaches form fallback and stale optional errors disappear", () => {
  const ui = mount([{ id: "note", type: "text", required: false }]);
  const include = ui.at("note:include"); include.checked = true; include.dispatch("change");
  ui.at("note").dispatch("blur");
  ui.controller.update({ validationErrors: [
    { path: "unknown[thing]", code: "custom", message: "Unmatched" },
    { path: "note", code: "custom", message: "Include a note" }
  ] });
  assert.match(ui.container.textContent, /Unmatched/);
  include.checked = false; include.dispatch("change");
  ui.controller.update({ validationErrors: [] });
  assert.ok(walk(ui.container).filter(node => node.className === "field-error").every(node => node.hidden && !node.textContent));
  assert.ok(walk(ui.container).every(node => node.getAttribute("aria-invalid") !== "true"));
});

test("range row scope labels use the current position even after editor replacement", () => {
  const ui = mount([{ id: "rows", label: "Rows", type: "array", items: { type: "range" } }], { rows: [validOperands.columnRef, validOperands.columnRef] });
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Rows 1").dispatch("click");
  ui.set("rows[r2].type", "rangeRef");
  const scope = ui.at("rows[r2].scope");
  assert.equal(walk(ui.container).find(node => node.getAttribute("for") === scope.id).textContent, "Rows 1 scope");
});

test("friendly text labels preserve semantic types, control IDs, legends and touched addresses", () => {
  const ui = mount([{ id: "source", label: "Source text", type: "textOperand" }]);
  const selector = ui.at("source.type"), selectorId = selector.id;
  assert.deepEqual(selector.children.map(node => [node.value, node.textContent]).slice(1), [
    ["textLiteral", "Specific text string"], ["cellRef", "Cell in this row"]
  ]);
  ui.set("source.type", "textLiteral");
  const input = ui.at("source.value"), inputId = input.id;
  assert.equal(walk(ui.container).find(node => node.getAttribute("for") === input.id).textContent, "Text");
  assert.ok(walk(ui.container).some(node => node.tagName === "legend" && node.textContent === "Source text"));
  ui.set("source.value", '  "raw"  ');
  assert.deepEqual(ui.snapshot().values, { source: { type: "textLiteral", value: '  "raw"  ' } });
  assert.deepEqual(ui.snapshot().uiState.touched, { "source.type": true, "source.value": true });
  ui.set("source.type", "cellRef");
  assert.deepEqual(ui.snapshot().values, { source: { type: "cellRef", column: "" } });
  ui.set("source.type", "textLiteral");
  assert.deepEqual(ui.snapshot().values, { source: { type: "textLiteral", value: "" } });
  assert.equal(ui.at("source.type").id, selectorId);
  assert.equal(ui.at("source.value").id, inputId);
  assert.deepEqual(ui.snapshot().uiState.touched, { "source.type": true });
});

test("untouched fields stay clean; blur and input reveal only their associated errors", () => {
  const ui = mount([{ id: "first", type: "integer", help: "First help" }, { id: "second", type: "integer" }]);
  const refresh = () => ui.controller.update({ validationErrors: validate(ui.metadata.fields, ui.snapshot().values).errors });
  refresh();
  const first = ui.at("first"), help = first.getAttribute("aria-describedby");
  assert.equal(first.getAttribute("aria-invalid"), "false");
  assert.equal(ui.controller.getVisibleErrorCount(), 0);
  assert.deepEqual(ui.snapshot().uiState.touched, {});
  first.dispatch("blur");
  assert.equal(first.getAttribute("aria-invalid"), "true");
  assert.equal(ui.controller.getVisibleErrorCount(), 1);
  assert.equal(ui.at("second").getAttribute("aria-invalid"), "false");
  assert.deepEqual(ui.snapshot().values, {});
  assert.deepEqual(ui.snapshot().uiState.touched, { first: true });
  ui.set("first", "-"); refresh();
  const expected = validate(ui.metadata.fields, ui.snapshot().values).errors.find(error => error.path === "first").message;
  assert.equal(ui.document.getElementById(first.getAttribute("aria-describedby").split(" ").at(-1)).textContent, expected);
  ui.set("first", " 003 "); refresh();
  assert.equal(first.getAttribute("aria-invalid"), "false");
  assert.equal(first.getAttribute("aria-describedby"), help);
  assert.equal(ui.controller.getVisibleErrorCount(), 0);
  assert.equal(first.value, " 003 ");
});

test("type and scope replacements reset only replaced input interaction; detached blur is inert", () => {
  const ui = mount([{ id: "value", type: "typedOperand" }]);
  ui.set("value.type", "number"); const old = ui.set("value.value", "-");
  ui.set("value.type", "date");
  assert.deepEqual(ui.snapshot().uiState.touched, { "value.type": true });
  ui.controller.update({ validationErrors: validate(ui.metadata.fields, ui.snapshot().values).errors });
  assert.equal(ui.at("value.value").getAttribute("aria-invalid"), "false");
  const count = ui.changes.length; old.dispatch("blur"); assert.equal(ui.changes.length, count);
  const range = mount([{ id: "range", type: "range" }]);
  range.set("range.type", "rangeRef"); range.set("range.scope", "currentSheet");
  range.at("range.startColumn").dispatch("blur");
  range.set("range.scope", "crossSheet"); range.at("range.name").dispatch("blur");
  range.set("range.scope", "currentSheet");
  assert.deepEqual(range.snapshot().uiState.touched, { "range.type": true, "range.scope": true });
});

test("repeatable touched state survives reindexing without touching siblings and is pruned on removal", () => {
  const ui = mount([{ id: "rows", label: "Rows", type: "array", items: { type: "integer" } }], { rows: ["", "", ""] });
  ui.at("rows[r2]").dispatch("blur");
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Rows 1").dispatch("click");
  ui.controller.update({ validationErrors: validate(ui.metadata.fields, ui.snapshot().values).errors });
  assert.deepEqual(ui.snapshot().uiState.touched, { "rows[r2]": true });
  assert.equal(ui.at("rows[r2]").getAttribute("aria-invalid"), "true");
  assert.equal(ui.at("rows[r3]").getAttribute("aria-invalid"), "false");
  walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Rows 1").dispatch("click");
  assert.deepEqual(ui.snapshot().uiState.touched, {});
});

for (const config of batch4.formulas) {
  test(`Batch 4 repeatable keys, paths, touched pruning and raw semantics: ${config.id}`, () => {
    const ui = mount(plain(config.fields), {}, config.id);
    const refresh = () => {
      const result = validate(ui.metadata.fields, ui.snapshot().values);
      ui.controller.update({ ...ui.snapshot(), validationErrors: result.errors });
      return result;
    };
    assert.deepEqual(ui.snapshot().values, {});
    assert.deepEqual(ui.snapshot().uiState, { nextKey: 1, rows: {}, touched: {} });
    assert.equal(refresh().errors[0].path, "values");
    assert.equal(ui.controller.getVisibleErrorCount(), 0);
    assert.equal(ui.at("values:add").textContent, "Add Value");
    ui.at("values:add").dispatch("click");
    assert.deepEqual(ui.snapshot().values, { values: [{}] });
    assert.deepEqual(ui.at("values[r1].type").children.map(option => option.value), ["", ...config.fields[0].items.allowedTypes]);
    assert.equal(ui.document.activeElement, ui.at("values[r1].type"));
    const onlyRemove = walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Value 1");
    assert.equal(onlyRemove.disabled, true);
    const before = ui.snapshot(); onlyRemove.dispatch("click");
    assert.deepEqual(ui.snapshot(), before);
    ui.set("values[r1].type", "cellRef"); ui.set("values[r1].column", " Task ");
    assert.equal(refresh().values.values[0].column, "Task");
    assert.equal(ui.snapshot().values.values[0].column, " Task ");
    ui.at("values:add").dispatch("click");
    ui.set("values[r2].type", "cellRef"); ui.at("values[r2].column").dispatch("blur");
    const survivor = ui.at("values[r2].column");
    assert.equal(refresh().errors[0].path, "values[1].column");
    assert.equal(survivor.getAttribute("aria-invalid"), "true");
    walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Value 1").dispatch("click");
    assert.deepEqual(ui.snapshot().uiState.rows.values, ["r2"]);
    assert.equal(ui.at("values[r2].column"), survivor);
    assert.equal(refresh().errors[0].path, "values[0].column");
    assert.equal(survivor.getAttribute("aria-invalid"), "true");
    assert.ok(Object.keys(ui.snapshot().uiState.touched).every(key => !key.includes("r1")));
    ui.set("values[r2].type", "rangeRef"); ui.set("values[r2].scope", "currentSheet");
    ui.set("values[r2].startColumn", " Start "); ui.set("values[r2].endColumn", " End ");
    assert.deepEqual(refresh().values.values, [{ type: "rangeRef", scope: "currentSheet", startColumn: "Start", endColumn: "End" }]);
    const old = ui.at("values[r2].startColumn");
    ui.set("values[r2].scope", "crossSheet");
    assert.deepEqual(ui.snapshot().values.values, [{ type: "rangeRef", scope: "crossSheet", name: "" }]);
    assert.ok(Object.keys(ui.snapshot().uiState.touched).every(key => !/startColumn|endColumn|\.column$/.test(key)));
    const changes = ui.changes.length; old.dispatch("blur"); old.dispatch("input");
    assert.equal(ui.changes.length, changes);
    ui.set("values[r2].name", "{{ Costs }}");
    assert.equal(refresh().values.values[0].name, "Costs");
    assert.equal(ui.at("values[r2].name").value, "{{ Costs }}");
    ui.set("values[r2].scope", "currentSheet");
    assert.deepEqual(ui.snapshot().values.values, [{ type: "rangeRef", scope: "currentSheet", startColumn: "", endColumn: "" }]);
    assert.equal(Object.hasOwn(ui.snapshot().uiState.touched, "values[r2].name"), false);
    if (config.fields[0].items.allowedTypes.includes("number")) {
      ui.set("values[r2].type", "number"); ui.set("values[r2].value", " 0012.500 ");
      assert.deepEqual(refresh().values.values, [{ type: "number", value: "12.5" }]);
      assert.deepEqual(ui.snapshot().values.values, [{ type: "number", value: " 0012.500 " }]);
    }
    ui.at("values:add").dispatch("click");
    assert.deepEqual(ui.snapshot().uiState.rows.values, ["r2", "r3"]);
    walk(ui.container).find(node => node.getAttribute("aria-label") === "Remove Value 1").dispatch("click");
    assert.deepEqual(ui.snapshot().values, { values: [{}] });
    assert.ok(Object.keys(ui.snapshot().uiState.touched).every(key => !key.includes("r2")));
    assert.equal(JSON.stringify(ui.snapshot().values).includes("r3"), false);
  });
}
