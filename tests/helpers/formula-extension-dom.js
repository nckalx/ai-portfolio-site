const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadFormulaCore } = require("./load-formula-core");

// Small DOM contract double, not a layout/accessibility emulator. Build the tree
// from the real shell so renamed/missing elements and hidden views are tested.
function createDocument() {
  let document;
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.open = false;
      this.scrollTop = 0;
      this._value = undefined;
      this._text = "";
    }
    appendChild(child) { child.remove(); child.parent = this; this.children.push(child); return child; }
    remove() {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    }
    removeAttribute(name) { delete this.attributes[name]; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    removeEventListener(name, callback) { this.listeners[name] = (this.listeners[name] || []).filter(item => item !== callback); }
    dispatch(name, event = {}) {
      if (name === "click" && this.disabled) return;
      for (const callback of this.listeners[name] || []) callback(event);
    }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    get value() { return this._value ?? (this.tagName === "select" ? this.children[0]?.value : "") ?? ""; }
    set value(value) { this._value = value; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this._text = value; for (const child of this.children) child.parent = null; this.children = []; }
    set innerHTML(_) { throw new Error("HTML insertion is not permitted"); }
  }
  const root = new Element("root");
  document = {
    activeElement: null,
    readyState: "loading",
    listeners: {},
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
    createElement: tag => new Element(tag),
    getElementById(id) {
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) { const match = find(child); if (match) return match; }
        return null;
      }
      return find(root);
    }
  };
  return { document, root, Element };
}

function setupStructuredFields() {
  const { document, root } = createDocument();
  const container = document.createElement("div");
  root.appendChild(container);
  const context = vm.createContext({ document });
  const filename = path.resolve(__dirname, "../../extensions/formula-builder/structured-fields.js");
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return { document, container, renderer: context.FormulaStructuredFields };
}

function setupExtension(navigator = {}, theme = {}, configureCore = () => {}, beforeEngine = () => {}) {
  const { document, root, Element } = createDocument();
  const storageWrites = [];
  const mediaListeners = [];
  const media = {
    matches: theme.systemDark || false,
    addEventListener(name, callback) { if (name === "change") mediaListeners.push(callback); }
  };
  const directory = path.resolve(__dirname, "../../extensions/formula-builder");
  const html = fs.readFileSync(path.join(directory, "sidepanel.html"), "utf8");
  const stack = [root];
  for (const token of html.match(/<[^>]+>|[^<]+/g)) {
    if (token.startsWith("<!")) continue;
    if (token.startsWith("</")) { stack.pop(); continue; }
    if (!token.startsWith("<")) { stack.at(-1).appendChild(Object.assign(new Element("text"), { _text: token })); continue; }
    const tag = token.match(/^<([\w-]+)/)[1];
    const node = new Element(tag);
    for (const match of token.matchAll(/([\w-]+)="([^"]*)"/g)) {
      node.setAttribute(match[1], match[2]);
      if (["id", "value", "type"].includes(match[1])) node[match[1]] = match[2];
    }
    for (const name of ["hidden", "disabled", "readonly", "checked"]) if (new RegExp(`\\s${name}(?:\\s|>)`).test(token)) node[name] = true;
    stack.at(-1).appendChild(node);
    if (!["meta", "link", "input"].includes(tag)) stack.push(node);
  }
  document.documentElement = root.children.find(node => node.tagName === "html");
  const context = vm.createContext({ document, navigator, matchMedia: () => media,
    chrome: { storage: { local: {
      get: theme.get || (async () => ({ theme: theme.saved })),
      set: theme.set || (async value => { storageWrites.push(JSON.parse(JSON.stringify(value))); })
    } } }
  });
  vm.runInContext(fs.readFileSync(path.join(directory, "theme.js"), "utf8"), context, { filename: "theme.js" });
  const core = loadFormulaCore(context, beforeEngine);
  configureCore(core);
  let generationCalls = 0;
  const generate = core.generateFormula;
  core.generateFormula = (...args) => { generationCalls++; return generate(...args); };
  for (const file of ["formula-discovery.js", "structured-fields.js", "sidepanel.js"]) {
    vm.runInContext(fs.readFileSync(path.join(directory, file), "utf8"), context, { filename: file });
  }
  document.readyState = "complete";
  for (const callback of document.listeners.DOMContentLoaded || []) callback();
  const get = id => document.getElementById(id);
  const choices = () => get("results").children.map(item => item.children[0]);
  const choose = id => {
    const button = choices().find(button => get(button.getAttribute("aria-labelledby"))?.textContent === core.catalog[id].label);
    if (!button) throw new Error(`Formula not discoverable: ${id}`);
    button.dispatch("click");
    return button;
  };
  return { document, core, get, choose, choices, storageWrites,
    generationCount: () => generationCalls,
    changeSystem(dark) { media.matches = dark; mediaListeners.forEach(callback => callback({ matches: dark })); }
  };
}

module.exports = { setupExtension, setupStructuredFields };
