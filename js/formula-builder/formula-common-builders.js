// Registry infrastructure only. Production family implementations arrive in Phase 5.
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
  namespace.commonBuilders = Object.freeze({ familyKeys, createRegistry, registry: createRegistry({}) });
})();
