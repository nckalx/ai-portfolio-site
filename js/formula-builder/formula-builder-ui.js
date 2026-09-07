// Portfolio DOM and clipboard adapter. Core modules are loaded before this script.
(() => {
  const { catalog, generateFormula, utils } = globalThis.SmartsheetFormulaBuilder;
  const { sheetReference } = utils;

  function createFormulaInput(field) {
    const fieldWrapper = document.createElement("div");
    fieldWrapper.className = "builder-field";

    const label = document.createElement("label");
    label.setAttribute("for", field.id);
    label.textContent = field.label;

    const input = document.createElement(field.type === "select" ? "select" : "input");
    input.id = field.id;

    if (field.type === "select") {
      field.options.forEach((option) => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        input.appendChild(optionElement);
      });

      input.value = field.defaultValue;
      input.addEventListener("change", renderFormulaBuilderOutput);
    } else {
      input.type = "text";
      input.value = field.defaultValue;
      input.addEventListener("input", renderFormulaBuilderOutput);
    }

    const helpText = document.createElement("p");
    helpText.className = "field-help";
    helpText.textContent = field.help;

    fieldWrapper.appendChild(label);
    fieldWrapper.appendChild(input);
    fieldWrapper.appendChild(helpText);

    return fieldWrapper;
  }

  function getFormulaValues(config) {
    const values = {};

    config.fields.forEach((field) => {
      const input = document.getElementById(field.id);
      values[field.id] = input.value;
    });

    return values;
  }

  function renderList(container, listClassName, items) {
    const list = document.createElement(listClassName === "setup-steps" ? "ol" : "ul");
    list.className = listClassName;

    items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.appendChild(listItem);
    });

    container.appendChild(list);
  }

  function renderReferenceInstructions(result) {
    const referenceInstructions = document.getElementById("referenceInstructions");
    const { references, setupNotes, instructions } = result;

    referenceInstructions.innerHTML = "";

    const setupHeading = document.createElement("h3");
    setupHeading.textContent = "Setup notes";
    referenceInstructions.appendChild(setupHeading);
    renderList(referenceInstructions, "setup-notes", setupNotes);

    if (references.length > 0) {
      const referenceHeading = document.createElement("h3");
      referenceHeading.textContent = "Cross-sheet references";
      referenceInstructions.appendChild(referenceHeading);

      const referenceIntro = document.createElement("p");
      referenceIntro.textContent = "Create these named reference placeholders in Smartsheet before using the formula.";
      referenceInstructions.appendChild(referenceIntro);

      const referenceItems = references.map((reference) => {
        return `${sheetReference(reference.name)}: in "${reference.sheet}", select the "${reference.range}" column.`;
      });

      renderList(referenceInstructions, "reference-list", referenceItems);
    }

    const instructionHeading = document.createElement("h3");
    instructionHeading.textContent = "How to use it";
    referenceInstructions.appendChild(instructionHeading);
    renderList(referenceInstructions, "setup-steps", instructions);
  }

  function renderFormulaBuilderOutput() {
    const formulaType = document.getElementById("formulaType").value;
    const config = catalog[formulaType];
    const formulaExplanation = document.getElementById("formulaExplanation");
    const generatedFormula = document.getElementById("generatedFormula");
    const copyFormulaButton = document.getElementById("copyFormulaButton");
    const copyFormulaStatus = document.getElementById("copyFormulaStatus");
    const values = getFormulaValues(config);
    const result = generateFormula(formulaType, values);
    const { missingFields, validationErrors } = result;

    formulaExplanation.textContent = result.explanation;
    copyFormulaStatus.textContent = "";

    if (missingFields.length > 0) {
      const missingLabels = missingFields.map((field) => field.label).join(", ");
      generatedFormula.textContent = `Complete these fields to generate a formula: ${missingLabels}.`;
      copyFormulaButton.disabled = true;
      renderReferenceInstructions(result);
      return;
    }

    if (validationErrors.length > 0) {
      generatedFormula.textContent = validationErrors.join(" ");
      copyFormulaButton.disabled = true;
      renderReferenceInstructions(result);
      return;
    }

    generatedFormula.textContent = result.formula;
    copyFormulaButton.disabled = false;
    renderReferenceInstructions(result);
  }

  function renderFormulaFields() {
    const formulaType = document.getElementById("formulaType").value;
    const config = catalog[formulaType];
    const formulaInputFields = document.getElementById("formulaInputFields");

    formulaInputFields.innerHTML = "";

    config.fields.forEach((field) => {
      formulaInputFields.appendChild(createFormulaInput(field));
    });

    renderFormulaBuilderOutput();
  }

  function copyFormulaToClipboard() {
    const generatedFormula = document.getElementById("generatedFormula");
    const copyFormulaStatus = document.getElementById("copyFormulaStatus");
    const formulaText = generatedFormula.textContent;

    if (!formulaText) {
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formulaText).then(() => {
        copyFormulaStatus.textContent = "Formula copied.";
      }).catch(() => {
        copyWithTemporaryTextArea(formulaText, copyFormulaStatus);
      });
      return;
    }

    copyWithTemporaryTextArea(formulaText, copyFormulaStatus);
  }

  function copyWithTemporaryTextArea(formulaText, copyFormulaStatus) {
    const temporaryTextArea = document.createElement("textarea");
    temporaryTextArea.value = formulaText;
    temporaryTextArea.style.left = "-9999px";
    temporaryTextArea.style.position = "fixed";
    document.body.appendChild(temporaryTextArea);
    temporaryTextArea.select();
    document.execCommand("copy");
    temporaryTextArea.remove();
    copyFormulaStatus.textContent = "Formula copied.";
  }

  function initializeFormulaBuilder() {
    const formulaType = document.getElementById("formulaType");
    Object.values(catalog).forEach((config) => {
      const option = document.createElement("option");
      option.value = config.id;
      option.textContent = config.label;
      formulaType.appendChild(option);
    });
    formulaType.value = Object.values(catalog)[0].id;
    document.getElementById("formulaBuilderForm").addEventListener("submit", (event) => {
      event.preventDefault();
    });
    formulaType.addEventListener("change", renderFormulaFields);
    document.getElementById("copyFormulaButton").addEventListener("click", copyFormulaToClipboard);
    renderFormulaFields();
  }

  initializeFormulaBuilder();
})();
