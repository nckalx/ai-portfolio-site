// Extension-only field DOM. Raw semantic drafts and serializable row identities
// are independent; validation, generation, navigation and persistence live elsewhere.
(() => {
  const clone = value => Array.isArray(value) ? value.map(clone)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
  const member = (id, type, label) => ({ id, type, label });
  // Presentation order mirrors Phase 4A. Validator-backed tests protect this map.
  const scalars = ["textLiteral", "number", "boolean", "date", "cellRef", "blank"];
  const families = {
    typedOperand: scalars, valueOperand: scalars, outputOperand: scalars,
    numericOperand: ["number", "cellRef"], dateOperand: ["date", "cellRef"], textOperand: ["textLiteral", "cellRef"],
    valueOrRange: [...scalars, "columnRef", "rangeRef"], range: ["columnRef", "rangeRef"],
    cellRef: ["cellRef"], columnRef: ["columnRef"], rangeRef: ["rangeRef"]
  };
  const names = { textLiteral: "Specific text string", number: "Number", boolean: "Boolean", date: "Date",
    cellRef: "Current-row cell", blank: "Blank", columnRef: "Whole column", rangeRef: "Range",
    currentSheet: "Current sheet", crossSheet: "Cross-sheet named reference" };
  const operators = ["=", "<>", ">", "<", ">=", "<="];
  function expand(rule) {
    if (rule.type === "condition") return { ...rule, type: "object", fields: [member("left", "typedOperand", "Left operand"), member("operator", "comparisonOperator", "Operator"), member("right", "typedOperand", "Right operand")] };
    if (rule.type === "criterion") return { ...rule, type: "object", fields: [member("operator", "comparisonOperator", "Operator"), member("value", "typedOperand", "Value")] };
    if (["criteria[]", "condition[]", "valueOrRange[]"].includes(rule.type)) return {
      ...rule, type: "array", minItems: Math.max(1, rule.minItems || 0),
      items: rule.type === "criteria[]" ? { type: "object", fields: [member("range", "range", "Range"), member("criterion", "criterion", "Criterion")] } : { type: rule.type.slice(0, -2) }
    };
    return rule;
  }
  const childAddress = (parent, key) => parent ? `${parent}.${key}` : key;
  const enginePath = parts => parts.reduce((path, key) => typeof key === "number" ? `${path}[${key}]` : childAddress(path, key), "");
  const read = (values, parts) => parts.reduce((value, key) => value?.[key], values);
  function write(values, parts, value, remove = false) {
    let target = values;
    for (const key of parts.slice(0, -1)) target = target[key] ||= {};
    if (remove) delete target[parts.at(-1)];
    else target[parts.at(-1)] = value;
  }
  function starter(schema) {
    const rule = expand(schema);
    return rule.type === "array" ? [] : rule.type === "object" || families[rule.type] ? {} : "";
  }
  function typedStarter(type) {
    if (!type) return {};
    if (["textLiteral", "number", "date"].includes(type)) return { type, value: "" };
    if (["cellRef", "columnRef"].includes(type)) return { type, column: "" };
    return { type };
  }
  // Reconcile only present arrays. A removed parent cannot leave descendant keys.
  function reconcile(config, values, prior = { nextKey: 1, rows: {} }) {
    const state = { nextKey: prior.nextKey, rows: {}, touched: clone(prior.touched || {}) };
    function visit(schema, value, address) {
      const rule = expand(schema);
      if (rule.type === "array" && Array.isArray(value)) {
        const keys = value.map((_, index) => prior.rows[address]?.[index] || `r${state.nextKey++}`);
        state.rows[address] = keys;
        value.forEach((item, index) => visit(rule.items, item, `${address}[${keys[index]}]`));
      } else if (rule.type === "object" && value && typeof value === "object") {
        rule.fields.forEach(field => visit(field, value[field.id], childAddress(address, field.id)));
      }
    }
    config.fields.forEach(field => visit(field, values[field.id], field.id));
    return state;
  }
  function createUiState({ config, values }) { return reconcile(config, values); }

  function mount({ container, config, values, uiState, validationErrors = [], onChange }) {
    let current = clone(values), state = clone(uiState), errors = clone(validationErrors), destroyed = false;
    state.touched ||= {};
    let visibleErrorCount = 0;
    const paths = new Map(), addresses = new Map(), anchors = new Set();
    const removeControls = new WeakSet();
    const id = (address, role) => "structured-" + Array.from(JSON.stringify([config.id, address, role]), character => character.codePointAt(0).toString(16)).join("-");
    function element(tag, text, className) {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    }
    function listen(owner, node, event, callback) {
      node.addEventListener(event, callback);
      owner.cleanup.push(() => node.removeEventListener(event, callback));
    }
    function anchor(node, host, address, role, help = "") {
      const error = element("p", "", "field-error");
      error.id = id(address, `${role}-error`);
      error.hidden = true;
      host.appendChild(error);
      const helpIds = [];
      if (help) {
        const note = element("p", help, "muted structured-help");
        note.id = id(address, `${role}-help`);
        host.appendChild(note);
        helpIds.push(note.id);
      }
      return { node, error, helpIds, address };
    }
    function register(target, parts, address) {
      anchors.add(target);
      paths.set(enginePath(parts), target);
      addresses.set(address, target.node);
    }
    function control(host, address, role, labelText, choices, help = "") {
      const label = element("label", labelText);
      const node = element(choices ? "select" : "input");
      node.id = id(address, role);
      label.setAttribute("for", node.id);
      if (choices) {
        for (const [value, label] of [["", "Choose…"], ...choices]) {
          const option = element("option", label);
          option.value = value;
          node.appendChild(option);
        }
      } else {
        node.type = "text";
        node.autocomplete = "off";
        node.spellcheck = false;
      }
      host.appendChild(label);
      host.appendChild(node);
      const target = anchor(node, host, address, role, help);
      return { ...target, label };
    }
    function edit(parts, value, remove = false, focusTarget = null) {
      const next = clone(current);
      write(next, parts, value, remove);
      commit(next, state, focusTarget);
    }
    const within = (key, address) => !address || key === address || key.startsWith(`${address}.`) || key.startsWith(`${address}[`);
    function clearTouched(address, keep = []) {
      for (const key of Object.keys(state.touched)) if (within(key, address) && !keep.includes(key)) delete state.touched[key];
    }
    function interaction(node, event, handler, address) {
      const change = () => { state.touched[address] = true; handler(); };
      const blur = () => {
        if (destroyed || state.touched[address]) return;
        state.touched[address] = true;
        commit(current, state, null);
      };
      node.addEventListener(event, change);
      node.addEventListener("blur", blur);
      return () => { node.removeEventListener(event, change); node.removeEventListener("blur", blur); };
    }
    function commit(next, nextState, focusTarget) {
      if (destroyed) return;
      current = clone(next);
      state = reconcile(config, current, nextState);
      sync();
      onChange({ values: clone(current), uiState: clone(state), focusTarget });
      if (focusTarget) focus(focusTarget);
    }
    function makeField(schema, address, host, row = false) {
      const rule = expand(schema), composite = rule.type === "object" || rule.type === "array" || !!families[rule.type];
      const node = element(composite || row ? "fieldset" : "div", undefined, "structured-field");
      node.id = id(address, "group");
      const record = { node, parts: [], cleanup: [], children: [], bodyKind: null, rows: new Map() };
      host.appendChild(node);
      const title = composite || row ? element("legend", schema.label || schema.id || "Item") : null;
      if (title) node.appendChild(title);
      let labelText = schema.label || schema.id || "Value";
      let include;
      if (rule.required === false && !row) {
        include = element("input"); include.type = "checkbox"; include.id = id(address, "include");
        const label = element("label", `Include ${labelText}`, "structured-presence");
        label.setAttribute("for", include.id);
        label.appendChild(include); node.appendChild(label);
        listen(record, include, "change", () => {
          clearTouched(address);
          edit(record.parts, starter(rule), !include.checked);
        });
      }
      const body = element("div", undefined, "structured-body"); node.appendChild(body);
      const group = anchor(node, node, address, "group", composite ? rule.help : "");
      let input, typeControl, scopeControl, add;
      const clearBody = () => {
        record.children.forEach(child => child.destroy()); record.children = [];
        for (const cleanup of record.bodyCleanup || []) cleanup();
        record.bodyCleanup = [];
        body.textContent = "";
        input = typeControl = scopeControl = add = null;
      };
      function build() {
        if (rule.type === "object") {
          record.children = rule.fields.map(field => makeField(field, childAddress(address, field.id), body));
        } else if (rule.type === "array") {
          record.rowHost = element("div", undefined, "structured-rows"); body.appendChild(record.rowHost);
          add = element("button", `Add ${labelText}`, "secondary-button"); add.type = "button";
          add.id = id(address, "add"); body.appendChild(add);
          const handler = () => {
            const next = clone(current), items = clone(read(current, record.parts) || []);
            items.push(starter(rule.items)); write(next, record.parts, items);
            const nextState = reconcile(config, next, state);
            commit(next, nextState, `${address}[${nextState.rows[address].at(-1)}]`);
          };
          record.bodyCleanup.push(interaction(add, "click", handler, address));
        } else if (families[rule.type]) {
          const permitted = rule.allowedTypes || families[rule.type];
          typeControl = control(body, address, "type", `${labelText} kind`, permitted.map(type => [type, names[type]]));
          const selector = typeControl.node;
          const handler = () => {
            clearTouched(address, [`${address}.type`]);
            edit(record.parts, typedStarter(selector.value), false, `${address}.type`);
          };
          record.bodyCleanup.push(interaction(selector, "change", handler, `${address}.type`));
          record.editorHost = element("div", undefined, "structured-editor"); body.appendChild(record.editorHost);
          record.editorKind = null;
        } else {
          const choices = rule.type === "boolean" ? [["true", "True"], ["false", "False"]]
            : rule.type === "comparisonOperator" ? (rule.enum ? operators.filter(value => rule.enum.includes(value)) : operators).map(value => [value, value])
              : rule.enum ? rule.enum.map(value => [value, value]) : null;
          const format = rule.type === "date" ? "Use YYYY-MM-DD." : rule.type === "integer" ? "Enter a whole number." : rule.type === "number" ? "Enter a decimal number." : "";
          const bounds = ["min", "max"].filter(key => Object.hasOwn(rule, key)).map(key => `${key === "min" ? "Minimum" : "Maximum"}: ${rule[key]}.`).join(" ");
          input = control(body, address, "input", labelText, choices, [rule.help, format, bounds].filter(Boolean).join(" "));
          if (["number", "integer"].includes(rule.type)) input.node.setAttribute("inputmode", rule.type === "integer" ? "numeric" : "decimal");
          input.node.setAttribute("aria-required", rule.required === false ? "false" : "true");
          const editor = input.node;
          const handler = () => edit(record.parts, rule.type === "boolean" && editor.value !== "" ? editor.value === "true" : editor.value);
          const event = choices ? "change" : "input";
          record.bodyCleanup.push(interaction(editor, event, handler, address));
        }
      }
      function syncOperand(value) {
        const type = value?.type || "";
        if (typeControl.node.value !== type) typeControl.node.value = type;
        register(typeControl, [...record.parts, "type"], `${address}.type`);
        if (record.editorKind !== type) {
          record.children.forEach(child => child.destroy()); record.children = [];
          if (record.scopeCleanup) record.scopeCleanup(); record.scopeCleanup = null;
          record.editorHost.textContent = ""; scopeControl = null;
          record.editorKind = type; record.scopeKind = null;
          if (type === "rangeRef") {
            scopeControl = control(record.editorHost, address, "scope", `${labelText} scope`, ["currentSheet", "crossSheet"].map(scope => [scope, names[scope]]));
            const selector = scopeControl.node;
            const handler = () => {
              clearTouched(address, [`${address}.type`, `${address}.scope`]);
              const scope = selector.value;
              const next = scope === "currentSheet" ? { type, scope, startColumn: "", endColumn: "" }
                : scope === "crossSheet" ? { type, scope, name: "" } : { type };
              edit(record.parts, next, false, `${address}.scope`);
            };
            record.scopeCleanup = interaction(selector, "change", handler, `${address}.scope`);
            record.scopeHost = element("div"); record.editorHost.appendChild(record.scopeHost);
          } else {
            const field = ["cellRef", "columnRef"].includes(type) ? member("column", "columnName", type === "cellRef" ? "Current-row column" : "Whole column")
              : ["textLiteral", "number", "date", "boolean"].includes(type) ? member("value", type === "textLiteral" ? "text" : type, type === "textLiteral" ? "Text" : names[type]) : null;
            if (field) record.children.push(makeField(field, childAddress(address, field.id), record.editorHost));
          }
        }
        if (scopeControl) {
          const scope = value?.scope || "";
          if (scopeControl.node.value !== scope) scopeControl.node.value = scope;
          register(scopeControl, [...record.parts, "scope"], `${address}.scope`);
          if (record.scopeKind !== scope) {
            record.children.forEach(child => child.destroy());
            const fields = scope === "currentSheet" ? [member("startColumn", "columnName", "Start column"), member("endColumn", "columnName", "End column")]
              : scope === "crossSheet" ? [member("name", "referenceName", "Reference name")] : [];
            record.children = fields.map(field => makeField(field, childAddress(address, field.id), record.scopeHost));
            record.scopeKind = scope;
          }
        }
        record.children.forEach(child => child.sync([...record.parts, child.fieldId]));
      }
      record.fieldId = rule.id;
      record.sync = parts => {
        record.parts = parts;
        const value = read(current, parts), present = value !== undefined;
        register(group, parts, address);
        if (include) { include.checked = present; addresses.set(`${address}:include`, include); }
        const visible = !include || present;
        if (record.bodyKind !== visible) {
          clearBody();
          for (const row of record.rows.values()) row.destroy(); record.rows.clear();
          if (record.scopeCleanup) record.scopeCleanup(); record.scopeCleanup = null;
          record.bodyKind = visible;
          if (visible) build();
        }
        if (!visible) { addresses.set(address, include); return; }
        if (input) {
          const raw = value === undefined ? "" : String(value);
          if (input.node.value !== raw) input.node.value = raw;
          register(input, parts, address);
        } else if (typeControl) syncOperand(value);
        else if (rule.type === "object") record.children.forEach(child => child.sync([...parts, child.fieldId]));
        else if (rule.type === "array") {
          addresses.set(`${address}:add`, add);
          const keys = state.rows[address] || [];
          for (const [key, row] of record.rows) if (!keys.includes(key)) { row.destroy(); record.rows.delete(key); }
          keys.forEach((key, index) => {
            let child = record.rows.get(key);
            if (!child) {
              child = makeField({ ...rule.items, required: true, label: `${labelText} ${index + 1}` }, `${address}[${key}]`, record.rowHost, true);
              const remove = element("button", "Remove", "secondary-button"); remove.type = "button";
              removeControls.add(remove);
              child.node.appendChild(remove); child.removeButton = remove;
              listen(child, remove, "click", () => {
                const liveKeys = state.rows[address] || [], position = liveKeys.indexOf(key);
                if (position < 0 || liveKeys.length <= (rule.minItems || 0)) return;
                const next = clone(current), items = read(next, record.parts), nextState = clone(state);
                items.splice(position, 1); nextState.rows[address].splice(position, 1);
                const remaining = nextState.rows[address];
                commit(next, nextState, remaining.length ? `${address}[${remaining[Math.min(position, remaining.length - 1)]}]` : `${address}:add`);
              });
              record.rows.set(key, child);
            }
            child.setTitle(`${labelText} ${index + 1}`);
            child.removeButton.setAttribute("aria-label", `Remove ${labelText} ${index + 1}`);
            child.removeButton.disabled = keys.length <= (rule.minItems || 0);
            child.sync([...parts, index]);
          });
        }
      };
      record.setTitle = text => {
        labelText = text;
        if (title) title.textContent = text;
        if (input && row) input.label.textContent = text;
        if (typeControl && row) typeControl.label.textContent = `${text} kind`;
        if (scopeControl && row) scopeControl.label.textContent = `${text} scope`;
        if (add && row) add.textContent = `Add ${text}`;
      };
      record.destroy = () => {
        clearBody();
        if (record.scopeCleanup) record.scopeCleanup();
        record.rows.forEach(row => row.destroy()); record.rows.clear();
        record.cleanup.forEach(cleanup => cleanup()); record.cleanup = [];
        node.remove();
      };
      return record;
    }
    const root = element("div", undefined, "structured-fields"); container.appendChild(root);
    const fallback = anchor(root, root, "", "form");
    const fields = config.fields.map(field => makeField(field, field.id, root));
    function sync() {
      paths.clear(); addresses.clear(); anchors.clear();
      register(fallback, [], "");
      fields.forEach(field => field.sync([field.fieldId]));
      // Stable UI addresses survive row reindexing; removed editors retain no interaction state.
      for (const key of Object.keys(state.touched)) if (!addresses.has(key)) delete state.touched[key];
      const touched = Object.keys(state.touched).filter(key => state.touched[key]);
      visibleErrorCount = 0;
      const messages = new Map();
      for (const error of errors) {
        let path = error.path;
        while (!paths.has(path) && path) {
          const parent = path.replace(/(?:\.[^.\[\]]+|\[\d+\]|^[^.\[\]]+)$/, "");
          // Builder errors may contain any string path, including unrecognized syntax.
          path = parent === path ? "" : parent;
        }
        const target = paths.get(path) || fallback;
        if (!touched.some(key => within(key, target.address))) continue;
        visibleErrorCount += 1;
        if (!messages.has(target)) messages.set(target, []);
        messages.get(target).push(error.message);
      }
      for (const target of anchors) {
        const text = (messages.get(target) || []).join("\n");
        target.error.textContent = text; target.error.hidden = !text;
        target.node.setAttribute("aria-invalid", text ? "true" : "false");
        const descriptions = [...target.helpIds, ...(text ? [target.error.id] : [])];
        if (descriptions.length) target.node.setAttribute("aria-describedby", descriptions.join(" "));
        else target.node.removeAttribute("aria-describedby");
      }
    }
    function focus(target) {
      if (destroyed) return false;
      const node = addresses.get(target);
      if (!node || node.disabled || node.hidden) return false;
      function firstControl(parent) {
        for (const child of parent.children) {
          if (child.hidden || child.disabled || removeControls.has(child)) continue;
          if (["INPUT", "SELECT", "BUTTON"].includes(child.tagName.toUpperCase())) return child;
          const match = firstControl(child); if (match) return match;
        }
        return null;
      }
      const destination = ["INPUT", "SELECT", "BUTTON"].includes(node.tagName.toUpperCase()) ? node : firstControl(node) || node;
      if (destination === node && !["INPUT", "SELECT", "BUTTON"].includes(node.tagName.toUpperCase())) node.setAttribute("tabindex", "-1");
      destination.focus(); return true;
    }
    sync();
    return {
      update(next) {
        if (destroyed) return;
        if (Object.hasOwn(next, "values")) current = clone(next.values);
        if (Object.hasOwn(next, "uiState")) { state = clone(next.uiState); state.touched ||= {}; }
        if (Object.hasOwn(next, "validationErrors")) errors = clone(next.validationErrors);
        sync();
      },
      focus,
      getVisibleErrorCount: () => visibleErrorCount,
      destroy() {
        if (destroyed) return;
        destroyed = true; fields.forEach(field => field.destroy()); root.remove();
        paths.clear(); addresses.clear(); anchors.clear(); current = state = errors = null;
      }
    };
  }
  globalThis.FormulaStructuredFields = Object.freeze({ createUiState, mount });
})();
