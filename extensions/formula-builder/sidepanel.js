// Extension DOM/clipboard adapter. The shared core is unaware of this UI or Chrome.
(() => {
  const { catalog, categories, generateFormula, utils } = globalThis.SmartsheetFormulaBuilder;
  const { findFormulas } = globalThis.FormulaDiscovery;
  const get = id => document.getElementById(id);
  const drafts = new Map(); // Lifetime of this panel document only.
  let selectedId = null;
  let returnFocus = null;
  let result = null;
  let revision = 0;
  let copyAttempt = 0;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function renderList(id, items) {
    const container = get(id);
    container.textContent = "";
    items.forEach(text => container.appendChild(element("li", text)));
  }

  function renderDiscovery() {
    const matches = findFormulas(catalog, categories, get("search").value, get("category").value);
    get("results").textContent = "";
    get("result-count").textContent = `${matches.length} ${matches.length === 1 ? "formula" : "formulas"}`;
    get("clear-filters").disabled = !get("search").value && !get("category").value;
    get("empty-state").hidden = matches.length !== 0;
    get("results-scroll").scrollTop = 0;
    matches.forEach(config => {
      const button = element("button", undefined, "formula-choice");
      button.type = "button";
      button.appendChild(element("span", config.label, "choice-title"));
      button.appendChild(element("span", config.explanation, "choice-description"));
      button.addEventListener("click", () => openFormula(config, button));
      const item = element("li");
      item.appendChild(button);
      get("results").appendChild(item);
    });
  }

  function clearFilters() {
    get("search").value = "";
    get("category").value = "";
    renderDiscovery();
    get("search").focus();
  }

  function renderField(field, value) {
    const wrapper = element("div", undefined, "field");
    const inputId = `field-${field.id}`;
    const label = element("label", field.label);
    label.setAttribute("for", inputId);
    const input = element(field.type === "select" ? "select" : "input");
    input.id = inputId;
    input.setAttribute("aria-required", "true");
    input.setAttribute("aria-describedby", `${inputId}-error`);
    if (field.type === "select") {
      field.options.forEach(option => {
        const node = element("option", option.label);
        node.value = option.value;
        input.appendChild(node);
      });
    } else {
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
    }
    input.value = value;
    input.addEventListener(field.type === "select" ? "change" : "input", () => {
      drafts.get(selectedId)[field.id] = input.value;
      renderOutput();
    });
    const error = element("p", "", "field-error");
    error.id = `${inputId}-error`;
    error.hidden = true;
    const help = element("details", undefined, "field-help");
    const summary = element("summary", "Field help");
    summary.setAttribute("aria-label", `Help for ${field.label}`);
    help.appendChild(summary);
    help.appendChild(element("p", field.help));
    [label, input, error, help].forEach(node => wrapper.appendChild(node));
    return wrapper;
  }

  function openFormula(config, button) {
    selectedId = config.id;
    returnFocus = button;
    if (!drafts.has(selectedId)) {
      drafts.set(selectedId, Object.fromEntries(config.fields.map(field => [field.id, field.defaultValue])));
    }
    get("build-title").textContent = config.label;
    get("build-category").textContent = categories.find(category => category.id === config.categoryId).label;
    get("explanation").textContent = config.explanation;
    get("fields").textContent = "";
    config.fields.forEach(field => get("fields").appendChild(renderField(field, drafts.get(selectedId)[field.id])));
    ["explanation-details", "setup-details", "instructions-details"].forEach(id => { get(id).open = false; });
    get("find-view").hidden = true;
    get("build-view").hidden = false;
    renderOutput();
    get("builder-scroll").scrollTop = 0;
    get("build-title").focus();
  }

  function renderOutput() {
    revision += 1;
    result = generateFormula(selectedId, drafts.get(selectedId));
    const missing = new Set(result.missingFields.map(field => field.id));
    const errors = result.validationErrors;
    get("formula-output").value = result.formula || "";
    get("copy").disabled = result.formula === null;
    get("copy-status").textContent = "";
    get("validation").textContent = missing.size
      ? `Complete these fields: ${result.missingFields.map(field => field.label).join(", ")}.`
      : errors.join(" ");
    // Only the existing rank rule has a field-specific validation error.
    catalog[selectedId].fields.forEach(field => {
      const message = missing.has(field.id) ? "This field is required."
        : field.id === "rankNumber" && errors.length ? errors.join(" ") : "";
      get(`field-${field.id}`).setAttribute("aria-invalid", message ? "true" : "false");
      get(`field-${field.id}-error`).textContent = message;
      get(`field-${field.id}-error`).hidden = !message;
    });
    renderList("setup-notes", result.setupNotes);
    renderList("instructions", result.instructions);
    renderList("references", result.references.map(reference =>
      `${utils.sheetReference(reference.name)}: in "${reference.sheet}", select the "${reference.range}" column.`));
    get("reference-section").hidden = !result.references.length;
    get("reference-notice").hidden = !result.references.length;
    get("reference-notice").textContent = `Setup required: ${result.references.length} cross-sheet ${result.references.length === 1 ? "reference" : "references"}`;
  }

  async function copyFormula() {
    if (!result?.formula || get("copy").disabled) return;
    const currentRevision = revision;
    const attempt = ++copyAttempt;
    const formula = result.formula;
    get("copy").disabled = true;
    get("copy-status").textContent = "Copying…";
    try {
      // Invoke within the original click, before yielding, to retain user activation.
      await navigator.clipboard.writeText(formula);
      if (revision === currentRevision && attempt === copyAttempt) get("copy-status").textContent = "Formula copied.";
    } catch {
      if (revision === currentRevision && attempt === copyAttempt) {
        get("copy-status").textContent = "Could not copy. Select the formula and press Ctrl+C (Mac: ⌘C).";
        get("formula-output").focus();
        get("formula-output").select();
      }
    } finally {
      if (revision === currentRevision && attempt === copyAttempt) get("copy").disabled = false;
    }
  }

  categories.forEach(category => {
    const option = element("option", category.label);
    option.value = category.id;
    get("category").appendChild(option);
  });
  get("search").addEventListener("input", renderDiscovery);
  get("category").addEventListener("change", renderDiscovery);
  get("clear-filters").addEventListener("click", clearFilters);
  get("empty-clear").addEventListener("click", clearFilters);
  get("fields-form").addEventListener("submit", event => event.preventDefault());
  get("back").addEventListener("click", () => {
    revision += 1; // Ignore pending clipboard feedback after navigation.
    get("build-view").hidden = true;
    get("find-view").hidden = false;
    returnFocus.focus();
  });
  get("reference-notice").addEventListener("click", () => {
    get("setup-details").open = true;
    get("setup-summary").focus();
  });
  get("copy").addEventListener("click", copyFormula);
  renderDiscovery();
})();
