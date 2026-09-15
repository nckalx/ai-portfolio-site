// Structured render results are internal fragments, never semantic user input.
(() => {
  const namespace = globalThis.SmartsheetFormulaBuilder ||= {};
  const operators = Object.freeze(["=", "<>", ">", "<", ">=", "<="]);
  const scalarTypes = Object.freeze(["textLiteral", "number", "boolean", "date", "cellRef", "blank"]);

  function fail(message) { throw new TypeError(message); }
  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    // Also accept plain records from another realm (the Node VM test loader).
    const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, "constructor");
    return prototype === null || (Object.getPrototypeOf(prototype) === null &&
      typeof constructor?.value === "function" && constructor.value.name === "Object");
  }
  function assertRecord(value, keys) {
    if (!isPlainObject(value)) fail("Expected a plain object.");
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || own.some(key => !keys.includes(key))) fail("Unexpected or missing properties.");
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value") || descriptor.value === undefined) fail("Expected serializable own properties.");
    }
  }
  function assertDenseArray(values) {
    if (!Array.isArray(values) || Reflect.ownKeys(values).length !== values.length + 1) fail("Expected a dense array without extra properties.");
    for (let index = 0; index < values.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value") || descriptor.value == null) fail("Missing array item.");
    }
  }
  function text(value) {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f]/.test(value)) fail("Expected text without control characters.");
    return value;
  }
  function normalizeColumn(value) {
    const column = text(value).trim();
    if (!column) fail("Choose a column name.");
    return column;
  }
  function normalizeReference(value) {
    let name = text(value).trim();
    while (name.startsWith("{") && name.endsWith("}")) name = name.slice(1, -1).trim();
    if (!name || /[{}]/.test(name)) fail("Choose a balanced, nonempty reference name without internal braces.");
    return name;
  }
  function normalizeNumber(value, integer = false) {
    if (typeof value !== "string") fail("Use a decimal string.");
    const trimmed = value.trim();
    if (!(integer ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/).test(trimmed)) fail(integer ? "Use integer syntax." : "Use decimal syntax.");
    const negative = trimmed.startsWith("-");
    const [whole, fraction = ""] = (negative ? trimmed.slice(1) : trimmed).split(".");
    const digits = whole.replace(/^0+(?=\d)/, "");
    const decimals = fraction.replace(/0+$/, "");
    // Compare normalized magnitude as strings; never round a literal through Number.
    const limit = "9007199254740992";
    if (digits.length > limit.length || (digits.length === limit.length &&
      (digits > limit || (digits === limit && decimals !== "")))) {
      fail("Use a number from -9007199254740992 through 9007199254740992.");
    }
    return (negative && (digits !== "0" || decimals) ? "-" : "") + digits + (decimals ? `.${decimals}` : "");
  }
  function normalizeDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("Use a YYYY-MM-DD date.");
    const [year, month, day] = value.split("-").map(Number);
    if (year === 0) fail("Choose a civil year from 0001 through 9999.");
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail("Choose a real calendar date.");
    return value;
  }
  function assertOperator(operator) {
    if (!operators.includes(operator)) fail("Choose a supported comparison operator.");
    return operator;
  }
  // Smartsheet Formula Basics documents backslash escaping for quotes and brackets.
  // Escape literal backslashes first so user text can never supply an escape sequence.
  function columnExpression(column) { return `[${normalizeColumn(column).replace(/\\/g, "\\\\").replace(/[\[\]]/g, "\\$&")}]`; }
  function fragment(expression, references = []) { return { expression, references }; }
  function discriminator(value, key) {
    if (!isPlainObject(value)) fail("Expected a plain semantic object.");
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property?.enumerable || !Object.hasOwn(property, "value")) fail(`Choose ${key} as an own data property.`);
    return property.value;
  }
  function renderOperand(operand) {
    if (!scalarTypes.includes(discriminator(operand, "type"))) fail("Choose a scalar operand.");
    assertRecord(operand, operand.type === "blank" ? ["type"] : ["type", operand.type === "cellRef" ? "column" : "value"]);
    switch (operand.type) {
      case "textLiteral": return fragment(`"${text(operand.value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
      case "number": return fragment(normalizeNumber(operand.value));
      case "boolean":
        if (typeof operand.value !== "boolean") fail("Choose a boolean value.");
        return fragment(operand.value ? "1" : "0");
      case "date": return fragment(`DATE(${normalizeDate(operand.value).split("-").map(Number).join(", ")})`);
      case "cellRef": return fragment(`${columnExpression(operand.column)}@row`);
      case "blank": return fragment('""');
    }
  }
  function renderRange(reference) {
    discriminator(reference, "type");
    if (reference.type === "columnRef") {
      assertRecord(reference, ["type", "column"]);
      const column = columnExpression(reference.column);
      return fragment(`${column}:${column}`);
    }
    if (reference.type !== "rangeRef") fail("Choose a range reference.");
    discriminator(reference, "scope");
    if (reference.scope === "currentSheet") {
      assertRecord(reference, ["type", "scope", "startColumn", "endColumn"]);
      return fragment(`${columnExpression(reference.startColumn)}:${columnExpression(reference.endColumn)}`);
    }
    if (reference.scope !== "crossSheet") fail("Choose a supported range scope.");
    assertRecord(reference, ["type", "scope", "name"]);
    const name = normalizeReference(reference.name);
    return fragment(`{${name.replace(/\\/g, "\\\\")}}`, [{ name }]);
  }
  function renderCondition(condition) {
    assertRecord(condition, ["left", "operator", "right"]);
    const left = renderOperand(condition.left), right = renderOperand(condition.right);
    return fragment(`${left.expression} ${assertOperator(condition.operator)} ${right.expression}`, collectReferences([left, right]));
  }
  function renderCriterion(criterion) {
    assertRecord(criterion, ["operator", "value"]);
    const operator = assertOperator(criterion.operator), value = renderOperand(criterion.value);
    return fragment(`${operator === "=" ? "" : operator}${value.expression}`, collectReferences([value]));
  }
  function renderCriteriaPairs(criteria) {
    assertDenseArray(criteria);
    if (!criteria.length) fail("Choose at least one criterion pair.");
    return criteria.flatMap(pair => {
      assertRecord(pair, ["range", "criterion"]);
      return [renderRange(pair.range), renderCriterion(pair.criterion)];
    });
  }
  function assertFragment(value) {
    assertRecord(value, ["expression", "references"]);
    if (typeof value.expression !== "string" || !value.expression.trim() || value.expression.trimStart().startsWith("=")) fail("Expected an expression fragment without leading equals.");
    assertDenseArray(value.references);
    for (const reference of value.references) {
      assertRecord(reference, ["name"]);
      normalizeReference(reference.name);
    }
  }
  function collectReferences(fragments) {
    assertDenseArray(fragments);
    const seen = new Set(), references = [];
    for (const rendered of fragments) {
      assertFragment(rendered);
      for (const reference of rendered.references) {
        const name = normalizeReference(reference.name);
        if (!seen.has(name)) { seen.add(name); references.push({ name }); }
      }
    }
    return references;
  }
  function renderFunctionCall(name, args) {
    if (typeof name !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(name)) fail("Expected a trusted uppercase function name.");
    const references = collectReferences(args);
    return fragment(`${name}(${args.map(arg => arg.expression).join(", ")})`, references);
  }
  namespace.primitives = Object.freeze({
    renderOperand, renderRange, renderCondition, renderCriterion, renderCriteriaPairs, renderFunctionCall, collectReferences,
    operators, scalarTypes, isPlainObject, assertRecord, assertDenseArray, text,
    normalizeColumn, normalizeReference, normalizeNumber, normalizeDate
  });
})();
