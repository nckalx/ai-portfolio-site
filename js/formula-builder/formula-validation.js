// Classic-script module; no build step or browser APIs required.
(() => {
  // Inputs follow the existing form contract: every configured field supplies a string.
  function normalizeValues(config, rawValues) {
    const values = {};
    config.fields.forEach((field) => {
      values[field.id] = rawValues[field.id].trim();
    });
    return values;
  }

  function isPositiveWholeNumber(value) {
    return /^[1-9]\d*$/.test(value);
  }

  function getMissingFields(config, values) {
    return config.fields.filter((field) => values[field.id] === "");
  }

  const validators = {
    positiveWholeNumberRank(values) {
      if (!isPositiveWholeNumber(values.rankNumber)) {
        return ["Rank number must be a positive whole number."];
      }

      return [];
    }
  };

  function getValidationErrors(config, values) {
    if (!config.validationRule) {
      return [];
    }
    return validators[config.validationRule](values);
  }

  globalThis.SmartsheetFormulaBuilder.validation = { normalizeValues, isPositiveWholeNumber, getMissingFields, getValidationErrors };
})();

// Additive structured contract. Legacy normalization and validation above stay intact.
(() => {
  const { primitives: p, validation } = globalThis.SmartsheetFormulaBuilder;
  const field = (id, type, extra = {}) => ({ id, type, ...extra });
  const operandTypes = {
    typedOperand: p.scalarTypes, valueOperand: p.scalarTypes, outputOperand: p.scalarTypes,
    numericOperand: ["number", "cellRef"], dateOperand: ["date", "cellRef"], textOperand: ["textLiteral", "cellRef"],
    valueOrRange: [...p.scalarTypes, "columnRef", "rangeRef"]
  };
  const scalarSchemas = {
    textLiteral: [field("type", "enum", { enum: ["textLiteral"] }), field("value", "text")],
    number: [field("type", "enum", { enum: ["number"] }), field("value", "number")],
    boolean: [field("type", "enum", { enum: ["boolean"] }), field("value", "boolean")],
    date: [field("type", "enum", { enum: ["date"] }), field("value", "date")],
    cellRef: [field("type", "enum", { enum: ["cellRef"] }), field("column", "columnName")],
    blank: [field("type", "enum", { enum: ["blank"] })],
    columnRef: [field("type", "enum", { enum: ["columnRef"] }), field("column", "columnName")]
  };
  const conditionFields = [field("left", "typedOperand"), field("operator", "comparisonOperator"), field("right", "typedOperand")];
  const criterionFields = [field("operator", "comparisonOperator"), field("value", "typedOperand")];
  const pairFields = [field("range", "range"), field("criterion", "criterion")];
  function configurationError(message) { throw new TypeError(`Structured configuration: ${message}`); }
  function childPath(parent, key) { return parent ? `${parent}.${key}` : key; }
  function compareDecimal(left, right) {
    const negativeLeft = left.startsWith("-"), negativeRight = right.startsWith("-");
    if (negativeLeft !== negativeRight) return negativeLeft ? -1 : 1;
    const [a, af = ""] = (negativeLeft ? left.slice(1) : left).split(".");
    const [b, bf = ""] = (negativeRight ? right.slice(1) : right).split(".");
    const size = Math.max(af.length, bf.length);
    const fractionA = af.padEnd(size, "0"), fractionB = bf.padEnd(size, "0");
    const result = a.length !== b.length ? Math.sign(a.length - b.length) : a !== b ? (a < b ? -1 : 1) : fractionA === fractionB ? 0 : fractionA < fractionB ? -1 : 1;
    return negativeLeft ? -result : result;
  }
  // Metadata is trusted developer configuration, but malformed schemas must not
  // masquerade as user-input errors, even when their optional values are absent.
  function checkSchema(schema, ancestors = new Set()) {
    if (!p.isPlainObject(schema) || ancestors.has(schema)) configurationError("invalid or cyclic schema.");
    ancestors.add(schema);
    const type = schema.type;
    const known = [...Object.keys(operandTypes), "range", "cellRef", "columnRef", "rangeRef", "condition", "criterion", "array", "object", "enum", "comparisonOperator", "number", "integer", "date", "text", "columnName", "referenceName", "boolean"];
    if (typeof type !== "string" || (!known.includes(type) && !["condition[]", "criteria[]", "valueOrRange[]"].includes(type))) configurationError(`unknown field type ${String(type)}.`);
    if (Object.hasOwn(schema, "required") && typeof schema.required !== "boolean") configurationError("required must be boolean.");
    if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length || schema.enum.some(value => typeof value !== "string"))) configurationError("enum must contain strings.");
    if (type === "enum" && !schema.enum) configurationError("enum choices are required.");
    if (schema.allowedTypes !== undefined && (!operandTypes[type] || !Array.isArray(schema.allowedTypes) || !schema.allowedTypes.length || schema.allowedTypes.some(value => !operandTypes[type].includes(value)))) configurationError("invalid permitted operand types.");
    if (schema.minItems !== undefined && (!Number.isSafeInteger(schema.minItems) || schema.minItems < 0)) configurationError("invalid minimum item count.");
    for (const key of ["min", "max"]) if (Object.hasOwn(schema, key)) {
      try { p.normalizeNumber(schema[key], type === "integer"); } catch { configurationError(`invalid ${key} bound.`); }
    }
    if (Object.hasOwn(schema, "min") && Object.hasOwn(schema, "max") && compareDecimal(p.normalizeNumber(schema.min), p.normalizeNumber(schema.max)) > 0) configurationError("minimum exceeds maximum.");
    if (type === "object") {
      try { p.assertDenseArray(schema.fields); } catch { configurationError("fields must be a dense ordered array."); }
      const ids = new Set();
      for (const member of schema.fields) {
        if (!p.isPlainObject(member) || typeof member.id !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(member.id) || ids.has(member.id)) configurationError("invalid or duplicate field ID.");
        ids.add(member.id);
        checkSchema(member, ancestors);
      }
    }
    if (type === "array") checkSchema(schema.items, ancestors);
    ancestors.delete(schema);
  }
  function configSchema(config) {
    if (!p.isPlainObject(config)) configurationError("expected formula metadata.");
    const schema = { type: "object", fields: config.fields };
    checkSchema(schema);
    return schema;
  }
  function normalize(schema, rawValues) {
    const errors = [], ancestors = new Set();
    function error(path, code, message) { errors.push({ path, code, message }); }
    function visit(rule, input, path, present = true) {
      if (!present) {
        if (rule.required !== false) error(path, "required", rule.requiredMessage || `Choose ${rule.label || path || "a value"}.`);
        return undefined;
      }
      if (input === null || input === undefined) { error(path, "invalid", "Choose a valid value; null and undefined are not omission."); return undefined; }
      if (typeof input === "object") {
        if (ancestors.has(input)) { error(path, "invalid", "Use plain serializable data without cycles."); return undefined; }
        if ((!Array.isArray(input) && !p.isPlainObject(input)) || Reflect.ownKeys(input).some(key => {
          const descriptor = Object.getOwnPropertyDescriptor(input, key);
          return typeof key !== "string" || !Object.hasOwn(descriptor, "value") || (!descriptor.enumerable && !(Array.isArray(input) && key === "length"));
        })) { error(path, "invalid", "Use plain serializable data properties."); return undefined; }
      }
      let type = rule.type;
      if (["criteria[]", "condition[]", "valueOrRange[]"].includes(type)) {
        return visit({ ...rule, type: "array", minItems: Math.max(1, rule.minItems || 0), items: type === "criteria[]" ? { type: "object", fields: pairFields } : { type: type.slice(0, -2) } }, input, path);
      }
      if (operandTypes[type] || ["range", "cellRef", "columnRef", "rangeRef"].includes(type)) {
        if (!p.isPlainObject(input)) { error(path, "type", "Choose an operand or reference object."); return undefined; }
        const permitted = rule.allowedTypes || operandTypes[type] || (type === "range" ? ["columnRef", "rangeRef"] : [type]);
        if (!Object.hasOwn(input, "type")) { error(childPath(path, "type"), "required", "Choose an operand type."); return undefined; }
        if (!permitted.includes(input.type)) { error(childPath(path, "type"), "operandType", "Choose a permitted operand type."); return undefined; }
        let fields = scalarSchemas[input.type];
        if (input.type === "rangeRef") {
          if (!["currentSheet", "crossSheet"].includes(input.scope)) { error(childPath(path, "scope"), Object.hasOwn(input, "scope") ? "enum" : "required", "Choose a range scope."); return undefined; }
          fields = [field("type", "enum", { enum: ["rangeRef"] }), field("scope", "enum", { enum: [input.scope] }), ...(input.scope === "crossSheet" ? [field("name", "referenceName")] : [field("startColumn", "columnName"), field("endColumn", "columnName")])];
        }
        // Apply numeric bounds to literal numeric operands, never to unknown cell data.
        if (input.type === "number") fields = fields.map(member => member.id === "value" ? { ...member, ...(Object.hasOwn(rule, "min") ? { min: rule.min } : {}), ...(Object.hasOwn(rule, "max") ? { max: rule.max } : {}) } : member);
        return visit({ type: "object", fields }, input, path);
      }
      if (type === "condition" || type === "criterion") return visit({ type: "object", fields: type === "condition" ? conditionFields : criterionFields }, input, path);
      if (type === "object") {
        if (!p.isPlainObject(input)) { error(path, "type", "Choose an object value."); return undefined; }
        ancestors.add(input);
        const value = {};
        for (const member of rule.fields) {
          const exists = Object.hasOwn(input, member.id);
          const normalized = visit(member, exists ? input[member.id] : undefined, childPath(path, member.id), exists);
          if (exists) Object.defineProperty(value, member.id, { value: normalized, writable: true, enumerable: true, configurable: true });
        }
        const expected = new Set(rule.fields.map(member => member.id));
        for (const key of Object.keys(input).filter(key => !expected.has(key)).sort()) error(childPath(path, key), "unexpected", "Remove this unexpected property.");
        ancestors.delete(input);
        return value;
      }
      if (type === "array") {
        if (!Array.isArray(input)) { error(path, "type", "Choose an ordered array."); return undefined; }
        ancestors.add(input);
        if (input.length < (rule.minItems || 0)) error(path, "minItems", `Choose at least ${rule.minItems} item(s).`);
        const value = [];
        for (let index = 0; index < input.length; index++) value.push(visit({ ...rule.items, required: true }, input[index], `${path}[${index}]`, Object.hasOwn(input, index)));
        for (const key of Object.keys(input).filter(key => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= input.length).sort()) error(childPath(path, key), "unexpected", "Remove this unexpected array property.");
        ancestors.delete(input);
        return value;
      }
      let value;
      try {
        switch (type) {
          case "number": case "integer": value = p.normalizeNumber(input, type === "integer"); break;
          case "date": value = p.normalizeDate(input); break;
          case "columnName": value = p.normalizeColumn(input); break;
          case "referenceName": value = p.normalizeReference(input); break;
          case "text": value = p.text(input); break;
          case "boolean": if (typeof input !== "boolean") throw new TypeError("Choose a boolean value."); value = input; break;
          case "enum": case "comparisonOperator":
            if (!(type === "comparisonOperator" ? p.operators : rule.enum).includes(input)) throw new TypeError("Choose an allowed value.");
            value = input; break;
          default: configurationError(`unknown field type ${type}.`);
        }
      } catch (exception) { error(path, type, exception.message); return undefined; }
      if (rule.enum && !rule.enum.includes(value)) error(path, "enum", "Choose an allowed value.");
      if (["number", "integer"].includes(type)) {
        for (const bound of ["min", "max"]) if (Object.hasOwn(rule, bound) && compareDecimal(value, p.normalizeNumber(rule[bound])) * (bound === "min" ? 1 : -1) < 0) error(path, bound, `Value must be ${bound === "min" ? "at least" : "at most"} ${rule[bound]}.`);
      }
      return value;
    }
    const values = visit(schema, rawValues, "");
    return { values: errors.length ? null : values, errors };
  }
  function builderErrors(errors) {
    try {
      p.assertDenseArray(errors);
      return errors.map(error => {
        p.assertRecord(error, ["path", "code", "message"]);
        if ([error.path, error.code, error.message].some(value => typeof value !== "string")) configurationError("invalid builder validation error.");
        return { path: error.path, code: error.code, message: error.message };
      });
    } catch { configurationError("builder validate must return ordered path/code/message errors."); }
  }
  function normalizeAndValidate(config, rawValues, builder) {
    const schema = configSchema(config);
    if (!builder || typeof builder.validateOptions !== "function" || typeof builder.validate !== "function") configurationError("missing builder validator.");
    const options = config.builderOptions;
    // Throws are developer faults; they intentionally remain outside user validation.
    if (builder.validateOptions(options) !== undefined) configurationError("validateOptions must throw on faults and otherwise return undefined.");
    const result = normalize(schema, rawValues);
    if (result.errors.length) return result;
    const errors = builderErrors(builder.validate(result.values, options));
    return errors.length ? { values: null, errors } : result;
  }
  function createDefaultValues(config) {
    const schema = configSchema(config), defaults = {};
    // Validate only declared defaults. Required fields without defaults stay absent.
    const defaultFields = schema.fields.filter(member => Object.hasOwn(member, "defaultValue"));
    for (const member of defaultFields) Object.defineProperty(defaults, member.id, { value: member.defaultValue, enumerable: true });
    const result = normalize({ type: "object", fields: defaultFields }, defaults);
    if (result.errors.length) configurationError(`invalid defaults: ${result.errors.map(error => error.path).join(", ")}.`);
    // Defaults preserve declared semantic spelling; normalization happens at generation.
    function clone(value) {
      if (Array.isArray(value)) return value.map(clone);
      if (p.isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
      return value;
    }
    return clone(defaults);
  }
  validation.structured = Object.freeze({ normalizeAndValidate, createDefaultValues });
})();
