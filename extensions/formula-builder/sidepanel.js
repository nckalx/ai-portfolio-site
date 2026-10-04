// Extension DOM/clipboard adapter. The shared core is unaware of this UI or Chrome.
(() => {
  const { catalog, categories, generateFormula, utils, validation } = globalThis.SmartsheetFormulaBuilder;
  const { findFormulas, resolveDiscoveryState } = globalThis.FormulaDiscovery;
  const get = id => document.getElementById(id);
  const drafts = new Map(); // Legacy raw strings; persisted separately from generated results.
  const structuredDrafts = new Map(); // Raw values plus UI-only row identities.
  let structuredController = null;
  const advancedInstructions = get("form-instructions").textContent;
  let selectedLibraryId = "advanced";
  let selectedId = null;
  let returnFocus = null;
  let result = null;
  let revision = 0;
  let copyAttempt = 0;
  const workspaceKey = "formulaBuilderWorkspace";
  let hydrating = true;
  let workspaceRevision = 0;
  let pendingSave = null;
  let writing = false;
  let lastSaved = null;
  let lastRequested = null;
  let saveFailed = false;

  // Read data descriptors before values, including at the storage envelope/root.
  // Never invoke getters, toJSON, or normalize unfinished user input.
  function record(value, inspectMembers = true) {
    if (!value || typeof value !== "object") throw new TypeError("Invalid record");
    const prototype = Object.getPrototypeOf(value);
    const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
    if (prototype !== null && (Object.getPrototypeOf(prototype) !== null || typeof constructor !== "function"
      || Object.getOwnPropertyDescriptor(constructor, "name")?.value !== "Object")) throw new TypeError("Invalid record");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (inspectMembers) for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string" || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable) throw new TypeError("Invalid property");
    }
    return descriptors;
  }
  function copyData(value, ancestors = new Set()) {
    if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
    if (!value || typeof value !== "object" || ancestors.has(value)) throw new TypeError("Invalid data");
    ancestors.add(value);
    let copied;
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Reflect.ownKeys(descriptors).length !== value.length + 1) throw new TypeError("Invalid array");
      copied = [];
      for (let index = 0; index < value.length; index++) {
        const item = descriptors[index];
        if (!item || !Object.hasOwn(item, "value") || !item.enumerable) throw new TypeError("Invalid item");
        copied.push(copyData(item.value, ancestors));
      }
    } else {
      const descriptors = record(value);
      copied = Object.fromEntries(Object.keys(descriptors).map(key => [key, copyData(descriptors[key].value, ancestors)]));
    }
    ancestors.delete(value);
    return copied;
  }
  const only = (value, keys) => Object.keys(value).every(key => keys.includes(key));
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  // Include shape/validation constraints, but not labels, help, or default drafts.
  function schemaFor(config) {
    function describe(rule) {
      const schema = {};
      for (const key of ["id", "type", "required", "enum", "allowedTypes", "min", "max", "minItems"]) {
        if (Object.hasOwn(rule, key)) schema[key] = copyData(rule[key]);
      }
      if (rule.fields) schema.fields = rule.fields.map(describe);
      if (rule.items) schema.items = describe(rule.items);
      if (rule.options) schema.options = rule.options.map(option => option.value);
      return schema;
    }
    return config.fields.map(describe);
  }
  function sameData(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameData(a[key], b[key]));
  }
  function validRaw(rule, value) {
    const scalarTypes = ["textLiteral", "number", "boolean", "date", "cellRef", "blank"];
    const families = {
      typedOperand: scalarTypes, valueOperand: scalarTypes, outputOperand: scalarTypes,
      numericOperand: ["number", "cellRef"], dateOperand: ["date", "cellRef"], textOperand: ["textLiteral", "cellRef"],
      valueOrRange: [...scalarTypes, "columnRef", "rangeRef"], range: ["columnRef", "rangeRef"],
      cellRef: ["cellRef"], columnRef: ["columnRef"], rangeRef: ["rangeRef"]
    };
    const member = (id, type) => ({ id, type });
    if (rule.type === "condition") return validRaw({ type: "object", fields: [member("left", "typedOperand"), member("operator", "comparisonOperator"), member("right", "typedOperand")] }, value);
    if (rule.type === "criterion") return validRaw({ type: "object", fields: [member("operator", "comparisonOperator"), member("value", "typedOperand")] }, value);
    if (["criteria[]", "condition[]", "valueOrRange[]"].includes(rule.type)) return validRaw({ type: "array", items: rule.type === "criteria[]"
      ? { type: "object", fields: [member("range", "range"), member("criterion", "criterion")] } : { type: rule.type.slice(0, -2) } }, value);
    if (rule.type === "array") return Array.isArray(value) && value.every(item => validRaw(rule.items, item));
    if (rule.type === "object") return isRecord(value) && only(value, rule.fields.map(field => field.id))
      && rule.fields.every(field => !Object.hasOwn(value, field.id) || validRaw(field, value[field.id]));
    if (families[rule.type]) {
      if (!isRecord(value)) return false;
      if (!Object.hasOwn(value, "type") || value.type === "") return only(value, ["type"]);
      if (!(rule.allowedTypes || families[rule.type]).includes(value.type)) return false;
      let fields = [];
      if (["textLiteral", "number", "date", "boolean"].includes(value.type)) fields = [member("value", value.type === "textLiteral" ? "text" : value.type)];
      if (["cellRef", "columnRef"].includes(value.type)) fields = [member("column", "columnName")];
      if (value.type === "rangeRef") {
        if (Object.hasOwn(value, "scope") && !["", "currentSheet", "crossSheet"].includes(value.scope)) return false;
        fields = [{ id: "scope", type: "enum", enum: ["currentSheet", "crossSheet"] }, ...(value.scope === "currentSheet"
          ? [member("startColumn", "columnName"), member("endColumn", "columnName")]
          : value.scope === "crossSheet" ? [member("name", "referenceName")] : [])];
      }
      return only(value, ["type", ...fields.map(field => field.id)]) && fields.every(field => !Object.hasOwn(value, field.id) || validRaw(field, value[field.id]));
    }
    if (rule.type === "boolean") return typeof value === "boolean" || value === "";
    if (rule.type === "comparisonOperator") return typeof value === "string" && (value === "" || (rule.enum || ["=", "<>", ">", "<", ">=", "<="]).includes(value));
    if (rule.enum) return typeof value === "string" && (value === "" || rule.enum.includes(value));
    if (["number", "integer"].includes(rule.type)) return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
    return ["text", "date", "columnName", "referenceName"].includes(rule.type) && typeof value === "string";
  }
  function restoreWorkspace(raw) {
    const descriptors = record(raw);
    if (!only(descriptors, ["version", "activeLibrary", "view", "formulaId", "searchText", "categoryId", "drafts"])) throw new TypeError("Invalid workspace");
    const read = key => descriptors[key]?.value;
    if (read("version") !== 1 || !["discovery", "formula"].includes(read("view")) || typeof read("searchText") !== "string"
      || typeof read("activeLibrary") !== "string" || typeof read("categoryId") !== "string"
      || !(read("formulaId") === null || typeof read("formulaId") === "string")) throw new TypeError("Invalid workspace");
    const savedDrafts = record(read("drafts"), false);
    for (const id of Object.keys(savedDrafts)) {
      try {
        if (!savedDrafts[id].enumerable || !Object.hasOwn(savedDrafts[id], "value")) continue;
        const config = Object.hasOwn(catalog, id) && catalog[id];
        if (config?.availability?.extension !== true || !["common", "advanced"].includes(config.libraryId)) continue;
        const draft = copyData(savedDrafts[id].value);
        const contract = config.inputContract || "legacy";
        if (!isRecord(draft) || !only(draft, ["contract", "schema", "values"]) || draft.contract !== contract || !sameData(draft.schema, schemaFor(config))) continue;
        if (contract === "structured-v1") {
          if (!validRaw({ type: "object", fields: config.fields }, draft.values)) continue;
          structuredDrafts.set(id, { values: draft.values, uiState: globalThis.FormulaStructuredFields.createUiState({ config, values: draft.values }) });
        } else if (contract === "legacy") {
          if (!isRecord(draft.values) || !only(draft.values, config.fields.map(field => field.id)) || !config.fields.every(field =>
            typeof draft.values[field.id] === "string" && (field.type !== "select" || field.options.some(option => option.value === draft.values[field.id])))) continue;
          drafts.set(id, draft.values);
        }
      } catch { /* One malformed draft must not discard independently valid work. */ }
    }
    const state = resolveDiscoveryState(catalog, categories, { libraryId: read("activeLibrary"), categoryId: read("categoryId") });
    selectedLibraryId = state.libraryId;
    get("search").value = read("searchText");
    // Populate options before assigning the saved value (native selects reject absent options).
    renderDiscovery();
    get("category").value = state.categoryId;
    renderDiscovery();
    const id = read("formulaId");
    if (read("view") === "formula" && (drafts.has(id) || structuredDrafts.has(id)) && catalog[id].libraryId === selectedLibraryId) openFormula(catalog[id], null);
  }
  function workspaceSnapshot() {
    const entries = [];
    for (const [id, values] of drafts) entries.push([id, { contract: "legacy", schema: schemaFor(catalog[id]), values }]);
    for (const [id, draft] of structuredDrafts) entries.push([id, { contract: "structured-v1", schema: schemaFor(catalog[id]), values: draft.values }]);
    return copyData({ version: 1, activeLibrary: selectedLibraryId, view: selectedId ? "formula" : "discovery",
      formulaId: selectedId, searchText: get("search").value, categoryId: get("category").value, drafts: Object.fromEntries(entries) });
  }
  async function drainWorkspace() {
    if (writing) return;
    writing = true;
    while (pendingSave) {
      const operation = pendingSave;
      pendingSave = null;
      try {
        const storage = globalThis.chrome?.storage?.local;
        if (operation.snapshot === null) await storage.remove(workspaceKey);
        else await storage.set({ [workspaceKey]: operation.snapshot });
        lastSaved = operation.serialized;
        if (operation.revision === workspaceRevision) {
          saveFailed = false;
          get("workspace-status").textContent = "";
        }
      } catch {
        if (operation.revision === workspaceRevision) {
          saveFailed = true;
          get("workspace-status").textContent = operation.snapshot === null
            ? "Work cleared in this panel, but saved work could not be removed. It may return when you reopen."
            : "Your work is available in this panel, but could not be saved.";
        }
      }
    }
    writing = false;
  }
  function saveWorkspace() {
    if (hydrating) return;
    const snapshot = workspaceSnapshot();
    const serialized = JSON.stringify(snapshot);
    // Touched-only blur is not a meaningful save or retry event.
    if (serialized === lastRequested) return;
    lastRequested = serialized;
    workspaceRevision++;
    if (!writing && !saveFailed && serialized === lastSaved) return;
    pendingSave = { snapshot, serialized, revision: workspaceRevision };
    void drainWorkspace();
  }
  function retryWorkspace() {
    if (saveFailed) lastRequested = null;
    saveWorkspace();
  }
  function clearWork() {
    if (hydrating) return;
    const hasWork = drafts.size || structuredDrafts.size || selectedId || selectedLibraryId !== "advanced" || get("search").value || get("category").value;
    if (hasWork && !globalThis.confirm("Clear all saved formula work? This removes every formula draft and returns to Find a formula. Your theme preference will be kept.")) return;
    revision++;
    copyAttempt++;
    structuredController?.destroy();
    structuredController = null;
    drafts.clear(); structuredDrafts.clear();
    selectedId = returnFocus = result = null;
    selectedLibraryId = "advanced";
    get("fields").textContent = "";
    get("form-instructions").textContent = advancedInstructions;
    for (const id of ["build-title", "build-category", "explanation", "validation", "copy-status", "reference-notice", "setup-notes", "instructions", "references"]) get(id).textContent = "";
    get("formula-output").value = "";
    get("copy").disabled = true;
    get("build-view").hidden = true;
    get("find-view").hidden = false;
    for (const id of ["explanation-details", "setup-details", "instructions-details"]) get(id).open = false;
    for (const id of ["reference-notice", "reference-section", "setup-details", "instructions-details"]) get(id).hidden = true;
    get("search").value = get("category").value = "";
    renderDiscovery();
    get("search").focus();
    lastRequested = JSON.stringify(workspaceSnapshot());
    // Replace queued work with removal; it runs after any already-started write.
    pendingSave = { snapshot: null, serialized: null, revision: ++workspaceRevision };
    void drainWorkspace();
  }
  function hydrateWorkspace() {
    let settled = false;
    let timer;
    function finish(saved, failed = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const envelope = record(saved);
        if (Object.hasOwn(envelope, workspaceKey)) restoreWorkspace(envelope[workspaceKey].value);
      } catch { failed = true; }
      hydrating = false;
      get("workspace").inert = false;
      get("workspace").removeAttribute("inert");
      get("workspace").setAttribute("aria-busy", "false");
      get("clear-work").disabled = false;
      get("workspace-status").textContent = failed ? "Could not load saved work. You can still use Formula Builder." : "";
      lastRequested = JSON.stringify(workspaceSnapshot());
    }
    try {
      const storage = globalThis.chrome?.storage?.local;
      if (!storage?.get) { finish({}, true); return; }
      timer = setTimeout(() => finish({}, true), 2000);
      const read = storage.get(workspaceKey);
      if (read?.then) Promise.resolve(read).then(saved => finish(saved), () => finish({}, true));
      else finish(read);
    } catch { finish({}, true); }
  }

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
    const state = resolveDiscoveryState(catalog, categories, {
      libraryId: selectedLibraryId, categoryId: get("category").value
    });
    selectedLibraryId = state.libraryId;
    get("library-selector").hidden = state.availableLibraries.length < 2;
    for (const id of ["common", "advanced"]) get(`library-${id}`).checked = id === selectedLibraryId;
    get("category").textContent = "";
    const allCategories = element("option", "All categories");
    allCategories.value = "";
    get("category").appendChild(allCategories);
    state.availableCategories.forEach(category => {
      const option = element("option", category.label);
      option.value = category.id;
      get("category").appendChild(option);
    });
    get("category").value = state.categoryId;
    const matches = findFormulas(catalog, categories, get("search").value, state.categoryId, selectedLibraryId);
    get("results").textContent = "";
    get("result-count").textContent = `${matches.length} ${matches.length === 1 ? "formula" : "formulas"}`;
    get("clear-filters").disabled = !get("search").value && !get("category").value;
    get("empty-state").hidden = matches.length !== 0;
    get("results-scroll").scrollTop = 0;
    matches.forEach(config => {
      const button = element("button", undefined, "formula-choice");
      button.type = "button";
      const title = element("span", config.label, "choice-title");
      title.id = `choice-${config.id}`;
      const description = element("span", config.explanation, "choice-description");
      description.id = `choice-description-${config.id}`;
      button.setAttribute("aria-labelledby", title.id);
      button.setAttribute("aria-describedby", description.id);
      const content = element("span", undefined, "choice-content");
      content.appendChild(title);
      content.appendChild(description);
      const chevron = element("span", "›", "choice-chevron");
      chevron.setAttribute("aria-hidden", "true");
      button.appendChild(content);
      button.appendChild(chevron);
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
    retryWorkspace();
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
      retryWorkspace();
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
    structuredController?.destroy();
    structuredController = null;
    selectedId = config.id;
    returnFocus = button;
    const structured = config.inputContract === "structured-v1";
    if (structured && !structuredDrafts.has(selectedId)) {
      const values = validation.structured.createDefaultValues(config);
      structuredDrafts.set(selectedId, { values, uiState: globalThis.FormulaStructuredFields.createUiState({ config, values }) });
    } else if (!structured && !drafts.has(selectedId)) {
      drafts.set(selectedId, Object.fromEntries(config.fields.map(field => [field.id, field.defaultValue])));
    }
    get("build-title").textContent = config.label;
    get("build-category").textContent = categories.find(category => category.id === config.categoryId).label;
    get("explanation").textContent = config.explanation;
    get("fields").textContent = "";
    get("form-instructions").textContent = structured
      ? "Fields can contain groups and repeatable rows. Include optional fields explicitly. Blank is a value, different from leaving a field out."
      : advancedInstructions;
    if (structured) {
      structuredController = globalThis.FormulaStructuredFields.mount({
        container: get("fields"), config, ...structuredDrafts.get(selectedId), validationErrors: [],
        onChange({ values, uiState }) {
          const changed = !sameData(values, structuredDrafts.get(config.id).values);
          structuredDrafts.set(config.id, { values, uiState });
          renderOutput();
          if (changed) retryWorkspace();
        }
      });
    } else {
      config.fields.forEach(field => get("fields").appendChild(renderField(field, drafts.get(selectedId)[field.id])));
    }
    ["explanation-details", "setup-details", "instructions-details"].forEach(id => { get(id).open = false; });
    get("find-view").hidden = true;
    get("build-view").hidden = false;
    renderOutput();
    get("builder-scroll").scrollTop = 0;
    get("build-title").focus();
    retryWorkspace();
  }

  function renderOutput() {
    revision += 1;
    const structured = catalog[selectedId].inputContract === "structured-v1";
    result = generateFormula(selectedId, structured ? structuredDrafts.get(selectedId).values : drafts.get(selectedId));
    const missing = new Set(result.missingFields.map(field => field.id));
    const errors = result.validationErrors;
    get("formula-output").value = result.formula || "";
    get("copy").disabled = result.formula === null;
    get("copy-status").textContent = "";
    if (structured) {
      // Never replace raw drafts with normalized result.values.
      structuredController.update({ ...structuredDrafts.get(selectedId), validationErrors: errors });
      const visibleErrors = structuredController.getVisibleErrorCount();
      const summary = visibleErrors ? `${visibleErrors} ${visibleErrors === 1 ? "field error" : "field errors"}. Review the fields above.` : "";
      if (get("validation").textContent !== summary) get("validation").textContent = summary;
    } else {
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
    }
    renderList("setup-notes", result.setupNotes);
    renderList("instructions", result.instructions);
    get("setup-details").hidden = !result.setupNotes.length && !result.references.length;
    get("instructions-details").hidden = !result.instructions.length;
    renderList("references", structured ? result.references.map(reference => utils.sheetReference(reference.name)) : result.references.map(reference =>
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

  for (const id of ["common", "advanced"]) {
    const radio = get(`library-${id}`);
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      selectedLibraryId = radio.value;
      renderDiscovery();
      retryWorkspace();
    });
  }
  get("search").addEventListener("input", () => { renderDiscovery(); retryWorkspace(); });
  get("category").addEventListener("change", () => { renderDiscovery(); retryWorkspace(); });
  get("clear-filters").addEventListener("click", clearFilters);
  get("empty-clear").addEventListener("click", clearFilters);
  get("fields-form").addEventListener("submit", event => event.preventDefault());
  get("back").addEventListener("click", () => {
    revision += 1; // Ignore pending clipboard feedback after navigation.
    structuredController?.destroy();
    structuredController = null;
    get("build-view").hidden = true;
    get("find-view").hidden = false;
    selectedId = null;
    (returnFocus || get("search")).focus();
    retryWorkspace();
  });
  get("reference-notice").addEventListener("click", () => {
    get("setup-details").open = true;
    get("setup-summary").focus();
  });
  get("copy").addEventListener("click", copyFormula);
  get("clear-work").addEventListener("click", clearWork);
  renderDiscovery();
  hydrateWorkspace();
})();
