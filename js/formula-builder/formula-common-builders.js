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
  function validateEmptyOptions(options) {
    try { namespace.primitives.assertRecord(options, []); }
    catch { throw new TypeError("Structured configuration: expected empty builder options."); }
  }
  function validateComparison(condition, path) {
    if (["=", "<>"].includes(condition.operator)) return [];
    const left = condition.left.type, right = condition.right.type;
    const orderedKinds = ["number", "date", "cellRef"];
    if (orderedKinds.includes(left) && orderedKinds.includes(right)
      && (left === right || left === "cellRef" || right === "cellRef")) return [];
    return [{ path, code: "incompatibleComparison", message: "Ordered comparisons require numbers or dates of the same kind, or current-row cells containing compatible values." }];
  }
  // Only already-rendered fragments enter these private, fixed compositions.
  function joinFragments(parts, separator, p) {
    return { expression: parts.map(part => part.expression).join(separator), references: p.collectReferences(parts) };
  }
  function numeric(value, p) { return p.renderOperand({ type: "number", value }); }
  function blankCondition(cell, p) { return p.renderCondition({ left: cell, operator: "=", right: { type: "blank" } }); }
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
    },
    todayOffset: {
      validateOptions(options) { validateFunctionOptions(options, ["TODAY"]); },
      validate() { return []; },
      build(values, options, p) {
        const args = [];
        if (Object.hasOwn(values, "offsetDays")) args.push(p.renderOperand({ type: "number", value: values.offsetDays }));
        return p.renderFunctionCall(options.functionName, args);
      }
    },
    dateConstructor: {
      validateOptions(options) { validateFunctionOptions(options, ["DATE"]); },
      validate() { return []; },
      build(values, options, p) {
        return p.renderFunctionCall(options.functionName, [values.year, values.month, values.day].map(value => p.renderOperand({ type: "number", value })));
      }
    },
    booleanTest: {
      validateOptions(options) { validateFunctionOptions(options, ["ISBLANK"]); },
      validate() { return []; },
      build(values, options, p) {
        return p.renderFunctionCall(options.functionName, [p.renderOperand(values.value)]);
      }
    },
    variadicAggregate: {
      validateOptions(options) { validateFunctionOptions(options, ["COUNT", "SUM", "AVG", "MIN", "MAX", "COUNTM", "MEDIAN"]); },
      validate() { return []; },
      build(values, options, p) {
        const args = values.values.map(value => value.type === "number" || value.type === "cellRef"
          ? p.renderOperand(value) : p.renderRange(value));
        return p.renderFunctionCall(options.functionName, args);
      }
    },
    comparisonReturn: {
      validateOptions(options) {
        try { namespace.primitives.assertRecord(options, ["mode"]); }
        catch { throw new TypeError("Structured configuration: expected only mode in builder options."); }
        if (!["checkbox", "text", "typed"].includes(options.mode)) throw new TypeError("Structured configuration: unsupported comparison return mode.");
      },
      validate(values, options) {
        const errors = validateComparison(values.condition, "condition");
        if (options.mode === "text" && !values.matchText.trim()) errors.push({ path: "matchText", code: "requiredText", message: "Enter the text to return when the comparison matches." });
        return errors;
      },
      build(values, options, p) {
        const args = [p.renderCondition(values.condition)];
        if (options.mode === "checkbox") args.push(numeric("1", p), numeric("0", p));
        else if (options.mode === "text") {
          args.push(p.renderOperand({ type: "textLiteral", value: values.matchText }));
          if (Object.hasOwn(values, "noMatchText")) args.push(p.renderOperand({ type: "textLiteral", value: values.noMatchText }));
        } else {
          args.push(p.renderOperand(values.trueOutput));
          if (Object.hasOwn(values, "falseOutput")) args.push(p.renderOperand(values.falseOutput));
        }
        return p.renderFunctionCall("IF", args);
      }
    },
    duplicateFlag: {
      validateOptions: validateEmptyOptions,
      validate() { return []; },
      build(values, options, p) {
        const cell = { type: "cellRef", column: values.column.column };
        const count = p.renderFunctionCall("COUNTIF", [p.renderRange(values.column), p.renderCriterion({ operator: "=", value: cell })]);
        const duplicated = joinFragments([count, numeric("1", p)], " > ", p);
        const flag = p.renderFunctionCall("IF", [duplicated, numeric("1", p), numeric("0", p)]);
        return values.ignoreBlank ? p.renderFunctionCall("IF", [blankCondition(cell, p), numeric("0", p), flag]) : flag;
      }
    },
    textCombine: {
      validateOptions: validateEmptyOptions,
      validate() { return []; },
      build(values, options, p) {
        const first = p.renderOperand(values.first), second = p.renderOperand(values.second);
        const combined = joinFragments([first, p.renderOperand({ type: "textLiteral", value: values.separator }), second], " + ", p);
        if (!values.suppressBlank) return combined;
        const secondGuard = p.renderFunctionCall("IF", [blankCondition(values.second, p), first, combined]);
        return p.renderFunctionCall("IF", [blankCondition(values.first, p), second, secondGuard]);
      }
    },
    booleanGroup: {
      validateOptions(options) { validateFunctionOptions(options, ["AND", "OR", "NOT"]); },
      validate(values, options) {
        return options.functionName === "NOT" ? validateComparison(values.condition, "condition")
          : values.conditions.flatMap((condition, index) => validateComparison(condition, `conditions[${index}]`));
      },
      build(values, options, p) {
        const conditions = options.functionName === "NOT" ? [values.condition] : values.conditions;
        return p.renderFunctionCall(options.functionName, conditions.map(condition => p.renderCondition(condition)));
      }
    }
  });
  namespace.commonBuilders = Object.freeze({ familyKeys, createRegistry, registry });
})();
