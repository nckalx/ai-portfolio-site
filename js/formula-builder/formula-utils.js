// Classic-script module; no build step or browser APIs required.
(() => {
  function rowColumn(columnName) {
    return `[${columnName.trim()}]@row`;
  }

  function sheetReference(referenceName) {
    const cleanedName = referenceName.trim().replace(/^\{+/, "").replace(/\}+$/, "").trim();
    return `{${cleanedName}}`;
  }

  function smartsheetText(text) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  function locationWordFormula(trimmedLocation, wordNumber) {
    const locationLength = `LEN(${trimmedLocation})`;
    const startPosition = wordNumber === 1 ? "1" : `${wordNumber - 1} * ${locationLength} + 1`;

    return `TRIM(MID(SUBSTITUTE(${trimmedLocation}, " ", REPT(" ", ${locationLength})), ${startPosition}, ${locationLength}))`;
  }

  function longestLocationWordFormula(locationColumnName, maxLocationWordsToCheck) {
    const trimmedLocation = `TRIM(${rowColumn(locationColumnName)})`;
    const words = [];

    for (let wordNumber = 1; wordNumber <= maxLocationWordsToCheck; wordNumber += 1) {
      words.push(locationWordFormula(trimmedLocation, wordNumber));
    }

    const maxWordLength = `MAX(${words.map((word) => `LEN(${word})`).join(", ")})`;

    return words.reduceRight((formula, word) => {
      return `IF(LEN(${word}) = ${maxWordLength}, ${word}, ${formula})`;
    });
  }

  function nestedEqualsFormula(targetFormula, options, fallbackFormula) {
    return options.reduceRight((formula, option) => {
      return `IF(${targetFormula} = ${smartsheetText(option.match)}, ${option.result}, ${formula})`;
    }, fallbackFormula);
  }

  globalThis.SmartsheetFormulaBuilder = globalThis.SmartsheetFormulaBuilder || {};
  globalThis.SmartsheetFormulaBuilder.utils = { rowColumn, sheetReference, smartsheetText, locationWordFormula, longestLocationWordFormula, nestedEqualsFormula };
})();
