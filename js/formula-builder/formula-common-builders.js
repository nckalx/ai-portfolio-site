// Curated structured builders. Evaluation remains in Smartsheet.
(() => {
  const namespace = globalThis.SmartsheetFormulaBuilder ||= {};
  const familyKeys = Object.freeze([
    "comparisonReturn", "duplicateFlag", "singleCriterionAggregate", "criteriaAggregate",
    "variadicAggregate", "percentMatch", "todayOffset", "dateDelta", "workdayCalculation",
    "overdueFlag", "textCombine", "booleanGroup", "booleanTest", "decimalRounding",
    "multipleRounding", "unaryNumeric", "textSlice", "textUnary", "textSearch",
    "dateConstructor", "textReplace"
  ]);
  function createRegistry(definitions) {
    const { isPlainObject, assertRecord } = namespace.primitives;
    if (!isPlainObject(definitions)) throw new TypeError("Structured configuration: expected builder definitions.");
    const registry = Object.create(null);
    for (const key of Reflect.ownKeys(definitions)) {
      if (!familyKeys.includes(key)) throw new TypeError(`Structured configuration: unknown builder family ${String(key)}.`);
      const property = Object.getOwnPropertyDescriptor(definitions, key);
      if (!property.enumerable || !Object.hasOwn(property, "value")) throw new TypeError("Structured configuration: builder definitions must be own data properties.");
      const descriptor = property.value;
      try { assertRecord(descriptor, ["validateOptions", "validate", "build"]); }
      catch { throw new TypeError(`Structured configuration: malformed descriptor for ${key}.`); }
      if (["validateOptions", "validate", "build"].some(name => typeof descriptor[name] !== "function")) throw new TypeError(`Structured configuration: descriptor methods required for ${key}.`);
      registry[key] = Object.freeze({ validateOptions: descriptor.validateOptions, validate: descriptor.validate, build: descriptor.build });
    }
    return Object.freeze(registry);
  }
  function validateFunctionOptions(options, names) {
    try { namespace.primitives.assertRecord(options, ["functionName"]); }
    catch { throw new TypeError("Structured configuration: expected only functionName in builder options."); }
    if (!names.includes(options.functionName)) throw new TypeError("Structured configuration: unsupported function for builder family.");
  }
  const registry = createRegistry({
    decimalRounding: {
      validateOptions(options) { validateFunctionOptions(options, ["ROUND", "ROUNDUP", "ROUNDDOWN"]); },
      validate() { return []; },
      build(values, options, p) {
        const args = [p.renderOperand(values.value)];
        if (Object.hasOwn(values, "decimalPlaces")) args.push(p.renderOperand({ type: "number", value: values.decimalPlaces }));
        return p.renderFunctionCall(options.functionName, args);
      }
    },
    multipleRounding: {
      validateOptions(options) { validateFunctionOptions(options, ["CEILING", "FLOOR"]); },
      validate() { return []; },
      build(values, options, p) {
        return p.renderFunctionCall(options.functionName, [p.renderOperand(values.value), p.renderOperand(values.multiple)]);
      }
    },
    unaryNumeric: {
      validateOptions(options) { validateFunctionOptions(options, ["ABS", "VALUE", "INT"]); },
      validate(values, options) {
        if (options.functionName === "VALUE" && values.value.type === "textLiteral" && !values.value.value.trim()) {
          return [{ path: "value.value", code: "requiredText", message: "Enter text that represents a number." }];
        }
        return [];
      },
      build(values, options, p) {
        return p.renderFunctionCall(options.functionName, [p.renderOperand(values.value)]);
      }
    },
    textSlice: {
      validateOptions(options) { validateFunctionOptions(options, ["LEFT", "RIGHT", "MID"]); },
      validate() { return []; },
      build(values, options, p) {
        const args = [p.renderOperand(values.text)];
        if (options.functionName === "MID") args.push(p.renderOperand({ type: "number", value: values.startPosition }));
        if (Object.hasOwn(values, "numChars")) args.push(p.renderOperand({ type: "number", value: values.numChars }));
        return p.renderFunctionCall(options.functionName, args);
      }
    },
    textUnary: {
      validateOptions(options) { validateFunctionOptions(options, ["LEN", "LOWER", "UPPER"]); },
      validate() { return []; },
      build(values, options, p) {
        return p.renderFunctionCall(options.functionName, [p.renderOperand(values.text)]);
      }
    },
    textSearch: {
      validateOptions(options) { validateFunctionOptions(options, ["FIND", "CONTAINS"]); },
      validate() { return []; },
      build(values, options, p) {
        const args = [p.renderOperand(values.searchFor)];
        if (options.functionName === "CONTAINS") {
          args.push(values.range.type === "cellRef" ? p.renderOperand(values.range) : p.renderRange(values.range));
        } else {
          args.push(p.renderOperand(values.textToSearch));
          if (Object.hasOwn(values, "startPosition")) args.push(p.renderOperand({ type: "number", value: values.startPosition }));
        }
        return p.renderFunctionCall(options.functionName, args);
      }
    },
    textReplace: {
      validateOptions(options) { validateFunctionOptions(options, ["SUBSTITUTE", "REPLACE"]); },
      validate() { return []; },
      build(values, options, p) {
        const args = [p.renderOperand(values.text)];
        if (options.functionName === "SUBSTITUTE") {
          args.push(p.renderOperand(values.oldText), p.renderOperand(values.newText));
          if (Object.hasOwn(values, "instanceNumber")) args.push(p.renderOperand({ type: "number", value: values.instanceNumber }));
        } else {
          args.push(p.renderOperand({ type: "number", value: values.startPosition }),
            p.renderOperand({ type: "number", value: values.numChars }), p.renderOperand(values.newText));
        }
        return p.renderFunctionCall(options.functionName, args);
      }
    }
  });
  namespace.commonBuilders = Object.freeze({ familyKeys, createRegistry, registry });
})();
