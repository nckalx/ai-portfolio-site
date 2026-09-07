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
